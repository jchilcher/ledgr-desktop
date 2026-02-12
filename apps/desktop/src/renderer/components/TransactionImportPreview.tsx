import React from 'react';

interface TransactionImportPreviewRow {
  date: Date;
  description: string;
  amount: number;
  category?: string | null;
  balance?: number | null;
  status: 'new' | 'duplicate' | 'error';
  errorMessage?: string;
  existingTransactionId?: string;
  selected: boolean;
  rawRow: Record<string, string>;
}

interface TransactionImportPreviewProps {
  rows: TransactionImportPreviewRow[];
  onRowSelectionChange: (index: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  stats: {
    total: number;
    new: number;
    duplicates: number;
    errors: number;
  };
}

export const TransactionImportPreview: React.FC<TransactionImportPreviewProps> = ({
  rows,
  onRowSelectionChange,
  onSelectAll,
  stats,
}) => {
  // Format date for display
  const formatDate = (date: Date): string => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format amount (already in dollars)
  const formatAmount = (dollars: number): string => {
    const sign = dollars >= 0 ? '+' : '';
    return sign + dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  // Get status badge
  const getStatusBadge = (status: 'new' | 'duplicate' | 'error', errorMessage?: string) => {
    const badges = {
      new: { className: 'badge-new', label: 'New' },
      duplicate: { className: 'badge-duplicate', label: 'Duplicate' },
      error: { className: 'badge-error', label: errorMessage || 'Error' },
    };
    const badge = badges[status];
    return <span className={`status-badge ${badge.className}`}>{badge.label}</span>;
  };

  // Calculate selection state
  const selectableRows = rows.filter(r => r.status !== 'error');
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => r.selected);
  const noneSelected = selectableRows.every(r => !r.selected);

  return (
    <div className="transaction-import-preview">
      <div className="preview-stats">
        <span className="stat">
          <strong>{stats.total}</strong> total
        </span>
        <span className="stat stat-new">
          <strong>{stats.new}</strong> new
        </span>
        <span className="stat stat-duplicate">
          <strong>{stats.duplicates}</strong> duplicates
        </span>
        {stats.errors > 0 && (
          <span className="stat stat-error">
            <strong>{stats.errors}</strong> errors
          </span>
        )}
      </div>

      <div className="preview-table-container">
        <table className="preview-table">
          <thead>
            <tr>
              <th className="col-select">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = !allSelected && !noneSelected;
                    }
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
              <th className="col-status">Status</th>
              <th className="col-date">Date</th>
              <th className="col-description">Description</th>
              <th className="col-amount">Amount</th>
              {rows.some(r => r.category) && (
                <th className="col-category">Category</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className={`preview-row status-${row.status} ${row.selected ? 'selected' : ''}`}
              >
                <td className="col-select">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={row.status === 'error'}
                    onChange={(e) => onRowSelectionChange(index, e.target.checked)}
                    aria-label={`Select transaction ${row.description}`}
                  />
                </td>
                <td className="col-status">
                  {getStatusBadge(row.status, row.errorMessage)}
                </td>
                <td className="col-date">{formatDate(row.date)}</td>
                <td className="col-description" title={row.description}>
                  {row.description}
                </td>
                <td className={`col-amount ${row.amount >= 0 ? 'positive' : 'negative'}`}>
                  {formatAmount(row.amount)}
                </td>
                {rows.some(r => r.category) && (
                  <td className="col-category">{row.category || '-'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .transaction-import-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 100%;
        }

        .preview-stats {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem 1rem;
          background: var(--color-bg);
          border-radius: var(--radius-sm);
          color: var(--color-text);
        }

        .stat {
          font-size: 0.875rem;
        }

        .stat-new strong { color: var(--color-success); }
        .stat-duplicate strong { color: var(--color-warning); }
        .stat-error strong { color: var(--color-danger); }

        .preview-table-container {
          flex: 1;
          overflow: auto;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          max-height: 400px;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          background: var(--color-surface);
        }

        .preview-table th,
        .preview-table td {
          padding: 0.5rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
        }

        .preview-table th {
          background: var(--color-bg);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .preview-table tbody tr:hover {
          background: var(--color-bg);
        }

        .col-select { width: 40px; text-align: center; }
        .col-status { width: 100px; }
        .col-date { width: 100px; white-space: nowrap; }
        .col-description {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .col-amount { width: 110px; text-align: right; font-family: monospace; }
        .col-category { width: 120px; }

        .col-amount.positive { color: var(--color-success); }
        .col-amount.negative { color: var(--color-danger); }

        .status-badge {
          display: inline-block;
          padding: 0.125rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .badge-new {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .badge-duplicate {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .badge-error {
          background: var(--color-danger-bg);
          color: var(--color-danger);
        }

        .preview-row.status-error {
          opacity: 0.6;
        }

        .preview-row.status-duplicate:not(.selected) {
          opacity: 0.7;
        }

        .preview-row.selected {
          background: var(--color-primary-light);
        }

        @media (max-width: 768px) {
          .preview-stats {
            flex-wrap: wrap;
            gap: 1rem;
          }

          .col-description {
            max-width: 150px;
          }
        }
      `}</style>
    </div>
  );
};
