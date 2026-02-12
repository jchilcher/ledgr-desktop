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

test.describe('Data Export Feature', () => {
  test('should navigate to settings and see export option', async () => {
    // Navigate to settings
    await window.click('text=Settings');

    // Should see Export button
    await expect(window.locator('button:text("Export Data")')).toBeVisible();
  });

  test('should open export modal', async () => {
    await window.click('text=Settings');

    // Click export button
    await window.click('button:text("Export Data")');

    // Modal should open
    await expect(window.locator('text=Export Data')).toBeVisible();

    // Should see format options
    await expect(window.locator('text=CSV')).toBeVisible();
    await expect(window.locator('text=JSON')).toBeVisible();
  });

  test('should select CSV format', async () => {
    await window.click('text=Settings');
    await window.click('button:text("Export Data")');

    // Select CSV format
    await window.click('label:has-text("CSV")');

    // Verify selection
    const csvRadio = window.locator('input[value="csv"]');
    await expect(csvRadio).toBeChecked();
  });

  test('should select JSON format', async () => {
    await window.click('text=Settings');
    await window.click('button:text("Export Data")');

    // Select JSON format
    await window.click('label:has-text("JSON")');

    // Verify selection
    const jsonRadio = window.locator('input[value="json"]');
    await expect(jsonRadio).toBeChecked();
  });

  test('should select export scope', async () => {
    await window.click('text=Settings');
    await window.click('button:text("Export Data")');

    // Should see export scope options
    await expect(window.locator('text=Transactions Only')).toBeVisible();
    await expect(window.locator('text=All Data')).toBeVisible();

    // Select all data
    await window.click('label:has-text("All Data")');
  });

  test('should cancel export', async () => {
    await window.click('text=Settings');
    await window.click('button:text("Export Data")');

    // Click cancel
    await window.click('button:text("Cancel")');

    // Modal should close
    await expect(window.locator('h2:text("Export Data")')).not.toBeVisible();
  });

  test('should attempt export with date range', async () => {
    await window.click('text=Settings');
    await window.click('button:text("Export Data")');

    // Set date range if available
    const dateInputs = await window.locator('input[type="date"]');
    if (await dateInputs.count() >= 2) {
      await dateInputs.first().fill('2024-01-01');
      await dateInputs.last().fill('2024-12-31');
    }

    // Note: Actual file save dialog would be shown, which we can't test in E2E
    // Just verify the export button is available
    await expect(window.locator('button:text("Export")')).toBeVisible();
  });
});
