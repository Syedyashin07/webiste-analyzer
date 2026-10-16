# Windows setup

## PostgreSQL

1. Install PostgreSQL for Windows from https://www.postgresql.org/download/windows/
2. Keep the port `5432`.
3. Create database `qa_scanner`.
4. Put the connection string in `.env`:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/qa_scanner?schema=public
```

```powershell
npx prisma migrate dev
npm run prisma:seed
```

`prisma migrate` needs a running Postgres. `prisma generate` does not.

## Redis

Install a native Windows Redis build or Memurai. The API and worker **fail startup** if Redis is down. They do not fake the queue.

```powershell
redis-cli ping
```

Expected: `PONG`.

```
REDIS_URL=redis://127.0.0.1:6379
```

## Playwright

```powershell
npx playwright install chromium
```

Browsers are resolved through Playwright's own path logic (Windows-safe; no hardcoded `/usr` paths).

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.
