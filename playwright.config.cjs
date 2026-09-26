/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests/smoke',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://flirthub-dating-app.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  reporter: [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
};
