import React, { useState } from 'react';
import type { ManualLiability, ManualLiabilityType } from '../../shared/types';

interface ManualLiabilityFormProps {
  liability?: ManualLiability;
  onSubmit: (liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<void>;
  onCancel: () => void;
}

const LIABILITY_TYPES: { value: ManualLiabilityType; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto_loan', label: 'Auto Loan' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'other', label: 'Other' },
];

export function ManualLiabilityForm({ liability, onSubmit, onCancel }: ManualLiabilityFormProps) {
  const [name, setName] = useState(liability?.name ?? '');
  const [type, setType] = useState<ManualLiabilityType>(liability?.type ?? 'other');
  const [balance, setBalance] = useState(liability ? (liability.balance / 100).toString() : '');
  const [interestRate, setInterestRate] = useState(
    liability ? (liability.interestRate * 100).toString() : ''
  );
  const [monthlyPayment, setMonthlyPayment] = useState(
    liability ? (liability.monthlyPayment / 100).toString() : ''
  );
  const [originalAmount, setOriginalAmount] = useState(
    liability?.originalAmount ? (liability.originalAmount / 100).toString() : ''
  );
  const [termMonths, setTermMonths] = useState(liability?.termMonths?.toString() ?? '');
  const [notes, setNotes] = useState(liability?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!balance || isNaN(Number(balance))) {
      setError('Valid balance is required');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: name.trim(),
        type,
        balance: Math.round(Number(balance) * 100),
        interestRate: Number(interestRate) / 100 || 0,
        monthlyPayment: Math.round(Number(monthlyPayment) * 100) || 0,
        originalAmount: originalAmount ? Math.round(Number(originalAmount) * 100) : null,
        startDate: null, // Could add date picker
        termMonths: termMonths ? Number(termMonths) : null,
        payoffDate: null, // Calculated
        totalInterest: null, // Calculated
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save liability');
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
          placeholder="e.g., Home Mortgage, Car Loan"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Type
          </label>
          <select
            value={type}
            onChange={e => setType(e.target.value as ManualLiabilityType)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          >
            {LIABILITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Current Balance ($)
          </label>
          <input
            type="number"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            step="0.01"
            min="0"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Interest Rate (%)
          </label>
          <input
            type="number"
            value={interestRate}
            onChange={e => setInterestRate(e.target.value)}
            step="0.01"
            min="0"
            placeholder="e.g., 6.5"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Monthly Payment ($)
          </label>
          <input
            type="number"
            value={monthlyPayment}
            onChange={e => setMonthlyPayment(e.target.value)}
            step="0.01"
            min="0"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
            Term (months)
          </label>
          <input
            type="number"
            value={termMonths}
            onChange={e => setTermMonths(e.target.value)}
            min="0"
            placeholder="e.g., 360"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>
          Original Loan Amount ($) <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
        </label>
        <input
          type="number"
          value={originalAmount}
          onChange={e => setOriginalAmount(e.target.value)}
          step="0.01"
          min="0"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
        />
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
          {loading ? 'Saving...' : liability ? 'Update Liability' : 'Add Liability'}
        </button>
      </div>
    </form>
  );
}

export default ManualLiabilityForm;
