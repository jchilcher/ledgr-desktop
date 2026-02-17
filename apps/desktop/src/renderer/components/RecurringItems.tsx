import React, { useState, useEffect, useCallback } from 'react';
import { Account, Category, RecurringItem, RecurringItemType, RecurringFrequency, TransactionType, UserAuthStatus, EncryptableEntityType, RecurringPayment } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableNumber, EditableSelect, EditableCheckbox } from './inline-edit';
import EmptyState from './EmptyState';
import OwnershipSelector from './OwnershipSelector';
import ShareDialog from './ShareDialog';
import { useHousehold } from '../contexts/HouseholdContext';
import TransactionPickerModal from './TransactionPickerModal';

type FilterMode = 'all' | 'bills' | 'subscriptions' | 'cashflow';

const ITEM_TYPE_OPTIONS = [
  { value: 'cashflow', label: 'Cash Flow' },
  { value: 'bill', label: 'Bill' },
  { value: 'subscription', label: 'Subscription' },
];

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

interface EditFormData {
  id: string;
  description: string;
  amount: string;
  type: TransactionType;
  frequency: RecurringFrequency;
  dayOfMonth: string;
  categoryId: string;
  accountId: string;
  itemType: RecurringItemType;
  enableReminders: boolean;
  reminderDays: string;
  autopay: boolean;
  ownerId: string;
}

export default function RecurringItems() {
  const { currentUserId, householdFilter, filterByOwnership } = useHousehold();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Form state for Add New (top form)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense' as TransactionType,
    frequency: 'monthly' as RecurringFrequency,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    accountId: '',
    categoryId: '',
    dayOfMonth: '',
    itemType: 'cashflow' as RecurringItemType,
    enableReminders: false,
    reminderDays: '3',
    autopay: false,
    ownerId: currentUserId,
  });
  const [error, setError] = useState('');
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);
  const [memberAuthStatus, setMemberAuthStatus] = useState<UserAuthStatus[]>([]);
  const [paymentMap, setPaymentMap] = useState<Map<string, RecurringPayment>>(new Map());
  const [linkingPaymentId, setLinkingPaymentId] = useState<string | null>(null);

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      const rawAmount = parseFloat(data.amount || '0');
      if (isNaN(rawAmount) || rawAmount === 0) {
        throw new Error('Please enter a valid amount');
      }

      const dayOfMonth = data.dayOfMonth ? parseInt(data.dayOfMonth) : null;
      if (dayOfMonth !== null && (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
        throw new Error('Day of month must be between 1 and 31');
      }

      // Apply sign based on type: positive for income, negative for expense
      // Convert dollars to cents for storage
      const amountInCents = Math.round(rawAmount * 100);
      const amount = data.type === 'income' ? Math.abs(amountInCents) : -Math.abs(amountInCents);

      const enableReminders = data.itemType === 'bill' || data.itemType === 'subscription';

      const updateData: Partial<RecurringItem> = {
        description: data.description?.trim(),
        amount,
        frequency: data.frequency,
        dayOfMonth,
        categoryId: data.categoryId || null,
        accountId: data.accountId || null,
        itemType: data.itemType,
        enableReminders,
        reminderDays: enableReminders ? parseInt(data.reminderDays || '3') : null,
        autopay: data.autopay,
        ownerId: data.ownerId || null,
      };

      await window.api.recurring.update(id, updateData);
      await loadData();
    },
    validateField: (field, value) => {
      if (field === 'description' && (!value || !(value as string).trim())) {
        return 'Description is required';
      }
      if (field === 'amount') {
        const num = parseFloat(value as string);
        if (isNaN(num) || num === 0) {
          return 'Enter a valid amount';
        }
      }
      return null;
    },
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allItems, allAccounts, allCategories, authStatuses] = await Promise.all([
        window.api.recurring.getAll(),
        window.api.accounts.getAll(),
        window.api.categories.getAll(),
        window.api.security.getMemberAuthStatus().catch(() => [] as UserAuthStatus[]),
      ]);
      const visibleItems = filterByOwnership(allItems);
      setItems(visibleItems);
      setAccounts(allAccounts);
      setCategories(allCategories);
      setMemberAuthStatus(authStatuses);

      await window.api.recurringPayments.generate();

      const currentPayments = await window.api.recurringPayments.getForCurrentPeriod();
      const pMap = new Map<string, RecurringPayment>();
      for (const p of currentPayments) {
        pMap.set(p.recurringItemId, p);
      }
      setPaymentMap(pMap);

      setFormData(prev => ({
        ...prev,
        accountId: !prev.accountId && allAccounts.length > 0 ? allAccounts[0].id : prev.accountId,
      }));
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterByOwnership]);

  useEffect(() => {
    loadData();
  }, [loadData, householdFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    const rawAmount = parseFloat(formData.amount);
    if (isNaN(rawAmount) || rawAmount === 0) {
      setError('Please enter a valid amount');
      return;
    }

    const dayOfMonth = formData.dayOfMonth ? parseInt(formData.dayOfMonth) : null;
    if (dayOfMonth !== null && (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
      setError('Day of month must be between 1 and 31');
      return;
    }

    const startDate = new Date(formData.startDate);
    const nextOccurrence = startDate > new Date() ? startDate : calculateNextOccurrence(startDate, formData.frequency);

    // Apply sign based on type: positive for income, negative for expense
    // Convert dollars to cents for storage
    const amountInCents = Math.round(rawAmount * 100);
    const amount = formData.type === 'income' ? Math.abs(amountInCents) : -Math.abs(amountInCents);

    try {
      setLoading(true);
      const enableReminders = formData.itemType === 'bill' || formData.itemType === 'subscription';
      const itemData = {
        description: formData.description.trim(),
        amount,
        frequency: formData.frequency,
        startDate,
        nextOccurrence,
        accountId: formData.accountId || null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        categoryId: formData.categoryId || null,
        dayOfMonth,
        dayOfWeek: null,
        itemType: formData.itemType,
        enableReminders,
        reminderDays: enableReminders ? parseInt(formData.reminderDays) || 3 : null,
        autopay: formData.autopay,
        isActive: true,
        ownerId: formData.ownerId || null,
      };

      await window.api.recurring.create(itemData);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recurring item');
    } finally {
      setLoading(false);
    }
  };

  const calculateNextOccurrence = (startDate: Date, frequency: RecurringFrequency): Date => {
    const now = new Date();
    const next = new Date(startDate);

    while (next <= now) {
      switch (frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'biweekly':
          next.setDate(next.getDate() + 14);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
        case 'quarterly':
          next.setMonth(next.getMonth() + 3);
          break;
        case 'yearly':
          next.setFullYear(next.getFullYear() + 1);
          break;
      }
    }
    return next;
  };

  const handleStartInlineEdit = (item: RecurringItem) => {
    // Cancel add form if open
    if (showForm) {
      setShowForm(false);
    }

    // Determine type from amount sign: positive = income, negative = expense
    const itemType: TransactionType = item.amount >= 0 ? 'income' : 'expense';

    inlineEdit.startEdit(item.id, {
      id: item.id,
      description: item.description,
      amount: (Math.abs(item.amount) / 100).toString(),
      type: itemType,
      frequency: item.frequency,
      dayOfMonth: item.dayOfMonth?.toString() || '',
      categoryId: item.categoryId || '',
      accountId: item.accountId || '',
      itemType: item.itemType || (item.enableReminders ? 'bill' : 'cashflow'),
      enableReminders: item.enableReminders,
      reminderDays: item.reminderDays?.toString() || '3',
      autopay: item.autopay,
      ownerId: item.ownerId || '',
    });
  };

  const handleToggle = async (item: RecurringItem) => {
    try {
      await window.api.recurring.update(item.id, { isActive: !item.isActive });
      await loadData();
    } catch (err) {
      console.error('Error toggling item:', err);
    }
  };

  const handleDelete = async (item: RecurringItem) => {
    if (!confirm(`Delete "${item.description}"?`)) return;

    try {
      setLoading(true);
      await window.api.recurring.delete(item.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting item:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormData({
      description: '',
      amount: '',
      type: 'expense',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      accountId: accounts.length > 0 ? accounts[0].id : '',
      categoryId: '',
      dayOfMonth: '',
      itemType: 'cashflow',
      enableReminders: false,
      reminderDays: '3',
      autopay: false,
      ownerId: currentUserId,
    });
    setError('');
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon || ''} ${cat.name}` : '';
  };

  const getAccountName = (accountId: string | null | undefined): string => {
    if (!accountId) return '';
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : '';
  };

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amountInCents) / 100);
  };

  const formatDate = (dateStr: string | Date): string => {
    let date: Date;
    if (dateStr instanceof Date) {
      date = dateStr;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      date = new Date(y, m - 1, d);
    } else {
      date = new Date(dateStr);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilNext = (item: RecurringItem): number => {
    const next = item.nextOccurrence instanceof Date ? item.nextOccurrence : new Date(item.nextOccurrence);
    const now = new Date();
    const diffTime = next.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const filteredItems = items.filter(item => {
    if (filterMode === 'bills') return item.itemType === 'bill';
    if (filterMode === 'subscriptions') return item.itemType === 'subscription';
    if (filterMode === 'cashflow') return item.itemType === 'cashflow';
    return true;
  });

  const billsCount = items.filter(i => i.itemType === 'bill').length;
  const subscriptionsCount = items.filter(i => i.itemType === 'subscription').length;
  const cashflowCount = items.filter(i => i.itemType === 'cashflow').length;

  // Get category options filtered by type
  const getCategoryOptions = (type: TransactionType) => categories
    .filter(c => c.type === type)
    .map(cat => ({
      value: cat.id,
      label: cat.name,
      icon: cat.icon,
    }));

  const accountOptions = accounts.map(acc => ({
    value: acc.id,
    label: acc.name,
  }));

  const canShareItem = (item: RecurringItem): boolean => {
    if (!currentUserId) return false;
    if (item.ownerId && item.ownerId !== currentUserId) return false;
    const currentUserAuth = memberAuthStatus.find(m => m.userId === currentUserId);
    if (!currentUserAuth?.hasPassword) return false;
    const othersWithPassword = memberAuthStatus.filter(m => m.userId !== currentUserId && m.hasPassword);
    return othersWithPassword.length > 0;
  };

  const renderCard = (item: RecurringItem) => {
    const isEditing = inlineEdit.editingId === item.id;
    const daysUntil = getDaysUntilNext(item);
    const reminderDays = item.reminderDays || 3;
    const isUpcoming = item.enableReminders && item.isActive && daysUntil <= reminderDays;

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;
      const showDayOfMonth = ['monthly', 'quarterly', 'yearly'].includes(editData.frequency || 'monthly');

      return (
        <div
          key={item.id}
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
            {/* Row 1: Description */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Name</span>
              <div className="inline-edit-grid-value">
                <EditableText
                  value={editData.description || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('description', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.description}
                  placeholder="e.g., Netflix"
                  disabled={inlineEdit.isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Type & Amount */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Type</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                <EditableSelect
                  value={editData.type || 'expense'}
                  isEditing={true}
                  options={TYPE_OPTIONS}
                  onChange={(v) => {
                    inlineEdit.updateField('type', v as TransactionType);
                    // Clear category when type changes since categories are type-specific
                    inlineEdit.updateField('categoryId', '');
                  }}
                  onKeyDown={inlineEdit.handleKeyDown}
                  disabled={inlineEdit.isSubmitting}
                />
                <EditableNumber
                  value={editData.amount || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('amount', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.amount}
                  prefix="$"
                  step={0.01}
                  disabled={inlineEdit.isSubmitting}
                />
                <span style={{ color: 'var(--color-text-muted)' }}>/</span>
                <EditableSelect
                  value={editData.frequency || 'monthly'}
                  isEditing={true}
                  options={FREQUENCY_OPTIONS}
                  onChange={(v) => inlineEdit.updateField('frequency', v as RecurringFrequency)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 3: Day of month (conditional) */}
            {showDayOfMonth && (
              <div className="inline-edit-grid-row">
                <span className="inline-edit-grid-label">Due Day</span>
                <div className="inline-edit-grid-value">
                  <EditableNumber
                    value={editData.dayOfMonth || ''}
                    isEditing={true}
                    onChange={(v) => inlineEdit.updateField('dayOfMonth', v)}
                    onKeyDown={inlineEdit.handleKeyDown}
                    error={inlineEdit.errors.dayOfMonth}
                    min={1}
                    max={31}
                    placeholder="1-31"
                    disabled={inlineEdit.isSubmitting}
                  />
                </div>
              </div>
            )}

            {/* Row 4: Category */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Category</span>
              <div className="inline-edit-grid-value">
                <EditableSelect
                  value={editData.categoryId || ''}
                  isEditing={true}
                  options={getCategoryOptions(editData.type || 'expense')}
                  onChange={(v) => inlineEdit.updateField('categoryId', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  allowEmpty
                  emptyLabel="None"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 5: Account */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Account</span>
              <div className="inline-edit-grid-value">
                <EditableSelect
                  value={editData.accountId || ''}
                  isEditing={true}
                  options={accountOptions}
                  onChange={(v) => inlineEdit.updateField('accountId', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  allowEmpty
                  emptyLabel="None"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 6: Item Type */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Item Type</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
                <EditableSelect
                  value={editData.itemType || 'cashflow'}
                  isEditing={true}
                  options={ITEM_TYPE_OPTIONS}
                  onChange={(v) => {
                    const newItemType = v as RecurringItemType;
                    inlineEdit.updateField('itemType', newItemType);
                    const reminders = newItemType === 'bill' || newItemType === 'subscription';
                    inlineEdit.updateField('enableReminders', reminders);
                  }}
                  onKeyDown={inlineEdit.handleKeyDown}
                  disabled={inlineEdit.isSubmitting}
                />
                {(editData.itemType === 'bill' || editData.itemType === 'subscription') && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Remind</span>
                      <EditableNumber
                        value={editData.reminderDays || '3'}
                        isEditing={true}
                        onChange={(v) => inlineEdit.updateField('reminderDays', v)}
                        onKeyDown={inlineEdit.handleKeyDown}
                        min={0}
                        max={30}
                        disabled={inlineEdit.isSubmitting}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>days before</span>
                    </div>
                    <EditableCheckbox
                      value={editData.autopay || false}
                      isEditing={true}
                      onChange={(v) => inlineEdit.updateField('autopay', v)}
                      label="Autopay"
                      disabled={inlineEdit.isSubmitting}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Row 7: Owner */}
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
        key={item.id}
        style={{
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: `1px solid ${isUpcoming ? 'var(--color-warning)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          opacity: item.isActive ? 1 : 0.6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingTop: '2px' }}>
              <input
                type="checkbox"
                checked={item.isActive}
                onChange={() => handleToggle(item)}
              />
            </label>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h4 style={{ margin: 0 }}>{item.description}</h4>
                {item.itemType === 'bill' && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    backgroundColor: 'var(--color-primary-bg)',
                    color: 'var(--color-primary)',
                  }}>
                    Bill
                  </span>
                )}
                {item.itemType === 'subscription' && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    backgroundColor: 'var(--color-warning-bg, rgba(234, 179, 8, 0.1))',
                    color: 'var(--color-warning, #ca8a04)',
                  }}>
                    Subscription
                  </span>
                )}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: item.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(item.amount)} / {FREQUENCY_LABELS[item.frequency]}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {item.dayOfMonth && `Due on the ${item.dayOfMonth}${getOrdinalSuffix(item.dayOfMonth)}`}
                {item.categoryId && ` - ${getCategoryName(item.categoryId)}`}
                {item.accountId && ` - ${getAccountName(item.accountId)}`}
                {item.enableReminders && item.autopay && ' - Autopay'}
              </div>
              {item.isActive && (
                <div style={{
                  fontSize: '13px',
                  marginTop: '4px',
                  color: isUpcoming ? 'var(--color-warning)' : 'var(--color-text-muted)',
                  fontWeight: isUpcoming ? 500 : 400,
                }}>
                  Next: {formatDate(item.nextOccurrence)}
                  {daysUntil === 0 ? ' (Today!)' :
                    daysUntil === 1 ? ' (Tomorrow)' :
                      ` (in ${daysUntil} days)`}
                </div>
              )}
              {item.enableReminders && item.isActive && (() => {
                const payment = paymentMap.get(item.id);
                if (!payment) return null;

                if (payment.status === 'paid') {
                  return (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        fontWeight: 500,
                      }}>
                        Paid
                      </span>
                      {payment.paidDate && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          on {formatDate(payment.paidDate)}
                        </span>
                      )}
                    </div>
                  );
                } else if (payment.status === 'pending' || payment.status === 'overdue') {
                  return (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        backgroundColor: payment.status === 'overdue' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                        color: payment.status === 'overdue' ? 'var(--color-danger)' : 'var(--color-warning)',
                        fontWeight: 500,
                      }}>
                        {payment.status === 'overdue' ? 'Overdue' : 'Pending'}
                      </span>
                      <button
                        onClick={async () => {
                          await window.api.recurringPayments.markPaid(payment.id);
                          await loadData();
                        }}
                        className="btn btn-success"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => setLinkingPaymentId(payment.id)}
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        Link Transaction
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {canShareItem(item) && (
              <button
                onClick={() => setShareTarget({ id: item.id, name: item.description })}
                className="btn btn-secondary"
                style={{ padding: '4px 12px', fontSize: '13px' }}
                title="Share"
              >
                Share
              </button>
            )}
            <button
              onClick={() => handleStartInlineEdit(item)}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="btn btn-outline-danger"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Recurring Items</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Manage recurring expenses, income, and bills for budgeting and cash flow forecasting
          </p>
        </div>
        <button
          onClick={() => {
            inlineEdit.cancelEdit(); // Cancel any inline edit when opening add form
            setShowForm(!showForm);
          }}
          className={showForm ? 'btn btn-secondary' : 'btn btn-primary'}
        >
          {showForm ? 'Cancel' : '+ Add Recurring Item'}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setFilterMode('all')}
          className={filterMode === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px' }}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilterMode('bills')}
          className={filterMode === 'bills' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px' }}
        >
          Bills ({billsCount})
        </button>
        <button
          onClick={() => setFilterMode('subscriptions')}
          className={filterMode === 'subscriptions' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px' }}
        >
          Subscriptions ({subscriptionsCount})
        </button>
        <button
          onClick={() => setFilterMode('cashflow')}
          className={filterMode === 'cashflow' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 16px' }}
        >
          Cash Flow ({cashflowCount})
        </button>
      </div>

      {/* Add Form (only for new items) */}
      {showForm && (
        <div style={{
          padding: '20px',
          marginBottom: '20px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)'
        }}>
          <h3>Add Recurring Item</h3>
          {error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label htmlFor="description" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description *
                </label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Netflix, Rent, Salary"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="type" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Type *
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType, categoryId: '' })}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>

              <div>
                <label htmlFor="amount" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Amount *
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="frequency" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Frequency *
                </label>
                <select
                  id="frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringFrequency })}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="startDate" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Start Date *
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="endDate" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  End Date <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', fontSize: '12px' }}>(optional)</span>
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="account" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Account
                </label>
                <select
                  id="account"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Category
                </label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  <option value="">None</option>
                  {categories.filter(c => c.type === formData.type).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {['monthly', 'quarterly', 'yearly'].includes(formData.frequency) && (
                <div>
                  <label htmlFor="dayOfMonth" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Day of Month
                  </label>
                  <input
                    type="number"
                    id="dayOfMonth"
                    value={formData.dayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                    min="1"
                    max="31"
                    placeholder="1-31"
                    disabled={loading}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            {/* Item Type section */}
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ marginBottom: (formData.itemType === 'bill' || formData.itemType === 'subscription') ? '12px' : 0 }}>
                <label htmlFor="itemType" style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
                  Item Type
                </label>
                <select
                  id="itemType"
                  value={formData.itemType}
                  onChange={(e) => {
                    const newItemType = e.target.value as RecurringItemType;
                    const enableReminders = newItemType === 'bill' || newItemType === 'subscription';
                    setFormData({ ...formData, itemType: newItemType, enableReminders, autopay: enableReminders ? formData.autopay : false });
                  }}
                  disabled={loading}
                  style={{ width: '200px' }}
                >
                  <option value="cashflow">Cash Flow</option>
                  <option value="bill">Bill</option>
                  <option value="subscription">Subscription</option>
                </select>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  {formData.itemType === 'cashflow' && 'Basic recurring income/expense for forecasting'}
                  {formData.itemType === 'bill' && 'Track payments, reminders & due dates'}
                  {formData.itemType === 'subscription' && 'Track subscription payments & reminders'}
                </span>
              </div>

              {(formData.itemType === 'bill' || formData.itemType === 'subscription') && (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <label htmlFor="reminderDays" style={{ display: 'block', marginBottom: '5px', fontWeight: 500, fontSize: '14px' }}>
                      Remind days before due
                    </label>
                    <input
                      type="number"
                      id="reminderDays"
                      value={formData.reminderDays}
                      onChange={(e) => setFormData({ ...formData, reminderDays: e.target.value })}
                      min="0"
                      max="30"
                      disabled={loading}
                      style={{ width: '100px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.autopay}
                        onChange={(e) => setFormData({ ...formData, autopay: e.target.checked })}
                        disabled={loading}
                      />
                      <span>Autopay enabled</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Owner selector */}
            <div style={{ marginTop: '16px' }}>
              <OwnershipSelector
                value={formData.ownerId || null}
                onChange={(v) => setFormData({ ...formData, ownerId: v })}
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-success" disabled={loading}>
                Create
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading && filteredItems.length === 0 ? (
        <p>Loading recurring items...</p>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="🔄"
          title={
            filterMode === 'all'
              ? 'No recurring items yet'
              : filterMode === 'bills'
              ? 'No bills set up yet'
              : filterMode === 'subscriptions'
              ? 'No subscriptions set up yet'
              : 'No cash flow items set up yet'
          }
          description="Add recurring expenses, income, or bills to enable cash flow forecasting and payment tracking."
          action={{ label: 'Add Recurring Item', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map(renderCard)}
        </div>
      )}

      {shareTarget && (
        <ShareDialog
          entityId={shareTarget.id}
          entityType={'recurring_item' as EncryptableEntityType}
          entityName={shareTarget.name}
          onClose={() => setShareTarget(null)}
        />
      )}

      {linkingPaymentId && (
        <TransactionPickerModal
          onSelect={async (transactionId) => {
            await window.api.recurringPayments.linkTransaction(linkingPaymentId, transactionId);
            setLinkingPaymentId(null);
            await loadData();
          }}
          onClose={() => setLinkingPaymentId(null)}
        />
      )}
    </div>
  );
}
