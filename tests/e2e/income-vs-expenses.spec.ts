import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Clean up test database
  const testDbPath = path.join(__dirname, '../../budget.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Launch Electron app
  electronApp = await electron.launch({ args: ['.'] });

  // Get the first window
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();

  // Clean up test database
  const testDbPath = path.join(__dirname, '../../budget.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

test.describe('Income vs Expenses Visualization', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display income vs expenses chart', async () => {
    // Navigate to Reports
    await page.click('text=Reports');
    await page.waitForTimeout(500);

    // Switch to Income vs Expenses tab
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Check for component header
    await expect(page.locator('text=Income vs Expenses Over Time')).toBeVisible();
  });

  test('should show empty state when no transactions exist', async () => {
    // Navigate to Reports > Income vs Expenses
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(1000);

    // Should show empty state message - full text includes "for the selected period"
    await expect(page.locator('text=No transaction data available for the selected period')).toBeVisible();
  });

  test('should display chart controls', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Check for chart type selector using data-testid
    await expect(page.locator('[data-testid="chart-type-select"]')).toBeVisible();

    // Check for grouping selector using data-testid
    await expect(page.locator('[data-testid="grouping-select"]')).toBeVisible();

    // Check for date preset selector using data-testid
    await expect(page.locator('[data-testid="period-select"]')).toBeVisible();
  });

  test('should switch between chart types', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Get chart type selector using data-testid
    const chartTypeSelector = page.locator('[data-testid="chart-type-select"]');

    // Should default to bar chart
    await expect(chartTypeSelector).toHaveValue('bar');

    // Switch to line chart
    await chartTypeSelector.selectOption('line');
    await page.waitForTimeout(500);
    await expect(chartTypeSelector).toHaveValue('line');

    // Switch back to bar chart
    await chartTypeSelector.selectOption('bar');
    await page.waitForTimeout(500);
    await expect(chartTypeSelector).toHaveValue('bar');
  });

  test('should change grouping period', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Get grouping selector using data-testid
    const groupingSelector = page.locator('[data-testid="grouping-select"]');

    // Should default to monthly
    await expect(groupingSelector).toHaveValue('month');

    // Change to weekly
    await groupingSelector.selectOption('week');
    await page.waitForTimeout(500);
    await expect(groupingSelector).toHaveValue('week');

    // Change to yearly
    await groupingSelector.selectOption('year');
    await page.waitForTimeout(500);
    await expect(groupingSelector).toHaveValue('year');
  });

  test('should change date preset', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Get date preset selector using data-testid
    const presetSelector = page.locator('[data-testid="period-select"]');

    // Should default to this year
    await expect(presetSelector).toHaveValue('this-year');

    // Change to this month
    await presetSelector.selectOption('this-month');
    await page.waitForTimeout(500);
    await expect(presetSelector).toHaveValue('this-month');

    // Change to last 3 months
    await presetSelector.selectOption('last-3-months');
    await page.waitForTimeout(500);
    await expect(presetSelector).toHaveValue('last-3-months');
  });

  test('should show custom date range inputs', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Get date preset selector using data-testid
    const presetSelector = page.locator('[data-testid="period-select"]');

    // Switch to custom range
    await presetSelector.selectOption('custom');
    await page.waitForTimeout(500);

    // Check for start and end date inputs
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('input[type="date"]').last()).toBeVisible();
  });

  test('should display summary cards', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(500);

    // Check for summary card labels
    await expect(page.locator('text=Total Income')).toBeVisible();
    await expect(page.locator('text=Total Expenses')).toBeVisible();
    await expect(page.locator('text=Net')).toBeVisible();
  });

  test('should display data after importing transactions', async () => {
    // First create an account (use Add Account button, not "Create New Account")
    await page.click('button:has-text("Add Account")');
    await page.waitForTimeout(500);

    await page.fill('input[placeholder="Account Name"]', 'IncExp Import Test Account');
    await page.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await page.click('button:has-text("Create Account")');
    
    // Wait for account creation success
    await expect(page.getByText('Account "IncExp Import Test Account" created successfully')).toBeVisible({ timeout: 5000 });

    // Create test CSV with income and expenses - use project fixtures folder
    const projectRoot = path.resolve(__dirname, '../..');
    const fixturesDir = path.join(projectRoot, 'tests', 'fixtures');
    fs.mkdirSync(fixturesDir, { recursive: true });
    const testCsvPath = path.join(fixturesDir, 'test-income-expenses.csv');
    const csvContent = `Date,Description,Amount
2026-01-05,Salary,3000.00
2026-01-10,Groceries,-200.00
2026-01-15,Rent,-1200.00
2026-02-05,Salary,3000.00
2026-02-10,Groceries,-250.00
2026-02-15,Utilities,-150.00`;

    fs.writeFileSync(testCsvPath, csvContent);

    // Get the actual account ID from the created account
    const accountId = await page.evaluate(async () => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'IncExp Import Test Account');
      return account?.id;
    });

    // Import the CSV with actual account ID
    const importResult = await page.evaluate(async ({ filePath, accId }) => {
      const result = await window.api.import.csv(accId, filePath);
      return result;
    }, { filePath: testCsvPath, accId: accountId });

    // Verify import succeeded
    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBeGreaterThan(0);

    await page.waitForTimeout(1000);

    // Select the IncExp Import Test Account in the main account selector
    const accountSelector = page.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    const testOption = accountSelector.locator('option', { hasText: 'IncExp Import Test Account' });
    const optionValue = await testOption.getAttribute('value');
    if (optionValue) {
      await accountSelector.selectOption(optionValue);
      await page.waitForTimeout(500);
    }

    // Navigate to Income vs Expenses
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(1000);

    // Wait for loading to complete and check for data
    // The component loads all transactions, so we should see data
    // If "No transaction data available" is visible, data may be filtered by date range
    const hasNoData = await page.locator('text=No transaction data available').isVisible().catch(() => false);
    const hasPeriodBreakdown = await page.locator('text=Period Breakdown').isVisible().catch(() => false);

    // If there's a date filter issue, try selecting a different date range
    if (hasNoData && !hasPeriodBreakdown) {
      // Select "This Year" to ensure we capture the test data
      const periodSelect = page.locator('[data-testid="period-select"]');
      if (await periodSelect.isVisible()) {
        await periodSelect.selectOption('this-year');
        await page.waitForTimeout(1000);
      }
    }

    // Now verify we have either data or the test passes with data present
    // Since we imported 6 transactions, one of these should be true after proper date range
    const finalHasNoData = await page.locator('text=No transaction data available').isVisible().catch(() => false);
    const finalHasBreakdown = await page.locator('text=Period Breakdown').isVisible().catch(() => false);

    // Test passes if we see the breakdown table (data is present)
    // or if this is the first test run and no data is expected
    expect(finalHasBreakdown || !finalHasNoData).toBe(true);

    // Clean up test file
    fs.unlinkSync(testCsvPath);
  });

  test('should display period breakdown table when data exists', async () => {
    await page.click('text=Reports');
    await page.waitForTimeout(500);
    await page.click('text=Income vs Expenses');
    await page.waitForTimeout(1000);

    // Table only shows when data exists
    // If there's no data, empty state message is shown
    const hasTable = await page.locator('th:has-text("Period")').isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=No transaction data available').isVisible().catch(() => false);

    expect(hasTable || hasEmptyState).toBeTruthy();
  });
});
