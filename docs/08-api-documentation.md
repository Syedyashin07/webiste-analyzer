# 8. API documentation

Base URL in development: `http://localhost:3000`. The browser calls `/api` on port 5173 and Vite proxies it.

Authentication: data routes do not check a session. `POST /api/auth/login` and `POST /api/auth/register` are public. `GET /api/auth/me` and `POST /api/auth/logout` read `Authorization: Bearer <token>` when present.

Unless noted, success bodies are JSON. Zod failures return `400` `{ "error": "Validation failed", "details": [ ... ] }` from `app.ts`.

## Health

| Method | Path | Auth | Purpose | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | No | Redirect to `FRONTEND_URL` | Redirect | |
| GET | `/api/health` | No | Database `SELECT 1` and Redis `PING` | `{ ok, database: "up", redis: "up" }` | `503` if either check throws |

Handler: `apps/api/src/app.ts`.

## Auth — `routes/auth.ts`

### POST `/api/auth/register`

Body: `name`, `email`, `password`. Password must be at least 8 characters. Email must match a simple pattern. Duplicate email returns `409`. Invalid input returns `400`.

Success `201`: `{ token, user: { id, name, email } }`. Also inserts `Session` and `AppSettings`. The web client ignores `token` and sends the person to the login page.

### POST `/api/auth/login`

Body: `email`, `password`. Wrong email or password: `401` `{ error: "Email or password is incorrect" }`. Missing fields: `400`.

Success: `{ token, user }`. Password check is scrypt in `lib/password.ts`.

### GET `/api/auth/me`

Bearer token. Missing, unknown, or expired session returns `{ user: null }` with HTTP 200, not 401.

### POST `/api/auth/logout`

Deletes `Session` rows for the bearer token. No body required.

## Sites — `routes/sites.ts`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/sites` | Projects that have scans |
| GET | `/api/sites/:id` | One project and counts |

`404` when the id is missing. No request body.

## Dashboard and settings — `routes/dashboard.ts`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Summary for the home screen |
| GET | `/api/compare` | Compare scans. Invalid query uses `compareScansSchema` |
| GET | `/api/settings` | `AppSettings` for the local user |
| PUT | `/api/settings` | Updates settings through `settingsSchema` |
| POST | `/api/settings/reset-data` | Deletes scan data. Rate limit 3 per minute |

## Scans — `routes/scans.ts`

| Method | Path | Purpose | Notes |
| --- | --- | --- | --- |
| POST | `/api/scans` | Create scan and enqueue job | Body `createScanSchema`. Rate limit 10/minute. Success `201` `{ scanId, status, siteId, siteName }`. A scan of the same URL already queued or running returns `409` with `scanId`. Login password is copied into the job, not the scan row. Restart (`POST .../restart`) enqueues `{ scanId }` only, so it does not resend the target-site password |
| GET | `/api/scans/:id/events` | Live progress stream | `Content-Type: text/event-stream`. Replays `ScanEvent` rows, then Redis messages on `scan:{id}:events`. Heartbeat every 15 seconds. Not a JSON list |
| GET | `/api/scans` | List scans | Optional `projectId` query |
| GET | `/api/scans/:id` | Scan detail | `404` if missing |
| GET | `/api/scans/:id/progress` | Progress counters and status | |
| GET | `/api/scans/:id/pages` | Pages for the scan | |
| GET | `/api/scans/:id/pages/:pageId` | One page and children | |
| GET | `/api/scans/:id/bugs` | Bugs for the scan | |
| GET | `/api/scans/:id/screenshots.zip` | Zip of stored screenshots | Screenshot coverage uses one `screenshots/` folder and flow names such as `login.png`. Those names are zip entries. Database keys stay `{pageId}-{kind}-full.png`. Annotated, before, and after shots are omitted |
| GET | `/api/scans/:id/flow.pdf` | Flow diagram plus slides | Screenshot scans only. `400` if coverage is not SCREENSHOTS. `404` if no images. Stops after 60 slides |
| POST | `/api/scans/:id/cancel` | Cancel | |
| POST | `/api/scans/:id/pause` | Pause | |
| POST | `/api/scans/:id/resume` | Resume | |
| POST | `/api/scans/:id/restart` | Restart | |
| POST | `/api/scans/:id/replay-apis` | Re-request failed APIs | |
| DELETE | `/api/scans/:id` | Delete scan row and file bytes | Cascades pages, bugs, reports, events. Then `removeScanFiles` deletes blobs and the scan directories. Screenshot, video, and trace rows are not deleted by this route |

Create body fields are in `packages/shared/src/schemas.ts` `createScanSchema`: `url` (http or https), optional limits, viewport, QA flags, `coverage`, `name`, and paired `loginUsername` / `loginPassword`.

## Bugs — `routes/bugs.ts`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/bugs` | Filter with `bugFilterSchema`, optional `projectId` |
| GET | `/api/bugs/:id` | One bug and evidence |
| PATCH | `/api/bugs/:id` | `updateBugSchema`: optional status, severity, priority |
| POST | `/api/bugs/:id/replay-api` | Replay one failed API |

## Reports and evidence — `routes/reports.ts`

| Method | Path | Purpose | Response |
| --- | --- | --- | --- |
| GET | `/api/reports` | Latest 100, optional `projectId` | `{ reports }` |
| GET | `/api/reports/:id` | Metadata | `404` if missing |
| GET | `/api/reports/:id/download` | File bytes | Attachment. `404` if row or bytes missing |
| GET | `/api/evidence/:id` | Screenshot, else video, else trace | `Content-Type` from the row. `Cache-Control: private, max-age=3600`. `404` if missing |

Evidence and report downloads are not behind a session check.
