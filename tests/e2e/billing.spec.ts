/**
 * Phase 8: plans page, sign-in requirements, and webhook security.
 * The paid flow itself (signed webhook → entitlement) is checked against a
 * running server with scripts/paymongo-webhook-smoke.mjs (README §13).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("plans show prices from the database; buying asks signed-out visitors to sign in", async ({ page }) => {
  test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample fixture");
  await page.goto("/en/pricing");
  await expect(page.getByRole("heading", { name: "Marites Freelancer" })).toBeVisible();
  await expect(page.getByText("₱199 / month")).toBeVisible();
  await expect(page.getByText("₱499 / month")).toBeVisible();
  await expect(page.getByText("No automatic charges", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Pay with PayMongo" }).first().click();
  await expect(page).toHaveURL(/\/en\/login\?next=/);
});

test("billing needs an account; freelancer tools still ask signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/en/account/billing");
  await expect(page).toHaveURL(/\/en\/login$/);
  await page.goto("/en/freelancer/tax");
  await expect(page.getByText("Sign in to use Marites Freelancer.", { exact: false })).toBeVisible();
});

test("Marites Negosyo asks signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/en/negosyo");
  await expect(page.getByRole("heading", { level: 1, name: "Marites Negosyo" })).toBeVisible();
  await expect(page.getByText("Sign in to use Marites Negosyo.", { exact: false })).toBeVisible();
  await expect(page.getByText(/doesn't remit contributions or file for you/)).toBeVisible();
  await page.goto("/fil/negosyo/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Mag-sign in para magamit ang Marites Negosyo.", { exact: false })).toBeVisible();
});

test("the PayMongo webhook rejects unsigned and forged requests", async ({ request }) => {
  const body = JSON.stringify({ data: { id: "evt_forged", attributes: { type: "checkout_session.payment.paid", livemode: false, data: { id: "cs_x", attributes: { reference_number: "00000000-0000-4000-8000-000000000000" } } } } });
  expect((await request.post("/api/webhooks/paymongo", { data: body, headers: { "content-type": "application/json" } })).status()).toBe(401);
  const forged = await request.post("/api/webhooks/paymongo", { data: body, headers: { "content-type": "application/json", "paymongo-signature": `t=${Math.floor(Date.now() / 1000)},te=${"a".repeat(64)},li=` } });
  expect(forged.status()).toBe(401);
});
