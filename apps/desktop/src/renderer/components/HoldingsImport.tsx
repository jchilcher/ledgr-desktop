import React, { useState, useCallback } from 'react';
import { HoldingsSpreadsheetMapper } from './HoldingsSpreadsheetMapper';
import { ImportPreview } from './ImportPreview';

type ImportStep = 'select' | 'spreadsheet' | 'preview' | 'complete';
type DuplicateAction = 'skip' | 'replace' | 'add';

interface ColumnMapping {
  ticker: string | null;
  shares: string | null;
  costBasis: string | null;
  costBasisType: 'total' | 'per_share';
  headerRow?: number;
}

interface HoldingsCSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: ColumnMapping | null;
}

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

interface HoldingsImportProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export const HoldingsImport: React.FC<HoldingsImportProps> = ({
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
  const [rawData, setRawData] = useState<HoldingsCSVRawData | null>(null);
  const [initialMapping, setInitialMapping] = useState<ColumnMapping | null>(null);

  // Preview data
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
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
      const result = await window.api.holdingsImport.selectFile();

      if (result.canceled || !result.filePath) {
        setLoading(false);
        return;
      }

      setFilePath(result.filePath);
      setFileName(result.filePath.split(/[\\/]/).pop() ?? 'file');

      // Get preview to detect format and raw data
      const preview = await window.api.holdingsImport.preview(result.filePath, accountId);

      if (!preview.success && !preview.rawData) {
        setError(preview.error ?? 'Failed to read file');
        setLoading(false);
        return;
      }

      setDetectedFormat(preview.detectedFormat);
      setFormatDisplayName(preview.formatDisplayName);

      // Store raw data for spreadsheet mapper
      if (preview.rawData) {
        setRawData(preview.rawData as HoldingsCSVRawData);
      }

      // Store suggested mapping for pre-fill
      if (preview.suggestedMapping) {
        setInitialMapping(preview.suggestedMapping as ColumnMapping);
      }

      // Always go to spreadsheet step
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
  const handleSpreadsheetApply = useCallback(async (mapping: ColumnMapping) => {
    if (!filePath) {
      setError('No file selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const preview = await window.api.holdingsImport.preview(
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
        setError('No valid holdings found. Please check your column mapping.');
        setLoading(false);
        return;
      }

      setPreviewRows(preview.rows);
      setStats(preview.stats);
      setDetectedFormat(preview.detectedFormat ?? 'Generic CSV');
      setFormatDisplayName(preview.formatDisplayName || 'Generic CSV');
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
      setError('Please select at least one row to import.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.holdingsImport.commit(
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
            <h3>Import Holdings</h3>
            <p>
              Import holdings from a CSV file exported from your brokerage.
              Supported formats: Fidelity, Charles Schwab, Vanguard, E*TRADE, or generic CSV.
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
            <HoldingsSpreadsheetMapper
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
            <ImportPreview
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
                  <option value="add">Add as new lot</option>
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
                {loading ? 'Importing...' : `Import ${selectedCount} Holdings`}
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
                Successfully imported <strong>{importResult?.imported ?? 0}</strong> holdings.
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
    <div className="holdings-import-overlay">
      <div className="holdings-import-modal">
        <div className="modal-header">
          <h2>Import Holdings</h2>
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
        .holdings-import-overlay {
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

        .holdings-import-modal {
          background: var(--color-surface);
          border-radius: 8px;
          width: 90%;
          max-width: 1100px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          color: var(--color-text);
        }

        .holdings-import-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .holdings-import-modal .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: var(--color-text);
        }

        .holdings-import-modal .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--color-text-muted);
          padding: 0;
          line-height: 1;
        }

        .holdings-import-modal .close-btn:hover {
          color: var(--color-text);
        }

        .holdings-import-modal .modal-body {
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
          border-radius: 4px;
          border-left: 3px solid var(--color-info);
          color: var(--color-text);
        }

        .button-row {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1rem;
        }

        .holdings-import-modal .btn {
          padding: 0.5rem 1.5rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: background 0.2s;
        }

        .holdings-import-modal .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .holdings-import-modal .btn-primary {
          background: var(--color-primary);
          color: white;
        }

        .holdings-import-modal .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .holdings-import-modal .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
        }

        .holdings-import-modal .btn-secondary:hover:not(:disabled) {
          background: var(--color-border);
        }

        .error-message {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: 4px;
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
          border-radius: 4px;
          color: var(--color-text);
        }

        .duplicate-options label {
          color: var(--color-text);
        }

        .duplicate-options select {
          padding: 0.375rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          background: var(--color-surface);
          color: var(--color-text);
        }

        .step-preview {
          min-height: 400px;
        }

        .result-summary {
          padding: 1rem;
          background: var(--color-success-bg);
          border-radius: 4px;
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
