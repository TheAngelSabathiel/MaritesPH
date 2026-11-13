/** Phase 11: installable app, offline guides, security headers, cache clearing on sign-out, health. */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "phone-360", "runs on phone-360 only");
});

test("manifest and icons make the app installable", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ name: "Marites PH", display: "standalone", start_url: "/" });
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  for (const icon of m.icons) {
    const res = await request.get(icon.src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("security headers are set", async ({ request }) => {
  const h = (await request.get("/en")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("geolocation=(self)");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("a guide viewed online still opens offline; unvisited pages show the offline page", async ({ page, context }) => {
  test.skip(process.env.E2E_SAMPLE_DATA !== "1", "needs the sample fixture");
  await page.goto("/en/ids/sample-id");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the service worker, which saves the page
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Sample ID" })).toBeVisible();
  await page.goto("/en/ids/sample-certificate").catch(() => {});
  await expect(page.getByRole("heading", { level: 1, name: "Offline ka ngayon" })).toBeVisible();
  await context.setOffline(false);
});

test("sign-out clears this device's offline copies", async ({ request, baseURL }) => {
  const res = await request.post("/auth/signout", { headers: { origin: baseURL! }, maxRedirects: 0, form: { locale: "en" } });
  expect(res.status()).toBe(303);
  expect(res.headers()["clear-site-data"]).toBe('"cache", "storage"');
});

test("the public health check reveals only a status", async ({ request }) => {
  const body = await (await request.get("/api/health")).json();
  expect(Object.keys(body)).toEqual(["status"]);
});
