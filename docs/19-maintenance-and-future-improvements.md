# 19. Maintenance and future improvements

This file records follow-up work suggested by the current code. It is not a commitment to build those items.

## Keep these files in mind

- `prisma/schema.prisma` and `prisma/migrations`
- `apps/api/src/workers/pipeline.ts`
- `apps/api/src/routes/scans.ts`
- `apps/api/src/lib/storage.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/services/local-context.ts`
- `apps/web/src/App.tsx` and `components/layout/AppLayout.tsx`
- `apps/web/src/api/client.ts`
- `packages/shared/src/schemas.ts` and `src/env.ts`
- `packages/report-engine` for PDFs

## Improvements that match known gaps

1. Require a valid session on data and evidence routes, or remove the login screen’s implication that data is private.
2. Attach scans to the logged-in `User` instead of always using `local@qa-scanner.local`.
3. Stop creating a `Session` during register if the client will not use it.
4. Apply `retentionDays` in a worker, or remove the column if it is unused.
5. Add a production story for `FileBlob` size: external object storage, or documented Postgres disk limits.
6. On single-scan delete, also delete `Screenshot`, `Video`, and `Trace` rows. Today `removeScanFiles` deletes bytes only, and `Screenshot.pageId` uses `onDelete: SetNull`.
7. Either enforce `maxScreenshotBytes` in the pipeline or stop presenting it as a capture limit. The settings form saves it. The worker does not read it.
8. The built frontend calls relative `/api/...` paths. A static host needs a reverse proxy. There is no `VITE_API_URL`.

## Do not assume

- Email delivery.
- Multi-tenant isolation.
- S3 or a CDN.
- A scheduled backup. None is configured in this repository.
