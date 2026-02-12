import React from 'react';

interface ImportPreviewRow {
  ticker: string;
  shares: number;
  costBasis: number;
  costPerShare: number;
  status: 'new' | 'duplicate' | 'error';
  errorMessage?: string;
  existingHoldingId?: string;
  selected: boolean;
  rawRow: Record<string, string>;
}

interface ImportPreviewProps {
  rows: ImportPreviewRow[];
  onRowSelectionChange: (index: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  stats: {
    total: number;
    new: number;
    duplicates: number;
    errors: number;
  };
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({
  rows,
  onRowSelectionChange,
  onSelectAll,
  stats,
}) => {
  // Utility functions
  const formatShares = (sharesInt: number): string => {
    return (sharesInt / 10000).toFixed(4);
  };

  const formatCurrency = (cents: number): string => {
    return '$' + (cents / 100).toFixed(2);
  };

  const getStatusBadge = (status: 'new' | 'duplicate' | 'error', errorMessage?: string) => {
    const badges = {
      new: { className: 'badge-new', label: 'New' },
      duplicate: { className: 'badge-duplicate', label: 'Duplicate' },
      error: { className: 'badge-error', label: errorMessage || 'Error' },
    };
    const badge = badges[status];
    return <span className={`status-badge ${badge.className}`}>{badge.label}</span>;
  };

  const allSelected = rows.every(r => r.selected || r.status === 'error');
  const noneSelected = rows.every(r => !r.selected);

  return (
    <div className="import-preview">
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
              <th className="col-ticker">Ticker</th>
              <th className="col-shares">Shares</th>
              <th className="col-cost">Cost/Share</th>
              <th className="col-total">Total Cost</th>
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
                    aria-label={`Select ${row.ticker}`}
                  />
                </td>
                <td className="col-status">
                  {getStatusBadge(row.status, row.errorMessage)}
                </td>
                <td className="col-ticker">{row.ticker}</td>
                <td className="col-shares">{formatShares(row.shares)}</td>
                <td className="col-cost">{formatCurrency(row.costPerShare)}</td>
                <td className="col-total">{formatCurrency(row.costBasis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .import-preview {
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
          border-radius: 4px;
          color: var(--color-text);
        }

        .stat {
          font-size: 0.875rem;
          color: var(--color-text);
        }

        .stat-new strong { color: var(--color-success); }
        .stat-duplicate strong { color: var(--color-warning); }
        .stat-error strong { color: var(--color-danger); }

        .preview-table-container {
          flex: 1;
          overflow: auto;
          border: 1px solid var(--color-border);
          border-radius: 4px;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
          color: var(--color-text);
        }

        .preview-table th,
        .preview-table td {
          padding: 0.5rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--color-border);
        }

        .preview-table th {
          background: var(--color-bg);
          color: var(--color-text);
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
        .col-ticker { width: 100px; font-weight: 600; }
        .col-shares { width: 100px; text-align: right; }
        .col-cost { width: 100px; text-align: right; }
        .col-total { width: 120px; text-align: right; }

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
      `}</style>
    </div>
  );
};
