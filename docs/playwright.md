# Playwright engine

Chromium is launched headless per scan.

For each page the engine:

- Navigates with timeout
- Waits for `domcontentloaded`, then briefly for `networkidle`
- Collects title, HTML, cookies (names/flags only), console errors, page errors, failed requests, 4xx/5xx responses
- Captures a full-page screenshot when enabled
- Records video + trace for failed functional scenarios when enabled

Authorization headers and cookie values are redacted from stored network logs. Passwords are never stored.

Windows paths use `path.join` / `path.resolve` under `storage/`.
