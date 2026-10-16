# 2. Technology stack

Versions below are the ranges declared in `package.json` files, not a lockfile audit.

| Layer | Technology | Where declared | Why it is in the repo |
| --- | --- | --- | --- |
| Language | TypeScript 5.7 | Root and workspace `package.json` | Shared types across web, API, and engines |
| Runtime | Node.js `>=20` | Root `package.json` `engines` | API, worker, Prisma, and tests |
| UI | React 19, React DOM 19 | `apps/web/package.json` | Browser application |
| Routing | React Router 7 | `apps/web/package.json` | Pages and the login gate |
| Server state | TanStack Query 5 | `apps/web/package.json` | Scan and dashboard fetches |
| Charts | Recharts 2 | `apps/web/package.json` | Dashboard charts |
| Styling | Tailwind CSS 3, PostCSS, Autoprefixer | `apps/web/package.json` | UI styling |
| Bundler | Vite 6 | `apps/web/package.json` | Dev server on port 5173 and production build |
| API | Fastify 5 | `apps/api/package.json` | HTTP API |
| CORS | `@fastify/cors` | `apps/api/package.json` | Allows `FRONTEND_URL` |
| Rate limit | `@fastify/rate-limit` | `apps/api/package.json` | Limits non-GET traffic using Redis |
| ORM | Prisma 6 and `@prisma/client` | Root `package.json` | PostgreSQL access |
| Database | PostgreSQL | `prisma/schema.prisma` `provider = "postgresql"` | Records and file bytes |
| Queue | BullMQ 5 | `apps/api/package.json` | Scan jobs |
| Cache / broker | ioredis 5, Redis | `apps/api/package.json`, `.env.example` | Queue and rate limit |
| Browser automation | Playwright 1.50 | Root `package.json` | Crawl, screenshots, PDFs |
| Validation | Zod | `packages/shared` | Env and request schemas |
| Logging | pino via `@qa-scanner/shared` | `packages/shared/src/logger.ts` | API and worker logs |
| Tests | Vitest 3, Playwright test | Root and `apps/web/package.json` | Unit and e2e scripts |
| AI | OpenAI HTTP API | `packages/ai-engine` | Optional finding interpretation |

Workspace packages under `packages/`:

| Package | Responsibility |
| --- | --- |
| `@qa-scanner/shared` | Schemas, env, scoring, page-flow names, SSRF helpers, logger |
| `@qa-scanner/browser` | Playwright launch and login helpers |
| `@qa-scanner/crawler` | Link crawl |
| `@qa-scanner/parser` | HTML parse |
| `@qa-scanner/accessibility-engine` | Accessibility checks |
| `@qa-scanner/seo-engine` | SEO checks |
| `@qa-scanner/security-engine` | Header and TLS-related checks |
| `@qa-scanner/performance-engine` | Performance metrics |
| `@qa-scanner/functional-engine` | Safe interactions and form checks |
| `@qa-scanner/visual-engine` | Viewport and visual findings |
| `@qa-scanner/evidence-engine` | Screenshot annotation and crops |
| `@qa-scanner/health-engine` | Score rollup |
| `@qa-scanner/report-engine` | HTML, PDF, and spreadsheet reports, including the flow PDF |
| `@qa-scanner/ai-engine` | Optional OpenAI calls |

There is no separate mobile app, no GraphQL server, and no cloud object-storage SDK in `apps/api/package.json`.
