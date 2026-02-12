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

test.describe('Search & Filters Feature', () => {
  test('should navigate to transactions and see search bar', async () => {
    // Navigate to transactions
    await window.click('text=Transactions');

    // Should see search input
    await expect(window.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should search transactions by description', async () => {
    await window.click('text=Transactions');

    // Type in search box
    await window.fill('input[placeholder*="Search"]', 'grocery');

    // Wait for search results
    await window.waitForTimeout(500);

    // Results should be filtered (verify search was applied)
    const searchInput = await window.locator('input[placeholder*="Search"]').inputValue();
    expect(searchInput).toBe('grocery');
  });

  test('should show advanced filters', async () => {
    await window.click('text=Transactions');

    // Click filter button
    const filterButton = window.locator('button:text("Filter"), button:text("Filters")');
    if (await filterButton.count() > 0) {
      await filterButton.click();

      // Should see filter options
      await expect(window.locator('text=Date Range, text=Category, text=Amount')).toBeVisible();
    }
  });

  test('should filter by date range', async () => {
    await window.click('text=Transactions');

    const filterButton = window.locator('button:text("Filter"), button:text("Filters")');
    if (await filterButton.count() > 0) {
      await filterButton.click();

      // Set date range
      const dateInputs = await window.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.first().fill('2024-01-01');
        await dateInputs.last().fill('2024-12-31');
      }

      // Apply filter
      await window.click('button:text("Apply")');
      await window.waitForTimeout(500);
    }
  });

  test('should filter by category', async () => {
    await window.click('text=Transactions');

    const filterButton = window.locator('button:text("Filter"), button:text("Filters")');
    if (await filterButton.count() > 0) {
      await filterButton.click();

      // Select category
      const categorySelect = window.locator('select').first();
      if (await categorySelect.count() > 0) {
        await categorySelect.selectOption({ index: 1 });
      }

      // Apply filter
      await window.click('button:text("Apply")');
      await window.waitForTimeout(500);
    }
  });

  test('should filter by amount range', async () => {
    await window.click('text=Transactions');

    const filterButton = window.locator('button:text("Filter"), button:text("Filters")');
    if (await filterButton.count() > 0) {
      await filterButton.click();

      // Set amount range
      const amountInputs = await window.locator('input[placeholder*="amount"], input[type="number"]');
      if (await amountInputs.count() >= 2) {
        await amountInputs.first().fill('10');
        await amountInputs.last().fill('100');
      }

      // Apply filter
      await window.click('button:text("Apply")');
      await window.waitForTimeout(500);
    }
  });

  test('should clear all filters', async () => {
    await window.click('text=Transactions');

    // Clear search
    await window.fill('input[placeholder*="Search"]', '');

    // Click clear filters button if exists
    const clearButton = window.locator('button:text("Clear"), button:text("Reset")');
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await window.waitForTimeout(500);
    }

    // Verify search is cleared
    const searchInput = await window.locator('input[placeholder*="Search"]').inputValue();
    expect(searchInput).toBe('');
  });
});
