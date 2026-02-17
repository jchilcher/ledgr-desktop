import { useState, useEffect } from 'react';
import { Transaction, Account } from '../../shared/types';

interface Props {
  onSelect: (transactionId: string) => void;
  onClose: () => void;
  defaultSearch?: string;
}

export default function TransactionPickerModal({ onSelect, onClose, defaultSearch }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState(defaultSearch || '');
  const [accountFilter, setAccountFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [search, accountFilter]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [allTx, allAccounts] = await Promise.all([
        window.api.transactions.getAll(),
        window.api.accounts.getAll(),
      ]);
      setAccounts(allAccounts);

      let filtered = allTx;
      if (search) {
        const lower = search.toLowerCase();
        filtered = filtered.filter(t => t.description.toLowerCase().includes(lower));
      }
      if (accountFilter) {
        filtered = filtered.filter(t => t.accountId === accountFilter);
      }
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(filtered.slice(0, 100));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const formatDate = (d: Date | string) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || '';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        padding: '24px', width: '700px', maxHeight: '80vh', display: 'flex',
        flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Select Transaction</h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 12px' }}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search description..."
            style={{ flex: 1 }}
            autoFocus
          />
          <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} style={{ width: '200px' }}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading...</p>
          ) : transactions.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No transactions found</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>Account</th>
                  <th style={{ padding: '8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px', fontSize: '13px' }}>{formatDate(tx.date)}</td>
                    <td style={{ padding: '8px', fontSize: '13px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</td>
                    <td style={{ padding: '8px', fontSize: '13px', textAlign: 'right', fontWeight: 500, color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{getAccountName(tx.accountId)}</td>
                    <td style={{ padding: '8px' }}>
                      <button onClick={() => onSelect(tx.id)} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                        Select
                      </button>
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
