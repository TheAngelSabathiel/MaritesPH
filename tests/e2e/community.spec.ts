/**
 * Phase 5: Chika sa Pila, tips, "Ano'ng bago?", and AI fallbacks. Runs with AI
 * OFF (no API key), which is how a first deploy behaves: cached answers still
 * work, new questions get a clear "resting" message, and nothing breaks.
 * Needs the sample fixture (E2E_SAMPLE_DATA=1) and, for anonymous questions,
 * SUPABASE_SECRET_KEY + RATE_LIMIT_SALT on the server.
 */
import { expect, test } from "@playwright/test";
import { layoutProblems } from "./layout";

test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample data fixture (E2E_SAMPLE_DATA=1)");
test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("office page shows approved tips, the typical wait, and never pending tips", async ({ page }) => {
  await page.goto("/en/offices/sample-city/sa/sample-office-main");
  await expect(page.getByText("Chika sa Pila: community experience, unverified").first()).toBeVisible();
  await expect(page.getByText("Sample tip: bring a black pen for the form.")).toBeVisible();
  await expect(page.getByText("Typical wait lately: about 60 min (3 reports)")).toBeVisible();
  await expect(page.getByText("PENDING SAMPLE TIP, MUST NOT APPEAR")).toHaveCount(0);
});

test("sharing a tip needs an account", async ({ page }) => {
  await page.goto("/en/offices/sample-city/sa/sample-office-main");
  await page.getByText("Share your experience").click();
  await page.getByLabel("What happened?").fill("The guard let us in at 7:30 AM.");
  await page.getByRole("button", { name: "Send tip" }).click();
  await expect(page.getByText("Sign in to share a tip.")).toBeVisible();
});

test("Ano'ng bago? keeps official and community apart and warns about a possible conflict", async ({ page }) => {
  await page.goto("/en/ids/sample-certificate");
  await expect(page.getByText("May posibleng bagong update — i-verify muna bago pumunta.")).toBeVisible();
  const official = page.locator("div").filter({ has: page.getByRole("heading", { name: "Official updates" }) }).last();
  const community = page.locator("div").filter({ has: page.getByRole("heading", { name: "Chika sa Pila: community experience, unverified" }) }).last();
  await expect(official.getByText("Sample advisory: new certificate fee")).toBeVisible();
  await expect(official.getByText("Sample: people reported long lines on Mondays.")).toHaveCount(0);
  await expect(community.getByText("Sample: people reported long lines on Mondays.")).toBeVisible();
  // The verified guide itself is unchanged: the stamp and the stale warning are still there.
  await expect(page.getByText("Verified ni Marites")).toBeVisible();
  const layout = await layoutProblems(page);
  expect(layout.overflow).toEqual([]);
});

test.describe("Chika sa Pila", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 20}` } });

  test("a similar question gets the cached community answer, labeled and sourced", async ({ page }) => {
    await page.goto("/en/chika?doc=sample-id");
    // Wait until the document from the URL is applied (the form re-mounts once).
    await expect(page.getByLabel("Which document is this about?")).toHaveValue("f0000000-0000-4000-8000-0000000000d1");
    await page.getByLabel("What's the problem?").fill("my name is misspelled on the sample certificate");
    await page.getByRole("button", { name: "Ask Marites" }).click();
    await expect(page.getByText("Sample: people fixed spelling errors by requesting a correction first.")).toBeVisible();
    await expect(page.getByText("Chika sa Pila: community experience, unverified")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sample thread" })).toHaveAttribute("href", "https://www.reddit.com/r/example/comments/sample_thread");
    await expect(page.getByText("Sample: contact the Sample Agency help desk.")).toBeVisible();
    await expect(page.getByText(/From a similar question asked recently/)).toBeVisible();
  });

  test("a new question with AI off gets a clear resting message", async ({ page }) => {
    await page.goto("/fil/chika?doc=sample-id");
    await expect(page.getByLabel("Tungkol saang dokumento ito?")).toHaveValue("f0000000-0000-4000-8000-0000000000d1");
    await page.getByLabel("Ano ang problema?").fill("Sarado ang opisina kahit nasa schedule");
    await page.getByRole("button", { name: "Itanong kay Marites" }).click();
    await expect(page.getByText(/Nagpapahinga muna ang Chika sa Pila/)).toBeVisible();
  });
});

test("guide links to Chika sa Pila; planner hides the AI summary when AI is off", async ({ page }) => {
  await page.goto("/en/ids/sample-id");
  await page.getByRole("link", { name: "Problem with this document? Ask Chika sa Pila" }).click();
  await expect(page).toHaveURL(/\/en\/chika\?doc=sample-id$/);
  await page.goto("/en/lakad?goal=sample-id");
  await expect(page.locator('form[data-ready="true"]')).toHaveCount(1); // wizard hydrated (one instance)
  await expect(page.getByText("Step 2 of 4")).toBeVisible(); // wait until the goal from the URL is applied
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Show my options" }).click();
  await expect(page.getByRole("heading", { name: "Mga Diskarte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ipaliwanag ni Marites" })).toHaveCount(0);
});

test("context API validates input", async ({ request }) => {
  expect((await request.get("/api/context?type=document&slug=Bad Slug&locale=en")).status()).toBe(400);
  expect((await request.get("/api/context?type=document&slug=passport&locale=en")).status()).toBe(404); // unverified seed: not public
  const ok = await request.get("/api/context?type=document&slug=sample-certificate&locale=en");
  expect(ok.status()).toBe(200);
  expect((await ok.json()).conflict).toBe(true);
});
