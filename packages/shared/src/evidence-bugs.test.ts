import { describe, expect, it } from "vitest";
import { isDetailedEvidenceBug } from "./evidence-bugs.js";

describe("detailed evidence bugs", () => {
  it("keeps broken links, keyword gaps, failed APIs, wrong data, and broken buttons", () => {
    expect(isDetailedEvidenceBug({ category: "BROKEN_LINK", title: "Broken link: /pricing" })).toBe(true);
    expect(isDetailedEvidenceBug({ category: "BROKEN_IMAGE", title: "Broken image: /logo.png" })).toBe(true);
    expect(isDetailedEvidenceBug({ category: "NETWORK", title: "API failed: POST /api/orders" })).toBe(true);
    expect(isDetailedEvidenceBug({ category: "SEO", rule: "title-missing", title: "Document title is missing" })).toBe(true);
    expect(isDetailedEvidenceBug({ category: "SEO", title: "SEO: Page has no H1" })).toBe(true);
    expect(
      isDetailedEvidenceBug({
        category: "FUNCTIONAL",
        title: "Functional failure: click-button Save customer",
      }),
    ).toBe(true);
    expect(
      isDetailedEvidenceBug({
        category: "FUNCTIONAL",
        title: "Functional failure: invalid-email Email",
      }),
    ).toBe(true);
  });

  it("drops repeated checklist findings and login-screen probes", () => {
    expect(
      isDetailedEvidenceBug({
        category: "SECURITY",
        rule: "csp-missing",
        title: "SECURITY: Missing security header: content-security-policy",
      }),
    ).toBe(false);
    expect(
      isDetailedEvidenceBug({
        category: "ACCESSIBILITY",
        title: "ACCESSIBILITY: Low color contrast ratio 1:1 on a",
      }),
    ).toBe(false);
    expect(
      isDetailedEvidenceBug({
        category: "ACCESSIBILITY",
        title: 'ACCESSIBILITY: Form control "email" has no associated label',
      }),
    ).toBe(false);
    expect(isDetailedEvidenceBug({ category: "SEO", rule: "meta-description-missing", title: "Meta description is missing" })).toBe(
      false,
    );
    expect(isDetailedEvidenceBug({ category: "SEO", rule: "canonical-missing", title: "Canonical URL is missing" })).toBe(false);
    expect(
      isDetailedEvidenceBug({
        category: "FUNCTIONAL",
        title: "Functional failure: click-button Sign in with Google",
      }),
    ).toBe(false);
    expect(
      isDetailedEvidenceBug({
        category: "FUNCTIONAL",
        title: "Functional failure: empty-required-submit Log in",
      }),
    ).toBe(false);
    expect(isDetailedEvidenceBug({ category: "NETWORK", title: "Network failure: GET /font.woff" })).toBe(false);
  });
});
