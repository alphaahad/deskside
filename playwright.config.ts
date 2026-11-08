import { defineConfig } from "@playwright/test";

// Two ways to run:
//   npm run e2e                      → builds the app and serves it on :3100 with a throwaway in-memory DB
//   E2E_BASE_URL=https://… npm run e2e → runs the same tests against a deployed URL (e.g. production)
// Every test opens with ?internal=1, so runs are flagged as rehearsals.
const remote = process.env.E2E_BASE_URL;
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: remote ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
    // Use the installed Chrome instead of downloading a browser.
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 300_000,
        reuseExistingServer: false,
        // In-memory DB (never touches ./.data), and no Gemini key: chat runs in offline mode and reads come from the snapshot, so tests never spend free-tier quota and prove the demo survives a quota cutoff.
        env: { PGLITE_DIR: "memory://", GEMINI_API_KEY: "" },
      },
});
