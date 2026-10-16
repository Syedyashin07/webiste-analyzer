# Reports

After a scan completes, four files are written under `storage/reports/<scanId>/`:

- JSON — full structured payload
- HTML — printable executive report
- XLSX — sheets: Summary, Bugs, Pages, Broken Links, Broken Images, Console Errors, Network Errors, SEO, Accessibility, Performance, Security
- PDF — Playwright print of the HTML report

Download via `GET /api/reports/:id/download` or the Reports page.

Screenshots embedded in PDF/HTML are base64 copies of files already stored on disk. Original screenshot files are never overwritten; annotated copies are separate.
