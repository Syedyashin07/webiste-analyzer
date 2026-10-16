# Website QA Health Scanner

Local Windows application that crawls a website you are authorized to test, runs Playwright-based checks, stores evidence, scores website health, and exports HTML, PDF, Excel, and JSON reports.

This is not a mock. Scan results come from the crawler, Playwright, and rule engines. AI is optional and never confirms a bug by itself.

## Requirements

Install these on Windows before running the app:

- Node.js 20+ (the project was developed on Node 24)
- PostgreSQL 15+ listening on `localhost:5432`
- Redis 7+ listening on `localhost:6379`
- Git
- Cursor (or any editor)

Do **not** use Docker for this project.

## Quick start (Windows PowerShell)

```powershell
cd $HOME\Desktop\website-qa-health-scanner
copy .env.example .env
npm install
npx prisma generate
npx playwright install chromium
```

Create the database in PostgreSQL (pgAdmin or `psql`):

```sql
CREATE DATABASE qa_scanner;
```

If your Postgres user is not `postgres` / `postgres`, edit `DATABASE_URL` in `.env`.

Apply schema and seed the local user:

```powershell
npx prisma migrate dev --name init
npm run prisma:seed
```

Start Redis (example if Redis is installed as a Windows service or via Memurai/WSL-free native build):

```powershell
redis-server
```

In a **new** terminal, start the app:

```powershell
npm run dev
```

This starts:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Worker: BullMQ scan pipeline

Open the dashboard, enter `https://example.com`, and click **Start Scan**.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Web + API + worker |
| `npm run dev:web` | Vite frontend only |
| `npm run dev:api` | Fastify API only |
| `npm run worker` | Scan worker only |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run prisma:seed` | Local user + default project |
| `npm run test` | Unit/integration tests (Vitest) |
| `npm run test:e2e` | Playwright UI smoke test |
| `npm run fixtures` | Local buggy website on port 4545 |
| `npm run playwright:install` | Install Chromium |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |

## Local fixture site

Automated tests include a website with broken links, missing images, console errors, overflow, and weak forms.

```powershell
# In .env, only for local fixture scans:
ALLOW_LOCAL_TARGETS=true

npm run fixtures
```

Then scan `http://127.0.0.1:4545`. Keep `ALLOW_LOCAL_TARGETS=false` when scanning public sites.

## Important limitations

- Public websites only. There is no credential capture or authenticated-target login flow.
- Only scan sites you are allowed to test.
- Passive security checks only. No penetration testing, no exploit attempts, no CAPTCHA/WAF bypass.
- AI analysis requires `OPENAI_API_KEY`. Scans still complete without it.
- Health scores are deterministic QA scores, not Google PageSpeed scores.

## Architecture

See `docs/architecture.md`.
