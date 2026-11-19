import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * ClaimPath end-to-end suite.
 *
 * The suite runs against a local ClaimPath dev server. Playwright starts that
 * server itself (see `webServer`) in the app's documented local-storage mode,
 * so no PostgreSQL instance and no deployed environment is required.
 *
 * Override with env vars:
 *   CLAIMPATH_APP_DIR  path to the ClaimPath checkout (defaults to the repo root)
 *   BASE_URL           test an already-running server instead of starting one
 *   PORT               port for the managed dev server (default 3100)
 */
const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
/** The ClaimPath app this suite tests: the repository root, one level up. */
const appDir = process.env.CLAIMPATH_APP_DIR ?? path.resolve(__dirname, '..');

/** Only manage a dev server when we were not pointed at an external BASE_URL. */
const managesServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: './tests',
  // Each spec file is independent; tests inside a file are too, because every
  // test gets a fresh browser context and therefore a fresh ClaimPath session.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  /**
   * Deliberately serialised. In local-storage mode ClaimPath persists each
   * workspace to a single-writer SQLite file, so parallel workers contend on
   * the same database handle. Against the PostgreSQL backend this limit does
   * not apply and `workers` can be raised.
   */
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // ClaimPath isolates each browser session's workspace behind an HttpOnly
    // cookie, so a fresh context is a fresh, freshly-seeded set of 30 claims.
    // Nothing a test does can reach another test's data.
    storageState: undefined,
  },

  projects: [
    {
      name: 'chrome',
      // Drives the locally installed Google Chrome rather than Playwright's
      // bundled Chromium, so the suite needs no browser download. Swap to
      // `channel: undefined` to use a downloaded Chromium instead.
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  ...(managesServer
    ? {
        webServer: {
          command: `node_modules/.bin/next dev -p ${PORT}`,
          cwd: appDir,
          url: baseURL,
          env: {
            // Documented local-dev store: .data/workspaces.sqlite via node:sqlite.
            // Keeps the suite off any shared or hosted database.
            CLAIMPATH_LOCAL_STORAGE: '1',
            // No OPENAI_API_KEY: the copilot stays in its deterministic
            // rules-based "Evidence assistant" mode and makes no outbound calls.
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
