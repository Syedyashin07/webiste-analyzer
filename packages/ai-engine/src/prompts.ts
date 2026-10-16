export const ANALYZE_FINDING_PROMPT = `You are a QA analyst. You receive structured evidence from a website scanner.
Return ONLY valid JSON matching this schema:
{
  "isLikelyBug": boolean,
  "confidence": number,
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "title": string,
  "expected": string,
  "actual": string,
  "reason": string,
  "recommendedAction": string,
  "rootCause": string
}
Rules:
- Do not invent evidence that was not provided.
- If uncertain, set isLikelyBug to false and confidence below 0.6.
- Never provide exploit or attack instructions.
- Prefer "Likely cause" language when the root cause is not proven.
- Keep title under 80 characters.`;

export const ANALYZE_VISUAL_PROMPT = `You are a visual QA reviewer. You receive a screenshot description and geometry findings.
Return ONLY valid JSON with the same schema as the finding analyzer.
Only confirm a visual defect when the geometry or screenshot context is convincing.
Do not claim ranking, SEO value, or security exploits.`;

export const GROUPING_PROMPT = `You group related QA findings. Return JSON:
{ "title": string, "reason": string, "recommendedAction": string }
Keep the grouped title specific and factual.`;
