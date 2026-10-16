import { describe, expect, it } from "vitest";
import { pageFlowName, pageScreenshotCaption, screenshotFileName, uniqueScreenshotCaptions } from "./page-flow.js";

describe("page screenshot flow names", () => {
  it("names login then dashboard then listings", () => {
    expect(pageFlowName("https://app.example.com/login", "Sign in")).toBe("Login");
    expect(pageScreenshotCaption("https://app.example.com/dashboard")).toBe("Dashboard screenshot");
    expect(pageFlowName("https://app.example.com/jobs")).toBe("Listings");
    expect(pageFlowName("https://app.example.com/register", "Create account")).toBe("Register");
  });

  it("numbers duplicate names in visit order", () => {
    const steps = uniqueScreenshotCaptions([
      { id: "1", url: "https://app.example.com/login", title: "Login" },
      { id: "2", url: "https://app.example.com/dashboard", title: "Home" },
      { id: "3", url: "https://app.example.com/listings", title: "Jobs" },
      { id: "4", url: "https://app.example.com/jobs/open", title: "Open jobs" },
    ]);
    expect(steps.map((step) => step.caption)).toEqual([
      "Login screenshot",
      "Dashboard screenshot",
      "Listings screenshot",
      "Listings 2 screenshot",
    ]);
    expect(steps.map((step) => step.step)).toEqual([1, 2, 3, 4]);
    expect(steps.map((step) => screenshotFileName(step.flowName))).toEqual(["login", "dashboard", "listings", "listings-2"]);
  });
});
