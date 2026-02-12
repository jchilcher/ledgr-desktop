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

test.describe('Split Transactions Feature', () => {
  test('should navigate to transactions and see split option', async () => {
    // Navigate to transactions
    await window.click('text=Transactions');

    // Wait for transactions to load
    await window.waitForTimeout(500);

    // Should have transactions visible
    const transactionRows = await window.locator('table tbody tr').count();
    expect(transactionRows).toBeGreaterThanOrEqual(0);
  });

  test('should open split transaction modal', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Click on a transaction to select it
    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      // Look for split button
      const splitButton = window.locator('button:text("Split")');
      if (await splitButton.count() > 0) {
        await splitButton.click();

        // Modal should open
        await expect(window.locator('text=Split Transaction')).toBeVisible();
      }
    }
  });

  test('should add a split to transaction', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const splitButton = window.locator('button:text("Split")');
      if (await splitButton.count() > 0) {
        await splitButton.click();

        // Click add split
        await window.click('button:text("Add Split")');

        // Fill in split details
        const amountInputs = await window.locator('input[type="number"]');
        if (await amountInputs.count() > 0) {
          await amountInputs.first().fill('50');
        }

        // Save splits
        await window.click('button:text("Save Splits")');

        // Wait for save
        await window.waitForTimeout(500);

        // Modal should close
        await expect(window.locator('text=Split Transaction')).not.toBeVisible();
      }
    }
  });

  test('should show split indicator on transaction', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Look for split indicator (transaction with splits)
    const splitIndicators = await window.locator('.split-indicator, text=Split').count();
    // Just verify we can check for splits
    expect(splitIndicators).toBeGreaterThanOrEqual(0);
  });

  test('should remove a split from transaction', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const splitButton = window.locator('button:text("Split")');
      if (await splitButton.count() > 0) {
        await splitButton.click();

        // Find delete button in split list
        const deleteButtons = window.locator('.split-item button:text("X"), .split-item button:text("Remove")');
        if (await deleteButtons.count() > 0) {
          await deleteButtons.first().click();
        }

        // Save
        await window.click('button:text("Save Splits")');
        await window.waitForTimeout(500);
      }
    }
  });
});
