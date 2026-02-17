import { useState, useEffect, useCallback } from 'react';
import type { PaycheckBudgetView, PaycheckAllocation } from '../../shared/types';

type AllocationType = 'recurring_item' | 'budget_category' | 'savings_goal';

interface Target {
  id: string;
  name: string;
}

export default function PaycheckBudgeting() {
  const [views, setViews] = useState<PaycheckBudgetView[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [allocType, setAllocType] = useState<AllocationType>('recurring_item');
  const [targetId, setTargetId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const [recurringItems, setRecurringItems] = useState<Target[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<Target[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<Target[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const budgetViews = await window.api.paycheckAllocations.getBudgetView() as PaycheckBudgetView[];

      setViews(budgetViews);
      if (budgetViews.length > 0 && !selectedStreamId) {
        setSelectedStreamId(budgetViews[0].incomeStream.id);
      }

      const [items, goals] = await Promise.all([
        window.api.recurring.getAll(),
        window.api.savingsGoals.getAll(),
      ]);
      setRecurringItems(items.map((r: { id: string; description: string }) => ({ id: r.id, name: r.description })));
      setSavingsGoals(goals.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));

      const categories = await window.api.categories.getAll();
      const budgetGoals = await window.api.budgetGoals.getAll();
      const budgetCatIds = new Set(budgetGoals.map((bg: { categoryId: string }) => bg.categoryId));
      setBudgetCategories(
        categories
          .filter((c: { id: string }) => budgetCatIds.has(c.id))
          .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedStreamId]);

  useEffect(() => { loadData(); }, []);

  const selectedView = views.find(v => v.incomeStream.id === selectedStreamId);

  const targets = allocType === 'recurring_item' ? recurringItems
    : allocType === 'budget_category' ? budgetCategories
    : savingsGoals;

  const handleAddAllocation = useCallback(async () => {
    if (!selectedView || !targetId || !allocAmount) return;
    setSaving(true);
    try {
      await window.api.paycheckAllocations.create({
        incomeStreamId: selectedView.incomeStream.id,
        incomeDescription: selectedView.incomeStream.description,
        allocationType: allocType,
        targetId,
        amount: Math.round(parseFloat(allocAmount) * 100),
      });
      setShowAddForm(false);
      setAllocAmount('');
      setTargetId('');
      await loadData();
    } catch (err) {
      console.error('Failed to add allocation:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedView, allocType, targetId, allocAmount, loadData]);

  const handleDeleteAllocation = useCallback(async (id: string) => {
    try {
      await window.api.paycheckAllocations.delete(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete allocation:', err);
    }
  }, [loadData]);

  const fmt = (cents: number) => '$' + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const allocationTypeLabel = (type: AllocationType) => {
    switch (type) {
      case 'recurring_item': return 'Bill';
      case 'budget_category': return 'Budget';
      case 'savings_goal': return 'Savings';
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading paycheck data...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Error: {error}</div>;

  if (views.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
        <p>No income streams detected yet.</p>
        <p style={{ fontSize: '13px' }}>Import at least 2-3 months of transactions so Ledgr can identify your paychecks.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Income Stream:</label>
        <select
          value={selectedStreamId ?? ''}
          onChange={e => setSelectedStreamId(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            flex: 1,
            maxWidth: '400px',
          }}
        >
          {views.map(v => (
            <option key={v.incomeStream.id} value={v.incomeStream.id}>
              {v.incomeStream.description} ({fmt(v.incomeStream.averageAmount)} / {v.incomeStream.frequency})
            </option>
          ))}
        </select>
      </div>

      {selectedView && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Allocated: {fmt(selectedView.totalAllocated)} of {fmt(selectedView.incomeStream.averageAmount)}
              </span>
              <span style={{ color: selectedView.unallocated >= 0 ? '#4ade80' : '#f87171' }}>
                {selectedView.unallocated >= 0 ? 'Unallocated' : 'Over-allocated'}: {fmt(Math.abs(selectedView.unallocated))}
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (selectedView.totalAllocated / selectedView.incomeStream.averageAmount) * 100)}%`,
                  background: selectedView.unallocated >= 0 ? '#3b82f6' : '#f87171',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            {selectedView.allocations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                No allocations yet. Add one below.
              </div>
            ) : (
              selectedView.allocations.map((alloc: PaycheckAllocation) => (
                <div
                  key={alloc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{alloc.targetName || alloc.targetId}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {allocationTypeLabel(alloc.allocationType as AllocationType)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{fmt(alloc.amount)}</span>
                    <button
                      onClick={() => handleDeleteAllocation(alloc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px',
                      }}
                      title="Remove allocation"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              + Add Allocation
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select
                    value={allocType}
                    onChange={e => { setAllocType(e.target.value as AllocationType); setTargetId(''); }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  >
                    <option value="recurring_item">Bill</option>
                    <option value="budget_category">Budget Category</option>
                    <option value="savings_goal">Savings Goal</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target</label>
                  <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  >
                    <option value="">Select...</option>
                    {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={allocAmount}
                    onChange={e => setAllocAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAddForm(false); setAllocAmount(''); setTargetId(''); }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAllocation}
                  disabled={saving || !targetId || !allocAmount || parseFloat(allocAmount) <= 0}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    opacity: saving || !targetId || !allocAmount ? 0.5 : 1,
                  }}
                >
                  {saving ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
