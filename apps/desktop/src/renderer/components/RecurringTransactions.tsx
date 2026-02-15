import React, { useEffect, useState, useCallback } from 'react';
import { Account, Category, RecurringTransaction, RecurringFrequency } from '../../shared/types';
import { useHousehold } from '../contexts/HouseholdContext';

const RecurringTransactions: React.FC = () => {
  const { householdFilter, filterByOwnership } = useHousehold();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    accountId: '',
    description: '',
    amount: '',
    categoryId: '',
    frequency: 'monthly' as RecurringFrequency,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [allAccounts, allCategories, allRecurring] = await Promise.all([
        window.api.accounts.getAll(),
        window.api.categories.getAll(),
        window.api.recurringTransactions.getAll()
      ]);
      const visibleAccounts = filterByOwnership(allAccounts);
      const visibleAccountIds = new Set(visibleAccounts.map(a => a.id));
      const visibleRecurring = allRecurring.filter(r => visibleAccountIds.has(r.accountId));
      setAccounts(visibleAccounts);
      setCategories(allCategories);
      setRecurringTransactions(visibleRecurring);

      // Initialize form defaults when data is loaded
      setFormData(prev => ({
        ...prev,
        accountId: !prev.accountId && visibleAccounts.length > 0 ? visibleAccounts[0].id : prev.accountId,
        categoryId: !prev.categoryId && allCategories.length > 0 ? allCategories[0].id : prev.categoryId
      }));
    } catch (error) {
      console.error('Error loading data:', error);
      // Even on error, try to render something usable
      setCategories([]);
      setAccounts([]);
      setRecurringTransactions([]);
    }
  }, [filterByOwnership]);

  useEffect(() => {
    loadData();
  }, [loadData, householdFilter]);

  // Reload data when form is shown to ensure categories are loaded
  useEffect(() => {
    if (showForm && categories.length === 0) {
      loadData();
    }
  }, [showForm, categories.length, loadData]);

  // Auto-select first category and account when they become available
  useEffect(() => {
    if (categories.length > 0 && !formData.categoryId) {
      setFormData(prev => ({
        ...prev,
        categoryId: categories[0].id
      }));
    }
  }, [categories, formData.categoryId]);

  useEffect(() => {
    if (accounts.length > 0 && !formData.accountId) {
      setFormData(prev => ({
        ...prev,
        accountId: accounts[0].id
      }));
    }
  }, [accounts, formData.accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountInDollars = parseFloat(formData.amount);
    // Convert dollars to cents for storage
    const amountInCents = Math.round(amountInDollars * 100);

    const data = {
      accountId: formData.accountId,
      description: formData.description,
      amount: amountInCents,
      categoryId: formData.categoryId,
      frequency: formData.frequency,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      nextOccurrence: new Date(formData.startDate)
    };

    try {
      if (editingId) {
        await window.api.recurringTransactions.update(editingId, data);
      } else {
        await window.api.recurringTransactions.create(data);
      }
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving recurring transaction:', error);
      alert('Failed to save recurring transaction');
    }
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingId(transaction.id);
    setFormData({
      accountId: transaction.accountId,
      description: transaction.description,
      amount: (transaction.amount / 100).toString(), // Convert cents to dollars for editing
      categoryId: transaction.categoryId || '',
      frequency: transaction.frequency,
      startDate: transaction.startDate instanceof Date
        ? transaction.startDate.toISOString().split('T')[0]
        : transaction.startDate,
      endDate: transaction.endDate
        ? (transaction.endDate instanceof Date
          ? transaction.endDate.toISOString().split('T')[0]
          : transaction.endDate)
        : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recurring transaction?')) {
      return;
    }
    try {
      await window.api.recurringTransactions.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      alert('Failed to delete recurring transaction');
    }
  };

  const resetForm = () => {
    setFormData({
      accountId: accounts.length > 0 ? accounts[0].id : '',
      description: '',
      amount: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const formatCurrency = (amount: number): string => {
    const dollars = amount / 100; // Convert cents to dollars
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
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

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getAccountName = (accountId: string): string => {
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown';
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Recurring Transactions</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>Manage recurring income and expenses for cash flow forecasting</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={showForm ? 'btn btn-secondary' : 'btn btn-primary'}
        >
          {showForm ? 'Cancel' : '+ Add Recurring Transaction'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          padding: '20px',
          marginBottom: '20px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)'
        }}>
          <h3>{editingId ? 'Edit' : 'Add'} Recurring Transaction</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <label htmlFor="account" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Account *
                </label>
                <select
                  id="account"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  required
                  style={{ width: '100%' }}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Description *
                </label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="e.g., Rent, Salary, Netflix"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="amount" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Amount * <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', fontSize: '12px' }}>(negative for expenses)</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="e.g., 2500 or -1500"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="category" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Category *
                </label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                  style={{ width: '100%' }}
                >
                  {categories.length === 0 ? (
                    <option value="" disabled>Loading categories...</option>
                  ) : (
                    <>
                      <option value="" disabled>Select a category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="frequency" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Frequency *
                </label>
                <select
                  id="frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringFrequency })}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
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
                  required
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
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-success">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {recurringTransactions.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)'
        }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '10px' }}>No recurring transactions yet.</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            Add recurring income or expenses to enable cash flow forecasting.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Category</th>
                <th>Frequency</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Next</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.description}</td>
                  <td>{getAccountName(transaction.accountId)}</td>
                  <td style={{
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: transaction.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                  }}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td>{getCategoryName(transaction.categoryId)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{transaction.frequency}</td>
                  <td>{formatDate(transaction.startDate)}</td>
                  <td>{transaction.endDate ? formatDate(transaction.endDate) : '-'}</td>
                  <td>{formatDate(transaction.nextOccurrence)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', marginRight: '5px', fontSize: '12px' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="btn btn-danger"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecurringTransactions;
