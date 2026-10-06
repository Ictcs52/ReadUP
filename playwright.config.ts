import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173/ReadUP/', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', launchOptions: process.env.READTECH_CHROMIUM_PATH ? { executablePath: process.env.READTECH_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {} },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173/ReadUP/', reuseExistingServer: !process.env.CI },
});
