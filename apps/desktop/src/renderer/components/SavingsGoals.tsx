import React, { useState, useEffect } from 'react';
import { SavingsGoal, SavingsContribution, Account, SavingsGrowthPoint, SavingsMonthlyContribution, UserAuthStatus, EncryptableEntityType } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableNumber, EditableDate, EditableSelect } from './inline-edit';
import EmptyState from './EmptyState';
import OwnershipSelector from './OwnershipSelector';
import ShareDialog from './ShareDialog';
import { useHousehold } from '../contexts/HouseholdContext';

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

const ICONS = ['Target', 'Home', 'Car', 'Plane', 'Gift', 'Heart', 'Star', 'Piggy'];

interface EditFormData {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  accountId: string;
  icon: string;
  color: string;
  ownerId: string;
}

export default function SavingsGoals() {
  const { currentUserId, householdFilter, filterByOwnership } = useHousehold();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);
  const [showContributionForm, setShowContributionForm] = useState(false);
  const [growthData, setGrowthData] = useState<SavingsGrowthPoint[]>([]);
  const [monthlyData, setMonthlyData] = useState<SavingsMonthlyContribution[]>([]);
  const [reportTab, setReportTab] = useState<'contributions' | 'growth' | 'monthly' | 'projection'>('contributions');

  // Form state for Add New
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formIcon, setFormIcon] = useState(ICONS[0]);
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);
  const [formOwnerId, setFormOwnerId] = useState<string | null>(currentUserId);

  // Contribution form
  const [contributionAmount, setContributionAmount] = useState('');

  // Projection data
  const [projection, setProjection] = useState<{
    projectedCompletionDate: Date | null;
    requiredMonthlyToHitTarget: number | null;
    onTrack: boolean;
    scenarios: Array<{
      type: string;
      label: string;
      monthlyContribution: number;
      projectedCompletionDate: Date | null;
      monthsToCompletion: number | null;
      onTrack: boolean;
    }>;
  } | null>(null);

  const [error, setError] = useState('');
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      const target = parseFloat(data.targetAmount || '0');
      if (isNaN(target) || target <= 0) {
        throw new Error('Please enter a valid target amount');
      }

      // Find the original goal to detect accountId changes
      const originalGoal = goals.find(g => g.id === id);
      const newAccountId = data.accountId || null;
      const oldAccountId = originalGoal?.accountId || null;

      // Handle pin/unpin through dedicated API
      if (newAccountId !== oldAccountId) {
        if (newAccountId) {
          await window.api.savingsGoals.pinAccount(id, newAccountId);
        } else {
          await window.api.savingsGoals.unpinAccount(id);
        }
      }

      // Update other fields (excluding accountId since pin/unpin handles it)
      await window.api.savingsGoals.update(id, {
        name: data.name?.trim(),
        targetAmount: Math.round(target * 100),
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        icon: data.icon,
        color: data.color,
        ownerId: data.ownerId || null,
      });
      await loadData();
    },
    validateField: (field, value) => {
      if (field === 'name' && (!value || !(value as string).trim())) {
        return 'Name is required';
      }
      if (field === 'targetAmount') {
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
  }, [householdFilter]);

  useEffect(() => {
    if (selectedGoal) {
      loadContributions(selectedGoal.id);
      loadReportData(selectedGoal.id);
    }
  }, [selectedGoal]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allGoals, allAccounts, authStatuses] = await Promise.all([
        window.api.savingsGoals.getAll(),
        window.api.accounts.getAll(),
        window.api.security.getMemberAuthStatus().catch(() => [] as UserAuthStatus[]),
      ]);
      const visibleGoals = filterByOwnership(allGoals);
      setGoals(visibleGoals);
      setAccounts(allAccounts);
      setMemberAuthStatus(authStatuses);

      // Refresh selectedGoal if it exists
      if (selectedGoal) {
        const updated = visibleGoals.find(g => g.id === selectedGoal.id);
        if (updated) setSelectedGoal(updated);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContributions = async (goalId: string) => {
    try {
      const allContributions = await window.api.savingsContributions.getAll(goalId);
      setContributions(allContributions);
    } catch (err) {
      console.error('Error loading contributions:', err);
    }
  };

  const loadReportData = async (goalId: string) => {
    try {
      const [growth, monthly, proj] = await Promise.all([
        window.api.savingsGoals.getGrowthData(goalId),
        window.api.savingsGoals.getMonthlyContributions(goalId),
        window.api.savingsProjection.forGoal(goalId).catch(() => null),
      ]);
      setGrowthData(growth);
      setMonthlyData(monthly);
      setProjection(proj ? {
        projectedCompletionDate: proj.projectedCompletionDate,
        requiredMonthlyToHitTarget: proj.requiredMonthlyToHitTarget,
        onTrack: proj.onTrack,
        scenarios: proj.scenarios,
      } : null);
    } catch (err) {
      console.error('Error loading report data:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('Goal name is required');
      return;
    }

    const target = parseFloat(formTarget);
    if (isNaN(target) || target <= 0) {
      setError('Please enter a valid target amount');
      return;
    }

    try {
      setLoading(true);
      const newGoal = await window.api.savingsGoals.create({
        name: formName.trim(),
        targetAmount: Math.round(target * 100),
        currentAmount: 0,
        targetDate: formTargetDate ? new Date(formTargetDate) : null,
        accountId: null,
        icon: formIcon,
        color: formColor,
        isActive: true,
        ownerId: formOwnerId || null,
      });

      // Pin account if selected
      if (formAccountId) {
        await window.api.savingsGoals.pinAccount(newGoal.id, formAccountId);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInlineEdit = (goal: SavingsGoal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (showForm) {
      setShowForm(false);
    }

    inlineEdit.startEdit(goal.id, {
      id: goal.id,
      name: goal.name,
      targetAmount: (goal.targetAmount / 100).toString(),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      accountId: goal.accountId || '',
      icon: goal.icon || ICONS[0],
      color: goal.color || DEFAULT_COLORS[0],
      ownerId: goal.ownerId || '',
    });
  };

  const handleDelete = async (goal: SavingsGoal) => {
    if (!confirm(`Delete savings goal "${goal.name}"?`)) return;

    try {
      setLoading(true);
      await window.api.savingsGoals.delete(goal.id);
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal(null);
      }
      await loadData();
    } catch (err) {
      console.error('Error deleting goal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;

    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      setLoading(true);
      await window.api.savingsContributions.create({
        goalId: selectedGoal.id,
        amount: Math.round(amount * 100),
        date: new Date(),
        transactionId: null,
      });
      setContributionAmount('');
      setShowContributionForm(false);
      await loadData();
      await loadContributions(selectedGoal.id);
      await loadReportData(selectedGoal.id);
    } catch (err) {
      console.error('Error adding contribution:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContribution = async (id: string) => {
    if (!selectedGoal) return;
    try {
      await window.api.savingsContributions.delete(id);
      await loadData();
      await loadContributions(selectedGoal.id);
      await loadReportData(selectedGoal.id);
    } catch (err) {
      console.error('Error deleting contribution:', err);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormTarget('');
    setFormTargetDate('');
    setFormAccountId('');
    setFormIcon(ICONS[0]);
    setFormColor(DEFAULT_COLORS[0]);
    setFormOwnerId(currentUserId);
    setError('');
  };

  const getProgress = (goal: SavingsGoal): number => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  const getDaysRemaining = (goal: SavingsGoal): number | null => {
    if (!goal.targetDate) return null;
    const now = new Date();
    const target = new Date(goal.targetDate);
    const diffTime = target.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isPinned = (goal: SavingsGoal): boolean => !!goal.accountId;

  const getLinkedAccountName = (goal: SavingsGoal): string | null => {
    if (!goal.accountId) return null;
    const acc = accounts.find(a => a.id === goal.accountId);
    return acc ? `${acc.name} (${acc.institution})` : null;
  };

  // Filter to savings-type accounts only for the dropdown
  const savingsAccountOptions = accounts
    .filter(acc => acc.type === 'savings')
    .map(acc => ({ value: acc.id, label: `${acc.name} (${acc.institution})` }));

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };

  const renderBarChart = (data: { label: string; value: number }[], color: string, maxValue?: number) => {
    if (data.length === 0) return <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>No data yet</p>;
    const max = maxValue || Math.max(...data.map(d => Math.abs(d.value)), 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '70px', textAlign: 'right', flexShrink: 0 }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: '20px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max((Math.abs(item.value) / max) * 100, 2)}%`,
                backgroundColor: color,
                borderRadius: 'var(--radius-sm)',
              }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 500, width: '80px', flexShrink: 0 }}>
              {formatCurrency(item.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const canShareGoal = (goal: SavingsGoal): boolean => {
    if (!currentUserId) return false;
    if (goal.ownerId && goal.ownerId !== currentUserId) return false;
    const currentUserAuth = memberAuthStatus.find(m => m.userId === currentUserId);
    if (!currentUserAuth?.hasPassword) return false;
    const othersWithPassword = memberAuthStatus.filter(m => m.userId !== currentUserId && m.hasPassword);
    return othersWithPassword.length > 0;
  };

  const renderGoalCard = (goal: SavingsGoal) => {
    const isEditing = inlineEdit.editingId === goal.id;
    const progress = getProgress(goal);
    const daysRemaining = getDaysRemaining(goal);
    const isSelected = selectedGoal?.id === goal.id;
    const linkedName = getLinkedAccountName(goal);

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;

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
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-edit-grid">
            {/* Row 1: Name */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Name</span>
              <div className="inline-edit-grid-value">
                <EditableText
                  value={editData.name || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('name', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.name}
                  placeholder="e.g., Vacation Fund"
                  disabled={inlineEdit.isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Target Amount */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Target</span>
              <div className="inline-edit-grid-value">
                <EditableNumber
                  value={editData.targetAmount || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('targetAmount', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.targetAmount}
                  prefix="$"
                  step={0.01}
                  min={0}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 3: Target Date */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Target Date</span>
              <div className="inline-edit-grid-value">
                <EditableDate
                  value={editData.targetDate || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('targetDate', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  placeholder="Optional"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 4: Linked Account (savings-type only) */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Account</span>
              <div className="inline-edit-grid-value">
                <EditableSelect
                  value={editData.accountId || ''}
                  isEditing={true}
                  options={savingsAccountOptions}
                  onChange={(v) => inlineEdit.updateField('accountId', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  allowEmpty
                  emptyLabel="None"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 5: Color */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Color</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => inlineEdit.updateField('color', color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: editData.color === color ? '2px solid var(--color-text)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    disabled={inlineEdit.isSubmitting}
                  />
                ))}
              </div>
            </div>

            {/* Row 6: Owner */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Owner</span>
              <div className="inline-edit-grid-value">
                <OwnershipSelector
                  value={editData.ownerId || null}
                  onChange={(v) => inlineEdit.updateField('ownerId', v || '')}
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
        onClick={() => setSelectedGoal(isSelected ? null : goal)}
        style={{
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: isSelected ? `2px solid ${goal.color || 'var(--color-primary)'}` : '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          opacity: goal.isActive ? 1 : 0.6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: goal.color || DEFAULT_COLORS[0],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 600,
            }}>
              {goal.icon?.[0] || 'Target'[0]}
            </div>
            <div>
              <h4 style={{ margin: 0 }}>{goal.name}</h4>
              {linkedName && (
                <span style={{
                  fontSize: '12px',
                  color: goal.color || 'var(--color-primary)',
                  backgroundColor: 'var(--color-surface-alt)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-block',
                  marginTop: '2px',
                }}>
                  Linked to {linkedName}
                </span>
              )}
              {daysRemaining !== null && (
                <span style={{
                  fontSize: '13px',
                  color: daysRemaining < 30 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                  display: 'block',
                }}>
                  {daysRemaining > 0 ? `${daysRemaining} days left` : 'Due!'}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
            {canShareGoal(goal) && (
              <button onClick={() => setShareTarget({ id: goal.id, name: goal.name })} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>Share</button>
            )}
            <button onClick={(e) => handleStartInlineEdit(goal, e)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>Edit</button>
            <button onClick={() => handleDelete(goal)} className="btn btn-outline-danger" style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600 }}>
            {formatCurrency(goal.currentAmount)}
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            of {formatCurrency(goal.targetAmount)}
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
            width: `${progress}%`,
            backgroundColor: goal.color || DEFAULT_COLORS[0],
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ textAlign: 'right', marginTop: '4px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {progress.toFixed(1)}% complete
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedGoal) return null;
    const pinned = isPinned(selectedGoal);
    const goalColor = selectedGoal.color || DEFAULT_COLORS[0];

    return (
      <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '16px', marginTop: '16px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
          {(['contributions', 'growth', 'monthly', 'projection'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setReportTab(tab)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: reportTab === tab ? 600 : 400,
                backgroundColor: reportTab === tab ? 'var(--color-surface-alt)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: reportTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'contributions' ? 'Contributions' : tab === 'growth' ? 'Growth' : tab === 'monthly' ? 'Monthly' : 'Projection'}
            </button>
          ))}
        </div>

        {/* Contributions Tab */}
        {reportTab === 'contributions' && (
          <div>
            {!pinned && (
              showContributionForm ? (
                <form onSubmit={handleAddContribution} style={{ marginBottom: '16px' }}>
                  <input
                    type="number"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add</button>
                    <button type="button" onClick={() => setShowContributionForm(false)} className="btn btn-secondary">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowContributionForm(true)} className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }}>
                  + Add Contribution
                </button>
              )
            )}

            {pinned && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                Contributions are automatically created from account transactions.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {contributions.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center' }}>No contributions yet</p>
              ) : (
                contributions.map((contribution) => {
                  const isAutoLinked = !!contribution.transactionId;
                  return (
                    <div
                      key={contribution.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: 'var(--color-surface-alt)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: contribution.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {contribution.amount >= 0 ? '+' : ''}{formatCurrency(contribution.amount)}
                          {isAutoLinked && (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>(auto-linked)</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {new Date(contribution.date).toLocaleDateString()}
                        </div>
                      </div>
                      {!isAutoLinked && (
                        <button
                          onClick={() => handleDeleteContribution(contribution.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                        >
                          X
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Growth Chart Tab */}
        {reportTab === 'growth' && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Cumulative Growth</h4>
            {renderBarChart(
              growthData.map(p => ({ label: p.date, value: p.cumulativeAmount })),
              goalColor
            )}
          </div>
        )}

        {/* Monthly Contributions Tab */}
        {reportTab === 'monthly' && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Monthly Contributions</h4>
            {renderBarChart(
              monthlyData.map(m => ({ label: m.month, value: m.total })),
              goalColor
            )}
          </div>
        )}

        {/* Projection Tab */}
        {reportTab === 'projection' && (
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Savings Projection</h4>
            {projection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: projection.onTrack ? 'var(--color-success-bg, rgba(34,197,94,0.1))' : 'var(--color-warning-bg, rgba(245,158,11,0.1))',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)'}`,
                }}>
                  <div style={{ fontWeight: 600, color: projection.onTrack ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {projection.onTrack ? 'On Track' : 'Behind Schedule'}
                  </div>
                  {projection.projectedCompletionDate && (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Projected completion: {new Date(projection.projectedCompletionDate).toLocaleDateString()}
                    </div>
                  )}
                  {projection.requiredMonthlyToHitTarget !== null && (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Required monthly: {formatCurrency(projection.requiredMonthlyToHitTarget)}
                    </div>
                  )}
                </div>

                {projection.scenarios.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 8px', fontSize: '13px' }}>Scenarios</h5>
                    {projection.scenarios.map((s, idx) => (
                      <div key={idx} style={{
                        padding: '8px',
                        backgroundColor: 'var(--color-surface-alt)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '6px',
                      }}>
                        <div style={{ fontWeight: 500, fontSize: '13px' }}>{s.label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {formatCurrency(s.monthlyContribution)}/mo
                          {s.projectedCompletionDate && ` — done by ${new Date(s.projectedCompletionDate).toLocaleDateString()}`}
                          {s.monthsToCompletion !== null && ` (${s.monthsToCompletion} months)`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
                Add contributions to see projections.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="savings-goals">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Savings Goals</h3>
        <button
          onClick={() => {
            inlineEdit.cancelEdit();
            setShowForm(!showForm);
          }}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
          {error && <div style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Goal Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Vacation Fund" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Target Amount</label>
              <input type="number" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="0.00" min="0" step="0.01" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Target Date (Optional)</label>
              <input type="date" value={formTargetDate} onChange={(e) => setFormTargetDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Linked Savings Account</label>
              <select value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)} style={{ width: '100%' }}>
                <option value="">None</option>
                {accounts.filter(acc => acc.type === 'savings').map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.institution})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Color</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: formColor === color ? '3px solid var(--color-text)' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <OwnershipSelector
              value={formOwnerId}
              onChange={setFormOwnerId}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Goals List */}
      <div>
        {loading && goals.length === 0 ? (
          <p>Loading goals...</p>
        ) : goals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No savings goals yet"
            description="Track progress toward what you're saving for."
            action={{ label: 'Add Goal', onClick: () => setShowForm(true) }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goals.map(renderGoalCard)}
          </div>
        )}
      </div>

      {/* Detail panel (full-width below cards) */}
      {renderDetailPanel()}

      {shareTarget && (
        <ShareDialog
          entityId={shareTarget.id}
          entityType={'savings_goal' as EncryptableEntityType}
          entityName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
