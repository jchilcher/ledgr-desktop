import React, { useState, useEffect } from 'react';
import { SpendingAlert, BudgetPeriod, Category } from '../../shared/types';
import EmptyState from './EmptyState';

export default function SpendingAlerts() {
  const [alerts, setAlerts] = useState<SpendingAlert[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SpendingAlert | null>(null);

  // Form state
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formPeriod, setFormPeriod] = useState<BudgetPeriod>('monthly');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allAlerts, allCategories] = await Promise.all([
        window.api.spendingAlerts.getAll(),
        window.api.categories.getAll(),
      ]);
      setAlerts(allAlerts);
      setCategories(allCategories.filter(c => c.type === 'expense'));
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formCategoryId) {
      setError('Please select a category');
      return;
    }

    const threshold = parseFloat(formThreshold);
    if (isNaN(threshold) || threshold <= 0) {
      setError('Please enter a valid threshold amount');
      return;
    }

    try {
      setLoading(true);
      if (editingAlert) {
        await window.api.spendingAlerts.update(editingAlert.id, {
          categoryId: formCategoryId,
          threshold,
          period: formPeriod,
        });
      } else {
        await window.api.spendingAlerts.create({
          categoryId: formCategoryId,
          threshold,
          period: formPeriod,
          isActive: true,
          lastTriggered: null,
        });
      }
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alert');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (alert: SpendingAlert) => {
    setEditingAlert(alert);
    setFormCategoryId(alert.categoryId);
    setFormThreshold(alert.threshold.toString());
    setFormPeriod(alert.period);
    setShowForm(true);
  };

  const handleToggle = async (alert: SpendingAlert) => {
    try {
      await window.api.spendingAlerts.update(alert.id, {
        isActive: !alert.isActive,
      });
      await loadData();
    } catch (err) {
      console.error('Error toggling alert:', err);
    }
  };

  const handleDelete = async (alert: SpendingAlert) => {
    const category = categories.find(c => c.id === alert.categoryId);
    if (!confirm(`Delete spending alert for "${category?.name || 'Unknown'}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await window.api.spendingAlerts.delete(alert.id);
      await loadData();
    } catch (err) {
      console.error('Error deleting alert:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingAlert(null);
    setFormCategoryId('');
    setFormThreshold('');
    setFormPeriod('monthly');
    setError('');
  };

  const getCategoryName = (categoryId: string): string => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon || ''} ${cat.name}` : 'Unknown';
  };

  return (
    <div className="spending-alerts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Spending Alerts</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Alert'}
        </button>
      </div>

      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
        Get notified when spending in a category exceeds your threshold.
      </p>

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
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Alert Threshold</label>
              <input
                type="number"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                disabled={loading}
                style={{ width: '100%' }}
              />
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

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {editingAlert ? 'Update' : 'Create'} Alert
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && alerts.length === 0 ? (
        <p>Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No spending alerts set up yet"
          description="Get notified when your spending exceeds the limits you set."
          action={{ label: 'Add Alert', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                opacity: alert.isActive ? 1 : 0.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={alert.isActive}
                      onChange={() => handleToggle(alert)}
                      style={{ marginRight: '8px' }}
                    />
                  </label>
                  <div>
                    <h4 style={{ margin: 0 }}>{getCategoryName(alert.categoryId)}</h4>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Alert when spending exceeds ${alert.threshold.toFixed(2)} / {alert.period}
                    </span>
                    {alert.lastTriggered && (
                      <div style={{ fontSize: '12px', color: 'var(--color-warning)', marginTop: '4px' }}>
                        Last triggered: {new Date(alert.lastTriggered).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(alert)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '13px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(alert)}
                    className="btn btn-outline-danger"
                    style={{ padding: '4px 12px', fontSize: '13px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
