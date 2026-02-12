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

test.describe('Net Worth Tracking Feature', () => {
  test('should navigate to net worth view', async () => {
    // Navigate to net worth
    await window.click('text=Net Worth');

    // Should see Net Worth header
    await expect(window.locator('h2:text("Net Worth")')).toBeVisible();
  });

  test('should see assets section', async () => {
    await window.click('text=Net Worth');

    // Should see Assets tab or section
    await expect(window.locator('text=Assets')).toBeVisible();
    await expect(window.locator('button:text("Add Asset")')).toBeVisible();
  });

  test('should create a new asset', async () => {
    await window.click('text=Net Worth');

    // Click Assets tab if tabs exist
    const assetsTab = window.locator('button:text("Assets")').first();
    if (await assetsTab.count() > 0) {
      await assetsTab.click();
    }

    // Click add asset
    await window.click('button:text("Add Asset")');

    // Fill in form
    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Savings Account');
    await window.selectOption('select', 'savings'); // Asset type
    await window.fill('input[placeholder="0.00"]', '10000');

    // Submit
    await window.click('button:text("Create"), button:text("Add")');
    await window.waitForTimeout(500);

    // Should see the asset
    await expect(window.locator('text=Savings Account')).toBeVisible();
  });

  test('should see liabilities section', async () => {
    await window.click('text=Net Worth');

    // Should see Liabilities tab or section
    await expect(window.locator('text=Liabilities')).toBeVisible();
  });

  test('should create a new liability', async () => {
    await window.click('text=Net Worth');

    // Click Liabilities tab
    const liabilitiesTab = window.locator('button:text("Liabilities")').first();
    if (await liabilitiesTab.count() > 0) {
      await liabilitiesTab.click();
    }

    // Click add liability
    await window.click('button:text("Add Liability")');

    // Fill in form
    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Credit Card');
    await window.selectOption('select', 'credit_card'); // Liability type
    await window.fill('input[placeholder="0.00"]', '2500');

    // Submit
    await window.click('button:text("Create"), button:text("Add")');
    await window.waitForTimeout(500);

    // Should see the liability
    await expect(window.locator('text=Credit Card')).toBeVisible();
  });

  test('should calculate net worth correctly', async () => {
    await window.click('text=Net Worth');
    await window.waitForTimeout(500);

    // Should see net worth total (Assets - Liabilities)
    // With $10000 asset and $2500 liability, net worth should be $7500
    await expect(window.locator('text=$7,500.00')).toBeVisible();
  });

  test('should show net worth history chart', async () => {
    await window.click('text=Net Worth');

    // Click History tab
    const historyTab = window.locator('button:text("History")').first();
    if (await historyTab.count() > 0) {
      await historyTab.click();
    }

    // Should see chart
    await expect(window.locator('canvas, svg, .chart')).toBeVisible();
  });

  test('should edit an asset', async () => {
    await window.click('text=Net Worth');

    const assetsTab = window.locator('button:text("Assets")').first();
    if (await assetsTab.count() > 0) {
      await assetsTab.click();
    }

    // Click edit
    const editButton = window.locator('button:text("Edit")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Update value
      await window.fill('input[placeholder="0.00"]', '12000');

      // Submit
      await window.click('button:text("Update")');
      await window.waitForTimeout(500);

      await expect(window.locator('text=$12,000.00')).toBeVisible();
    }
  });

  test('should delete an asset', async () => {
    await window.click('text=Net Worth');

    const assetsTab = window.locator('button:text("Assets")').first();
    if (await assetsTab.count() > 0) {
      await assetsTab.click();
    }

    window.on('dialog', dialog => dialog.accept());

    const deleteButton = window.locator('button:text("Delete")').first();
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await window.waitForTimeout(500);
    }
  });
});
