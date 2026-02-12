import { useState, useEffect } from 'react';
import { InvestmentTransaction, Investment, InvestmentTransactionType } from '../../shared/types';

interface TransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  holding: Investment | null;
  onEditTransaction: (tx: InvestmentTransaction) => void;
}

const transactionTypeLabels: Record<InvestmentTransactionType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  stock_split: 'Split',
  drip: 'DRIP',
};

const transactionTypeColors: Record<InvestmentTransactionType, string> = {
  buy: '#4CAF50',
  sell: '#F44336',
  dividend: '#2196F3',
  stock_split: '#9C27B0',
  drip: '#00BCD4',
};

type ViewMode = 'chronological' | 'grouped';
type TypeFilter = InvestmentTransactionType | 'all';

export function TransactionHistory({
  isOpen,
  onClose,
  holding,
  onEditTransaction,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chronological');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && holding) {
      loadTransactions();
    }
  }, [isOpen, holding]);

  const loadTransactions = async () => {
    if (!holding) return;
    setIsLoading(true);
    try {
      const data = await window.api.investmentTransactions.getByHolding(holding.id);
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction? This will reverse its effects on share counts and cost basis.')) {
      try {
        await window.api.investmentTransactions.delete(id);
        loadTransactions();
      } catch (error) {
        console.error('Failed to delete transaction:', error);
      }
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (dateRange.start && new Date(tx.date) < new Date(dateRange.start)) return false;
    if (dateRange.end && new Date(tx.date) > new Date(dateRange.end)) return false;
    return true;
  });

  const sortedTransactions = [...filteredTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Group transactions by type for grouped view
  const groupedTransactions = sortedTransactions.reduce((acc, tx) => {
    if (!acc[tx.type]) acc[tx.type] = [];
    acc[tx.type].push(tx);
    return acc;
  }, {} as Record<InvestmentTransactionType, InvestmentTransaction[]>);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    const dollars = amount / 100;
    return dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const formatShares = (shares: number) => {
    const actual = shares / 10000;
    return actual.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };

  const renderTransaction = (tx: InvestmentTransaction) => (
    <div key={tx.id} className="transaction-row">
      <div className="tx-date">{formatDate(tx.date)}</div>
      <div className="tx-type">
        <span
          className="type-badge"
          style={{ backgroundColor: transactionTypeColors[tx.type] }}
        >
          {transactionTypeLabels[tx.type]}
        </span>
      </div>
      <div className="tx-details">
        {tx.type === 'stock_split' ? (
          <span>Split ratio: {tx.splitRatio}</span>
        ) : tx.type === 'dividend' ? (
          <span>{formatAmount(tx.totalAmount)}</span>
        ) : (
          <span>
            {formatShares(Math.abs(tx.shares))} shares @ {formatAmount(tx.pricePerShare)}
            {tx.fees > 0 && <span className="tx-fees"> + {formatAmount(tx.fees)} fees</span>}
          </span>
        )}
      </div>
      <div className="tx-total">
        {tx.type !== 'stock_split' && (
          <span className={tx.type === 'sell' ? 'positive' : tx.type === 'buy' ? 'negative' : ''}>
            {tx.type === 'sell' ? '+' : tx.type === 'buy' ? '-' : ''}
            {formatAmount(Math.abs(tx.totalAmount))}
          </span>
        )}
      </div>
      <div className="tx-actions">
        <button
          className="edit-btn"
          onClick={() => onEditTransaction(tx)}
          title="Edit transaction"
        >
          Edit
        </button>
        <button
          className="delete-btn"
          onClick={() => handleDelete(tx.id)}
          title="Delete transaction"
        >
          Delete
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content transaction-history-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Transaction History</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {holding && (
          <div className="modal-holding-info">
            <span className="ticker">{holding.ticker || holding.name}</span>
            <span className="name">{holding.name}</span>
          </div>
        )}

        <div className="history-controls">
          <div className="view-toggle">
            <button
              className={viewMode === 'chronological' ? 'active' : ''}
              onClick={() => setViewMode('chronological')}
            >
              Chronological
            </button>
            <button
              className={viewMode === 'grouped' ? 'active' : ''}
              onClick={() => setViewMode('grouped')}
            >
              By Type
            </button>
          </div>

          <div className="filters">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">All Types</option>
              {Object.entries(transactionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <input
              type="date"
              placeholder="Start date"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <input
              type="date"
              placeholder="End date"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>

        <div className="transaction-list">
          {isLoading ? (
            <div className="loading">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state">No transactions found</div>
          ) : viewMode === 'chronological' ? (
            sortedTransactions.map(renderTransaction)
          ) : (
            Object.entries(groupedTransactions).map(([type, txs]) => (
              <div key={type} className="transaction-group">
                <h4 className="group-header">
                  <span
                    className="type-badge"
                    style={{ backgroundColor: transactionTypeColors[type as InvestmentTransactionType] }}
                  >
                    {transactionTypeLabels[type as InvestmentTransactionType]}
                  </span>
                  <span className="count">({txs.length})</span>
                </h4>
                {txs.map(renderTransaction)}
              </div>
            ))
          )}
        </div>

        <div className="history-summary">
          <span>Total transactions: {filteredTransactions.length}</span>
        </div>
      </div>
    </div>
  );
}
