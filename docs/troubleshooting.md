# Troubleshooting

## Redis is unavailable

Start Redis, then restart `npm run dev:api` and `npm run worker`. The process exits instead of faking jobs.

## Prisma P1001 / can't reach database

Confirm PostgreSQL is running on 5432 and `DATABASE_URL` is correct. Then:

```powershell
npx prisma migrate dev
```

## Playwright browser not found

```powershell
npx playwright install chromium
```

## Scan stays QUEUED

The API enqueues work; the **worker** process must be running (`npm run worker` or `npm run dev`).

## Local fixture URL rejected

Set `ALLOW_LOCAL_TARGETS=true` in `.env` and restart API + worker. This is for tests only.

## OpenAI errors

Leave `OPENAI_API_KEY` empty. Deterministic engines still produce bugs, scores, and reports.

## Scan cancelled but browser still open

Cancellation sets a Redis flag checked between pages and aborts Playwright work. A page already in `goto` may take until the page timeout. Evidence already stored is kept.
