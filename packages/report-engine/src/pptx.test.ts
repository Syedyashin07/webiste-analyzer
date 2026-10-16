import Jimp from "jimp";
import { describe, expect, it } from "vitest";
import { buildScanPpt, PPT_TEMPLATES } from "./pptx.js";

describe("buildScanPpt", () => {
  it("puts three screens on a slide and keeps every screen", async () => {
    const png = await new Jimp(8, 8, 0xc4621aff).getBufferAsync(Jimp.MIME_PNG);
    const shots = [1, 2, 3, 4].map((step) => ({
      name: `Page ${step}`,
      url: `https://example.com/${step}`,
      png,
    }));
    const file = await buildScanPpt({
      presenterName: "Asha Raman",
      companyName: "Northwind Studio",
      siteName: "xyz",
      website: "https://example.com",
      coverageLabel: "Screenshot every page",
      completedAt: "2026-10-12T00:00:00.000Z",
      pagesScanned: 4,
      pagesDiscovered: 4,
      issuesFound: 0,
      template: "split",
      scores: [],
      pages: shots.map((shot) => ({ name: shot.name, url: shot.url })),
      shots,
      bugs: [],
    });
    const slides = new Set(file.toString("latin1").match(/ppt\/slides\/slide\d+\.xml/g) ?? []);
    expect(slides.size).toBe(4);
    expect(PPT_TEMPLATES).toHaveLength(4);
  });
});