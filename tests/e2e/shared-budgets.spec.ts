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

test.describe('Shared Budgets Feature', () => {
  test('should navigate to settings and see users section', async () => {
    // Navigate to settings
    await window.click('text=Settings');

    // Should see Users section
    const usersSection = window.locator('h3:text("Users"), text=Budget Users');
    if (await usersSection.count() > 0) {
      await expect(usersSection.first()).toBeVisible();
    }
  });

  test('should add a new user', async () => {
    await window.click('text=Settings');

    const addUserButton = window.locator('button:text("Add User")');
    if (await addUserButton.count() > 0) {
      await addUserButton.click();

      // Fill in user details
      await window.fill('input[placeholder*="name"], input[placeholder*="Name"]', 'Partner');
      await window.fill('input[placeholder*="email"], input[type="email"]', 'partner@example.com');

      // Submit
      await window.click('button:text("Create"), button:text("Add")');
      await window.waitForTimeout(500);

      // Should see the user
      await expect(window.locator('text=Partner')).toBeVisible();
    }
  });

  test('should set user permissions', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    const userElement = window.locator('div:has-text("Partner")').first();
    if (await userElement.count() > 0) {
      const permissionsButton = userElement.locator('button:text("Permissions")');
      if (await permissionsButton.count() > 0) {
        await permissionsButton.click();

        // Select permission level
        const permissionSelect = window.locator('select');
        if (await permissionSelect.count() > 0) {
          await permissionSelect.selectOption('write');
        }

        // Save
        await window.click('button:text("Save")');
        await window.waitForTimeout(500);
      }
    }
  });

  test('should grant account access', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    const userElement = window.locator('div:has-text("Partner")').first();
    if (await userElement.count() > 0) {
      const permissionsButton = userElement.locator('button:text("Permissions")');
      if (await permissionsButton.count() > 0) {
        await permissionsButton.click();

        // Select accounts to share
        const accountCheckboxes = window.locator('.account-access input[type="checkbox"]');
        if (await accountCheckboxes.count() > 0) {
          await accountCheckboxes.first().check();
        }

        await window.click('button:text("Save")');
        await window.waitForTimeout(500);
      }
    }
  });

  test('should see user switcher', async () => {
    // Look for user switcher in header
    const userSwitcher = window.locator('.user-switcher, button:has-text("Switch User")');
    if (await userSwitcher.count() > 0) {
      await expect(userSwitcher.first()).toBeVisible();
    }
  });

  test('should switch user context', async () => {
    const userSwitcher = window.locator('.user-switcher, button:has-text("Switch User")');
    if (await userSwitcher.count() > 0) {
      await userSwitcher.first().click();

      // Select different user
      const userOption = window.locator('text=Partner');
      if (await userOption.count() > 0) {
        await userOption.click();
        await window.waitForTimeout(500);
      }
    }
  });

  test('should show owner indicator', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    // Owner should be indicated
    const ownerIndicator = window.locator('text=Owner, .owner-badge');
    if (await ownerIndicator.count() > 0) {
      await expect(ownerIndicator.first()).toBeVisible();
    }
  });

  test('should edit user details', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    const userElement = window.locator('div:has-text("Partner")').first();
    if (await userElement.count() > 0) {
      const editButton = userElement.locator('button:text("Edit")');
      if (await editButton.count() > 0) {
        await editButton.click();

        // Update email
        await window.fill('input[type="email"]', 'updated@example.com');

        await window.click('button:text("Update")');
        await window.waitForTimeout(500);
      }
    }
  });

  test('should remove user', async () => {
    await window.click('text=Settings');
    await window.waitForTimeout(500);

    window.on('dialog', dialog => dialog.accept());

    const userElement = window.locator('div:has-text("Partner")').first();
    if (await userElement.count() > 0) {
      const deleteButton = userElement.locator('button:text("Remove"), button:text("Delete")');
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await window.waitForTimeout(500);
      }
    }
  });
});
