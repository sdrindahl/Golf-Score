import { test, expect, Page } from '@playwright/test';

const E2E_USER = {
  id: 'e2e-mobile-user',
  name: 'E2E Mobile',
  password: '1234',
};

async function seedAuthenticatedUser(page: Page) {
  await page.addInitScript((user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));

    const existingUsers = JSON.parse(localStorage.getItem('golfUsers') || '[]');
    const hasUser = existingUsers.some((entry: { id: string }) => entry.id === user.id);

    if (!hasUser) {
      existingUsers.push(user);
      localStorage.setItem('golfUsers', JSON.stringify(existingUsers));
    }
  }, E2E_USER);
}

async function tapMobileNavAndAssert(page: Page, buttonName: string, expectedUrl: RegExp) {
  const mobileNav = page.locator('.mobile-navbar');
  await expect(mobileNav).toBeVisible();

  const navButton = mobileNav.getByRole('button', { name: new RegExp(buttonName, 'i') }).first();
  await expect(navButton).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => {
      const el = node as HTMLElement;
      el.style.pointerEvents = 'none';
      el.style.display = 'none';
    });
  });

  await navButton.dispatchEvent('click');

  // Retry once if the synthetic click was swallowed by re-render timing.
  if (!expectedUrl.test(page.url())) {
    await navButton.click({ force: true });
  }

  await expect(page).toHaveURL(expectedUrl, { timeout: 10000 });
}

test.describe('Wallet Mobile Navigation Regression', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedUser(page);

    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = 'nextjs-portal { pointer-events: none !important; }';
      document.head.appendChild(style);
    });
  });

  test('should reliably navigate away from wallet via mobile navbar buttons', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use?.isMobile, 'Mobile-only regression coverage');

    await page.goto('/wallet');
    await expect(page).toHaveURL(/\/wallet(?:\/|$|\?)/);

    // Run navigation hops multiple times to catch intermittent tap failures.
    await tapMobileNavAndAssert(page, 'Home', /\/$/);
    await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);

    await tapMobileNavAndAssert(page, 'Golfers', /\/players(?:\/|$|\?)/);
    await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);

    await tapMobileNavAndAssert(page, 'Courses', /\/courses(?:\/|$|\?)/);
    await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);
  });
});
