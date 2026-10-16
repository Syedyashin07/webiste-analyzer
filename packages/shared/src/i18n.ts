export const strings = {
  appName: "Website Analyzer",
  recommendations: {
    BROKEN_LINK: "Update or remove the broken URL, or restore the destination resource.",
    BROKEN_IMAGE: "Fix the image source or replace the missing asset.",
    JAVASCRIPT: "Inspect the stack trace, guard undefined values, and retest the affected pages.",
    NETWORK: "Fix the failing API or resource, then use Fast replay to confirm it returns a successful status.",
    ACCESSIBILITY: "Add meaningful names, labels, and alternative text for assistive technology.",
    SEO: "Add or correct title, meta description, headings, and canonical/robots metadata.",
    PERFORMANCE: "Reduce oversized assets, limit blocking scripts, and improve load timing.",
    SECURITY: "Serve every page over HTTPS with a valid SSL certificate, and add missing security headers. Do not attempt exploits.",
    FUNCTIONAL: "Restore the expected interactive behavior and retest the user flow.",
    VISUAL: "Fix overflow, clipping, and layout issues across the reported viewports.",
    TECHNICAL: "Resolve the technical error and confirm the page loads successfully.",
    missingAlt: "Add meaningful alternative text.",
    missingTitle: "Add a unique, descriptive document title.",
    missingLabel: "Associate a visible label with each form control.",
  },
} as const;
