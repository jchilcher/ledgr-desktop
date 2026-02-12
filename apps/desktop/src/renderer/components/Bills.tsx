import React, { useState, useEffect } from 'react';
import { Bill, BillFrequency, BillPayment, Category } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableNumber, EditableSelect, EditableCheckbox } from './inline-edit';
import EmptyState from './EmptyState';

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

interface EditFormData {
  id: string;
  name: string;
  amount: string;
  dueDay: string;
  frequency: BillFrequency;
  categoryId: string;
  autopay: boolean;
  reminderDays: string;
}

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [_upcomingPayments, setUpcomingPayments] = useState<BillPayment[]>([]);
  void _upcomingPayments;
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state for Add New
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDay, setFormDueDay] = useState('1');
  const [formFrequency, setFormFrequency] = useState<BillFrequency>('monthly');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAutopay, setFormAutopay] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState('3');
  const [error, setError] = useState('');

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      const amount = parseFloat(data.amount || '0');
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const dueDay = parseInt(data.dueDay || '1');
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error('Due day must be between 1 and 31');
      }

      await window.api.bills.update(id, {
        name: data.name?.trim(),
        amount,
        dueDay,
        frequency: data.frequency,
        categoryId: data.categoryId || null,
        autopay: data.autopay,
        reminderDays: parseInt(data.reminderDays || '3'),
      });
      await loadData();
    },
    validateField: (field, value) => {
      if (field === 'name' && (!value || !(value as string).trim())) {
        return 'Name is required';
      }
      if (field === 'amount') {
        const num = parseFloat(value as string);
        if (isNaN(num) || num <= 0) {
          return 'Enter a valid amount';
        }
      }
      if (field === 'dueDay') {
        const num = parseInt(value as string);
        if (isNaN(num) || num < 1 || num > 31) {
          return '1-31';
        }
      }
      return null;
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allBills, allCategories, payments] = await Promise.all([
        window.api.bills.getAll(),
        window.api.categories.getAll(),
        window.api.billPayments.getUpcoming(30),
      ]);
      setBills(allBills);
      setCategories(allCategories.filter(c => c.type === 'expense'));
      setUpcomingPayments(payments);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('Bill name is required');
      return;
    }

    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const dueDay = parseInt(formDueDay);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      setError('Due day must be between 1 and 31');
      return;
    }

    try {
      setLoading(true);
      await window.api.bills.create({
        name: formName.trim(),
        amount,
        dueDay,
        frequency: formFrequency,
        categoryId: formCategoryId || null,
        autopay: formAutopay,
        reminderDays: parseInt(formReminderDays) || 3,
        isActive: true,
      });
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInlineEdit = (bill: Bill) => {
    if (showForm) {
      setShowForm(false);
    }

    inlineEdit.startEdit(bill.id, {
      id: bill.id,
      name: bill.name,
      amount: bill.amount.toString(),
      dueDay: bill.dueDay.toString(),
      frequency: bill.frequency,
      categoryId: bill.categoryId || '',
      autopay: bill.autopay,
      reminderDays: bill.reminderDays.toString(),
    });
  };

  const handleToggle = async (bill: Bill) => {
    try {
      await window.api.bills.update(bill.id, { isActive: !bill.isActive });
      await loadData();
    } catch (err) {
      console.error('Error toggling bill:', err);
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill "${bill.name}"?`)) return;

    try {
      setLoading(true);
      await window.api.bills.delete(bill.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormAmount('');
    setFormDueDay('1');
    setFormFrequency('monthly');
    setFormCategoryId('');
    setFormAutopay(false);
    setFormReminderDays('3');
    setError('');
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon || ''} ${cat.name}` : '';
  };

  const getFrequencyLabel = (freq: BillFrequency): string => {
    const labels: Record<BillFrequency, string> = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    };
    return labels[freq];
  };

  const getNextDueDate = (bill: Bill): Date => {
    const now = new Date();
    const nextDue = new Date(now.getFullYear(), now.getMonth(), bill.dueDay);
    if (nextDue < now) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }
    return nextDue;
  };

  const getDaysUntilDue = (bill: Bill): number => {
    const nextDue = getNextDueDate(bill);
    const now = new Date();
    const diffTime = nextDue.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
    icon: cat.icon,
  }));

  const renderCard = (bill: Bill) => {
    const isEditing = inlineEdit.editingId === bill.id;
    const daysUntil = getDaysUntilDue(bill);
    const isUpcoming = daysUntil <= bill.reminderDays;

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;

      return (
        <div
          key={bill.id}
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
                  placeholder="e.g., Netflix"
                  disabled={inlineEdit.isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Amount & Frequency */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Amount</span>
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
                  value={editData.frequency || 'monthly'}
                  isEditing={true}
                  options={FREQUENCY_OPTIONS}
                  onChange={(v) => inlineEdit.updateField('frequency', v as BillFrequency)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 3: Due Day */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Due Day</span>
              <div className="inline-edit-grid-value">
                <EditableNumber
                  value={editData.dueDay || '1'}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('dueDay', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.dueDay}
                  min={1}
                  max={31}
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 4: Category */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Category</span>
              <div className="inline-edit-grid-value">
                <EditableSelect
                  value={editData.categoryId || ''}
                  isEditing={true}
                  options={categoryOptions}
                  onChange={(v) => inlineEdit.updateField('categoryId', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  allowEmpty
                  emptyLabel="None"
                  disabled={inlineEdit.isSubmitting}
                />
              </div>
            </div>

            {/* Row 5: Reminder & Autopay */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label">Settings</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
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
        key={bill.id}
        style={{
          padding: '16px',
          backgroundColor: 'var(--color-surface)',
          border: `1px solid ${isUpcoming && bill.isActive ? 'var(--color-warning)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          opacity: bill.isActive ? 1 : 0.6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingTop: '2px' }}>
              <input
                type="checkbox"
                checked={bill.isActive}
                onChange={() => handleToggle(bill)}
              />
            </label>
            <div>
              <h4 style={{ margin: '0 0 4px 0' }}>{bill.name}</h4>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                ${bill.amount.toFixed(2)} / {getFrequencyLabel(bill.frequency)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Due on the {bill.dueDay}{getOrdinalSuffix(bill.dueDay)}
                {bill.categoryId && ` - ${getCategoryName(bill.categoryId)}`}
                {bill.autopay && ' - Autopay'}
              </div>
              {bill.isActive && (
                <div style={{
                  fontSize: '13px',
                  marginTop: '4px',
                  color: isUpcoming ? 'var(--color-warning)' : 'var(--color-text-muted)',
                  fontWeight: isUpcoming ? 500 : 400,
                }}>
                  {daysUntil === 0 ? 'Due today!' :
                    daysUntil === 1 ? 'Due tomorrow' :
                      `Due in ${daysUntil} days`}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleStartInlineEdit(bill)}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(bill)}
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
    <div className="bills">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Bills & Subscriptions</h3>
        <button
          onClick={() => {
            inlineEdit.cancelEdit();
            setShowForm(!showForm);
          }}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Bill'}
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
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Bill Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Netflix"
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Amount</label>
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
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Due Day</label>
              <input
                type="number"
                value={formDueDay}
                onChange={(e) => setFormDueDay(e.target.value)}
                min="1"
                max="31"
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as BillFrequency)}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Reminder Days</label>
              <input
                type="number"
                value={formReminderDays}
                onChange={(e) => setFormReminderDays(e.target.value)}
                min="0"
                max="30"
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formAutopay}
                onChange={(e) => setFormAutopay(e.target.checked)}
                disabled={loading}
              />
              <span>Autopay enabled</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create Bill
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && bills.length === 0 ? (
        <p>Loading bills...</p>
      ) : bills.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No bills set up yet"
          description="Track bills and due dates so nothing slips through the cracks."
          action={{ label: 'Add Bill', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bills.map(renderCard)}
        </div>
      )}
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
