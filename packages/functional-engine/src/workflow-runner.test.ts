import "@qa-scanner/browser/playwright-env";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { observeWorkflowPage, performWorkflowAction } from "./workflow-runner.js";

const separateFields = `<!doctype html><body>
  <div><input placeholder="Customer name"></div>
  <div><input type="email" placeholder="Email"></div>
  <button type="submit">Save</button>
</body>`;

const closedForm = `<!doctype html><body>
  <button id="add">Add customer</button>
  <div id="dialog" role="dialog" hidden>
    <form>
      <label>Name <input id="customer-name" type="text"></label>
      <label>Email <input id="customer-email" type="email"></label>
      <button type="submit">Save</button>
    </form>
  </div>
  <script>
    document.getElementById("add").addEventListener("click", () => {
      document.getElementById("dialog").hidden = false;
    });
  </script>
</body>`;

describe("workflow field entry", () => {
  it("types into each real field when inputs are not siblings", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setContent(separateFields);
      const observed = await observeWorkflowPage(page);
      expect(observed.fields).toHaveLength(2);
      expect(observed.fields.every((field) => field.selector.startsWith("[data-qa-workflow="))).toBe(true);
      const name = observed.fields[0];
      const email = observed.fields[1];
      expect(name && email).toBeTruthy();
      await performWorkflowAction(page, {
        type: "fill",
        selector: name!.selector,
        value: "Riley Customer",
        expected: "Name is entered",
        reason: "Observed name field",
      });
      await performWorkflowAction(page, {
        type: "fill",
        selector: email!.selector,
        value: "riley.customer.7@example.com",
        expected: "Email is entered",
        reason: "Observed email field",
      });
      const values = await page.locator("input").evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value));
      expect(values).toEqual(["Riley Customer", "riley.customer.7@example.com"]);
    } finally {
      await browser.close();
    }
  });

  it("opens a closed form before looking for its fields", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setContent(closedForm);
      const closed = await observeWorkflowPage(page);
      expect(closed.fields).toHaveLength(0);
      expect(closed.opener?.text).toContain("Add customer");
      await performWorkflowAction(page, {
        type: "click",
        selector: closed.opener!.selector,
        expected: "Form opens",
        reason: "Add customer",
      });
      const opened = await observeWorkflowPage(page);
      expect(opened.fields.map((field) => field.type)).toEqual(["text", "email"]);
      expect(opened.submit?.text).toContain("Save");
    } finally {
      await browser.close();
    }
  });

  it("collects the required field, ignores the optional one, and moves to the next page", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.setContent(`<!doctype html><body>
        <div id="step1">
          <label>Customer name * <input name="customer-name"></label>
          <label>Notes <input name="notes"></label>
          <button id="next" type="button">Next</button>
        </div>
        <div id="step2" hidden>
          <label>Phone * <input name="phone" type="tel"></label>
          <button type="submit">Save</button>
        </div>
        <script>
          document.getElementById("next").addEventListener("click", () => {
            document.getElementById("step1").hidden = true;
            document.getElementById("step2").hidden = false;
          });
        </script>
      </body>`);
      const first = await observeWorkflowPage(page);
      const required = first.fields.filter((field) => field.required);
      expect(required.map((field) => field.name)).toEqual(["customer-name"]);
      expect(first.forward?.text).toBe("Next");
      await performWorkflowAction(page, {
        type: "fill",
        selector: required[0]!.selector,
        value: "Riley Customer",
        expected: "Required name is entered",
        reason: "Required field: Customer name",
      });
      await performWorkflowAction(page, {
        type: "click",
        selector: first.forward!.selector,
        expected: "The next page opens",
        reason: "Next",
      });
      const second = await observeWorkflowPage(page);
      expect(second.fields.filter((field) => field.required).map((field) => field.name)).toEqual(["phone"]);
      expect(second.forward).toBeNull();
      expect(second.submit?.text).toBe("Save");
    } finally {
      await browser.close();
    }
  });
});
