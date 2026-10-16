import type { Page } from "playwright";

export interface SiteLoginOptions {
  startUrl: string;
  username: string;
  password: string;
  loginUrl?: string | null;
  timeoutMs: number;
}

export interface SiteLoginResult {
  ok: boolean;
  finalUrl: string;
  message: string;
}

const USER_SELECTORS = [
  "#username",
  'input[type="email"]',
  'input[name="email" i]',
  'input[name="username" i]',
  'input[id="username" i]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[placeholder*="email" i]',
  'input[placeholder*="user" i]',
  'input[type="text"]',
].join(", ");

export function looksLikeLoginUrl(url: string): boolean {
  try {
    return /\/(login|signin|sign-in|auth\/login)\b/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function loginPageUrl(startUrl: string, loginUrl?: string | null): string {
  if (loginUrl && /^https?:\/\//i.test(loginUrl)) return loginUrl;
  const origin = new URL(startUrl).origin;
  if (loginUrl?.startsWith("/")) return `${origin}${loginUrl}`;
  return `${origin}/login`;
}

async function clickNamedButton(page: Page, pattern: RegExp): Promise<boolean> {
  const button = page.getByRole("button", { name: pattern });
  if ((await button.count()) === 0) return false;
  const first = button.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  await first.click({ timeout: 5000 });
  return true;
}

async function openLoginForm(page: Page): Promise<void> {
  const password = page.locator('input[type="password"]');
  if (await password.first().isVisible().catch(() => false)) return;

  const signIn = page.getByRole("link", { name: /sign in|log in|login/i });
  if ((await signIn.count()) > 0 && (await signIn.first().isVisible().catch(() => false))) {
    await signIn.first().click({ timeout: 5000 });
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

export async function signInToSite(page: Page, options: SiteLoginOptions): Promise<SiteLoginResult> {
  const timeoutMs = Math.max(options.timeoutMs, 15000);
  const target = loginPageUrl(options.startUrl, options.loginUrl);
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await openLoginForm(page);
  const userField = page.locator(USER_SELECTORS).first();
  await userField.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(1200);
  await userField.fill(options.username, { timeout: 5000 });

  const passwordField = page.locator('#password, input[type="password"]').first();
  if (!(await passwordField.isVisible().catch(() => false))) {
    const advanced =
      (await clickNamedButton(page, /^(next|continue|advance)$/i)) ||
      (await clickNamedButton(page, /next|continue|advance/i));
    if (!advanced) await userField.press("Enter");
    await passwordField.waitFor({ state: "visible", timeout: timeoutMs });
  }

  await passwordField.fill(options.password, { timeout: 5000 });
  const submitted =
    (await clickNamedButton(page, /sign in|log in|login|submit/i)) ||
    (await clickNamedButton(page, /continue|next/i));
  if (!submitted) await passwordField.press("Enter");

  await page
    .waitForURL((url) => !/\/login|\/signin|\/sign-in/i.test(url.pathname), { timeout: timeoutMs })
    .catch(() => undefined);
  await page.waitForTimeout(800);

  const stillOnLogin = /\/login|\/signin|\/sign-in/i.test(new URL(page.url()).pathname);
  const passwordStillVisible = await passwordField.isVisible().catch(() => false);
  const errorText = (
    (await page.locator('[role="alert"], .error, .text-red-500, .text-red-600, .text-red-700').first().innerText().catch(() => "")) || ""
  ).trim();

  if (stillOnLogin && passwordStillVisible) {
    return {
      ok: false,
      finalUrl: page.url(),
      message: errorText || "Login did not succeed. Check username and password.",
    };
  }

  return {
    ok: true,
    finalUrl: page.url(),
    message: `Signed in, now inside ${page.url()}`,
  };
}
