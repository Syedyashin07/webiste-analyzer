import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function userBrowsersDir(): string {
  if (process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "ms-playwright");
  }
  return path.join(os.homedir(), "AppData", "Local", "ms-playwright");
}

function hasChromium(root: string | undefined): boolean {
  if (!root) return false;
  try {
    if (!fs.existsSync(root)) return false;
    for (const name of fs.readdirSync(root)) {
      if (!name.startsWith("chromium")) continue;
      const win64 = path.join(root, name, "chrome-win64", "chrome.exe");
      const win = path.join(root, name, "chrome-win", "chrome.exe");
      if (fs.existsSync(win64) || fs.existsSync(win)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Cursor sets PLAYWRIGHT_BROWSERS_PATH to a sandbox cache that has no browsers. Prefer the user's install. */
export function ensurePlaywrightBrowsersPath(): string | undefined {
  const current = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (hasChromium(current)) return current;
  const userDir = userBrowsersDir();
  if (hasChromium(userDir)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = userDir;
    return userDir;
  }
  return current;
}

ensurePlaywrightBrowsersPath();
