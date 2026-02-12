import { useState, useEffect } from 'react';
import { Account } from '../../shared/types';

interface ExportModalProps {
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export default function ExportModal({ onClose, onSuccess }: ExportModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<'transactions' | 'all'>('transactions');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [accountId, setAccountId] = useState<string>('');
  const [includeTags, setIncludeTags] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const allAccounts = await window.api.accounts.getAll();
      setAccounts(allAccounts);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const handleExport = async () => {
    setError('');
    setLoading(true);

    try {
      let result;

      if (exportType === 'all') {
        result = await window.api.export.allData();
      } else {
        result = await window.api.export.transactions({
          format,
          includeCategories: true,
          includeTags,
          accountId: accountId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
      }

      if (result.success) {
        onSuccess?.(`Exported ${result.recordCount} records to ${result.filePath}`);
        onClose();
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          maxWidth: '500px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Export Data</h3>

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '16px', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Export Type</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'transactions'}
                onChange={() => setExportType('transactions')}
              />
              Transactions
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'all'}
                onChange={() => setExportType('all')}
              />
              Full Backup (JSON)
            </label>
          </div>
        </div>

        {exportType === 'transactions' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Format</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'csv'}
                    onChange={() => setFormat('csv')}
                  />
                  CSV (Spreadsheet)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'json'}
                    onChange={() => setFormat('json')}
                  />
                  JSON (Detailed)
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Account (Optional)</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.institution}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeTags}
                  onChange={(e) => setIncludeTags(e.target.checked)}
                />
                Include Tags
              </label>
            </div>
          </>
        )}

        {exportType === 'all' && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-muted)' }}>
              Full backup exports all data including accounts, transactions, categories, tags, rules, budgets, and more.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleExport} className="btn btn-primary" disabled={loading}>
            {loading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
