# 17. Deployment and production setup

## What the repository provides

- `npm run build` compiles the web app with Vite and the API with `tsc`.
- `apps/api` `start` script runs `node dist/index.js`.
- `prisma migrate deploy` is `npm run prisma:deploy`.
- The API listens on `0.0.0.0` and `PORT`.

## What the repository does not provide

No Dockerfile, Kubernetes manifest, or hosted platform config (Fly, Render, Vercel) was found at the repo root during this documentation pass. Production hosting is **not verified** beyond the Node processes above.

## Processes a deployment needs

1. PostgreSQL and a migrated schema.
2. Redis.
3. API process (`node dist/index.js` after build).
4. Worker process (`npm run worker` or the compiled worker entry). The worker is required for scans. The API only enqueues jobs.
5. Static hosting or a Node server for the Vite `apps/web/dist` output.
6. Playwright Chromium installed on the worker machine.
7. Environment variables from [Environment variables](15-environment-variables.md).

The web client calls relative paths such as `/api/scans` (`apps/web/src/api/client.ts`). In development, Vite proxies `/api` to port 3000. A static host will not do that unless a reverse proxy serves `/api` on the same origin. There is no `VITE_API_URL` in `env.ts`.

Set `FRONTEND_URL` to the real site origin or the browser will fail CORS.

Set `ALLOW_LOCAL_TARGETS=false`.

Do not rely on `local@qa-scanner.local` as a multi-tenant boundary. See [Authentication](10-authentication-and-authorization.md).

## Storage in production

Plan PostgreSQL disk for `FileBlob.bytes`. Screenshot scans store one PNG per page. There is no S3 offload in the current code.
