import React, { useState, useCallback } from 'react';
import { CSVSpreadsheetMapper } from './CSVSpreadsheetMapper';
import { TransactionImportPreview } from './TransactionImportPreview';

type ImportStep = 'select' | 'spreadsheet' | 'preview' | 'complete';
type DuplicateAction = 'skip' | 'replace' | 'add';
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

interface TransactionImportProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export const TransactionImport: React.FC<TransactionImportProps> = ({
  accountId,
  accountName,
  onClose,
  onImportComplete,
}) => {
  // Wizard state
  const [step, setStep] = useState<ImportStep>('select');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format detection
  const [, setDetectedFormat] = useState<string | null>(null);
  const [formatDisplayName, setFormatDisplayName] = useState<string>('');

  // Raw data for spreadsheet mapper
  const [rawData, setRawData] = useState<CSVRawData | null>(null);
  const [initialMapping, setInitialMapping] = useState<TransactionColumnMapping | null>(null);

  // Preview data
  const [previewRows, setPreviewRows] = useState<TransactionImportPreviewRow[]>([]);
  const [stats, setStats] = useState({ total: 0, new: 0, duplicates: 0, errors: 0 });

  // Duplicate handling
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');

  // Import result
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  // Step 1: Select file
  const handleSelectFile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.transactionImport.selectFile();

      if (result.canceled || !result.filePath) {
        setLoading(false);
        return;
      }

      setFilePath(result.filePath);
      setFileName(result.filePath.split(/[\\/]/).pop() ?? 'file');

      // Get preview to detect format and raw data
      const preview = await window.api.transactionImport.preview(result.filePath, accountId);

      if (!preview.success && !preview.rawData) {
        setError(preview.error ?? 'Failed to read file');
        setLoading(false);
        return;
      }

      setDetectedFormat(preview.detectedFormat);
      setFormatDisplayName(preview.formatDisplayName);

      // Store raw data for spreadsheet mapper
      if (preview.rawData) {
        setRawData(preview.rawData as CSVRawData);
      }

      // Store suggested or detected mapping for pre-fill
      if (preview.suggestedMapping) {
        setInitialMapping(preview.suggestedMapping as TransactionColumnMapping);
      }

      // Always go to spreadsheet step so user can verify/adjust mappings
      if (preview.rawData) {
        setStep('spreadsheet');
      } else {
        setError('Could not parse file. Please check the format.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // Step 2: Apply mapping from spreadsheet and proceed to preview
  const handleSpreadsheetApply = useCallback(async (mapping: TransactionColumnMapping) => {
    if (!filePath) {
      setError('No file selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const preview = await window.api.transactionImport.preview(
        filePath,
        accountId,
        mapping
      );

      if (!preview.success) {
        setError(preview.error ?? 'Failed to parse file');
        setLoading(false);
        return;
      }

      if (preview.rows.length === 0) {
        setError('No valid transactions found. Please check your column mapping.');
        setLoading(false);
        return;
      }

      setPreviewRows(preview.rows);
      setStats(preview.stats);
      setDetectedFormat(preview.detectedFormat ?? 'Manual Mapping');
      setFormatDisplayName(preview.formatDisplayName || 'Manual Mapping');
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filePath, accountId]);

  // Preview: Toggle row selection
  const handleRowSelectionChange = (index: number, selected: boolean) => {
    setPreviewRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, selected } : row))
    );
  };

  // Preview: Select/deselect all
  const handleSelectAll = (selected: boolean) => {
    setPreviewRows((rows) =>
      rows.map((row) =>
        row.status !== 'error' ? { ...row, selected } : row
      )
    );
  };

  // Step 4: Commit import
  const handleCommit = useCallback(async () => {
    const selectedCount = previewRows.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      setError('Please select at least one transaction to import.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.transactionImport.commit(
        accountId,
        previewRows,
        duplicateAction
      );

      if (!result.success) {
        setError(result.error ?? 'Import failed');
        return;
      }

      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [accountId, previewRows, duplicateAction]);

  // Close and refresh
  const handleComplete = () => {
    onImportComplete();
    onClose();
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'select':
        return (
          <div className="step-content step-select">
            <h3>Import Transactions</h3>
            <p>
              Import transactions from a CSV file exported from your bank.
              Supported formats: Wells Fargo, Chase, Bank of America, Capital One, Discover, or generic CSV.
            </p>
            <p className="account-info">
              Importing to: <strong>{accountName}</strong>
            </p>
            <button
              className="btn btn-primary"
              onClick={handleSelectFile}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Select CSV File'}
            </button>
          </div>
        );

      case 'spreadsheet':
        return rawData ? (
          <div className="step-content step-spreadsheet">
            <CSVSpreadsheetMapper
              rawData={rawData}
              fileName={fileName}
              detectedFormat={formatDisplayName || null}
              initialMapping={initialMapping}
              onApply={handleSpreadsheetApply}
              onBack={() => setStep('select')}
              loading={loading}
            />
          </div>
        ) : null;

      case 'preview': {
        const selectedCount = previewRows.filter((r) => r.selected).length;
        const hasDuplicates = stats.duplicates > 0;

        return (
          <div className="step-content step-preview">
            <h3>Review Import</h3>
            <p className="file-info">
              File: <strong>{fileName}</strong> | Format: <strong>{formatDisplayName}</strong>
            </p>
            <TransactionImportPreview
              rows={previewRows}
              onRowSelectionChange={handleRowSelectionChange}
              onSelectAll={handleSelectAll}
              stats={stats}
            />

            {hasDuplicates && (
              <div className="duplicate-options">
                <label>When importing duplicates:</label>
                <select
                  value={duplicateAction}
                  onChange={(e) => setDuplicateAction(e.target.value as DuplicateAction)}
                >
                  <option value="skip">Skip (keep existing)</option>
                  <option value="replace">Replace existing</option>
                  <option value="add">Add anyway (may create duplicates)</option>
                </select>
              </div>
            )}

            <div className="button-row">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('spreadsheet')}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCommit}
                disabled={loading || selectedCount === 0}
              >
                {loading ? 'Importing...' : `Import ${selectedCount} Transactions`}
              </button>
            </div>
          </div>
        );
      }

      case 'complete':
        return (
          <div className="step-content step-complete">
            <h3>Import Complete</h3>
            <div className="result-summary">
              <p className="result-success">
                Successfully imported <strong>{importResult?.imported ?? 0}</strong> transactions.
              </p>
              {(importResult?.skipped ?? 0) > 0 && (
                <p className="result-skipped">
                  Skipped <strong>{importResult?.skipped}</strong> duplicates.
                </p>
              )}
              {(importResult?.errors ?? 0) > 0 && (
                <p className="result-errors">
                  Failed to import <strong>{importResult?.errors}</strong> rows.
                </p>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleComplete}>
              Done
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="transaction-import-overlay">
      <div className="transaction-import-modal">
        <div className="modal-header">
          <h2>Import Transactions</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button className="dismiss-btn" onClick={() => setError(null)}>
                &times;
              </button>
            </div>
          )}
          {renderStep()}
        </div>
      </div>

      <style>{`
        .transaction-import-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .transaction-import-modal {
          background: var(--color-surface);
          border-radius: var(--radius-md);
          width: 90%;
          max-width: 1100px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: var(--color-text);
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--color-text-muted);
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: var(--color-text);
        }

        .modal-body {
          flex: 1;
          overflow: auto;
          padding: 1.5rem;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .step-content h3 {
          margin: 0;
          color: var(--color-text);
        }

        .step-content p {
          color: var(--color-text);
        }

        .account-info {
          background: var(--color-info-bg);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          border-left: 3px solid var(--color-info);
          color: var(--color-text);
        }

        .file-info {
          color: var(--color-text-muted);
          font-size: 0.875rem;
        }

        .button-row {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1rem;
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

        .error-message {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-sm);
          color: var(--color-danger);
          margin-bottom: 1rem;
        }

        .dismiss-btn {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          color: inherit;
          padding: 0;
          line-height: 1;
        }

        .duplicate-options {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--color-info-bg);
          border-radius: var(--radius-sm);
          color: var(--color-text);
        }

        .duplicate-options select {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-surface);
          color: var(--color-text);
        }

        .step-preview {
          min-height: 500px;
        }

        .result-summary {
          padding: 1rem;
          background: var(--color-success-bg);
          border-radius: var(--radius-sm);
        }

        .result-summary p {
          margin: 0.5rem 0;
        }

        .result-success { color: var(--color-success); }
        .result-skipped { color: var(--color-warning); }
        .result-errors { color: var(--color-danger); }
      `}</style>
    </div>
  );
};
