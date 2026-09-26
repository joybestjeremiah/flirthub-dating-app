import { test, expect } from '@playwright/test';

const baseURL = process.env.SMOKE_BASE_URL || 'https://flirthub-dating-app.vercel.app';
const testEmail = process.env.SMOKE_TEST_EMAIL;
const testPassword = process.env.SMOKE_TEST_PASSWORD;
const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
const premiumEmail = process.env.SMOKE_PREMIUM_EMAIL;
const premiumPassword = process.env.SMOKE_PREMIUM_PASSWORD;

test.use({ baseURL });

test('production: public app loads and auth UI is healthy', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText('FlirtHub')).toBeVisible();
  await expect(page.getByText(/sign in|create account|welcome/i).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Vite');
});

test('production: auth controls and reset-password route render', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await page.goto('/reset-password', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText(/reset password|password/i).first()).toBeVisible();
});

test('production: protected routes redirect unauthenticated users safely', async ({ page }) => {
  for (const route of ['/discover', '/matches', '/rooms', '/subscription', '/admin']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  }
});

test('production: authenticated user can reach discovery, matches, rooms and subscription', async ({ page }) => {
  test.skip(!testEmail || !testPassword, 'Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD for authenticated smoke tests.');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(testEmail);
  await page.locator('input[type="password"]').first().fill(testPassword);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();

  await expect(page).toHaveURL(/discover|profile-setup/);

  if (await page.getByText(/complete your profile|profile setup/i).first().isVisible().catch(() => false)) {
    test.info().annotations.push({ type: 'note', description: 'Test account requires profile setup; discovery-dependent checks were skipped.' });
    return;
  }

  await expect(page.getByText('Discover')).toBeVisible();
  await page.goto('/matches', { waitUntil: 'networkidle' });
  await expect(page.getByText(/matches/i).first()).toBeVisible();

  await page.goto('/rooms', { waitUntil: 'networkidle' });
  await expect(page.getByText(/rooms/i).first()).toBeVisible();

  await page.goto('/subscription', { waitUntil: 'networkidle' });
  await expect(page.getByText(/premium|subscription/i).first()).toBeVisible();
});

test('production: authenticated subscription UI exposes payment plans without charging', async ({ page }) => {
  test.skip(!testEmail || !testPassword, 'Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD for authenticated smoke tests.');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(testEmail);
  await page.locator('input[type="password"]').first().fill(testPassword);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();
  await page.waitForLoadState('networkidle');

  if (await page.getByText(/complete your profile|profile setup/i).first().isVisible().catch(() => false)) {
    test.skip(true, 'Test account requires profile setup.');
  }

  const upgrade = page.getByRole('button', { name: /upgrade/i }).first();
  const premium = page.getByRole('button', { name: /premium/i }).first();

  if (await upgrade.isVisible().catch(() => false)) {
    await upgrade.click();
    await expect(page.getByText(/weekly|monthly/i).first()).toBeVisible();
    await expect(page.getByText(/flutterwave|payment/i).first()).toBeVisible();
  } else {
    await expect(premium).toBeVisible();
  }
});

test('production: premium user can open a match chat and send a smoke message', async ({ page }) => {
  test.skip(!premiumEmail || !premiumPassword, 'Set SMOKE_PREMIUM_EMAIL and SMOKE_PREMIUM_PASSWORD for Premium chat smoke tests.');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(premiumEmail);
  await page.locator('input[type="password"]').first().fill(premiumPassword);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();
  await page.waitForLoadState('networkidle');

  if (await page.getByText(/complete your profile|profile setup/i).first().isVisible().catch(() => false)) {
    test.skip(true, 'Premium test account requires profile setup.');
  }

  await page.goto('/matches', { waitUntil: 'networkidle' });
  await expect(page.getByText(/your matches|no matches yet/i).first()).toBeVisible();

  const matchButton = page.locator('button').filter({ has: page.locator('div.font-semibold') }).first();
  if (!(await matchButton.isVisible().catch(() => false))) {
    test.skip(true, 'Premium test account has no match; seed a match for full chat smoke coverage.');
  }

  await matchButton.click();
  await expect(page.getByPlaceholder(/type a message|message/i)).toBeVisible();

  const marker = 'FlirtHub production smoke test';
  const input = page.getByPlaceholder(/type a message|message/i);
  await input.fill(marker);
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText(marker)).toBeVisible();
});

test('production: admin dashboard is protected and renders for an admin account', async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, 'Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD for admin smoke tests.');

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(adminEmail);
  await page.locator('input[type="password"]').first().fill(adminPassword);
  await page.getByRole('button', { name: /sign in|login/i }).first().click();
  await page.waitForLoadState('networkidle');

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toContainText(/access denied|unauthorized/i);
  await expect(page.getByText(/admin|overview|payments|users|subscriptions/i).first()).toBeVisible();
});


test('production: protected cron endpoint rejects unauthenticated requests', async ({ request }) => {
  const response = await request.get('/api/cron/expire-subscriptions');
  expect(response.status()).toBe(401);
});

test('production: subscription verification rejects malformed unauthenticated requests safely', async ({ request }) => {
  const response = await request.post('/api/verify-subscription-payment', { data: {} });
  expect([400, 401, 404, 405]).toContain(response.status());
});
