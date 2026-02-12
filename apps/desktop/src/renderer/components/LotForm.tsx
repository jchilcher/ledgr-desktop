import React, { useState, useEffect } from 'react';
import { CostBasisLot } from '../../shared/types';

interface LotFormProps {
  holdingId: string;
  lot?: CostBasisLot | null;
  onSave: (lot: CostBasisLot) => void;
  onCancel: () => void;
}

export function LotForm({ holdingId, lot, onSave, onCancel }: LotFormProps) {
  const [purchaseDate, setPurchaseDate] = useState('');
  const [shares, setShares] = useState('');
  const [costPerShare, setCostPerShare] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lot) {
      // Convert Date to YYYY-MM-DD format for input
      const date = new Date(lot.purchaseDate);
      setPurchaseDate(date.toISOString().split('T')[0]);
      setShares((lot.shares / 10000).toFixed(4));
      setCostPerShare((lot.costPerShare / 100).toFixed(2));
    }
  }, [lot]);

  const calculateTotalCost = (): number => {
    const sharesValue = parseFloat(shares);
    const costValue = parseFloat(costPerShare);
    if (isNaN(sharesValue) || isNaN(costValue)) return 0;
    return sharesValue * costValue;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!purchaseDate) {
      setError('Purchase date is required');
      return;
    }

    if (!shares.trim()) {
      setError('Shares is required');
      return;
    }

    if (!costPerShare.trim()) {
      setError('Cost per share is required');
      return;
    }

    const sharesValue = parseFloat(shares);
    if (isNaN(sharesValue) || sharesValue <= 0) {
      setError('Shares must be greater than 0');
      return;
    }

    const costValue = parseFloat(costPerShare);
    if (isNaN(costValue) || costValue < 0) {
      setError('Cost per share must be a valid number (0 or greater)');
      return;
    }

    const date = new Date(purchaseDate);
    if (date > new Date()) {
      setError('Purchase date cannot be in the future');
      return;
    }

    try {
      setLoading(true);

      const sharesInt = Math.round(sharesValue * 10000);
      const costInt = Math.round(costValue * 100);

      if (lot) {
        // Edit mode
        const updated = await window.api.lots.update(lot.id, {
          purchaseDate: date,
          shares: sharesInt,
          costPerShare: costInt,
          remainingShares: sharesInt, // Reset remaining shares when editing
        });

        if (updated) {
          onSave(updated);
        }
      } else {
        // Add mode
        const created = await window.api.lots.create({
          holdingId,
          purchaseDate: date,
          shares: sharesInt,
          costPerShare: costInt,
          remainingShares: sharesInt, // Initially all shares remain
        });

        onSave(created);
      }
    } catch (err) {
      setError(`Error saving lot: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lot-form">
      <h4 className="form-title">{lot ? 'Edit Lot' : 'New Lot'}</h4>

      {error && (
        <div
          style={{
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="purchaseDate">Purchase Date *</label>
            <input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="shares">Shares *</label>
            <input
              id="shares"
              type="number"
              step="0.0001"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              disabled={loading}
              placeholder="10"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="costPerShare">Cost Per Share *</label>
            <input
              id="costPerShare"
              type="number"
              step="0.01"
              value={costPerShare}
              onChange={(e) => setCostPerShare(e.target.value)}
              disabled={loading}
              placeholder="165.00"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Total Cost</label>
            <div className="calculated">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(calculateTotalCost())}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {lot ? 'Save Changes' : 'Add Lot'}
          </button>
        </div>
      </form>
    </div>
  );
}
