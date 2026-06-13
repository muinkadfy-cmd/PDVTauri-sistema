import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const HOST = process.env.E2E_HOST || '127.0.0.1';
const BASE_URL = process.env.E2E_BASE_URL || `http://${HOST}:${PORT}`;
const SERVER_COMMAND =
  process.env.E2E_SERVER_COMMAND ||
  `npx vite --mode desktop --port ${PORT} --host ${HOST} --strictPort`;
const SKIP_WEBSERVER = process.env.E2E_SKIP_WEBSERVER === '1';

/**
 * Playwright E2E
 * - Sobe o Vite dev server automaticamente
 * - Roda smoke + testes de regressão (travamentos/rotas)
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: SKIP_WEBSERVER ? undefined : {
    command: SERVER_COMMAND,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
