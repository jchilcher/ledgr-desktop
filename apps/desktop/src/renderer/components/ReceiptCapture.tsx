import React, { useState, useEffect, useCallback } from 'react';
import { Receipt } from '../../shared/types';

interface ReceiptCaptureProps {
  transactionId?: string;
  onClose?: () => void;
}

export function ReceiptCapture({ transactionId, onClose }: ReceiptCaptureProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transactionId) {
      loadReceipts();
    }
  }, [transactionId]);

  const loadReceipts = async () => {
    if (!transactionId) return;
    try {
      const receipt = await window.api.receipts.getByTransaction(transactionId);
      setReceipts(receipt ? [receipt] : []);
    } catch (err) {
      console.error('Failed to load receipts:', err);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  }, [transactionId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload PNG, JPG, or PDF.');
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 10MB.');
      }

      // Read file as base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Upload receipt
      await window.api.receipts.create({
        transactionId: transactionId || null,
        filePath: base64Data, // In real app, this would be saved to disk
        thumbnailPath: base64Data,
        extractedData: null, // OCR would populate this
        uploadedAt: new Date(),
        processedAt: null,
      });

      await loadReceipts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (receiptId: string) => {
    if (confirm('Are you sure you want to delete this receipt?')) {
      try {
        await window.api.receipts.delete(receiptId);
        await loadReceipts();
        setSelectedReceipt(null);
      } catch (err) {
        console.error('Failed to delete receipt:', err);
      }
    }
  };

  return (
    <div className="receipt-capture">
      <div className="receipt-header">
        <h3>Receipt</h3>
        {onClose && (
          <button onClick={onClose} className="close-btn">×</button>
        )}
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {receipts.length === 0 && (
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="drop-zone-content">
            <span className="drop-icon">📎</span>
            <p>Drag and drop a receipt here</p>
            <p className="supported-formats">Supported formats: PNG, JPG, PDF</p>
            <label className="browse-btn">
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <span>Browse Files</span>
            </label>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="uploading-indicator">
          <span>Uploading...</span>
        </div>
      )}

      {receipts.length > 0 && (
        <div className="receipts-list">
          {receipts.map(receipt => (
            <div key={receipt.id} className="receipt-item">
              <div
                className="receipt-thumbnail"
                onClick={() => setSelectedReceipt(receipt)}
              >
                {receipt.thumbnailPath ? (
                  <img src={receipt.thumbnailPath} alt="Receipt" />
                ) : (
                  <div className="receipt-placeholder">📄</div>
                )}
              </div>
              <div className="receipt-info">
                <span className="receipt-date">
                  Uploaded {new Date(receipt.uploadedAt).toLocaleDateString()}
                </span>
                {receipt.processedAt && (
                  <span className="receipt-status">Processed</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(receipt.id)}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedReceipt && (
        <div className="receipt-viewer-modal" onClick={() => setSelectedReceipt(null)}>
          <div className="receipt-viewer" onClick={e => e.stopPropagation()}>
            <button
              className="close-viewer"
              onClick={() => setSelectedReceipt(null)}
            >
              ×
            </button>

            <div className="receipt-image">
              {selectedReceipt.filePath && (
                <img src={selectedReceipt.filePath} alt="Receipt" />
              )}
            </div>

            {selectedReceipt.extractedData && (
              <div className="extracted-data">
                <h4>Extracted Data</h4>
                <pre>{JSON.stringify(selectedReceipt.extractedData, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
