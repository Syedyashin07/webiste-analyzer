# 20. Complete technical reference

## Confirmed from source

- The repo is an npm workspace. Node 20+. React 19 and Vite 6 on port 5173. Fastify 5 on port 3000. A separate worker runs scans.
- PostgreSQL is the only application database. Redis is required for BullMQ and rate limits.
- Product UI name is Website Analyzer. Package description still says Website QA Health Scanner.
- Three coverages: landing, full website, screenshot every page.
- Account passwords use scrypt. Sessions last 14 days. The web app stores the token in `localStorage`.
- Register in the web app does not open the dashboard. Login does.
- `AppLayout` blocks app routes without a stored user. API data routes do not check that token.
- Scan records belong to `local@qa-scanner.local` via `getLocalContext()`.
- Screenshots, videos, traces, and reports are stored as `FileBlob.bytes`. Playwright writes a temp file under `STORAGE_ROOT`. `ingestStoredFile` copies it into PostgreSQL and deletes the file. `saveBuffer` has no caller in `apps/api/src`.
- Evidence is served by `GET /api/evidence/:id` with a private one-hour cache header. The UI uses `<img src="/api/evidence/{screenshotId}">`.
- Zip names such as `login.png` are download names for screenshot coverage. Stored keys look like `screenshots/{scanId}/{pageId}-DESKTOP-full.png`.
- `DELETE /api/scans/:id` deletes blobs and disk directories and leaves screenshot, video, and trace rows.
- `maxScreenshotBytes` and `retentionDays` are settings columns. Neither is read in `apps/api/src`.
- `crawlSite` receives `respectRobots: config.respectRobotsTxt` from `pipeline.ts`.
- OpenAI is optional. No email provider and no object-storage SDK are dependencies of the API.
- Target-site login secrets ride on the queue job, not on the `Scan` table.
- The web client calls relative `/api/...` paths (`apps/web/src/api/client.ts`). There is no `VITE_API_URL`. Vite proxies `/api` only in development (`apps/web/vite.config.ts`).

## Inferred

- Firefox and WebKit can be launched by `launchBrowser` when `browserEngine` is not chromium. On failure the function falls back to Chromium if that binary exists. Whether a normal scan sets a non-chromium engine was not checked against a live settings row.

## Needs team confirmation

- Who is allowed to call the API on a shared network, given the missing server auth.
- Whether `retentionDays` should delete old scans.
- Whether registered users must own their own projects.
- Hosting target, backups, and TLS termination. Those are not in the repo.
- Whether Firefox or WebKit is used in practice. The default settings string is `chromium`. `launchBrowser` can launch the other two and falls back to Chromium.

## Tests

Test files exist and are listed in [Testing](16-testing-and-error-handling.md). They were not run for this documentation pass.

## Source index

| Area | Path |
| --- | --- |
| Routes | `apps/web/src/App.tsx` |
| UI gate | `apps/web/src/components/layout/AppLayout.tsx` |
| HTTP client | `apps/web/src/api/client.ts` |
| API composition | `apps/api/src/app.ts` |
| Scan HTTP | `apps/api/src/routes/scans.ts` |
| Auth HTTP | `apps/api/src/routes/auth.ts` |
| Pipeline | `apps/api/src/workers/pipeline.ts` |
| Files | `apps/api/src/lib/storage.ts` |
| Schema | `prisma/schema.prisma` |
| Env contract | `packages/shared/src/env.ts` |
| Request contract | `packages/shared/src/schemas.ts` |

## Second-pass audit

Checked against `storage.ts`, `pipeline.ts` (`captureFullPageScreenshot`, `attachAnnotated`, `runFunctional`), `routes/scans.ts`, `routes/reports.ts`, `services/reset-data.ts`, `prisma/schema.prisma`, and the web `<img src="/api/evidence/...">` call sites. Tests were not executed. EXIF contents of Playwright PNGs remain **Not verified**. Temporary video directories under `videos/{scanId}/tmp-*` are removed by `removeScanFiles` on scan delete. Whether every temp file is removed when a functional check succeeds was not traced past `videoContext.close()`.

## Related older notes

`docs/architecture.md`, `docs/setup.md`, `docs/security.md`, `docs/playwright.md`, `docs/scoring.md`, `docs/reports.md`, `docs/crawler.md`, `docs/ai.md`, and `docs/troubleshooting.md` predate this numbered set. If they disagree with the code, trust the code and this numbered set’s file citations.
