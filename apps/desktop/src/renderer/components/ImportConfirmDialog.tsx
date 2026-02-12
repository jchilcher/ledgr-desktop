import { DatabaseMetadata } from '../../shared/types';

interface ImportConfirmDialogProps {
  isOpen: boolean;
  currentMetadata: DatabaseMetadata | null;
  importedMetadata: DatabaseMetadata | null;
  importFilePath: string;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export function ImportConfirmDialog({
  isOpen,
  currentMetadata,
  importedMetadata,
  importFilePath,
  onConfirm,
  onCancel,
  isImporting,
}: ImportConfirmDialogProps) {
  if (!isOpen || !currentMetadata || !importedMetadata) {
    return null;
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateRange = (range: { earliest: string; latest: string } | null): string => {
    if (!range) return 'No transactions';
    return `${range.earliest} to ${range.latest}`;
  };

  return (
    <div className="about-dialog-overlay" onClick={isImporting ? undefined : onCancel}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <button
          className="about-dialog-close"
          onClick={onCancel}
          disabled={isImporting}
          aria-label="Close"
        >
          ×
        </button>

        <div className="about-dialog-content">
          <h2 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>Import Database</h2>

          <div style={{
            padding: '12px',
            backgroundColor: 'var(--color-warning-bg, #fff3cd)',
            border: '1px solid var(--color-warning, #ffc107)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '0.9rem',
            color: 'var(--color-text)',
          }}>
            <strong>Warning:</strong> This will replace your current database with the imported file.
            A backup will be created automatically.
          </div>

          <div style={{ marginBottom: '24px' }}>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              marginBottom: '8px',
            }}>
              Import file: {importFilePath.split(/[\\/]/).pop()}
            </p>
          </div>

          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '24px',
            fontSize: '0.9rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}></th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Current</th>
                <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Imported</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: '500' }}>Accounts</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{currentMetadata.accountCount}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{importedMetadata.accountCount}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: '500' }}>Transactions</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{currentMetadata.transactionCount}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{importedMetadata.transactionCount}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: '500' }}>Date Range</td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
                  {formatDateRange(currentMetadata.dateRange)}
                </td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
                  {formatDateRange(importedMetadata.dateRange)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px', fontWeight: '500' }}>File Size</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {formatFileSize(currentMetadata.fileSizeBytes)}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {formatFileSize(importedMetadata.fileSizeBytes)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px', fontWeight: '500' }}>Schema Version</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{currentMetadata.schemaVersion}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{importedMetadata.schemaVersion}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              disabled={isImporting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isImporting}
              className="btn btn-primary"
              style={{
                backgroundColor: 'var(--color-danger, #dc3545)',
                borderColor: 'var(--color-danger, #dc3545)',
              }}
            >
              {isImporting ? 'Importing...' : 'Replace Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
