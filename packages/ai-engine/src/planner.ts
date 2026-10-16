import type OpenAI from "openai";
import { redactObject, workflowPlanSchema, type WorkflowPlan } from "@qa-scanner/shared";

export const WORKFLOW_PLANNER_PROMPT = `You plan QA actions for one page of an authorized test website.
Return ONLY JSON: {"actions":[{"type":"fill"|"select"|"check"|"upload-fixture"|"click"|"wait"|"assert-text"|"assert-url","selector":string,"fieldKey":string,"entityKey":string,"value":string,"expected":string,"reason":string}],"suggestedEdges":[{"from":string,"to":string,"label":string}]}
Rules:
- Use only selectors present in the observed fields and controls.
- Reuse knownEntities values for the same entity. Do not invent a second customer.
- Use synthetic example.com data. Never use a real person's private information.
- Never plan payment, purchase, delete, logout, or any action whose safety is unclear.
- suggestedEdges are hypotheses only. They are not instructions to navigate.
- Do not return code, scripts, or shell commands.`;

export async function proposeWorkflowPlan(
  client: OpenAI | null,
  model: string,
  context: unknown,
): Promise<WorkflowPlan | null> {
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: WORKFLOW_PLANNER_PROMPT },
        { role: "user", content: JSON.stringify(redactObject(context)) },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = workflowPlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
