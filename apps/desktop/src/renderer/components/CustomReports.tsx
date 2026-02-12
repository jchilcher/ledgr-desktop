import { useState, useEffect } from 'react';
import { Category, Account, BudgetGoal, BudgetVsActualReport, BudgetVsActualRow, BudgetVsActualTotals } from '../../shared/types';

type ReportType = 'spending_summary' | 'income_report' | 'category_analysis' | 'net_worth' | 'budget_vs_actual' | 'custom';

interface ReportConfig {
  type: ReportType;
  startDate: string;
  endDate: string;
  categoryIds: string[];
  accountIds: string[];
  includeCharts: boolean;
}

export function CustomReports() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [config, setConfig] = useState<ReportConfig>({
    type: 'spending_summary',
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    categoryIds: [],
    accountIds: [],
    includeCharts: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cats, accts] = await Promise.all([
        window.api.categories.getAll(),
        window.api.accounts.getAll(),
      ]);
      setCategories(cats);
      setAccounts(accts);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setConfig(prev => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter(id => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const handleAccountToggle = (accountId: string) => {
    setConfig(prev => ({
      ...prev,
      accountIds: prev.accountIds.includes(accountId)
        ? prev.accountIds.filter(id => id !== accountId)
        : [...prev.accountIds, accountId],
    }));
  };

  // Convert budget period to daily amount then scale to report range
  const prorateBudgetToRange = (budget: BudgetGoal, daysInRange: number): number => {
    const periodDays: Record<string, number> = {
      weekly: 7,
      monthly: 30.44, // Average days per month
      yearly: 365.25,
    };
    const dailyBudget = budget.amount / periodDays[budget.period];
    const proratedAmount = dailyBudget * daysInRange;
    // Add rollover if enabled
    return proratedAmount + (budget.rolloverEnabled ? budget.rolloverAmount : 0);
  };

  // Determine budget status based on percentage spent
  const getBudgetStatus = (actualSpent: number, budgetAmount: number | null): 'under' | 'on_track' | 'over' | 'no_budget' => {
    if (budgetAmount === null || budgetAmount === 0) return 'no_budget';
    const percentSpent = (actualSpent / budgetAmount) * 100;
    if (percentSpent > 100) return 'over';
    if (percentSpent >= 80) return 'on_track';
    return 'under';
  };

  const generateBudgetVsActualReport = async (
    startDate: string,
    endDate: string
  ): Promise<BudgetVsActualReport> => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Fetch budget goals and transactions
    const [budgetGoals, transactions, allCategories] = await Promise.all([
      window.api.budgetGoals.getAll(),
      window.api.transactions.getAll(),
      window.api.categories.getAll(),
    ]);

    // Filter transactions to date range and expenses only
    const filtered = transactions.filter(t => {
      const date = new Date(t.date).getTime();
      return date >= start.getTime() && date <= end.getTime() && t.amount < 0;
    });

    // Build spending by category
    const spendingByCategory: Record<string, { total: number; count: number }> = {};
    filtered.forEach(t => {
      const catId = t.categoryId || 'uncategorized';
      if (!spendingByCategory[catId]) {
        spendingByCategory[catId] = { total: 0, count: 0 };
      }
      spendingByCategory[catId].total += Math.abs(t.amount);
      spendingByCategory[catId].count++;
    });

    // Create category lookup
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    // Build rows for each budget goal
    const rows: BudgetVsActualRow[] = budgetGoals.map(budget => {
      const category = categoryMap.get(budget.categoryId);
      const spending = spendingByCategory[budget.categoryId] || { total: 0, count: 0 };
      const proratedBudget = prorateBudgetToRange(budget, daysInRange);
      const variance = proratedBudget - spending.total;
      const variancePercent = proratedBudget > 0 ? ((spending.total / proratedBudget) - 1) * 100 : null;

      return {
        categoryId: budget.categoryId,
        categoryName: category?.name || 'Unknown Category',
        categoryColor: category?.color || '#808080',
        budgetAmount: proratedBudget,
        actualSpent: spending.total,
        varianceAmount: variance,
        variancePercent,
        status: getBudgetStatus(spending.total, proratedBudget),
        transactionCount: spending.count,
      };
    });

    // Sort by variance (most over budget first)
    rows.sort((a, b) => (a.varianceAmount ?? 0) - (b.varianceAmount ?? 0));

    // Calculate totals
    const totals: BudgetVsActualTotals = {
      totalBudget: rows.reduce((sum, r) => sum + (r.budgetAmount || 0), 0),
      totalActual: rows.reduce((sum, r) => sum + r.actualSpent, 0),
      totalVariance: rows.reduce((sum, r) => sum + (r.varianceAmount || 0), 0),
      categoriesOverBudget: rows.filter(r => r.status === 'over').length,
      categoriesUnderBudget: rows.filter(r => r.status === 'under').length,
      categoriesOnTrack: rows.filter(r => r.status === 'on_track').length,
    };

    return {
      rows,
      totals,
      dateRange: { startDate, endDate, daysInRange },
    };
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    try {
      // Generate preview data based on report type
      const startTimestamp = new Date(config.startDate).getTime();
      const endTimestamp = new Date(config.endDate).getTime();

      // Fetch transactions for the date range
      const transactions = await window.api.transactions.getAll();
      const filtered = transactions.filter(t => {
        const date = new Date(t.date).getTime();
        return date >= startTimestamp && date <= endTimestamp;
      });

      // Generate summary based on type
      let summary: Record<string, unknown> = {};

      if (config.type === 'spending_summary' || config.type === 'category_analysis') {
        const byCategory: Record<string, number> = {};
        filtered.forEach(t => {
          if (t.amount < 0) {
            const catId = t.categoryId || 'uncategorized';
            byCategory[catId] = (byCategory[catId] || 0) + Math.abs(t.amount);
          }
        });
        summary = { byCategory, totalSpending: Object.values(byCategory).reduce((a, b) => a + b, 0) };
      } else if (config.type === 'income_report') {
        const income = filtered.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expenses = filtered.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        summary = { income, expenses, net: income - expenses };
      } else if (config.type === 'budget_vs_actual') {
        const report = await generateBudgetVsActualReport(config.startDate, config.endDate);
        setPreviewData(report);
        return;
      }

      setPreviewData(summary);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    // PDF export would use pdfmake library
    alert('PDF export requires pdfmake dependency. Add it with: npm install pdfmake');
  };

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'spending_summary', label: 'Spending Summary', description: 'Overview of spending by category' },
    { value: 'income_report', label: 'Income Report', description: 'Income vs expenses analysis' },
    { value: 'category_analysis', label: 'Category Analysis', description: 'Deep dive into category trends' },
    { value: 'net_worth', label: 'Net Worth Report', description: 'Assets and liabilities summary' },
    { value: 'budget_vs_actual', label: 'Budget vs Actual', description: 'Compare spending against budget goals' },
    { value: 'custom', label: 'Custom Report', description: 'Build your own report' },
  ];

  // Budget vs Actual Preview Component
  const BudgetVsActualPreview = ({ report, includeCharts }: { report: BudgetVsActualReport; includeCharts: boolean }) => {
    const formatCurrency = (amountInCents: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInCents / 100);
    };

    const formatPercent = (value: number | null) => {
      if (value === null) return '-';
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
    };

    const getStatusBadge = (status: string) => {
      const styles: Record<string, { bg: string; text: string; label: string }> = {
        under: { bg: '#dcfce7', text: '#166534', label: 'Under Budget' },
        on_track: { bg: '#fef9c3', text: '#854d0e', label: 'On Track' },
        over: { bg: '#fee2e2', text: '#991b1b', label: 'Over Budget' },
        no_budget: { bg: '#f3f4f6', text: '#6b7280', label: 'No Budget' },
      };
      const style = styles[status] || styles.no_budget;
      return (
        <span
          className="status-badge"
          data-status={status}
          style={{
            backgroundColor: style.bg,
            color: style.text,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {style.label}
        </span>
      );
    };

    // Calculate max value for chart scaling
    const maxValue = Math.max(
      ...report.rows.flatMap(r => [r.budgetAmount || 0, r.actualSpent])
    );

    if (report.rows.length === 0) {
      return (
        <div className="budget-vs-actual-empty">
          <p>No budget goals found. Create budget goals to see this report.</p>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            Go to Budget Goals to set up spending limits for your categories.
          </p>
        </div>
      );
    }

    return (
      <div className="budget-vs-actual-report">
        {/* Summary Section */}
        <div className="report-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="summary-card" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Budget</div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{formatCurrency(report.totals.totalBudget)}</div>
          </div>
          <div className="summary-card" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Actual</div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>{formatCurrency(report.totals.totalActual)}</div>
          </div>
          <div className="summary-card" style={{ padding: '16px', backgroundColor: report.totals.totalVariance >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Variance</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: report.totals.totalVariance >= 0 ? '#166534' : '#991b1b' }}>
              {report.totals.totalVariance >= 0 ? '+' : ''}{formatCurrency(report.totals.totalVariance)}
            </div>
          </div>
          <div className="summary-card" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>Categories</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              <span style={{ color: '#991b1b' }}>{report.totals.categoriesOverBudget} over</span>
              {' · '}
              <span style={{ color: '#854d0e' }}>{report.totals.categoriesOnTrack} on track</span>
              {' · '}
              <span style={{ color: '#166534' }}>{report.totals.categoriesUnderBudget} under</span>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="comparison-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>Category</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Budget</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Actual</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Variance</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>%</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map(row => (
                <tr key={row.categoryId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '2px',
                          backgroundColor: row.categoryColor,
                        }}
                      />
                      {row.categoryName}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 8px' }}>
                    {row.budgetAmount !== null ? formatCurrency(row.budgetAmount) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 8px' }}>
                    {formatCurrency(row.actualSpent)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 8px', color: (row.varianceAmount ?? 0) >= 0 ? '#166534' : '#991b1b' }}>
                    {row.varianceAmount !== null ? `${row.varianceAmount >= 0 ? '+' : ''}${formatCurrency(row.varianceAmount)}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px 8px', color: (row.variancePercent ?? 0) <= 0 ? '#166534' : '#991b1b' }}>
                    {formatPercent(row.variancePercent)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                    {getStatusBadge(row.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grouped Bar Chart */}
        {includeCharts && report.rows.length > 0 && (
          <div className="budget-vs-actual-chart" style={{ marginTop: '24px' }}>
            <h5 style={{ marginBottom: '16px' }}>Budget vs Actual by Category</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {report.rows.map(row => (
                <div key={row.categoryId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '120px', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.categoryName}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Budget bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        className="budget-bar"
                        style={{
                          height: '16px',
                          width: `${maxValue > 0 ? ((row.budgetAmount || 0) / maxValue) * 100 : 0}%`,
                          backgroundColor: '#93c5fd',
                          borderRadius: '2px',
                          minWidth: row.budgetAmount ? '2px' : 0,
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {formatCurrency(row.budgetAmount || 0)}
                      </span>
                    </div>
                    {/* Actual bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        className="actual-bar"
                        style={{
                          height: '16px',
                          width: `${maxValue > 0 ? (row.actualSpent / maxValue) * 100 : 0}%`,
                          backgroundColor: row.status === 'over' ? '#fca5a5' : row.status === 'on_track' ? '#fcd34d' : '#86efac',
                          borderRadius: '2px',
                          minWidth: row.actualSpent > 0 ? '2px' : 0,
                        }}
                      />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {formatCurrency(row.actualSpent)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#93c5fd', borderRadius: '2px' }} /> Budget
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#86efac', borderRadius: '2px' }} /> Under
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#fcd34d', borderRadius: '2px' }} /> On Track
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#fca5a5', borderRadius: '2px' }} /> Over
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="custom-reports">
      <div className="reports-header">
        <h2>Reports</h2>
        <button onClick={() => setShowBuilder(true)} className="add-btn">
          Create Report
        </button>
      </div>

      {showBuilder && (
        <div className="report-builder">
          <h3>Report Builder</h3>

          <div className="form-group">
            <label>Report Type</label>
            <div className="report-types">
              {reportTypes.map(rt => (
                <label key={rt.value} className={`report-type-option ${config.type === rt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reportType"
                    value={rt.value}
                    checked={config.type === rt.value}
                    onChange={e => setConfig({ ...config, type: e.target.value as ReportType })}
                  />
                  <div className="option-content">
                    <strong>{rt.label}</strong>
                    <span>{rt.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={config.startDate}
                onChange={e => setConfig({ ...config, startDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={config.endDate}
                onChange={e => setConfig({ ...config, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Categories (optional - leave empty for all)</label>
            <div className="checkbox-grid">
              {categories.map(cat => (
                <label key={cat.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.categoryIds.includes(cat.id)}
                    onChange={() => handleCategoryToggle(cat.id)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Accounts (optional - leave empty for all)</label>
            <div className="checkbox-grid">
              {accounts.map(acc => (
                <label key={acc.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={config.accountIds.includes(acc.id)}
                    onChange={() => handleAccountToggle(acc.id)}
                  />
                  {acc.name}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={config.includeCharts}
                onChange={e => setConfig({ ...config, includeCharts: e.target.checked })}
              />
              Include Charts
            </label>
          </div>

          <div className="form-actions">
            <button onClick={handlePreview} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Preview'}
            </button>
            <button onClick={handleExportPDF} disabled={!previewData}>
              Export PDF
            </button>
            <button type="button" onClick={() => { setShowBuilder(false); setPreviewData(null); }}>
              Cancel
            </button>
          </div>

          {previewData !== null && (
            <div className="report-preview">
              <h4>Preview</h4>
              {config.type === 'budget_vs_actual' && (previewData as BudgetVsActualReport).rows ? (
                <BudgetVsActualPreview
                  report={previewData as BudgetVsActualReport}
                  includeCharts={config.includeCharts}
                />
              ) : (
                <pre>{JSON.stringify(previewData, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      )}

      <div className="saved-reports">
        <h3>Saved Reports</h3>
        <p className="empty-state">No saved reports yet. Create a report to get started.</p>
      </div>

      <div className="recent-reports">
        <h3>Recent Reports</h3>
        <p className="empty-state">Your recently generated reports will appear here.</p>
      </div>
    </div>
  );
}
