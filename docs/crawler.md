# Crawler

The crawler starts at the user URL after SSRF checks.

Rules:

- Same host only unless later configuration expands this.
- URL normalization: lowercase host, drop fragments, drop default ports, collapse trailing slashes except origin.
- BFS with `maxPages` and `maxDepth`.
- Duplicate normalized URLs are ignored.
- `robots.txt` is respected by default (`User-agent: WebsiteQAHealthScanner/1.0`, fallback `*`).
- Configurable delay (`crawlDelayMs`) and concurrency limits.
- Redirects are followed by Playwright during navigation; each discovered URL is SSRF-checked.

It does not log in, fill credentials, or crawl other registrable domains.
