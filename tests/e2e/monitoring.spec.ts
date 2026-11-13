/**
 * Phase 6: "Ano'ng Bago?" feed and Bantay Batas endpoint security.
 * Feed checks need the sample fixture (E2E_SAMPLE_DATA=1).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("feed shows approved changes and published issuances only, with topic filters", async ({ page }) => {
  test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample fixture");
  await page.goto("/en/ano-ng-bago");
  await expect(page.getByText("Sample ID processing time updated to up to 5 days.")).toBeVisible();
  await expect(page.getByText("Sample Advisory No. 7: Sample ID processing")).toBeVisible();
  await expect(page.getByText("UNPUBLISHED SAMPLE ISSUANCE, MUST NOT APPEAR")).toHaveCount(0);
  await expect(page.getByText("OPEN SAMPLE PROPOSAL, MUST NOT APPEAR")).toHaveCount(0);

  await page.getByRole("button", { name: "Tax" }).click();
  await expect(page.getByText(/Wala pang bagong chika dito/)).toBeVisible();
  await page.getByRole("button", { name: "IDs" }).click();
  await page.getByRole("link", { name: "See the updated guide" }).click();
  await expect(page).toHaveURL(/\/en\/ids\/sample-id$/);
});

test("the monitoring cron endpoint refuses requests without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/monitor")).status()).toBe(401);
  expect((await request.get("/api/cron/monitor", { headers: { authorization: "Bearer wrong-secret-value-123" } })).status()).toBe(401);
});
