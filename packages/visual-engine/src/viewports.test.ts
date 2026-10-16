import { describe, expect, it } from "vitest";
import { screenshotViewportsFor, viewportsForMode } from "./index.js";

describe("screenshot viewports", () => {
  it("captures one desktop shot per page for the screenshot tour", () => {
    expect(screenshotViewportsFor("SCREENSHOTS", "ALL")).toEqual(["DESKTOP"]);
    expect(screenshotViewportsFor("FULL", "ALL")).toEqual(["DESKTOP", "TABLET", "MOBILE"]);
  });

  it("keeps a single viewport when screenshots are not in all-modes", () => {
    expect(screenshotViewportsFor("FULL", "DESKTOP")).toEqual(viewportsForMode("DESKTOP"));
    expect(screenshotViewportsFor("LANDING", "MOBILE")).toEqual(viewportsForMode("MOBILE"));
  });
});
