# Architecture

Website QA Health Scanner is an npm-workspace monorepo.

```
apps/web        React + Vite dashboard
apps/api        Fastify HTTP API + BullMQ worker entry
packages/*      Domain engines (crawler, Playwright, scoring, reports, ...)
prisma/         PostgreSQL schema
storage/        Screenshots, videos, traces, reports (filesystem)
```

## Runtime

1. `POST /api/scans` validates the URL (http/https + SSRF), creates `Scan` + `ScanConfiguration`, and enqueues a BullMQ job. The HTTP response returns immediately with `{ scanId, status: "QUEUED" }`.
2. The worker process runs `runScanPipeline`:
   INITIALIZING → CRAWLING → SCANNING → ANALYZING → VERIFYING → GENERATING_REPORT → COMPLETED
3. Progress events are stored in `ScanEvent` and published on Redis pub/sub. The dashboard uses Server-Sent Events.
4. Confirmed issues are stored as `Bug` rows with fingerprints for deduplication. Binary evidence stays on disk; the database stores paths.

## Engine split

| Package | Responsibility |
|---|---|
| crawler | BFS discovery, robots.txt, max pages/depth |
| browser | Playwright Chromium session, screenshots, traces, performance entries |
| parser | Cheerio DOM extraction |
| functional-engine | Safe clicks and form validation |
| visual-engine | Geometry overflow/overlap/viewport checks |
| accessibility-engine | Labels, names, headings, contrast (measurable) |
| seo-engine | Technical SEO only |
| performance-engine | Timing and transfer metrics |
| security-engine | Passive HTTPS/headers/mixed content |
| health-engine | Deterministic 0-100 scoring |
| ai-engine | Optional structured OpenAI JSON, Zod-validated |
| evidence-engine | Annotate/crop copies of screenshots |
| report-engine | HTML, PDF, XLSX, JSON |
| shared | URL, SSRF, redaction, fingerprints, env |

Workers run in one Node process locally (`npm run worker`). They are modules, not microservices.

## Auth

Local application mode: a seeded `local@qa-scanner.local` user and default project. No OAuth. User/project models exist so authentication can be added later.
