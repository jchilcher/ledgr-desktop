import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

let electronApp: ElectronApplication;
let window: Page;

// Use committed fixture files
const fixturesDir = path.resolve(__dirname, '../fixtures');
const testOfxPath = path.join(fixturesDir, 'test-bank-statement.ofx');
const testQfxPath = path.join(fixturesDir, 'test-savings.qfx');

test.describe('OFX/QFX Import', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({ args: ['.'] });
    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should import OFX file with transactions', async () => {
    // Wait for the app to load
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account first
    await window.fill('input[placeholder="Account Name"]', 'Test OFX Account');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    // Wait for account to be created
    await expect(window.getByText('Account "Test OFX Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Wait for import button to be enabled (account must be selected)
    await window.waitForSelector('[data-testid="import-button"]:not([disabled])', { timeout: 5000 });

    // Get the selected account ID and import the file directly via API
    const importResult = await window.evaluate(async (filePath) => {
      // Get the selected account from the dropdown
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Test OFX Account');
      if (!account) throw new Error('Test OFX Account not found');
      
      // Import the file directly
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    // Verify import was successful - show error if it failed
    if (!importResult.success) {
      console.error('Import failed:', importResult.error);
    }
    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(3);

    // Navigate to transactions view
    await window.getByRole('button', { name: 'Transactions', exact: true }).click();
    await window.waitForTimeout(500);

    // Select the Test OFX Account in the main account selector
    const accountSelector = window.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    const ofxOption = accountSelector.locator('option', { hasText: 'Test OFX Account' });
    const optionValue = await ofxOption.getAttribute('value');
    await accountSelector.selectOption(optionValue!);
    await window.waitForTimeout(500);

    // Verify transactions are displayed (from test-bank-statement.ofx fixture)
    await expect(window.getByText('GROCERY STORE - Weekly groceries')).toBeVisible();
    await expect(window.getByText('ELECTRIC COMPANY - Monthly bill')).toBeVisible();
    await expect(window.getByText('EMPLOYER INC - Payroll deposit')).toBeVisible();

    // Verify amounts (note: formatAmount uses toFixed(2) without comma separators)
    await expect(window.getByText('-$75.50')).toBeVisible();
    await expect(window.getByText('-$120.00')).toBeVisible();
    await expect(window.getByText('$2500.00')).toBeVisible();
  });

  test('should import QFX file with transactions', async () => {
    // Wait for the app to load
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account first
    await window.fill('input[placeholder="Account Name"]', 'Test QFX Account');
    await window.fill('input[placeholder="Institution Name"]', 'Quicken Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    // Wait for account to be created
    await expect(window.getByText('Account "Test QFX Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Import QFX file directly via API
    const importResult = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Test QFX Account');
      if (!account) throw new Error('Test QFX Account not found');
      return await window.api.import.file(account.id, filePath);
    }, testQfxPath);

    // Verify import was successful
    expect(importResult.success).toBe(true);
    expect(importResult.imported).toBe(2);

    // Navigate to transactions view
    await window.getByRole('button', { name: 'Transactions', exact: true }).click();
    await window.waitForTimeout(500);

    // The TransactionList loads transactions based on the selected account in App.tsx dropdown
    // We need to select the QFX account in the main account dropdown (under Accounts section)
    // The option text format is: "{name} - {institution} (${balance})"
    // First verify we're on the transactions page
    await expect(window.locator('h2:has-text("Transactions")')).toBeVisible();

    // Get the main account selector (not the filter inside TransactionList)
    // It's the first combobox in the Accounts section
    // The option text format is: "{name} - {institution} (${balance})"
    // We need to find an option that contains "Test QFX Account" and select by value
    const accountSelector = window.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    
    // Get all options and find the one containing "Test QFX Account"
    const qfxOption = accountSelector.locator('option', { hasText: 'Test QFX Account' });
    const optionValue = await qfxOption.getAttribute('value');
    await accountSelector.selectOption(optionValue!);
    await window.waitForTimeout(500);

    // Now verify QFX transactions are displayed (should show 2 transactions for QFX account)
    await expect(window.getByText(/Showing 2 of 2 transactions/)).toBeVisible();
    await expect(window.getByText('RESTAURANT PAYMENT - Dinner')).toBeVisible();
    await expect(window.getByText('GAS STATION - Fuel')).toBeVisible();
  });

  test('should detect duplicate transactions on re-import', async () => {
    // Wait for the app to load
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account
    await window.fill('input[placeholder="Account Name"]', 'Duplicate Test Account');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    await expect(window.getByText('Account "Duplicate Test Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // First import via API
    const firstImport = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Duplicate Test Account');
      if (!account) throw new Error('Duplicate Test Account not found');
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    expect(firstImport.success).toBe(true);
    expect(firstImport.imported).toBe(3);

    // Second import (should detect duplicates)
    const secondImport = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Duplicate Test Account');
      if (!account) throw new Error('Duplicate Test Account not found');
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    expect(secondImport.success).toBe(true);
    expect(secondImport.imported).toBe(0);
    expect(secondImport.duplicates).toBe(3);
  });

  test('should handle OFX import with auto-categorization', async () => {
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account
    await window.fill('input[placeholder="Account Name"]', 'Categorization Test');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    await expect(window.getByText('Account "Categorization Test" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Import OFX file directly via API
    const importResult = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Categorization Test');
      if (!account) throw new Error('Categorization Test account not found');
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    expect(importResult.success).toBe(true);

    // Navigate to transactions view
    await window.getByRole('button', { name: 'Transactions', exact: true }).click();
    await window.waitForTimeout(500);

    // Select the Categorization Test account
    const accountSelector = window.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    const catOption = accountSelector.locator('option', { hasText: 'Categorization Test' });
    const optionValue = await catOption.getAttribute('value');
    await accountSelector.selectOption(optionValue!);
    await window.waitForTimeout(500);

    // Verify transactions have categories assigned (may be Uncategorized if no rules match)
    await expect(window.locator('[data-testid="category-dropdown"]').first()).toBeVisible();
  });

  test('should display button text indicating OFX/QFX support', async () => {
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Check that the import button text mentions OFX/QFX support
    await expect(window.getByTestId('import-button')).toContainText('CSV/OFX/QFX');
  });

  test('should handle invalid OFX file gracefully', async () => {
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account
    await window.fill('input[placeholder="Account Name"]', 'Error Test Account');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    await expect(window.getByText('Account "Error Test Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Try to import a file that doesn't exist
    const invalidPath = path.join(os.tmpdir(), 'nonexistent', 'invalid.ofx');
    const importResult = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Error Test Account');
      if (!account) throw new Error('Error Test Account not found');
      return await window.api.import.file(account.id, filePath);
    }, invalidPath);

    // Should fail with error
    expect(importResult.success).toBe(false);
    expect(importResult.error).toBeDefined();
  });

  test('should parse OFX dates correctly', async () => {
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account
    await window.fill('input[placeholder="Account Name"]', 'Date Test Account');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    await expect(window.getByText('Account "Date Test Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Import OFX file directly via API
    const importResult = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Date Test Account');
      if (!account) throw new Error('Date Test Account not found');
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    expect(importResult.success).toBe(true);

    // Navigate to transactions view
    await window.getByRole('button', { name: 'Transactions', exact: true }).click();
    await window.waitForTimeout(500);

    // Select the Date Test Account
    const accountSelector = window.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    const dateOption = accountSelector.locator('option', { hasText: 'Date Test Account' });
    const optionValue = await dateOption.getAttribute('value');
    await accountSelector.selectOption(optionValue!);
    await window.waitForTimeout(500);

    // Verify dates are parsed correctly (from fixture: 20240103, 20240105, 20240110)
    await expect(window.getByText('1/3/2024')).toBeVisible();
    await expect(window.getByText('1/5/2024')).toBeVisible();
    await expect(window.getByText('1/10/2024')).toBeVisible();
  });

  test('should combine memo with description in OFX imports', async () => {
    await expect(window.getByText('Ledgr')).toBeVisible({ timeout: 10000 });

    // Click "Add Account" button to show the form
    await window.click('button:has-text("Add Account")');

    // Create an account
    await window.fill('input[placeholder="Account Name"]', 'Memo Test Account');
    await window.fill('input[placeholder="Institution Name"]', 'Test Bank');
    await window.click('button[type="submit"]:has-text("Create Account")');

    await expect(window.getByText('Account "Memo Test Account" created successfully')).toBeVisible();

    // Navigate to Import view
    await window.click('button:has-text("Import")');

    // Import OFX file directly via API
    const importResult = await window.evaluate(async (filePath) => {
      const accounts = await window.api.accounts.getAll();
      const account = accounts.find((a: { name: string }) => a.name === 'Memo Test Account');
      if (!account) throw new Error('Memo Test Account not found');
      return await window.api.import.file(account.id, filePath);
    }, testOfxPath);

    expect(importResult.success).toBe(true);

    // Navigate to transactions view
    await window.getByRole('button', { name: 'Transactions', exact: true }).click();
    await window.waitForTimeout(500);

    // Select the Memo Test Account
    const accountSelector = window.locator('h2:has-text("Accounts")').locator('..').locator('select').first();
    const memoOption = accountSelector.locator('option', { hasText: 'Memo Test Account' });
    const optionValue = await memoOption.getAttribute('value');
    await accountSelector.selectOption(optionValue!);
    await window.waitForTimeout(500);

    // Verify that descriptions include memos (from fixture)
    await expect(window.getByText('GROCERY STORE - Weekly groceries')).toBeVisible();
    await expect(window.getByText('ELECTRIC COMPANY - Monthly bill')).toBeVisible();
  });
});
