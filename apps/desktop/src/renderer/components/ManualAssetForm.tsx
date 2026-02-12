import React, { useState } from 'react';
import type { ManualAsset, ManualAssetCategory, AssetLiquidity } from '../../shared/types';

interface ManualAssetFormProps {
  asset?: ManualAsset;
  onSubmit: (asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES: { value: ManualAssetCategory; label: string }[] = [
  { value: 'property', label: 'Property' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'valuables', label: 'Valuables' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom...' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'No reminders' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export function ManualAssetForm({ asset, onSubmit, onCancel }: ManualAssetFormProps) {
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState<ManualAssetCategory>(asset?.category ?? 'other');
  const [customCategory, setCustomCategory] = useState(asset?.customCategory ?? '');
  const [value, setValue] = useState(asset ? (asset.value / 100).toString() : '');
  const [liquidity, setLiquidity] = useState<AssetLiquidity>(asset?.liquidity ?? 'illiquid');
  const [reminderFrequency, setReminderFrequency] = useState(asset?.reminderFrequency ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!value || isNaN(Number(value))) {
      setError('Valid value is required');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        category,
        customCategory: category === 'custom' ? customCategory : null,
        value: Math.round(Number(value) * 100), // Convert to cents
        liquidity,
        reminderFrequency: (reminderFrequency || null) as 'monthly' | 'quarterly' | 'yearly' | null,
        notes: notes.trim() || null,
        lastReminderDate: null,
        nextReminderDate: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Home, Car, Art Collection"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: category === 'custom' ? '1fr 1fr' : '1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Category
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ManualAssetCategory)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        {category === 'custom' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
              Custom Category
            </label>
            <input
              type="text"
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Value ($)
          </label>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            step="0.01"
            min="0"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Liquidity
          </label>
          <select
            value={liquidity}
            onChange={e => setLiquidity(e.target.value as AssetLiquidity)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          >
            <option value="liquid">Liquid (cash, stocks)</option>
            <option value="illiquid">Illiquid (property, vehicles)</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Value Update Reminders
        </label>
        <select
          value={reminderFrequency}
          onChange={e => setReminderFrequency(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
        >
          {REMINDER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          style={{ padding: '8px 16px' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '8px 16px' }}
        >
          {loading ? 'Saving...' : asset ? 'Update Asset' : 'Add Asset'}
        </button>
      </div>
    </form>
  );
}

export default ManualAssetForm;
