import { test, expect } from "@playwright/test";

test("dashboard loads as a command center and opens the existing scan form", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Start New Scan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

  await page.getByRole("link", { name: "+ Start New Scan" }).click();
  await expect(page).toHaveURL(/\/scans\/new/);
  await expect(page.getByLabel("Website URL")).toBeVisible();
});

test("dashboard renders real health or empty/error states at key viewports", async ({ page }) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(/Overall health|No scans yet|Unable to load dashboard data/)).toBeVisible({
      timeout: 15000,
    });
    await page.screenshot({
      path: `e2e-output/dashboard-${viewport.width}.png`,
      fullPage: true,
    });
  }
});

test("existing routes still render through the app shell", async ({ page }) => {
  const routes = [
    { path: "/scans", heading: "Scans" },
    { path: "/bugs", heading: "Bugs" },
    { path: "/reports", heading: "Reports" },
    { path: "/settings", heading: "Settings" },
    { path: "/scans/compare", heading: "Scan comparison" },
  ];
  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  }
});
