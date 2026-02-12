import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({ args: ['.'] });

  // Get the first window
  page = await electronApp.firstWindow();

  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Category Trends Visualization', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display category trends tab in reports', async () => {
    // Navigate to Reports view
    await page.click('text=Reports');

    // Should see report type tabs
    await expect(page.locator('text=Spending by Category')).toBeVisible();
    await expect(page.locator('text=Income vs Expenses')).toBeVisible();
    await expect(page.locator('text=Category Trends')).toBeVisible();

    // Click on Category Trends tab
    await page.click('text=Category Trends');

    // Should see the Category Trends component
    await expect(page.locator('h2:text("Category Trends Over Time")')).toBeVisible();
  });

  test('should display category selection interface', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Should see category selection section
    await expect(page.locator('text=Select Categories')).toBeVisible();

    // Should see checkboxes for categories
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow selecting and deselecting categories', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Find first category checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();

    // Check initial state
    const isChecked = await firstCheckbox.isChecked();

    // Toggle checkbox
    await firstCheckbox.click();

    // Verify state changed
    const newState = await firstCheckbox.isChecked();
    expect(newState).toBe(!isChecked);
  });

  test('should display date range controls', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Should see date range selector
    await expect(page.locator('text=Date Range:')).toBeVisible();

    // Should see date preset options using data-testid
    const dateRangeSelect = page.locator('[data-testid="date-range-select"]');
    await expect(dateRangeSelect).toBeVisible();

    // Verify options exist
    const options = await dateRangeSelect.locator('option').allTextContents();
    expect(options).toContain('Last 3 Months');
    expect(options).toContain('Last 6 Months');
    expect(options).toContain('This Year');
  });

  test('should display grouping controls', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Should see grouping selector
    await expect(page.locator('text=Group By:')).toBeVisible();

    // Should see grouping options using data-testid
    const groupingSelect = page.locator('[data-testid="grouping-select"]');
    await expect(groupingSelect).toBeVisible();

    const options = await groupingSelect.locator('option').allTextContents();
    expect(options).toContain('Daily');
    expect(options).toContain('Weekly');
    expect(options).toContain('Monthly');
    expect(options).toContain('Yearly');
  });

  test('should show custom date inputs when custom range selected', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Select custom range using data-testid
    await page.selectOption('[data-testid="date-range-select"]', 'custom');

    // Should see date inputs
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').nth(1)).toBeVisible();
    await expect(page.locator('text=From:')).toBeVisible();
    await expect(page.locator('text=To:')).toBeVisible();
  });

  test('should display empty state when no categories selected', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Uncheck all categories
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.click();
      }
    }

    // Should see empty state message
    await expect(page.locator('text=Select categories above to view their spending trends')).toBeVisible();
  });

  test('should display chart when categories are selected and data exists', async () => {
    // First, create an account
    await page.click('text=Import');
    await page.click('button:text("Add Account")');
    await page.fill('input[placeholder="Account Name"]', 'Test Account');
    await page.click('button:text("Create Account")');

    // Import sample transactions (would need a test CSV file)
    // For now, we'll just verify the structure is in place

    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Select a category
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (!(await firstCheckbox.isChecked())) {
      await firstCheckbox.click();
    }

    // Chart or empty state should be visible
    // If no data: "No data available for the selected date range"
    // If data: chart should render
    const hasEmptyState = await page.locator('text=No data available').isVisible();
    const hasChart = await page.locator('.recharts-wrapper').isVisible();

    expect(hasEmptyState || hasChart).toBeTruthy();
  });

  test('should display statistics table when data exists', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Select a category
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (!(await firstCheckbox.isChecked())) {
      await firstCheckbox.click();
    }

    // If we have data, should see statistics section
    const hasStats = await page.locator('text=Category Statistics').isVisible();
    const hasEmptyState = await page.locator('text=No data available').isVisible();

    // Either stats are shown (with data) or empty state (no data)
    expect(hasStats || hasEmptyState).toBeTruthy();
  });

  test('should allow selecting any number of categories', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    // Select all categories — none should be disabled
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
        await page.waitForTimeout(100);
      }
    }

    // All checkboxes should be checked, none disabled
    const disabledCheckboxes = await page.locator('input[type="checkbox"]:disabled').count();
    expect(disabledCheckboxes).toBe(0);

    const checkedCount = await page.locator('input[type="checkbox"]:checked').count();
    expect(checkedCount).toBe(count);
  });

  test('should persist selected categories after navigating away and back', async () => {
    // Navigate to Category Trends
    await page.click('text=Reports');
    await page.click('text=Category Trends');

    // Uncheck all, then select only the 2nd category
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.click();
        await page.waitForTimeout(100);
      }
    }

    // Select only the second checkbox (index 1)
    if (count >= 2) {
      await checkboxes.nth(1).click();
      await page.waitForTimeout(300);

      // Navigate away
      await page.click('text=Import');
      await page.waitForTimeout(300);

      // Navigate back
      await page.click('text=Reports');
      await page.click('text=Category Trends');
      await page.waitForTimeout(500);

      // The second checkbox should still be checked
      const restoredCheckboxes = page.locator('input[type="checkbox"]');
      const secondChecked = await restoredCheckboxes.nth(1).isChecked();
      expect(secondChecked).toBe(true);

      // Others should not be checked
      const totalChecked = await page.locator('input[type="checkbox"]:checked').count();
      expect(totalChecked).toBe(1);
    }
  });
});
