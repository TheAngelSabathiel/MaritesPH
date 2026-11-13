/** Phase 10: CPA directory, profiles, sign-in for quotes, account pages. */
import { expect, test } from "@playwright/test";

const SAMPLE = "f0000000-0000-4000-8000-0000000000e2";

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("directory lists verified professionals and filters by service", async ({ page }) => {
  test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample fixture");
  await page.goto("/en/cpas");
  await expect(page.getByText(/isn't part of your engagement/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sample Santos, CPA" })).toBeVisible();
  await page.getByLabel("Service").selectOption("payroll");
  await expect(page.getByRole("link", { name: "Sample Santos, CPA" })).toHaveCount(0);
  await page.getByLabel("Service").selectOption("tax_filing");
  await page.getByRole("link", { name: "Sample Santos, CPA" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/cpas/${SAMPLE}$`));
  // Next keeps the previous (directory) page hidden in the DOM after client navigation; check the profile on its own.
  await page.reload();
  await expect(page.getByText("PRC license no. 0000001")).toBeVisible();
  await expect(page.getByText("Starts at ₱1,500")).toBeVisible();
  await expect(page.getByText("Sign in to request a quote.")).toBeVisible();
  // Contact email is never on the public page.
  await expect(page.getByText("sample.cpa@example.test")).toHaveCount(0);
});

test("unknown or unverified profiles are not found; account pages need sign-in", async ({ page }) => {
  await page.goto("/en/cpas/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  for (const path of ["/en/account/quotes", "/en/account/listing"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/login$/);
  }
});
