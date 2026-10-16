# Security

## Application

- Zod validation on API payloads
- SSRF: http/https only; localhost, private ranges, link-local, and cloud metadata blocked unless `ALLOW_LOCAL_TARGETS=true` (tests)
- Hostname is DNS-resolved and every address is checked
- Rate limit on scan creation
- Evidence paths are constrained to `storage/` (no `..`, no absolute keys)
- Report filenames are sanitized
- Secrets, cookies, and Authorization headers are redacted
- Dashboard text is React-escaped; HTML reports escape user/site strings

## Target scanning

Passive only:

- HTTPS vs HTTP
- Mixed content
- Security headers
- Insecure form actions
- Obvious secrets in HTML source

The scanner will not:

- Bypass auth, CAPTCHA, WAF, or rate limits
- Exploit vulnerabilities
- Submit payments, delete accounts, or change passwords
- Scan authenticated areas
