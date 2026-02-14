import React, { useState, useEffect, useCallback } from 'react';

interface IncomeExpensePeriod {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

interface CategorySpending {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
  color: string;
}

interface NetWorthSnapshot {
  id: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  createdAt: string;
}

const formatCents = (cents: number): string => {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
};

const formatCentsShort = (cents: number): string => {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return cents < 0 ? `-$${formatted}` : `$${formatted}`;
};

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const YearInReview: React.FC = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthlyData, setMonthlyData] = useState<IncomeExpensePeriod[]>([]);
  const [prevYearData, setPrevYearData] = useState<IncomeExpensePeriod[]>([]);
  const [topCategories, setTopCategories] = useState<CategorySpending[]>([]);
  const [netWorthStart, setNetWorthStart] = useState<number | null>(null);
  const [netWorthEnd, setNetWorthEnd] = useState<number | null>(null);
  const [topDescriptions, setTopDescriptions] = useState<Array<{ description: string; total: number; count: number }>>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      const prevYearStart = `${selectedYear - 1}-01-01`;
      const prevYearEnd = `${selectedYear - 1}-12-31`;

      const [
        monthly,
        prevMonthly,
        categories,
        snapshots,
        transactions,
      ] = await Promise.all([
        window.api.analytics.getIncomeVsExpensesOverTime('month', yearStart, yearEnd),
        window.api.analytics.getIncomeVsExpensesOverTime('month', prevYearStart, prevYearEnd),
        window.api.analytics.getSpendingByCategory(yearStart, yearEnd),
        window.api.netWorthSnapshots.getSnapshotsByRange(
          new Date(yearStart).getTime(),
          new Date(yearEnd + 'T23:59:59').getTime()
        ).catch(() => []),
        window.api.transactions.getAll().catch(() => []),
      ]);

      setMonthlyData(monthly);
      setPrevYearData(prevMonthly);

      const sorted = [...categories].sort((a, b) => b.total - a.total).slice(0, 8);
      setTopCategories(sorted);

      // Net worth from snapshots
      const snapshotArr = snapshots as NetWorthSnapshot[];
      if (snapshotArr.length > 0) {
        const sortedSnaps = [...snapshotArr].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setNetWorthStart(sortedSnaps[0].netWorth);
        setNetWorthEnd(sortedSnaps[sortedSnaps.length - 1].netWorth);
      } else {
        setNetWorthStart(null);
        setNetWorthEnd(null);
      }

      // Top descriptions from transactions for this year
      const yearTransactions = transactions.filter((t: { date: Date; amount: number }) => {
        const d = new Date(t.date);
        return d.getFullYear() === selectedYear && t.amount < 0;
      });

      const descMap = new Map<string, { total: number; count: number }>();
      yearTransactions.forEach((t: { description: string; amount: number }) => {
        const normalized = t.description.trim().toLowerCase();
        const existing = descMap.get(normalized) || { total: 0, count: 0 };
        existing.total += Math.abs(t.amount);
        existing.count += 1;
        descMap.set(normalized, existing);
      });

      const topDescs = Array.from(descMap.entries())
        .map(([desc, data]) => ({ description: desc, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setTopDescriptions(topDescs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load year review data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calcChange = (current: number, previous: number): { percent: number; direction: 'up' | 'down' | 'flat' } => {
    if (previous === 0) return { percent: 0, direction: 'flat' };
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return { percent: Math.abs(pct), direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
  };

  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const totalSavings = totalIncome - totalExpenses;

  const prevTotalIncome = prevYearData.reduce((s, m) => s + m.income, 0);
  const prevTotalExpenses = prevYearData.reduce((s, m) => s + m.expenses, 0);
  const prevTotalSavings = prevTotalIncome - prevTotalExpenses;

  const incomeChange = calcChange(totalIncome, prevTotalIncome);
  const expenseChange = calcChange(totalExpenses, prevTotalExpenses);
  const savingsChange = calcChange(totalSavings, prevTotalSavings);

  // Best and worst months
  const expenseMonths = monthlyData
    .filter((m) => m.expenses > 0)
    .map((m) => {
      const [year, month] = m.period.split('-').map(Number);
      return { ...m, label: `${monthNames[month - 1]} ${year}` };
    });

  const bestMonth = expenseMonths.length > 0
    ? expenseMonths.reduce((min, m) => m.expenses < min.expenses ? m : min, expenseMonths[0])
    : null;
  const worstMonth = expenseMonths.length > 0
    ? expenseMonths.reduce((max, m) => m.expenses > max.expenses ? m : max, expenseMonths[0])
    : null;

  // Monthly chart max
  const maxMonthlyValue = Math.max(
    ...monthlyData.map((m) => Math.max(m.income, m.expenses)),
    1
  );

  if (loading) {
    return (
      <div className="review-section" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', padding: '48px' }}>
        <div className="spinner" />
        <span>Loading year in review...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="review-section" style={{ textAlign: 'center', padding: '48px' }}>
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Year Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => setSelectedYear(selectedYear - 1)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
          &#8592;
        </button>
        <h3 style={{ margin: 0, minWidth: '100px', textAlign: 'center' }}>{selectedYear}</h3>
        <button onClick={() => setSelectedYear(selectedYear + 1)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
          &#8594;
        </button>
      </div>

      {/* Annual Summary Cards */}
      <div className="review-summary-cards">
        <SummaryCard
          label="Total Income"
          value={formatCentsShort(totalIncome)}
          change={incomeChange}
          positiveIsGood={true}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCentsShort(totalExpenses)}
          change={expenseChange}
          positiveIsGood={false}
        />
        <SummaryCard
          label="Total Savings"
          value={formatCentsShort(totalSavings)}
          change={savingsChange}
          positiveIsGood={true}
          valueColor={totalSavings >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
      </div>

      {/* Best/Worst Months */}
      {bestMonth && worstMonth && (
        <div className="review-summary-cards" style={{ marginTop: '16px' }}>
          <div className="review-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Lowest Spending Month</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{bestMonth.label}</div>
            <div style={{ fontSize: '14px', color: 'var(--color-success)', marginTop: '4px' }}>{formatCents(bestMonth.expenses)}</div>
          </div>
          <div className="review-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Highest Spending Month</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{worstMonth.label}</div>
            <div style={{ fontSize: '14px', color: 'var(--color-danger)', marginTop: '4px' }}>{formatCents(worstMonth.expenses)}</div>
          </div>
        </div>
      )}

      {/* Monthly Income vs Expenses Chart */}
      {monthlyData.length > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 16px 0' }}>Monthly Breakdown</h4>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-success)', borderRadius: '2px', display: 'inline-block' }} />
              Income
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--color-danger)', borderRadius: '2px', display: 'inline-block' }} />
              Expenses
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px' }}>
            {monthlyData.map((m, i) => {
              const [, month] = m.period.split('-').map(Number);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '2px' }}>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '100%' }}>
                    <div
                      style={{
                        width: '12px',
                        height: `${(m.income / maxMonthlyValue) * 100}%`,
                        minHeight: m.income > 0 ? '2px' : '0',
                        backgroundColor: 'var(--color-success)',
                        borderRadius: '2px 2px 0 0',
                      }}
                      title={`Income: ${formatCents(m.income)}`}
                    />
                    <div
                      style={{
                        width: '12px',
                        height: `${(m.expenses / maxMonthlyValue) * 100}%`,
                        minHeight: m.expenses > 0 ? '2px' : '0',
                        backgroundColor: 'var(--color-danger)',
                        borderRadius: '2px 2px 0 0',
                      }}
                      title={`Expenses: ${formatCents(m.expenses)}`}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{monthNames[month - 1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Spending */}
      {topCategories.length > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Spending by Category</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCategories.map((cat) => {
              const maxTotal = topCategories[0]?.total ?? 1;
              const barWidth = Math.max((cat.total / maxTotal) * 100, 2);
              return (
                <div key={cat.categoryId} className="review-category-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{cat.categoryName}</span>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatCents(cat.total)}</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--color-bg)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: cat.color || 'var(--color-primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Net Worth */}
      {netWorthStart !== null && netWorthEnd !== null && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Net Worth</h4>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Start of Year</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{formatCents(netWorthStart)}</div>
            </div>
            <div style={{ fontSize: '20px', color: 'var(--color-text-muted)' }}>&rarr;</div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>End of Year</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{formatCents(netWorthEnd)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Change</div>
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                color: netWorthEnd - netWorthStart >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {netWorthEnd - netWorthStart >= 0 ? '+' : ''}{formatCents(netWorthEnd - netWorthStart)}
                {netWorthStart !== 0 && (
                  <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                    ({(((netWorthEnd - netWorthStart) / Math.abs(netWorthStart)) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Merchants/Descriptions */}
      {topDescriptions.length > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Top Merchants</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {topDescriptions.map((desc, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-light)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '14px', textTransform: 'capitalize' }}>{desc.description}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{formatCents(desc.total)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{desc.count} transactions</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  change: { percent: number; direction: 'up' | 'down' | 'flat' };
  positiveIsGood: boolean;
  valueColor?: string;
}> = ({ label, value, change, positiveIsGood, valueColor }) => {
  const changeColor = change.direction === 'flat'
    ? 'var(--color-text-muted)'
    : (change.direction === 'up') === positiveIsGood
      ? 'var(--color-success)'
      : 'var(--color-danger)';

  return (
    <div className="review-card">
      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: valueColor || 'var(--color-text)' }}>{value}</div>
      {change.direction !== 'flat' && (
        <div className="review-comparison" style={{ color: changeColor, fontSize: '13px', marginTop: '4px' }}>
          {change.direction === 'up' ? '\u2191' : '\u2193'} {change.percent.toFixed(1)}% vs prev year
        </div>
      )}
    </div>
  );
};

export default YearInReview;
