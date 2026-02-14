import React, { useState, useEffect } from 'react';
import { TransactionAttachment } from '../../shared/types';

interface AttachmentPanelProps {
  transactionId: string;
  transactionDescription: string;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '\u{1F5BC}';
  if (mimeType === 'application/pdf') return '\u{1F4C4}';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return '\u{1F4CA}';
  if (mimeType.includes('word') || mimeType.includes('document')) return '\u{1F4DD}';
  if (mimeType === 'text/plain') return '\u{1F4C3}';
  return '\u{1F4CE}';
}

const AttachmentPanel: React.FC<AttachmentPanelProps> = ({ transactionId, transactionDescription, onClose }) => {
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadAttachments();
  }, [transactionId]);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const result = await window.api.attachments.getByTransaction(transactionId);
      setAttachments(result);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttachment = async () => {
    try {
      setUploading(true);
      const result = await window.api.attachments.selectFile();
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;

      for (const filePath of result.filePaths) {
        await window.api.attachments.add(transactionId, filePath);
      }
      await loadAttachments();
    } catch (error) {
      console.error('Error adding attachment:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenAttachment = async (id: string) => {
    try {
      await window.api.attachments.open(id);
    } catch (error) {
      console.error('Error opening attachment:', error);
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    try {
      await window.api.attachments.delete(id);
      setConfirmDeleteId(null);
      await loadAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="attachment-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Attachments</h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>
            Close
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0 0 16px 0' }}>
          {transactionDescription}
        </p>

        <div className="attachment-upload">
          <button
            onClick={handleAddAttachment}
            className="btn btn-primary"
            disabled={uploading}
            style={{ width: '100%' }}
          >
            {uploading ? 'Adding...' : 'Add Attachment'}
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
        ) : attachments.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
            No attachments yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {attachments.map((att) => (
              <div key={att.id} className="attachment-item">
                <div className="attachment-thumbnail">
                  {att.mimeType.startsWith('image/') ? (
                    <span style={{ fontSize: '24px' }}>{getFileIcon(att.mimeType)}</span>
                  ) : (
                    <span style={{ fontSize: '24px' }}>{getFileIcon(att.mimeType)}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '13px',
                  }}>
                    {att.filename}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {formatFileSize(att.fileSize)} &middot; {new Date(att.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="attachment-actions">
                  <button
                    onClick={() => handleOpenAttachment(att.id)}
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    title="Open with default app"
                  >
                    Open
                  </button>
                  {confirmDeleteId === att.id ? (
                    <>
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="btn btn-outline-danger"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(att.id)}
                      className="btn btn-outline-danger"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      title="Delete attachment"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttachmentPanel;
