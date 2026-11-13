/**
 * Playwright end-to-end tests. Phase 2 ships the mobile layout suite; critical
 * user flows are added from Phase 4.
 *
 * Usage:
 *   npx playwright install chromium   # once
 *   npm run build
 *   npm run test:e2e                  # starts the app on :3100 with the UI preview enabled
 *
 * PLAYWRIGHT_CHROMIUM_PATH lets CI or sandboxes use a preinstalled Chromium.
 */
import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {},
  },
  projects: [
    // 360px: the most common width on low-end Android phones.
    { name: "phone-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: !process.env.CI,
    env: { ENABLE_UI_PREVIEW: "true", NEXT_TELEMETRY_DISABLED: "1" },
    timeout: 60_000,
  },
});
