import React, { useState, useEffect, useCallback } from 'react';

interface CategorySpending {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
  color: string;
}

interface IncomeExpensePeriod {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

interface BudgetGoal {
  id: string;
  categoryId: string;
  amount: number;
  period: string;
}

interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  amount?: number | null;
  detectedAt: Date;
  acknowledged: boolean;
}

interface UpcomingPayment {
  id: string;
  recurringItemId: string;
  dueDate: string;
  amount: number;
  status: string;
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

const getMonthRange = (year: number, month: number): { start: string; end: string } => {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const MonthInReview: React.FC = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIncome, setCurrentIncome] = useState(0);
  const [currentExpenses, setCurrentExpenses] = useState(0);
  const [prevIncome, setPrevIncome] = useState(0);
  const [prevExpenses, setPrevExpenses] = useState(0);
  const [topCategories, setTopCategories] = useState<CategorySpending[]>([]);
  const [prevCategoryMap, setPrevCategoryMap] = useState<Record<string, number>>({});
  const [budgetsOnTrack, setBudgetsOnTrack] = useState(0);
  const [budgetsTotal, setBudgetsTotal] = useState(0);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
  const [netWorthStart, setNetWorthStart] = useState<number | null>(null);
  const [netWorthEnd, setNetWorthEnd] = useState<number | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { start, end } = getMonthRange(selectedYear, selectedMonth);

      const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const prev = getMonthRange(prevYear, prevMonth);

      const [
        incomeExpenses,
        prevIncomeExpenses,
        categories,
        prevCategories,
        budgetGoals,
        anomalyResult,
        upcoming,
        snapshots,
      ] = await Promise.all([
        window.api.analytics.getIncomeVsExpensesOverTime('month', start, end),
        window.api.analytics.getIncomeVsExpensesOverTime('month', prev.start, prev.end),
        window.api.analytics.getSpendingByCategory(start, end),
        window.api.analytics.getSpendingByCategory(prev.start, prev.end),
        window.api.budgetGoals.getAll(),
        window.api.anomalyDetection.detect().catch(() => ({ anomalies: [], summary: { totalAnomalies: 0, byType: {}, bySeverity: {} } })),
        window.api.recurringPayments.getUpcoming(30).catch(() => []),
        window.api.netWorthSnapshots.getSnapshotsByRange(
          new Date(start).getTime(),
          new Date(end + 'T23:59:59').getTime()
        ).catch(() => []),
      ]);

      const curPeriod = incomeExpenses[0] as IncomeExpensePeriod | undefined;
      setCurrentIncome(curPeriod?.income ?? 0);
      setCurrentExpenses(curPeriod?.expenses ?? 0);

      const prvPeriod = prevIncomeExpenses[0] as IncomeExpensePeriod | undefined;
      setPrevIncome(prvPeriod?.income ?? 0);
      setPrevExpenses(prvPeriod?.expenses ?? 0);

      const sorted = [...categories].sort((a, b) => b.total - a.total).slice(0, 5);
      setTopCategories(sorted);

      const prevMap: Record<string, number> = {};
      prevCategories.forEach((c) => { prevMap[c.categoryId] = c.total; });
      setPrevCategoryMap(prevMap);

      // Budget adherence
      const categorySpendingMap: Record<string, number> = {};
      categories.forEach((c) => { categorySpendingMap[c.categoryId] = c.total; });

      let onTrack = 0;
      const monthlyGoals = (budgetGoals as BudgetGoal[]).filter(g => g.period === 'monthly');
      monthlyGoals.forEach((goal) => {
        const spent = categorySpendingMap[goal.categoryId] ?? 0;
        if (spent <= goal.amount) onTrack++;
      });
      setBudgetsOnTrack(onTrack);
      setBudgetsTotal(monthlyGoals.length);

      // Filter anomalies for this month
      const startDate = new Date(start);
      const endDate = new Date(end + 'T23:59:59');
      const monthAnomalies = anomalyResult.anomalies.filter((a) => {
        const d = new Date(a.detectedAt);
        return d >= startDate && d <= endDate;
      });
      setAnomalies(monthAnomalies);

      setUpcomingPayments(upcoming as UpcomingPayment[]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load month review data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateMonth = (direction: -1 | 1) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const calcChange = (current: number, previous: number): { percent: number; direction: 'up' | 'down' | 'flat' } => {
    if (previous === 0) return { percent: 0, direction: 'flat' };
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    return { percent: Math.abs(pct), direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
  };

  const netCashFlow = currentIncome - currentExpenses;
  const prevNetCashFlow = prevIncome - prevExpenses;

  const incomeChange = calcChange(currentIncome, prevIncome);
  const expenseChange = calcChange(currentExpenses, prevExpenses);
  const netChange = calcChange(netCashFlow, prevNetCashFlow);

  if (loading) {
    return (
      <div className="review-section" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', padding: '48px' }}>
        <div className="spinner" />
        <span>Loading month in review...</span>
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
      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigateMonth(-1)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
          &#8592;
        </button>
        <h3 style={{ margin: 0, minWidth: '200px', textAlign: 'center' }}>
          {monthNames[selectedMonth]} {selectedYear}
        </h3>
        <button onClick={() => navigateMonth(1)} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
          &#8594;
        </button>
      </div>

      {/* Summary Cards */}
      <div className="review-summary-cards">
        <SummaryCard
          label="Total Income"
          value={formatCentsShort(currentIncome)}
          change={incomeChange}
          positiveIsGood={true}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCentsShort(currentExpenses)}
          change={expenseChange}
          positiveIsGood={false}
        />
        <SummaryCard
          label="Net Cash Flow"
          value={formatCentsShort(netCashFlow)}
          change={netChange}
          positiveIsGood={true}
          valueColor={netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
      </div>

      {/* Top 5 Spending Categories */}
      <div className="review-section">
        <h4 style={{ margin: '0 0 12px 0' }}>Top Spending Categories</h4>
        {topCategories.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No spending data for this month.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topCategories.map((cat) => {
              const prevTotal = prevCategoryMap[cat.categoryId] ?? 0;
              const change = calcChange(cat.total, prevTotal);
              const maxTotal = topCategories[0]?.total ?? 1;
              const barWidth = Math.max((cat.total / maxTotal) * 100, 2);
              return (
                <div key={cat.categoryId} className="review-category-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{cat.categoryName}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatCents(cat.total)}</span>
                      {prevTotal > 0 && (
                        <span className="review-comparison" style={{ color: change.direction === 'up' ? 'var(--color-danger)' : change.direction === 'down' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          {change.direction === 'up' ? '\u2191' : change.direction === 'down' ? '\u2193' : '\u2013'} {change.percent.toFixed(0)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--color-bg)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: cat.color || 'var(--color-primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Net Worth Change */}
      {netWorthStart !== null && netWorthEnd !== null && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Net Worth Change</h4>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Start of Month</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{formatCents(netWorthStart)}</div>
            </div>
            <div style={{ fontSize: '20px', color: 'var(--color-text-muted)' }}>&rarr;</div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>End of Month</div>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Adherence */}
      {budgetsTotal > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Budget Adherence</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: `4px solid ${budgetsOnTrack === budgetsTotal ? 'var(--color-success)' : budgetsOnTrack >= budgetsTotal / 2 ? 'var(--color-warning)' : 'var(--color-danger)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
            }}>
              {budgetsOnTrack}/{budgetsTotal}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: '16px' }}>
                {budgetsOnTrack} of {budgetsTotal} budgets on track
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {((budgetsOnTrack / budgetsTotal) * 100).toFixed(0)}% adherence rate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notable Anomalies */}
      {anomalies.length > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Notable Anomalies</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {anomalies.slice(0, 5).map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `3px solid ${a.severity === 'high' ? 'var(--color-danger)' : a.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-info)'}`,
                }}
              >
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: a.severity === 'high' ? 'var(--color-danger)' : a.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-info)',
                }}>
                  {a.severity}
                </span>
                <span style={{ flex: 1, fontSize: '14px' }}>{a.description}</span>
                {a.amount != null && (
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatCents(a.amount)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Next Month */}
      {upcomingPayments.length > 0 && (
        <div className="review-section">
          <h4 style={{ margin: '0 0 12px 0' }}>Upcoming Next Month</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {upcomingPayments.slice(0, 8).map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  {new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{formatCents(p.amount)}</span>
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
          {change.direction === 'up' ? '\u2191' : '\u2193'} {change.percent.toFixed(1)}% vs prev month
        </div>
      )}
    </div>
  );
};

export default MonthInReview;
