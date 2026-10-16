# 14. Setup and installation

Commands are for this repository on Windows or any OS with Node.js 20+. PostgreSQL and Redis must be installed separately. Versions used in local development of this project were PostgreSQL 16 and Redis 8.x. Those exact versions are not pinned in `package.json`.

These steps were not re-executed as part of writing this document.

## Prerequisites

- Node.js 20 or newer (`package.json` `engines`).
- npm (workspaces).
- PostgreSQL with a database the app can migrate.
- Redis listening on the URL in `.env`.
- Chromium for Playwright (`npx playwright install chromium`).

## Install

```bash
cd website-qa-health-scanner
npm install
```

`postinstall` runs `prisma generate`.

Copy the example environment file and edit placeholders. Do not commit the result.

```bash
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

Set `DATABASE_URL` and `REDIS_URL` to your local services. Leave `OPENAI_API_KEY` empty unless you want AI comments.

## Database

```bash
npm run prisma:migrate
npm run prisma:seed
```

`prisma:migrate` is `prisma migrate dev`. For an existing database in automation, the repo also has `npm run prisma:deploy` (`prisma migrate deploy`).

Seed creates the local scanner user used by `getLocalContext()`.

## Run

```bash
npm run dev
```

| Process | URL |
| --- | --- |
| Web | http://localhost:5173/ |
| API | http://localhost:3000/api/health |
| Worker | no HTTP port; it consumes Redis |

`GET /api/health` should return `database: "up"` and `redis: "up"`.

## Other commands

| Command | Purpose |
| --- | --- |
| `npm test` | `vitest run` |
| `npm run test:e2e` | Playwright tests in the web workspace |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Web and API production build |
| `npm run prisma:studio` | Prisma Studio |

## Common setup failures

| Symptom | What to check |
| --- | --- |
| API exits immediately | `DATABASE_URL` or Redis. `parseEnv` throws if `DATABASE_URL` or `REDIS_URL` is missing |
| Health `503` | Postgres not started, wrong database name, or Redis down |
| Scans fail before a page loads | Playwright browsers missing, or `PLAYWRIGHT_BROWSERS_PATH` pointing at a sandbox directory. `packages/browser/src/playwright-env.ts` prefers `%LOCALAPPDATA%\ms-playwright` on Windows |
| Blank UI after a proxy error | API not listening on port 3000 |
| Port in use | Vite uses `strictPort: true` on 5173 |
