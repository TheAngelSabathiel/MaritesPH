/**
 * Public guide, office finder, and report flows (Phase 3).
 * Requires tests/fixtures/sample-published.sql in the database the app uses,
 * and E2E_SAMPLE_DATA=1. The report tests also need SUPABASE_SECRET_KEY and
 * RATE_LIMIT_SALT configured for the server (anonymous reports).
 * Run on the phone project only: these test behavior, not layout.
 */
import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample data fixture (E2E_SAMPLE_DATA=1)");
// Behavior tests run once, on the phone project (layout is covered for all widths elsewhere).
test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test.describe("guide page", () => {
  test("shows verified content with plain AND/OR requirements, never drafts", async ({ page }) => {
    await page.goto("/en/ids/sample-id");
    await expect(page.getByRole("heading", { level: 1, name: "Sample ID" })).toBeVisible();
    await expect(page.getByText("Verified ni Marites")).toBeVisible();
    await expect(page.getByText("Bring ONE of these choices")).toBeVisible();
    await expect(page.getByText("Choice 2: all of these together")).toBeVisible();
    await expect(page.getByText("₱100 to ₱250")).toBeVisible();
    await expect(page.getByText("MUST NOT APPEAR")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Bakit ganito/ })).toBeVisible();
    await expect(page.getByText("RA 0000: Sample Identification Act")).toBeVisible();
    // Structured data present and parseable.
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.map((j) => JSON.parse(j)["@type"])).toEqual(expect.arrayContaining(["HowTo", "BreadcrumbList"]));
  });

  test("warns when content is older than the threshold", async ({ page }) => {
    await page.goto("/en/ids/sample-certificate");
    await expect(page.getByText(/may be outdated/)).toBeVisible();
  });

  test("Filipino page uses Filipino copy", async ({ page }) => {
    await page.goto("/fil/ids/sample-id");
    await expect(page.getByText("Dalhin ang ISA sa mga pagpipiliang ito")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fil-PH");
  });

  test("unpublished and unverified documents are not shown", async ({ page }) => {
    for (const path of ["/en/ids/sample-draft", "/en/ids/passport"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
      // Every robots tag on the page must say noindex (Next may emit more than one).
      const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")));
      expect(robots.length).toBeGreaterThan(0);
      for (const content of robots) expect(content).toMatch(/noindex/);
    }
  });
});

test.describe("office finder", () => {
  test("filters by weekend hours, walk-ins, and document from the URL", async ({ page }) => {
    await page.goto("/en/offices");
    await expect(page.getByText("2 offices")).toBeVisible();
    await page.getByLabel("Open on weekends").check();
    await expect(page.getByText("1 offices")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sample Office Main" })).toBeVisible();
    await page.getByLabel("Open on weekends").uncheck();
    await page.getByLabel("Accepts walk-ins").check();
    await expect(page.getByRole("link", { name: "Sample Office North" })).toHaveCount(0);

    await page.goto("/en/offices?document=sample-certificate");
    await expect(page.getByText("1 offices")).toBeVisible();
  });

  test("loads the map only when asked", async ({ page }) => {
    await page.goto("/en/offices");
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
    await page.getByRole("button", { name: "Show map" }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-interactive")).toHaveCount(2); // one marker per office
  });

  test("a moved office's old URL lands on its current page", async ({ page }) => {
    await page.goto("/en/offices/other-city/sa/sample-office-main");
    await expect(page).toHaveURL(/\/en\/offices\/sample-city\/sa\/sample-office-main$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sample Office Main" })).toBeVisible();
  });
});

test.describe("report outdated info", () => {
  async function report(page: import("@playwright/test").Page, details: string) {
    await page.getByText("Report outdated info").click();
    await page.getByLabel("Details").fill(details);
    await page.getByRole("button", { name: "Send report" }).click();
  }

  test("an anonymous visitor can report, then gets rate limited", async ({ browser }) => {
    // A unique address per run, as Vercel's edge would set it.
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page = await context.newPage();
    for (let i = 1; i <= 5; i++) {
      await page.goto("/en/ids/sample-id");
      await report(page, `E2E test report ${i}: fee looks different`);
      await expect(page.getByText(/Salamat! We'll check this/)).toBeVisible();
    }
    await page.goto("/en/ids/sample-id");
    await report(page, "E2E test report 6: should be limited");
    await expect(page.getByText(/sent several reports recently/)).toBeVisible();
    await context.close();
  });

  test("bots that fill the hidden field are silently ignored", async ({ page }) => {
    await page.goto("/en/offices/sample-city/sa/sample-office-main");
    await page.getByText("Report outdated info").click();
    await page.locator('input[name="website"]').fill("http://spam.example", { force: true });
    await page.getByLabel("Details").fill("Bot submission that must not be stored");
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText(/Salamat!/)).toBeVisible();
  });
});
