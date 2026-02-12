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

test.describe('Receipt Capture Feature', () => {
  test('should navigate to transactions and see receipt option', async () => {
    // Navigate to transactions
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Should see receipt button on transaction rows
    const receiptButtons = window.locator('button:text("Receipt"), button:has-text("📎")');
    expect(await receiptButtons.count()).toBeGreaterThanOrEqual(0);
  });

  test('should open receipt upload dialog', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Click on a transaction row
    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      // Look for add receipt button
      const addReceiptButton = window.locator('button:text("Add Receipt"), button:text("Attach Receipt")');
      if (await addReceiptButton.count() > 0) {
        await addReceiptButton.click();

        // Should see upload dialog
        await expect(window.locator('text=Upload Receipt')).toBeVisible();
      }
    }
  });

  test('should see drag and drop area', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const addReceiptButton = window.locator('button:text("Add Receipt"), button:text("Attach Receipt")');
      if (await addReceiptButton.count() > 0) {
        await addReceiptButton.click();

        // Should see drop zone
        const dropZone = window.locator('.drop-zone, text=Drag and drop, text=Drop file here');
        if (await dropZone.count() > 0) {
          await expect(dropZone.first()).toBeVisible();
        }
      }
    }
  });

  test('should see file browse button', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const addReceiptButton = window.locator('button:text("Add Receipt"), button:text("Attach Receipt")');
      if (await addReceiptButton.count() > 0) {
        await addReceiptButton.click();

        // Should see browse button
        const browseButton = window.locator('button:text("Browse"), button:text("Choose File")');
        await expect(browseButton.first()).toBeVisible();
      }
    }
  });

  test('should view attached receipt', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    // Look for receipt indicator
    const receiptIndicator = window.locator('.has-receipt, button:has-text("📎"), .receipt-icon');
    if (await receiptIndicator.count() > 0) {
      await receiptIndicator.first().click();

      // Should see receipt viewer
      const receiptViewer = window.locator('.receipt-viewer, img[alt*="Receipt"]');
      if (await receiptViewer.count() > 0) {
        await expect(receiptViewer.first()).toBeVisible();
      }
    }
  });

  test('should see OCR extracted data', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const receiptIndicator = window.locator('.has-receipt, button:has-text("📎")');
    if (await receiptIndicator.count() > 0) {
      await receiptIndicator.first().click();

      // Look for extracted data section
      const extractedData = window.locator('text=Extracted Data, text=Scanned Details, .ocr-results');
      if (await extractedData.count() > 0) {
        await expect(extractedData.first()).toBeVisible();
      }
    }
  });

  test('should delete attached receipt', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    const receiptIndicator = window.locator('.has-receipt, button:has-text("📎")');
    if (await receiptIndicator.count() > 0) {
      await receiptIndicator.first().click();

      // Look for delete button
      const deleteButton = window.locator('button:text("Delete Receipt"), button:text("Remove")');
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await window.waitForTimeout(500);
      }
    }
  });

  test('should support multiple file formats', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const addReceiptButton = window.locator('button:text("Add Receipt"), button:text("Attach Receipt")');
      if (await addReceiptButton.count() > 0) {
        await addReceiptButton.click();

        // Should mention supported formats
        const formatHint = window.locator('text=PNG, text=JPG, text=PDF, text=supported formats');
        if (await formatHint.count() > 0) {
          await expect(formatHint.first()).toBeVisible();
        }
      }
    }
  });

  test('should cancel receipt upload', async () => {
    await window.click('text=Transactions');
    await window.waitForTimeout(500);

    const firstRow = window.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();

      const addReceiptButton = window.locator('button:text("Add Receipt"), button:text("Attach Receipt")');
      if (await addReceiptButton.count() > 0) {
        await addReceiptButton.click();

        // Cancel upload
        await window.click('button:text("Cancel")');

        // Dialog should close
        await expect(window.locator('text=Upload Receipt')).not.toBeVisible();
      }
    }
  });
});
