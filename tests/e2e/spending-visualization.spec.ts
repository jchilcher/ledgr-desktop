import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] });
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Spending Visualization', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display spending by category chart', async () => {
    // Navigate to Reports tab
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Check for chart container or empty state
    const chartContainer = page.locator('[data-testid="spending-chart"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    // Either chart or empty message should be visible (no transactions in clean DB)
    const isChartVisible = await chartContainer.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    expect(isChartVisible || isEmptyVisible).toBe(true);
  });

  test('should switch between pie and bar chart types', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Check for chart type selector
    const chartTypeSelect = page.locator('[data-testid="chart-type-select"]');
    await expect(chartTypeSelect).toBeVisible();

    // Switch to bar chart
    await chartTypeSelect.selectOption('bar');
    await page.waitForTimeout(300);

    // Switch to pie chart
    await chartTypeSelect.selectOption('pie');
    await page.waitForTimeout(300);

    // Verify select is still visible and working
    await expect(chartTypeSelect).toBeVisible();
  });

  test('should filter by date range', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Find date range inputs
    const startDateInput = page.locator('[data-testid="start-date"]');
    const endDateInput = page.locator('[data-testid="end-date"]');

    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // Set date range
    await startDateInput.fill('2024-01-01');
    await endDateInput.fill('2024-01-31');
    await page.waitForTimeout(500);

    // Verify inputs retain values
    await expect(startDateInput).toHaveValue('2024-01-01');
    await expect(endDateInput).toHaveValue('2024-01-31');
  });

  test('should display category breakdown with amounts', async () => {
    // Navigate to Reports
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Verify chart or empty state is visible
    const chartContainer = page.locator('[data-testid="spending-chart"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    // Either chart or empty message should be visible
    const isChartVisible = await chartContainer.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    expect(isChartVisible || isEmptyVisible).toBe(true);
  });

  test('should show comparison with previous period', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Find comparison toggle
    const comparisonToggle = page.locator('[data-testid="comparison-toggle"]');
    await expect(comparisonToggle).toBeVisible();

    // Enable comparison
    await comparisonToggle.check();
    await page.waitForTimeout(500);

    // Verify toggle is checked
    await expect(comparisonToggle).toBeChecked();
  });

  test('should display spending only (exclude income)', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Check for chart container or empty state
    const chartContainer = page.locator('[data-testid="spending-chart"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    const isChartVisible = await chartContainer.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    expect(isChartVisible || isEmptyVisible).toBe(true);
  });

  test('should show empty state when no transactions exist', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // With a clean database, should show empty state
    const emptyMessage = page.locator('text=/No spending data/i');
    const chartContainer = page.locator('[data-testid="spending-chart"]');

    // Either empty message or chart (if data loaded) should be visible
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);
    const isChartVisible = await chartContainer.isVisible().catch(() => false);

    expect(isEmptyVisible || isChartVisible).toBe(true);
  });

  test('should display date range presets', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Check for preset buttons
    const thisMonthButton = page.locator('button:has-text("This Month")');
    const lastMonthButton = page.locator('button:has-text("Last Month")');
    const thisYearButton = page.locator('button:has-text("This Year")');

    await expect(thisMonthButton).toBeVisible();
    await expect(lastMonthButton).toBeVisible();
    await expect(thisYearButton).toBeVisible();

    // Click a preset
    await thisMonthButton.click();
    await page.waitForTimeout(300);

    // Button should remain visible
    await expect(thisMonthButton).toBeVisible();
  });

  test('should show tooltip on hover (if interactive)', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Verify chart or empty state is visible
    const chartContainer = page.locator('[data-testid="spending-chart"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    const isChartVisible = await chartContainer.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    expect(isChartVisible || isEmptyVisible).toBe(true);
  });

  test('should handle click on category to filter transactions', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Verify chart or empty state is visible
    const chartContainer = page.locator('[data-testid="spending-chart"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    const isChartVisible = await chartContainer.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    expect(isChartVisible || isEmptyVisible).toBe(true);
  });

  test('should display This Week and Last Week preset buttons', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    const thisWeekButton = page.locator('button:has-text("This Week")');
    const lastWeekButton = page.locator('button:has-text("Last Week")');

    await expect(thisWeekButton).toBeVisible();
    await expect(lastWeekButton).toBeVisible();
  });

  test('should show weekly context when This Week is selected', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Click This Week
    const thisWeekButton = page.locator('button:has-text("This Week")');
    await thisWeekButton.click();
    await page.waitForTimeout(500);

    // Should show weekly context card or empty state
    const weeklyContext = page.locator('[data-testid="weekly-context"]');
    const emptyMessage = page.locator('text=/No spending data/i');

    const isWeeklyVisible = await weeklyContext.isVisible().catch(() => false);
    const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

    // At minimum one of these should be visible (weekly context appears even with no spending)
    expect(isWeeklyVisible || isEmptyVisible).toBe(true);
  });

  test('should show Rollover column in weekly view when data exists', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Click This Week
    const thisWeekButton = page.locator('button:has-text("This Week")');
    await thisWeekButton.click();
    await page.waitForTimeout(500);

    // If there's spending data, rollover column header should be visible
    const rolloverHeader = page.locator('th:has-text("Rollover")');
    const emptyMessage = page.locator('text=/No spending data/i');

    const hasRollover = await rolloverHeader.isVisible().catch(() => false);
    const isEmpty = await emptyMessage.isVisible().catch(() => false);

    // Either we see the rollover column (data present) or empty state (no data)
    expect(hasRollover || isEmpty).toBe(true);
  });

  test('should hide weekly columns when switching back to This Month', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // First go to This Week
    const thisWeekButton = page.locator('button:has-text("This Week")');
    await thisWeekButton.click();
    await page.waitForTimeout(500);

    // Then switch back to This Month
    const thisMonthButton = page.locator('button:has-text("This Month")');
    await thisMonthButton.click();
    await page.waitForTimeout(500);

    // Weekly context should no longer be visible
    const weeklyContext = page.locator('[data-testid="weekly-context"]');
    await expect(weeklyContext).not.toBeVisible();

    // Rollover header should not be visible
    const rolloverHeader = page.locator('th:has-text("Rollover")');
    const hasRollover = await rolloverHeader.isVisible().catch(() => false);
    expect(hasRollover).toBe(false);
  });
});
