import React, { useState, useEffect } from 'react';
import { BudgetGoal, BudgetPeriod, Category, BudgetSuggestion } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableNumber, EditableSelect, EditableCheckbox } from './inline-edit';
import EmptyState from './EmptyState';

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

interface EditFormData {
  id: string;
  categoryId: string;
  amount: string;
  period: BudgetPeriod;
  rolloverEnabled: boolean;
}

export default function BudgetGoals() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spending, setSpending] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<string, BudgetSuggestion>>(new Map());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0);
  const [incomeStreams, setIncomeStreams] = useState<Array<{
    description: string;
    averageAmount: number;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
    reliabilityScore: number;
  }>>([]);
  const [incomeOverride, setIncomeOverride] = useState<number | null>(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeEditValue, setIncomeEditValue] = useState('');

  // Form state for Add New
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPeriod, setFormPeriod] = useState<BudgetPeriod>('monthly');
  const [formRollover, setFormRollover] = useState(false);
  const [error, setError] = useState('');

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      const amount = parseFloat(data.amount || '0');
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      await window.api.budgetGoals.update(id, {
        categoryId: data.categoryId,
        amount: Math.round(amount * 100),
        period: data.period,
        rolloverEnabled: data.rolloverEnabled,
      });
      await loadData();
    },
    validateField: (field, value) => {
      if (field === 'categoryId' && !value) {
        return 'Required';
      }
      if (field === 'amount') {
        const num = parseFloat(value as string);
        if (isNaN(num) || num <= 0) {
          return 'Enter valid amount';
        }
      }
      return null;
    },
  });

  useEffect(() => {
    loadData();
    loadSuggestions();
  }, []);

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Biweekly';
      case 'monthly': return 'Monthly';
      case 'irregular': return 'Irregular';
      default: return freq;
    }
  };

  const frequencyToMonthly = (amount: number, freq: string) => {
    switch (freq) {
      case 'weekly': return amount * 4.33;
      case 'biweekly': return amount * 2.17;
      case 'monthly': return amount;
      case 'irregular': return amount;
      default: return amount;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [allGoals, allCategories, spendingData, incomeResult, savedOverride] = await Promise.all([
        window.api.budgetGoals.getAll(),
        window.api.categories.getAll(),
        window.api.analytics.getSpendingByCategory(getStartOfPeriod('monthly').toISOString()),
        window.api.incomeAnalysis.analyze().catch(() => null),
        window.api.budgetIncome.getOverride().catch(() => null),
      ]);
      setGoals(allGoals);
      setCategories(allCategories.filter(c => c.type === 'expense'));

      const autoIncome = incomeResult?.summary?.totalMonthlyIncome ?? 0;
      setIncomeStreams(incomeResult?.streams ?? []);
      setIncomeOverride(savedOverride);
      setTotalMonthlyIncome(savedOverride !== null ? savedOverride : autoIncome);

      const spendMap = new Map<string, number>();
      for (const s of spendingData) {
        spendMap.set(s.categoryId, s.total);
      }
      setSpending(spendMap);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const allSuggestions = await window.api.budgetSuggestions.getAll();
      const suggestionMap = new Map<string, BudgetSuggestion>();
      for (const suggestion of allSuggestions) {
        suggestionMap.set(suggestion.categoryId, suggestion);
      }
      setSuggestions(suggestionMap);
    } catch (err) {
      console.error('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const applySuggestion = async (suggestion: BudgetSuggestion) => {
    try {
      setLoading(true);
      await window.api.budgetSuggestions.apply(suggestion);
      await loadData();
      await loadSuggestions();
    } catch (err) {
      console.error('Error applying suggestion:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStartOfPeriod = (period: BudgetPeriod): Date => {
    const now = new Date();
    switch (period) {
      case 'weekly': {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek;
      }
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formCategoryId) {
      setError('Please select a category');
      return;
    }

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid budget amount');
      return;
    }

    try {
      setLoading(true);
      await window.api.budgetGoals.create({
        categoryId: formCategoryId,
        amount: Math.round(amount * 100),
        period: formPeriod,
        rolloverEnabled: formRollover,
        rolloverAmount: 0,
        startDate: new Date(),
      });
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInlineEdit = (goal: BudgetGoal) => {
    if (showForm) {
      setShowForm(false);
    }

    inlineEdit.startEdit(goal.id, {
      id: goal.id,
      categoryId: goal.categoryId,
      amount: (goal.amount / 100).toString(),
      period: goal.period,
      rolloverEnabled: goal.rolloverEnabled,
    });
  };

  const handleDelete = async (goal: BudgetGoal) => {
    const category = categories.find(c => c.id === goal.categoryId);
    if (!confirm(`Delete budget goal for "${category?.name || 'Unknown'}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await window.api.budgetGoals.delete(goal.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting goal:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormCategoryId('');
    setFormAmount('');
    setFormPeriod('monthly');
    setFormRollover(false);
    setError('');
  };

  const getCategoryName = (categoryId: string): string => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon || ''} ${cat.name}` : 'Unknown';
  };

  const getSpentAmount = (categoryId: string): number => {
    return spending.get(categoryId) || 0;
  };

  const getProgressPercentage = (goal: BudgetGoal): number => {
    const spent = getSpentAmount(goal.categoryId);
    return Math.min((spent / goal.amount) * 100, 100);
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'var(--color-danger)';
    if (percentage >= 80) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getTotalBudgetedMonthly = (): number => {
    return goals.reduce((sum, goal) => {
      switch (goal.period) {
        case 'weekly': return sum + goal.amount * (52 / 12);
        case 'yearly': return sum + goal.amount / 12;
        default: return sum + goal.amount;
      }
    }, 0);
  };

  const totalBudgeted = getTotalBudgetedMonthly();
  const remainingIncome = totalMonthlyIncome - totalBudgeted;
  const allocationPercent = totalMonthlyIncome > 0
    ? Math.min((totalBudgeted / totalMonthlyIncome) * 100, 100)
    : 0;
  const allocationColor = allocationPercent >= 100
    ? 'var(--color-danger)'
    : allocationPercent >= 80
      ? 'var(--color-warning)'
      : 'var(--color-success)';

  const categoriesWithGoals = new Set(goals.map(g => g.categoryId));
  const availableCategories = categories.filter(c => !categoriesWithGoals.has(c.id));

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
    icon: cat.icon,
  }));

  const renderCard = (goal: BudgetGoal) => {
    const isEditing = inlineEdit.editingId === goal.id;
    const spent = getSpentAmount(goal.categoryId);
    const percentage = getProgressPercentage(goal);
    const remaining = goal.amount - spent;

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;
      // For editing, allow the current category plus any available ones
      const editCategoryOptions = categoryOptions.filter(
        opt => opt.value === goal.categoryId || !categoriesWithGoals.has(opt.value)
      );

      return (
        <div
          key={goal.id}
          className="inline-edit-card"
          style={{
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
          }}
          onKeyDown={inlineEdit.handleKeyDown}
        >
          <div className="inline-edit-grid">
            {/* Row 1: Category */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Category</span>
              <div className="inline-edit-grid-value">
                <EditableSelect
                  value={editData.categoryId || ''}
                  isEditing={true}
                  options={editCategoryOptions}
                  onChange={(v) => inlineEdit.updateField('categoryId', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.categoryId}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 2: Amount & Period */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Budget</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                <EditableNumber
                  value={editData.amount || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('amount', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.amount}
                  prefix="$"
                  step={0.01}
                  min={0}
                  disabled={inlineEdit.isSubmitting}
                />
                <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                <EditableSelect
                  value={editData.period || 'monthly'}
                  isEditing={true}
                  options={PERIOD_OPTIONS}
                  onChange={(v) => inlineEdit.updateField('period', v as BudgetPeriod)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 3: Rollover */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Options</span>
              <div className="inline-edit-grid-value">
                <EditableCheckbox
                  value={editData.rolloverEnabled || false}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('rolloverEnabled', v)}
                  label="Rollover unused budget"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Form error */}
            {inlineEdit.errors._form && (
              <div className="inline-edit-error" style={{ gridColumn: '1 / -1' }}>
                {inlineEdit.errors._form}
              </div>
            )}

            {/* Actions */}
            <div className="inline-edit-actions">
              <button
                type="button"
                onClick={() => inlineEdit.saveEdit()}
                className="btn btn-success"
                disabled={inlineEdit.isSubmitting}
              >
                {inlineEdit.isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={inlineEdit.cancelEdit}
                className="btn btn-secondary"
                disabled={inlineEdit.isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // View mode
    return (
      <div
        key={goal.id}
        style={{
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0' }}>{getCategoryName(goal.categoryId)}</h4>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {goal.period.charAt(0).toUpperCase() + goal.period.slice(1)} budget
              {goal.rolloverEnabled && ' (Rollover enabled)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleStartInlineEdit(goal)}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(goal)}
              className="btn btn-outline-danger"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Delete
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600 }}>
            ${(spent / 100).toFixed(2)} / ${(goal.amount / 100).toFixed(2)}
          </span>
          <span style={{
            fontWeight: 500,
            color: remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {remaining >= 0 ? `$${(remaining / 100).toFixed(2)} left` : `$${(Math.abs(remaining) / 100).toFixed(2)} over`}
          </span>
        </div>

        <div style={{
          height: '8px',
          backgroundColor: 'var(--color-surface-alt)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: getProgressColor(percentage),
            transition: 'width 0.3s',
          }} />
        </div>

        {/* Budget Adjustment Suggestion */}
        {suggestions.has(goal.categoryId) && suggestions.get(goal.categoryId)!.type !== 'new_budget' && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: suggestions.get(goal.categoryId)!.type === 'increase'
              ? 'var(--color-warning-bg, rgba(245, 158, 11, 0.1))'
              : 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            <span>
              {suggestions.get(goal.categoryId)!.type === 'increase' ? 'Consider: ' : 'Could reduce to: '}
              <strong>${(suggestions.get(goal.categoryId)!.suggestedAmount / 100).toFixed(2)}</strong>
              /{goal.period}
            </span>
            <span
              style={{ color: 'var(--color-text-muted)', fontSize: '12px', cursor: 'help' }}
              title={suggestions.get(goal.categoryId)!.explanation}
            >
              ({suggestions.get(goal.categoryId)!.confidence}% confident)
            </span>
            <button
              onClick={() => applySuggestion(suggestions.get(goal.categoryId)!)}
              className="btn btn-sm"
              style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '12px' }}
              disabled={loading}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="budget-goals">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Budget Goals</h3>
        <button
          onClick={() => {
            inlineEdit.cancelEdit();
            setShowForm(!showForm);
          }}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Budget'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
          {error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <option value="">Select category...</option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Budget Amount</label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={loading}
                style={{ width: '100%' }}
              />
              {formCategoryId && suggestions.has(formCategoryId) && suggestions.get(formCategoryId)?.type === 'new_budget' && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-info-bg, rgba(59, 130, 246, 0.1))',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  <span>
                    Suggested: <strong>${(suggestions.get(formCategoryId)!.suggestedAmount / 100).toFixed(2)}</strong>/month
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    ({suggestions.get(formCategoryId)!.confidence}% confident)
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormAmount((suggestions.get(formCategoryId)!.suggestedAmount / 100).toFixed(2))}
                    className="btn btn-sm"
                    style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '12px' }}
                  >
                    Use
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Period</label>
              <select
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value as BudgetPeriod)}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formRollover}
                onChange={(e) => setFormRollover(e.target.checked)}
                disabled={loading}
              />
              <span>Rollover unused budget to next period</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create Budget
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {totalMonthlyIncome > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Monthly Income
              </div>
              {editingIncome ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 600 }}>$</span>
                  <input
                    type="text"
                    value={incomeEditValue}
                    onChange={(e) => setIncomeEditValue(e.target.value)}
                    autoFocus
                    style={{
                      width: '120px',
                      fontSize: '16px',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      textAlign: 'right',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(incomeEditValue);
                        if (!isNaN(val) && val > 0) {
                          const cents = Math.round(val * 100);
                          window.api.budgetIncome.setOverride(cents).then(() => {
                            setIncomeOverride(cents);
                            setTotalMonthlyIncome(cents);
                            setEditingIncome(false);
                          });
                        }
                      } else if (e.key === 'Escape') {
                        setEditingIncome(false);
                      }
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => {
                      const val = parseFloat(incomeEditValue);
                      if (!isNaN(val) && val > 0) {
                        const cents = Math.round(val * 100);
                        window.api.budgetIncome.setOverride(cents).then(() => {
                          setIncomeOverride(cents);
                          setTotalMonthlyIncome(cents);
                          setEditingIncome(false);
                        });
                      }
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => setEditingIncome(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 600 }}>
                    ${(totalMonthlyIncome / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => {
                      setIncomeEditValue((totalMonthlyIncome / 100).toFixed(2));
                      setEditingIncome(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    title="Manually set monthly income"
                  >
                    Edit
                  </button>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {incomeOverride !== null ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Manual override
                    {!editingIncome && (
                      <button
                        onClick={() => {
                          window.api.budgetIncome.setOverride(null).then(() => {
                            setIncomeOverride(null);
                            // Recalculate from streams
                            let autoTotal = 0;
                            for (const s of incomeStreams) {
                              autoTotal += frequencyToMonthly(s.averageAmount, s.frequency);
                            }
                            setTotalMonthlyIncome(Math.round(autoTotal));
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Reset to auto-detect
                      </button>
                    )}
                  </span>
                ) : (
                  'Auto-detected from transactions'
                )}
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Budgeted
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                ${(totalBudgeted / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Unbudgeted
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                color: remainingIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {remainingIncome >= 0 ? '' : '-'}${(Math.abs(remainingIncome) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Income Sources Breakdown */}
          {incomeStreams.length > 0 && (
            <div style={{
              marginBottom: '12px',
              padding: '10px 12px',
              backgroundColor: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
            }}>
              <div style={{ fontWeight: 500, marginBottom: '6px', color: 'var(--color-text-muted)' }}>
                Income Sources
              </div>
              {incomeStreams.map((stream, i) => {
                const monthlyAmount = frequencyToMonthly(stream.averageAmount, stream.frequency);
                return (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '3px 0',
                    borderBottom: i < incomeStreams.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <span style={{ flex: 1 }}>{stream.description}</span>
                    <span style={{ color: 'var(--color-text-muted)', margin: '0 12px', fontSize: '12px' }}>
                      {frequencyLabel(stream.frequency)}
                    </span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      ${(monthlyAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            height: '6px',
            backgroundColor: 'var(--color-surface-alt)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${allocationPercent}%`,
              backgroundColor: allocationColor,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', textAlign: 'right' }}>
            {allocationPercent.toFixed(0)}% of income allocated
          </div>
        </div>
      )}

      {loading && goals.length === 0 ? (
        <p>Loading budgets...</p>
      ) : goals.length === 0 ? (
        <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>
          <EmptyState
            icon="💰"
            title="No budget goals set yet"
            description="Set spending limits by category to stay on track each month."
            action={{ label: 'Create Budget', onClick: () => setShowForm(true) }}
          />

          {/* Quick Setup Section */}
          {!loadingSuggestions && suggestions.size > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '12px', color: 'var(--color-text)', textAlign: 'center' }}>
                Quick Setup - Based on Your Spending
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from(suggestions.values())
                  .filter(s => s.type === 'new_budget')
                  .slice(0, 5)
                  .map(suggestion => (
                    <div
                      key={suggestion.categoryId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                          {suggestion.categoryName}
                        </span>
                        <span style={{ marginLeft: '8px', color: 'var(--color-text-muted)' }}>
                          ${(suggestion.suggestedAmount / 100).toFixed(2)}/month
                        </span>
                      </div>
                      <button
                        onClick={() => applySuggestion(suggestion)}
                        className="btn btn-primary btn-sm"
                        disabled={loading}
                        style={{ padding: '4px 12px', fontSize: '13px' }}
                      >
                        Add Budget
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {goals.map(renderCard)}
        </div>
      )}
    </div>
  );
}
