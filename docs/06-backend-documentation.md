# 6. Backend documentation

## Entry points

| File | Responsibility |
| --- | --- |
| `apps/api/src/index.ts` | Connects Redis, builds Fastify, listens on `env.PORT` and `0.0.0.0` |
| `apps/api/src/worker.ts` | Consumes the scan queue and runs the pipeline |
| `apps/api/src/app.ts` | CORS, rate limit, error handler, route registration |
| `apps/api/src/config.ts` | `parseEnv` and `STORAGE_ROOT` |

## Middleware and cross-cutting behavior

- **CORS:** `origin` is `env.FRONTEND_URL`, `credentials: true` (`app.ts`).
- **Rate limit:** 120 requests per minute in Redis. `allowList` skips all `GET` requests. `POST /api/scans` is further limited to 10 per minute. `POST /api/settings/reset-data` is limited to 3 per minute.
- **JSON parser:** empty body becomes `{}`.
- **Errors:** `ZodError` returns HTTP 400 `{ error, details }`. Other errors use `statusCode` or 500. Logged with `createLogger("api")`.
- **Auth middleware:** none on data routes. Only `routes/auth.ts` inspects `Authorization`.

## Route modules

| Module | Registrar |
| --- | --- |
| `routes/auth.ts` | `registerAuthRoutes` |
| `routes/dashboard.ts` | `registerDashboardRoutes`, `registerSettingsRoutes` |
| `routes/sites.ts` | `registerSiteRoutes` |
| `routes/scans.ts` | `registerScanRoutes` |
| `routes/bugs.ts` | `registerBugRoutes` |
| `routes/reports.ts` | `registerReportRoutes`, `registerEvidenceRoutes` |

Handlers are functions in those files. There is no separate controller class layer.

## Services

| File | Responsibility |
| --- | --- |
| `services/local-context.ts` | Ensures `local@qa-scanner.local`, settings, and Default Project |
| `services/sites.ts` | Finds or creates a `Project` by display name |
| `services/bug-writer.ts` | Writes `Bug` rows from engine findings |
| `services/reset-data.ts` | Clears scan data for the reset-data route |
| `lib/failed-apis.ts` | Selects network failures that can be replayed |
| `lib/http-check.ts` | HTTP checks used by replay |
| `lib/events.ts` | Scan progress events |
| `lib/zip.ts` | Builds the screenshot zip |
| `workers/pipeline.ts` | Crawl, analyze, screenshot, score, report |

## Scan job

`ScanJobData` (`lib/queue.ts`) is `{ scanId, loginUsername?, loginPassword?, loginUrl? }`. Attempts: 2, exponential backoff 5 seconds. Completed and failed jobs are capped at 50.

The target-site password is on the job, not on the `Scan` model. It is not a column in `prisma/schema.prisma`.

## Transactions

Handlers use Prisma calls directly. A multi-statement database transaction wrapper was not found as a general pattern in the route files. `upsertFileBlob` is a single `INSERT ... ON CONFLICT` statement.

## Background work

The worker is a long-running process, not a cron entry in this repository. `AppSettings.retentionDays` is stored and editable. A search of `apps/api/src` found no read of that column, so no purge job in this tree uses it.
