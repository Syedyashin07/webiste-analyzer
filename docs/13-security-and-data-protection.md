# 13. Security and data protection

This document describes controls that are present in code and gaps that are also visible in code. It is not a penetration test.

## Controls that exist

- Passwords for Website Analyzer accounts are scrypt-hashed with a random salt. Comparison uses `timingSafeEqual` (`lib/password.ts`).
- Session tokens are 32 random bytes.
- Logout deletes the matching `Session` row.
- CORS allows only `FRONTEND_URL`.
- Non-GET routes are rate limited. Scan creation and data reset have tighter limits. GET is excluded from the global limiter (`app.ts` `allowList`).
- Storage keys cannot contain `..` or be absolute (`lib/storage.ts`).
- Report and evidence responses use `Cache-Control: private`.
- `assertSafeScanTarget` (`packages/shared/src/ssrf.ts`) runs on scan create (`routes/scans.ts`), on the scan URL and login URL in the worker, on crawled URLs in `pipeline.ts`, and on replay requests in `lib/http-check.ts`. `ALLOW_LOCAL_TARGETS` must be true to allow private hosts.
- Target-site passwords are not columns on `Scan`. They are placed on the BullMQ job at create time.
- Cookie values are omitted from `Page.cookiesJson`. The collector keeps name, domain, secure, and httpOnly (`packages/browser/src/index.ts`). Replay headers drop keys such as `cookie` and `authorization` (`pickReplayHeaders`).

## Gaps

- Scan, site, bug, report, settings, dashboard, and evidence routes do not require a logged-in user. The login screen blocks the React shell only.
- Evidence ids are unauthenticated download keys.
- Register still issues a server session even though the web client does not save it.
- `GET /api/auth/me` returns HTTP 200 with `user: null` for bad tokens.
- Target-site passwords travel in the Redis job payload until the job is removed.
- `FileBlob` holds full screenshots of websites, which may include personal data that was on screen. Access control is the same as the rest of the unauthenticated API.
- `retentionDays` and `maxScreenshotBytes` are stored on `AppSettings` and are not read under `apps/api/src`. Retention does not purge old blobs. Screenshot size is not enforced during capture.
- Deleting one scan removes `FileBlob` bytes but leaves `Screenshot`, `Video`, and `Trace` rows. Functional before/after PNGs are stored even when no bug is created.
- No CSRF token. The app uses bearer tokens in `localStorage`, which is readable by any script running on the origin.
- Security-engine checks the **target site** (headers, TLS). That does not harden this API.

## Secrets

Do not commit `.env`. `.env.example` shows a local PostgreSQL URL with a placeholder password. Real deployments must replace it. This documentation does not copy live secrets.
