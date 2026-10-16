import OpenAI from "openai";
import { aiFindingSchema, redactObject, type AiFinding } from "@qa-scanner/shared";
import { ANALYZE_FINDING_PROMPT, ANALYZE_VISUAL_PROMPT, GROUPING_PROMPT } from "./prompts.js";

export interface AiContext {
  url: string;
  pageTitle?: string;
  action?: string;
  expected?: string;
  actual?: string;
  consoleError?: string;
  networkError?: string;
  element?: string;
  viewport?: string;
  category?: string;
}

export interface AiClientOptions {
  apiKey: string;
  model: string;
}

const cache = new Map<string, AiFinding>();

function cacheKey(kind: string, context: unknown): string {
  return `${kind}:${JSON.stringify(context)}`;
}

export function createAiClient(options: AiClientOptions | null) {
  if (!options?.apiKey) return null;
  return new OpenAI({ apiKey: options.apiKey });
}

async function completeJson(
  client: OpenAI,
  model: string,
  system: string,
  user: unknown,
): Promise<AiFinding | null> {
  const key = cacheKey(system.slice(0, 24), user);
  const cached = cache.get(key);
  if (cached) return cached;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(redactObject(user)) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const validated = aiFindingSchema.safeParse(parsed);
  if (!validated.success) return null;
  cache.set(key, validated.data);
  return validated.data;
}

export async function interpretFinding(
  client: OpenAI,
  model: string,
  context: AiContext,
): Promise<AiFinding | null> {
  return completeJson(client, model, ANALYZE_FINDING_PROMPT, context);
}

export async function interpretVisual(
  client: OpenAI,
  model: string,
  context: AiContext & { geometry: unknown },
): Promise<AiFinding | null> {
  return completeJson(client, model, ANALYZE_VISUAL_PROMPT, context);
}

export async function groupFindings(
  client: OpenAI,
  model: string,
  titles: string[],
): Promise<{ title: string; reason: string; recommendedAction: string } | null> {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GROUPING_PROMPT },
      { role: "user", content: JSON.stringify({ titles }) },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { title?: string; reason?: string; recommendedAction?: string };
    if (!parsed.title) return null;
    return {
      title: parsed.title,
      reason: parsed.reason ?? "",
      recommendedAction: parsed.recommendedAction ?? "",
    };
  } catch {
    return null;
  }
}

export { ANALYZE_FINDING_PROMPT, ANALYZE_VISUAL_PROMPT, GROUPING_PROMPT };
export { proposeWorkflowPlan, WORKFLOW_PLANNER_PROMPT } from "./planner.js";
