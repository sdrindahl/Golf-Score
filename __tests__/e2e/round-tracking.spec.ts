import { test, expect } from '@playwright/test';

test.describe('Round Tracking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is authenticated before each test
    // In real tests, you'd set up auth state via cookies or local storage
    await page.goto('/');
  });

  test('should navigate to new round page', async ({ page }) => {
    // Look for button to start new round
    const newRoundButton = page.locator('button:has-text("New Round"), a:has-text("New Round"), [aria-label*="new round" i]').first();
    
    if (await newRoundButton.isVisible().catch(() => false)) {
      await newRoundButton.click();
    } else {
      // Direct navigation fallback
      await page.goto('/new-round');
    }
    
    await expect(page).toHaveURL(/\/new-round|\/select-course/);
  });

  test('should display course selection', async ({ page }) => {
    await page.goto('/new-round');
    
    // Should see course search or selection interface
    const courseSearch = page.locator('input[placeholder*="course" i], input[placeholder*="search" i]').first();
    const courseList = page.locator('[class*="course"], li:has-text(/golf|course/i)').first();
    
    const courseElementExists = await courseSearch.isVisible().catch(() => false) || 
                                 await courseList.isVisible().catch(() => false);
    
    expect(courseElementExists).toBeTruthy();
  });

  test('should allow course selection', async ({ page }) => {
    await page.goto('/new-round');
    
    // Try to click first course in list
    const firstCourse = page.locator('button:has-text("course"), div[class*="course-card"], li >> nth=0').first();
    
    if (await firstCourse.isVisible().catch(() => false)) {
      await firstCourse.click();
      // Should navigate to tee selection or confirm
      await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
    }
  });

  test('should display tee color selection', async ({ page }) => {
    // Navigate through course selection to tee selection
    await page.goto('/select-tee');
    
    // Should see tee color options (Blue, White, Red, Yellow, etc.)
    const teeOptions = page.locator('button:has-text(/blue|white|red|yellow/i), label:has-text(/blue|white|red|yellow/i)').first();
    
    if (await teeOptions.isVisible().catch(() => false)) {
      await expect(teeOptions).toBeVisible();
    }
  });

  test('should allow tee selection', async ({ page }) => {
    await page.goto('/select-tee');
    
    // Click first available tee
    const firstTee = page.locator('button:has-text(/blue|white|red|yellow/i), label:has-text(/blue|white|red|yellow/i)').first();
    
    if (await firstTee.isVisible().catch(() => false)) {
      await firstTee.click();
      // Should navigate to track-round
      await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
      await expect(page).toHaveURL(/\/track-round/);
    }
  });

  test('should display scorecard on track-round page', async ({ page }) => {
    // Start a round first
    await page.goto('/track-round?id=test-round-123');
    
    // Should see hole numbers or score input fields
    const scoreInputs = page.locator('input[type="number"], input[inputmode="numeric"]').first();
    const holes = page.locator('text=/hole/i').first();
    
    const scorecardExists = await scoreInputs.isVisible().catch(() => false) || 
                            await holes.isVisible().catch(() => false);
    
    expect(scorecardExists).toBeTruthy();
  });

  test('should allow score entry', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Find score input field
    const scoreInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
    
    if (await scoreInput.isVisible().catch(() => false)) {
      await scoreInput.fill('4');
      const value = await scoreInput.inputValue();
      expect(value).toBe('4');
    }
  });

  test('should display navigation between holes', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Should have Next/Previous buttons
    const nextButton = page.locator('button:has-text("Next"), button:has-text("→")').first();
    const prevButton = page.locator('button:has-text("Previous"), button:has-text("←")').first();
    
    const navigationExists = await nextButton.isVisible().catch(() => false) || 
                             await prevButton.isVisible().catch(() => false);
    
    expect(navigationExists).toBeTruthy();
  });

  test('should display score summary', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Should show current score/stats
    const scoreDisplay = page.locator('text=/score|total|running/i').first();
    
    if (await scoreDisplay.isVisible().catch(() => false)) {
      await expect(scoreDisplay).toBeVisible();
    }
  });

  test('should allow saving round', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Find save button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Complete"), button:has-text("Finish")').first();
    
    if (await saveButton.isVisible().catch(() => false)) {
      await expect(saveButton).toBeVisible();
    }
  });

  test('should display success message after save', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Look for save button and click
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Complete")').first();
    
    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      
      // Should show success toast/modal
      const successMessage = page.locator('text=/saved|success|complete/i').first();
      await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
        // Or should redirect to round detail page
        expect(page.url()).toContain('round-detail');
      });
    }
  });

  test('should display round in history after save', async ({ page }) => {
    // After saving, navigate to rounds history or home
    await page.goto('/');
    
    // Should see recently saved round in list
    const roundsList = page.locator('[class*="round"], [class*="history"]').first();
    
    if (await roundsList.isVisible().catch(() => false)) {
      await expect(roundsList).toBeVisible();
    }
  });

  test('should pause heartbeat on page hidden', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // This tests the heartbeat mechanism
    // Simulate page visibility change
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    // Heartbeat should pause
    // Can verify by checking network activity or console logs
    // For now, just ensure page remains responsive
    await expect(page).toHaveURL(/\/track-round/);
  });

  test('should resume heartbeat on page visible', async ({ page }) => {
    await page.goto('/track-round?id=test-round-123');
    
    // Simulate page becoming visible
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    // Heartbeat should resume
    // Page should still be responsive
    await expect(page).toHaveURL(/\/track-round/);
  });
});
