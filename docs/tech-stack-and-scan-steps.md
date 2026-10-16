# Tech stack and every scan step

This file explains **what the Website QA Health Scanner is built with** and **every step the program takes**, from the form you fill in to the report you download.

---

## 1. What this program is

Website QA Health Scanner is a **local Windows QA tool**. You give it a website you are allowed to test. It opens a real browser, crawls pages (or only the landing page), checks links/images/forms/APIs, stores bugs with screenshots, scores website health, and exports reports.

It is **not** a mock. Results come from Playwright, HTTP checks, and rule engines. AI is optional and never confirms a bug by itself.

Three processes run together when you start the app:

| Process | URL / role |
|---|---|
| Frontend (Vite + React) | http://localhost:5173 — dashboard and forms |
| API (Fastify) | http://localhost:3000 — create scans, read results, SSE live events |
| Worker (BullMQ) | background — runs Playwright and the scan pipeline |

---

## 2. Tech stack

### Language and repo

| Piece | Choice | Why it is used |
|---|---|---|
| Language | **TypeScript** (Node.js 20+) | Typed code across web, API, worker, and engines |
| Module style | ESM (`"type": "module"`) | Native `import` / `export` |
| Repo layout | **npm workspaces monorepo** | One install; `apps/*` and `packages/*` share code |
| Runtime | **Node.js**, not Docker | Local Windows app |

### Frontend (`apps/web`)

| Piece | Choice |
|---|---|
| UI library | **React 19** |
| Bundler / dev server | **Vite 6** |
| Routing | **React Router 7** |
| Server state | **TanStack Query** (scan polling, mutations) |
| Charts | **Recharts** (dashboard severity bars) |
| Styling | **Tailwind CSS 3** + PostCSS + Autoprefixer |
| Live updates | **Server-Sent Events** (`EventSource`) plus 2s refetch while a scan is active |
| UI tests | Playwright Test (`npm run test:e2e`) |

Pages:

- `/dashboard` — start a scan + latest scores
- `/scans/new` — full scan form
- `/scans` — scan list
- `/scans/:id` — live progress, inventory counts, failed APIs, reports
- `/scans/:id/pages/:pageId` — one page
- `/bugs` and `/bugs/:id` — issues and replay
- `/reports` — downloads
- `/settings` — defaults
- `/scans/compare` — compare two scans

### Backend API (`apps/api`)

| Piece | Choice |
|---|---|
| HTTP server | **Fastify 5** |
| CORS | `@fastify/cors` (frontend origin) |
| Rate limit | `@fastify/rate-limit` (Redis-backed; scan create is tighter) |
| Validation | **Zod** (`createScanSchema` and others) |
| Dev runner | **tsx watch** (`npm run dev:api`) |
| Worker runner | **tsx** without watch (`npm run worker`) so a file save does not kill a live scan |

Main API groups:

- `POST /api/scans` — start scan
- `GET /api/scans`, `GET /api/scans/:id`, progress, pages, bugs
- pause / resume / cancel / restart / delete
- `POST /api/scans/:id/replay-apis` and `POST /api/bugs/:id/replay-api`
- dashboard, settings, reports, evidence files

### Queue and live events

| Piece | Choice | Why |
|---|---|---|
| Job queue | **BullMQ** | Scan jobs survive API request return; worker can pause/cancel |
| Broker | **Redis 7+** (`localhost:6379`) | Queue + pub/sub + pause/cancel flags |
| Redis client | **ioredis** | Used by API and worker |
| Concurrency | Worker concurrency **2** | Two scans can run; lock renews so long jobs do not stall |

Job data can include login username/password **only in the queue job**, not in PostgreSQL.

### Database and files

| Piece | Choice |
|---|---|
| Database | **PostgreSQL 15+** (`qa_scanner` on port `5432`) |
| ORM | **Prisma 6** (`prisma/schema.prisma`) |
| File storage | Folder `storage/` — screenshots, videos, traces, reports |

Important tables:

- `Scan` + `ScanConfiguration` — URL, status, scores, limits
- `Page`, `PageLink`, `PageImage`, `PageForm`, `PageElement`
- `Bug` + evidence links
- `ConsoleError`, `NetworkError`
- `Report`, `ScanEvent`
- `User` / `Project` / `AppSettings` — local seeded user (`local@qa-scanner.local`); no OAuth

Coverage (full site vs landing page) is **not** a separate DB column. Landing page is stored as `maxPages = 1` and `maxDepth = 0`.

### Browser automation

| Piece | Choice |
|---|---|
| Engine | **Playwright** |
| Browsers | Chromium (default), Firefox, WebKit |
| Package | `packages/browser` — launch, login, navigate, screenshots, traces, network capture |

Playwright browsers must be installed on the **same machine as the worker**:

```powershell
npx playwright install chromium
```

If Chromium is missing, the worker fails the scan with a clear install hint and does not retry forever.

### Domain engines (`packages/*`)

These are libraries, not separate servers. The worker imports them.

| Package | Library extras | What it does |
|---|---|---|
| `shared` | Zod, Pino | URLs, SSRF, coverage limits, fingerprints, redaction, logging |
| `crawler` | — | BFS crawl, robots.txt, sitemap, max pages/depth |
| `browser` | Playwright | Real browser session |
| `parser` | **Cheerio** | Links, images, forms, headings from HTML |
| `functional-engine` | — | Safe clicks, form validation (no destructive actions) |
| `visual-engine` | — | Overflow / overlap / viewport issues |
| `accessibility-engine` | **axe-core**, Cheerio | HTML + runtime + axe checks |
| `seo-engine` | — | Technical SEO (title, meta, robots, sitemap) |
| `performance-engine` | — | Timing / transfer metrics from the browser |
| `security-engine` | — | Passive HTTPS, TLS, headers, mixed content |
| `health-engine` | — | Deterministic 0–100 scores |
| `ai-engine` | **OpenAI** SDK, Zod | Optional wording / interpretation only |
| `evidence-engine` | — | Annotate / crop screenshot copies |
| `report-engine` | **ExcelJS**, Playwright PDF | JSON, HTML, CSV, XLSX, PDF |

### Tooling

| Piece | Choice |
|---|---|
| Tests | **Vitest** (`npm test`) |
| Lint / format | ESLint 9, Prettier |
| Types | TypeScript 5.7 |
| Parallel dev | **concurrently** (`npm run dev` starts web + API + worker) |
| Logging | **Pino** |
| Env | **dotenv** (`.env`, never committed) |

### What is not in the stack

- No Docker
- No cloud deploy required
- No OAuth / login wall for the dashboard
- No penetration testing / exploit tools
- No Google PageSpeed API (scores are our own QA scores)

---

## 3. How the pieces talk

```
Browser (you)
    │  HTTP + SSE
    ▼
React (Vite :5173)
    │  /api/*
    ▼
Fastify API (:3000)
    │  Prisma                 Redis
    ├──────────► PostgreSQL    │
    │                          │ BullMQ job + pub/sub
    ▼                          ▼
Scan row + events          Worker process
                               │
                               ▼
                         Playwright browser
                               │
                               ▼
                    Engines → bugs → storage/reports
```

1. The UI never talks to Playwright.
2. The API never crawls. It validates, writes the scan row, and enqueues a job.
3. The worker does the slow work and writes pages, bugs, and files.
4. The UI polls `GET /api/scans/:id` and listens to SSE for live status.

---

## 4. Every step you do (as a user)

### Step A — One-time machine setup

1. Install **Node.js 20+**, **PostgreSQL**, **Redis**, and **Git**.
2. Copy `.env.example` to `.env`.
3. Create database `qa_scanner`.
4. Run `npm install`, `npx prisma generate`, `npx prisma migrate dev`, `npm run prisma:seed`.
5. Run `npx playwright install chromium`.
6. Start Redis so `redis-cli ping` returns `PONG`.
7. Start the app: `npm run dev`.
8. Open http://localhost:5173.

### Step B — Start a scan

1. Open **Dashboard** or **Start a scan**.
2. Enter the **website URL** (`https://…`).
3. **Choose coverage** (required):
   - **Full website (end to end)** — crawl reachable pages, then scan each one.
   - **Landing page only** — scan only the URL you entered.
4. Optional: login username + password + login page if you need pages behind sign-in. Passwords are **not** saved in the database.
5. If you chose full website, set **max pages** and **max depth**.
6. Pick viewport, test mode (Safe / Standard / Aggressive), browser, and which checks to run.
7. Click **Run full website QA** or **Scan landing page**.

The program then:

- Blocks a second scan of the same URL if one is already queued or running (HTTP 409).
- Sends you to `/scans/<id>`.

### Step C — Watch and control

On the scan page you can:

- Watch live URL, action, progress, and counts
- Pause, resume, or stop
- After it finishes: restart, delete, download reports, replay failed APIs

### Step D — Read the result

You get:

- Coverage badge (full site or landing page)
- Pages discovered / scanned / failed
- Links found / broken
- Images found / broken
- Forms, elements, API failures, bugs
- Category health scores
- HTML / PDF / Excel / CSV / JSON reports

---

## 5. Every step the program does (system pipeline)

Statuses in order:

`QUEUED` → `INITIALIZING` → `CRAWLING` → `SCANNING` → `ANALYZING` → `VERIFYING` → `GENERATING_REPORT` → `COMPLETED`

Failure paths: `FAILED`, `CANCELLED`, `PAUSED`.

### Step 1 — Validate the form (browser)

1. URL is required (`http` or `https`).
2. Coverage must be chosen. Submit is blocked until you pick one.
3. Username and password must both be present if either is filled.
4. Payload is posted to `POST /api/scans`.

### Step 2 — API creates the job (Fastify)

1. Zod parses the body (`createScanSchema`).
2. URL is normalized (host lowercased, fragment dropped, default ports dropped).
3. **SSRF check**: only http/https; private IPs, localhost, and cloud metadata are blocked unless `ALLOW_LOCAL_TARGETS=true`.
4. If the same URL is already queued or in flight, return **409** with that `scanId`.
5. Coverage is turned into crawl limits:
   - `LANDING` → `maxPages = 1`, `maxDepth = 0`
   - `FULL` → your max pages/depth, or settings defaults
6. A `Scan` row (`QUEUED`) and `ScanConfiguration` are written.
7. A BullMQ job is added with `jobId = scanId` (login creds only in job data).
8. Redis event: `Landing page only scan queued` or `Full website (end to end) scan queued`.
9. Response: `{ scanId, status: "QUEUED" }` — the HTTP request is done. The worker does the rest.

### Step 3 — Worker pickup

1. On start, the worker recovers stuck jobs (move stale active jobs back to wait; fail lost queued jobs that no longer have login creds in Redis).
2. It takes the next job (up to 2 at once).
3. Status becomes **INITIALIZING**.
4. Target URL is SSRF-checked again.
5. If a login URL is given, it must be same-origin and allowed.
6. Playwright launches Chromium (or the chosen engine).
7. A browser context is created (desktop viewport first).

### Step 4 — Optional sign-in

If username and password were sent:

1. Worker opens the login page.
2. It fills credentials and submits.
3. Crawl starts from the URL after login (so protected pages can be found).
4. Passwords are not written to reports or the database.

If login fails, the scan fails with that message.

### Step 5 — CRAWLING (discover pages)

1. Status **CRAWLING**.
2. `crawlSite` runs a BFS from the start URL (or post-login URL).

**Landing page (`maxPages = 1`, `maxDepth = 0`):**

- Does **not** fetch `sitemap.xml` to enqueue more pages.
- Does **not** follow links to other pages.
- Discovers **only the start URL**.
- The landing page is still fully scanned later (links and images on that page are counted and checked).

**Full website:**

- Reads `robots.txt` (default respect on).
- May read `sitemap.xml` (and a few nested sitemaps) and enqueue same-host URLs.
- For each page under `maxDepth`, Playwright opens it, extracts links from HTML + rendered DOM.
- Same host only. Duplicates (normalized URL) are skipped.
- Stops at `maxPages`.
- Delay `crawlDelayMs` between fetches.
- Each discovered URL is SSRF-checked before visit.

3. Each discovered URL is upserted as a `Page` (`DISCOVERED`).
4. `pagesDiscovered` is updated live.
5. Event example: `Full website (end to end): discovered 17 pages`.

### Step 6 — SCANNING (each discovered page)

1. Status **SCANNING**.
2. Pages are scanned with limited concurrency (`p-limit`).
3. Pause/cancel is checked between pages.

**For every page the worker:**

1. Marks the page `SCANNING` and sets live action `Opening <url>`.
2. Playwright navigates and waits for DOM + a short network idle.
3. Collects HTML, final URL, status, timing, console, network, cookies, viewport.
4. If you were logged in and this page bounced back to login, it files **Unexpected logout**.
5. Cheerio parses HTML (title, meta, links, images, forms, headings).
6. Saves page metadata to PostgreSQL.
7. Takes a full-page screenshot (if enabled).
8. Inspects TLS for https pages (cached per host).
9. **Links** (up to 80 unique): HTTP-check each href. 4xx/5xx or network error = broken link bug.
10. **Images** (up to 60): HTTP-check + natural width/height. Broken or 0×0 = broken image bug.
11. **Forms**: store action, method, fields (no password dump).
12. **Interactive elements** (up to 200): buttons, inputs, links, etc.
13. **Console errors** stored (secrets redacted).
14. **Failed network/API calls** stored. API failures are labeled `API failed: GET /api/… → 500`.
15. **Performance** (if on): timings and issues.
16. **SEO** (if on): title, description, robots, sitemap presence, etc.
17. **Accessibility** (if on): HTML rules + runtime + axe-core.
18. **Security** (always TLS; headers if enabled): HTTPS, mixed content, missing headers. Passive only.
19. **Functional** (if on): safe clicks and form validation. Never payments, delete, or password change.
20. **Visual** (viewport mode): overflow / overlap / extra sizes if you chose Tablet/Mobile/All.
21. Page marked `SCANNED` or `FAILED`.
22. Progress moves from ~25% toward ~75% as pages finish.

### Step 7 — ANALYZING

1. Status **ANALYZING**.
2. Similar bugs are grouped by **fingerprint** (same category + signature) so one broken header is not 200 duplicate bugs.
3. If AI is enabled and `OPENAI_API_KEY` is set, the model may rewrite title/steps. Zod validates the JSON. AI does **not** mark a bug confirmed by itself.
4. Counts of issues are updated.

### Step 8 — VERIFYING

1. Status **VERIFYING**.
2. Suspected bugs can be re-opened in Playwright to see if they still reproduce.
3. Status becomes `CONFIRMED` or `UNVERIFIED`.
4. Rule-detected broken links/images are already confirmed from the HTTP check.

### Step 9 — GENERATING_REPORT

1. Status **GENERATING_REPORT**.
2. Health scores are computed (`packages/health-engine`):
   - Each category starts at 100.
   - Critical −15, High −8, Medium −4, Low −1.
   - Overall is a weighted average (performance, a11y, SEO, security, functional, visual 15 each; technical 10).
   - Engines you turned off are left out of the average.
3. Inventory is built:
   - coverage label
   - pages discovered / scanned / failed
   - links found / broken
   - images found / broken
   - forms, elements, unique API failures
4. Files written under `storage/reports/<scanId>/`:
   - JSON
   - HTML (executive summary includes the inventory sentence)
   - CSV
   - XLSX (Summary, Bugs, Pages, Broken Links, Broken Images, …)
   - PDF (Playwright print of HTML)
   - Bug-details PDF (location, steps, how to check)
5. Screenshot bytes used in PDFs are copies; originals stay on disk.

### Step 10 — COMPLETED

1. Status **COMPLETED**, progress 100%, `completedAt` set.
2. UI shows scores, inventory cards, failed-API table, and download links.
3. Browser is closed.

### Control steps (any time while active)

| You click | Program does |
|---|---|
| Pause | Redis pause flag; worker waits in a loop |
| Resume | Flag cleared; crawl/scan continues |
| Stop | Redis cancel; Playwright work stops; evidence already saved is kept |
| Delete | DB rows + files under that scan are removed |
| Restart | New scan row copies the same `maxPages` / `maxDepth` (so landing stays landing) |
| Fast replay | Re-sends failed API method+URL (no stored body; logged-in APIs may 401) |

---

## 6. How coverage is stored and shown

| You choose | Stored as | Crawler | Report |
|---|---|---|---|
| Landing page only | `maxPages=1`, `maxDepth=0` | Start URL only | “Landing page only” + counts for that page |
| Full website | your limits (e.g. 100 pages, depth 5) | BFS + optional sitemap | “Full website (end to end)” + site-wide counts |

Detection later: `coverageFromLimits(maxPages, maxDepth)` → `LANDING` if pages ≤ 1 and depth ≤ 0, else `FULL`.

The scan detail API returns an `inventory` object. The scans list adds a Coverage column.

---

## 7. Health score reminder

This is a **QA health score**, not Google PageSpeed and not a search ranking.

Skipped checks do not drag the overall average down.

---

## 8. Safety rules the stack enforces

- Only http/https targets.
- Private/local IPs blocked unless `ALLOW_LOCAL_TARGETS=true` (local fixture site).
- Same host crawl only.
- Login URL must be same website.
- Secrets/cookies/Authorization redacted in logs and reports.
- Evidence paths stay under `storage/` (no `..`).
- HTML reports escape site text.
- No exploit, CAPTCHA bypass, WAF bypass, or destructive clicks.
- Scan only sites you own or have permission to test.

---

## 9. Common commands

```powershell
npm run dev              # web + API + worker
npm run dev:web          # UI only
npm run dev:api          # API only
npm run worker           # scan worker only
npm test                 # Vitest
npm run prisma:migrate   # DB migrations
npm run prisma:seed      # local user + project
npx playwright install chromium
```

Related docs: `docs/architecture.md`, `docs/setup.md`, `docs/crawler.md`, `docs/scoring.md`, `docs/reports.md`, `docs/security.md`.
