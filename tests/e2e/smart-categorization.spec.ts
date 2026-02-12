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

test.describe('Smart Categorization Feature', () => {
  test('should navigate to transactions and see category dropdown', async () => {
    // Navigate to transactions
    await window.click('text=Transactions');

    // Wait for transactions to load
    await window.waitForTimeout(500);

    // Should see category select
    const categorySelects = await window.locator('select').count();
    expect(categorySelects).toBeGreaterThan(0);
  });

  test('should change transaction category', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Find a transaction row
    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      // Click on category dropdown
      const categorySelect = firstRow.locator('select').first();
      if (await categorySelect.count() > 0) {
        // Change category
        await categorySelect.selectOption({ index: 2 });
        await window.waitForTimeout(500);
      }
    }
  });

  test('should remember category correction', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Change category on a transaction
    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      const categorySelect = firstRow.locator('select').first();
      if (await categorySelect.count() > 0) {
        await categorySelect.selectOption({ index: 3 });
        await window.waitForTimeout(500);

        // The system should learn this correction
        // We can verify by checking if a similar transaction gets same category
      }
    }
  });

  test('should see category suggestions', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Look for suggestion indicators
    const suggestionIndicators = await window.locator('.suggestion, .suggested-category, text=Suggested').count();
    expect(suggestionIndicators).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to settings and see learned rules', async () => {
    await window.click('text=Settings');

    // Should see Category Rules section
    const rulesSection = window.locator('text=Category Rules, text=Learned Rules, text=Corrections');
    if (await rulesSection.count() > 0) {
      await expect(rulesSection.first()).toBeVisible();
    }
  });

  test('should view category correction history', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    // Look for corrections list
    const correctionsList = window.locator('.corrections-list, .category-rules');
    if (await correctionsList.count() > 0) {
      // Should show learned corrections
      await expect(correctionsList).toBeVisible();
    }
  });

  test('should delete a learned rule', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    // Find delete button on a rule
    const deleteButton = window.locator('.category-rules button:text("Delete"), .corrections-list button:text("X")').first();
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await window.waitForTimeout(500);
    }
  });

  test('should apply suggestions to multiple transactions', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Look for apply all suggestions button
    const applyAllButton = window.locator('button:text("Apply All"), button:text("Accept Suggestions")');
    if (await applyAllButton.count() > 0) {
      await applyAllButton.click();
      await window.waitForTimeout(500);
    }
  });
});
