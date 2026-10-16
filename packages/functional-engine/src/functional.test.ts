import { describe, expect, it } from "vitest";
import { classifyFormSafety, classifyInteractionRisk, dummyValueForField, isDestructiveText } from "./index.js";

describe("functional safety", () => {
  it("skips destructive controls", () => {
    expect(isDestructiveText("Delete account")).toBe(true);
    expect(isDestructiveText("Place order")).toBe(true);
    expect(isDestructiveText("Learn more")).toBe(false);
  });

  it("classifies payment forms as skip", () => {
    expect(classifyFormSafety([{ name: "card", type: "text" }], "/checkout")).toBe("skip");
  });

  it("classifies contact forms as validate-only", () => {
    expect(classifyFormSafety([{ name: "message", type: "textarea" }], "/contact")).toBe("validate-only");
  });

  it("picks dummy values from the field type and name", () => {
    expect(dummyValueForField({ name: "email", type: "email" }, 1)).toBe("alex.customer.1@example.com");
    expect(dummyValueForField({ name: "phone", type: "tel" })).toBe("9876543210");
    expect(dummyValueForField({ name: "customerName", type: "text" })).toBe("Alex Customer");
    expect(dummyValueForField({ name: "city", type: "text" })).toBe("Chennai");
    expect(dummyValueForField({ name: "notes", type: "textarea" })).toBe("Sample note for this field.");
    expect(dummyValueForField({ type: "checkbox" })).toBe("check");
    expect(dummyValueForField({ type: "hidden" })).toBe("skip");
    expect(dummyValueForField({ type: "password" })).toBe("Dummy-pass-123");
  });

  it("classifies interaction risk", () => {
    expect(classifyInteractionRisk({ text: "Delete account" })).toBe("DESTRUCTIVE");
    expect(classifyInteractionRisk({ text: "Open FAQ" })).toBe("SAFE");
    expect(classifyInteractionRisk({ text: "Search" })).toBe("LOW_RISK");
    expect(classifyInteractionRisk({ text: "Docs", href: "https://other.test/x", pageOrigin: "https://example.com" })).toBe("EXTERNAL");
  });
});
