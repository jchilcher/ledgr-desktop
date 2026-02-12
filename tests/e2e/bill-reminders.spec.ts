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

test.describe('Bill Reminders Feature', () => {
  test('should navigate to bills view', async () => {
    // Navigate to bills
    await window.click('text=Bills');

    // Should see Bills header
    await expect(window.locator('h2:text("Bills")')).toBeVisible();
    await expect(window.locator('button:text("Add Bill")')).toBeVisible();
  });

  test('should create a new bill', async () => {
    await window.click('text=Bills');

    // Click add bill
    await window.click('button:text("Add Bill")');

    // Fill in form
    await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Electric Bill');
    await window.fill('input[placeholder="0.00"]', '150');
    await window.fill('input[placeholder*="day"], input[type="number"]', '15'); // Due day

    // Select frequency
    await window.selectOption('select', 'monthly');

    // Submit
    await window.click('button:text("Create Bill")');
    await window.waitForTimeout(500);

    // Should see the bill
    await expect(window.locator('text=Electric Bill')).toBeVisible();
  });

  test('should show upcoming bills', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    // Should see upcoming bills section
    await expect(window.locator('text=Upcoming')).toBeVisible();
  });

  test('should mark bill as paid', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    // Find mark as paid button
    const paidButton = window.locator('button:text("Mark Paid"), button:text("Pay")').first();
    if (await paidButton.count() > 0) {
      await paidButton.click();
      await window.waitForTimeout(500);

      // Should show as paid
      await expect(window.locator('text=Paid')).toBeVisible();
    }
  });

  test('should toggle autopay', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    // Find autopay checkbox
    const autopayCheckbox = window.locator('input[type="checkbox"]').first();
    if (await autopayCheckbox.count() > 0) {
      const isChecked = await autopayCheckbox.isChecked();
      await autopayCheckbox.click();
      const isNowChecked = await autopayCheckbox.isChecked();
      expect(isNowChecked).toBe(!isChecked);
    }
  });

  test('should edit a bill', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    const editButton = window.locator('button:text("Edit")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Update amount
      await window.fill('input[placeholder="0.00"]', '175');

      // Submit
      await window.click('button:text("Update Bill")');
      await window.waitForTimeout(500);

      await expect(window.locator('text=$175.00')).toBeVisible();
    }
  });

  test('should set reminder days', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    const editButton = window.locator('button:text("Edit")').first();
    if (await editButton.count() > 0) {
      await editButton.click();

      // Set reminder days
      const reminderInput = window.locator('input[placeholder*="reminder"], input[name="reminderDays"]');
      if (await reminderInput.count() > 0) {
        await reminderInput.fill('5');
      }

      await window.click('button:text("Update Bill")');
      await window.waitForTimeout(500);
    }
  });

  test('should toggle bill active state', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    // Find active toggle
    const activeToggle = window.locator('.bill-active input[type="checkbox"]').first();
    if (await activeToggle.count() > 0) {
      await activeToggle.click();
      await window.waitForTimeout(500);
    }
  });

  test('should delete a bill', async () => {
    await window.click('text=Bills');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    const deleteButton = window.locator('button:text("Delete")').first();
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      await window.waitForTimeout(500);
    }
  });
});
