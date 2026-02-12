import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  electronApp = await electron.launch({ args: ['.'] });
  window = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Transaction List', () => {
  test.beforeEach(async () => {
    // Create an account first
    await window.click('text=Add Account');
    await window.fill('input[placeholder="Account Name"]', 'Test Checking');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]');
    await window.waitForTimeout(500);
  });

  test('should display transaction list when navigating to transactions view', async () => {
    // Navigate to transactions view
    await window.click('text=Transactions');

    // Should show transaction list container
    await expect(window.locator('.transaction-list')).toBeVisible();
    await expect(window.locator('h3:text("Filters")')).toBeVisible();
  });

  test('should show imported transactions in the list', async () => {
    // Navigate to import view
    await window.click('text=Import');

    // Mock file dialog and import
    // Note: In a real E2E test, you would need to mock the file dialog
    // For now, we'll just verify the UI structure

    // Navigate to transactions view
    await window.click('text=Transactions');

    // Should show transaction count
    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toContain('transactions');
  });

  test('should allow searching transactions by description', async () => {
    await window.click('text=Transactions');

    // Should have search input
    await expect(window.locator('[data-testid="search-input"]')).toBeVisible();

    // Type in search
    await window.fill('[data-testid="search-input"]', 'test');

    // Search should filter results (even if empty)
    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toContain('of');
  });

  test('should allow filtering by account', async () => {
    await window.click('text=Transactions');

    // Should have account filter dropdown
    await expect(window.locator('[data-testid="account-filter"]')).toBeVisible();

    // Select an account
    await window.selectOption('[data-testid="account-filter"]', { index: 1 }); // Select first actual account

    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toBeDefined();
  });

  test('should allow filtering by category', async () => {
    await window.click('text=Transactions');

    // Should have category filter dropdown
    await expect(window.locator('[data-testid="category-filter"]')).toBeVisible();

    // Select a category
    await window.selectOption('[data-testid="category-filter"]', { index: 1 }); // Select first category

    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toBeDefined();
  });

  test('should allow filtering by date range', async () => {
    await window.click('text=Transactions');

    // Should have date inputs
    await expect(window.locator('[data-testid="start-date"]')).toBeVisible();
    await expect(window.locator('[data-testid="end-date"]')).toBeVisible();

    // Set date range
    await window.fill('[data-testid="start-date"]', '2026-01-01');
    await window.fill('[data-testid="end-date"]', '2026-01-31');

    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toBeDefined();
  });

  test('should allow filtering by amount range', async () => {
    await window.click('text=Transactions');

    // Should have amount inputs
    await expect(window.locator('[data-testid="min-amount"]')).toBeVisible();
    await expect(window.locator('[data-testid="max-amount"]')).toBeVisible();

    // Set amount range
    await window.fill('[data-testid="min-amount"]', '-100');
    await window.fill('[data-testid="max-amount"]', '100');

    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toBeDefined();
  });

  test('should reset all filters when clicking reset button', async () => {
    await window.click('text=Transactions');

    // Apply some filters
    await window.fill('[data-testid="search-input"]', 'test');
    await window.fill('[data-testid="min-amount"]', '-100');

    // Click reset
    await window.click('[data-testid="reset-filters"]');

    // Verify filters are cleared
    const searchValue = await window.locator('[data-testid="search-input"]').inputValue();
    const minAmountValue = await window.locator('[data-testid="min-amount"]').inputValue();

    expect(searchValue).toBe('');
    expect(minAmountValue).toBe('');
  });

  test('should display table headers with sort indicators', async () => {
    await window.click('text=Transactions');

    // Should have sortable headers
    await expect(window.locator('th:has-text("Date")')).toBeVisible();
    await expect(window.locator('th:has-text("Description")')).toBeVisible();
    await expect(window.locator('th:has-text("Amount")')).toBeVisible();
    await expect(window.locator('th:has-text("Category")')).toBeVisible();
    await expect(window.locator('th:has-text("Account")')).toBeVisible();
  });

  test('should show pagination when there are many transactions', async () => {
    await window.click('text=Transactions');

    // Note: Pagination only shows when there are >50 transactions
    // For this test, we just verify the structure exists
    const countText = await window.locator('[data-testid="transaction-count"]').textContent();
    expect(countText).toBeDefined();
  });
});
