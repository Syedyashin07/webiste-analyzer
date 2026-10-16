# 15. Environment variables

Defined in `packages/shared/src/env.ts` and illustrated in `.env.example`. The API loads the repo-root `.env` in `apps/api/src/config.ts`. Values below are placeholders from the example file or schema defaults, not live secrets.

| Variable | Required | Default if omitted | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | none | Prisma | PostgreSQL connection string |
| `REDIS_URL` | Yes | none | API, worker, rate limit | Redis connection |
| `OPENAI_API_KEY` | No | empty | `packages/ai-engine` | Optional AI analysis |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | AI engine | Model name |
| `PORT` | No | `3000` | `apps/api/src/index.ts` | API listen port |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS and `GET /` redirect | Allowed browser origin |
| `LOG_LEVEL` | No | `info` | `packages/shared/src/logger.ts` | pino level |
| `SCAN_MAX_PAGES` | No | `100` | Env parsed for scan defaults | Page cap |
| `SCAN_MAX_DEPTH` | No | `5` | Env parsed for scan defaults | Crawl depth |
| `SCAN_TIMEOUT_MS` | No | `30000` | Scan configuration defaults | Navigation timeout |
| `SCAN_CONCURRENCY` | No | `3` | Worker defaults | Parallel page work |
| `SCAN_CRAWL_DELAY_MS` | No | `250` | Crawl delay | Delay between requests |
| `SCAN_MAX_DURATION_MS` | No | `1800000` | Scan limit | 30 minutes |
| `SCREENSHOT_ENABLED` | No | `true` | Defaults | `true` or `1` enables |
| `VIDEO_ENABLED` | No | `true` | Defaults | `true` or `1` enables |
| `ALLOW_LOCAL_TARGETS` | No | `false` | Target URL checks | Must stay false for normal scans. Tests may set true |
| `STORAGE_DIR` | No | empty, then `./storage` | `apps/api/src/config.ts` | Disk root before bytes move into `FileBlob` |

Also read by code, but not part of `envSchema`:

| Variable | Purpose |
| --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Browser install directory. On Windows the helper rewrites a sandbox path to `%LOCALAPPDATA%\ms-playwright` |
| `LOCALAPPDATA` | Used only to find that Windows Playwright directory |
| `FIXTURE_PORT` | `tests/fixtures/server.ts`, default `4545` |

`boolFromEnv` treats `true` and `1` as true. Other strings become false.

Do not paste a production `DATABASE_URL` or `OPENAI_API_KEY` into docs or chat logs.
