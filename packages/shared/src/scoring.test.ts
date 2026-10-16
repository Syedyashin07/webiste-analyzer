import { describe, expect, it } from "vitest";
import { calculateHealthScore } from "./scoring.js";

describe("health scoring", () => {
  it("returns 100 when there are no issues", () => {
    const result = calculateHealthScore([]);
    expect(result.overall).toBe(100);
    expect(result.performance).toBe(100);
  });

  it("deducts more for critical than low", () => {
    const critical = calculateHealthScore([{ category: "technical", severity: "CRITICAL" }]);
    const low = calculateHealthScore([{ category: "technical", severity: "LOW" }]);
    expect(critical.technical).toBeLessThan(low.technical);
    expect(critical.overall).toBeLessThan(low.overall);
  });

  it("clamps at zero", () => {
    const result = calculateHealthScore(
      Array.from({ length: 20 }, () => ({ category: "security" as const, severity: "CRITICAL" as const })),
    );
    expect(result.security).toBe(0);
  });
});
