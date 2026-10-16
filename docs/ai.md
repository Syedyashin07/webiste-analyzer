# AI engine

Rule engines run first. OpenAI is used only for:

- Interpreting grouped JavaScript errors
- Ambiguous visual findings (overlap / large blank regions)
- Human-readable likely cause and recommended action

Requests send redacted structured JSON, not full site dumps. Responses must match a Zod schema (`aiFindingSchema`). Invalid JSON is discarded.

AI findings start as `UNVERIFIED`. Verification re-opens the page and re-runs deterministic checks. Only reproduced issues become `CONFIRMED`.

If `OPENAI_API_KEY` is empty, scans skip AI and still finish.
