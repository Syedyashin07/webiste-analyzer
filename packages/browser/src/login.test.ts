import "./playwright-env.js";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { signInToSite } from "./login.js";

const TWO_STEP_HTML = `<!DOCTYPE html>
<html>
  <body>
    <form id="f">
      <input id="email" type="email" />
      <button type="button" id="next">Next</button>
      <input id="password" type="password" hidden />
      <button type="submit" id="go" hidden>Sign in</button>
    </form>
    <script>
      document.getElementById("next").onclick = function () {
        document.getElementById("password").hidden = false;
        document.getElementById("go").hidden = false;
      };
      document.getElementById("f").onsubmit = function (event) {
        event.preventDefault();
        var email = document.getElementById("email").value;
        var password = document.getElementById("password").value;
        if (email === "user@test.com" && password === "secret") {
          history.replaceState({}, "", "/dashboard");
          document.body.innerHTML = "<h1>Inside</h1>";
        }
      };
    </script>
  </body>
</html>`;

describe("signInToSite", () => {
  it("clicks Next then enters the password and reaches the inside page", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("**/*", async (route) => {
        await route.fulfill({ status: 200, contentType: "text/html", body: TWO_STEP_HTML });
      });
      const result = await signInToSite(page, {
        startUrl: "https://example.com/",
        username: "user@test.com",
        password: "secret",
        loginUrl: "https://example.com/login",
        timeoutMs: 15000,
      });
      expect(result.ok).toBe(true);
      expect(await page.locator("h1").innerText()).toBe("Inside");
    } finally {
      await browser.close();
    }
  }, 45_000);
});
