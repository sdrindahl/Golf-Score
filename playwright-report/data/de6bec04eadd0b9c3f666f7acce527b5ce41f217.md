# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wallet-nav-mobile.spec.ts >> Wallet Mobile Navigation Regression >> should reliably navigate away from wallet via mobile navbar buttons
- Location: __tests__/e2e/wallet-nav-mobile.spec.ts:39:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.mobile-navbar').getByRole('button', { name: /Home/i }).first()
    - locator resolved to <button class="flex-1 flex flex-col items-center justify-center py-2 font-semibold text-xs transition hover:bg-green-600">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    54 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]: v5.2.28
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - button "Just Tap It Logo Home" [ref=e5] [cursor=pointer]:
        - img "Just Tap It Logo" [ref=e6]
        - text: Home
      - button "Golfers Golfers" [ref=e7] [cursor=pointer]:
        - img "Golfers" [ref=e8]
        - text: Golfers
      - button "▶ Start Round" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: ▶
        - text: Start Round
      - button "Courses Courses" [ref=e11] [cursor=pointer]:
        - img "Courses" [ref=e12]
        - text: Courses
      - button "💳 Golf Wallet" [ref=e13] [cursor=pointer]:
        - generic [ref=e14]: 💳
        - text: Golf Wallet
  - main [ref=e15]:
    - generic [ref=e18]:
      - generic [ref=e19]:
        - heading "Golf Wallet" [level=1] [ref=e20]
        - separator [ref=e21]
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - paragraph [ref=e26]: Total Spent
            - paragraph [ref=e27]: $0.00
            - paragraph [ref=e28]: This Month wallet summary
          - button "+ Add Entry" [ref=e29] [cursor=pointer]
        - generic [ref=e31]:
          - paragraph [ref=e32]: Winnings
          - paragraph [ref=e33]: $0
        - generic [ref=e34]:
          - button "This Week" [ref=e35] [cursor=pointer]
          - button "This Month" [ref=e36] [cursor=pointer]
          - button "This Year" [ref=e37] [cursor=pointer]
      - generic [ref=e39]:
        - generic [ref=e40]:
          - heading "Spending Breakdown" [level=2] [ref=e41]
          - button "View All ↗" [ref=e42] [cursor=pointer]
        - generic [ref=e43]:
          - generic:
            - generic: No spend data yet
          - generic [ref=e45]: Add your first entry to see category insights.
      - generic [ref=e47]:
        - generic [ref=e48]:
          - heading "Spending Trends" [level=2] [ref=e49]
          - generic [ref=e50]:
            - button "Week" [ref=e51] [cursor=pointer]
            - button "Month" [ref=e52] [cursor=pointer]
            - button "Year" [ref=e53] [cursor=pointer]
        - generic [ref=e55]:
          - generic:
            - generic:
              - generic:
                - generic:
                  - application:
                    - generic:
                      - generic:
                        - generic:
                          - generic: Dec '25
                        - generic:
                          - generic: Jan '26
                        - generic:
                          - generic: Feb '26
                        - generic:
                          - generic: Mar '26
                        - generic:
                          - generic: Apr '26
                        - generic:
                          - generic: May '26
                        - generic:
                          - generic: Jun '26
                        - generic:
                          - generic: Jul '26
                        - generic:
                          - generic: Aug '26
                        - generic:
                          - generic: Sep '26
                        - generic:
                          - generic: Oct '26
                        - generic:
                          - generic: Nov '26
                        - generic:
                          - generic: Dec '26
                      - generic:
                        - generic:
                          - generic: $0
                        - generic:
                          - generic: $25
                        - generic:
                          - generic: $50
                        - generic:
                          - generic: $75
                        - generic:
                          - generic: $100
      - generic [ref=e57]:
        - generic [ref=e58]:
          - heading "Recent Entries" [level=2] [ref=e59]
          - button "View All" [ref=e60] [cursor=pointer]
        - generic [ref=e62]: No entries yet.
  - button "Open Next.js Dev Tools" [ref=e68] [cursor=pointer]:
    - img [ref=e69]
  - alert [ref=e74]
  - generic [ref=e75]: $0
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | const E2E_USER = {
  4  |   id: 'e2e-mobile-user',
  5  |   name: 'E2E Mobile',
  6  |   password: '1234',
  7  | };
  8  | 
  9  | async function seedAuthenticatedUser(page: Page) {
  10 |   await page.addInitScript((user) => {
  11 |     localStorage.setItem('currentUser', JSON.stringify(user));
  12 | 
  13 |     const existingUsers = JSON.parse(localStorage.getItem('golfUsers') || '[]');
  14 |     const hasUser = existingUsers.some((entry: { id: string }) => entry.id === user.id);
  15 | 
  16 |     if (!hasUser) {
  17 |       existingUsers.push(user);
  18 |       localStorage.setItem('golfUsers', JSON.stringify(existingUsers));
  19 |     }
  20 |   }, E2E_USER);
  21 | }
  22 | 
  23 | async function tapMobileNavAndAssert(page: Page, buttonName: string, expectedUrl: RegExp) {
  24 |   const mobileNav = page.locator('.mobile-navbar');
  25 |   await expect(mobileNav).toBeVisible();
  26 | 
  27 |   const navButton = mobileNav.getByRole('button', { name: new RegExp(buttonName, 'i') }).first();
  28 |   await expect(navButton).toBeVisible();
  29 | 
> 30 |   await navButton.click();
     |                   ^ Error: locator.click: Test timeout of 30000ms exceeded.
  31 |   await expect(page).toHaveURL(expectedUrl, { timeout: 10000 });
  32 | }
  33 | 
  34 | test.describe('Wallet Mobile Navigation Regression', () => {
  35 |   test.beforeEach(async ({ page }) => {
  36 |     await seedAuthenticatedUser(page);
  37 |   });
  38 | 
  39 |   test('should reliably navigate away from wallet via mobile navbar buttons', async ({ page }, testInfo) => {
  40 |     test.skip(!testInfo.project.use?.isMobile, 'Mobile-only regression coverage');
  41 | 
  42 |     await page.goto('/wallet');
  43 |     await expect(page).toHaveURL(/\/wallet(?:\/|$|\?)/);
  44 | 
  45 |     // Run navigation hops multiple times to catch intermittent tap failures.
  46 |     await tapMobileNavAndAssert(page, 'Home', /\/$/);
  47 |     await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);
  48 | 
  49 |     await tapMobileNavAndAssert(page, 'Golfers', /\/players(?:\/|$|\?)/);
  50 |     await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);
  51 | 
  52 |     await tapMobileNavAndAssert(page, 'Courses', /\/courses(?:\/|$|\?)/);
  53 |     await tapMobileNavAndAssert(page, 'Golf Wallet', /\/wallet(?:\/|$|\?)/);
  54 |   });
  55 | });
  56 | 
```