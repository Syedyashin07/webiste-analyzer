import { describe, expect, it } from "vitest";
import { analyzeSecurity, analyzeTls, isHttpsOk, type TlsInspection } from "./index.js";
import type { ParsedPage } from "@qa-scanner/parser";

function emptyParsed(): ParsedPage {
  return {
    title: "x",
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    language: "en",
    headings: [],
    links: [],
    images: [],
    forms: [],
    scripts: [],
    stylesheets: [],
    iframes: [],
    htmlSize: 10,
  };
}

function tls(overrides: Partial<TlsInspection> = {}): TlsInspection {
  return {
    pageUrl: "https://example.com/",
    schemeHttps: true,
    host: "example.com",
    port: 443,
    connected: true,
    authorized: true,
    authorizationError: null,
    protocol: "TLSv1.3",
    cipher: "TLS_AES_256_GCM_SHA384",
    validFrom: "Aug 1 00:00:00 2026 GMT",
    validTo: "Nov 1 00:00:00 2026 GMT",
    daysUntilExpiry: 60,
    subjectCn: "example.com",
    issuer: "Let's Encrypt",
    fingerprint256: "AA:BB",
    httpRedirectsToHttps: true,
    ...overrides,
  };
}

describe("HTTPS/SSL analysis", () => {
  it("flags a page that is not HTTPS", () => {
    const issues = analyzeTls(tls({ pageUrl: "http://example.com/", schemeHttps: false }));
    expect(issues.some((item) => item.rule === "https-missing" && item.severity === "CRITICAL")).toBe(true);
  });

  it("flags an untrusted SSL certificate", () => {
    const issues = analyzeTls(
      tls({ authorized: false, authorizationError: "self signed certificate" }),
    );
    expect(issues.some((item) => item.rule === "ssl-invalid" && item.severity === "CRITICAL")).toBe(true);
  });

  it("flags an expired certificate", () => {
    const issues = analyzeTls(tls({ daysUntilExpiry: -3 }));
    expect(issues.some((item) => item.rule === "ssl-expired")).toBe(true);
  });

  it("flags a certificate expiring within 14 days", () => {
    const issues = analyzeTls(tls({ daysUntilExpiry: 7 }));
    expect(issues.some((item) => item.rule === "ssl-expiring-soon")).toBe(true);
  });

  it("flags a weak TLS protocol", () => {
    const issues = analyzeTls(tls({ protocol: "TLSv1.1" }));
    expect(issues.some((item) => item.rule === "tls-weak")).toBe(true);
  });

  it("flags HTTP that does not redirect to HTTPS", () => {
    const issues = analyzeTls(tls({ httpRedirectsToHttps: false }));
    expect(issues.some((item) => item.rule === "http-no-https-redirect")).toBe(true);
  });

  it("treats a valid HTTPS page as ok", () => {
    const inspection = tls();
    expect(isHttpsOk(inspection)).toBe(true);
    expect(analyzeTls(inspection)).toEqual([]);
  });

  it("does not mark HTTP pages as ok", () => {
    expect(isHttpsOk(tls({ schemeHttps: false, pageUrl: "http://example.com/" }))).toBe(false);
  });
});

describe("analyzeSecurity", () => {
  it("flags mixed content and insecure cookies without duplicating HTTPS-missing", () => {
    const issues = analyzeSecurity({
      pageUrl: "https://example.com/",
      html: "<html></html>",
      parsed: emptyParsed(),
      headers: {},
      resourceUrls: ["http://cdn.example.com/app.js"],
      cookies: [{ name: "session", secure: false, httpOnly: true }],
    });
    expect(issues.some((item) => item.rule === "https-missing")).toBe(false);
    expect(issues.some((item) => item.rule === "mixed-content")).toBe(true);
    expect(issues.some((item) => item.rule === "insecure-cookie")).toBe(true);
  });
});
