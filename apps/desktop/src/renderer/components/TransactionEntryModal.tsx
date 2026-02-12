import React, { useState, useEffect } from 'react';
import { InvestmentTransactionType, Investment } from '../../shared/types';

interface TransactionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  holding: Investment | null;
  editTransaction?: {
    id: string;
    type: InvestmentTransactionType;
    date: Date;
    shares: number;
    pricePerShare: number;
    totalAmount: number;
    fees: number;
    splitRatio?: string | null;
    notes?: string | null;
  } | null;
}

const transactionTypeLabels: Record<InvestmentTransactionType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  stock_split: 'Stock Split',
  drip: 'Dividend Reinvestment (DRIP)',
};

export function TransactionEntryModal({
  isOpen,
  onClose,
  onSave,
  holding,
  editTransaction,
}: TransactionEntryModalProps) {
  const [type, setType] = useState<InvestmentTransactionType>('buy');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shares, setShares] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [fees, setFees] = useState('0');
  const [splitRatioFrom, setSplitRatioFrom] = useState('1');
  const [splitRatioTo, setSplitRatioTo] = useState('2');
  const [dividendAmount, setDividendAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or editTransaction changes
  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setDate(new Date(editTransaction.date).toISOString().split('T')[0]);
      setShares(String(editTransaction.shares / 10000)); // Convert from stored format
      setPricePerShare(String(editTransaction.pricePerShare / 100)); // Convert from cents
      setFees(String(editTransaction.fees / 100));
      if (editTransaction.splitRatio) {
        const [from, to] = editTransaction.splitRatio.split(':');
        setSplitRatioFrom(from || '1');
        setSplitRatioTo(to || '2');
      }
      setNotes(editTransaction.notes || '');
      if (editTransaction.type === 'dividend') {
        setDividendAmount(String(editTransaction.totalAmount / 100));
      }
    } else {
      resetForm();
    }
  }, [editTransaction, isOpen]);

  const resetForm = () => {
    setType('buy');
    setDate(new Date().toISOString().split('T')[0]);
    setShares('');
    setPricePerShare('');
    setFees('0');
    setSplitRatioFrom('1');
    setSplitRatioTo('2');
    setDividendAmount('');
    setNotes('');
    setError(null);
  };

  const calculateTotal = (): number => {
    const sharesNum = parseFloat(shares) || 0;
    const priceNum = parseFloat(pricePerShare) || 0;
    const feesNum = parseFloat(fees) || 0;

    if (type === 'buy' || type === 'drip') {
      return sharesNum * priceNum + feesNum;
    } else if (type === 'sell') {
      return sharesNum * priceNum - feesNum;
    } else if (type === 'dividend') {
      return parseFloat(dividendAmount) || 0;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holding) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const sharesInt = Math.round((parseFloat(shares) || 0) * 10000);
      const priceInt = Math.round((parseFloat(pricePerShare) || 0) * 100);
      const feesInt = Math.round((parseFloat(fees) || 0) * 100);
      const totalInt = Math.round(calculateTotal() * 100);

      const transactionData = {
        holdingId: holding.id,
        type,
        date: new Date(date),
        shares: type === 'sell' ? -Math.abs(sharesInt) : sharesInt,
        pricePerShare: priceInt,
        totalAmount: totalInt,
        fees: feesInt,
        splitRatio: type === 'stock_split' ? `${splitRatioFrom}:${splitRatioTo}` : null,
        notes: notes.trim() || null,
      };

      if (editTransaction) {
        await window.api.investmentTransactions.update(editTransaction.id, transactionData);
      } else {
        await window.api.investmentTransactions.create(transactionData);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content transaction-entry-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editTransaction ? 'Edit' : 'Add'} Transaction</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {holding && (
          <div className="modal-holding-info">
            <span className="ticker">{holding.ticker || holding.name}</span>
            <span className="name">{holding.name}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="transaction-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label>Transaction Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as InvestmentTransactionType)}
              disabled={!!editTransaction}
            >
              {Object.entries(transactionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Shares field for buy, sell, drip */}
          {(type === 'buy' || type === 'sell' || type === 'drip') && (
            <div className="form-group">
              <label>Shares</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="0.0000"
                required
              />
            </div>
          )}

          {/* Price per share for buy, sell, drip */}
          {(type === 'buy' || type === 'sell' || type === 'drip') && (
            <div className="form-group">
              <label>Price per Share</label>
              <div className="input-with-prefix">
                <span className="prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerShare}
                  onChange={e => setPricePerShare(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          {/* Fees for buy, sell */}
          {(type === 'buy' || type === 'sell') && (
            <div className="form-group">
              <label>Fees (optional)</label>
              <div className="input-with-prefix">
                <span className="prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fees}
                  onChange={e => setFees(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Dividend amount */}
          {type === 'dividend' && (
            <div className="form-group">
              <label>Dividend Amount</label>
              <div className="input-with-prefix">
                <span className="prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dividendAmount}
                  onChange={e => setDividendAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          {/* Stock split ratio */}
          {type === 'stock_split' && (
            <div className="form-group">
              <label>Split Ratio</label>
              <div className="split-ratio-inputs">
                <input
                  type="number"
                  min="1"
                  value={splitRatioFrom}
                  onChange={e => setSplitRatioFrom(e.target.value)}
                  required
                />
                <span>:</span>
                <input
                  type="number"
                  min="1"
                  value={splitRatioTo}
                  onChange={e => setSplitRatioTo(e.target.value)}
                  required
                />
                <span className="split-description">
                  ({splitRatioFrom} old share(s) becomes {splitRatioTo} new share(s))
                </span>
              </div>
            </div>
          )}

          {/* Total display for buy/sell/drip */}
          {(type === 'buy' || type === 'sell' || type === 'drip') && (
            <div className="form-group total-display">
              <label>Total</label>
              <span className="calculated-total">
                ${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any notes about this transaction..."
              rows={2}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editTransaction ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
