/**
 * Mobile responsiveness suite. Runs every page at 360px, 768px and 1280px and
 * fails if:
 *   - the page scrolls sideways (anything wider than the screen, except inside
 *     containers that are meant to scroll horizontally);
 *   - a button, nav link, or form control is smaller than 44x44 CSS pixels;
 *   - a text input uses less than 16px text (iPhones zoom in on focus).
 * /ui-preview renders the admin components with sample data (no database needed).
 * Guide and office detail pages need the sample fixture (E2E_SAMPLE_DATA=1).
 */
import { expect, test } from "@playwright/test";
import { layoutProblems } from "./layout";

/** Pages that need tests/fixtures/sample-published.sql loaded (set E2E_SAMPLE_DATA=1). */
const SAMPLE_PAGES = process.env.E2E_SAMPLE_DATA === "1"
  ? ["/en/ids/sample-id", "/fil/ids/sample-id", "/en/offices/sample-city/sa", "/fil/offices/sample-city/sa/sample-office-main", "/en/ids/sample-id/for-8-to-5-workers", "/fil/ids/sample-id/for-night-shift-workers", "/en/ids/sample-certificate", "/en/business/sample-business-registration", "/en/cpas", "/en/cpas/f0000000-0000-4000-8000-0000000000e2"]
  : [];

const PAGES = [
  ...SAMPLE_PAGES,
  "/en/lakad",
  "/fil/lakad",
  "/en/chika",
  "/fil/chika",
  "/en/ano-ng-bago",
  "/fil/ano-ng-bago",
  "/en/business",
  "/en/pricing",
  "/fil/pricing",
  "/en/negosyo",
  "/en/offline",
  "/fil/offline",
  "/fil/freelancer",
  "/en/freelancer/tax",
  "/en/ids",
  "/fil/ids",
  "/en/offices",
  "/fil/offices",
  "/en",
  "/fil",
  "/en/login",
  "/fil/login",
  "/en/legal/privacy",
  "/fil/legal/terms",
  "/en/legal/disclaimer",
  "/en/does-not-exist",
  "/en/ui-preview",
  "/fil/ui-preview",
];

for (const path of PAGES) {
  test(`layout holds at this width: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const result = await layoutProblems(page);
    expect(result.overflow, "elements wider than the screen").toEqual([]);
    expect(result.scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(result.viewport);
    expect(result.smallTargets, "tap targets under 44x44px").toEqual([]);
    expect(result.smallText, "inputs under 16px text").toEqual([]);
  });
}

test("dark mode keeps the layout", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  const result = await layoutProblems(page);
  expect(result.overflow).toEqual([]);
});

test("viewport allows edge-to-edge with safe areas", async ({ page }) => {
  await page.goto("/en");
  const content = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(content).toContain("viewport-fit=cover");
  // Users must be able to zoom (accessibility): never disable scaling.
  expect(content).not.toMatch(/user-scalable=no|maximum-scale=1(\D|$)/);
});
