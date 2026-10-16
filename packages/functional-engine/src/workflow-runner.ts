import type { Page } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPageAdvance, type ObservedControl, type ObservedField, type WorkflowAction } from "@qa-scanner/shared";

const FIXTURE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/upload-sample.txt");

export interface ObservedWorkflowPage {
  fields: ObservedField[];
  controls: ObservedControl[];
  formAction: string | null;
  submit: ObservedControl | null;
  forward: ObservedControl | null;
  opener: ObservedControl | null;
}

export async function observeWorkflowPage(page: Page): Promise<ObservedWorkflowPage> {
  const raw = await page.evaluate(() => {
    const isVisible = (el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    document.querySelectorAll("[data-qa-workflow]").forEach((node) => node.removeAttribute("data-qa-workflow"));

    const dialog = Array.from(document.querySelectorAll("[role='dialog'], [role='alertdialog'], dialog[open]")).find((node) =>
      isVisible(node as HTMLElement),
    ) as HTMLElement | undefined;
    const forms = Array.from(document.querySelectorAll("form"));
    const dataFieldCount = (root: ParentNode) =>
      Array.from(root.querySelectorAll("input, textarea, select")).filter((node) => {
        const el = node as HTMLInputElement;
        const type = (el.getAttribute("type") || el.tagName).toLowerCase();
        const hint = `${el.getAttribute("name") ?? ""} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
        if (["hidden", "submit", "button", "reset", "image", "search"].includes(type)) return false;
        if (/\bsearch\b/.test(hint)) return false;
        return isVisible(el) && !el.disabled;
      }).length;

    let root: ParentNode = document;
    let formAction: string | null = null;
    if (dialog) {
      root = dialog;
      formAction = dialog.querySelector("form")?.getAttribute("action") ?? null;
    } else {
      const best = forms.slice().sort((left, right) => dataFieldCount(right) - dataFieldCount(left))[0];
      if (best && dataFieldCount(best) > 0) {
        root = best;
        formAction = best.getAttribute("action");
      }
    }

    const fields = Array.from(root.querySelectorAll("input, textarea, select")).slice(0, 40).flatMap((node) => {
      const el = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || tag).toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) return [];
      if (!isVisible(el) || el.disabled) return [];
      const name = el.getAttribute("name");
      const placeholder = el.getAttribute("placeholder");
      const aria = el.getAttribute("aria-label");
      const labelFor = el.id ? document.querySelector(`label[for="${el.id.replace(/"/g, "")}"]`) : null;
      const wrapped = el.closest("label");
      const rawLabel = (labelFor?.textContent || wrapped?.textContent || aria || placeholder || name || type || "").trim().replace(/\s+/g, " ");
      const label = rawLabel.replace(/\*/g, "").trim().slice(0, 120);
      if (type === "search" || /\bsearch\b/i.test(`${name ?? ""} ${placeholder ?? ""} ${aria ?? ""} ${label}`)) return [];
      const mark = `field-${document.querySelectorAll("[data-qa-workflow^='field-']").length}`;
      el.setAttribute("data-qa-workflow", mark);
      const options = tag === "select"
        ? Array.from((el as HTMLSelectElement).options).map((option) => option.value).filter((value) => value && !value.startsWith("Select"))
        : [];
      return [{
        selector: `[data-qa-workflow="${mark}"]`,
        name,
        type,
        label,
        required: Boolean(el.required || el.getAttribute("aria-required") === "true" || rawLabel.includes("*")),
        maxLength: "maxLength" in el && el.maxLength > 0 ? el.maxLength : undefined,
        options,
      }];
    });

    const buttons = Array.from(root.querySelectorAll("button, input[type='submit'], [role='button']")).slice(0, 30).flatMap((node) => {
      const el = node as HTMLElement;
      if (!isVisible(el)) return [];
      const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim().replace(/\s+/g, " ").slice(0, 120);
      const mark = `control-${document.querySelectorAll("[data-qa-workflow^='control-']").length}`;
      el.setAttribute("data-qa-workflow", mark);
      return [{
        selector: `[data-qa-workflow="${mark}"]`,
        text,
        type: (el.getAttribute("type") || el.tagName).toLowerCase(),
        href: el.getAttribute("href"),
      }];
    });

    let opener: { selector: string; text: string; type: string; href: string | null } | null = null;
    if (fields.length < 2) {
      const candidate = Array.from(document.querySelectorAll("button, [role='button'], a")).find((node) => {
        const el = node as HTMLElement;
        if (!isVisible(el)) return false;
        const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim();
        if (!/\b(add|new|create)\b/i.test(text)) return false;
        if (/payment|card|checkout|delete|remove|logout|log out|sign out|cancel/i.test(text)) return false;
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          if (/^https?:/i.test(href)) {
            try {
              if (new URL(href).origin !== location.origin) return false;
            } catch {
              return false;
            }
          }
        }
        return true;
      }) as HTMLElement | undefined;
      if (candidate) {
        const existing = candidate.getAttribute("data-qa-workflow");
        const mark = existing || "control-open";
        if (!existing) candidate.setAttribute("data-qa-workflow", mark);
        opener = {
          selector: `[data-qa-workflow="${mark}"]`,
          text: (candidate.innerText || candidate.getAttribute("aria-label") || "Open form").trim().replace(/\s+/g, " ").slice(0, 120),
          type: (candidate.getAttribute("type") || candidate.tagName).toLowerCase(),
          href: candidate.getAttribute("href"),
        };
      }
    }

    if (fields.length > 0) {
      const extras = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']")).filter((node) => {
        const el = node as HTMLElement;
        if (!isVisible(el) || el.getAttribute("data-qa-workflow")) return false;
        const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim();
        return text.length > 0 && text.length <= 40 && /\b(next|continue|proceed|save|submit|finish|done|create)\b/i.test(text);
      }).slice(0, 4);
      for (const node of extras) {
        const el = node as HTMLElement;
        const mark = `control-${document.querySelectorAll("[data-qa-workflow^='control-']").length}`;
        el.setAttribute("data-qa-workflow", mark);
        buttons.push({
          selector: `[data-qa-workflow="${mark}"]`,
          text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim().replace(/\s+/g, " ").slice(0, 120),
          type: (el.getAttribute("type") || el.tagName).toLowerCase(),
          href: el.getAttribute("href"),
        });
      }
    }

    return { formAction, fields, buttons, opener };
  });

  const controls: ObservedControl[] = raw.buttons.map((button) => ({
    selector: button.selector,
    text: button.text,
    type: button.type,
    href: button.href,
    risk: "UNKNOWN",
  }));
  const forward = controls.find((control) => isPageAdvance(control, "forward")) ?? null;
  const submit = raw.fields.length > 0 ? controls.find((control) => isPageAdvance(control, "finish")) ?? null : null;
  const opener = raw.opener
    ? { selector: raw.opener.selector, text: raw.opener.text, type: raw.opener.type, href: raw.opener.href, risk: "SAFE" as const }
    : null;
  return {
    fields: raw.fields,
    controls,
    formAction: raw.formAction,
    submit,
    forward,
    opener,
  };
}

export async function performWorkflowAction(page: Page, action: WorkflowAction): Promise<{ ok: boolean; observed: string }> {
  const target = page.locator(action.selector).first();
  const visible = await target.isVisible().catch(() => false);
  if (!visible) return { ok: false, observed: "Target was not visible" };
  try {
    await target.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
    if (action.type === "fill" || action.type === "assert-text") {
      if (action.type === "fill") {
        const value = action.value ?? "";
        await target.click({ timeout: 2000 });
        await target.fill("");
        if (value) await target.pressSequentially(value, { delay: 40 });
        const actual = await target.inputValue().catch(() => value);
        if (value && actual !== value) await target.fill(value, { timeout: 2000 });
      }
      return { ok: true, observed: action.type === "fill" ? "Field filled" : (await target.innerText().catch(() => "")).slice(0, 180) };
    }
    if (action.type === "select") {
      const chosen = action.value ?? "";
      const selected = await target.selectOption(chosen, { timeout: 2000 }).then(() => true).catch(() => false);
      if (!selected) {
        const fallback = await target.evaluate((el) => {
          const select = el as HTMLSelectElement;
          const option = Array.from(select.options).find((item) => item.value && !item.disabled && !item.value.toLowerCase().startsWith("select"));
          return option?.value ?? "";
        }).catch(() => "");
        if (!fallback) return { ok: false, observed: "No option to select" };
        await target.selectOption(fallback, { timeout: 2000 });
      }
      return { ok: true, observed: "Option selected" };
    }
    if (action.type === "check") {
      await target.check({ timeout: 2000 });
      return { ok: true, observed: "Choice selected" };
    }
    if (action.type === "upload-fixture") {
      await target.setInputFiles(FIXTURE_FILE);
      return { ok: true, observed: "Text fixture attached" };
    }
    if (action.type === "wait") {
      await page.waitForTimeout(400);
      return { ok: true, observed: page.url() };
    }
    if (action.type === "assert-url") {
      const ok = page.url().includes(action.value ?? "");
      return { ok, observed: page.url() };
    }
    const before = page.url();
    await target.click({ timeout: 3000 });
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    await page.waitForTimeout(400);
    const text = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 240);
    return { ok: true, observed: page.url() === before ? text || "Clicked with no navigation" : page.url() };
  } catch (error) {
    return { ok: false, observed: error instanceof Error ? error.message : "Action failed" };
  }
}
