import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensurePlaywrightBrowsersPath } from "./playwright-env.js";

describe("ensurePlaywrightBrowsersPath", () => {
  const originalBrowsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const originalLocal = process.env.LOCALAPPDATA;
  const temps: string[] = [];

  afterEach(() => {
    if (originalBrowsers === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = originalBrowsers;
    if (originalLocal === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = originalLocal;
    for (const dir of temps.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeChromeTree(root: string): string {
    const browsers = path.join(root, "ms-playwright");
    const chromeDir = path.join(browsers, "chromium-1234", "chrome-win64");
    fs.mkdirSync(chromeDir, { recursive: true });
    fs.writeFileSync(path.join(chromeDir, "chrome.exe"), "");
    return browsers;
  }

  it("overrides a sandbox path that has no chrome.exe", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pw-env-"));
    temps.push(tmp);
    const sandbox = path.join(tmp, "sandbox");
    fs.mkdirSync(sandbox);
    const userRoot = path.join(tmp, "Local");
    const browsers = makeChromeTree(userRoot);
    process.env.PLAYWRIGHT_BROWSERS_PATH = sandbox;
    process.env.LOCALAPPDATA = userRoot;
    expect(ensurePlaywrightBrowsersPath()).toBe(browsers);
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(browsers);
  });

  it("keeps a PLAYWRIGHT_BROWSERS_PATH that already has Chromium", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pw-env-"));
    temps.push(tmp);
    const current = makeChromeTree(path.join(tmp, "current"));
    const unused = makeChromeTree(path.join(tmp, "unused"));
    process.env.PLAYWRIGHT_BROWSERS_PATH = current;
    process.env.LOCALAPPDATA = path.join(tmp, "unused");
    expect(ensurePlaywrightBrowsersPath()).toBe(current);
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(current);
    expect(unused).toContain("ms-playwright");
  });
});
