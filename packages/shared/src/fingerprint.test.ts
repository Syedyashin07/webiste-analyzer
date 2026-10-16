import { describe, expect, it } from "vitest";
import { groupedJsFingerprint, makeFingerprint, normalizeErrorSignature } from "./fingerprint.js";

describe("deduplication fingerprints", () => {
  it("groups the same TypeError across pages", () => {
    const a = groupedJsFingerprint("TypeError: Cannot read properties of undefined https://a.test/app.js:12");
    const b = groupedJsFingerprint("TypeError: Cannot read properties of undefined https://b.test/app.js:99");
    expect(a).toBe(b);
  });

  it("keeps distinct issue signatures separate", () => {
    const link = makeFingerprint({ category: "BROKEN_LINK", signature: "https://example.com/missing" });
    const image = makeFingerprint({ category: "BROKEN_IMAGE", signature: "https://example.com/missing" });
    expect(link).not.toBe(image);
  });

  it("normalizes noisy error text", () => {
    expect(normalizeErrorSignature("failed 123 at https://x.test/a")).toBe("failed <n> at <url>");
  });
});
