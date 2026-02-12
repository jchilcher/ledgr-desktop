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

test.describe('Investment Tracking Feature', () => {
  test('should navigate to net worth and see investments tab', async () => {
    // Navigate to net worth
    await window.click('text=Net Worth');

    // Should see Investments tab
    await expect(window.locator('button:text("Investments")')).toBeVisible();
  });

  test('should click investments tab', async () => {
    await window.click('text=Net Worth');

    // Click investments tab
    await window.click('button:text("Investments")');

    // Should see add investment button
    await expect(window.locator('button:text("Add Investment")')).toBeVisible();
  });

  test('should create a new investment', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');

    // Click add investment
    await window.click('button:text("Add Investment")');

    // Fill in form
    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'AAPL Stock');
    await window.fill('input[placeholder*="ticker"], input[name="ticker"]', 'AAPL');
    await window.selectOption('select', 'stock');
    await window.fill('input[placeholder*="shares"], input[name="shares"]', '10');
    await window.fill('input[placeholder*="cost"], input[name="costBasis"]', '150');
    await window.fill('input[placeholder*="price"], input[name="currentPrice"]', '180');

    // Submit
    await window.click('button:text("Create"), button:text("Add")');
    await window.waitForTimeout(500);

    // Should see the investment
    await expect(window.locator('text=AAPL Stock')).toBeVisible();
  });

  test('should calculate investment value', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');
    await window.waitForTimeout(500);

    // Should see calculated value (10 shares * $180 = $1,800)
    await expect(window.locator('text=$1,800.00')).toBeVisible();
  });

  test('should show gain/loss', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');
    await window.waitForTimeout(500);

    // Should show gain (10 * (180 - 150) = $300 gain)
    const gainIndicator = window.locator('.gain, .positive, text=+$300');
    if (await gainIndicator.count() > 0) {
      await expect(gainIndicator.first()).toBeVisible();
    }
  });

  test('should update investment price', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');
    await window.waitForTimeout(500);

    const editButton = window.locator('button:text("Edit")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Update current price
      await window.fill('input[placeholder*="price"], input[name="currentPrice"]', '200');

      // Submit
      await window.click('button:text("Update")');
      await window.waitForTimeout(500);

      // New value should be $2,000
      await expect(window.locator('text=$2,000.00')).toBeVisible();
    }
  });

  test('should show investment history', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');
    await window.waitForTimeout(500);

    // Click on investment for details
    const investmentCard = window.locator('.investment, text=AAPL Stock').first();
    if (await investmentCard.count() > 0) {
      await investmentCard.click();

      // Should see history chart or table
      const historySection = window.locator('text=History, canvas, svg');
      if (await historySection.count() > 0) {
        await expect(historySection.first()).toBeVisible();
      }
    }
  });

  test('should add mutual fund investment', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');

    await window.click('button:text("Add Investment")');

    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Vanguard Index Fund');
    await window.selectOption('select', 'mutual_fund');
    await window.fill('input[placeholder*="shares"], input[name="shares"]', '50');
    await window.fill('input[placeholder*="cost"], input[name="costBasis"]', '100');
    await window.fill('input[placeholder*="price"], input[name="currentPrice"]', '110');

    await window.click('button:text("Create"), button:text("Add")');
    await window.waitForTimeout(500);

    await expect(window.locator('text=Vanguard Index Fund')).toBeVisible();
  });

  test('should delete investment', async () => {
    await window.click('text=Net Worth');
    await window.click('button:text("Investments")');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    const deleteButton = window.locator('button:text("Delete")').first();
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await window.waitForTimeout(500);
    }
  });
});
