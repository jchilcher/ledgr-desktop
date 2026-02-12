import { useEffect, useState } from 'react';
import { Account, Transaction, Category, TransactionSplit, SavingsGoalAlert } from '../../shared/types';
import EmptyState from './EmptyState';

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

export default function Dashboard({ onNavigate }: DashboardProps) {
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [accountsData, transactionsData, categoriesData, reimbursementLinks] = await Promise.all([
        window.api.accounts.getAll(),
        window.api.transactions.getAll(),
        window.api.categories.getAll(),
        window.api.reimbursements.getAll().catch(() => []),
      ]);

      setCategories(categoriesData);

      // Build reimbursement lookup
      const expenseReimbursements = new Map<string, number>();
      const reimbursementIncomeIds = new Set<string>();
      for (const link of reimbursementLinks) {
        expenseReimbursements.set(link.expenseTransactionId, (expenseReimbursements.get(link.expenseTransactionId) || 0) + link.amount);
        reimbursementIncomeIds.add(link.reimbursementTransactionId);
      }

      // Calculate total balance
      const totalBalance = accountsData.reduce((sum, acc) => sum + acc.balance, 0);

      // Get current month's date range
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Filter transactions for current month
      const monthlyTransactions = transactionsData.filter((txn) => {
        const txnDate = new Date(txn.date);
        return txnDate >= firstDayOfMonth && txnDate <= lastDayOfMonth;
      });

      // Exclude transfers from financial calculations
      const analyticsTransactions = monthlyTransactions.filter(
        (txn) => !txn.isInternalTransfer
      );

      // Calculate monthly spending (negative amounts) — net out reimbursements
      const monthlySpending = analyticsTransactions
        .filter((txn) => txn.amount < 0)
        .reduce((sum, txn) => {
          const reimbursed = expenseReimbursements.get(txn.id) || 0;
          return sum + Math.abs(txn.amount) - reimbursed;
        }, 0);

      // Calculate monthly income (positive amounts) — exclude reimbursement income
      const monthlyIncome = analyticsTransactions
        .filter((txn) => txn.amount > 0 && !reimbursementIncomeIds.has(txn.id))
        .reduce((sum, txn) => sum + txn.amount, 0);

      // Get recent transactions (last 10) — includes transfers
      const recentTransactions = transactionsData
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      // Calculate top spending categories (current month, expenses only) — net out reimbursements
      // Fetch splits for expense transactions to distribute across split categories
      const expenseTransactions = analyticsTransactions.filter((txn) => txn.amount < 0 && txn.categoryId);
      const expenseIds = expenseTransactions.map(txn => txn.id);
      const splitsByParent = new Map<string, TransactionSplit[]>();
      if (expenseIds.length > 0) {
        try {
          const allSplits = await window.api.splits.getByTransactionIds(expenseIds);
          for (const split of allSplits) {
            const existing = splitsByParent.get(split.parentTransactionId) || [];
            existing.push(split);
            splitsByParent.set(split.parentTransactionId, existing);
          }
        } catch { /* splits not available, fall through to default behavior */ }
      }

      const categorySpending = new Map<string, number>();
      expenseTransactions.forEach((txn) => {
          const reimbursed = expenseReimbursements.get(txn.id) || 0;
          const netAmount = Math.abs(txn.amount) - reimbursed;
          if (netAmount <= 0) return;

          const txSplits = splitsByParent.get(txn.id);
          if (txSplits && txSplits.length > 0) {
            // Distribute amount across split categories
            for (const split of txSplits) {
              const splitCategoryId = split.categoryId || txn.categoryId!;
              const splitAmount = Math.abs(split.amount);
              const current = categorySpending.get(splitCategoryId) || 0;
              categorySpending.set(splitCategoryId, current + splitAmount);
            }
          } else {
            // No splits — use parent category
            const categoryId = txn.categoryId!;
            const current = categorySpending.get(categoryId) || 0;
            categorySpending.set(categoryId, current + netAmount);
          }
        });

      const topCategories = Array.from(categorySpending.entries())
        .map(([categoryId, amount]) => ({
          category: categoriesData.find((c) => c.id === categoryId)!,
          amount,
        }))
        .filter((item) => item.category) // Filter out any undefined categories
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setStats({
        totalBalance,
        monthlySpending,
        monthlyIncome,
        recentTransactions,
        accounts: accountsData,
        topCategories,
      });

      // Fetch 30-day forecast warnings for each account
      try {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const forecastResults = await Promise.all(
          accountsData.map((account) =>
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

        // Sort by date, then severity (negative before low)
        warnings.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'negative_balance' ? -1 : 1;
          return a.date.getTime() - b.date.getTime();
        });

        setBalanceWarnings(warnings);
      } catch {
        // Forecast warnings are non-critical; silently ignore failures
      }

      // Fetch savings goal alerts
      try {
        const alerts = await window.api.savingsGoals.getAlerts();
        setSavingsAlerts(alerts);
      } catch {
        // Savings alerts are non-critical
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

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>

      {/* Summary Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '30px' }}>
        <div className="card">
          <div className="card-title">Total Balance</div>
          <div data-testid="total-balance" className="card-value" style={{ color: stats.totalBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(stats.totalBalance)}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Monthly Spending</div>
          <div data-testid="monthly-spending" className="card-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency(stats.monthlySpending)}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Monthly Income</div>
          <div data-testid="monthly-income" className="card-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(stats.monthlyIncome)}
          </div>
        </div>
      </div>

      {/* Balance Alerts */}
      {balanceWarnings.length > 0 && (
        <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

      {/* Savings Goal Alerts */}
      {savingsAlerts.length > 0 && (
        <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Savings Goals</h3>
          {savingsAlerts.map((alert, idx) => {
            const bgColor = alert.severity === 'success' ? 'var(--color-success-bg, rgba(34,197,94,0.1))'
              : alert.severity === 'warning' ? 'var(--color-warning-bg)'
              : 'var(--color-surface-alt)';
            const borderColor = alert.severity === 'success' ? 'var(--color-success)'
              : alert.severity === 'warning' ? 'var(--color-warning)'
              : alert.color || 'var(--color-primary)';
            return (
              <div
                key={idx}
                onClick={() => onNavigate('savings')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Circular progress indicator */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: `conic-gradient(${alert.color || borderColor} ${alert.progress * 3.6}deg, var(--color-surface-alt) 0deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}>
                      {Math.round(alert.progress)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: alert.color || 'var(--color-text)' }}>
                      {alert.goalName}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {alert.message}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => onNavigate('import')}
          className="btn btn-primary"
        >
          Import Transactions
        </button>
      </div>

      <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Accounts List */}
        <div className="card">
          <h2>Account Balances</h2>
          <div data-testid="account-list">
            {stats.accounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                title="No accounts yet"
                description="Add your first account to start tracking your finances."
                action={{ label: 'Add Account', onClick: () => onNavigate('settings') }}
              />
            ) : (
              stats.accounts.map((account) => (
                <div
                  key={account.id}
                  data-testid="account-list-item"
                  onClick={() => handleAccountClick(account.id)}
                  className="card card-clickable"
                  style={{
                    padding: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{account.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{account.type}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: account.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(account.balance)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Spending Categories */}
        <div className="card">
          <h2>Top Spending Categories</h2>
          <div data-testid="top-categories">
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
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: '30px' }}>
        <h2>Recent Transactions</h2>
        <div data-testid="recent-transactions" style={{ overflow: 'hidden' }}>
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
      </div>
    </div>
  );
}
