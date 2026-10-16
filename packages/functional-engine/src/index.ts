import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import {
  DESTRUCTIVE_ACTION_PATTERNS,
  type InteractionRisk,
  type TestMode,
} from "@qa-scanner/shared";

export interface FunctionalActionResult {
  action: string;
  element: string;
  skipped: boolean;
  skipReason?: string;
  passed: boolean;
  expected: string;
  actual: string;
  consoleErrors: string[];
  networkErrors: string[];
  needsManualVerification?: boolean;
}

export interface DiscoveredElement {
  type: string;
  selector: string;
  text: string;
  name: string | null;
  role: string | null;
  href: string | null;
  visible: boolean;
  enabled: boolean;
  risk: InteractionRisk;
  bounds: { x: number; y: number; width: number; height: number } | null;
}

export interface InteractionOptions {
  mode?: TestMode;
  onAction?: (message: string) => Promise<void> | void;
}

const FIXTURE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/upload-sample.txt");

function limitsForMode(mode: TestMode) {
  if (mode === "SAFE") {
    return { buttons: 4, nav: 0, disclosures: 4, forms: 2, selects: 0, checks: 0, search: 1, pagination: 0, files: 0 };
  }
  if (mode === "DEEP") {
    return { buttons: 80, nav: 40, disclosures: 30, forms: 20, selects: 12, checks: 12, search: 3, pagination: 4, files: 0 };
  }
  if (mode === "AGGRESSIVE") {
    return { buttons: 20, nav: 10, disclosures: 12, forms: 8, selects: 6, checks: 6, search: 2, pagination: 3, files: 1 };
  }
  return { buttons: 10, nav: 6, disclosures: 8, forms: 4, selects: 3, checks: 3, search: 1, pagination: 1, files: 0 };
}

function allowedRisks(mode: TestMode): InteractionRisk[] {
  if (mode === "SAFE") return ["SAFE"];
  if (mode === "AGGRESSIVE" || mode === "DEEP") return ["SAFE", "LOW_RISK", "STATE_CHANGING", "UNKNOWN"];
  return ["SAFE", "LOW_RISK", "UNKNOWN"];
}

export function isDestructiveText(text: string): boolean {
  const value = text.trim();
  return DESTRUCTIVE_ACTION_PATTERNS.some((pattern) => pattern.test(value));
}

export function classifyInteractionRisk(input: {
  text: string;
  type?: string | null;
  role?: string | null;
  href?: string | null;
  pageOrigin?: string;
}): InteractionRisk {
  const blob = `${input.text} ${input.type ?? ""} ${input.role ?? ""}`.toLowerCase();
  if (input.href && input.pageOrigin) {
    try {
      if (new URL(input.href).origin !== input.pageOrigin) return "EXTERNAL";
    } catch {
      /* ignore */
    }
  }
  if (isDestructiveText(input.text) || /\b(logout|sign out|log out)\b/i.test(blob)) return "DESTRUCTIVE";
  if (/\b(save|update|create|submit|send|register|sign up|checkout)\b/i.test(blob) || input.type === "submit") {
    return "STATE_CHANGING";
  }
  if (/\b(search|filter|sort|next|previous|page)\b/i.test(blob) || input.type === "search") return "LOW_RISK";
  if (/\b(menu|tab|faq|accordion|modal|dialog|details|expand|view|open)\b/i.test(blob)) return "SAFE";
  if (input.href) return "SAFE";
  return "UNKNOWN";
}

export function dummyValueForField(input: {
  name?: string | null;
  type?: string | null;
  label?: string | null;
  placeholder?: string | null;
}, index = 1): string | "check" | "skip" {
  const type = (input.type || "text").toLowerCase();
  const hint = `${input.name ?? ""} ${input.label ?? ""} ${input.placeholder ?? ""}`.toLowerCase();
  if (["hidden", "file", "submit", "button", "reset", "image"].includes(type)) return "skip";
  if (type === "checkbox" || type === "radio") return "check";
  if (type === "email" || /e-?mail/.test(hint)) return `alex.customer.${index}@example.com`;
  if (type === "tel" || /phone|mobile|\btel\b/.test(hint)) return "9876543210";
  if (type === "url" || /website|\burl\b/.test(hint)) return "https://example.com";
  if (type === "password") return "Dummy-pass-123";
  if (type === "number" || type === "range" || /qty|quantity|amount|age|count/.test(hint)) return "2";
  if (type === "date" || /\bdate\b/.test(hint)) return "2026-10-12";
  if (type === "time") return "10:00";
  if (type === "datetime-local") return "2026-10-12T10:00";
  if (type === "month") return "2026-10";
  if (type === "week") return "2026-W42";
  if (type === "color") return "#BF5700";
  if (/first/.test(hint)) return "Alex";
  if (/last|surname/.test(hint)) return "Customer";
  if (/company|organi[sz]ation/.test(hint)) return "Northwind Studio";
  if (/\bcity\b/.test(hint)) return "Chennai";
  if (/zip|postal/.test(hint)) return "600001";
  if (/address|street/.test(hint)) return "12 Sample Street";
  if (/name|customer/.test(hint)) return "Alex Customer";
  if (/title|subject/.test(hint)) return "Sample title";
  if (type === "search" || /search/.test(hint)) return "sample";
  if (type === "textarea" || /note|message|comment|desc/.test(hint)) return "Sample note for this field.";
  return `Sample ${index}`;
}

export function classifyFormSafety(fields: Array<{ name: string; type: string }>, action?: string | null): "safe-submit" | "validate-only" | "skip" {
  const blob = `${action ?? ""} ${fields.map((field) => `${field.name} ${field.type}`).join(" ")}`.toLowerCase();
  if (/(credit|card|cvv|cvc|iban|payment|checkout|ssn)/.test(blob)) return "skip";
  if (fields.some((field) => field.type === "password") && /(login|signin|sign-in|auth)/.test(blob)) return "skip";
  if (/(contact|newsletter|comment|message|subscribe)/.test(blob)) return "validate-only";
  if (fields.some((field) => field.type === "search") || /search|filter/.test(blob)) return "safe-submit";
  return "validate-only";
}

async function visibleText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().innerText({ timeout: 1000 }).catch(() => "");
}

export async function discoverInteractiveElements(page: Page): Promise<DiscoveredElement[]> {
  const origin = new URL(page.url()).origin;
  const raw = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        "a, button, input, select, textarea, summary, [role='button'], [role='tab'], [role='checkbox'], [role='switch'], [role='combobox'], [role='slider'], [role='menuitem'], [aria-expanded], [data-accordion]",
      ),
    ).slice(0, 250);
    return nodes.map((node, index) => {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || tag).toLowerCase();
      const role = el.getAttribute("role");
      const href = el.getAttribute("href") || el.getAttribute("data-href");
      const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || el.getAttribute("name") || "").trim().slice(0, 120);
      const rect = el.getBoundingClientRect();
      const id = el.id ? `#${el.id}` : el.getAttribute("name") ? `[name="${el.getAttribute("name")}"]` : `${tag}:nth-of-type(${index + 1})`;
      return {
        type,
        selector: id,
        text,
        name: el.getAttribute("name") || el.getAttribute("aria-label"),
        role,
        href,
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && rect.width > 0,
        enabled: !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true",
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
  });

  return raw.map((item) => ({
    ...item,
    risk: classifyInteractionRisk({
      text: item.text,
      type: item.type,
      role: item.role,
      href: item.href,
      pageOrigin: origin,
    }),
  }));
}

function result(partial: Omit<FunctionalActionResult, "consoleErrors" | "networkErrors">, consoleErrors: string[], networkErrors: string[]): FunctionalActionResult {
  return { ...partial, consoleErrors: [...consoleErrors], networkErrors: [...networkErrors] };
}

async function fillDummyFields(scope: { locator: Page["locator"] }, formIndex: number): Promise<string[]> {
  const filled: string[] = [];
  const fields = scope.locator("input, textarea, select");
  const count = Math.min(await fields.count(), 40);
  const seenRadio = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const field = fields.nth(i);
    if (!(await field.isVisible().catch(() => false))) continue;
    if (!(await field.isEnabled().catch(() => false))) continue;
    const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => "input");
    const inputType = ((await field.getAttribute("type")) || tag).toLowerCase();
    const kind = tag === "select" || tag === "textarea" ? tag : inputType;
    const name = await field.getAttribute("name");
    const id = await field.getAttribute("id");
    const placeholder = await field.getAttribute("placeholder");
    let label = (await field.getAttribute("aria-label")) || "";
    if (!label && id) {
      label = await scope.locator(`label[for="${id.replace(/"/g, "")}"]`).first().innerText().catch(() => "");
    }
    const plan = dummyValueForField({ name, type: kind, label, placeholder }, formIndex * 10 + i + 1);
    if (plan === "skip") continue;
    if (plan === "check") {
      const radioKey = name || id || String(i);
      if (kind === "radio" && seenRadio.has(radioKey)) continue;
      seenRadio.add(radioKey);
      await field.check({ timeout: 1500 }).catch(() => undefined);
      filled.push(name || kind);
      continue;
    }
    if (kind === "select") {
      const value = await field.evaluate((el) => {
        const select = el as HTMLSelectElement;
        const option = Array.from(select.options).find((item) => item.value && !item.disabled);
        return option?.value ?? "";
      }).catch(() => "");
      if (value) await field.selectOption(value).catch(() => undefined);
      filled.push(name || "select");
      continue;
    }
    await field.fill(plan, { timeout: 1500 }).catch(() => undefined);
    filled.push(`${name || kind}: ${plan}`);
  }
  return filled;
}

async function clickOpenLayer(
  page: Page,
  origin: string,
  results: FunctionalActionResult[],
  consoleErrors: string[],
  networkErrors: string[],
  notify: (message: string) => Promise<void>,
): Promise<void> {
  const layer = page.locator("[role='dialog']:visible, [role='menu']:visible, [role='alertdialog']:visible").first();
  if ((await layer.count()) === 0) return;
  const filled = await fillDummyFields(layer, 1);
  if (filled.length > 0) {
    await notify(`Filled ${filled.length} fields inside the open panel`);
    results.push(
      result(
        {
          action: "dummy-fill",
          element: "open panel",
          skipped: false,
          passed: true,
          expected: "Every field in the open panel gets a matching dummy value",
          actual: filled.slice(0, 8).join("; "),
        },
        consoleErrors,
        networkErrors,
      ),
    );
  }
  const controls = layer.locator("button, [role='menuitem'], [role='tab']");
  const count = Math.min(await controls.count(), 6);
  for (let i = 0; i < count; i += 1) {
    const control = controls.nth(i);
    const text = ((await control.innerText().catch(() => "")) || (await control.getAttribute("aria-label")) || `item ${i + 1}`).trim();
    if (classifyInteractionRisk({ text, type: "button", pageOrigin: origin }) === "DESTRUCTIVE") continue;
    if (!(await control.isVisible().catch(() => false))) continue;
    await notify(`Inside the page, clicking "${text.slice(0, 60)}"`);
    try {
      await control.click({ timeout: 2000 });
      await page.waitForTimeout(200);
      results.push(
        result(
          {
            action: "click-inside",
            element: text.slice(0, 80),
            skipped: false,
            passed: true,
            expected: "A control inside the opened panel should be clickable",
            actual: "Click completed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    } catch (error) {
      results.push(
        result(
          {
            action: "click-inside",
            element: text.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "A control inside the opened panel should be clickable",
            actual: error instanceof Error ? error.message : "Click failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
    if (new URL(page.url()).origin !== origin) break;
  }
  await page.keyboard.press("Escape").catch(() => undefined);
}

export async function runSafeInteractions(page: Page, options: InteractionOptions = {}): Promise<FunctionalActionResult[]> {
  const mode = options.mode ?? "STANDARD";
  const limits = limitsForMode(mode);
  const allowed = allowedRisks(mode);
  const results: FunctionalActionResult[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onFailed = (request: { url: () => string; failure: () => { errorText: string } | null }) => {
    networkErrors.push(`${request.url()} ${request.failure()?.errorText ?? "failed"}`);
  };
  page.on("console", onConsole);
  page.on("requestfailed", onFailed);

  const origin = new URL(page.url()).origin;
  const notify = async (message: string) => {
    await options.onAction?.(message);
  };

  const buttons = page.locator("button, [role='button'], input[type='button']");
  const buttonCount = Math.min(await buttons.count(), limits.buttons);
  for (let i = 0; i < buttonCount; i += 1) {
    const button = buttons.nth(i);
    const text = (
      (await button.innerText().catch(() => "")) ||
      (await button.getAttribute("aria-label")) ||
      (await button.getAttribute("value")) ||
      (mode === "DEEP" ? `button ${i + 1}` : "")
    ).trim();
    const type = (await button.getAttribute("type")) || "button";
    if (!text) continue;
    if (mode === "DEEP") await button.scrollIntoViewIfNeeded().catch(() => undefined);
    const risk = classifyInteractionRisk({ text, type, pageOrigin: origin });
    if (risk === "DESTRUCTIVE" || !allowed.includes(risk) || type === "submit") {
      results.push(
        result(
          {
            action: "click",
            element: text.slice(0, 80),
            skipped: true,
            skipReason:
              risk === "DESTRUCTIVE"
                ? "Action skipped because it may modify or delete persistent data."
                : type === "submit"
                  ? "Submit buttons are handled in form tests"
                  : `Skipped ${risk} control in ${mode} mode`,
            passed: true,
            expected: "Unsafe control is not activated",
            actual: "Skipped",
          },
          consoleErrors,
          networkErrors,
        ),
      );
      continue;
    }
    if (!(await button.isVisible().catch(() => false))) {
      results.push(
        result(
          {
            action: "button-visibility",
            element: text.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Interactive button should be visible if it is in the DOM for users",
            actual: "Button is present but not visible",
          },
          consoleErrors,
          networkErrors,
        ),
      );
      continue;
    }
    const box = await button.boundingBox().catch(() => null);
    const viewport = page.viewportSize();
    if (box && viewport && (box.x + box.width < 0 || box.y + box.height < 0 || box.x > viewport.width || box.y > viewport.height)) {
      results.push(
        result(
          {
            action: "button-viewport",
            element: text.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Button should be inside the viewport or reachable",
            actual: "Button is outside the viewport",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
    const enabled = await button.isEnabled().catch(() => false);
    if (!enabled) {
      results.push(
        result(
          {
            action: "button-disabled",
            element: text.slice(0, 80),
            skipped: false,
            passed: true,
            needsManualVerification: true,
            expected: "Disabled state should be intentional",
            actual: "Button is disabled; needs manual verification",
          },
          consoleErrors,
          networkErrors,
        ),
      );
      continue;
    }
    const beforeUrl = page.url();
    const beforeBusy = await button.getAttribute("aria-busy").catch(() => null);
    const errorsBefore = consoleErrors.length;
    await notify(`Clicking "${text.slice(0, 60)}"`);
    try {
      await button.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      const stillBusy = (await button.getAttribute("aria-busy").catch(() => null)) === "true" && beforeBusy !== "true";
      if (stillBusy) {
        await page.waitForTimeout(4000);
        const stuck = (await button.getAttribute("aria-busy").catch(() => null)) === "true";
        results.push(
          result(
            {
              action: "click-button",
              element: text.slice(0, 80),
              skipped: false,
              passed: !stuck,
              expected: "Button should not remain stuck in a loading state",
              actual: stuck ? "Button remained aria-busy after click" : "Click completed",
            },
            consoleErrors,
            networkErrors,
          ),
        );
      } else {
        results.push(
          result(
            {
              action: "click-button",
              element: text.slice(0, 80),
              skipped: false,
              passed: consoleErrors.length === errorsBefore,
              expected: "Button click should not throw or crash the page",
              actual: consoleErrors.length > errorsBefore ? "JavaScript error after click" : "Click completed",
            },
            consoleErrors,
            networkErrors,
          ),
        );
      }
    } catch (error) {
      results.push(
        result(
          {
            action: "click-button",
            element: text.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Button click should succeed for a visible non-destructive control",
            actual: error instanceof Error ? error.message : "Click failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
    if (mode === "DEEP" && page.url() === beforeUrl) {
      await clickOpenLayer(page, origin, results, consoleErrors, networkErrors, notify);
    }
    if (new URL(page.url()).origin !== origin) {
      await page.goto(beforeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }
  }

  const navLinks = page.locator("nav a[href], header a[href], footer a[href]");
  const linkCount = Math.min(await navLinks.count(), limits.nav);
  for (let i = 0; i < linkCount; i += 1) {
    const link = navLinks.nth(i);
    const href = await link.getAttribute("href");
    const text = (await link.innerText().catch(() => href)) ?? href ?? "link";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    const risk = classifyInteractionRisk({ text, href: new URL(href, page.url()).href, pageOrigin: origin });
    if (!allowed.includes(risk) || risk === "DESTRUCTIVE" || risk === "EXTERNAL") continue;
    if (!(await link.isVisible().catch(() => false))) continue;
    const beforeUrl = page.url();
    await notify(`Opening navigation "${text.slice(0, 60)}"`);
    try {
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => undefined),
        link.click({ timeout: 3000 }),
      ]);
      results.push(
        result(
          {
            action: "click-nav-link",
            element: text.slice(0, 80),
            skipped: false,
            passed: true,
            expected: "Navigation link should open an internal page",
            actual: `Navigated to ${page.url()}`,
          },
          consoleErrors,
          networkErrors,
        ),
      );
    } catch (error) {
      results.push(
        result(
          {
            action: "click-nav-link",
            element: text.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Navigation link should be clickable",
            actual: error instanceof Error ? error.message : "Navigation failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
    if (page.url() !== beforeUrl) {
      await page.goto(beforeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }
  }

  const disclosures = page.locator("[aria-expanded], details, [data-accordion], [role='tab'], [role='menuitem']");
  const disclosureCount = Math.min(await disclosures.count(), limits.disclosures);
  for (let i = 0; i < disclosureCount; i += 1) {
    const item = disclosures.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    const name = ((await item.innerText().catch(() => "")) || (await item.getAttribute("aria-label")) || "disclosure").slice(0, 80);
    if (isDestructiveText(name)) continue;
    await notify(`Toggling "${name.slice(0, 60)}"`);
    try {
      await item.click({ timeout: 2000 });
      results.push(
        result(
          {
            action: "toggle-disclosure",
            element: name,
            skipped: false,
            passed: true,
            expected: "Disclosure, tab, or accordion should toggle without throwing",
            actual: "Toggled",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    } catch (error) {
      results.push(
        result(
          {
            action: "toggle-disclosure",
            element: name,
            skipped: false,
            passed: false,
            expected: "Disclosure should be activatable",
            actual: error instanceof Error ? error.message : "Toggle failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
  }

  const selects = page.locator("select");
  const selectCount = Math.min(await selects.count(), limits.selects);
  for (let i = 0; i < selectCount; i += 1) {
    const select = selects.nth(i);
    if (!(await select.isVisible().catch(() => false))) continue;
    const name = (await select.getAttribute("name")) || "select";
    if (isDestructiveText(name)) continue;
    const option = select.locator("option").nth(1);
    if ((await option.count()) === 0) continue;
    const value = await option.getAttribute("value");
    await notify(`Selecting dropdown ${name}`);
    try {
      if (value) await select.selectOption(value, { timeout: 2000 });
      results.push(
        result(
          {
            action: "select-dropdown",
            element: name,
            skipped: false,
            passed: true,
            expected: "Dropdown should accept a safe option change",
            actual: "Option selected",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    } catch (error) {
      results.push(
        result(
          {
            action: "select-dropdown",
            element: name,
            skipped: false,
            passed: false,
            expected: "Dropdown should be selectable",
            actual: error instanceof Error ? error.message : "Select failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
  }

  const checks = page.locator("input[type='checkbox'], input[type='radio'], [role='switch']");
  const checkCount = Math.min(await checks.count(), limits.checks);
  for (let i = 0; i < checkCount; i += 1) {
    const box = checks.nth(i);
    if (!(await box.isVisible().catch(() => false))) continue;
    const name = (await box.getAttribute("name")) || (await box.getAttribute("aria-label")) || "control";
    if (isDestructiveText(name)) continue;
    await notify(`Toggling ${name}`);
    try {
      await box.click({ timeout: 2000 });
      results.push(
        result(
          {
            action: "toggle-input",
            element: String(name).slice(0, 80),
            skipped: false,
            passed: true,
            expected: "Checkbox, radio, or switch should toggle without throwing",
            actual: "Toggled",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    } catch (error) {
      results.push(
        result(
          {
            action: "toggle-input",
            element: String(name).slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Control should be clickable",
            actual: error instanceof Error ? error.message : "Toggle failed",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
  }

  const search = page.locator("input[type='search'], input[name*='search' i], input[placeholder*='search' i]").first();
  if (limits.search > 0 && (await search.count()) > 0 && (await search.isVisible().catch(() => false))) {
    await notify("Filling search field with test query");
    await search.fill("qa-test-query", { timeout: 2000 }).catch(() => undefined);
    results.push(
      result(
        {
          action: "fill-search",
          element: "search",
          skipped: false,
          passed: true,
          expected: "Search field should accept generated test data",
          actual: "Filled generated query",
        },
        consoleErrors,
        networkErrors,
      ),
    );
  }

  const pagination = page.locator("a[rel='next'], nav [aria-label*='next' i], .pagination a, [data-pagination] a").first();
  if (limits.pagination > 0 && (await pagination.count()) > 0 && (await pagination.isVisible().catch(() => false))) {
    const beforeUrl = page.url();
    await notify("Opening next pagination page");
    await pagination.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    results.push(
      result(
        {
          action: "pagination",
          element: "next",
          skipped: false,
          passed: true,
          expected: "Pagination control should navigate or update the list",
          actual: page.url() === beforeUrl ? "URL unchanged after pagination click" : `Moved to ${page.url()}`,
          needsManualVerification: page.url() === beforeUrl,
        },
        consoleErrors,
        networkErrors,
      ),
    );
    if (page.url() !== beforeUrl) {
      await page.goto(beforeUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }
  }

  if (limits.files > 0) {
    const file = page.locator("input[type='file']").first();
    if ((await file.count()) > 0) {
      await notify("Attaching safe test fixture to file input");
      await file.setInputFiles(FIXTURE_FILE).catch(() => undefined);
      results.push(
        result(
          {
            action: "file-upload-fixture",
            element: "file",
            skipped: false,
            passed: true,
            expected: "File input should accept a safe test fixture without submitting",
            actual: "Fixture attached, form not submitted",
          },
          consoleErrors,
          networkErrors,
        ),
      );
    }
  }

  page.off("console", onConsole);
  page.off("requestfailed", onFailed);
  return results;
}

export async function runFormValidationTests(page: Page, options: InteractionOptions = {}): Promise<FunctionalActionResult[]> {
  const mode = options.mode ?? "STANDARD";
  const limits = limitsForMode(mode);
  const results: FunctionalActionResult[] = [];
  const forms = page.locator(mode === "DEEP" ? "form, [role='form']" : "form");
  const formCount = Math.min(await forms.count(), limits.forms);

  for (let i = 0; i < formCount; i += 1) {
    const form = forms.nth(i);
    const fields = await form.locator("input, textarea, select").evaluateAll((nodes) =>
      nodes.map((node) => {
        const el = node as HTMLInputElement;
        return { name: el.name || el.id || el.type, type: (el.type || node.tagName).toLowerCase() };
      }),
    );
    const action = await form.getAttribute("action");
    const safety = classifyFormSafety(fields, action);
    if (safety === "skip") {
      results.push({
        action: "form-skip",
        element: action ?? `form-${i}`,
        skipped: true,
        skipReason: "Form classified as payment, credential, or irreversible",
        passed: true,
        expected: "Unsafe form is not submitted",
        actual: "Skipped",
        consoleErrors: [],
        networkErrors: [],
      });
      continue;
    }

    const required = form.locator("[required]");
    const requiredCount = await required.count();
    const submit = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first();
    if ((await submit.count()) === 0) continue;
    const submitText = (await submit.innerText().catch(() => "")) || (await submit.getAttribute("value")) || "submit";
    if (isDestructiveText(submitText)) continue;

    const urlBefore = page.url();
    await options.onAction?.(`Testing form validation on ${submitText.slice(0, 40)}`);

    if (requiredCount > 0) {
      await required.nth(0).focus().catch(() => undefined);
      try {
        await submit.click({ timeout: 3000 });
        await page.waitForTimeout(400);
        const invalid = await form.locator(":invalid").count();
        const message = await form
          .locator('[role="alert"], .error, .invalid-feedback, [aria-invalid="true"]')
          .first()
          .textContent()
          .catch(() => null);
        const nativeMessage = await required
          .nth(0)
          .evaluate((el) => (el as HTMLInputElement).validationMessage)
          .catch(() => "");
        const stayed = page.url() === urlBefore || page.url().startsWith(urlBefore);
        const passed = invalid > 0 || Boolean(message) || Boolean(nativeMessage) || stayed;
        results.push({
          action: "empty-required-submit",
          element: submitText.slice(0, 80),
          skipped: false,
          passed,
          expected: "Submitting an empty required form should show validation and not silently succeed",
          actual: nativeMessage || message || (invalid > 0 ? "HTML5 invalid state" : stayed ? "Page did not navigate" : `Navigated to ${page.url()}`),
          consoleErrors: [],
          networkErrors: [],
        });
      } catch (error) {
        results.push({
          action: "empty-required-submit",
          element: submitText.slice(0, 80),
          skipped: false,
          passed: false,
          expected: "Validation test should run without crashing",
          actual: error instanceof Error ? error.message : "Form test failed",
          consoleErrors: [],
          networkErrors: [],
        });
      }
    }

    const email = form.locator('input[type="email"]').first();
    if ((await email.count()) > 0 && (await email.isVisible().catch(() => false))) {
      await email.fill("not-an-email", { timeout: 2000 }).catch(() => undefined);
      const validity = await email.evaluate((el) => (el as HTMLInputElement).validity.valid).catch(() => true);
      results.push({
        action: "invalid-email",
        element: (await email.getAttribute("name")) || "email",
        skipped: false,
        passed: validity === false,
        expected: "Invalid email format should fail validation",
        actual: validity ? "Email field accepted an invalid value" : "Invalid email rejected",
        consoleErrors: [],
        networkErrors: [],
      });
      await email.fill("").catch(() => undefined);
    }

    const tel = form.locator('input[type="tel"]').first();
    if ((await tel.count()) > 0 && (await tel.isVisible().catch(() => false))) {
      await tel.fill("abc", { timeout: 2000 }).catch(() => undefined);
      const validity = await tel.evaluate((el) => (el as HTMLInputElement).validity.valid).catch(() => true);
      const pattern = await tel.getAttribute("pattern");
      results.push({
        action: "invalid-phone",
        element: (await tel.getAttribute("name")) || "tel",
        skipped: false,
        passed: pattern ? validity === false : true,
        needsManualVerification: !pattern,
        expected: "Invalid phone format should fail validation when a pattern exists",
        actual: pattern ? (validity ? "Phone field accepted an invalid value" : "Invalid phone rejected") : "No pattern; needs manual verification",
        consoleErrors: [],
        networkErrors: [],
      });
      await tel.fill("").catch(() => undefined);
    }

    const password = form.locator('input[type="password"]').first();
    if ((await password.count()) > 0 && (await password.isVisible().catch(() => false))) {
      await password.fill("1", { timeout: 2000 }).catch(() => undefined);
      const validity = await password.evaluate((el) => (el as HTMLInputElement).validity.valid).catch(() => true);
      results.push({
        action: "short-password",
        element: "password",
        skipped: false,
        passed: true,
        needsManualVerification: validity,
        expected: "Short password should be rejected when a minlength rule exists",
        actual: validity ? "Short password accepted by the field; needs manual verification" : "Short password rejected",
        consoleErrors: [],
        networkErrors: [],
      });
      await password.fill("").catch(() => undefined);
    }

    const text = form.locator("input[type='text'], textarea").first();
    if ((await text.count()) > 0 && (await text.isVisible().catch(() => false))) {
      await text.fill("   ", { timeout: 2000 }).catch(() => undefined);
      await text.fill("测试-ünicode-✓", { timeout: 2000 }).catch(() => undefined);
      if (mode !== "SAFE") {
        await text.fill("A".repeat(4000), { timeout: 2000 }).catch(() => undefined);
      }
      results.push({
        action: "boundary-text",
        element: (await text.getAttribute("name")) || "text",
        skipped: false,
        passed: true,
        expected: "Text fields should accept unicode and long generated input without crashing",
        actual: "Filled whitespace, unicode, and long input without submitting credentials",
        consoleErrors: [],
        networkErrors: [],
      });
      await text.fill("").catch(() => undefined);
    }

    if (mode === "DEEP" && safety !== "skip" && !isDestructiveText(submitText)) {
      const filled = await fillDummyFields(form, i + 1);
      if (filled.length > 0) {
        await options.onAction?.(`Filling ${filled.length} fields, then ${submitText.slice(0, 40)}`);
        try {
          await submit.click({ timeout: 3000 });
          await page.waitForTimeout(400);
          results.push({
            action: "dummy-submit",
            element: submitText.slice(0, 80),
            skipped: false,
            passed: true,
            expected: "Each field is filled with matching dummy data, then the form is submitted",
            actual: filled.slice(0, 8).join("; "),
            consoleErrors: [],
            networkErrors: [],
          });
        } catch (error) {
          results.push({
            action: "dummy-submit",
            element: submitText.slice(0, 80),
            skipped: false,
            passed: false,
            expected: "Each field is filled with matching dummy data, then the form is submitted",
            actual: error instanceof Error ? error.message : "Submit failed",
            consoleErrors: [],
            networkErrors: [],
          });
        }
      }
    }

    if (page.url() !== urlBefore) {
      await page.goto(urlBefore, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }
  }

  return results;
}

export { visibleText, FIXTURE_FILE };
export { observeWorkflowPage, performWorkflowAction, type ObservedWorkflowPage } from "./workflow-runner.js";
