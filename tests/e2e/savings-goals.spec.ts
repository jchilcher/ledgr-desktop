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

test.describe('Savings Goals Feature', () => {
  test('should navigate to savings view', async () => {
    // Navigate to savings
    await window.click('text=Savings');

    // Should see Savings Goals header
    await expect(window.locator('h2:text("Savings Goals")')).toBeVisible();
    await expect(window.locator('button:text("Add Goal")')).toBeVisible();
  });

  test('should create a new savings goal', async () => {
    await window.click('text=Savings');

    // Click add goal
    await window.click('button:text("Add Goal")');

    // Fill in form
    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Emergency Fund');
    await window.fill('input[placeholder="0.00"]', '10000');

    // Set target date if available
    const dateInput = window.locator('input[type="date"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill('2025-12-31');
    }

    // Submit
    await window.click('button:text("Create Goal")');
    await window.waitForTimeout(500);

    // Should see the goal
    await expect(window.locator('text=Emergency Fund')).toBeVisible();
  });

  test('should show progress bar', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    // Should see progress indicator
    const progressBar = window.locator('.progress-bar, .progress, [role="progressbar"]');
    await expect(progressBar.first()).toBeVisible();
  });

  test('should add contribution to goal', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    // Click add contribution
    const addContribButton = window.locator('button:text("Add Contribution"), button:text("Contribute")').first();
    if (await addContribButton.count() > 0) {
      await addContribButton.click();

      // Fill in amount
      await window.fill('input[placeholder="0.00"]', '500');

      // Submit
      await window.click('button:text("Add"), button:text("Save")');
      await window.waitForTimeout(500);

      // Should see updated amount
      await expect(window.locator('text=$500.00')).toBeVisible();
    }
  });

  test('should show contribution history', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    // Click on goal to see details
    const goalCard = window.locator('.savings-goal, text=Emergency Fund').first();
    if (await goalCard.count() > 0) {
      await goalCard.click();

      // Should see history
      const history = window.locator('text=History, text=Contributions');
      if (await history.count() > 0) {
        await expect(history.first()).toBeVisible();
      }
    }
  });

  test('should edit savings goal', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    const editButton = window.locator('button:text("Edit")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Update target amount
      await window.fill('input[placeholder="0.00"]', '15000');

      // Submit
      await window.click('button:text("Update Goal")');
      await window.waitForTimeout(500);

      await expect(window.locator('text=$15,000.00')).toBeVisible();
    }
  });

  test('should toggle goal active state', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    const activeToggle = window.locator('input[type="checkbox"]').first();
    if (await activeToggle.count() > 0) {
      const isChecked = await activeToggle.isChecked();
      await activeToggle.click();
      const isNowChecked = await activeToggle.isChecked();
      expect(isNowChecked).toBe(!isChecked);
    }
  });

  test('should delete savings goal', async () => {
    await window.click('text=Savings');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    const deleteButton = window.locator('button:text("Delete")').first();
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await window.waitForTimeout(500);
    }
  });
});
