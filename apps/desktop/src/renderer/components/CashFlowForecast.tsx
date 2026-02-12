import React, { useEffect, useState, useCallback } from 'react';
import { Account, Category } from '../../shared/types';
import type {
  EnhancedBalanceProjection,
  ForecastGranularity,
} from '../../shared/window.d';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

interface CashFlowProjection {
  date: string;
  balance: number;
  balanceLower?: number;
  balanceUpper?: number;
  income: number;
  expenses: number;
  recurringTotal?: number;
  trendTotal?: number;
  confidence?: number;
  transactions: Array<{
    description: string;
    amount: number;
    categoryName: string;
    categoryId?: string | null;
    source?: 'recurring' | 'trend';
  }>;
}

interface CashFlowForecastResult {
  accountId: string;
  accountName: string;
  currentBalance: number;
  projections: CashFlowProjection[];
  warnings: Array<{
    date: string;
    type: 'negative' | 'low' | 'uncertainty';
    balance: number;
  }>;
  summary?: {
    totalRecurringIncome: number;
    totalRecurringExpenses: number;
    totalTrendExpenses: number;
    averageConfidence: number;
  };
  granularity?: ForecastGranularity;
  includedCategoryTrends?: boolean;
}

const ALL_ACCOUNTS = '__all__';

// Forecast period options with labels
const FORECAST_PERIODS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
  { value: 1095, label: '3 years' },
  { value: 1825, label: '5 years' },
];

// Editable category amount component
interface EditableAmountProps {
  categoryId: string;
  calculatedAmount: number;
  overriddenAmount: number | undefined;
  forecastMonths: number;
  color: string;
  onOverride: (categoryId: string, amount: number | undefined) => void;
}

const EditableAmount: React.FC<EditableAmountProps> = ({
  categoryId,
  calculatedAmount,
  overriddenAmount,
  forecastMonths,
  color,
  onOverride,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'total' | 'monthly'>('monthly');
  const [editValue, setEditValue] = useState('');

  const displayAmount = overriddenAmount !== undefined ? overriddenAmount : calculatedAmount;
  const isOverridden = overriddenAmount !== undefined;

  const handleStartEdit = () => {
    const monthlyAmount = displayAmount / forecastMonths / 100;
    setEditValue(monthlyAmount.toFixed(2));
    setEditMode('monthly');
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0) {
      const totalAmount = (editMode === 'monthly' ? parsed * forecastMonths : parsed) * 100;
      onOverride(categoryId, totalAmount);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleReset = () => {
    onOverride(categoryId, undefined);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>$</span>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              width: '80px',
              padding: '4px 6px',
              fontSize: '13px',
              border: `1px solid ${color}`,
              borderRadius: '4px',
              textAlign: 'right',
            }}
          />
          <select
            value={editMode}
            onChange={(e) => {
              const newMode = e.target.value as 'total' | 'monthly';
              const currentVal = parseFloat(editValue) || 0;
              if (newMode === 'total' && editMode === 'monthly') {
                setEditValue((currentVal * forecastMonths).toFixed(2));
              } else if (newMode === 'monthly' && editMode === 'total') {
                setEditValue((currentVal / forecastMonths).toFixed(2));
              }
              setEditMode(newMode);
            }}
            style={{
              padding: '4px',
              fontSize: '11px',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
            }}
          >
            <option value="monthly">/mo</option>
            <option value="total">total</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              backgroundColor: color,
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          {isOverridden && (
            <button
              onClick={handleReset}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleCancel}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ textAlign: 'right', cursor: 'pointer' }}
      onClick={handleStartEdit}
      title="Click to edit"
    >
      <span style={{ fontWeight: 700, color, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
        ~{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(displayAmount) / 100)}
        {isOverridden && (
          <span style={{
            fontSize: '9px',
            backgroundColor: 'var(--color-warning)',
            color: 'white',
            padding: '1px 4px',
            borderRadius: '3px',
          }}>
            edited
          </span>
        )}
      </span>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
        ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(displayAmount) / 100 / forecastMonths)}/mo)
      </div>
    </div>
  );
};

const CashFlowForecast: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(ALL_ACCOUNTS);
  const [forecastDays, setForecastDays] = useState<number>(90);
  const [includeCategoryTrends, setIncludeCategoryTrends] = useState<boolean>(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [forecast, setForecast] = useState<CashFlowForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRowDate, setExpandedRowDate] = useState<string | null>(null);
  // User overrides for category amounts (categoryId -> total amount for forecast period)
  const [categoryOverrides, setCategoryOverrides] = useState<Map<string, number>>(new Map());

  const handleCategoryOverride = useCallback((categoryId: string, amount: number | undefined) => {
    setCategoryOverrides(prev => {
      const next = new Map(prev);
      if (amount === undefined) {
        next.delete(categoryId);
      } else {
        next.set(categoryId, amount);
      }
      return next;
    });
  }, []);

  const loadAccounts = useCallback(async () => {
    const [allAccounts, allCategories] = await Promise.all([
      window.api.accounts.getAll(),
      window.api.categories.getAll(),
    ]);
    setAccounts(allAccounts);
    // Include all categories (both income and expense)
    setCategories(allCategories);
  }, []);

  const loadForecast = useCallback(async () => {
    if (accounts.length === 0) return;

    setLoading(true);
    try {
      // Use enhanced API for longer forecasts or when trends are enabled
      const useEnhancedApi = forecastDays > 365 || includeCategoryTrends;

      if (useEnhancedApi) {
        if (selectedAccountId === ALL_ACCOUNTS) {
          // Aggregate enhanced forecasts across all accounts
          const allForecasts = await Promise.all(
            accounts.map((acc, index) => window.api.cashflow.forecastEnhanced(acc.id, {
              forecastDays,
              includeCategoryTrends: includeCategoryTrends && index === 0,
              selectedCategoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
            }))
          );

          const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
          const projectionsByDate = new Map<string, CashFlowProjection>();

          // Aggregate projections from all accounts
          for (const result of allForecasts) {
            for (const p of result.projections) {
              const dateStr = typeof p.date === 'string' ? p.date : new Date(p.date).toISOString().split('T')[0];
              const existing = projectionsByDate.get(dateStr);

              const income = p.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
              const expenses = Math.abs(p.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
              const txns = p.transactions.map(t => ({
                description: t.description,
                amount: t.amount,
                categoryName: '',
                categoryId: t.categoryId,
                source: t.source,
              }));

              if (existing) {
                existing.income += income;
                existing.expenses += expenses;
                existing.recurringTotal = (existing.recurringTotal || 0) + (p.recurringTotal || 0);
                existing.trendTotal = (existing.trendTotal || 0) + (p.trendTotal || 0);
                existing.transactions.push(...txns);
                // Average confidence across accounts
                if (existing.confidence !== undefined && p.confidence !== undefined) {
                  existing.confidence = (existing.confidence + p.confidence) / 2;
                }
              } else {
                projectionsByDate.set(dateStr, {
                  date: dateStr,
                  balance: 0, // Will be calculated after sorting
                  balanceLower: undefined,
                  balanceUpper: undefined,
                  income,
                  expenses,
                  recurringTotal: p.recurringTotal,
                  trendTotal: p.trendTotal,
                  confidence: p.confidence,
                  transactions: txns,
                });
              }
            }
          }

          // Sort projections by date and calculate running balance
          const sortedProjections = Array.from(projectionsByDate.values())
            .sort((a, b) => a.date.localeCompare(b.date));

          let runningBalance = totalBalance;
          for (const projection of sortedProjections) {
            runningBalance += projection.income - projection.expenses;
            projection.balance = runningBalance;
            // Calculate confidence bounds (±10% based on confidence)
            if (projection.confidence !== undefined) {
              const uncertainty = (1 - projection.confidence) * 0.1 * Math.abs(runningBalance);
              projection.balanceLower = runningBalance - uncertainty;
              projection.balanceUpper = runningBalance + uncertainty;
            }
          }

          // Aggregate warnings from all accounts and add new ones
          const allWarnings: CashFlowForecastResult['warnings'] = [];
          const seenWarningDates = new Set<string>();

          // Add warnings based on aggregated projections
          for (const projection of sortedProjections) {
            if (projection.balance < 0 && !seenWarningDates.has(`negative-${projection.date}`)) {
              allWarnings.push({ date: projection.date, type: 'negative', balance: projection.balance });
              seenWarningDates.add(`negative-${projection.date}`);
            } else if (projection.balance < 50000 && projection.balance >= 0 && !seenWarningDates.has(`low-${projection.date}`)) {
              allWarnings.push({ date: projection.date, type: 'low', balance: projection.balance });
              seenWarningDates.add(`low-${projection.date}`);
            }
            if (projection.confidence !== undefined && projection.confidence < 0.5 && !seenWarningDates.has(`uncertainty-${projection.date}`)) {
              allWarnings.push({ date: projection.date, type: 'uncertainty', balance: projection.balance });
              seenWarningDates.add(`uncertainty-${projection.date}`);
            }
          }

          // Aggregate summary totals
          const aggregatedSummary = {
            totalRecurringIncome: allForecasts.reduce((sum, r) => sum + r.summary.totalRecurringIncome, 0),
            totalRecurringExpenses: allForecasts.reduce((sum, r) => sum + r.summary.totalRecurringExpenses, 0),
            totalTrendExpenses: allForecasts.reduce((sum, r) => sum + r.summary.totalTrendExpenses, 0),
            averageConfidence: allForecasts.reduce((sum, r) => sum + r.summary.averageConfidence, 0) / allForecasts.length,
          };

          setForecast({
            accountId: ALL_ACCOUNTS,
            accountName: 'All Accounts',
            currentBalance: totalBalance,
            granularity: allForecasts[0]?.granularity,
            includedCategoryTrends: allForecasts[0]?.includedCategoryTrends,
            projections: sortedProjections,
            warnings: allWarnings,
            summary: aggregatedSummary,
          });
        } else {
          // Single account - use enhanced cashflow forecast
          const result = await window.api.cashflow.forecastEnhanced(selectedAccountId, {
            forecastDays,
            includeCategoryTrends,
            selectedCategoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          });

          // Transform enhanced result to component interface
          const transformedForecast: CashFlowForecastResult = {
            accountId: result.accountId,
            accountName: accounts.find(a => a.id === selectedAccountId)?.name || 'Unknown',
            currentBalance: result.startingBalance,
            granularity: result.granularity,
            includedCategoryTrends: result.includedCategoryTrends,
            projections: result.projections.map((p: EnhancedBalanceProjection) => ({
              date: typeof p.date === 'string' ? p.date : new Date(p.date).toISOString().split('T')[0],
              balance: p.balance,
              balanceLower: p.balanceLower,
              balanceUpper: p.balanceUpper,
              confidence: p.confidence,
              recurringTotal: p.recurringTotal,
              trendTotal: p.trendTotal,
              income: p.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
              expenses: Math.abs(p.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
              transactions: p.transactions.map(t => ({
                description: t.description,
                amount: t.amount,
                categoryName: '',
                categoryId: t.categoryId,
                source: t.source,
              })),
            })),
            warnings: result.warnings.map(w => ({
              date: typeof w.date === 'string' ? w.date : new Date(w.date).toISOString().split('T')[0],
              type: w.type === 'negative_balance' ? 'negative' as const :
                    w.type === 'high_uncertainty' ? 'uncertainty' as const : 'low' as const,
              balance: w.balance,
            })),
            summary: {
              totalRecurringIncome: result.summary.totalRecurringIncome,
              totalRecurringExpenses: result.summary.totalRecurringExpenses,
              totalTrendExpenses: result.summary.totalTrendExpenses,
              averageConfidence: result.summary.averageConfidence,
            },
          };

          setForecast(transformedForecast);
        }
      } else {
        // Use standard API for shorter forecasts
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (selectedAccountId === ALL_ACCOUNTS) {
          const allForecasts = await Promise.all(
            accounts.map(acc => window.api.cashflow.forecast(acc.id, startDate, endDate))
          );

          const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
          const projectionsByDate = new Map<string, CashFlowProjection>();

          for (const result of allForecasts) {
            for (const p of result.projections) {
              const dateStr = typeof p.date === 'string' ? p.date : new Date(p.date).toISOString().split('T')[0];
              const existing = projectionsByDate.get(dateStr);

              const income = p.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
              const expenses = Math.abs(p.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
              const txns = p.transactions.map(t => ({
                description: t.description,
                amount: t.amount,
                categoryName: '',
                source: 'recurring' as const,
              }));

              if (existing) {
                existing.income += income;
                existing.expenses += expenses;
                existing.transactions.push(...txns);
              } else {
                projectionsByDate.set(dateStr, {
                  date: dateStr,
                  balance: 0,
                  income,
                  expenses,
                  transactions: txns,
                });
              }
            }
          }

          const sortedProjections = Array.from(projectionsByDate.values())
            .sort((a, b) => a.date.localeCompare(b.date));

          let runningBalance = totalBalance;
          for (const projection of sortedProjections) {
            runningBalance += projection.income - projection.expenses;
            projection.balance = runningBalance;
          }

          const allWarnings: CashFlowForecastResult['warnings'] = [];
          for (const projection of sortedProjections) {
            if (projection.balance < 0) {
              allWarnings.push({ date: projection.date, type: 'negative', balance: projection.balance });
            } else if (projection.balance < 50000) {
              allWarnings.push({ date: projection.date, type: 'low', balance: projection.balance });
            }
          }

          setForecast({
            accountId: ALL_ACCOUNTS,
            accountName: 'All Accounts',
            currentBalance: totalBalance,
            projections: sortedProjections,
            warnings: allWarnings,
          });
        } else {
          const result = await window.api.cashflow.forecast(selectedAccountId, startDate, endDate);
          const account = await window.api.accounts.getById(selectedAccountId);
          const accountName = account ? account.name : 'Unknown';

          const transformedForecast: CashFlowForecastResult = {
            accountId: result.accountId,
            accountName,
            currentBalance: result.startingBalance,
            projections: result.projections.map(p => ({
              date: typeof p.date === 'string' ? p.date : new Date(p.date).toISOString().split('T')[0],
              balance: p.balance,
              income: p.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
              expenses: Math.abs(p.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
              transactions: p.transactions.map(t => ({
                description: t.description,
                amount: t.amount,
                categoryName: '',
                source: 'recurring' as const,
              })),
            })),
            warnings: result.warnings.map(w => ({
              date: typeof w.date === 'string' ? w.date : new Date(w.date).toISOString().split('T')[0],
              type: w.type === 'negative_balance' ? 'negative' as const : 'low' as const,
              balance: w.balance,
            })),
          };

          setForecast(transformedForecast);
        }
      }
    } catch (error) {
      console.error('Error loading forecast:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, forecastDays, includeCategoryTrends, selectedCategoryIds, accounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      loadForecast();
    }
  }, [accounts, selectedAccountId, forecastDays, includeCategoryTrends, selectedCategoryIds, loadForecast]);

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    // For longer forecasts, show month/year
    if (forecastDays > 365) {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getBalanceColor = (balance: number): string => {
    if (balance < 0) return 'var(--color-danger)';
    if (balance < 50000) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'var(--color-success)';
    if (confidence >= 0.5) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  // Prepare chart data with confidence bands
  const chartData = forecast ? [
    { date: 'Today', balance: forecast.currentBalance, balanceLower: forecast.currentBalance, balanceUpper: forecast.currentBalance, displayDate: 'Today' },
    ...forecast.projections.map(p => ({
      date: p.date,
      balance: p.balance,
      balanceLower: p.balanceLower || p.balance,
      balanceUpper: p.balanceUpper || p.balance,
      displayDate: formatShortDate(p.date),
    })),
  ] : [];

  // Sample chart data for longer forecasts (avoid too many points)
  const sampledChartData = chartData.length > 100
    ? chartData.filter((_, i) => i === 0 || i === chartData.length - 1 || i % Math.ceil(chartData.length / 50) === 0)
    : chartData;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Cash Flow Forecast</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        Project your account balance based on recurring transactions
        {includeCategoryTrends && ' and spending trends'}
      </p>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="account-select" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Account
          </label>
          <select
            id="account-select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            <option value={ALL_ACCOUNTS}>
              All Accounts ({formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))})
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({formatCurrency(account.balance)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="forecast-days" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Forecast Period
          </label>
          <select
            id="forecast-days"
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
          >
            {FORECAST_PERIODS.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
          <input
            type="checkbox"
            id="include-trends"
            checked={includeCategoryTrends}
            onChange={(e) => setIncludeCategoryTrends(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="include-trends" style={{ fontWeight: 'bold', cursor: 'pointer' }}>
            Include Category Spending Trends
          </label>
        </div>

        {/* Category Picker - shown when trends are enabled */}
        {includeCategoryTrends && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>
                {selectedCategoryIds.length === 0
                  ? 'All Categories'
                  : (() => {
                      const selectedCategories = categories.filter(c => selectedCategoryIds.includes(c.id));
                      const incomeCount = selectedCategories.filter(c => c.type === 'income').length;
                      const expenseCount = selectedCategories.filter(c => c.type === 'expense').length;
                      if (incomeCount > 0 && expenseCount > 0) {
                        return `${incomeCount} income, ${expenseCount} expense selected`;
                      } else if (incomeCount > 0) {
                        return `${incomeCount} income selected`;
                      } else {
                        return `${expenseCount} expense selected`;
                      }
                    })()}
              </span>
              <span style={{ fontSize: '10px' }}>{showCategoryPicker ? '▲' : '▼'}</span>
            </button>

            {showCategoryPicker && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 100,
                  marginTop: '4px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  minWidth: '220px',
                }}
              >
                {/* Select All / Clear All */}
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  gap: '12px',
                }}>
                  <button
                    onClick={() => setSelectedCategoryIds(categories.map(c => c.id))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedCategoryIds([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Clear All
                  </button>
                </div>

                {/* Category List - Grouped by Type */}
                {(() => {
                  const incomeCategories = categories.filter(c => c.type === 'income');
                  const expenseCategories = categories.filter(c => c.type === 'expense');

                  return (
                    <>
                      {/* Income Categories Section */}
                      {incomeCategories.length > 0 && (
                        <>
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: 'var(--color-success)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            Income Categories
                          </div>
                          {incomeCategories.map(category => (
                            <label
                              key={category.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--color-border-light, rgba(0,0,0,0.05))',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategoryIds.includes(category.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                                  } else {
                                    setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== category.id));
                                  }
                                }}
                                style={{ width: '16px', height: '16px' }}
                              />
                              {category.color && (
                                <span
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: category.color,
                                  }}
                                />
                              )}
                              <span style={{ fontSize: '13px' }}>{category.name}</span>
                            </label>
                          ))}
                        </>
                      )}

                      {/* Expense Categories Section */}
                      {expenseCategories.length > 0 && (
                        <>
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.1))',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: 'var(--color-danger)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            borderTop: incomeCategories.length > 0 ? '2px solid var(--color-border)' : 'none',
                          }}>
                            Expense Categories
                          </div>
                          {expenseCategories.map(category => (
                            <label
                              key={category.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--color-border-light, rgba(0,0,0,0.05))',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategoryIds.includes(category.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                                  } else {
                                    setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== category.id));
                                  }
                                }}
                                style={{ width: '16px', height: '16px' }}
                              />
                              {category.color && (
                                <span
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: category.color,
                                  }}
                                />
                              )}
                              <span style={{ fontSize: '13px' }}>{category.name}</span>
                            </label>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info about granularity and confidence */}
      {forecast && (forecast.granularity || forecast.summary) && (
        <div style={{
          padding: '10px 15px',
          marginBottom: '20px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          {forecast.granularity && (
            <span>
              <strong>Granularity:</strong> {forecast.granularity}
            </span>
          )}
          {forecast.summary && (
            <span style={{ color: getConfidenceColor(forecast.summary.averageConfidence) }}>
              <strong>Confidence:</strong> {(forecast.summary.averageConfidence * 100).toFixed(0)}%
            </span>
          )}
          {forecast.includedCategoryTrends && (
            <span style={{ color: 'var(--color-info)' }}>
              Category trends included
            </span>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" />
          <p style={{ marginTop: '10px', color: 'var(--color-text-muted)' }}>
            {forecastDays > 365 ? 'Generating long-term forecast...' : 'Loading forecast...'}
          </p>
        </div>
      )}

      {!loading && forecast && (
        <>
          {/* Summary Cards */}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '20px' }}>
            <div className="card">
              <div className="card-title">Current Balance</div>
              <div className="card-value" style={{ fontSize: '24px', color: getBalanceColor(forecast.currentBalance) }}>
                {formatCurrency(forecast.currentBalance)}
              </div>
            </div>

            {forecast.projections.length > 0 && (
              <div className="card">
                <div className="card-title">
                  Projected Balance
                </div>
                <div className="card-value" style={{ fontSize: '24px', color: getBalanceColor(forecast.projections[forecast.projections.length - 1].balance) }}>
                  {formatCurrency(forecast.projections[forecast.projections.length - 1].balance)}
                </div>
                {forecast.projections[forecast.projections.length - 1].balanceLower !== undefined && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Range: {formatCurrency(forecast.projections[forecast.projections.length - 1].balanceLower!)} - {formatCurrency(forecast.projections[forecast.projections.length - 1].balanceUpper!)}
                  </div>
                )}
              </div>
            )}

            {forecast.projections.length > 0 && (
              <div className="card">
                <div className="card-title">Net Change</div>
                <div className="card-value" style={{
                  fontSize: '24px',
                  color: (forecast.projections[forecast.projections.length - 1].balance - forecast.currentBalance) >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                }}>
                  {formatCurrency(forecast.projections[forecast.projections.length - 1].balance - forecast.currentBalance)}
                </div>
              </div>
            )}

            {forecast.summary && (
              <div className="card">
                <div className="card-title">Income & Expense Breakdown</div>
                <div style={{ fontSize: '13px' }}>
                  {(() => {
                    // Calculate trend income from projections
                    const trendIncome = forecast.projections.reduce((sum, p) =>
                      sum + p.transactions
                        .filter(t => t.source === 'trend' && t.amount > 0)
                        .reduce((s, t) => s + t.amount, 0), 0);

                    const netRecurring = forecast.summary.totalRecurringIncome - forecast.summary.totalRecurringExpenses;
                    const netWithTrends = netRecurring + trendIncome - forecast.summary.totalTrendExpenses;

                    return (
                      <>
                        {/* Income Section */}
                        <div style={{ color: 'var(--color-success)', marginBottom: '4px' }}>
                          Recurring Income: {formatCurrency(forecast.summary.totalRecurringIncome)}
                        </div>
                        {trendIncome > 0 && (
                          <div style={{ color: 'var(--color-warning)', marginBottom: '8px' }}>
                            Variable Income: ~{formatCurrency(trendIncome)}
                          </div>
                        )}

                        {/* Separator */}
                        <div style={{
                          height: '1px',
                          backgroundColor: 'var(--color-border)',
                          margin: '8px 0',
                        }} />

                        {/* Expense Section */}
                        <div style={{ color: 'var(--color-danger)', marginBottom: '4px' }}>
                          Recurring Expenses: {formatCurrency(forecast.summary.totalRecurringExpenses)}
                        </div>
                        {forecast.summary.totalTrendExpenses > 0 && (
                          <div style={{ color: 'var(--color-warning)', marginBottom: '8px' }}>
                            Variable Spending: ~{formatCurrency(forecast.summary.totalTrendExpenses)}
                          </div>
                        )}

                        {/* Net Totals */}
                        <div style={{
                          height: '1px',
                          backgroundColor: 'var(--color-border)',
                          margin: '8px 0',
                        }} />
                        <div style={{
                          marginBottom: '4px',
                          fontWeight: 600,
                          color: netRecurring >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          Net Recurring: {formatCurrency(netRecurring)}
                        </div>
                        {(trendIncome > 0 || forecast.summary.totalTrendExpenses > 0) && (
                          <div style={{
                            fontWeight: 600,
                            color: netWithTrends >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                          }}>
                            Net with Trends: ~{formatCurrency(netWithTrends)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Category Trends Breakdown - Only when trends enabled */}
          {includeCategoryTrends && forecast.summary && forecast.projections.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '5px' }}>
                Variable Spending by Category
              </h3>
              <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Projected spending beyond your recurring transactions (based on historical patterns)
              </p>

              {(() => {
                // Aggregate category data from all projections
                const categoryTotals = new Map<string, {
                  categoryId: string;
                  categoryName: string;
                  amount: number;
                  type: 'income' | 'expense';
                  color?: string;
                }>();

                // Get category info for lookup
                const categoryMap = new Map(categories.map(c => [c.id, c]));

                // Process all transactions from projections
                forecast.projections.forEach(projection => {
                  projection.transactions
                    .filter(t => t.source === 'trend' && t.categoryId)
                    .forEach(txn => {
                      const categoryId = txn.categoryId!;
                      const category = categoryMap.get(categoryId);

                      if (category && (selectedCategoryIds.length === 0 || selectedCategoryIds.includes(categoryId))) {
                        const existing = categoryTotals.get(categoryId);
                        if (existing) {
                          existing.amount += txn.amount;
                        } else {
                          categoryTotals.set(categoryId, {
                            categoryId,
                            categoryName: category.name,
                            amount: txn.amount,
                            type: txn.amount >= 0 ? 'income' : 'expense',
                            color: category.color,
                          });
                        }
                      }
                    });
                });

                const categoryData = Array.from(categoryTotals.values());
                const incomeCategories = categoryData
                  .filter(c => c.type === 'income')
                  .sort((a, b) => b.amount - a.amount);
                const expenseCategories = categoryData
                  .filter(c => c.type === 'expense')
                  .sort((a, b) => a.amount - b.amount); // Sort by most negative first

                // Calculate months in forecast for per-month display
                const forecastMonths = forecastDays / 30;

                // Helper to get display amount (with override if set)
                const getDisplayAmount = (categoryId: string, calculatedAmount: number) => {
                  const override = categoryOverrides.get(categoryId);
                  return override !== undefined ? override : Math.abs(calculatedAmount);
                };

                // Calculate totals with overrides applied
                const totalIncome = incomeCategories.reduce((sum, c) => {
                  const displayAmt = getDisplayAmount(c.categoryId, c.amount);
                  return sum + displayAmt;
                }, 0);
                const totalExpenses = expenseCategories.reduce((sum, c) => {
                  const displayAmt = getDisplayAmount(c.categoryId, c.amount);
                  return sum + displayAmt;
                }, 0);

                if (incomeCategories.length === 0 && expenseCategories.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
                      No category trend data available. Transactions may not be categorized or there may not be enough historical data.
                    </div>
                  );
                }

                return (
                  <div>
                    {/* Period info */}
                    <div style={{
                      marginBottom: '15px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--color-text-muted)',
                    }}>
                      Showing totals for {forecastDays} days (~{forecastMonths.toFixed(1)} months).
                      Per-month averages shown in parentheses.
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: incomeCategories.length > 0 && expenseCategories.length > 0 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr',
                      gap: '20px',
                    }}>
                    {/* Income Column */}
                    {incomeCategories.length > 0 && (
                      <div>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--color-success)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span style={{ fontSize: '16px' }}>↑</span>
                          Projected Income by Category
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {incomeCategories.map((cat) => (
                            <div
                              key={cat.categoryId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                backgroundColor: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
                                borderRadius: 'var(--radius-sm, 4px)',
                                border: '1px solid var(--color-success-border, rgba(34, 197, 94, 0.2))',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {cat.color && (
                                  <span
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      backgroundColor: cat.color,
                                    }}
                                  />
                                )}
                                <span style={{ fontWeight: 500 }}>{cat.categoryName}</span>
                              </div>
                              <EditableAmount
                                categoryId={cat.categoryId}
                                calculatedAmount={Math.abs(cat.amount)}
                                overriddenAmount={categoryOverrides.get(cat.categoryId)}
                                forecastMonths={forecastMonths}
                                color="var(--color-success)"
                                onOverride={handleCategoryOverride}
                              />
                            </div>
                          ))}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            marginTop: '4px',
                            borderTop: '2px solid var(--color-border)',
                            fontWeight: 700,
                            fontSize: '15px',
                          }}>
                            <span>Total Projected Income</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: 'var(--color-success)' }}>
                                ~{formatCurrency(totalIncome)}
                              </span>
                              <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>
                                ({formatCurrency(totalIncome / forecastMonths)}/mo)
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expense Column */}
                    {expenseCategories.length > 0 && (
                      <div>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--color-danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span style={{ fontSize: '16px' }}>↓</span>
                          Projected Expenses by Category
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {expenseCategories.map((cat) => (
                            <div
                              key={cat.categoryId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.1))',
                                borderRadius: 'var(--radius-sm, 4px)',
                                border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.2))',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {cat.color && (
                                  <span
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      backgroundColor: cat.color,
                                    }}
                                  />
                                )}
                                <span style={{ fontWeight: 500 }}>{cat.categoryName}</span>
                              </div>
                              <EditableAmount
                                categoryId={cat.categoryId}
                                calculatedAmount={Math.abs(cat.amount)}
                                overriddenAmount={categoryOverrides.get(cat.categoryId)}
                                forecastMonths={forecastMonths}
                                color="var(--color-danger)"
                                onOverride={handleCategoryOverride}
                              />
                            </div>
                          ))}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            marginTop: '4px',
                            borderTop: '2px solid var(--color-border)',
                            fontWeight: 700,
                            fontSize: '15px',
                          }}>
                            <span>Total Projected Expenses</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: 'var(--color-danger)' }}>
                                ~{formatCurrency(totalExpenses)}
                              </span>
                              <div style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>
                                ({formatCurrency(totalExpenses / forecastMonths)}/mo)
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Balance Chart with Confidence Bands */}
          {forecast.projections.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
                Projected Balance Over Time
                {includeCategoryTrends && (
                  <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '10px' }}>
                    (shaded area = confidence range)
                  </span>
                )}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={sampledChartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="displayDate"
                    stroke="var(--color-text-muted)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 100000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                    labelStyle={{ color: 'var(--color-text)' }}
                    formatter={(value, name) => {
                      if (value === undefined || value === null) return ['N/A', name];
                      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                      if (name === 'balance') return [formatCurrency(numValue), 'Projected'];
                      if (name === 'balanceRange') return [formatCurrency(numValue), 'Range'];
                      return [formatCurrency(numValue), name];
                    }}
                  />
                  <ReferenceLine y={0} stroke="var(--color-danger)" strokeDasharray="5 5" />

                  {/* Confidence band gradient */}
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-warning)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-warning)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  {/* Confidence band (upper bound) */}
                  {includeCategoryTrends && (
                    <Area
                      type="monotone"
                      dataKey="balanceUpper"
                      stroke="none"
                      fill="url(#confidenceGradient)"
                      fillOpacity={1}
                    />
                  )}

                  {/* Main balance line */}
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="var(--color-primary)"
                    fill="url(#balanceGradient)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Warnings */}
          {forecast.warnings.length > 0 && (
            <div style={{
              padding: '15px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: 'var(--color-danger)' }}>Warnings</h3>
              {forecast.warnings.slice(0, 10).map((warning, idx) => (
                <div key={idx} style={{ marginBottom: '5px', color: warning.type === 'uncertainty' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                  <strong>{formatDate(warning.date)}:</strong>{' '}
                  {warning.type === 'negative'
                    ? `Balance will go negative (${formatCurrency(warning.balance)})`
                    : warning.type === 'uncertainty'
                    ? 'High forecast uncertainty'
                    : `Low balance warning (${formatCurrency(warning.balance)})`
                  }
                </div>
              ))}
              {forecast.warnings.length > 10 && (
                <div style={{ marginTop: '10px', color: 'var(--color-text-muted)' }}>
                  + {forecast.warnings.length - 10} more warnings
                </div>
              )}
            </div>
          )}

          {/* Projections Table (only for shorter forecasts or sampled) */}
          {forecast.projections.length === 0 ? (
            <div className="card" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '10px' }}>
                No recurring transactions found for this account.
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                Add recurring income or expenses to see cash flow projections.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)' }}>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Income</th>
                      <th style={{ textAlign: 'right' }}>Expenses</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                      {includeCategoryTrends && (
                        <th style={{ textAlign: 'center' }}>Confidence</th>
                      )}
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(forecast.projections.length > 100
                      ? forecast.projections.filter((_, i) => i < 20 || i === forecast.projections.length - 1 || i % Math.ceil(forecast.projections.length / 30) === 0)
                      : forecast.projections
                    ).map((projection, idx) => {
                      const isExpanded = expandedRowDate === projection.date;
                      const incomeTransactions = projection.transactions.filter(t => t.amount > 0);
                      const expenseTransactions = projection.transactions.filter(t => t.amount < 0);
                      const recurringTransactions = projection.transactions.filter(t => t.source === 'recurring');
                      const trendTransactions = projection.transactions.filter(t => t.source === 'trend');
                      const colCount = includeCategoryTrends ? 6 : 5;

                      return (
                        <React.Fragment key={idx}>
                          <tr
                            onClick={() => setExpandedRowDate(isExpanded ? null : projection.date)}
                            style={{
                              backgroundColor: projection.balance < 0 ? 'var(--color-danger-bg)' : undefined,
                              cursor: 'pointer',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (projection.balance >= 0) {
                                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, rgba(0,0,0,0.03))';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (projection.balance >= 0) {
                                e.currentTarget.style.backgroundColor = '';
                              }
                            }}
                          >
                            <td>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  color: 'var(--color-text-muted)',
                                  transition: 'transform 0.15s',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}>▶</span>
                                {formatDate(projection.date)}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: projection.income > 0 ? 700 : 'normal' }}>
                              {projection.income > 0 ? formatCurrency(projection.income) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: projection.expenses > 0 ? 700 : 'normal' }}>
                              {projection.expenses > 0 ? formatCurrency(projection.expenses) : '-'}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: getBalanceColor(projection.balance)
                            }}>
                              {formatCurrency(projection.balance)}
                              {projection.balanceLower !== undefined && projection.balanceLower !== projection.balance && (
                                <div style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>
                                  ±{formatCurrency((projection.balanceUpper! - projection.balanceLower) / 2)}
                                </div>
                              )}
                            </td>
                            {includeCategoryTrends && (
                              <td style={{ textAlign: 'center' }}>
                                {projection.confidence !== undefined && (
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    backgroundColor: getConfidenceColor(projection.confidence),
                                    color: 'white',
                                  }}>
                                    {(projection.confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </td>
                            )}
                            <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                              {projection.transactions.length > 0 ? (
                                <span>
                                  {projection.transactions.length} transaction{projection.transactions.length !== 1 ? 's' : ''}
                                  {!isExpanded && ' (click to expand)'}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>No transactions</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && projection.transactions.length > 0 && (
                            <tr>
                              <td colSpan={colCount} style={{
                                padding: '0',
                                backgroundColor: 'var(--color-surface)',
                              }}>
                                <div style={{
                                  padding: '16px 20px',
                                  borderTop: '1px solid var(--color-border)',
                                  borderBottom: '2px solid var(--color-border)',
                                }}>
                                  {/* Summary stats */}
                                  <div style={{
                                    display: 'flex',
                                    gap: '24px',
                                    marginBottom: '16px',
                                    flexWrap: 'wrap',
                                  }}>
                                    <div>
                                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Net Change</span>
                                      <div style={{
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        color: (projection.income - projection.expenses) >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                                      }}>
                                        {formatCurrency(projection.income - projection.expenses)}
                                      </div>
                                    </div>
                                    {projection.recurringTotal !== undefined && (
                                      <div>
                                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>From Recurring</span>
                                        <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                          {formatCurrency(projection.recurringTotal)}
                                        </div>
                                      </div>
                                    )}
                                    {projection.trendTotal !== undefined && projection.trendTotal !== 0 && (
                                      <div>
                                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>From Trends (estimated)</span>
                                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-warning)' }}>
                                          ~{formatCurrency(Math.abs(projection.trendTotal))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Two-column layout for income and expenses */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: incomeTransactions.length > 0 && expenseTransactions.length > 0 ? '1fr 1fr' : '1fr',
                                    gap: '24px',
                                  }}>
                                    {/* Income section */}
                                    {incomeTransactions.length > 0 && (
                                      <div>
                                        <h4 style={{
                                          margin: '0 0 10px 0',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          color: 'var(--color-success)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                        }}>
                                          <span style={{ fontSize: '16px' }}>↑</span>
                                          Income ({formatCurrency(projection.income)})
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {incomeTransactions.map((txn, txnIdx) => (
                                            <div key={txnIdx} style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '8px 12px',
                                              backgroundColor: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
                                              borderRadius: 'var(--radius-sm, 4px)',
                                              border: '1px solid var(--color-success-border, rgba(34, 197, 94, 0.2))',
                                            }}>
                                              <div>
                                                <div style={{ fontWeight: 500 }}>
                                                  {txn.source === 'trend' && (
                                                    <span title="Estimated from trends" style={{
                                                      fontSize: '10px',
                                                      backgroundColor: 'var(--color-warning)',
                                                      color: 'white',
                                                      padding: '1px 4px',
                                                      borderRadius: '3px',
                                                      marginRight: '6px',
                                                    }}>~</span>
                                                  )}
                                                  {txn.description}
                                                </div>
                                                {txn.categoryName && (
                                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                    {txn.categoryName}
                                                  </div>
                                                )}
                                              </div>
                                              <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                                {formatCurrency(txn.amount)}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Expenses section */}
                                    {expenseTransactions.length > 0 && (
                                      <div>
                                        <h4 style={{
                                          margin: '0 0 10px 0',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          color: 'var(--color-danger)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                        }}>
                                          <span style={{ fontSize: '16px' }}>↓</span>
                                          Expenses ({formatCurrency(projection.expenses)})
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {expenseTransactions.map((txn, txnIdx) => (
                                            <div key={txnIdx} style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '8px 12px',
                                              backgroundColor: 'var(--color-danger-bg, rgba(239, 68, 68, 0.1))',
                                              borderRadius: 'var(--radius-sm, 4px)',
                                              border: '1px solid var(--color-danger-border, rgba(239, 68, 68, 0.2))',
                                            }}>
                                              <div>
                                                <div style={{ fontWeight: 500 }}>
                                                  {txn.source === 'trend' && (
                                                    <span title="Estimated from trends" style={{
                                                      fontSize: '10px',
                                                      backgroundColor: 'var(--color-warning)',
                                                      color: 'white',
                                                      padding: '1px 4px',
                                                      borderRadius: '3px',
                                                      marginRight: '6px',
                                                    }}>~</span>
                                                  )}
                                                  {txn.description}
                                                </div>
                                                {txn.categoryName && (
                                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                                    {txn.categoryName}
                                                  </div>
                                                )}
                                              </div>
                                              <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                                {formatCurrency(txn.amount)}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Source breakdown if both types present */}
                                  {includeCategoryTrends && recurringTransactions.length > 0 && trendTransactions.length > 0 && (
                                    <div style={{
                                      marginTop: '16px',
                                      paddingTop: '12px',
                                      borderTop: '1px solid var(--color-border)',
                                      fontSize: '12px',
                                      color: 'var(--color-text-muted)',
                                    }}>
                                      <strong>Source breakdown:</strong>{' '}
                                      {recurringTransactions.length} recurring, {trendTransactions.length} trend-based
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !forecast && accounts.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>No accounts found. Create an account to see cash flow forecasts.</p>
        </div>
      )}
    </div>
  );
};

export default CashFlowForecast;
