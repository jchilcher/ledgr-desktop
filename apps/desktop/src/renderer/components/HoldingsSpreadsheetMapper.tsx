import React, { useState, useCallback, useMemo, useEffect } from 'react';

type CostBasisType = 'total' | 'per_share';

interface ColumnMapping {
  ticker: string | null;
  shares: string | null;
  costBasis: string | null;
  costBasisType: CostBasisType;
  headerRow?: number;
}

interface CSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: ColumnMapping | null;
}

type ColumnRole = 'skip' | 'ticker' | 'shares' | 'costBasis';

const ROLE_OPTIONS: { value: ColumnRole; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'ticker', label: 'Ticker *' },
  { value: 'shares', label: 'Shares *' },
  { value: 'costBasis', label: 'Cost Basis' },
];

const ROLE_COLORS: Record<ColumnRole, string> = {
  skip: 'transparent',
  ticker: 'var(--spreadsheet-date, rgba(59, 130, 246, 0.08))',
  shares: 'var(--spreadsheet-desc, rgba(139, 92, 246, 0.08))',
  costBasis: 'var(--spreadsheet-amount, rgba(34, 197, 94, 0.08))',
};

interface HoldingsSpreadsheetMapperProps {
  rawData: CSVRawData;
  fileName: string;
  detectedFormat: string | null;
  initialMapping: ColumnMapping | null;
  onApply: (mapping: ColumnMapping) => void;
  onBack: () => void;
  loading?: boolean;
}

export const HoldingsSpreadsheetMapper: React.FC<HoldingsSpreadsheetMapperProps> = ({
  rawData,
  fileName,
  detectedFormat,
  initialMapping,
  onApply,
  onBack,
  loading = false,
}) => {
  const [headerRow, setHeaderRow] = useState<number>(rawData.detectedHeaderRow);
  const [costBasisType, setCostBasisType] = useState<CostBasisType>(
    initialMapping?.costBasisType ?? 'total'
  );
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);

  const maxCols = useMemo(() => {
    let max = 0;
    for (const row of rawData.rawRows) {
      if (row.length > max) max = row.length;
    }
    return max;
  }, [rawData.rawRows]);

  const buildRolesFromMapping = useCallback((mapping: ColumnMapping | null, hRow: number) => {
    const roles: ColumnRole[] = new Array(maxCols).fill('skip');
    if (!mapping || hRow >= rawData.rawRows.length) return roles;

    const headers = rawData.rawRows[hRow].map(h => h.replace(/"/g, '').trim());

    const assignRole = (colName: string | null, role: ColumnRole) => {
      if (!colName) return;
      const idx = headers.findIndex(h => h === colName);
      if (idx >= 0 && idx < roles.length) {
        roles[idx] = role;
      }
    };

    assignRole(mapping.ticker, 'ticker');
    assignRole(mapping.shares, 'shares');
    assignRole(mapping.costBasis, 'costBasis');

    return roles;
  }, [maxCols, rawData.rawRows]);

  useEffect(() => {
    const mapping = initialMapping ?? rawData.suggestedMapping;
    if (mapping) {
      setCostBasisType(mapping.costBasisType);
    }
    setColumnRoles(buildRolesFromMapping(mapping, headerRow));
  }, []);

  const handleHeaderRowChange = useCallback((newRow: number) => {
    setHeaderRow(newRow);
    const newHeaders = rawData.rawRows[newRow]?.map(h => h.replace(/"/g, '').trim()) ?? [];

    const roles: ColumnRole[] = new Array(maxCols).fill('skip');
    const tickerPatterns = ['symbol', 'ticker', 'stock symbol', 'fund symbol', 'security'];
    const sharesPatterns = ['shares', 'quantity', 'units', 'share count', 'qty'];
    const costPatterns = ['cost basis', 'total cost', 'cost per share', 'avg cost', 'average cost', 'cost basis total'];

    const fuzzyMatch = (header: string, patterns: string[]) => {
      const norm = header.toLowerCase().trim().replace(/[_-]/g, ' ');
      return patterns.some(p => norm === p || norm.includes(p) || p.includes(norm));
    };

    for (let i = 0; i < newHeaders.length && i < roles.length; i++) {
      const h = newHeaders[i];
      if (!h) continue;
      if (fuzzyMatch(h, tickerPatterns) && !roles.includes('ticker')) {
        roles[i] = 'ticker';
      } else if (fuzzyMatch(h, sharesPatterns) && !roles.includes('shares')) {
        roles[i] = 'shares';
      } else if (fuzzyMatch(h, costPatterns) && !roles.includes('costBasis')) {
        roles[i] = 'costBasis';
      }
    }

    setColumnRoles(roles);
  }, [rawData.rawRows, maxCols]);

  const handleRoleChange = useCallback((colIdx: number, role: ColumnRole) => {
    setColumnRoles(prev => {
      const next = [...prev];
      if (role !== 'skip') {
        for (let i = 0; i < next.length; i++) {
          if (next[i] === role) next[i] = 'skip';
        }
      }
      next[colIdx] = role;
      return next;
    });
  }, []);

  const buildMapping = useCallback((): ColumnMapping => {
    const headers = rawData.rawRows[headerRow]?.map(h => h.replace(/"/g, '').trim()) ?? [];
    const mapping: ColumnMapping = {
      ticker: null,
      shares: null,
      costBasis: null,
      costBasisType,
      headerRow,
    };

    for (let i = 0; i < columnRoles.length; i++) {
      const role = columnRoles[i];
      const colName = headers[i] ?? `Column ${i + 1}`;
      if (role === 'ticker') mapping.ticker = colName;
      else if (role === 'shares') mapping.shares = colName;
      else if (role === 'costBasis') mapping.costBasis = colName;
    }

    return mapping;
  }, [rawData.rawRows, headerRow, columnRoles, costBasisType]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!columnRoles.includes('ticker')) missing.push('Ticker');
    if (!columnRoles.includes('shares')) missing.push('Shares');
    return missing;
  }, [columnRoles]);

  const isValid = missingFields.length === 0;

  const handleApply = () => {
    if (isValid) {
      onApply(buildMapping());
    }
  };

  return (
    <div className="csv-spreadsheet-mapper">
      <div className="info-banner">
        <span className="info-file">File: <strong>{fileName}</strong></span>
        {detectedFormat && (
          <span className="info-format">Detected: <strong>{detectedFormat}</strong></span>
        )}
        <span className="info-rows">{rawData.totalRows} rows</span>
      </div>

      {columnRoles.includes('costBasis') && (
        <div className="amount-type-toggle">
          <span className="toggle-label">Cost basis represents:</span>
          <label className="radio-pill">
            <input
              type="radio"
              name="holdings-cost-type"
              checked={costBasisType === 'total'}
              onChange={() => setCostBasisType('total')}
            />
            <span>Total cost basis</span>
          </label>
          <label className="radio-pill">
            <input
              type="radio"
              name="holdings-cost-type"
              checked={costBasisType === 'per_share'}
              onChange={() => setCostBasisType('per_share')}
            />
            <span>Cost per share</span>
          </label>
        </div>
      )}

      {!isValid && (
        <div className="validation-bar">
          Assign required columns: {missingFields.join(', ')}
        </div>
      )}

      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            <tr className="assignment-row">
              <th className="row-num-header">#</th>
              {Array.from({ length: maxCols }, (_, colIdx) => (
                <th key={colIdx} style={{ background: ROLE_COLORS[columnRoles[colIdx] || 'skip'] }}>
                  <select
                    value={columnRoles[colIdx] || 'skip'}
                    onChange={(e) => handleRoleChange(colIdx, e.target.value as ColumnRole)}
                    className="role-select"
                  >
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rawData.rawRows.map((row, rowIdx) => {
              const isHeader = rowIdx === headerRow;
              const isMeta = rowIdx < headerRow;
              return (
                <tr
                  key={rowIdx}
                  className={
                    isHeader ? 'header-row' :
                    isMeta ? 'meta-row' :
                    rowIdx % 2 === 0 ? 'data-row even' : 'data-row odd'
                  }
                >
                  <td
                    className={`row-num ${isHeader ? 'row-num-active' : ''}`}
                    onClick={() => handleHeaderRowChange(rowIdx)}
                    title="Click to set as header row"
                  >
                    {rowIdx + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIdx) => (
                    <td
                      key={colIdx}
                      className="cell"
                      style={{ background: ROLE_COLORS[columnRoles[colIdx] || 'skip'] }}
                    >
                      <span className="cell-text">{row[colIdx] ?? ''}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" onClick={onBack}>
          Choose Different File
        </button>
        <button
          className="btn btn-primary"
          onClick={handleApply}
          disabled={!isValid || loading}
        >
          {loading ? 'Processing...' : 'Continue to Preview'}
        </button>
      </div>

      <style>{`
        .csv-spreadsheet-mapper {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .info-banner {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-info-bg);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
          color: var(--color-text);
          flex-wrap: wrap;
        }

        .info-format {
          color: var(--color-primary);
        }

        .info-rows {
          color: var(--color-text-muted);
          margin-left: auto;
        }

        .amount-type-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8125rem;
        }

        .toggle-label {
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .radio-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          cursor: pointer;
          color: var(--color-text);
        }

        .radio-pill input[type="radio"] {
          margin: 0;
        }

        .validation-bar {
          padding: 0.5rem 0.75rem;
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
          border-radius: var(--radius-sm);
          color: var(--color-warning);
          font-size: 0.8125rem;
        }

        .spreadsheet-container {
          overflow: auto;
          max-height: 450px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .spreadsheet-table {
          border-collapse: collapse;
          font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.75rem;
          width: max-content;
          min-width: 100%;
        }

        .spreadsheet-table thead {
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .assignment-row th {
          padding: 0.25rem 0.375rem;
          background: var(--color-surface);
          border-bottom: 2px solid var(--color-border);
          white-space: nowrap;
        }

        .role-select {
          padding: 0.25rem 0.375rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 0.6875rem;
          cursor: pointer;
          width: 100%;
          min-width: 80px;
        }

        .row-num-header {
          width: 36px;
          min-width: 36px;
          text-align: center;
          color: var(--color-text-muted);
          background: var(--color-bg) !important;
          position: sticky;
          left: 0;
          z-index: 3;
        }

        .row-num {
          width: 36px;
          min-width: 36px;
          text-align: center;
          color: var(--color-text-muted);
          background: var(--color-bg);
          cursor: pointer;
          user-select: none;
          font-size: 0.6875rem;
          border-right: 1px solid var(--color-border);
          position: sticky;
          left: 0;
          z-index: 1;
        }

        .row-num:hover {
          background: var(--color-primary);
          color: white;
        }

        .row-num-active {
          background: var(--color-primary) !important;
          color: white !important;
          font-weight: 600;
        }

        .header-row {
          background: var(--color-primary-bg, rgba(59, 130, 246, 0.12));
          font-weight: 600;
        }

        .header-row td.cell {
          background: var(--color-primary-bg, rgba(59, 130, 246, 0.12)) !important;
        }

        .meta-row {
          opacity: 0.5;
          font-style: italic;
        }

        .data-row.odd {
          background: var(--color-bg);
        }

        .cell {
          padding: 0.25rem 0.5rem;
          border-bottom: 1px solid var(--color-border);
          max-width: 200px;
          white-space: nowrap;
        }

        .cell-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .button-row {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 0.25rem;
        }

        .btn {
          padding: 0.5rem 1.5rem;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: background 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-primary);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--color-border);
        }
      `}</style>
    </div>
  );
};
