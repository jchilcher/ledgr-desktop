import React, { useState, useEffect, useMemo } from 'react';
import { InvestmentAccount, InvestmentAccountType, Holding } from '../../shared/types';
import { HoldingsTable } from './HoldingsTable';
import { usePrices } from '../hooks/usePrices';

interface InvestmentAccountsProps {
  onSelectAccount: (accountId: string) => void;
}

const accountTypeLabels: Record<InvestmentAccountType, string> = {
  taxable: 'Taxable Brokerage',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  '401k': '401(k)',
  hsa: 'HSA',
};

export function InvestmentAccounts({ onSelectAccount: _onSelectAccount }: InvestmentAccountsProps) {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [holdings, setHoldings] = useState<Map<string, Holding[]>>(new Map());
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    accountType: 'taxable' as InvestmentAccountType,
  });
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    account: InvestmentAccount | null;
  }>({ show: false, account: null });
  const [loading, setLoading] = useState(false);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [deletedAccount, setDeletedAccount] = useState<{
    account: InvestmentAccount;
    holdings: Holding[];
  } | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const allAccounts = await window.api.investmentAccounts.getAll();
      setAccounts(allAccounts);

      // Load holdings for each account
      const holdingsMap = new Map<string, Holding[]>();
      for (const account of allAccounts) {
        const accountHoldings = await window.api.holdings.getByAccount(account.id);
        holdingsMap.set(account.id, accountHoldings);
      }
      setHoldings(holdingsMap);
    } catch (err) {
      setError(`Error loading accounts: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Collect unique tickers across all accounts for live price fetching
  const allTickers = useMemo(() => {
    const tickers = new Set<string>();
    for (const accountHoldings of holdings.values()) {
      for (const h of accountHoldings) {
        tickers.add(h.ticker);
      }
    }
    return Array.from(tickers);
  }, [holdings]);

  const { data: pricesMap } = usePrices(allTickers);

  // Get live price for a ticker, falling back to DB value
  const getPrice = (ticker: string, dbPrice: number): number => {
    if (!pricesMap) return dbPrice;
    return pricesMap[ticker.toUpperCase()]?.price ?? dbPrice;
  };

  const calculateAccountValue = (accountHoldings: Holding[]): number => {
    return accountHoldings.reduce((sum, holding) => {
      const price = getPrice(holding.ticker, holding.currentPrice);
      return sum + (holding.sharesOwned * price) / 10000;
    }, 0);
  };

  const calculateAccountGainLoss = (accountHoldings: Holding[]): number => {
    return accountHoldings.reduce((sum, holding) => {
      const costBasis = (holding.sharesOwned * holding.avgCostPerShare) / 10000;
      const price = getPrice(holding.ticker, holding.currentPrice);
      const currentValue = (holding.sharesOwned * price) / 10000;
      return sum + (currentValue - costBasis);
    }, 0);
  };

  const formatCurrency = (cents: number): string => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  };

  const formatGainLoss = (cents: number, costBasis: number): string => {
    const dollars = cents / 100;
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: 'always',
    }).format(dollars);

    if (costBasis === 0) {
      return `${formatted} (—)`;
    }

    const percentage = (cents / costBasis) * 100;
    return `${formatted} (${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Account name is required');
      return;
    }

    if (!formData.institution.trim()) {
      setError('Institution is required');
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await window.api.investmentAccounts.update(editingId, {
          name: formData.name.trim(),
          institution: formData.institution.trim(),
          accountType: formData.accountType,
        });
      } else {
        await window.api.investmentAccounts.create({
          name: formData.name.trim(),
          institution: formData.institution.trim(),
          accountType: formData.accountType,
        });
      }
      setFormData({ name: '', institution: '', accountType: 'taxable' });
      setShowForm(false);
      setEditingId(null);
      await loadAccounts();
    } catch (err) {
      setError(`Error saving account: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: InvestmentAccount) => {
    setFormData({
      name: account.name,
      institution: account.institution,
      accountType: account.accountType,
    });
    setEditingId(account.id);
    setShowForm(true);
    setError('');
  };

  const handleCancelForm = () => {
    setFormData({ name: '', institution: '', accountType: 'taxable' });
    setShowForm(false);
    setEditingId(null);
    setError('');
  };

  const handleDeleteClick = (account: InvestmentAccount) => {
    setDeleteConfirm({ show: true, account });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.account) return;

    const account = deleteConfirm.account;
    const accountHoldings = holdings.get(account.id) || [];

    try {
      setLoading(true);
      await window.api.investmentAccounts.delete(account.id);

      // Store for undo
      setDeletedAccount({ account, holdings: accountHoldings });

      // Set up undo timer
      const timer = setTimeout(() => {
        setDeletedAccount(null);
      }, 5000);
      setUndoTimer(timer);

      setDeleteConfirm({ show: false, account: null });
      await loadAccounts();
    } catch (err) {
      setError(`Error deleting account: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!deletedAccount) return;

    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }

    try {
      setLoading(true);
      // Recreate the account
      await window.api.investmentAccounts.create({
        name: deletedAccount.account.name,
        institution: deletedAccount.account.institution,
        accountType: deletedAccount.account.accountType,
      });

      setDeletedAccount(null);
      await loadAccounts();
    } catch (err) {
      setError(`Error restoring account: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  // If account is selected, show holdings view
  if (selectedAccountId) {
    const selectedAccount = accounts.find(a => a.id === selectedAccountId);
    return (
      <HoldingsTable
        accountId={selectedAccountId}
        accountName={selectedAccount?.name}
        onBack={() => setSelectedAccountId(null)}
      />
    );
  }

  return (
    <div className="investment-accounts">
      <div className="investment-accounts-header">
        <h3>Investment Accounts</h3>
        <button
          onClick={() => setShowForm(true)}
          disabled={loading}
          className="btn btn-primary"
        >
          Add Account
        </button>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)',
        }}>
          {error}
        </div>
      )}

      {showForm && (
        <div style={{
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-4)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg)',
        }}>
          <h4 style={{ marginBottom: 'var(--space-4)' }}>
            {editingId ? 'Edit Account' : 'New Account'}
          </h4>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="Account Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
                style={{ width: '100%', padding: 'var(--space-2)' }}
              />
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="Institution *"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                disabled={loading}
                required
                style={{ width: '100%', padding: 'var(--space-2)' }}
              />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value as InvestmentAccountType })}
                disabled={loading}
                style={{ width: '100%', padding: 'var(--space-2)' }}
              >
                {Object.entries(accountTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {editingId ? 'Save Changes' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {accounts.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No Investment Accounts</div>
          <div className="empty-state-description">
            Create your first investment account to start tracking your portfolio
          </div>
        </div>
      ) : (
        <div className="account-grid">
          {accounts.map((account) => {
            const accountHoldings = holdings.get(account.id) || [];
            const totalValue = calculateAccountValue(accountHoldings);
            const gainLoss = calculateAccountGainLoss(accountHoldings);
            const costBasis = accountHoldings.reduce((sum, h) => sum + (h.sharesOwned * h.avgCostPerShare), 0);

            return (
              <div
                key={account.id}
                className="account-card"
                onClick={() => handleAccountClick(account.id)}
              >
                <div className="account-card-header">
                  <div>
                    <div className="account-card-title">{account.name}</div>
                    <div className="account-card-institution">{account.institution}</div>
                  </div>
                  <div className="account-type-badge">
                    {accountTypeLabels[account.accountType]}
                  </div>
                </div>

                <div className="account-card-stats">
                  <div className="account-stat">
                    <div className="account-stat-label">Total Value</div>
                    <div className="account-stat-value">
                      {formatCurrency(totalValue)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {accountHoldings.length} holding{accountHoldings.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="account-stat">
                    <div className="account-stat-label">Gain/Loss</div>
                    <div className={`account-stat-value ${gainLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatGainLoss(gainLoss, costBasis)}
                    </div>
                  </div>
                </div>

                <div className="account-card-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(account);
                    }}
                    disabled={loading}
                    className="btn btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(account);
                    }}
                    disabled={loading}
                    className="btn btn-outline-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.account && (
        <div
          className="delete-modal-overlay"
          onClick={() => setDeleteConfirm({ show: false, account: null })}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠ Delete Account?</h3>
            <p>
              Are you sure you want to delete <strong>{deleteConfirm.account.name}</strong>?
            </p>
            <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
              This will remove {holdings.get(deleteConfirm.account.id)?.length || 0} holding(s) from this account.
            </p>
            <div className="delete-modal-actions">
              <button
                onClick={() => setDeleteConfirm({ show: false, account: null })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                disabled={loading}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {deletedAccount && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--space-6)',
          right: 'var(--space-6)',
          zIndex: 1100,
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
        }}>
          <span>Account deleted</span>
          <button onClick={handleUndo} className="btn btn-primary" style={{ padding: '4px 12px' }}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
