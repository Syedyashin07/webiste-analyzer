import { describe, expect, it } from "vitest";
import { resolveStorageKey, scanFileKey } from "./storage.js";

describe("scan file storage keys", () => {
  it("builds a safe relative key", () => {
    expect(scanFileKey("screenshots", "scan-1", "page.png")).toBe("screenshots/scan-1/page.png");
  });

  it("strips path characters from file names", () => {
    expect(scanFileKey("reports", "scan-1", "../evil.pdf")).toBe("reports/scan-1/.._evil.pdf");
  });

  it("rejects path traversal keys", () => {
    expect(() => resolveStorageKey("../secrets.png")).toThrow(/Invalid storage key|Path traversal/);
  });
});
