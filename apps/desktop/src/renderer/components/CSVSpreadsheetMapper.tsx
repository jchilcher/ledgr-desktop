import React, { useState, useCallback, useMemo, useEffect } from 'react';

type TransactionAmountType = 'single' | 'split';

interface TransactionColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  category: string | null;
  balance: string | null;
  amountType: TransactionAmountType;
  headerRow?: number;
}

interface CSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: TransactionColumnMapping | null;
}

type ColumnRole = 'skip' | 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'category' | 'balance';

const ROLE_OPTIONS_SINGLE: { value: ColumnRole; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'date', label: 'Date *' },
  { value: 'description', label: 'Description *' },
  { value: 'amount', label: 'Amount *' },
  { value: 'category', label: 'Category' },
  { value: 'balance', label: 'Balance' },
];

const ROLE_OPTIONS_SPLIT: { value: ColumnRole; label: string }[] = [
  { value: 'skip', label: 'Skip' },
  { value: 'date', label: 'Date *' },
  { value: 'description', label: 'Description *' },
  { value: 'debit', label: 'Debit *' },
  { value: 'credit', label: 'Credit *' },
  { value: 'category', label: 'Category' },
  { value: 'balance', label: 'Balance' },
];

const ROLE_COLORS: Record<ColumnRole, string> = {
  skip: 'transparent',
  date: 'var(--spreadsheet-date, rgba(59, 130, 246, 0.08))',
  description: 'var(--spreadsheet-desc, rgba(139, 92, 246, 0.08))',
  amount: 'var(--spreadsheet-amount, rgba(34, 197, 94, 0.08))',
  debit: 'var(--spreadsheet-amount, rgba(34, 197, 94, 0.08))',
  credit: 'var(--spreadsheet-amount, rgba(34, 197, 94, 0.08))',
  category: 'var(--spreadsheet-category, rgba(245, 158, 11, 0.08))',
  balance: 'var(--spreadsheet-balance, rgba(107, 114, 128, 0.08))',
};

interface CSVSpreadsheetMapperProps {
  rawData: CSVRawData;
  fileName: string;
  detectedFormat: string | null;
  initialMapping: TransactionColumnMapping | null;
  onApply: (mapping: TransactionColumnMapping) => void;
  onBack: () => void;
  loading?: boolean;
}

export const CSVSpreadsheetMapper: React.FC<CSVSpreadsheetMapperProps> = ({
  rawData,
  fileName,
  detectedFormat,
  initialMapping,
  onApply,
  onBack,
  loading = false,
}) => {
  const [headerRow, setHeaderRow] = useState<number>(rawData.detectedHeaderRow);
  const [amountType, setAmountType] = useState<TransactionAmountType>(
    initialMapping?.amountType ?? 'single'
  );
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);

  const maxCols = useMemo(() => {
    let max = 0;
    for (const row of rawData.rawRows) {
      if (row.length > max) max = row.length;
    }
    return max;
  }, [rawData.rawRows]);

  // Build column roles from initial mapping
  const buildRolesFromMapping = useCallback((mapping: TransactionColumnMapping | null, hRow: number) => {
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

    assignRole(mapping.date, 'date');
    assignRole(mapping.description, 'description');
    if (mapping.amountType === 'single') {
      assignRole(mapping.amount, 'amount');
    } else {
      assignRole(mapping.debit, 'debit');
      assignRole(mapping.credit, 'credit');
    }
    assignRole(mapping.category, 'category');
    assignRole(mapping.balance, 'balance');

    return roles;
  }, [maxCols, rawData.rawRows]);

  // Initialize roles from initial mapping or suggested mapping
  useEffect(() => {
    const mapping = initialMapping ?? rawData.suggestedMapping;
    if (mapping) {
      setAmountType(mapping.amountType);
    }
    setColumnRoles(buildRolesFromMapping(mapping, headerRow));
  }, []); // Run once on mount

  // Re-suggest when header row changes
  const handleHeaderRowChange = useCallback((newRow: number) => {
    setHeaderRow(newRow);
    // Re-run suggestion on new header row cells
    // We do a simple re-match using the suggestTransactionMapping logic
    // by rebuilding from the rawData's suggested mapping for the new row
    // For simplicity, just reset roles to skip and let user re-map,
    // or try to match the new headers with existing role assignments
    const newHeaders = rawData.rawRows[newRow]?.map(h => h.replace(/"/g, '').trim()) ?? [];

    // Try fuzzy matching on new header row
    const roles: ColumnRole[] = new Array(maxCols).fill('skip');
    const datePatterns = ['date', 'transaction date', 'trans date', 'trans. date', 'posting date', 'post date', 'posted date', 'effective date', 'value date'];
    const descPatterns = ['description', 'memo', 'narrative', 'payee', 'merchant', 'transaction description', 'details', 'name', 'merchant name'];
    const amountPatterns = ['amount', 'transaction amount', 'amt', 'value', 'sum'];
    const debitPatterns = ['debit', 'debit amount', 'withdrawal', 'money out', 'withdrawals', 'debits'];
    const creditPatterns = ['credit', 'credit amount', 'deposit', 'money in', 'deposits', 'credits'];
    const categoryPatterns = ['category', 'type', 'transaction type', 'merchant category'];
    const balancePatterns = ['balance', 'running balance', 'available balance', 'ledger balance'];

    const fuzzyMatch = (header: string, patterns: string[]) => {
      const norm = header.toLowerCase().trim().replace(/[_-]/g, ' ');
      return patterns.some(p => norm === p || norm.includes(p) || p.includes(norm));
    };

    let hasAmount = false;
    let hasDebit = false;
    let hasCredit = false;

    for (let i = 0; i < newHeaders.length && i < roles.length; i++) {
      const h = newHeaders[i];
      if (!h) continue;
      if (fuzzyMatch(h, datePatterns) && !roles.includes('date')) {
        roles[i] = 'date';
      } else if (fuzzyMatch(h, descPatterns) && !roles.includes('description')) {
        roles[i] = 'description';
      } else if (fuzzyMatch(h, amountPatterns)) {
        roles[i] = 'amount';
        hasAmount = true;
      } else if (fuzzyMatch(h, debitPatterns)) {
        roles[i] = 'debit';
        hasDebit = true;
      } else if (fuzzyMatch(h, creditPatterns)) {
        roles[i] = 'credit';
        hasCredit = true;
      } else if (fuzzyMatch(h, categoryPatterns) && !roles.includes('category')) {
        roles[i] = 'category';
      } else if (fuzzyMatch(h, balancePatterns) && !roles.includes('balance')) {
        roles[i] = 'balance';
      }
    }

    // Auto-detect amount type
    if (hasDebit && hasCredit && !hasAmount) {
      setAmountType('split');
    } else if (hasAmount) {
      setAmountType('single');
    }

    setColumnRoles(roles);
  }, [rawData.rawRows, maxCols]);

  const handleRoleChange = useCallback((colIdx: number, role: ColumnRole) => {
    setColumnRoles(prev => {
      const next = [...prev];
      // For unique roles (date, description, amount, debit, credit), clear previous assignment
      if (role !== 'skip') {
        for (let i = 0; i < next.length; i++) {
          if (next[i] === role) next[i] = 'skip';
        }
      }
      next[colIdx] = role;
      return next;
    });
  }, []);

  const handleAmountTypeChange = useCallback((newType: TransactionAmountType) => {
    setAmountType(newType);
    // Clear amount-related roles
    setColumnRoles(prev => prev.map(r =>
      r === 'amount' || r === 'debit' || r === 'credit' ? 'skip' : r
    ));
  }, []);

  // Build mapping from current state
  const buildMapping = useCallback((): TransactionColumnMapping => {
    const headers = rawData.rawRows[headerRow]?.map(h => h.replace(/"/g, '').trim()) ?? [];
    const mapping: TransactionColumnMapping = {
      date: null,
      description: null,
      amount: null,
      debit: null,
      credit: null,
      category: null,
      balance: null,
      amountType,
      headerRow,
    };

    for (let i = 0; i < columnRoles.length; i++) {
      const role = columnRoles[i];
      const colName = headers[i] ?? `Column ${i + 1}`;
      if (role === 'date') mapping.date = colName;
      else if (role === 'description') mapping.description = colName;
      else if (role === 'amount') mapping.amount = colName;
      else if (role === 'debit') mapping.debit = colName;
      else if (role === 'credit') mapping.credit = colName;
      else if (role === 'category') mapping.category = colName;
      else if (role === 'balance') mapping.balance = colName;
    }

    return mapping;
  }, [rawData.rawRows, headerRow, columnRoles, amountType]);

  // Validation
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!columnRoles.includes('date')) missing.push('Date');
    if (!columnRoles.includes('description')) missing.push('Description');
    if (amountType === 'single') {
      if (!columnRoles.includes('amount')) missing.push('Amount');
    } else {
      if (!columnRoles.includes('debit')) missing.push('Debit');
      if (!columnRoles.includes('credit')) missing.push('Credit');
    }
    return missing;
  }, [columnRoles, amountType]);

  const isValid = missingFields.length === 0;

  const roleOptions = amountType === 'single' ? ROLE_OPTIONS_SINGLE : ROLE_OPTIONS_SPLIT;

  const handleApply = () => {
    if (isValid) {
      onApply(buildMapping());
    }
  };

  return (
    <div className="csv-spreadsheet-mapper">
      {/* Info banner */}
      <div className="info-banner">
        <span className="info-file">File: <strong>{fileName}</strong></span>
        {detectedFormat && (
          <span className="info-format">Detected: <strong>{detectedFormat}</strong></span>
        )}
        <span className="info-rows">{rawData.totalRows} rows</span>
      </div>

      {/* Amount type toggle */}
      <div className="amount-type-toggle">
        <span className="toggle-label">Amount format:</span>
        <label className="radio-pill">
          <input
            type="radio"
            name="spreadsheet-amount-type"
            checked={amountType === 'single'}
            onChange={() => handleAmountTypeChange('single')}
          />
          <span>Single column</span>
        </label>
        <label className="radio-pill">
          <input
            type="radio"
            name="spreadsheet-amount-type"
            checked={amountType === 'split'}
            onChange={() => handleAmountTypeChange('split')}
          />
          <span>Debit / Credit</span>
        </label>
      </div>

      {/* Validation bar */}
      {!isValid && (
        <div className="validation-bar">
          Assign required columns: {missingFields.join(', ')}
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            {/* Assignment row */}
            <tr className="assignment-row">
              <th className="row-num-header">#</th>
              {Array.from({ length: maxCols }, (_, colIdx) => (
                <th key={colIdx} style={{ background: ROLE_COLORS[columnRoles[colIdx] || 'skip'] }}>
                  <select
                    value={columnRoles[colIdx] || 'skip'}
                    onChange={(e) => handleRoleChange(colIdx, e.target.value as ColumnRole)}
                    className="role-select"
                  >
                    {roleOptions.map(opt => (
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

      {/* Button row */}
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
