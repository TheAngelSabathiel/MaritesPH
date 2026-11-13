/**
 * Phase 7: business guides, Marites Freelancer pages (signed out), reminders cron security.
 * The tools themselves need an account; their logic is unit-tested (tax engine, tracker helpers).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("business guides live under /business and skip the work-schedule pages", async ({ page }) => {
  test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample fixture");
  await page.goto("/en/business");
  await page.getByRole("link", { name: /Sample Business Registration/ }).click();
  await expect(page).toHaveURL(/\/en\/business\/sample-business-registration$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sample Business Registration" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Business and freelancing" })).toBeVisible();
  await expect(page.getByText(/if you work 8 to 5/)).toHaveCount(0);
  // A business document isn't served under /ids, and IDs aren't served under /business.
  await page.goto("/en/ids/sample-business-registration");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/en/business/sample-id");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("freelancer hub is public; tools ask signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/en/freelancer");
  await expect(page.getByRole("heading", { level: 1, name: "Marites Freelancer" })).toBeVisible();
  await expect(page.getByText(/not professional tax advice/)).toBeVisible();
  for (const path of ["/en/freelancer/tracker", "/en/freelancer/tax", "/en/freelancer/calendar", "/en/freelancer/profile"]) {
    await page.goto(path);
    await expect(page.getByText("Sign in to use Marites Freelancer.", { exact: false })).toBeVisible();
  }
  await page.goto("/fil/freelancer");
  await expect(page.getByText(/hindi propesyonal na tax advice/)).toBeVisible();
});

test("the reminders cron refuses requests without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
});

test("the CPA page is hidden from signed-out visitors", async ({ page }) => {
  await page.goto("/en/cpa");
  await expect(page).toHaveURL(/\/en\/login$/);
});
