# 18. Troubleshooting guide

| Problem | Likely cause | What to check |
| --- | --- | --- |
| `Invalid environment configuration` on API start | Missing `DATABASE_URL` or `REDIS_URL` | `.env` at the repo root. `config.ts` loads that path |
| `/api/health` is 503 | Postgres or Redis down | Connection strings, service process, firewall |
| UI loads, API calls fail | API not on 3000, or CORS | Vite proxy target. `FRONTEND_URL` must match the browser origin |
| Login works but scans never finish | Worker not running | `npm run dev` starts the worker. A lone API process only queues jobs |
| Chromium fails to launch | Browser path or missing install | `npx playwright install chromium`. On Windows, `packages/browser/src/playwright-env.ts` |
| Screenshot or report download is 404 | Blob missing | `FileBlob` for that `storageKey`. Disk fallback only works if the file is still under `STORAGE_ROOT` |
| Register returns 409 | Email already used | `User.email` is unique |
| Register returns 400 | Name, email, or password shorter than 8 | `routes/auth.ts` |
| After register, dashboard does not open | Intended | The UI sends new accounts to `/login` |
| Dashboard redirects to login | No `qa-auth-user` in `localStorage` | Log in again |
| Scan of a local URL is rejected | `ALLOW_LOCAL_TARGETS` is false | Expected for real scans |
| Rate limit on creating scans | More than 10 `POST /api/scans` per minute | Wait. GET polling is excluded from the global limiter |
| OpenAI features are empty | No API key | Scans still complete. `.env.example` says AI is optional |
| Port 5173 already in use | `strictPort: true` | Stop the other Vite process |

Logs: API and worker stdout via pino. There is no log directory configured in `config.ts`.
