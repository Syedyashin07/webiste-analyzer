# 5. Frontend documentation

## Structure

- Entry: `apps/web/src/main.tsx`.
- Routes: `apps/web/src/App.tsx`.
- Authenticated shell: `apps/web/src/components/layout/AppLayout.tsx`.
- HTTP: `apps/web/src/api/client.ts`.
- Auth storage: `apps/web/src/lib/auth.ts` keys `qa-auth-token` and `qa-auth-user`.
- Server cache: TanStack Query on data pages.
- Styling: Tailwind. Brand colors are in `apps/web/tailwind.config.js`.

There is no Redux store. Form state is React `useState`.

## Routes

| Path | Component | Inside `AppLayout` |
| --- | --- | --- |
| `/` | `LandingPage` | No |
| `/login` | `LoginPage` | No |
| `/register` | `RegisterPage` | No |
| `/dashboard` | `DashboardPage` | Yes |
| `/sites`, `/sites/:id` | `SitesPage`, `SitePage` | Yes |
| `/scans`, `/scans/new`, `/scans/compare`, `/scans/:id`, `/scans/:id/pages/:pageId` | Scan pages | Yes |
| `/bugs`, `/bugs/:id` | Bug pages | Yes |
| `/reports` | `ReportsPage` | Yes |
| `/settings` | `SettingsPage` | Yes |

`AppLayout` returns `<Navigate to="/login" />` when `readAuthUser()` is null. That check is in the browser only.

## Landing page

`LandingPage.tsx` explains the product and lists checks: screenshots, SEO score, API failures, links, images, forms, accessibility, performance, security, health score, flow PDF, and bugs. **Start a scan** links to `/scans/new`, which the layout will block until login.

## Login and register

`AuthPages.tsx`:

- Login posts `{ email, password }` to `/api/auth/login`, stores the token, and navigates to `/dashboard`.
- Register posts `{ name, email, password }` only after the checkbox “I agree to create this account” is checked and the passwords match. It then navigates to `/login` and does **not** call `saveAuth`.
- Fields are pill-shaped. `auth-field` in `apps/web/src/index.css` removes the focus outline so the pill does not gain a square outline.

## Scan form

`components/scans/ScanForm.tsx` collects site name, URL, coverage, optional target-site login, and QA toggles. Screenshot coverage forces desktop screenshots and skips the other QA toggles in the payload built by the form. Submit calls `POST /api/scans`.

The password typed here is for the **website under test**, not for Website Analyzer login.

## Screenshot display

`ScreenshotFlow.tsx` lists pages that have screenshots. Image bytes are loaded with `<img src={"/api/evidence/" + shot.id}>`. The same pattern is used on the scan, page, and bug screens. There is no user file-picker. Zip names such as `login.png` are produced only by the download route.

## Loading and errors

Query pages show loading and empty copy from `i18n/en.ts`. API errors surface as `Error` messages from `client.ts` when the response is not OK. There is no third-party toast library in `apps/web/package.json`.

## Click to API examples

**Start a scan**

1. User submits `ScanForm`.
2. `client.ts` `POST /api/scans` with JSON and `Authorization: Bearer` if a token exists.
3. API returns the created scan.
4. UI navigates to the scan detail route.
5. Detail page polls `GET /api/scans/:id/progress`.

**Log in**

1. `LoginPage` `POST /api/auth/login`.
2. `saveAuth` writes token and user, dispatches `qa-auth`.
3. Router goes to `/dashboard`.
4. Dashboard `GET /api/dashboard`.

**Download a report**

1. Reports UI requests `GET /api/reports/:id/download`.
2. The browser receives the file body from PostgreSQL via `readStoredFile`.
