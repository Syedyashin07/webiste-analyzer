import type { ParsedPage } from "@qa-scanner/parser";
import { looksLikeSecretInSource, type Severity } from "@qa-scanner/shared";
import { WEAK_PROTOCOLS, type TlsInspection } from "./tls.js";

export interface SecurityIssueFinding {
  rule: string;
  severity: Severity;
  message: string;
}

const HEADER_CHECKS: Array<{ name: string; rule: string; severity: Severity }> = [
  { name: "content-security-policy", rule: "csp-missing", severity: "MEDIUM" },
  { name: "x-content-type-options", rule: "xcto-missing", severity: "LOW" },
  { name: "referrer-policy", rule: "referrer-policy-missing", severity: "LOW" },
  { name: "permissions-policy", rule: "permissions-policy-missing", severity: "LOW" },
  { name: "strict-transport-security", rule: "hsts-missing", severity: "MEDIUM" },
];

export function analyzeTls(inspection: TlsInspection): SecurityIssueFinding[] {
  const issues: SecurityIssueFinding[] = [];

  if (!inspection.schemeHttps) {
    issues.push({
      rule: "https-missing",
      severity: "CRITICAL",
      message: `Page is not served over HTTPS: ${inspection.pageUrl}`,
    });
  }

  if (!inspection.connected) {
    issues.push({
      rule: "ssl-unreachable",
      severity: "HIGH",
      message: `Could not complete an SSL/TLS handshake for ${inspection.host}: ${inspection.authorizationError ?? "no certificate"}`,
    });
    return issues;
  }

  if (!inspection.authorized) {
    issues.push({
      rule: "ssl-invalid",
      severity: "CRITICAL",
      message: `SSL certificate is not trusted for ${inspection.host}: ${inspection.authorizationError ?? "invalid certificate"}`,
    });
  }

  if (inspection.daysUntilExpiry !== null && inspection.daysUntilExpiry < 0) {
    issues.push({
      rule: "ssl-expired",
      severity: "CRITICAL",
      message: `SSL certificate for ${inspection.host} expired ${Math.abs(inspection.daysUntilExpiry)} day(s) ago`,
    });
  } else if (inspection.daysUntilExpiry !== null && inspection.daysUntilExpiry <= 14) {
    issues.push({
      rule: "ssl-expiring-soon",
      severity: "HIGH",
      message: `SSL certificate for ${inspection.host} expires in ${inspection.daysUntilExpiry} day(s)`,
    });
  } else if (inspection.daysUntilExpiry !== null && inspection.daysUntilExpiry <= 30) {
    issues.push({
      rule: "ssl-expiring",
      severity: "MEDIUM",
      message: `SSL certificate for ${inspection.host} expires in ${inspection.daysUntilExpiry} day(s)`,
    });
  }

  if (inspection.protocol && WEAK_PROTOCOLS.has(inspection.protocol)) {
    issues.push({
      rule: "tls-weak",
      severity: "HIGH",
      message: `Weak TLS protocol ${inspection.protocol} on ${inspection.host}`,
    });
  }

  if (inspection.schemeHttps && inspection.httpRedirectsToHttps === false) {
    issues.push({
      rule: "http-no-https-redirect",
      severity: "HIGH",
      message: `HTTP version of ${inspection.host} does not redirect to HTTPS`,
    });
  }

  return issues;
}

export function analyzeSecurity(options: {
  pageUrl: string;
  html: string;
  parsed: ParsedPage;
  headers: Record<string, string>;
  resourceUrls: string[];
  cookies?: Array<{ name: string; secure: boolean; httpOnly: boolean }>;
}): SecurityIssueFinding[] {
  const issues: SecurityIssueFinding[] = [];
  const isHttps = options.pageUrl.startsWith("https://");

  const headerMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.headers)) {
    headerMap[key.toLowerCase()] = value;
  }

  for (const check of HEADER_CHECKS) {
    if (check.name === "strict-transport-security" && !isHttps) continue;
    if (!headerMap[check.name]) {
      issues.push({
        rule: check.rule,
        severity: check.severity,
        message: `Missing security header: ${check.name}`,
      });
    }
  }

  for (const resource of options.resourceUrls) {
    if (isHttps && resource.startsWith("http://")) {
      issues.push({
        rule: "mixed-content",
        severity: "HIGH",
        message: `HTTPS page loads insecure HTTP resource: ${resource}`,
      });
    }
  }

  for (const form of options.parsed.forms) {
    if (form.action?.startsWith("http://") || (!isHttps && form.fields.some((field) => field.type === "password"))) {
      issues.push({
        rule: "insecure-form",
        severity: "HIGH",
        message: `Form submits over HTTP (${form.action ?? options.pageUrl})`,
      });
    }
  }

  if (isHttps) {
    for (const cookie of options.cookies ?? []) {
      if (!cookie.secure) {
        issues.push({
          rule: "insecure-cookie",
          severity: "MEDIUM",
          message: `Cookie "${cookie.name}" is missing the Secure flag on an HTTPS page`,
        });
      }
    }
  }

  for (const finding of looksLikeSecretInSource(options.html)) {
    issues.push({
      rule: "secret-in-source",
      severity: "CRITICAL",
      message: finding,
    });
  }

  return issues;
}

export {
  cachedInspectTls,
  inspectTlsHost,
  isHttpsOk,
  tlsCacheKey,
  type TlsHostResult,
  type TlsInspection,
} from "./tls.js";
