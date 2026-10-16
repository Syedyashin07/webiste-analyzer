import { describe, expect, it } from "vitest";
import { canonicalizeUrl, isInternalLink, normalizeUrl } from "./url.js";

describe("url normalization", () => {
  it("removes fragments and default ports", () => {
    expect(normalizeUrl("https://Example.com:443/about/#top")).toBe("https://example.com/about");
  });

  it("keeps the origin slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("handles trailing slashes", () => {
    expect(normalizeUrl("https://example.com/about/")).toBe("https://example.com/about");
  });

  it("resolves relative links", () => {
    expect(normalizeUrl("/pricing", "https://example.com/home")).toBe("https://example.com/pricing");
  });

  it("detects internal links", () => {
    expect(isInternalLink("/about", "https://example.com")).toBe(true);
    expect(isInternalLink("https://other.test/a", "https://example.com")).toBe(false);
  });

  it("canonicalizes hostname case", () => {
    expect(canonicalizeUrl(new URL("HTTPS://EXAMPLE.COM/A"))).toBe("https://example.com/A");
  });

  it("strips tracking parameters", () => {
    expect(normalizeUrl("https://example.com/about?utm_source=ads&ref=1")).toBe("https://example.com/about?ref=1");
  });
});
