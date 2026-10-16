import { describe, expect, it } from "vitest";
import { createScanSchema } from "./schemas.js";
import { isHttpUrl } from "./url.js";

describe("scan input validation", () => {
  it("accepts a normal https url payload", () => {
    const parsed = createScanSchema.parse({ url: "https://example.com", maxPages: 20, maxDepth: 2 });
    expect(parsed.url).toBe("https://example.com");
  });

  it("rejects empty urls", () => {
    expect(() => createScanSchema.parse({ url: "" })).toThrow();
  });

  it("rejects non-http protocols", () => {
    expect(() => createScanSchema.parse({ url: "ftp://example.com" })).toThrow();
  });

  it("only treats http(s) as scanable protocols", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("file:///c:/windows")).toBe(false);
  });

  it("requires both login username and password", () => {
    expect(() =>
      createScanSchema.parse({ url: "https://example.com", loginUsername: "user@test.com" }),
    ).toThrow();
    const parsed = createScanSchema.parse({
      url: "https://example.com",
      loginUsername: "user@test.com",
      loginPassword: "secret",
      loginUrl: "/login",
    });
    expect(parsed.loginUsername).toBe("user@test.com");
    expect(parsed.loginUrl).toBe("/login");
  });

  it("keeps a site name when one is sent", () => {
    expect(createScanSchema.parse({ url: "https://example.com", name: "  distropak  " }).name).toBe("distropak");
  });

  it("accepts landing, full, or screenshot coverage", () => {
    expect(createScanSchema.parse({ url: "https://example.com", coverage: "LANDING" }).coverage).toBe("LANDING");
    expect(createScanSchema.parse({ url: "https://example.com", coverage: "FULL" }).coverage).toBe("FULL");
    expect(createScanSchema.parse({ url: "https://example.com", coverage: "SCREENSHOTS" }).coverage).toBe("SCREENSHOTS");
  });
});
