/**
 * "Ano'ng Lakad Mo?" wizard, "Mga Diskarte", situation pages, and personal
 * pages (Phase 4). Needs the sample fixture (E2E_SAMPLE_DATA=1). Runs on the
 * phone project only; it also checks the results screen fits at 360px.
 */
import { expect, test } from "@playwright/test";
import { layoutProblems } from "./layout";

test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample data fixture (E2E_SAMPLE_DATA=1)");
test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("wizard builds a plan from a guide link, with a recommendation and steps", async ({ page }) => {
  await page.goto("/en/lakad?goal=sample-id");
  await expect(page.locator('form[data-ready="true"]')).toHaveCount(1); // wizard hydrated (one instance)
  // Goal came from the link, so the wizard starts at "what do you have".
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("I work 8 to 5, Monday to Friday")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("City").selectOption({ label: "Sample City" });
  await page.getByRole("button", { name: "Show my options" }).click();

  await expect(page.getByRole("heading", { name: "Mga Diskarte" })).toBeVisible();
  await expect(page.getByText("Recommended ni Marites").first()).toBeVisible();
  await expect(page.getByText("Get your Sample ID").first()).toBeVisible();
  await expect(page.getByText(/Also prepare: .*Sample supporting document A/).first()).toBeVisible();
  await expect(page.getByText(/during your free time/).first()).toBeVisible();

  const layout = await layoutProblems(page);
  expect(layout.overflow, "results overflow at 360px").toEqual([]);
  expect(layout.smallTargets, "results tap targets").toEqual([]);

  // Saving needs an account.
  await page.getByRole("button", { name: "Save this plan" }).click();
  await expect(page.getByRole("link", { name: "Sign in to save this plan" })).toBeVisible();

  await page.getByRole("button", { name: "Change my answers" }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
});

test("a purpose goal is already satisfied by a document the person has", async ({ page }) => {
  await page.goto("/en/lakad");
  await expect(page.locator('form[data-ready="true"]')).toHaveCount(1); // wizard hydrated (one instance)
  await page.getByLabel("Something to use it for").check();
  await page.getByLabel("I need an ID for").selectOption({ label: "Opening a bank account" });
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Sample ID").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Show my options" }).click();
  await expect(page.getByText(/you already have what you need/)).toBeVisible();
});

test("the wizard asks before moving on, and works in Filipino", async ({ page }) => {
  await page.goto("/fil/lakad");
  await expect(page.locator('form[data-ready="true"]')).toHaveCount(1); // wizard hydrated (one instance)
  await page.getByRole("button", { name: "Susunod" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Pakisagot muna ito." })).toBeVisible();
});

test("situation page shows a generated plan and links to the wizard", async ({ page }) => {
  await page.goto("/en/ids/sample-id/for-8-to-5-workers");
  await expect(page.getByRole("heading", { level: 1, name: "How to get a Sample ID if you work 8 to 5" })).toBeVisible();
  await expect(page.getByText("Recommended ni Marites").first()).toBeVisible();
  await page.getByRole("link", { name: "Make my own plan" }).click();
  await expect(page).toHaveURL(/\/en\/lakad\?goal=sample-id$/);
});

test("guide pages link to the planner and situation pages", async ({ page }) => {
  await page.goto("/en/ids/sample-id");
  await expect(page.getByRole("link", { name: "How to get a Sample ID on weekends" })).toBeVisible();
});

test("personal pages and data export require sign-in", async ({ page, request }) => {
  for (const path of ["/en/my-documents", "/en/plans"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/en\/login$/);
  }
  const res = await request.get("/api/account/export");
  expect(res.status()).toBe(401);
});
