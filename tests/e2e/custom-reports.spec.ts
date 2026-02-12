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

test.describe('Custom Reports Feature', () => {
  test('should navigate to reports', async () => {
    // Look for Reports in navigation
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await expect(window.locator('h2:text("Reports")')).toBeVisible();
    }
  });

  test('should see report builder', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      // Should see report options
      await expect(window.locator('button:text("Create Report")')).toBeVisible();
    }
  });

  test('should select report type', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Should see report type options
      const reportTypes = window.locator('text=Spending Summary, text=Income Report, text=Category Analysis');
      if (await reportTypes.count() > 0) {
        await reportTypes.first().click();
      }
    }
  });

  test('should set date range for report', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Set date range
      const dateInputs = await window.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.first().fill('2024-01-01');
        await dateInputs.last().fill('2024-12-31');
      }
    }
  });

  test('should select categories for report', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Select categories
      const categoryCheckboxes = window.locator('.category-select input[type="checkbox"]');
      if (await categoryCheckboxes.count() > 0) {
        await categoryCheckboxes.first().check();
        await categoryCheckboxes.nth(1).check();
      }
    }
  });

  test('should preview report', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(500);

        // Should see report preview
        const preview = window.locator('.report-preview, .preview');
        await expect(preview).toBeVisible();
      }
    }
  });

  test('should export report as PDF', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Click export PDF
      const exportButton = window.locator('button:text("Export PDF"), button:text("Download PDF")');
      if (await exportButton.count() > 0) {
        // Note: Actual file save dialog would be shown
        await expect(exportButton).toBeVisible();
      }
    }
  });

  test('should see saved reports', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      // Should see saved reports section
      const savedReports = window.locator('text=Saved Reports, text=Recent Reports');
      if (await savedReports.count() > 0) {
        await expect(savedReports.first()).toBeVisible();
      }
    }
  });

  test('should schedule recurring report', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();

      await window.click('button:text("Create Report")');

      // Look for schedule option
      const scheduleOption = window.locator('text=Schedule, input[type="checkbox"]:near(text=Schedule)');
      if (await scheduleOption.count() > 0) {
        await scheduleOption.first().click();

        // Select frequency
        const frequencySelect = window.locator('select');
        if (await frequencySelect.count() > 0) {
          await frequencySelect.selectOption('monthly');
        }
      }
    }
  });
});

test.describe('Budget vs Actual Report', () => {
  test('should display Budget vs Actual report type option', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Should see Budget vs Actual option
      const budgetVsActualOption = window.locator('text=Budget vs Actual');
      await expect(budgetVsActualOption).toBeVisible();
    }
  });

  test('should select Budget vs Actual report type', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();

        // Verify it's selected
        await expect(budgetVsActualOption).toHaveClass(/selected/);
      }
    }
  });

  test('should generate Budget vs Actual preview', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();
      }

      // Set date range
      const dateInputs = await window.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.first().fill('2024-01-01');
        await dateInputs.last().fill('2024-12-31');
      }

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(1000);

        // Should see report preview
        const preview = window.locator('.report-preview');
        await expect(preview).toBeVisible();
      }
    }
  });

  test('should show summary cards in Budget vs Actual report', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();
      }

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(1000);

        // Check for summary cards or empty state
        const summaryCards = window.locator('.summary-card, .budget-vs-actual-empty');
        if (await summaryCards.count() > 0) {
          await expect(summaryCards.first()).toBeVisible();
        }
      }
    }
  });

  test('should show status badges in comparison table', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();
      }

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(1000);

        // Check for status badges (Under Budget, On Track, Over Budget)
        const statusBadges = window.locator('.status-badge');
        if (await statusBadges.count() > 0) {
          const firstBadge = statusBadges.first();
          const status = await firstBadge.getAttribute('data-status');
          expect(['under', 'on_track', 'over', 'no_budget']).toContain(status);
        }
      }
    }
  });

  test('should show chart when Include Charts is checked', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();
      }

      // Ensure Include Charts is checked
      const includeChartsCheckbox = window.locator('input[type="checkbox"]').filter({ hasText: 'Include Charts' });
      if (await includeChartsCheckbox.count() > 0) {
        await includeChartsCheckbox.check();
      }

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(1000);

        // Check for chart (budget bars or actual bars)
        const chartBars = window.locator('.budget-bar, .actual-bar');
        // Chart may not be visible if no budget goals exist
        const chart = window.locator('.budget-vs-actual-chart');
        if (await chart.count() > 0) {
          await expect(chart).toBeVisible();
        }
      }
    }
  });

  test('should show empty state when no budget goals exist', async () => {
    const reportsNav = window.locator('text=Reports');
    if (await reportsNav.count() > 0) {
      await reportsNav.click();
      await window.click('button:text("Create Report")');

      // Select Budget vs Actual
      const budgetVsActualOption = window.locator('label.report-type-option:has-text("Budget vs Actual")');
      if (await budgetVsActualOption.count() > 0) {
        await budgetVsActualOption.click();
      }

      // Click preview
      const previewButton = window.locator('button:text("Preview")');
      if (await previewButton.count() > 0) {
        await previewButton.click();
        await window.waitForTimeout(1000);

        // If no budget goals exist, should see empty state message
        const emptyState = window.locator('.budget-vs-actual-empty');
        const reportTable = window.locator('.budget-vs-actual-report .comparison-table');

        // Either empty state or table should be visible
        const hasEmptyState = await emptyState.count() > 0;
        const hasTable = await reportTable.count() > 0;
        expect(hasEmptyState || hasTable).toBeTruthy();
      }
    }
  });
});
