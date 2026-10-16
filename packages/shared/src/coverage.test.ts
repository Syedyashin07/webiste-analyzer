import { describe, expect, it } from "vitest";
import { coverageFromLimits, coverageLabel, coverageLimits, resolveScanCoverage } from "./coverage.js";

describe("scan coverage", () => {
  it("limits landing page checks to one page and no crawl depth", () => {
    expect(coverageLimits("LANDING", { maxPages: 100, maxDepth: 5 }, { maxPages: 100, maxDepth: 5 })).toEqual({
      maxPages: 1,
      maxDepth: 0,
    });
  });

  it("keeps full-site limits", () => {
    expect(coverageLimits("FULL", { maxPages: 40, maxDepth: 3 }, { maxPages: 100, maxDepth: 5 })).toEqual({
      maxPages: 40,
      maxDepth: 3,
    });
  });

  it("labels stored limits", () => {
    expect(coverageFromLimits(1, 0)).toBe("LANDING");
    expect(coverageLabel("FULL")).toBe("Full website (end to end)");
    expect(coverageLabel("SCREENSHOTS")).toBe("Screenshot every page");
    expect(coverageLabel("INSIDE")).toBe("Inside every page");
    expect(coverageLabel("WORKFLOW")).toBe("Autonomous workflow");
  });

  it("uses settings limits for inside-every-page and screenshot tours", () => {
    expect(coverageLimits("INSIDE", { maxPages: 40, maxDepth: 3 }, { maxPages: 100, maxDepth: 5 })).toEqual({
      maxPages: 100,
      maxDepth: 5,
    });
    expect(coverageLimits("SCREENSHOTS", { maxPages: 40, maxDepth: 3 }, { maxPages: 100, maxDepth: 5 })).toEqual({
      maxPages: 100,
      maxDepth: 5,
    });
  });

  it("prefers stored coverage over inferred limits", () => {
    expect(resolveScanCoverage({ coverage: "SCREENSHOTS", maxPages: 1, maxDepth: 0 })).toBe("SCREENSHOTS");
    expect(resolveScanCoverage({ maxPages: 1, maxDepth: 0 })).toBe("LANDING");
  });
});
