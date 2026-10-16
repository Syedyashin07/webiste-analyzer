# 3. Project folder structure

Repository root: `website-qa-health-scanner`.

| Path | Purpose |
| --- | --- |
| `package.json` | Workspace root. Scripts for dev, test, Prisma, and Playwright install. |
| `apps/web` | React UI (`@qa-scanner/web`). |
| `apps/api` | Fastify API and BullMQ worker (`@qa-scanner/api`). |
| `packages/*` | Scan engines shared by the worker. |
| `prisma/schema.prisma` | PostgreSQL models. |
| `prisma/migrations` | SQL migrations, including `FileBlob` and user login. |
| `prisma/seed.ts` | Seeds the local user. |
| `docs/` | This documentation plus older topic notes. |
| `tests/fixtures/server.ts` | Fixture HTTP server. Port `FIXTURE_PORT` or 4545. |
| `storage/` | Optional on-disk fallback. Default `STORAGE_DIR` is `./storage`. Bytes are copied into PostgreSQL and the temp file is removed. |
| `.env.example` | Placeholder environment variables. Do not commit real secrets. |

## `apps/web/src`

| Path | Purpose |
| --- | --- |
| `main.tsx`, `App.tsx` | Boot and routes |
| `pages/` | Landing, auth, dashboard, sites, scans, bugs, reports, settings, compare |
| `components/layout/AppLayout.tsx` | Sidebar shell and login gate |
| `components/brand/Logo.tsx` | Logo used in the header and sidebar |
| `components/scans/` | Scan form and screenshot flow |
| `api/client.ts` | `fetch` wrapper and API types |
| `lib/auth.ts` | `localStorage` session |
| `lib/page-flow.ts` | Browser copy of page names such as Login and Dashboard |
| `i18n/en.ts` | English UI strings |
| `public/favicon.svg` | Tab icon |

## `apps/api/src`

| Path | Purpose |
| --- | --- |
| `index.ts` | Listens on `PORT` |
| `worker.ts` | Queue consumer |
| `app.ts` | Fastify app, CORS, rate limit, route registration |
| `config.ts` | Loads `.env` and `STORAGE_ROOT` |
| `routes/` | HTTP handlers |
| `workers/pipeline.ts` | Scan execution |
| `services/local-context.ts` | Local user and default project |
| `services/sites.ts` | Site folder by name |
| `services/bug-writer.ts` | Persists bugs |
| `lib/storage.ts` | File bytes in PostgreSQL, with disk fallback |
| `lib/password.ts` | scrypt passwords and session tokens |
| `lib/queue.ts` | BullMQ scan queue |
| `lib/redis.ts` | Redis client |
| `lib/zip.ts` | Screenshot zip |

## Important files that are not application logic

`node_modules/` is installed dependencies. Do not document it as product code.
