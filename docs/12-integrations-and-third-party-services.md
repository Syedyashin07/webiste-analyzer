# 12. Integrations and third-party services

| Service | Required | How it is used | Code |
| --- | --- | --- | --- |
| PostgreSQL | Yes | All durable data and file bytes | `DATABASE_URL`, Prisma |
| Redis | Yes | BullMQ and rate limiting. API refuses to start if `PING` fails (`lib/redis.ts` `assertRedis`) | `REDIS_URL` |
| Target website | Yes for a scan | Playwright navigates to the submitted URL | `workers/pipeline.ts` |
| OpenAI | No | Optional interpretation of findings and visuals | `packages/ai-engine`, `OPENAI_API_KEY`, `OPENAI_MODEL` default `gpt-4o-mini` |
| Playwright browsers | Yes for scans | Chromium is launched headless. Install script also lists Firefox and WebKit | `package.json` `playwright:install` |

Not present in the API dependencies:

- Email (SMTP, SendGrid, and similar).
- Object storage SDKs.
- Payment providers.
- OAuth (Google, GitHub, and similar).
- Error trackers such as Sentry.

`docs/ai.md` is an older note. Behavior in code: if the API key is empty, scans still complete. The env comment in `.env.example` states that.

The worker does not call a cron service. Scheduling is “a job is queued when a scan is created.”

`respectRobotsTxt` is a setting and a scan configuration flag. Enforcement is inside the crawler package. Read `packages/crawler` before assuming every disallowed URL is skipped.
