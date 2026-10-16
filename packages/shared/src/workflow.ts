import { createHash } from "node:crypto";
import { z } from "zod";
import { DESTRUCTIVE_ACTION_PATTERNS, type InteractionRisk } from "./constants.js";
import { redactObject } from "./redact.js";

export const WORKFLOW_ACTION_TYPES = [
  "fill",
  "select",
  "check",
  "upload-fixture",
  "click",
  "wait",
  "assert-text",
  "assert-url",
] as const;

export const WORKFLOW_STEP_STATUSES = ["planned", "completed", "blocked", "failed", "skipped"] as const;
export const GRAPH_NODE_KINDS = ["page", "form", "field", "button"] as const;
export const GRAPH_EDGE_KINDS = ["navigation", "contains", "workflow", "suggested"] as const;
export const GRAPH_NODE_STATUSES = ["discovered", "visited", "completed", "failed", "blocked"] as const;

const actionShape = z
  .object({
    type: z.enum(WORKFLOW_ACTION_TYPES),
    selector: z.string().min(1).max(500),
    fieldKey: z.string().min(1).max(80).optional(),
    entityKey: z.string().min(1).max(80).optional(),
    value: z.string().max(500).optional(),
    expected: z.string().min(1).max(300),
    reason: z.string().min(1).max(300),
  })
  .strict();

export const workflowActionSchema = actionShape;
export const workflowPlanSchema = z
  .object({
    actions: z.array(actionShape).max(40),
    suggestedEdges: z
      .array(
        z
          .object({
            from: z.string().min(1).max(200),
            to: z.string().min(1).max(200),
            label: z.string().max(120).optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
  })
  .strict();

export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>;

export interface RegistryEntry {
  entityKey: string;
  fieldKey: string;
  value: string;
  sensitive: boolean;
  source: "generated" | "observed";
}

export interface ObservedField {
  selector: string;
  name: string | null;
  type: string;
  label: string;
  required: boolean;
  maxLength?: number;
  options?: string[];
}

export interface ObservedControl {
  selector: string;
  text: string;
  type: string;
  href: string | null;
  risk: InteractionRisk;
}

export interface WorkflowGraphNode {
  id: string;
  kind: (typeof GRAPH_NODE_KINDS)[number];
  label: string;
  url?: string;
  status?: (typeof GRAPH_NODE_STATUSES)[number];
}

export interface WorkflowGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: (typeof GRAPH_EDGE_KINDS)[number];
  observed: boolean;
  label?: string;
}

export interface WorkflowGraphSnapshot {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

export interface SafetyDecision {
  allow: boolean;
  reason: string;
}

const SENSITIVE_FIELD = /password|passwd|secret|token|cvv|cvc|card|ssn|iban/i;
const PAYMENT_BLOB = /credit|card|cvv|cvc|iban|payment|checkout|ssn/i;
const LOGIN_BLOB = /login|signin|sign-in|auth/i;

export function emptyGraph(): WorkflowGraphSnapshot {
  return { nodes: [], edges: [] };
}

export function workflowFingerprint(pageUrl: string, action: Pick<WorkflowAction, "type" | "selector" | "fieldKey">): string {
  const payload = [normalizePage(pageUrl), action.type, action.selector, action.fieldKey ?? ""].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function isSensitiveField(name: string, type: string): boolean {
  return type === "password" || SENSITIVE_FIELD.test(name);
}

function pagePath(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname.toLowerCase();
  } catch {
    return pageUrl.toLowerCase();
  }
}

export function entityKeyFor(field: Pick<ObservedField, "name" | "label" | "type">, pageUrl = ""): string {
  const label = `${field.name ?? ""} ${field.label ?? ""}`.toLowerCase();
  const path = pagePath(pageUrl);
  if (/employee|payroll|staff/.test(label)) return "employee";
  if (/product|\bsku\b|\bitem\b/.test(label)) return "product";
  if (/expense/.test(label)) return "expense";
  if (/measurement|chest|waist|length/.test(label)) return "measurement";
  if (/invoice|billing/.test(label)) return "invoice";
  if (/\border\b/.test(label)) return "order";
  if (/customer|client/.test(label)) return "customer";
  if (/company|organi[sz]ation/.test(label)) return "company";
  if (/\/(products|inventory|items)(\/|$)/.test(path)) return "product";
  if (/\/expenses(\/|$)/.test(path)) return "expense";
  if (/\/measurements(\/|$)/.test(path)) return "measurement";
  if (/\/invoices(\/|$)/.test(path)) return "invoice";
  if (/\/orders(\/|$)/.test(path)) return "order";
  if (/\/payroll|\/employees/.test(path)) return "employee";
  if (/\/reminders(\/|$)/.test(path)) return "reminder";
  return "customer";
}

export function fieldKeyFor(field: Pick<ObservedField, "name" | "label" | "type">, pageUrl = ""): string {
  const hint = `${field.name ?? ""} ${field.label ?? ""} ${field.type}`.toLowerCase();
  const entity = entityKeyFor(field, pageUrl);
  if (field.type === "email" || /e-?mail/.test(hint)) return "email";
  if (field.type === "tel" || /phone|mobile/.test(hint)) return "phone";
  if (field.type === "password" || /password/.test(hint)) return "password";
  if (/first/.test(hint)) return "firstName";
  if (/last|surname/.test(hint)) return "lastName";
  if (/\bsku\b|item code|product code/.test(hint)) return "sku";
  if (/price|cost|\bamount\b|\brate\b|\bmrp\b/.test(hint)) return "price";
  if (/qty|quantity|stock/.test(hint)) return "quantity";
  if (/categor/.test(hint)) return "category";
  if (/desc|detail|\bnote\b/.test(hint)) return "description";
  if (/\bbrand\b/.test(hint)) return "brand";
  if (/company|organi[sz]ation/.test(hint)) return "name";
  if (/\bcity\b/.test(hint)) return "city";
  if (/zip|postal/.test(hint)) return "postal";
  if (/address|street/.test(hint)) return "address";
  if (/name|title/.test(hint)) {
    if (entity === "product") return "productName";
    if (entity === "customer" || entity === "employee" || entity === "company") return "name";
    return `${entity}Name`;
  }
  if (field.type === "date") return "date";
  if (field.type === "number") return "number";
  if (field.type === "url") return "url";
  return (field.name || field.type || "value").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40) || "value";
}

export function readRegistry(entries: RegistryEntry[], entityKey: string, fieldKey: string): RegistryEntry | undefined {
  return entries.find((entry) => entry.entityKey === entityKey && entry.fieldKey === fieldKey);
}

export function rememberValue(entries: RegistryEntry[], next: RegistryEntry): RegistryEntry[] {
  const index = entries.findIndex((entry) => entry.entityKey === next.entityKey && entry.fieldKey === next.fieldKey);
  if (index === -1) return [...entries, next];
  const copy = entries.slice();
  copy[index] = next;
  return copy;
}

export function publicRegistry(entries: RegistryEntry[]): RegistryEntry[] {
  return entries.map((entry) =>
    entry.sensitive ? { ...entry, value: "[REDACTED]" } : entry,
  );
}

const NAV_LABEL = /^(dashboard|home|reminders|measurements|customers|orders|invoices|settings|inventory|products|expenses|pos|payroll|reports|menu)$/i;

export function fieldsToFill(fields: ObservedField[]): ObservedField[] {
  const required = fields.filter((field) => field.required);
  return required.length > 0 ? required : fields;
}

export function isPageAdvance(control: Pick<ObservedControl, "text" | "type">, kind: "forward" | "finish"): boolean {
  const text = control.text.trim();
  if (!text || text.length > 40) return false;
  if (NAV_LABEL.test(text)) return false;
  if (/delete|remove|logout|log out|sign out|payment|checkout|cancel/i.test(text)) return false;
  if (kind === "forward") return /\b(next|continue|proceed)\b/i.test(text);
  return control.type === "submit" || /\b(save|submit|finish|done|create)\b/i.test(text);
}

export function chooseAdvance(input: { forward: ObservedControl | null; submit: ObservedControl | null }): "forward" | "finish" | "stop" {
  if (input.forward && isPageAdvance(input.forward, "forward")) return "forward";
  if (input.submit && isPageAdvance(input.submit, "finish")) return "finish";
  return "stop";
}

export function syntheticValue(field: ObservedField, seed: number, entries: RegistryEntry[], pageUrl = ""): { entry: RegistryEntry; value: string | "check" | "skip" } {
  const type = (field.type || "text").toLowerCase();
  if (["hidden", "submit", "button", "reset", "image"].includes(type)) {
    return { value: "skip", entry: placeholderEntry(field, "", pageUrl) };
  }
  if (type === "file") return { value: "skip", entry: placeholderEntry(field, "", pageUrl) };
  if (type === "checkbox" || type === "radio") return { value: "check", entry: placeholderEntry(field, "checked", pageUrl) };
  const entityKey = entityKeyFor(field, pageUrl);
  const fieldKey = fieldKeyFor(field, pageUrl);
  const existing = readRegistry(entries, entityKey, fieldKey);
  if (existing) return { value: existing.value, entry: existing };
  const sensitive = isSensitiveField(`${field.name ?? ""} ${field.label ?? ""}`, type);
  const value = generatedValue(field, fieldKey, entityKey, type, seed);
  const entry: RegistryEntry = { entityKey, fieldKey, value, sensitive, source: "generated" };
  return { entry, value };
}

function placeholderEntry(field: ObservedField, value: string, pageUrl = ""): RegistryEntry {
  return {
    entityKey: entityKeyFor(field, pageUrl),
    fieldKey: fieldKeyFor(field, pageUrl),
    value,
    sensitive: false,
    source: "generated",
  };
}

function generatedValue(field: ObservedField, fieldKey: string, entityKey: string, type: string, seed: number): string {
  const first = ["Alex", "Jordan", "Riley", "Casey", "Morgan"][Math.abs(seed) % 5];
  const last = "Customer";
  const fit = (value: string) => (field.maxLength && field.maxLength > 0 && value.length > field.maxLength ? value.slice(0, field.maxLength) : value);
  if (fieldKey === "email" || type === "email") return fit(`${first.toLowerCase()}.customer.${Math.abs(seed)}@example.com`);
  if (fieldKey === "phone" || type === "tel") return fit(`98765${String(Math.abs(seed)).padStart(5, "0").slice(-5)}`);
  if (fieldKey === "password" || type === "password") return fit(`Test-pass-${Math.abs(seed)}-Aa`);
  if (fieldKey === "firstName") return fit(first);
  if (fieldKey === "lastName") return fit(last);
  if (fieldKey === "productName") return fit(`Cotton Shirt ${Math.abs(seed)}`);
  if (fieldKey === "sku") return fit(`SKU-${1000 + (Math.abs(seed) % 9000)}`);
  if (fieldKey === "price") return fit("499");
  if (fieldKey === "quantity") return fit("2");
  if (fieldKey === "brand") return fit("Northwind");
  if (fieldKey === "category") return fit(field.options?.[0] || "General");
  if (fieldKey === "description") return fit(`Sample ${entityKey} details for this record.`);
  if (fieldKey === "name" && entityKey === "company") return fit("Northwind Studio");
  if (fieldKey === "name") return fit(`${first} ${last}`);
  if (fieldKey.endsWith("Name")) return fit(`Sample ${entityKey} ${Math.abs(seed)}`);
  if (fieldKey === "city") return fit("Chennai");
  if (fieldKey === "postal") return fit("600001");
  if (fieldKey === "address") return fit("12 Sample Street");
  if (type === "url" || fieldKey === "url") return fit("https://example.com");
  if (type === "number" || fieldKey === "number") return fit("2");
  if (type === "date" || fieldKey === "date") return fit("2026-10-12");
  if (type === "time") return fit("10:00");
  if (type === "datetime-local") return fit("2026-10-12T10:00");
  if (type === "select" && field.options?.length) return fit(field.options[Math.abs(seed) % field.options.length] ?? "2");
  if (entityKey === "customer" || entityKey === "employee") return fit(`${first} ${last}`);
  return fit(`Sample ${entityKey} ${Math.abs(seed)}`);
}

export function decideActionSafety(input: {
  action: WorkflowAction;
  pageUrl: string;
  formAction?: string | null;
  controlText?: string | null;
  fieldType?: string | null;
  risk?: InteractionRisk | null;
  selectorObserved: boolean;
}): SafetyDecision {
  if (!input.selectorObserved) {
    return { allow: false, reason: "Selector was not observed on the page, so the action is unverified" };
  }
  const blob = `${input.action.selector} ${input.controlText ?? ""} ${input.fieldType ?? ""} ${input.formAction ?? ""}`;
  if (DESTRUCTIVE_ACTION_PATTERNS.some((pattern) => pattern.test(blob)) || /\b(logout|sign out|log out)\b/i.test(blob)) {
    return { allow: false, reason: "Destructive or irreversible action is blocked" };
  }
  if (PAYMENT_BLOB.test(blob)) {
    return { allow: false, reason: "Financial action is blocked" };
  }
  if (input.risk === "EXTERNAL") return { allow: false, reason: "External navigation is blocked" };
  if (input.risk === "UNKNOWN" || input.risk === "DESTRUCTIVE") {
    return { allow: false, reason: "Action safety is unclear or destructive" };
  }
  if (input.formAction) {
    try {
      const actionUrl = new URL(input.formAction, input.pageUrl);
      if (actionUrl.origin !== new URL(input.pageUrl).origin) {
        return { allow: false, reason: "Form destination leaves the authorized site" };
      }
    } catch {
      return { allow: false, reason: "Form destination could not be checked" };
    }
  }
  if ((input.fieldType === "password" || /password/.test(blob)) && LOGIN_BLOB.test(blob) && input.action.type === "click") {
    return { allow: false, reason: "Login submission is left to the supplied scan credentials" };
  }
  if (input.action.type === "upload-fixture" && input.fieldType !== "file") {
    return { allow: false, reason: "Fixture upload is only allowed on a file input" };
  }
  if (input.action.type === "click" && input.risk && !["SAFE", "LOW_RISK", "STATE_CHANGING"].includes(input.risk)) {
    return { allow: false, reason: "Click risk is not eligible for automatic submission" };
  }
  return { allow: true, reason: "Action matches the deterministic safety policy" };
}

export function buildDeterministicPlan(input: {
  pageUrl: string;
  fields: ObservedField[];
  submit: ObservedControl | null;
  formAction?: string | null;
  registry: RegistryEntry[];
  seed: number;
}): { plan: WorkflowPlan; registry: RegistryEntry[] } {
  let registry = input.registry;
  const actions: WorkflowAction[] = [];
  for (const field of fieldsToFill(input.fields)) {
    const planned = syntheticValue(field, input.seed, registry, input.pageUrl);
    if (planned.value === "skip") {
      if ((field.type || "").toLowerCase() === "file") {
        actions.push({
          type: "upload-fixture",
          selector: field.selector,
          fieldKey: fieldKeyFor(field, input.pageUrl),
          entityKey: entityKeyFor(field, input.pageUrl),
          expected: "File input accepts the bundled text fixture",
          reason: "Observed file input",
        });
      }
      continue;
    }
    if (planned.value === "check") {
      actions.push({
        type: "check",
        selector: field.selector,
        fieldKey: fieldKeyFor(field, input.pageUrl),
        entityKey: entityKeyFor(field, input.pageUrl),
        expected: "Choice control can be selected",
        reason: "Observed checkbox or radio",
      });
      continue;
    }
    if (!readRegistry(registry, planned.entry.entityKey, planned.entry.fieldKey)) {
      registry = rememberValue(registry, planned.entry);
    }
    const type = (field.type || "text").toLowerCase();
    actions.push({
      type: type === "select" ? "select" : "fill",
      selector: field.selector,
      fieldKey: planned.entry.fieldKey,
      entityKey: planned.entry.entityKey,
      value: planned.value,
      expected: `Field ${planned.entry.fieldKey} accepts dummy data that matches this field`,
      reason: field.required ? `Required field: ${field.label}` : "Visible field on this page",
    });
  }
  if (input.submit) {
    const decision = decideActionSafety({
      action: {
        type: "click",
        selector: input.submit.selector,
        expected: "Eligible form submits and stays on the authorized site",
        reason: "Observed submit control",
      },
      pageUrl: input.pageUrl,
      formAction: input.formAction,
      controlText: input.submit.text,
      risk: input.submit.risk,
      selectorObserved: true,
    });
    if (decision.allow) {
      actions.push({
        type: "click",
        selector: input.submit.selector,
        expected: "Eligible form submits and stays on the authorized site",
        reason: input.submit.text.slice(0, 120) || "Observed submit control",
      });
    }
  }
  return { plan: { actions: actions.slice(0, 40) }, registry };
}

export function resolveWorkflowPlan(input: {
  aiPlan: WorkflowPlan | null;
  pageUrl: string;
  fields: ObservedField[];
  submit: ObservedControl | null;
  formAction?: string | null;
  registry: RegistryEntry[];
  seed: number;
}): { plan: WorkflowPlan; registry: RegistryEntry[] } {
  const deterministic = buildDeterministicPlan(input);
  if (!input.aiPlan) return deterministic;
  let registry = input.registry;
  const actions: WorkflowAction[] = [];
  let usedAiFill = false;
  for (const action of input.aiPlan.actions) {
    if (action.type !== "fill" && action.type !== "select") {
      actions.push(action);
      continue;
    }
    const field = input.fields.find((item) => item.selector === action.selector);
    if (!field) continue;
    const planned = syntheticValue(field, input.seed, registry, input.pageUrl);
    if (planned.value === "skip" || planned.value === "check") continue;
    const known = readRegistry(registry, planned.entry.entityKey, planned.entry.fieldKey);
    const value = known?.value ?? (planned.entry.sensitive ? planned.value : action.value || planned.value);
    if (!known) registry = rememberValue(registry, { ...planned.entry, value, source: "generated" });
    actions.push({ ...action, value, entityKey: planned.entry.entityKey, fieldKey: planned.entry.fieldKey });
    usedAiFill = true;
  }
  if (!usedAiFill) {
    return { plan: { ...deterministic.plan, suggestedEdges: input.aiPlan.suggestedEdges }, registry: deterministic.registry };
  }
  const click = deterministic.plan.actions.find((action) => action.type === "click");
  if (click && !actions.some((action) => action.type === "click")) actions.push(click);
  return { plan: { actions: actions.slice(0, 40), suggestedEdges: input.aiPlan.suggestedEdges }, registry };
}

export function gatePlan(input: {
  plan: WorkflowPlan;
  pageUrl: string;
  formAction?: string | null;
  fields: ObservedField[];
  controls: ObservedControl[];
  completedFingerprints: string[];
}): Array<{ action: WorkflowAction; fingerprint: string; run: boolean; status: "skipped" | "blocked" | "planned"; reason: string }> {
  return input.plan.actions.map((action) => {
    const fingerprint = workflowFingerprint(input.pageUrl, action);
    if (input.completedFingerprints.includes(fingerprint) && (action.type === "click" || action.type === "upload-fixture")) {
      return { action, fingerprint, run: false, status: "skipped" as const, reason: "This submission already completed for this scan" };
    }
    const field = input.fields.find((item) => item.selector === action.selector);
    const control = input.controls.find((item) => item.selector === action.selector);
    const decision = decideActionSafety({
      action,
      pageUrl: input.pageUrl,
      formAction: input.formAction,
      controlText: control?.text ?? field?.label,
      fieldType: field?.type ?? control?.type,
      risk: control?.risk ?? (field ? "SAFE" : null),
      selectorObserved: Boolean(field || control),
    });
    if (!decision.allow) {
      return { action, fingerprint, run: false, status: "blocked" as const, reason: decision.reason };
    }
    return { action, fingerprint, run: true, status: "planned" as const, reason: decision.reason };
  });
}

export function extractRecordId(url: string, visibleText = ""): string | null {
  try {
    const parsed = new URL(url);
    const queryId = parsed.searchParams.get("id") || parsed.searchParams.get("recordId");
    if (queryId && /^[A-Za-z0-9_-]{1,80}$/.test(queryId)) return queryId;
    const pathMatch = parsed.pathname.match(/\/(?:customers|records|items|orders|users)\/([A-Za-z0-9_-]{1,80})\/?$/i);
    if (pathMatch) return pathMatch[1];
  } catch {
    /* ignore invalid urls */
  }
  const labeled = visibleText.match(/\b(?:id|record)\s*[:#]\s*([A-Za-z0-9_-]{2,80})/i);
  return labeled?.[1] ?? null;
}

export function mergeGraph(current: WorkflowGraphSnapshot, patch: WorkflowGraphSnapshot): WorkflowGraphSnapshot {
  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  for (const node of patch.nodes) nodes.set(node.id, { ...nodes.get(node.id), ...node });
  const edges = new Map(current.edges.map((edge) => [edge.id, edge]));
  for (const edge of patch.edges) {
    const previous = edges.get(edge.id);
    if (previous?.observed) edges.set(edge.id, { ...edge, observed: true });
    else edges.set(edge.id, edge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function graphFromPages(
  pages: Array<{ url: string; parentUrl?: string | null; status?: string | null }>,
): WorkflowGraphSnapshot {
  const nodes: WorkflowGraphNode[] = [];
  const edges: WorkflowGraphEdge[] = [];
  for (const page of pages) {
    const id = pageNodeId(page.url);
    nodes.push({
      id,
      kind: "page",
      label: pageLabel(page.url),
      url: page.url,
      status: page.status === "SCANNED" ? "visited" : page.status === "FAILED" ? "failed" : "discovered",
    });
    if (page.parentUrl) {
      edges.push({
        id: `nav:${pageNodeId(page.parentUrl)}:${id}`,
        from: pageNodeId(page.parentUrl),
        to: id,
        kind: "navigation",
        observed: true,
        label: "crawled link",
      });
    }
  }
  return { nodes, edges };
}

export function graphFromForm(input: {
  pageUrl: string;
  formIndex: number;
  action?: string | null;
  fields: ObservedField[];
  submit: ObservedControl | null;
}): WorkflowGraphSnapshot {
  const pageId = pageNodeId(input.pageUrl);
  const formId = `form:${pageId}:${input.formIndex}`;
  const nodes: WorkflowGraphNode[] = [
    { id: pageId, kind: "page", label: pageLabel(input.pageUrl), url: input.pageUrl, status: "visited" },
    { id: formId, kind: "form", label: input.action || `Form ${input.formIndex + 1}`, url: input.pageUrl, status: "discovered" },
  ];
  const edges: WorkflowGraphEdge[] = [
    { id: `contains:${pageId}:${formId}`, from: pageId, to: formId, kind: "contains", observed: true, label: "form" },
  ];
  input.fields.forEach((field, index) => {
    const fieldId = `field:${formId}:${index}`;
    nodes.push({ id: fieldId, kind: "field", label: field.label || field.name || field.type, url: input.pageUrl });
    edges.push({ id: `contains:${formId}:${fieldId}`, from: formId, to: fieldId, kind: "contains", observed: true });
  });
  if (input.submit) {
    const buttonId = `button:${formId}`;
    nodes.push({ id: buttonId, kind: "button", label: input.submit.text || "Submit", url: input.pageUrl });
    edges.push({ id: `contains:${formId}:${buttonId}`, from: formId, to: buttonId, kind: "contains", observed: true, label: "submit" });
  }
  return { nodes, edges };
}

export function suggestedEdges(plan: WorkflowPlan): WorkflowGraphEdge[] {
  return (plan.suggestedEdges ?? []).map((edge, index) => ({
    id: `suggested:${index}:${edge.from}:${edge.to}`,
    from: edge.from,
    to: edge.to,
    kind: "suggested" as const,
    observed: false,
    label: edge.label ?? "AI suggestion, not verified",
  }));
}

export function plannerContext(input: {
  pageUrl: string;
  fields: ObservedField[];
  controls: ObservedControl[];
  registry: RegistryEntry[];
}): unknown {
  return redactObject({
    pageUrl: input.pageUrl,
    fields: input.fields.map((field) => ({
      selector: field.selector,
      name: field.name,
      type: field.type,
      label: field.label,
      required: field.required,
    })),
    controls: input.controls.map((control) => ({
      selector: control.selector,
      text: control.text,
      type: control.type,
      risk: control.risk,
    })),
    knownEntities: publicRegistry(input.registry).map((entry) => ({
      entityKey: entry.entityKey,
      fieldKey: entry.fieldKey,
      value: entry.value,
    })),
  });
}

export function pageNodeId(url: string): string {
  return `page:${normalizePage(url)}`;
}

function pageLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.host : parsed.pathname;
  } catch {
    return url.slice(0, 80);
  }
}

function normalizePage(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
