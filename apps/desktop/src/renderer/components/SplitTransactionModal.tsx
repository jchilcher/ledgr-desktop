import { useState, useEffect } from 'react';
import { Transaction, Category } from '../../shared/types';

interface SplitTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

interface SplitFormItem {
  id?: string;
  categoryId: string;
  amount: string;
  description: string;
}

export default function SplitTransactionModal({ transaction, onClose, onSave }: SplitTransactionModalProps) {
  const [splits, setSplits] = useState<SplitFormItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = Math.abs(transaction.amount) / 100; // Convert cents to dollars

  useEffect(() => {
    loadData();
  }, [transaction.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, existingSplits] = await Promise.all([
        window.api.categories.getAll(),
        window.api.splits.getAll(transaction.id),
      ]);
      setCategories(cats);

      if (existingSplits.length > 0) {
        setSplits(existingSplits.map(s => ({
          id: s.id,
          categoryId: s.categoryId || '',
          amount: (Math.abs(s.amount) / 100).toString(), // Convert cents to dollars for display
          description: s.description || '',
        })));
      } else {
        // Initialize with the full amount
        setSplits([{
          categoryId: transaction.categoryId || '',
          amount: totalAmount.toString(),
          description: transaction.description,
        }]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addSplit = () => {
    const remaining = getRemainingAmount();
    setSplits([...splits, {
      categoryId: '',
      amount: remaining > 0 ? remaining.toFixed(2) : '0',
      description: '',
    }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof SplitFormItem, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const getTotalSplitAmount = (): number => {
    return splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  };

  const getRemainingAmount = (): number => {
    return totalAmount - getTotalSplitAmount();
  };

  const handleSave = async () => {
    setError('');

    // Validate
    const remaining = getRemainingAmount();
    if (Math.abs(remaining) > 0.01) {
      setError(`Split amounts must equal transaction total. Remaining: $${remaining.toFixed(2)}`);
      return;
    }

    for (const split of splits) {
      if (!split.categoryId) {
        setError('All splits must have a category');
        return;
      }
      const amount = parseFloat(split.amount);
      if (isNaN(amount) || amount <= 0) {
        setError('All split amounts must be positive numbers');
        return;
      }
    }

    try {
      setLoading(true);

      // Delete existing splits
      await window.api.splits.deleteAll(transaction.id);

      // Create new splits
      const isExpense = transaction.amount < 0;
      for (const split of splits) {
        const amount = parseFloat(split.amount);
        // Convert dollars to cents for storage
        const amountInCents = Math.round(amount * 100);
        await window.api.splits.create({
          parentTransactionId: transaction.id,
          categoryId: split.categoryId,
          amount: isExpense ? -amountInCents : amountInCents,
          description: split.description || null,
        });
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save splits');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAllSplits = async () => {
    if (!confirm('Remove all splits from this transaction?')) return;

    try {
      setLoading(true);
      await window.api.splits.deleteAll(transaction.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error removing splits:', err);
    } finally {
      setLoading(false);
    }
  };

  const remaining = getRemainingAmount();
  const isBalanced = Math.abs(remaining) < 0.01;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Split Transaction</h3>

        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)' }}>
          <div><strong>{transaction.description}</strong></div>
          <div style={{ color: transaction.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            ${totalAmount.toFixed(2)} ({transaction.amount < 0 ? 'Expense' : 'Income'})
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            {new Date(transaction.date).toLocaleDateString()}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          {splits.map((split, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 30px',
                gap: '8px',
                marginBottom: '8px',
                alignItems: 'start',
              }}
            >
              <div>
                <select
                  value={split.categoryId}
                  onChange={(e) => updateSplit(index, 'categoryId', e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', marginBottom: '4px' }}
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={split.description}
                  onChange={(e) => updateSplit(index, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  disabled={loading}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>
              <div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}>$</span>
                  <input
                    type="number"
                    value={split.amount}
                    onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                    disabled={loading}
                    step="0.01"
                    min="0"
                    style={{ width: '100%', paddingLeft: '20px' }}
                  />
                </div>
              </div>
              <button
                onClick={() => removeSplit(index)}
                disabled={splits.length <= 1 || loading}
                style={{
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: splits.length <= 1 ? 'not-allowed' : 'pointer',
                  opacity: splits.length <= 1 ? 0.3 : 1,
                  color: 'var(--color-danger)',
                }}
              >
                X
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={addSplit} className="btn btn-secondary" disabled={loading}>
            + Add Split
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Split total: ${getTotalSplitAmount().toFixed(2)}
            </div>
            <div style={{
              fontWeight: 600,
              color: isBalanced ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {isBalanced ? 'Balanced' : `Remaining: $${remaining.toFixed(2)}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <button
            onClick={handleRemoveAllSplits}
            className="btn btn-outline-danger"
            disabled={loading}
          >
            Remove Splits
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={loading || !isBalanced}
            >
              Save Splits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
