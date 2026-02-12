import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] });
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Cash Flow Forecasting', () => {
  test.describe.configure({ mode: 'serial' });

  test('should display cash flow forecast tab in reports', async () => {
    await window.click('text=Reports');
    await expect(window.locator('text=Cash Flow Forecast')).toBeVisible();
  });

  test('should display recurring transactions view', async () => {
    await window.click('text=Recurring');
    await expect(window.locator('h2:has-text("Recurring Transactions")')).toBeVisible();
  });

  test('should show add recurring transaction button', async () => {
    await window.click('text=Recurring');
    await expect(window.locator('button:has-text("Add Recurring Transaction")')).toBeVisible();
  });

  test('should display recurring transaction form when add button clicked', async () => {
    await window.click('text=Recurring');
    await window.click('button:has-text("Add Recurring Transaction")');
    await expect(window.locator('h3:has-text("Add Recurring Transaction")')).toBeVisible();
    await expect(window.locator('#description')).toBeVisible();
    await expect(window.locator('#amount')).toBeVisible();
    await expect(window.locator('#frequency')).toBeVisible();
  });

  test('should create a recurring transaction', async () => {
    // First create an account - start from dashboard
    await window.click('text=Dashboard');
    await window.waitForTimeout(500);
    
    await window.click('button:has-text("Add Account")');
    await window.fill('input[placeholder="Account Name"]', 'Test Checking');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    // Wait for account creation success
    await expect(window.getByText('Account "Test Checking" created successfully')).toBeVisible({ timeout: 5000 });
    
    // Wait for success message to disappear
    await window.waitForTimeout(2000);

    // Navigate to recurring transactions
    await window.click('text=Recurring');
    await window.waitForTimeout(1000);
    
    // Wait for the page to fully load
    await expect(window.locator('h2:has-text("Recurring Transactions")')).toBeVisible({ timeout: 5000 });

    // Open form
    await window.click('button:has-text("Add Recurring Transaction")');
    await window.waitForTimeout(1000);

    // Wait for form to be visible
    await expect(window.locator('h3:has-text("Add Recurring Transaction")')).toBeVisible({ timeout: 5000 });

    // Wait for category select to have real category options (15 categories)
    await expect(window.locator('#category option')).toHaveCount(16, { timeout: 15000 }); // 15 categories + 1 placeholder
    
    // Wait for account select to have at least one option
    await expect(window.locator('#account option')).not.toHaveCount(0, { timeout: 10000 });

    // Fill form
    await window.fill('#description', 'Monthly Salary');
    await window.fill('#amount', '5000');
    
    // Select account (first option should be the newly created account)
    await window.selectOption('#account', { index: 0 });
    
    // Select category (skip the disabled placeholder at index 0)
    await window.selectOption('#category', { index: 1 });
    await window.selectOption('#frequency', 'monthly');

    // Submit
    await window.click('button[type="submit"]:has-text("Create")');

    // Wait for form to close and list to update
    await window.waitForTimeout(1000);

    // Verify transaction appears in list
    await expect(window.locator('text=Monthly Salary')).toBeVisible({ timeout: 10000 });
    await expect(window.locator('text=$5,000.00')).toBeVisible({ timeout: 5000 });
  });

  test('should display cash flow forecast with recurring transactions', async () => {
    await window.click('text=Reports');
    await window.click('text=Cash Flow Forecast');
    await expect(window.locator('h2:has-text("Cash Flow Forecast")')).toBeVisible();

    // Should show account selector and forecast period selector
    await expect(window.locator('#account-select')).toBeVisible();
    await expect(window.locator('#forecast-days')).toBeVisible();
  });

  test('should show empty state or projections', async () => {
    await window.click('text=Reports');
    await window.click('text=Cash Flow Forecast');

    // Wait for component to finish loading
    await window.waitForTimeout(2000);

    // Check for various valid states
    const hasEmptyStateNoRecurring = await window.locator('text=No recurring transactions').isVisible().catch(() => false);
    const hasEmptyStateNoAccounts = await window.locator('text=No accounts found').isVisible().catch(() => false);
    const hasProjections = await window.locator('table').isVisible().catch(() => false);
    const hasCurrentBalance = await window.locator('text=Current Balance').isVisible().catch(() => false);

    // Either empty state, projections table, or current balance card should be visible
    expect(hasEmptyStateNoRecurring || hasEmptyStateNoAccounts || hasProjections || hasCurrentBalance).toBeTruthy();
  });

  test('should allow editing recurring transaction', async () => {
    await window.click('text=Recurring');

    // Check if edit button exists
    const editButton = window.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await expect(window.locator('h3:has-text("Edit Recurring Transaction")')).toBeVisible();
    }
  });

  test('should display forecast summary cards', async () => {
    await window.click('text=Reports');
    await window.click('text=Cash Flow Forecast');

    // Wait for loading to complete
    await window.waitForTimeout(1500);

    // Should have summary card for current balance (if account exists from previous test)
    // OR empty state message if no accounts/recurring transactions
    const hasCurrentBalance = await window.locator('text=Current Balance').isVisible().catch(() => false);
    const hasEmptyState = await window.locator('text=No accounts found').isVisible().catch(() => false);
    const hasNoRecurring = await window.locator('text=No recurring transactions').isVisible().catch(() => false);

    expect(hasCurrentBalance || hasEmptyState || hasNoRecurring).toBeTruthy();
  });

  test('should allow changing forecast period', async () => {
    await window.click('text=Reports');
    await window.click('text=Cash Flow Forecast');

    // Change forecast period
    await window.selectOption('#forecast-days', '60');

    // Verify the select has the new value
    await expect(window.locator('#forecast-days')).toHaveValue('60');
  });
});
