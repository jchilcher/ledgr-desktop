import { useState, useEffect } from 'react';
import { Transaction, TransactionReimbursement } from '../../shared/types';

interface ReimbursementModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

interface CandidateRow {
  transaction: Transaction;
  selected: boolean;
  amount: string; // dollars for display
}

export default function ReimbursementModal({ transaction, onClose, onSave }: ReimbursementModalProps) {
  const [existingLinks, setExistingLinks] = useState<TransactionReimbursement[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [allCandidates, setAllCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const originalAmount = Math.abs(transaction.amount); // cents

  useEffect(() => {
    loadData();
  }, [transaction.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setCandidates(allCandidates);
    } else {
      const q = searchQuery.toLowerCase();
      setCandidates(allCandidates.filter(c =>
        c.transaction.description.toLowerCase().includes(q)
      ));
    }
  }, [searchQuery, allCandidates]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [links, candidateTxns] = await Promise.all([
        window.api.reimbursements.getForExpense(transaction.id),
        window.api.reimbursements.getCandidates(transaction.id),
      ]);
      setExistingLinks(links);

      const totalLinked = links.reduce((sum, l) => sum + l.amount, 0);
      const remaining = originalAmount - totalLinked;

      const rows: CandidateRow[] = candidateTxns.map(tx => ({
        transaction: tx,
        selected: false,
        amount: (Math.min(tx.amount, remaining) / 100).toFixed(2),
      }));
      setAllCandidates(rows);
    } catch (err) {
      console.error('Error loading reimbursement data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const totalLinked = existingLinks.reduce((sum, l) => sum + l.amount, 0);
  const selectedTotal = candidates
    .filter(c => c.selected)
    .reduce((sum, c) => sum + Math.round((parseFloat(c.amount) || 0) * 100), 0);
  const grandTotal = totalLinked + selectedTotal;
  const remaining = originalAmount - grandTotal;

  const toggleCandidate = (index: number) => {
    const updated = [...candidates];
    const c = updated[index];
    c.selected = !c.selected;
    if (c.selected) {
      // Default amount: min of income amount or remaining
      const availableRemaining = originalAmount - totalLinked -
        candidates.filter((cc, i) => cc.selected && i !== index)
          .reduce((sum, cc) => sum + Math.round((parseFloat(cc.amount) || 0) * 100), 0);
      c.amount = (Math.min(c.transaction.amount, Math.max(0, availableRemaining)) / 100).toFixed(2);
    }
    setCandidates(updated);
  };

  const updateCandidateAmount = (index: number, value: string) => {
    const updated = [...candidates];
    updated[index] = { ...updated[index], amount: value };
    setCandidates(updated);
  };

  const handleRemoveLink = async (linkId: string) => {
    try {
      setSaving(true);
      await window.api.reimbursements.delete(linkId);
      await loadData();
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError('');

    const toLink = candidates.filter(c => c.selected);
    if (toLink.length === 0) {
      setError('Select at least one income transaction to link');
      return;
    }

    // Validate amounts
    for (const c of toLink) {
      const amt = parseFloat(c.amount);
      if (isNaN(amt) || amt <= 0) {
        setError('All amounts must be positive numbers');
        return;
      }
    }

    if (grandTotal > originalAmount) {
      setError('Total reimbursements cannot exceed the expense amount');
      return;
    }

    try {
      setSaving(true);
      for (const c of toLink) {
        const amountCents = Math.round(parseFloat(c.amount) * 100);
        await window.api.reimbursements.create({
          expenseTransactionId: transaction.id,
          reimbursementTransactionId: c.transaction.id,
          amount: amountCents,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create links');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const progressPercent = Math.min(100, (grandTotal / originalAmount) * 100);

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
          maxWidth: '700px',
          width: '90%',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Link Reimbursements</h3>

        {/* Expense summary */}
        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)' }}>
          <div><strong>{transaction.description}</strong></div>
          <div style={{ color: 'var(--color-danger)', fontSize: '15px' }}>
            {formatCurrency(originalAmount)} expense
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            {formatDate(transaction.date)}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
            <span>Reimbursed: {formatCurrency(grandTotal)}</span>
            <span>Remaining: {formatCurrency(Math.max(0, remaining))}</span>
          </div>
          <div style={{
            height: '8px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: progressPercent >= 100 ? 'var(--color-success)' : 'var(--color-warning)',
              borderRadius: '4px',
              transition: 'width 0.2s',
            }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '13px', fontWeight: 600, color: progressPercent >= 100 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            Net expense: {formatCurrency(Math.max(0, remaining))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* Existing links */}
        {existingLinks.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '8px' }}>Linked Reimbursements</h4>
            {existingLinks.map(link => (
              <div key={link.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '4px',
              }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(link.amount)}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginLeft: '8px' }}>
                    (ID: ...{link.reimbursementTransactionId.slice(-6)})
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveLink(link.id)}
                  className="btn btn-outline-danger"
                  style={{ padding: '2px 8px', fontSize: '12px' }}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Candidate income transactions */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px' }}>Available Income Transactions</h4>
          <input
            type="text"
            placeholder="Search by description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
              Loading...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
              No available income transactions found
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {candidates.map((c, index) => (
                <div key={c.transaction.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr 100px 80px',
                  gap: '8px',
                  alignItems: 'center',
                  padding: '8px',
                  backgroundColor: c.selected ? 'var(--color-surface-alt)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '2px',
                }}>
                  <input
                    type="checkbox"
                    checked={c.selected}
                    onChange={() => toggleCandidate(candidates.indexOf(c))}
                    disabled={saving}
                  />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{c.transaction.description}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                      {formatDate(c.transaction.date)} &middot; {formatCurrency(c.transaction.amount)}
                    </div>
                  </div>
                  <div style={{ color: 'var(--color-success)', fontWeight: 500, textAlign: 'right' }}>
                    {formatCurrency(c.transaction.amount)}
                  </div>
                  <div>
                    {c.selected && (
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>$</span>
                        <input
                          type="number"
                          value={c.amount}
                          onChange={(e) => updateCandidateAmount(index, e.target.value)}
                          step="0.01"
                          min="0.01"
                          max={(c.transaction.amount / 100).toFixed(2)}
                          style={{ width: '100%', paddingLeft: '18px', fontSize: '13px' }}
                          disabled={saving}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving || candidates.filter(c => c.selected).length === 0 || grandTotal > originalAmount}
          >
            {saving ? 'Saving...' : 'Link Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
