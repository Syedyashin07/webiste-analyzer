# 16. Testing and error handling

## How to run tests

| Command | What it runs |
| --- | --- |
| `npm test` | `vitest run` from the repo root |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | `playwright test` in `@qa-scanner/web` |

These commands were **not** executed while writing this documentation. Do not treat this file as a test report.

## Test locations

Unit tests live next to packages, including:

- `packages/shared/src/*.test.ts` — URL, scoring, coverage, page flow, SSRF, validation, fingerprints
- `packages/crawler/src/crawler.test.ts`
- `packages/parser/src/parser.test.ts`
- `packages/seo-engine`, `security-engine`, `functional-engine`, `report-engine`, `visual-engine`, `browser`
- `apps/api/src/lib/*.test.ts` — storage, zip, failed APIs, HTTP check, scan errors

Web e2e configuration is the `test:e2e` script. Spec file names were not enumerated in this pass.

## Error handling

| Layer | Behavior |
| --- | --- |
| API | `app.setErrorHandler` maps Zod to 400 and other errors to `statusCode` or 500. Message is logged |
| Scan worker | Failed scans set `Scan.status` to `FAILED` and `errorMessage`. Job retries twice |
| Web | `client.ts` throws on non-OK responses. Pages render `error.message` |
| Health | `GET /api/health` returns 503 when Postgres or Redis fails |
| Missing files | Evidence and report download return 404 `File missing` or `Report file missing` |

There is no central error-tracking SaaS in the API dependencies.

## Logging

`createLogger` in `packages/shared/src/logger.ts` uses pino. Level is `LOG_LEVEL` or `info`. The API logger name is `api`. Fastify’s built-in logger is disabled (`logger: false` in `buildApp`).
