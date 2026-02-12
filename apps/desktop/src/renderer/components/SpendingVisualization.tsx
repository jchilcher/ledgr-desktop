import React, { useState, useEffect } from 'react';
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BudgetGoal } from '../../shared/types';

interface SpendingData {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
  color: string;
}

interface BudgetInfo {
  amount: number;
  period: string;
}

type ChartType = 'pie' | 'bar';

type DatePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'this-year' | 'custom';

interface WeekBreakdownEntry {
  weekNumber: number;
  start: string;
  end: string;
  days: number;
  allocation: number;
}

interface WeeklyCategoryInfo {
  monthlyBudget: number;
  baseWeeklyAllocation: number;
  priorWeeksExpected: number;
  priorWeeksActual: number;
  rollover: number;
  effectiveBudget: number;
  monthToDateSpent: number;
}

interface WeeklyBudgetContext {
  weekNumber: number;
  totalWeeksInMonth: number;
  daysInMonth: number;
  daysInThisWeek: number;
  weekStart: string;
  weekEnd: string;
  perCategory: Record<string, WeeklyCategoryInfo>;
  weekBreakdown: WeekBreakdownEntry[];
}

// --- Week helper functions ---

/** Returns Sunday 00:00 to Saturday 23:59 for the week containing `date` */
const getWeekBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Saturday
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/** Returns 1st at 00:00 to last day at 23:59 for the month containing `date` */
const getMonthBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

/** Clips a week to month boundaries, returns clamped start/end and number of days */
const clampWeekToMonth = (
  weekStart: Date, weekEnd: Date, monthStart: Date, monthEnd: Date
): { start: Date; end: Date; days: number } => {
  const clampedStart = weekStart < monthStart ? new Date(monthStart) : new Date(weekStart);
  const clampedEnd = weekEnd > monthEnd ? new Date(monthEnd) : new Date(weekEnd);
  const days = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return { start: clampedStart, end: clampedEnd, days };
};

/** Returns array of week info for each week in a given month */
const getWeeksInMonth = (year: number, month: number): { weekNumber: number; start: Date; end: Date; days: number }[] => {
  const monthBounds = getMonthBounds(new Date(year, month, 1));
  const weeks: { weekNumber: number; start: Date; end: Date; days: number }[] = [];
  let current = new Date(monthBounds.start);
  let weekNum = 1;

  while (current <= monthBounds.end) {
    const wb = getWeekBounds(current);
    const clamped = clampWeekToMonth(wb.start, wb.end, monthBounds.start, monthBounds.end);
    weeks.push({ weekNumber: weekNum, start: clamped.start, end: clamped.end, days: clamped.days });
    // Move to next Sunday
    const nextSunday = new Date(wb.end);
    nextSunday.setDate(nextSunday.getDate() + 1);
    nextSunday.setHours(0, 0, 0, 0);
    current = nextSunday;
    weekNum++;
  }

  return weeks;
};

const formatDateShort = (d: Date): string => {
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const toDateString = (d: Date): string => d.toISOString().split('T')[0];

const SpendingVisualization: React.FC = () => {
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [spendingData, setSpendingData] = useState<SpendingData[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<SpendingData[]>([]);
  const [budgetsByCategory, setBudgetsByCategory] = useState<Record<string, BudgetInfo>>({});
  const [weeklyContext, setWeeklyContext] = useState<WeeklyBudgetContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRange, setCurrentRange] = useState<{ start: string; end: string } | null>(null);
  const [comparisonRange, setComparisonRange] = useState<{ start: string; end: string } | null>(null);
  const [monthlyAllowanceByCategory, setMonthlyAllowanceByCategory] = useState<Record<string, { budget: number; spent: number }>>({});

  // Helper to get date range based on preset
  const getDateRange = (preset: DatePreset): { start: string; end: string } => {
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case 'this-week': {
        const wb = getWeekBounds(new Date());
        return { start: toDateString(wb.start), end: toDateString(wb.end) };
      }
      case 'last-week': {
        const lastWeekDate = new Date();
        lastWeekDate.setDate(lastWeekDate.getDate() - 7);
        const wb = getWeekBounds(lastWeekDate);
        return { start: toDateString(wb.start), end: toDateString(wb.end) };
      }
      case 'this-month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last-month':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() - 1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0); // Last day of previous month
        end.setHours(23, 59, 59, 999);
        break;
      case 'this-year':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        return { start: startDate, end: endDate };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  // Get comparison period (same duration, shifted back)
  const getComparisonRange = (start: string, end: string): { start: string; end: string } => {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const duration = endMs - startMs;

    const compStart = new Date(startMs - duration);
    const compEnd = new Date(endMs - duration);

    return {
      start: compStart.toISOString().split('T')[0],
      end: compEnd.toISOString().split('T')[0],
    };
  };

  // Convert budget to match the selected view period
  const convertBudgetToPeriod = (budget: BudgetGoal, viewPeriod: 'month' | 'year' | 'custom', daysInRange: number): number => {
    const baseAmount = budget.amount + (budget.rolloverEnabled ? budget.rolloverAmount : 0);

    // For custom ranges, we need to scale the budget appropriately
    if (viewPeriod === 'custom') {
      const periodDays: Record<string, number> = {
        weekly: 7,
        monthly: 30.44,
        yearly: 365.25,
      };
      const dailyBudget = budget.amount / periodDays[budget.period];
      return dailyBudget * daysInRange + (budget.rolloverEnabled ? budget.rolloverAmount : 0);
    }

    // For month view, convert budget to monthly equivalent
    if (viewPeriod === 'month') {
      if (budget.period === 'monthly') return baseAmount;
      if (budget.period === 'weekly') return baseAmount * 4.33; // ~4.33 weeks per month
      if (budget.period === 'yearly') return baseAmount / 12;
    }

    // For year view, convert budget to yearly equivalent
    if (viewPeriod === 'year') {
      if (budget.period === 'yearly') return baseAmount;
      if (budget.period === 'monthly') return baseAmount * 12;
      if (budget.period === 'weekly') return baseAmount * 52;
    }

    return baseAmount;
  };

  /** Convert any budget period to monthly equivalent in cents */
  const toMonthlyAmount = (budget: BudgetGoal): number => {
    const base = budget.amount + (budget.rolloverEnabled ? budget.rolloverAmount : 0);
    if (budget.period === 'monthly') return base;
    if (budget.period === 'weekly') return base * 4.33;
    if (budget.period === 'yearly') return base / 12;
    return base;
  };

  // Load spending data
  const loadData = async () => {
    setLoading(true);
    try {
      const range = getDateRange(datePreset);
      setCurrentRange(range);
      const data = await window.api.analytics.getSpendingByCategory(range.start, range.end);
      setSpendingData(data);

      // Fetch budget goals
      const budgetGoals: BudgetGoal[] = await window.api.budgetGoals.getAll();

      if (datePreset === 'this-week' || datePreset === 'last-week') {
        // --- Weekly view: compute rollover ---
        const weekStartDate = new Date(range.start + 'T00:00:00');
        const monthBounds = getMonthBounds(weekStartDate);
        const weeks = getWeeksInMonth(weekStartDate.getFullYear(), weekStartDate.getMonth());
        const daysInMonth = Math.round((monthBounds.end.getTime() - monthBounds.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Find which week we're in
        const currentWeekIndex = weeks.findIndex(w =>
          toDateString(w.start) === range.start
        );
        const weekInfo = weeks[currentWeekIndex] || weeks[0];
        const weekNumber = weekInfo.weekNumber;

        // Fetch prior weeks' spending (month start to day before this week)
        let priorSpending: SpendingData[] = [];
        if (currentWeekIndex > 0) {
          const dayBeforeWeek = new Date(weekStartDate);
          dayBeforeWeek.setDate(dayBeforeWeek.getDate() - 1);
          priorSpending = await window.api.analytics.getSpendingByCategory(
            toDateString(monthBounds.start),
            toDateString(dayBeforeWeek)
          );
        }

        // Build prior spending lookup
        const priorSpendingMap: Record<string, number> = {};
        priorSpending.forEach(s => { priorSpendingMap[s.categoryId] = s.total; });

        // Build this week spending lookup
        const thisWeekSpendingMap: Record<string, number> = {};
        data.forEach(s => { thisWeekSpendingMap[s.categoryId] = s.total; });

        // Compute per-category rollover
        const perCategory: Record<string, WeeklyCategoryInfo> = {};
        const budgetLookup: Record<string, BudgetInfo> = {};

        // Build week breakdown with allocations (computed per budget later, use totals here)
        const weekBreakdown: WeekBreakdownEntry[] = weeks.map(w => ({
          weekNumber: w.weekNumber,
          start: toDateString(w.start),
          end: toDateString(w.end),
          days: w.days,
          allocation: 0, // Will be summed across categories below
        }));

        budgetGoals.forEach(budget => {
          const monthlyBudget = toMonthlyAmount(budget);
          const dailyRate = monthlyBudget / daysInMonth;
          const baseWeeklyAllocation = dailyRate * weekInfo.days;

          // Sum expected spending for all prior weeks
          let priorWeeksExpected = 0;
          for (let i = 0; i < currentWeekIndex; i++) {
            priorWeeksExpected += dailyRate * weeks[i].days;
          }

          const priorWeeksActual = priorSpendingMap[budget.categoryId] || 0;
          const rollover = priorWeeksExpected - priorWeeksActual;
          const effectiveBudget = baseWeeklyAllocation + rollover;
          const monthToDateSpent = (thisWeekSpendingMap[budget.categoryId] || 0) + priorWeeksActual;

          perCategory[budget.categoryId] = {
            monthlyBudget,
            baseWeeklyAllocation,
            priorWeeksExpected,
            priorWeeksActual,
            rollover,
            effectiveBudget,
            monthToDateSpent,
          };

          // Store effective budget so existing table rendering uses it
          budgetLookup[budget.categoryId] = {
            amount: effectiveBudget,
            period: budget.period,
          };

          // Accumulate allocations for week breakdown
          weeks.forEach((w, idx) => {
            weekBreakdown[idx].allocation += dailyRate * w.days;
          });
        });

        // Build monthly allowance from weekly context data
        const monthlyAllowanceData: Record<string, { budget: number; spent: number }> = {};
        budgetGoals.forEach(budget => {
          const cat = perCategory[budget.categoryId];
          if (cat) {
            monthlyAllowanceData[budget.categoryId] = {
              budget: cat.monthlyBudget,
              spent: cat.monthToDateSpent,
            };
          }
        });
        setMonthlyAllowanceByCategory(monthlyAllowanceData);

        setBudgetsByCategory(budgetLookup);
        setWeeklyContext({
          weekNumber,
          totalWeeksInMonth: weeks.length,
          daysInMonth,
          daysInThisWeek: weekInfo.days,
          weekStart: range.start,
          weekEnd: range.end,
          perCategory,
          weekBreakdown,
        });
      } else {
        // --- Non-weekly view: existing logic ---
        setWeeklyContext(null);

        const viewPeriod: 'month' | 'year' | 'custom' =
          datePreset === 'this-month' || datePreset === 'last-month' ? 'month' :
          datePreset === 'this-year' ? 'year' : 'custom';

        const startMs = new Date(range.start).getTime();
        const endMs = new Date(range.end).getTime();
        const daysInRange = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

        const budgetLookup: Record<string, BudgetInfo> = {};
        budgetGoals.forEach(budget => {
          budgetLookup[budget.categoryId] = {
            amount: convertBudgetToPeriod(budget, viewPeriod, daysInRange),
            period: budget.period,
          };
        });
        setBudgetsByCategory(budgetLookup);

        // Build monthly allowance data
        const monthlyAllowanceData: Record<string, { budget: number; spent: number }> = {};
        if (viewPeriod === 'month') {
          // Monthly view: monthly budget vs monthly spending (same as view period)
          const spendingMap: Record<string, number> = {};
          data.forEach(s => { spendingMap[s.categoryId] = s.total; });
          budgetGoals.forEach(budget => {
            monthlyAllowanceData[budget.categoryId] = {
              budget: toMonthlyAmount(budget),
              spent: spendingMap[budget.categoryId] || 0,
            };
          });
        } else {
          // Yearly/custom: fetch current month's spending
          const now = new Date();
          const monthBounds = getMonthBounds(now);
          const monthSpending = await window.api.analytics.getSpendingByCategory(
            toDateString(monthBounds.start),
            toDateString(monthBounds.end)
          );
          const monthSpendingMap: Record<string, number> = {};
          monthSpending.forEach(s => { monthSpendingMap[s.categoryId] = s.total; });
          budgetGoals.forEach(budget => {
            monthlyAllowanceData[budget.categoryId] = {
              budget: toMonthlyAmount(budget),
              spent: monthSpendingMap[budget.categoryId] || 0,
            };
          });
        }
        setMonthlyAllowanceByCategory(monthlyAllowanceData);
      }

      if (showComparison) {
        const compRange = getComparisonRange(range.start, range.end);
        setComparisonRange(compRange);
        const compData = await window.api.analytics.getSpendingByCategory(compRange.start, compRange.end);
        setComparisonData(compData);
      } else {
        setComparisonRange(null);
      }
    } catch (error) {
      console.error('Failed to load spending data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, startDate, endDate, showComparison]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getDateRange(preset);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(valueInCents / 100);
  };

  const totalSpending = spendingData.reduce((sum, item) => sum + item.total, 0);

  const budgetColumnHeader = (() => {
    if (weeklyContext) return 'Weekly Budget';
    if (datePreset === 'this-month' || datePreset === 'last-month') return 'Monthly Budget';
    if (datePreset === 'this-year') return 'Yearly Budget';
    return 'Budget';
  })();

  // Prepare data for charts
  const chartData = spendingData.map(item => ({
    name: item.categoryName,
    value: item.total,
    color: item.color,
    percentage: totalSpending > 0 ? ((item.total / totalSpending) * 100).toFixed(1) : '0',
  }));

  return (
    <div style={{ padding: '20px' }}>
      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Chart Type Selector */}
        <div>
          <label htmlFor="chart-type-select" style={{ marginRight: '8px' }}>Chart Type:</label>
          <select
            id="chart-type-select"
            data-testid="chart-type-select"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
            style={{ padding: '5px' }}
          >
            <option value="pie">Pie Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>

        {/* Date Preset Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handlePresetChange('this-week')}
            className={datePreset === 'this-week' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '5px 12px' }}
          >
            This Week
          </button>
          <button
            onClick={() => handlePresetChange('last-week')}
            className={datePreset === 'last-week' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '5px 12px' }}
          >
            Last Week
          </button>
          <button
            onClick={() => handlePresetChange('this-month')}
            className={datePreset === 'this-month' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '5px 12px' }}
          >
            This Month
          </button>
          <button
            onClick={() => handlePresetChange('last-month')}
            className={datePreset === 'last-month' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '5px 12px' }}
          >
            Last Month
          </button>
          <button
            onClick={() => handlePresetChange('this-year')}
            className={datePreset === 'this-year' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '5px 12px' }}
          >
            This Year
          </button>
        </div>

        {/* Custom Date Range */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label>Custom:</label>
          <input
            type="date"
            data-testid="start-date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatePreset('custom');
            }}
            style={{ padding: '5px' }}
          />
          <span>to</span>
          <input
            type="date"
            data-testid="end-date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatePreset('custom');
            }}
            style={{ padding: '5px' }}
          />
        </div>

        {/* Comparison Toggle */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              data-testid="comparison-toggle"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
            />
            Compare with previous period
          </label>
        </div>
      </div>

      {/* Loading State */}
      {loading && <div>Loading...</div>}

      {/* Empty State */}
      {!loading && spendingData.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>No spending data available for the selected period.</p>
        </div>
      )}

      {/* Chart */}
      {!loading && spendingData.length > 0 && (
        <div
          data-testid="spending-chart"
          data-chart-type={chartType}
          data-interactive="true"
          style={{ marginBottom: '20px' }}
        >
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={(entry) => `${entry.name}: ${entry.percent ? (entry.percent * 100).toFixed(1) : '0'}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `$${(value / 100).toLocaleString()}`} />
                <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : String(value)} />
                <Legend />
                <Bar dataKey="value" name="Spending">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>

          {/* Weekly context header */}
          {weeklyContext && (
            <div
              data-testid="weekly-context"
              className="card"
              style={{
                marginTop: '20px',
                padding: '12px 16px',
                background: 'var(--color-surface-alt, var(--color-bg))',
                borderLeft: '4px solid var(--color-primary, #4a90d9)',
              }}
            >
              <strong>
                Week {weeklyContext.weekNumber} of {weeklyContext.totalWeeksInMonth}
              </strong>
              <span style={{ marginLeft: '12px', color: 'var(--color-text-muted)' }}>
                {formatDateShort(new Date(weeklyContext.weekStart + 'T00:00:00'))}
                {' \u2013 '}
                {formatDateShort(new Date(weeklyContext.weekEnd + 'T00:00:00'))}
                {' '}({weeklyContext.daysInThisWeek} days)
              </span>
              <p style={{ margin: '6px 0 0', fontSize: '0.9em', color: 'var(--color-text-muted)' }}>
                Unspent budget from prior weeks rolls forward; overspending reduces this week&apos;s available budget.
              </p>
              {(() => {
                const totalEffectiveBudget = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.effectiveBudget, 0);
                const weeklyRemaining = totalEffectiveBudget - totalSpending;
                const totalMonthlyBudget = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthlyBudget, 0);
                const totalMTDSpent = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthToDateSpent, 0);
                const monthlyRemaining = totalMonthlyBudget - totalMTDSpent;
                const metricStyle = { flex: '1 1 0', minWidth: '140px', padding: '8px 12px', borderRadius: '6px', background: 'var(--color-bg)', textAlign: 'center' as const };
                const labelStyle = { fontSize: '0.8em', color: 'var(--color-text-muted)', marginBottom: '4px' };
                return (
                  <div data-testid="weekly-budget-summary" style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <div style={metricStyle}>
                      <div style={labelStyle}>Weekly Remaining</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 600, color: weeklyRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(weeklyRemaining)}
                      </div>
                    </div>
                    <div style={metricStyle}>
                      <div style={labelStyle}>Monthly Budget</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                        {formatCurrency(totalMonthlyBudget)}
                      </div>
                    </div>
                    <div style={metricStyle}>
                      <div style={labelStyle}>Monthly Remaining</div>
                      <div style={{ fontSize: '1.1em', fontWeight: 600, color: monthlyRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatCurrency(monthlyRemaining)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Category breakdown */}
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>Category Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>{budgetColumnHeader}</th>
                  {weeklyContext && (
                    <>
                      <th style={{ textAlign: 'right' }}>Rollover</th>
                      <th style={{ textAlign: 'right' }}>MTD Spent</th>
                      <th style={{ textAlign: 'right' }}>Monthly Budget</th>
                    </>
                  )}
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'right' }}>Transactions</th>
                  <th style={{ textAlign: 'right' }}>Mo. Remaining</th>
                  <th style={{ textAlign: 'right' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {spendingData.map((item) => {
                  const budget = budgetsByCategory[item.categoryId];
                  const budgetAmount = budget?.amount ?? null;
                  const variance = budgetAmount !== null ? budgetAmount - item.total : null;
                  const isOverBudget = variance !== null && variance < 0;
                  const isNearBudget = variance !== null && !isOverBudget && budgetAmount !== null && budgetAmount > 0 && (item.total / budgetAmount) >= 0.8;
                  const weeklyCat = weeklyContext?.perCategory[item.categoryId];

                  return (
                    <tr key={item.categoryId}>
                      <td data-testid="category-label">
                        <span
                          style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            backgroundColor: item.color,
                            marginRight: '8px',
                            borderRadius: '2px',
                          }}
                        />
                        {item.categoryName}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.total)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {budgetAmount !== null ? formatCurrency(budgetAmount) : '-'}
                      </td>
                      {weeklyContext && (
                        <>
                          <td
                            data-testid="rollover-cell"
                            style={{
                              textAlign: 'right',
                              color: weeklyCat
                                ? weeklyCat.rollover > 0
                                  ? 'var(--color-success)'
                                  : weeklyCat.rollover < 0
                                    ? 'var(--color-danger)'
                                    : 'var(--color-text-muted)'
                                : 'var(--color-text-muted)',
                            }}
                          >
                            {weeklyCat
                              ? weeklyCat.rollover === 0
                                ? '-'
                                : `${weeklyCat.rollover > 0 ? '+' : ''}${formatCurrency(weeklyCat.rollover)}`
                              : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {weeklyCat ? formatCurrency(weeklyCat.monthToDateSpent) : '-'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                            {weeklyCat ? formatCurrency(weeklyCat.monthlyBudget) : '-'}
                          </td>
                        </>
                      )}
                      <td
                        style={{
                          textAlign: 'right',
                          color: variance === null ? 'var(--color-text-muted)' : isOverBudget ? 'var(--color-danger)' : isNearBudget ? 'var(--color-warning)' : 'var(--color-success)',
                          fontWeight: isOverBudget ? 600 : 'normal',
                        }}
                      >
                        {variance !== null ? (
                          <>
                            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                            {isOverBudget && <span title="Over budget"> !</span>}
                          </>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{item.count}</td>
                      <td style={{ textAlign: 'right' }}>
                        {(() => {
                          const ma = monthlyAllowanceByCategory[item.categoryId];
                          if (!ma) return '-';
                          const remaining = ma.budget - ma.spent;
                          return (
                            <span style={{ color: remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {remaining >= 0 ? '+' : ''}{formatCurrency(remaining)}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {totalSpending > 0 ? ((item.total / totalSpending) * 100).toFixed(1) : '0'}%
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalSpending)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                    {Object.keys(budgetsByCategory).length > 0
                      ? formatCurrency(Object.values(budgetsByCategory).reduce((sum, b) => sum + b.amount, 0))
                      : '-'}
                  </td>
                  {weeklyContext && (
                    <>
                      <td style={{ textAlign: 'right' }}>
                        {(() => {
                          const totalRollover = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.rollover, 0);
                          if (totalRollover === 0) return '-';
                          return (
                            <span style={{ color: totalRollover > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {totalRollover > 0 ? '+' : ''}{formatCurrency(totalRollover)}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {formatCurrency(Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthToDateSpent, 0))}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                        {formatCurrency(Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthlyBudget, 0))}
                      </td>
                    </>
                  )}
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      const totalBudget = Object.values(budgetsByCategory).reduce((sum, b) => sum + b.amount, 0);
                      if (totalBudget === 0) return '-';
                      const totalVariance = totalBudget - totalSpending;
                      return (
                        <span style={{ color: totalVariance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {spendingData.reduce((sum, item) => sum + item.count, 0)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(() => {
                      const entries = Object.values(monthlyAllowanceByCategory);
                      if (entries.length === 0) return '-';
                      const totalRemaining = entries.reduce((s, e) => s + (e.budget - e.spent), 0);
                      return (
                        <span style={{ color: totalRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {totalRemaining >= 0 ? '+' : ''}{formatCurrency(totalRemaining)}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Collapsible weekly breakdown panel */}
          {weeklyContext && (
            <details data-testid="weekly-breakdown" className="card" style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}>
                Weekly Budget Distribution
              </summary>
              <table className="data-table" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Dates</th>
                    <th style={{ textAlign: 'right' }}>Days</th>
                    <th style={{ textAlign: 'right' }}>Total Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyContext.weekBreakdown.map((wb) => {
                    const isCurrent = wb.weekNumber === weeklyContext.weekNumber;
                    return (
                      <tr
                        key={wb.weekNumber}
                        style={isCurrent ? { background: 'rgba(59, 130, 246, 0.12)', fontWeight: 600 } : {}}
                      >
                        <td>
                          Week {wb.weekNumber}
                          {isCurrent && <span style={{ marginLeft: '6px', fontSize: '0.85em', color: 'var(--color-primary)' }}>(current)</span>}
                        </td>
                        <td>
                          {formatDateShort(new Date(wb.start + 'T00:00:00'))}
                          {' \u2013 '}
                          {formatDateShort(new Date(wb.end + 'T00:00:00'))}
                        </td>
                        <td style={{ textAlign: 'right' }}>{wb.days}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(wb.allocation)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {/* Weekly context when empty state (no spending but still show weekly info) */}
      {!loading && spendingData.length === 0 && weeklyContext && (
        <div
          data-testid="weekly-context"
          className="card"
          style={{
            marginTop: '20px',
            padding: '12px 16px',
            background: 'var(--color-surface-alt, var(--color-bg))',
            borderLeft: '4px solid var(--color-primary, #4a90d9)',
          }}
        >
          <strong>
            Week {weeklyContext.weekNumber} of {weeklyContext.totalWeeksInMonth}
          </strong>
          <span style={{ marginLeft: '12px', color: 'var(--color-text-muted)' }}>
            {formatDateShort(new Date(weeklyContext.weekStart + 'T00:00:00'))}
            {' \u2013 '}
            {formatDateShort(new Date(weeklyContext.weekEnd + 'T00:00:00'))}
            {' '}({weeklyContext.daysInThisWeek} days)
          </span>
          <p style={{ margin: '6px 0 0', fontSize: '0.9em', color: 'var(--color-text-muted)' }}>
            Unspent budget from prior weeks rolls forward; overspending reduces this week&apos;s available budget.
          </p>
          {(() => {
            const totalEffectiveBudget = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.effectiveBudget, 0);
            const weeklyRemaining = totalEffectiveBudget - totalSpending;
            const totalMonthlyBudget = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthlyBudget, 0);
            const totalMTDSpent = Object.values(weeklyContext.perCategory).reduce((s, c) => s + c.monthToDateSpent, 0);
            const monthlyRemaining = totalMonthlyBudget - totalMTDSpent;
            const metricStyle = { flex: '1 1 0', minWidth: '140px', padding: '8px 12px', borderRadius: '6px', background: 'var(--color-bg)', textAlign: 'center' as const };
            const labelStyle = { fontSize: '0.8em', color: 'var(--color-text-muted)', marginBottom: '4px' };
            return (
              <div data-testid="weekly-budget-summary" style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div style={metricStyle}>
                  <div style={labelStyle}>Weekly Remaining</div>
                  <div style={{ fontSize: '1.1em', fontWeight: 600, color: weeklyRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(weeklyRemaining)}
                  </div>
                </div>
                <div style={metricStyle}>
                  <div style={labelStyle}>Monthly Budget</div>
                  <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                    {formatCurrency(totalMonthlyBudget)}
                  </div>
                </div>
                <div style={metricStyle}>
                  <div style={labelStyle}>Monthly Remaining</div>
                  <div style={{ fontSize: '1.1em', fontWeight: 600, color: monthlyRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(monthlyRemaining)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Comparison Section */}
      {!loading && showComparison && comparisonData.length > 0 && (
        <div data-testid="comparison-section" className="card" style={{ marginTop: '30px' }}>
          <h3>Comparison with Previous Period</h3>
          {currentRange && comparisonRange && (
            <p style={{ margin: '4px 0 12px', fontSize: '0.9em', color: 'var(--color-text-muted)' }}>
              <strong>Current:</strong> {formatDateShort(new Date(currentRange.start + 'T00:00:00'))} – {formatDateShort(new Date(currentRange.end + 'T00:00:00'))}
              {' · '}
              <strong>Previous:</strong> {formatDateShort(new Date(comparisonRange.start + 'T00:00:00'))} – {formatDateShort(new Date(comparisonRange.end + 'T00:00:00'))}
            </p>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>
                  Current{currentRange ? ` (${formatDateShort(new Date(currentRange.start + 'T00:00:00'))} – ${formatDateShort(new Date(currentRange.end + 'T00:00:00'))})` : ' Period'}
                </th>
                <th style={{ textAlign: 'right' }}>
                  Previous{comparisonRange ? ` (${formatDateShort(new Date(comparisonRange.start + 'T00:00:00'))} – ${formatDateShort(new Date(comparisonRange.end + 'T00:00:00'))})` : ' Period'}
                </th>
                <th style={{ textAlign: 'right' }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {spendingData.map((current) => {
                const previous = comparisonData.find(c => c.categoryId === current.categoryId);
                const previousTotal = previous?.total || 0;
                const change = current.total - previousTotal;
                const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100).toFixed(1) : 'N/A';

                return (
                  <tr key={current.categoryId}>
                    <td>{current.categoryName}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(current.total)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(previousTotal)}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        color: change > 0 ? 'var(--color-danger)' : change < 0 ? 'var(--color-success)' : 'inherit',
                      }}
                    >
                      {change > 0 ? '+' : ''}{formatCurrency(change)}
                      {changePercent !== 'N/A' && ` (${change > 0 ? '+' : ''}${changePercent}%)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SpendingVisualization;
