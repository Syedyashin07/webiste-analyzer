import { describe, expect, it } from "vitest";
import { createScanSchema } from "./schemas.js";
import {
  buildDeterministicPlan,
  chooseAdvance,
  decideActionSafety,
  extractRecordId,
  fieldsToFill,
  gatePlan,
  graphFromPages,
  mergeGraph,
  publicRegistry,
  rememberValue,
  resolveWorkflowPlan,
  suggestedEdges,
  syntheticValue,
  workflowFingerprint,
  workflowPlanSchema,
  type ObservedField,
  type RegistryEntry,
} from "./workflow.js";

const emailField: ObservedField = {
  selector: "#email",
  name: "email",
  type: "email",
  label: "Email",
  required: true,
};

describe("workflow safety", () => {
  it("blocks financial, destructive, external, and unverified actions", () => {
    expect(
      decideActionSafety({
        action: { type: "click", selector: "#pay", expected: "Pays", reason: "button" },
        pageUrl: "https://example.com/cart",
        controlText: "Checkout",
        risk: "STATE_CHANGING",
        selectorObserved: true,
      }).allow,
    ).toBe(false);
    expect(
      decideActionSafety({
        action: { type: "click", selector: "#delete", expected: "Deletes", reason: "button" },
        pageUrl: "https://example.com/account",
        controlText: "Delete account",
        risk: "DESTRUCTIVE",
        selectorObserved: true,
      }).allow,
    ).toBe(false);
    expect(
      decideActionSafety({
        action: { type: "click", selector: "#go", expected: "Leaves", reason: "link" },
        pageUrl: "https://example.com/",
        risk: "EXTERNAL",
        selectorObserved: true,
      }).allow,
    ).toBe(false);
    expect(
      decideActionSafety({
        action: { type: "click", selector: "#mystery", expected: "Unknown", reason: "guess" },
        pageUrl: "https://example.com/",
        selectorObserved: false,
      }).allow,
    ).toBe(false);
  });

  it("allows an observed create button on the same site", () => {
    const decision = decideActionSafety({
      action: { type: "click", selector: "#save", expected: "Creates a customer", reason: "submit" },
      pageUrl: "https://example.com/customers/new",
      formAction: "/customers",
      controlText: "Create customer",
      risk: "STATE_CHANGING",
      selectorObserved: true,
    });
    expect(decision.allow).toBe(true);
  });

  it("rejects plans that include executable code fields", () => {
    const parsed = workflowPlanSchema.safeParse({
      actions: [{ type: "click", selector: "#save", expected: "Saved", reason: "submit", code: "alert(1)" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("workflow registry", () => {
  it("reuses the same customer email across pages and redacts passwords", () => {
    const first = syntheticValue(emailField, 7, []);
    expect(first.value).toBe("riley.customer.7@example.com");
    const registry = rememberValue([], first.entry);
    const again = syntheticValue({ ...emailField, selector: "#email-2" }, 99, registry);
    expect(again.value).toBe("riley.customer.7@example.com");

    const phone = syntheticValue(
      { selector: "#phone", name: "phone", type: "tel", label: "Phone", required: true },
      7,
      registry,
    );
    const withPhone = rememberValue(registry, phone.entry);
    const password = syntheticValue(
      { selector: "#password", name: "password", type: "password", label: "Password", required: true },
      7,
      withPhone,
    );
    const stored = rememberValue(withPhone, password.entry);
    const otherScan = syntheticValue(emailField, 7, []);
    expect(otherScan.value).toBe("riley.customer.7@example.com");
    expect(publicRegistry(stored).find((entry) => entry.fieldKey === "password")?.value).toBe("[REDACTED]");
    expect(stored.find((entry) => entry.fieldKey === "password")?.value).not.toBe("[REDACTED]");
  });

  it("keeps the stored customer when a later AI plan proposes a new email", () => {
    const stored = rememberValue([], syntheticValue(emailField, 7, []).entry);
    const resolved = resolveWorkflowPlan({
      aiPlan: {
        actions: [
          {
            type: "fill",
            selector: "#email",
            value: "someone.else@example.com",
            expected: "Email is filled",
            reason: "AI fill",
          },
        ],
      },
      pageUrl: "https://example.com/customers/new",
      fields: [emailField],
      submit: null,
      registry: stored,
      seed: 4,
    });
    expect(resolved.plan.actions[0]?.value).toBe("riley.customer.7@example.com");
  });

  it("keeps independent registries isolated", () => {
    const left = rememberValue([], syntheticValue(emailField, 1, []).entry);
    const right = rememberValue([], syntheticValue(emailField, 2, []).entry);
    expect(left[0]?.value).not.toBe(right[0]?.value);
  });

  it("does not repeat a completed submission", () => {
    const action = { type: "click" as const, selector: "#save", expected: "Saved", reason: "submit" };
    const fingerprint = workflowFingerprint("https://example.com/new", action);
    const gated = gatePlan({
      plan: { actions: [action] },
      pageUrl: "https://example.com/new",
      fields: [],
      controls: [{ selector: "#save", text: "Create customer", type: "submit", href: null, risk: "STATE_CHANGING" }],
      completedFingerprints: [fingerprint],
    });
    expect(gated[0]?.status).toBe("skipped");
    expect(gated[0]?.run).toBe(false);
  });
});

describe("workflow graph", () => {
  it("marks crawled links as observed and AI edges as unverified", () => {
    const graph = graphFromPages([
      { url: "https://example.com/", status: "SCANNED" },
      { url: "https://example.com/customers/new", parentUrl: "https://example.com/", status: "DISCOVERED" },
    ]);
    expect(graph.edges.every((edge) => edge.observed)).toBe(true);
    const plan = buildDeterministicPlan({
      pageUrl: "https://example.com/customers/new",
      fields: [emailField],
      submit: { selector: "#save", text: "Create customer", type: "submit", href: null, risk: "STATE_CHANGING" },
      formAction: "/customers",
      registry: [] as RegistryEntry[],
      seed: 3,
    });
    const suggested = suggestedEdges({
      actions: plan.plan.actions,
      suggestedEdges: [{ from: "page:a", to: "page:b", label: "maybe next" }],
    });
    const merged = mergeGraph(graph, { nodes: [], edges: suggested });
    expect(merged.edges.some((edge) => edge.observed === false && edge.kind === "suggested")).toBe(true);
    expect(plan.registry.find((entry) => entry.fieldKey === "email")?.value).toContain("@example.com");
  });

  it("fills required fields with matching dummy data and follows next until the last page", () => {
    const notes = { selector: "#notes", name: "notes", type: "text", label: "Notes", required: false };
    const phone = { selector: "#phone", name: "phone", type: "tel", label: "Phone", required: true };
    const plan = buildDeterministicPlan({
      pageUrl: "https://example.com/customers/new",
      fields: [{ ...emailField, required: true }, notes],
      submit: null,
      registry: [] as RegistryEntry[],
      seed: 7,
    });
    expect(plan.plan.actions.map((action) => action.fieldKey)).toEqual(["email"]);
    expect(plan.plan.actions[0]?.reason).toContain("Required field");
    expect(plan.plan.actions[0]?.value).toBe("riley.customer.7@example.com");
    const forward = { selector: "#next", text: "Next", type: "button", href: null, risk: "LOW_RISK" as const };
    const save = { selector: "#save", text: "Save", type: "submit", href: null, risk: "STATE_CHANGING" as const };
    const dashboard = { selector: "#nav", text: "Dashboard", type: "button", href: "/dashboard", risk: "SAFE" as const };
    expect(chooseAdvance({ forward, submit: save })).toBe("forward");
    expect(chooseAdvance({ forward: null, submit: save })).toBe("finish");
    expect(chooseAdvance({ forward: dashboard, submit: null })).toBe("stop");
    expect(fieldsToFill([phone, notes]).map((field) => field.label)).toEqual(["Phone"]);
  });

  it("keeps a product name separate from the customer name", () => {
    const product = syntheticValue(
      { selector: "#product", name: "name", type: "text", label: "Product name", required: true },
      7,
      [],
      "https://stitchdesk.in/products",
    );
    const customer = syntheticValue(
      { selector: "#customer", name: "name", type: "text", label: "Customer name", required: true },
      7,
      [product.entry],
      "https://stitchdesk.in/customers",
    );
    expect(product.entry.entityKey).toBe("product");
    expect(product.entry.fieldKey).toBe("productName");
    expect(product.value).toBe("Cotton Shirt 7");
    expect(customer.entry.entityKey).toBe("customer");
    expect(customer.value).toBe("Riley Customer");
    expect(customer.value).not.toBe(product.value);
  });

  it("captures a record id from the result url", () => {
    expect(extractRecordId("https://example.com/customers/cus_123")).toBe("cus_123");
    expect(extractRecordId("https://example.com/customers?id=88")).toBe("88");
  });

  it("requires an authorized test confirmation for workflow scans", () => {
    const missing = createScanSchema.safeParse({
      url: "https://example.com",
      coverage: "WORKFLOW",
      name: "Example",
    });
    expect(missing.success).toBe(false);
    const confirmed = createScanSchema.safeParse({
      url: "https://example.com",
      coverage: "WORKFLOW",
      name: "Example",
      authorizedTest: true,
      dataSeed: 4,
    });
    expect(confirmed.success).toBe(true);
  });
});
