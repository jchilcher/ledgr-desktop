import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Responsive, WidthProvider, Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Account, Transaction, Category, TransactionSplit, SavingsGoalAlert, RecurringItem } from '../../shared/types';
import EmptyState from './EmptyState';
import { useHousehold } from '../contexts/HouseholdContext';

const ResponsiveGridLayout = WidthProvider(Responsive);

type LayoutItem = Layout;
type ResponsiveLayouts = Layouts;

interface DashboardProps {
  onNavigate: (view: string, accountId?: string) => void;
}

interface BalanceWarning {
  accountName: string;
  type: 'negative_balance' | 'low_balance';
  date: Date;
  balance: number;
  message: string;
}

interface DashboardStats {
  totalBalance: number;
  monthlySpending: number;
  monthlyIncome: number;
  recentTransactions: Transaction[];
  accounts: Account[];
  topCategories: { category: Category; amount: number }[];
}

interface UpcomingBill {
  name: string;
  amount: number;
  dueDate: string;
  accountId?: string;
}

type WidgetId =
  | 'balance-summary'
  | 'spending'
  | 'income'
  | 'top-categories'
  | 'recent-transactions'
  | 'savings-goals'
  | 'net-worth'
  | 'budget-progress'
  | 'upcoming-bills';

interface WidgetDef {
  id: WidgetId;
  title: string;
  defaultLayout: { w: number; h: number; x: number; y: number };
  minW?: number;
  minH?: number;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: 'balance-summary', title: 'Balance Summary', defaultLayout: { x: 0, y: 0, w: 4, h: 5 }, minW: 3, minH: 3 },
  { id: 'spending', title: 'Monthly Spending', defaultLayout: { x: 4, y: 0, w: 4, h: 5 }, minW: 3, minH: 3 },
  { id: 'income', title: 'Monthly Income', defaultLayout: { x: 8, y: 0, w: 4, h: 5 }, minW: 3, minH: 3 },
  { id: 'top-categories', title: 'Top Spending Categories', defaultLayout: { x: 0, y: 5, w: 6, h: 9 }, minW: 4, minH: 5 },
  { id: 'recent-transactions', title: 'Recent Transactions', defaultLayout: { x: 0, y: 14, w: 12, h: 11 }, minW: 6, minH: 6 },
  { id: 'savings-goals', title: 'Savings Goals', defaultLayout: { x: 6, y: 5, w: 6, h: 9 }, minW: 4, minH: 5 },
  { id: 'net-worth', title: 'Net Worth', defaultLayout: { x: 0, y: 25, w: 4, h: 6 }, minW: 3, minH: 4 },
  { id: 'budget-progress', title: 'Budget Progress', defaultLayout: { x: 4, y: 25, w: 4, h: 6 }, minW: 3, minH: 4 },
  { id: 'upcoming-bills', title: 'Upcoming Bills', defaultLayout: { x: 8, y: 25, w: 4, h: 6 }, minW: 3, minH: 4 },
];

const DEFAULT_VISIBLE: WidgetId[] = [
  'balance-summary', 'spending', 'income', 'top-categories',
  'recent-transactions', 'savings-goals',
];

function buildDefaultLayouts(visibleIds: WidgetId[]): ResponsiveLayouts {
  const items: LayoutItem[] = [];
  for (const id of visibleIds) {
    const def = ALL_WIDGETS.find((w) => w.id === id);
    if (!def) continue;
    items.push({
      i: id,
      ...def.defaultLayout,
      minW: def.minW,
      minH: def.minH,
    });
  }
  return { lg: items };
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { householdFilter, filterByOwnership } = useHousehold();
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    monthlySpending: 0,
    monthlyIncome: 0,
    recentTransactions: [],
    accounts: [],
    topCategories: [],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [balanceWarnings, setBalanceWarnings] = useState<BalanceWarning[]>([]);
  const [savingsAlerts, setSavingsAlerts] = useState<SavingsGoalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  // New widget data
  const [netWorthData, setNetWorthData] = useState<{ current: number; change: number } | null>(null);
  const [budgetProgressData, setBudgetProgressData] = useState<{ onTrack: number; total: number } | null>(null);
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);

  // Layout state
  const [visibleWidgets, setVisibleWidgets] = useState<Set<WidgetId>>(new Set(DEFAULT_VISIBLE));
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => buildDefaultLayouts(DEFAULT_VISIBLE));
  const [showCustomize, setShowCustomize] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved layout on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedLayout, savedWidgets] = await Promise.all([
          window.api.dashboardLayout.get(),
          window.api.dashboardLayout.getWidgets(),
        ]);

        let parsedWidgets: WidgetId[] | null = null;
        if (savedWidgets) {
          try {
            parsedWidgets = JSON.parse(savedWidgets);
          } catch { /* use defaults */ }
        }

        const widgetSet = parsedWidgets
          ? new Set<WidgetId>(parsedWidgets)
          : new Set<WidgetId>(DEFAULT_VISIBLE);
        setVisibleWidgets(widgetSet);

        if (savedLayout) {
          try {
            const parsed = JSON.parse(savedLayout);
            setLayouts(parsed);
          } catch {
            setLayouts(buildDefaultLayouts(Array.from(widgetSet)));
          }
        } else {
          setLayouts(buildDefaultLayouts(Array.from(widgetSet)));
        }
      } catch {
        // Persist APIs not available — use defaults
      } finally {
        setLayoutLoaded(true);
      }
    })();
  }, []);

  // Debounced save
  const saveLayout = useCallback((newLayouts: ResponsiveLayouts, newWidgets: Set<WidgetId>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.api.dashboardLayout.set(JSON.stringify(newLayouts)).catch(() => {});
      window.api.dashboardLayout.setWidgets(JSON.stringify(Array.from(newWidgets))).catch(() => {});
    }, 500);
  }, []);

  const handleLayoutChange = useCallback((_currentLayout: readonly LayoutItem[], allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
    saveLayout(allLayouts, visibleWidgets);
  }, [saveLayout, visibleWidgets]);

  const toggleWidget = useCallback((widgetId: WidgetId) => {
    setVisibleWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }

      // Update layouts for new widget set
      setLayouts((prevLayouts: ResponsiveLayouts) => {
        if (!next.has(widgetId)) {
          const updated: ResponsiveLayouts = {};
          for (const [bp, bpItems] of Object.entries(prevLayouts)) {
            if (bpItems) {
              updated[bp] = bpItems.filter((l) => l.i !== widgetId);
            }
          }
          saveLayout(updated, next);
          return updated;
        } else {
          const def = ALL_WIDGETS.find((w) => w.id === widgetId);
          if (!def) return prevLayouts;
          const newItem: LayoutItem = {
            i: widgetId,
            ...def.defaultLayout,
            minW: def.minW,
            minH: def.minH,
          };
          const updated: ResponsiveLayouts = {};
          for (const [bp, bpItems] of Object.entries(prevLayouts)) {
            if (bpItems) {
              updated[bp] = [...bpItems, newItem];
            }
          }
          if (!updated.lg) {
            updated.lg = [newItem];
          }
          saveLayout(updated, next);
          return updated;
        }
      });

      return next;
    });
  }, [saveLayout]);

  useEffect(() => {
    loadDashboardData();
  }, [householdFilter]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [accountsData, transactionsData, categoriesData, reimbursementLinks] = await Promise.all([
        window.api.accounts.getAll(),
        window.api.transactions.getAll(),
        window.api.categories.getAll(),
        window.api.reimbursements.getAll().catch(() => []),
      ]);

      const visibleAccounts = filterByOwnership(accountsData);
      setCategories(categoriesData);

      // Count uncategorized transactions for review banner
      const uncatCount = transactionsData.filter(
        (txn: Transaction) => txn.categoryId === null || txn.categoryId === undefined
      ).length;
      setUncategorizedCount(uncatCount);

      const expenseReimbursements = new Map<string, number>();
      const reimbursementIncomeIds = new Set<string>();
      for (const link of reimbursementLinks) {
        expenseReimbursements.set(link.expenseTransactionId, (expenseReimbursements.get(link.expenseTransactionId) || 0) + link.amount);
        reimbursementIncomeIds.add(link.reimbursementTransactionId);
      }

      const totalBalance = visibleAccounts.reduce((sum: number, acc: Account) => sum + acc.balance, 0);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const visibleAccountIds = new Set(visibleAccounts.map((acc: Account) => acc.id));
      const monthlyTransactions = transactionsData.filter((txn: Transaction) => {
        const txnDate = new Date(txn.date);
        return txnDate >= firstDayOfMonth && txnDate <= lastDayOfMonth && visibleAccountIds.has(txn.accountId);
      });

      const analyticsTransactions = monthlyTransactions.filter(
        (txn: Transaction) => !txn.isInternalTransfer
      );

      const monthlySpending = analyticsTransactions
        .filter((txn: Transaction) => txn.amount < 0)
        .reduce((sum: number, txn: Transaction) => {
          const reimbursed = expenseReimbursements.get(txn.id) || 0;
          return sum + Math.abs(txn.amount) - reimbursed;
        }, 0);

      const monthlyIncome = analyticsTransactions
        .filter((txn: Transaction) => txn.amount > 0 && !reimbursementIncomeIds.has(txn.id))
        .reduce((sum: number, txn: Transaction) => sum + txn.amount, 0);

      const recentTransactions = transactionsData
        .filter((txn: Transaction) => visibleAccountIds.has(txn.accountId))
        .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      const expenseTransactions = analyticsTransactions.filter((txn: Transaction) => txn.amount < 0 && txn.categoryId);
      const expenseIds = expenseTransactions.map((txn: Transaction) => txn.id);
      const splitsByParent = new Map<string, TransactionSplit[]>();
      if (expenseIds.length > 0) {
        try {
          const allSplits = await window.api.splits.getByTransactionIds(expenseIds);
          for (const split of allSplits) {
            const existing = splitsByParent.get(split.parentTransactionId) || [];
            existing.push(split);
            splitsByParent.set(split.parentTransactionId, existing);
          }
        } catch { /* splits not available */ }
      }

      const categorySpending = new Map<string, number>();
      expenseTransactions.forEach((txn: Transaction) => {
        const reimbursed = expenseReimbursements.get(txn.id) || 0;
        const netAmount = Math.abs(txn.amount) - reimbursed;
        if (netAmount <= 0) return;

        const txSplits = splitsByParent.get(txn.id);
        if (txSplits && txSplits.length > 0) {
          for (const split of txSplits) {
            const splitCategoryId = split.categoryId || txn.categoryId!;
            const splitAmount = Math.abs(split.amount);
            const current = categorySpending.get(splitCategoryId) || 0;
            categorySpending.set(splitCategoryId, current + splitAmount);
          }
        } else {
          const categoryId = txn.categoryId!;
          const current = categorySpending.get(categoryId) || 0;
          categorySpending.set(categoryId, current + netAmount);
        }
      });

      const topCategories = Array.from(categorySpending.entries())
        .map(([categoryId, amount]) => ({
          category: categoriesData.find((c: Category) => c.id === categoryId)!,
          amount,
        }))
        .filter((item) => item.category)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setStats({
        totalBalance,
        monthlySpending,
        monthlyIncome,
        recentTransactions,
        accounts: visibleAccounts,
        topCategories,
      });

      // Fetch forecast warnings
      try {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const forecastResults = await Promise.all(
          visibleAccounts.map((account: Account) =>
            window.api.cashflow.forecast(account.id, today, thirtyDaysOut)
              .then((result) => ({ account, result }))
              .catch(() => null)
          )
        );

        const warnings: BalanceWarning[] = [];
        for (const entry of forecastResults) {
          if (!entry) continue;
          for (const w of entry.result.warnings) {
            warnings.push({
              accountName: entry.account.name,
              type: w.type,
              date: new Date(w.date),
              balance: w.balance,
              message: w.message,
            });
          }
        }

        warnings.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'negative_balance' ? -1 : 1;
          return a.date.getTime() - b.date.getTime();
        });

        setBalanceWarnings(warnings);
      } catch {
        // Non-critical
      }

      // Fetch savings goal alerts
      try {
        const alerts = await window.api.savingsGoals.getAlerts();
        setSavingsAlerts(alerts);
      } catch {
        // Non-critical
      }

      // Fetch net worth data
      try {
        const nwResult = await window.api.netWorthCalc.calculate();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        let change = 0;
        try {
          const summary = await window.api.netWorthCalc.getChangeSummary(thirtyDaysAgo, Date.now());
          if (summary) {
            change = summary.change || 0;
          }
        } catch { /* no change data */ }
        setNetWorthData({ current: nwResult.netWorth, change });
      } catch {
        // Non-critical
      }

      // Fetch budget progress
      try {
        const goals = await window.api.budgetGoals.getAll();
        if (goals.length > 0) {
          let onTrack = 0;
          for (const goal of goals) {
            const spending = categorySpending.get(goal.categoryId) || 0;
            if (spending <= goal.amount) onTrack++;
          }
          setBudgetProgressData({ onTrack, total: goals.length });
        }
      } catch {
        // Non-critical
      }

      // Fetch upcoming bills
      try {
        const recurring: RecurringItem[] = await window.api.recurring.getActive();
        const bills = recurring
          .filter((r) => r.itemType === 'bill' || r.itemType === 'subscription')
          .sort((a, b) => {
            const dateA = a.nextOccurrence ? new Date(a.nextOccurrence).getTime() : Infinity;
            const dateB = b.nextOccurrence ? new Date(b.nextOccurrence).getTime() : Infinity;
            return dateA - dateB;
          })
          .slice(0, 5)
          .map((r) => ({
            name: r.description,
            amount: r.amount,
            dueDate: r.nextOccurrence ? new Date(r.nextOccurrence).toISOString() : '',
            accountId: r.accountId || undefined,
          }));
        setUpcomingBills(bills);
      } catch {
        // Non-critical
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Unknown';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getAccountName = (accountId: string): string => {
    const account = stats.accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const handleAccountClick = (accountId: string) => {
    onNavigate('transactions', accountId);
  };

  // Widget renderers
  const renderBalanceSummary = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-title">Total Balance</div>
      <div data-testid="total-balance" className="card-value" style={{ color: stats.totalBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {formatCurrency(stats.totalBalance)}
      </div>
      <div data-testid="account-list" style={{ marginTop: 'var(--space-3)', fontSize: '13px' }}>
        {stats.accounts.slice(0, 4).map((account) => (
          <div
            key={account.id}
            onClick={() => handleAccountClick(account.id)}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer' }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>{account.name}</span>
            <span style={{ fontWeight: 600, color: account.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {formatCurrency(account.balance)}
            </span>
          </div>
        ))}
        {stats.accounts.length > 4 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px' }}>
            +{stats.accounts.length - 4} more accounts
          </div>
        )}
      </div>
    </div>
  );

  const renderSpending = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-title">Monthly Spending</div>
      <div data-testid="monthly-spending" className="card-value" style={{ color: 'var(--color-danger)' }}>
        {formatCurrency(stats.monthlySpending)}
      </div>
    </div>
  );

  const renderIncome = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-title">Monthly Income</div>
      <div data-testid="monthly-income" className="card-value" style={{ color: 'var(--color-success)' }}>
        {formatCurrency(stats.monthlyIncome)}
      </div>
    </div>
  );

  const renderTopCategories = () => (
    <div data-testid="top-categories" style={{ overflow: 'auto', height: '100%' }}>
      {stats.topCategories.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No spending data yet"
          description="Import transactions to see your spending breakdown by category."
          action={{ label: 'Go to Import', onClick: () => onNavigate('import') }}
        />
      ) : (
        stats.topCategories.map((item, index) => (
          <div
            key={item.category.id}
            style={{
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
              backgroundColor: 'var(--color-bg)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{item.category.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.category.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>#{index + 1}</div>
              </div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
              {formatCurrency(item.amount)}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderRecentTransactions = () => (
    <div data-testid="recent-transactions" style={{ overflow: 'auto', height: '100%' }}>
      {stats.recentTransactions.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No transactions yet"
          description="Import from your bank to see recent activity here."
          action={{ label: 'Go to Import', onClick: () => onNavigate('import') }}
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentTransactions.map((txn) => (
              <tr key={txn.id}>
                <td>{formatDate(txn.date)}</td>
                <td>{txn.description}</td>
                <td>{getAccountName(txn.accountId)}</td>
                <td>{getCategoryName(txn.categoryId)}</td>
                <td
                  style={{
                    textAlign: 'right',
                    color: txn.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 700,
                  }}
                >
                  {formatCurrency(txn.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderSavingsGoals = () => (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {savingsAlerts.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No savings goals"
          description="Create savings goals to track your progress."
          action={{ label: 'Go to Savings', onClick: () => onNavigate('savings') }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {savingsAlerts.map((alert, idx) => {
            const bgColor = alert.severity === 'success' ? 'var(--color-success-bg, rgba(34,197,94,0.1))'
              : alert.severity === 'warning' ? 'var(--color-warning-bg)'
              : 'var(--color-surface-alt, var(--color-bg))';
            const borderColor = alert.severity === 'success' ? 'var(--color-success)'
              : alert.severity === 'warning' ? 'var(--color-warning)'
              : alert.color || 'var(--color-primary)';
            return (
              <div
                key={idx}
                onClick={() => onNavigate('savings')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: `conic-gradient(${alert.color || borderColor} ${alert.progress * 3.6}deg, var(--color-surface-alt, var(--color-bg)) 0deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 700,
                  }}>
                    {Math.round(alert.progress)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: alert.color || 'var(--color-text)' }}>
                    {alert.goalName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {alert.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderNetWorth = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-title">Net Worth</div>
      {netWorthData ? (
        <>
          <div className="card-value" style={{ color: netWorthData.current >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(netWorthData.current)}
          </div>
          <div style={{ fontSize: '13px', marginTop: 'var(--space-2)', color: netWorthData.change >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {netWorthData.change >= 0 ? '+' : ''}{formatCurrency(netWorthData.change)} (30d)
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          No net worth data available
        </div>
      )}
    </div>
  );

  const renderBudgetProgress = () => (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="card-title">Budget Progress</div>
      {budgetProgressData ? (
        <>
          <div className="card-value" style={{ color: 'var(--color-text)' }}>
            {Math.round((budgetProgressData.onTrack / budgetProgressData.total) * 100)}%
          </div>
          <div style={{ fontSize: '13px', marginTop: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
            {budgetProgressData.onTrack} of {budgetProgressData.total} categories on track
          </div>
          <div style={{
            marginTop: 'var(--space-3)',
            height: '8px',
            backgroundColor: 'var(--color-bg)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(budgetProgressData.onTrack / budgetProgressData.total) * 100}%`,
              height: '100%',
              backgroundColor: budgetProgressData.onTrack / budgetProgressData.total >= 0.7 ? 'var(--color-success)' : 'var(--color-warning)',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </>
      ) : (
        <EmptyState
          icon="📋"
          title="No budgets set"
          description="Set budget goals to track your progress."
          action={{ label: 'Set Budgets', onClick: () => onNavigate('budgets') }}
        />
      )}
    </div>
  );

  const renderUpcomingBills = () => (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {upcomingBills.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No upcoming bills"
          description="Add recurring items to see upcoming bills here."
          action={{ label: 'Go to Recurring', onClick: () => onNavigate('recurring') }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {upcomingBills.map((bill, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>{bill.name}</div>
                {bill.dueDate && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Due {formatDate(bill.dueDate)}
                  </div>
                )}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: '13px' }}>
                {formatCurrency(bill.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const widgetRenderers: Record<WidgetId, () => JSX.Element> = useMemo(() => ({
    'balance-summary': renderBalanceSummary,
    'spending': renderSpending,
    'income': renderIncome,
    'top-categories': renderTopCategories,
    'recent-transactions': renderRecentTransactions,
    'savings-goals': renderSavingsGoals,
    'net-worth': renderNetWorth,
    'budget-progress': renderBudgetProgress,
    'upcoming-bills': renderUpcomingBills,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stats, categories, savingsAlerts, netWorthData, budgetProgressData, upcomingBills]);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading dashboard...</div>;
  }

  const visibleWidgetArray = Array.from(visibleWidgets);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1>Dashboard</h1>
        <button
          className="btn btn-secondary dashboard-customize-btn"
          onClick={() => setShowCustomize(!showCustomize)}
        >
          Customize
        </button>
      </div>

      {/* Customize Modal */}
      {showCustomize && (
        <div className="modal-overlay" onClick={() => setShowCustomize(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customize Dashboard</h3>
              <button className="modal-close" onClick={() => setShowCustomize(false)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ALL_WIDGETS.map((widget) => (
                <label
                  key={widget.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={visibleWidgets.has(widget.id)}
                    onChange={() => toggleWidget(widget.id)}
                  />
                  <span style={{ color: 'var(--color-text)' }}>{widget.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Uncategorized Transactions Banner */}
      {uncategorizedCount > 0 && (
        <div className="review-queue-banner">
          <span>{uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''} need{uncategorizedCount === 1 ? 's' : ''} review</span>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('review-queue')}>
            Review Now
          </button>
        </div>
      )}

      {/* Balance Alerts — always shown outside grid */}
      {balanceWarnings.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {balanceWarnings.map((warning, idx) => {
            const isNegative = warning.type === 'negative_balance';
            return (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isNegative ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                  border: `1px solid ${isNegative ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: isNegative ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {warning.accountName}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {warning.message}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: isNegative ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {formatCurrency(warning.balance)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {formatDate(warning.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions — always shown outside grid */}
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => onNavigate('import')}
          className="btn btn-primary"
        >
          Import Transactions
        </button>
      </div>

      {/* Widget Grid */}
      {layoutLoaded && (
        <ResponsiveGridLayout
          className="dashboard-grid"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          draggableHandle=".dashboard-widget-header"
          onLayoutChange={handleLayoutChange}
          compactType="vertical"
          isResizable={true}
          isDraggable={true}
        >
          {visibleWidgetArray.map((widgetId) => {
            const def = ALL_WIDGETS.find((w) => w.id === widgetId);
            if (!def) return null;
            const renderer = widgetRenderers[widgetId];
            if (!renderer) return null;
            return (
              <div key={widgetId} className="dashboard-widget">
                <div className="dashboard-widget-header">
                  <span>{def.title}</span>
                  <button
                    className="dashboard-widget-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWidget(widgetId);
                    }}
                    title="Remove widget"
                  >
                    &times;
                  </button>
                </div>
                <div className="dashboard-widget-body">
                  {renderer()}
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
