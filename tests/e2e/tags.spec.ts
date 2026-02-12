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

test.describe('Tags Feature', () => {
  test('should navigate to settings and see tag manager', async () => {
    // Navigate to settings
    await window.click('text=Settings');

    // Should see Tag Manager section
    await expect(window.locator('h3:text("Tags")')).toBeVisible();
    await expect(window.locator('button:text("Add Tag")')).toBeVisible();
  });

  test('should create a new tag', async () => {
    await window.click('text=Settings');

    // Click add tag
    await window.click('button:text("Add Tag")');

    // Fill in tag name
    await window.fill('input[placeholder="Tag name"]', 'Vacation');

    // Submit form
    await window.click('button:text("Create")');

    // Wait for tag to appear
    await window.waitForTimeout(500);

    // Should see the new tag
    await expect(window.locator('text=Vacation')).toBeVisible();
  });

  test('should edit a tag', async () => {
    await window.click('text=Settings');

    // Wait for tags to load
    await window.waitForTimeout(500);

    // Click edit on the tag (find the edit button near "Vacation")
    const tagElement = window.locator('div:has-text("Vacation")').first();
    await tagElement.locator('button:text("Edit")').click();

    // Update the name
    await window.fill('input[placeholder="Tag name"]', 'Holiday');

    // Submit
    await window.click('button:text("Update")');

    // Wait for update
    await window.waitForTimeout(500);

    // Should see updated tag
    await expect(window.locator('text=Holiday')).toBeVisible();
  });

  test('should delete a tag', async () => {
    await window.click('text=Settings');

    // Wait for tags to load
    await window.waitForTimeout(500);

    // Find and click delete button on the tag
    const tagElement = window.locator('div:has-text("Holiday")').first();

    // Mock confirm dialog
    window.on('dialog', dialog => dialog.accept());

    await tagElement.locator('button:text("X")').click();

    // Wait for deletion
    await window.waitForTimeout(500);

    // Tag should be gone
    await expect(window.locator('text=Holiday')).not.toBeVisible();
  });
});
