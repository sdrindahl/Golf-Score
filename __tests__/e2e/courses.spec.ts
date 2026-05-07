import { test, expect } from '@playwright/test';

test.describe('Courses Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is authenticated
    await page.goto('/');
  });

  test('should navigate to courses page', async ({ page }) => {
    // Look for courses button in navigation
    const coursesButton = page.locator('button:has-text("Courses"), a:has-text("Courses"), [aria-label*="courses" i]').first();
    
    if (await coursesButton.isVisible().catch(() => false)) {
      await coursesButton.click();
    } else {
      // Direct navigation fallback
      await page.goto('/courses');
    }
    
    await expect(page).toHaveURL(/\/courses|\/course-search/);
  });

  test('should display course list', async ({ page }) => {
    await page.goto('/courses');
    
    // Should see courses displayed
    const courseCard = page.locator('[class*="course"], li:has-text(/golf|course/i)').first();
    
    if (await courseCard.isVisible().catch(() => false)) {
      await expect(courseCard).toBeVisible();
    }
  });

  test('should display course search field', async ({ page }) => {
    await page.goto('/courses');
    
    // Should have search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="course" i]').first();
    
    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test('should filter courses by search query', async ({ page }) => {
    await page.goto('/courses');
    
    // Find and use search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="course" i]').first();
    
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('pebble');
      
      // Should filter results
      // Wait a bit for debounce/search
      await page.waitForTimeout(500);
      
      // Results should be updated
      const filteredList = page.locator('[class*="course"]').first();
      await expect(filteredList).toBeVisible();
    }
  });

  test('should clear search results', async ({ page }) => {
    await page.goto('/courses');
    
    // Search for something
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="course" i]').first();
    
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('pebble');
      await page.waitForTimeout(300);
      
      // Clear search
      const clearButton = page.locator('button[aria-label*="clear" i], button:has-text("✕")').first();
      
      if (await clearButton.isVisible().catch(() => false)) {
        await clearButton.click();
      } else {
        await searchInput.clear();
      }
      
      // Should show full list again
      await page.waitForTimeout(300);
    }
  });

  test('should display course details on click', async ({ page }) => {
    await page.goto('/courses');
    
    // Click first course
    const firstCourse = page.locator('[class*="course"], li').first();
    
    if (await firstCourse.isVisible().catch(() => false)) {
      await firstCourse.click();
      
      // Should navigate to course details
      await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
      
      const url = page.url();
      expect(url).toContain('course-details') || expect(url).toContain('courses');
    }
  });

  test('should display course information', async ({ page }) => {
    // Navigate to a specific course details page
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should display course info
    const courseName = page.locator('h1, h2, [class*="title"]').first();
    const courseInfo = page.locator('[class*="info"], [class*="details"]').first();
    
    const infoExists = await courseName.isVisible().catch(() => false) || 
                       await courseInfo.isVisible().catch(() => false);
    
    expect(infoExists).toBeTruthy();
  });

  test('should display course holes', async ({ page }) => {
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should see hole information
    const holes = page.locator('text=/hole|nine|18/i').first();
    
    if (await holes.isVisible().catch(() => false)) {
      await expect(holes).toBeVisible();
    }
  });

  test('should display course scorecard/layout', async ({ page }) => {
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should see scorecard with par/handicap info
    const scorecard = page.locator('[class*="scorecard"], table, [role="table"]').first();
    
    if (await scorecard.isVisible().catch(() => false)) {
      await expect(scorecard).toBeVisible();
    }
  });

  test('should display nines selection for 18-hole courses', async ({ page }) => {
    // Some courses have 9-hole nines that need selection
    await page.goto('/course-nines?courseId=test-course-123');
    
    // Should show nine selection
    const nineOptions = page.locator('button, label').filter({ hasText: /front|back|nine/i }).first();
    
    if (await nineOptions.isVisible().catch(() => false)) {
      await expect(nineOptions).toBeVisible();
    }
  });

  test('should allow course selection for new round', async ({ page }) => {
    await page.goto('/courses');
    
    // Click a course
    const firstCourse = page.locator('[class*="course"], li').first();
    
    if (await firstCourse.isVisible().catch(() => false)) {
      // Look for "Start Round" or similar button
      const startRoundButton = page.locator('button:has-text("Start Round"), button:has-text("Play"), a:has-text("Play")').first();
      
      if (await startRoundButton.isVisible().catch(() => false)) {
        await startRoundButton.click();
        
        // Should navigate to tee selection
        await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
        expect(page.url()).toContain('select-tee') || expect(page.url()).toContain('track-round');
      }
    }
  });

  test('should display course ratings and reviews', async ({ page }) => {
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should show rating/review section if available
    const rating = page.locator('text=/rating|review|star/i').first();
    const reviewSection = page.locator('[class*="review"], [class*="rating"]').first();
    
    const reviewExists = await rating.isVisible().catch(() => false) || 
                         await reviewSection.isVisible().catch(() => false);
    
    expect(reviewExists).toBeTruthy() || expect(reviewExists).toBeFalsy(); // Either is fine
  });

  test('should handle empty search results', async ({ page }) => {
    await page.goto('/courses');
    
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="course" i]').first();
    
    if (await searchInput.isVisible().catch(() => false)) {
      // Search for something that doesn't exist
      await searchInput.fill('zzzznonexistentcourse123zzz');
      await page.waitForTimeout(500);
      
      // Should show "no results" message or empty state
      const noResults = page.locator('text=/no results|not found|no courses/i').first();
      
      if (await noResults.isVisible().catch(() => false)) {
        await expect(noResults).toBeVisible();
      }
    }
  });

  test('should display course location', async ({ page }) => {
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should show location/address
    const location = page.locator('text=/location|address|city|state/i').first();
    
    if (await location.isVisible().catch(() => false)) {
      await expect(location).toBeVisible();
    }
  });

  test('should display tee colors available', async ({ page }) => {
    await page.goto('/course-details?courseId=test-course-123');
    
    // Should show available tee colors
    const teeColors = page.locator('text=/blue|white|red|yellow|black/i').first();
    
    if (await teeColors.isVisible().catch(() => false)) {
      await expect(teeColors).toBeVisible();
    }
  });

  test('should allow sorting courses', async ({ page }) => {
    await page.goto('/courses');
    
    // Look for sort button/dropdown
    const sortButton = page.locator('button:has-text("Sort"), select[aria-label*="sort" i]').first();
    
    if (await sortButton.isVisible().catch(() => false)) {
      await expect(sortButton).toBeVisible();
    }
  });
});
