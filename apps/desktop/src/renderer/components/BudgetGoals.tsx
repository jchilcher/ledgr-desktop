import React, { useState, useEffect, useMemo } from 'react';
import { BudgetGoal, BudgetPeriod, BudgetMode, Category, BudgetSuggestion, RecurringItem } from '../../shared/types';
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

  // Flex budget state
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('category');
  const [flexTarget, setFlexTarget] = useState(0);
  const [fixedCategoryIds, setFixedCategoryIds] = useState<string[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [editingFlexTarget, setEditingFlexTarget] = useState(false);
  const [flexTargetEditValue, setFlexTargetEditValue] = useState('');
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [pendingFixedIds, setPendingFixedIds] = useState<string[]>([]);

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
      const [allGoals, allCategories, spendingData, incomeResult, savedOverride, savedMode, savedFlexTarget, savedFixedIds, activeRecurring] = await Promise.all([
        window.api.budgetGoals.getAll(),
        window.api.categories.getAll(),
        window.api.analytics.getSpendingByCategory(getStartOfPeriod('monthly').toISOString()),
        window.api.incomeAnalysis.analyze().catch(() => null),
        window.api.budgetIncome.getOverride().catch(() => null),
        window.api.budgetSettings.getMode().catch(() => 'category'),
        window.api.budgetSettings.getFlexTarget().catch(() => 0),
        window.api.budgetSettings.getFixedCategoryIds().catch(() => []),
        window.api.recurring.getActive().catch(() => []),
      ]);
      setGoals(allGoals);
      setCategories(allCategories.filter(c => c.type === 'expense'));
      setBudgetMode(savedMode as BudgetMode);
      setFlexTarget(savedFlexTarget);
      setRecurringItems(activeRecurring.filter((r: RecurringItem) => r.amount < 0 && r.categoryId));

      // Auto-populate fixed category IDs from recurring items if user hasn't manually configured any
      const recurringCategoryIds = [...new Set(
        activeRecurring
          .filter((r: RecurringItem) => r.amount < 0 && r.categoryId)
          .map((r: RecurringItem) => r.categoryId as string)
      )];
      if (savedFixedIds.length === 0 && recurringCategoryIds.length > 0) {
        setFixedCategoryIds(recurringCategoryIds);
      } else {
        setFixedCategoryIds(savedFixedIds);
      }

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

  // Group budget state: track which group cards are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (goalId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  // Build parent-to-children map for group budget support
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const cat of categories) {
      if (cat.parentId) {
        const existing = map.get(cat.parentId) || [];
        existing.push(cat);
        map.set(cat.parentId, existing);
      }
    }
    return map;
  }, [categories]);

  const isParentCategory = (categoryId: string): boolean => {
    return childrenByParent.has(categoryId);
  };

  // Get aggregated spending for a group (parent + all children)
  const getGroupSpentAmount = (parentCategoryId: string): number => {
    const children = childrenByParent.get(parentCategoryId) || [];
    let total = spending.get(parentCategoryId) || 0;
    for (const child of children) {
      total += spending.get(child.id) || 0;
    }
    return total;
  };

  // Smart rollover: calculate per-month info for non-monthly budgets
  const getRolloverInfo = (goal: BudgetGoal) => {
    if (goal.period === 'monthly') return null;

    const now = new Date();

    if (goal.period === 'yearly') {
      const perMonth = goal.amount / 12;
      const monthOfYear = now.getMonth() + 1; // 1-based
      const accumulatedBudget = perMonth * monthOfYear;
      const spent = isParentCategory(goal.categoryId)
        ? getGroupSpentAmount(goal.categoryId)
        : getSpentAmount(goal.categoryId);
      const rollover = accumulatedBudget - spent;
      const availableThisMonth = perMonth + Math.max(rollover - perMonth, 0);

      return {
        perMonth,
        currentPeriodIndex: monthOfYear,
        totalPeriods: 12,
        periodLabel: 'year',
        totalBudget: goal.amount,
        accumulatedBudget,
        spent,
        availableThisMonth,
        rolloverFromPrevious: Math.max(accumulatedBudget - perMonth - (spent > accumulatedBudget - perMonth ? accumulatedBudget - perMonth : spent), 0),
      };
    }

    // Weekly: show per-day info is not useful, skip for weekly
    return null;
  };

  const categoriesWithGoals = new Set(goals.map(g => g.categoryId));
  const availableCategories = categories.filter(c => !categoriesWithGoals.has(c.id));

  // Build category options with hierarchy indicators
  const categoryOptions = useMemo(() => {
    const parentCats = categories.filter(c => !c.parentId);
    const result: Array<{ value: string; label: string; icon?: string }> = [];

    for (const parent of parentCats) {
      const children = childrenByParent.get(parent.id);
      const childCount = children?.length ?? 0;
      result.push({
        value: parent.id,
        label: childCount > 0 ? `${parent.name} (${childCount} subcategories)` : parent.name,
        icon: parent.icon,
      });
      if (children) {
        for (const child of children) {
          result.push({
            value: child.id,
            label: `  ${child.name}`,
            icon: child.icon,
          });
        }
      }
    }

    // Include orphan children (parentId set but parent not in expense categories)
    const parentIds = new Set(parentCats.map(c => c.id));
    for (const cat of categories) {
      if (cat.parentId && !parentIds.has(cat.parentId) && !result.some(r => r.value === cat.id)) {
        result.push({ value: cat.id, label: cat.name, icon: cat.icon });
      }
    }

    return result;
  }, [categories, childrenByParent]);

  const handleModeChange = async (mode: BudgetMode) => {
    setBudgetMode(mode);
    await window.api.budgetSettings.setMode(mode);
  };

  const handleSaveFlexTarget = async (value: string) => {
    const val = parseFloat(value);
    if (!isNaN(val) && val >= 0) {
      const cents = Math.round(val * 100);
      await window.api.budgetSettings.setFlexTarget(cents);
      setFlexTarget(cents);
      setEditingFlexTarget(false);
    }
  };

  const handleSaveFixedCategories = async (ids: string[]) => {
    await window.api.budgetSettings.setFixedCategoryIds(ids);
    setFixedCategoryIds(ids);
    setShowFixedModal(false);
  };

  // Expected monthly amounts from recurring items, grouped by category
  const recurringByCategory = useMemo(() => {
    const map = new Map<string, { expected: number; items: RecurringItem[] }>();
    for (const item of recurringItems) {
      if (!item.categoryId) continue;
      const entry = map.get(item.categoryId) || { expected: 0, items: [] };
      const monthlyAmount = Math.abs(frequencyToMonthly(item.amount, item.frequency));
      entry.expected += Math.round(monthlyAmount);
      entry.items.push(item);
      map.set(item.categoryId, entry);
    }
    return map;
  }, [recurringItems]);

  const fixedCategories = categories.filter(c => fixedCategoryIds.includes(c.id));
  const totalFixedExpected = fixedCategories.reduce((sum, c) => sum + (recurringByCategory.get(c.id)?.expected || 0), 0);
  const totalFixedSpending = fixedCategories.reduce((sum, c) => sum + (spending.get(c.id) || 0), 0);
  const totalFlexSpending = categories
    .filter(c => !fixedCategoryIds.includes(c.id))
    .reduce((sum, c) => sum + (spending.get(c.id) || 0), 0);
  // Use expected amounts from recurring items when available, otherwise fall back to actual spending
  const effectiveFixed = totalFixedExpected > 0 ? totalFixedExpected : totalFixedSpending;
  const flexPercent = flexTarget > 0 ? Math.min((totalFlexSpending / flexTarget) * 100, 100) : 0;
  const flexRemaining = flexTarget - totalFlexSpending;
  const flexRemainingIncome = totalMonthlyIncome - effectiveFixed - flexTarget;

  const renderCard = (goal: BudgetGoal) => {
    const isEditing = inlineEdit.editingId === goal.id;
    const spent = getSpentAmount(goal.categoryId);

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
    const isGroup = isParentCategory(goal.categoryId);
    const childCategories = isGroup ? (childrenByParent.get(goal.categoryId) || []) : [];
    const groupSpent = isGroup ? getGroupSpentAmount(goal.categoryId) : spent;
    const groupPercentage = Math.min((groupSpent / goal.amount) * 100, 100);
    const groupRemaining = goal.amount - groupSpent;
    const isExpanded = expandedGroups.has(goal.id);
    const rolloverInfo = getRolloverInfo(goal);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: '0 0 4px 0' }}>{getCategoryName(goal.categoryId)}</h4>
              {isGroup && (
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontWeight: 500,
                }}>
                  Group
                </span>
              )}
            </div>
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

        {/* Smart Rollover Info for non-monthly budgets */}
        {rolloverInfo && (
          <div style={{
            marginBottom: '8px',
            padding: '6px 10px',
            backgroundColor: 'var(--color-surface-alt)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
          }}>
            {goal.period === 'yearly' && (
              <span>
                Budget: ${(rolloverInfo.totalBudget / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year
                {' \u2022 '}${(rolloverInfo.perMonth / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month
                {' \u2022 '}Month {rolloverInfo.currentPeriodIndex} of {rolloverInfo.totalPeriods}
                {rolloverInfo.rolloverFromPrevious > 0 && (
                  <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                    {' \u2022 '}${(rolloverInfo.availableThisMonth / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available this month
                    {' (includes $'}{(rolloverInfo.rolloverFromPrevious / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} rollover)
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600 }}>
            ${(groupSpent / 100).toFixed(2)} / ${(goal.amount / 100).toFixed(2)}
          </span>
          <span style={{
            fontWeight: 500,
            color: groupRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {groupRemaining >= 0 ? `$${(groupRemaining / 100).toFixed(2)} left` : `$${(Math.abs(groupRemaining) / 100).toFixed(2)} over`}
          </span>
        </div>

        {/* Main progress bar */}
        <div style={{
          height: '8px',
          backgroundColor: 'var(--color-surface-alt)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${groupPercentage}%`,
            backgroundColor: getProgressColor(groupPercentage),
            transition: 'width 0.3s',
          }} />
        </div>

        {/* Rollover accumulation bar for yearly budgets */}
        {rolloverInfo && goal.period === 'yearly' && (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              height: '4px',
              backgroundColor: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min((rolloverInfo.spent / rolloverInfo.accumulatedBudget) * 100, 100)}%`,
                backgroundColor: 'var(--color-primary)',
                opacity: 0.5,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', textAlign: 'right' }}>
              ${(rolloverInfo.spent / 100).toFixed(2)} of ${(rolloverInfo.accumulatedBudget / 100).toFixed(2)} accumulated budget used
            </div>
          </div>
        )}

        {/* Group budget: collapsible child breakdown */}
        {isGroup && childCategories.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => toggleGroup(goal.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-primary)',
                fontSize: '13px',
                padding: '4px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>
                &#9654;
              </span>
              {isExpanded ? 'Hide' : 'Show'} breakdown ({childCategories.length} categories)
            </button>

            {isExpanded && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Parent category's own spending */}
                {(spending.get(goal.categoryId) || 0) > 0 && (
                  <div style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-alt)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px' }}>{getCategoryName(goal.categoryId)} (direct)</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                        ${((spending.get(goal.categoryId) || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ height: '4px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${goal.amount > 0 ? Math.min(((spending.get(goal.categoryId) || 0) / goal.amount) * 100, 100) : 0}%`,
                        backgroundColor: 'var(--color-text-muted)',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}
                {/* Child categories */}
                {childCategories.map(child => {
                  const childSpent = spending.get(child.id) || 0;
                  const childPct = goal.amount > 0 ? Math.min((childSpent / goal.amount) * 100, 100) : 0;
                  return (
                    <div key={child.id} style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-alt)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px' }}>{child.icon || ''} {child.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                          ${(childSpent / 100).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ height: '4px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${childPct}%`,
                          backgroundColor: child.color || 'var(--color-primary)',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => handleModeChange('category')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: budgetMode === 'category' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: budgetMode === 'category' ? '#fff' : 'var(--color-text)',
              }}
            >
              Category Budgets
            </button>
            <button
              onClick={() => handleModeChange('flex')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                cursor: 'pointer',
                backgroundColor: budgetMode === 'flex' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: budgetMode === 'flex' ? '#fff' : 'var(--color-text)',
              }}
            >
              Flex Budget
            </button>
          </div>
          {budgetMode === 'category' && (
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
          )}
        </div>
      </div>

      {/* Fixed Categories Modal */}
      {showFixedModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <h4 style={{ margin: '0 0 16px 0' }}>Manage Fixed Expenses</h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Select categories that are fixed monthly expenses. Categories with recurring items are shown first.
            </p>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
              {[...categories].sort((a, b) => {
                const aHasRecurring = recurringByCategory.has(a.id) ? 1 : 0;
                const bHasRecurring = recurringByCategory.has(b.id) ? 1 : 0;
                return bHasRecurring - aHasRecurring;
              }).map(cat => {
                const recurring = recurringByCategory.get(cat.id);
                return (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pendingFixedIds.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPendingFixedIds([...pendingFixedIds, cat.id]);
                      } else {
                        setPendingFixedIds(pendingFixedIds.filter(id => id !== cat.id));
                      }
                    }}
                  />
                  <span style={{ flex: 1 }}>{cat.icon} {cat.name}</span>
                  {recurring && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {recurring.items.length} recurring &middot; ${(recurring.expected / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo
                    </span>
                  )}
                </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowFixedModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveFixedCategories(pendingFixedIds)}
                className="btn btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {budgetMode === 'flex' ? (
        /* ==================== Flex Budget View ==================== */
        <div>
          {/* Fixed Expenses Section */}
          <div style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Fixed Expenses</h4>
              <button
                onClick={() => {
                  setPendingFixedIds([...fixedCategoryIds]);
                  setShowFixedModal(true);
                }}
                className="btn btn-secondary"
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                Manage
              </button>
            </div>

            {fixedCategories.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', margin: 0 }}>
                No fixed expense categories selected. Click &quot;Manage&quot; to tag categories as fixed.
                {recurringItems.length > 0 && (
                  <> You have recurring items that could be used — click &quot;Manage&quot; to select their categories.</>
                )}
              </p>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)', padding: '0 0 6px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span>Category</span>
                  <span style={{ textAlign: 'right' }}>Expected</span>
                  <span style={{ textAlign: 'right' }}>Spent</span>
                </div>
                {fixedCategories.map(cat => {
                  const catSpent = spending.get(cat.id) || 0;
                  const catExpected = recurringByCategory.get(cat.id)?.expected || 0;
                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <span>{cat.icon} {cat.name}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'right' }}>
                        {catExpected > 0
                          ? `$${(catExpected / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </span>
                      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                        ${(catSpent / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '8px',
                  alignItems: 'center',
                  padding: '10px 0 0 0',
                  fontWeight: 600,
                }}>
                  <span>Total Fixed</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'right' }}>
                    {totalFixedExpected > 0
                      ? `$${(totalFixedExpected / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    ${(totalFixedSpending / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Flex Budget Bar */}
          <div style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Flex Budget</h4>
              {editingFlexTarget ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600 }}>$</span>
                  <input
                    type="text"
                    value={flexTargetEditValue}
                    onChange={(e) => setFlexTargetEditValue(e.target.value)}
                    autoFocus
                    style={{
                      width: '120px',
                      fontSize: '14px',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      textAlign: 'right',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFlexTarget(flexTargetEditValue);
                      if (e.key === 'Escape') setEditingFlexTarget(false);
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => handleSaveFlexTarget(flexTargetEditValue)}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => setEditingFlexTarget(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 600 }}>
                    Target: ${(flexTarget / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => {
                      setFlexTargetEditValue((flexTarget / 100).toFixed(2));
                      setEditingFlexTarget(true);
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
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600 }}>
                Spent ${(totalFlexSpending / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of ${(flexTarget / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} flex budget
              </span>
              <span style={{
                fontWeight: 500,
                color: flexRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {flexTarget > 0
                  ? `${flexPercent.toFixed(0)}%`
                  : 'Set a target'}
              </span>
            </div>

            <div style={{
              height: '12px',
              backgroundColor: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${flexPercent}%`,
                backgroundColor: flexPercent >= 100
                  ? 'var(--color-danger)'
                  : flexPercent >= 80
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
                transition: 'width 0.3s',
              }} />
            </div>

            <div style={{
              marginTop: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: flexRemaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              textAlign: 'right',
            }}>
              {flexRemaining >= 0
                ? `$${(flexRemaining / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining`
                : `$${(Math.abs(flexRemaining) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over budget`}
            </div>
          </div>

          {/* Remaining Summary */}
          {totalMonthlyIncome > 0 && (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Monthly Summary</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Income</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    ${(totalMonthlyIncome / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Fixed</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    ${(effectiveFixed / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Flex Target</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>
                    ${(flexTarget / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Remaining</div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: flexRemainingIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  }}>
                    {flexRemainingIncome >= 0 ? '' : '-'}${(Math.abs(flexRemainingIncome) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Three-bucket bar */}
              {totalMonthlyIncome > 0 && (
                <div>
                  <div style={{
                    height: '8px',
                    backgroundColor: 'var(--color-surface-alt)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                    display: 'flex',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((effectiveFixed / totalMonthlyIncome) * 100, 100)}%`,
                      backgroundColor: 'var(--color-primary)',
                    }} />
                    <div style={{
                      height: '100%',
                      width: `${Math.min((flexTarget / totalMonthlyIncome) * 100, 100 - Math.min((effectiveFixed / totalMonthlyIncome) * 100, 100))}%`,
                      backgroundColor: 'var(--color-warning)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'inline-block' }} />
                      Fixed ({totalMonthlyIncome > 0 ? ((effectiveFixed / totalMonthlyIncome) * 100).toFixed(0) : 0}%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block' }} />
                      Flex ({totalMonthlyIncome > 0 ? ((flexTarget / totalMonthlyIncome) * 100).toFixed(0) : 0}%)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                      Remaining ({totalMonthlyIncome > 0 ? (Math.max(flexRemainingIncome, 0) / totalMonthlyIncome * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      /* ==================== Category Budget View (existing) ==================== */
      <div>

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
                {(() => {
                  const parentCats = availableCategories.filter(c => !c.parentId);
                  const opts: React.ReactNode[] = [];
                  for (const parent of parentCats) {
                    const children = childrenByParent.get(parent.id);
                    const childCount = children?.filter(ch => availableCategories.some(ac => ac.id === ch.id)).length ?? 0;
                    opts.push(
                      <option key={parent.id} value={parent.id}>
                        {parent.icon} {parent.name}{childCount > 0 ? ` (${childCount} subcategories)` : ''}
                      </option>
                    );
                    if (children) {
                      for (const child of children) {
                        if (availableCategories.some(ac => ac.id === child.id)) {
                          opts.push(
                            <option key={child.id} value={child.id}>
                              {'  '}{child.icon} {child.name}
                            </option>
                          );
                        }
                      }
                    }
                  }
                  // Orphan children
                  const parentIds = new Set(parentCats.map(c => c.id));
                  for (const cat of availableCategories) {
                    if (cat.parentId && !parentIds.has(cat.parentId) && !opts.some((o) => React.isValidElement(o) && o.key === cat.id)) {
                      opts.push(
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      );
                    }
                  }
                  return opts;
                })()}
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
      )}
    </div>
  );
}
