import type Redis from "ioredis";
import type { BrowserContext, Page } from "playwright";
import { createAiClient, proposeWorkflowPlan } from "@qa-scanner/ai-engine";
import { classifyInteractionRisk, observeWorkflowPage, performWorkflowAction } from "@qa-scanner/functional-engine";
import {
  chooseAdvance,
  extractRecordId,
  fieldsToFill,
  graphFromForm,
  pageNodeId,
  plannerContext,
  publicRegistry,
  rememberValue,
  resolveWorkflowPlan,
  readRegistry,
  syntheticValue,
  gatePlan,
  suggestedEdges,
  workflowFingerprint,
} from "@qa-scanner/shared";
import { env } from "../config.js";
import { emitScanEvent } from "../lib/events.js";
import {
  completedFingerprints,
  loadRegistry,
  mergeSavedGraph,
  saveRegistry,
  saveWorkflowStep,
} from "../services/workflow-store.js";

export async function runWorkflowPage(
  scanId: string,
  pageUrl: string,
  page: Page,
  aiAnalysis: boolean,
  dataSeed: number | null,
  redis: Redis,
): Promise<void> {
  const seen = new Set<string>();
  for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) {
  let observed = await observeWorkflowPage(page);
  if (observed.opener && observed.fields.length < 2) {
    await emitScanEvent(redis, scanId, "scan.action", `Opening the form: ${observed.opener.text}`, { url: pageUrl });
    await performWorkflowAction(page, {
      type: "click",
      selector: observed.opener.selector,
      expected: "The form opens so its fields can be filled",
      reason: observed.opener.text || "Open the form",
    });
    await page.waitForTimeout(800);
    observed = await observeWorkflowPage(page);
  }
  const currentUrl = page.url();
  const signature = `${currentUrl}|${observed.fields.map((field) => `${field.label}:${field.required}`).join("|")}`;
  if (seen.has(signature)) break;
  seen.add(signature);
  const needed = fieldsToFill(observed.fields);
  const requiredLabels = needed.filter((field) => field.required).map((field) => field.label).filter(Boolean);
  if (requiredLabels.length > 0) {
    await emitScanEvent(redis, scanId, "scan.action", `Required on this page: ${requiredLabels.join(", ")}`, { url: currentUrl });
  }
  if (observed.fields.length === 0) break;
  const origin = new URL(currentUrl).origin;
  const controls = observed.controls.map((control) => ({
    ...control,
    risk: classifyInteractionRisk({
      text: control.text,
      type: control.type,
      href: control.href,
      pageOrigin: origin,
    }),
  }));
  const advanceKind = observed.fields.length > 0 ? chooseAdvance({ forward: observed.forward, submit: observed.submit }) : "stop";
  const advance = advanceKind === "forward" ? observed.forward : advanceKind === "finish" ? observed.submit : null;
  let registry = await loadRegistry(scanId);
  const seed = dataSeed ?? Number.parseInt(scanId.replace(/\D/g, "").slice(0, 6) || "1", 10);
  const client = aiAnalysis ? createAiClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }) : null;
  const aiPlan = await proposeWorkflowPlan(
    client,
    env.OPENAI_MODEL,
    plannerContext({ pageUrl: currentUrl, fields: needed, controls, registry: publicRegistry(registry) }),
  );
  const resolved = resolveWorkflowPlan({
    aiPlan,
    pageUrl: currentUrl,
    fields: needed,
    submit: advance
      ? controls.find((control) => control.selector === advance.selector) ?? advance
      : null,
    formAction: observed.formAction,
    registry,
    seed,
  });
  registry = resolved.registry;
  await saveRegistry(scanId, registry);
  const graphPatch = graphFromForm({
    pageUrl: currentUrl,
    formIndex: 0,
    action: observed.formAction,
    fields: needed,
    submit: advance,
  });
  graphPatch.edges.push(...suggestedEdges(resolved.plan));
  const pageId = pageNodeId(currentUrl);
  const pageNode = graphPatch.nodes.find((node) => node.id === pageId);
  if (pageNode) pageNode.status = "visited";
  await mergeSavedGraph(scanId, graphPatch);

  const gated = gatePlan({
    plan: resolved.plan,
    pageUrl: currentUrl,
    formAction: observed.formAction,
    fields: observed.fields,
    controls,
    completedFingerprints: await completedFingerprints(scanId),
  });

  for (const step of gated) {
    const redactedInput = step.action.type === "fill" || step.action.type === "select"
      ? publicRegistry(registry).find((entry) => entry.fieldKey === step.action.fieldKey)?.value
      : undefined;
    if (!step.run) {
      await saveWorkflowStep({
        scanId,
        fingerprint: step.fingerprint,
        pageUrl: currentUrl,
        actionType: step.action.type,
        selector: step.action.selector,
        status: step.status,
        reason: step.reason,
        expected: step.action.expected,
        redactedInput,
      });
      await emitScanEvent(redis, scanId, "scan.action", `${step.status}: ${step.reason}`, {
        url: pageUrl,
        action: step.action.type,
        status: step.status,
      });
      continue;
    }
    const typing = step.action.type === "fill" || step.action.type === "select" || step.action.type === "check";
    await emitScanEvent(
      redis,
      scanId,
      "scan.action",
      typing ? `Typing ${step.action.fieldKey ?? step.action.type} on ${currentUrl}` : `Running ${step.action.type} on ${currentUrl}`,
      { url: currentUrl, action: step.action.type },
    );
    const result = await performWorkflowAction(page, step.action);
    let observedText = result.observed;
    if (result.ok && step.action.type === "click") {
      const recordId = extractRecordId(page.url(), result.observed);
      if (recordId) {
        const entityKey = gated.find((item) => item.action.entityKey)?.action.entityKey ?? "customer";
        registry = rememberValue(registry, {
          entityKey,
          fieldKey: "recordId",
          value: recordId,
          sensitive: false,
          source: "observed",
        });
        await saveRegistry(scanId, registry);
        observedText = `${result.observed} record ${recordId}`;
        await mergeSavedGraph(scanId, {
          nodes: [{ id: pageNodeId(page.url()), kind: "page", label: page.url(), url: page.url(), status: "completed" }],
          edges: [{
            id: `workflow:${pageId}:${pageNodeId(page.url())}`,
            from: pageId,
            to: pageNodeId(page.url()),
            kind: "workflow",
            observed: true,
            label: `record ${recordId}`,
          }],
        });
      }
    }
    await saveWorkflowStep({
      scanId,
      fingerprint: step.fingerprint || workflowFingerprint(currentUrl, step.action),
      pageUrl: currentUrl,
      actionType: step.action.type,
      selector: step.action.selector,
      status: result.ok ? "completed" : "failed",
      reason: step.reason,
      expected: step.action.expected,
      observed: observedText.slice(0, 500),
      redactedInput,
    });
    await emitScanEvent(redis, scanId, "scan.action", result.ok ? `Completed ${step.action.type}` : `Failed ${step.action.type}`, {
      url: page.url(),
      action: step.action.type,
      status: result.ok ? "completed" : "failed",
    });
  }
  if (advanceKind !== "forward") break;
  await page.waitForTimeout(700);
  }
}

export async function catalogWorkflowFields(
  scanId: string,
  pageUrls: string[],
  context: BrowserContext,
  dataSeed: number | null,
  redis: Redis,
  timeoutMs: number,
): Promise<void> {
  let registry = await loadRegistry(scanId);
  const seed = dataSeed ?? Number.parseInt(scanId.replace(/\D/g, "").slice(0, 6) || "1", 10);
  const page = await context.newPage();
  await page.bringToFront().catch(() => undefined);
  try {
    for (const url of pageUrls) {
      await emitScanEvent(redis, scanId, "scan.action", `Reading fields on ${url}`, { url });
      const opened = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).then(() => true).catch(() => false);
      if (!opened) continue;
      let observed = await observeWorkflowPage(page);
      if (observed.opener && observed.fields.length < 2) {
        await performWorkflowAction(page, {
          type: "click",
          selector: observed.opener.selector,
          expected: "The form opens so its fields can be recorded",
          reason: observed.opener.text || "Open the form",
        });
        await page.waitForTimeout(800);
        observed = await observeWorkflowPage(page);
      }
      const labels = observed.fields.map((field) => field.label).filter(Boolean);
      await emitScanEvent(
        redis,
        scanId,
        "scan.action",
        labels.length ? `Remembered fields on ${page.url()}: ${labels.join(", ")}` : `No data fields on ${page.url()}`,
        { url: page.url() },
      );
      const recorded: typeof observed.fields = [];
      for (const field of fieldsToFill(observed.fields)) {
        const planned = syntheticValue(field, seed, registry, page.url());
        if (planned.value === "skip" || planned.value === "check") continue;
        if (!readRegistry(registry, planned.entry.entityKey, planned.entry.fieldKey)) {
          registry = rememberValue(registry, planned.entry);
        }
        recorded.push({ ...field, label: `${field.label || planned.entry.fieldKey}: ${planned.value}` });
      }
      if (recorded.length > 0) {
        await mergeSavedGraph(scanId, graphFromForm({
          pageUrl: page.url(),
          formIndex: 0,
          action: observed.formAction,
          fields: recorded,
          submit: observed.forward ?? observed.submit,
        }));
      }
    }
  } finally {
    await saveRegistry(scanId, registry);
    await page.close().catch(() => undefined);
  }
}
