const REDACTED = "[REDACTED]";

const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "access_token",
  "refresh_token",
  "private_key",
  "creditcard",
  "cardnumber",
  "cvv",
  "ssn",
];

const SECRET_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._+=/-]+/gi,
  /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g,
];

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEYS.some((item) => normalized.includes(item.replace(/[^a-z0-9]/g, "")));
}

export function redactString(value: string): string {
  let output = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, REDACTED);
  }
  return output;
}

export function redactHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!headers) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = isSensitiveKey(key) ? REDACTED : value;
  }
  return result;
}

export function redactObject(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key) ? REDACTED : redactObject(nested);
    }
    return result;
  }
  return value;
}

export function looksLikeSecretInSource(source: string): string[] {
  const findings: string[] = [];
  if (/AKIA[0-9A-Z]{16}/.test(source)) findings.push("Possible AWS access key in page source");
  if (/-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(source)) findings.push("Private key material in page source");
  if (/api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/i.test(source)) {
    findings.push("Possible API key assigned in page source");
  }
  return findings;
}
