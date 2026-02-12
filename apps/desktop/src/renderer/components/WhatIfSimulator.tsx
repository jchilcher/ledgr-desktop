import React, { useState, useEffect } from 'react';

type ModificationType = 'cut_category' | 'add_income' | 'cancel_subscription' | 'pause_expense';

interface ScenarioModification {
  type: ModificationType;
  categoryId?: string;
  subscriptionId?: string;
  recurringItemId?: string;
  percentReduction?: number;
  amountChange?: number;
  label?: string; // For display
}

interface ScenarioResult {
  originalDaysUntilNegative: number | null;
  modifiedDaysUntilNegative: number | null;
  originalLowestBalance: number;
  modifiedLowestBalance: number;
  totalMonthlySavings: number;
  summary: string;
}

interface RecurringItem {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  categoryId?: string | null;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

const WhatIfSimulator: React.FC = () => {
  const [modifications, setModifications] = useState<ScenarioModification[]>([]);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{
    daysUntilNegative: number | null;
    lowestBalance: number;
  } | null>(null);

  // Form state
  const [newModType, setNewModType] = useState<ModificationType>('pause_expense');
  const [selectedRecurringId, setSelectedRecurringId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [percentReduction, setPercentReduction] = useState<number>(20);
  const [incomeAmount, setIncomeAmount] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [items, cats, status] = await Promise.all([
        window.api.recurring.getActive(),
        window.api.categories.getAll(),
        window.api.recoveryPlan.getEmergencyStatus(),
      ]);
      setRecurringItems(items.filter((i: RecurringItem) => i.amount < 0));
      setCategories(cats.filter((c: Category) => c.type === 'expense'));
      setCurrentStatus({
        daysUntilNegative: status.daysUntilNegative,
        lowestBalance: status.lowestProjectedBalance,
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleAddModification = () => {
    let mod: ScenarioModification | null = null;

    switch (newModType) {
      case 'pause_expense':
      case 'cancel_subscription': {
        const item = recurringItems.find(i => i.id === selectedRecurringId);
        if (item) {
          mod = {
            type: newModType,
            recurringItemId: selectedRecurringId,
            label: `Pause ${item.description}`,
          };
        }
        break;
      }
      case 'cut_category': {
        const cat = categories.find(c => c.id === selectedCategoryId);
        if (cat && percentReduction > 0) {
          mod = {
            type: 'cut_category',
            categoryId: selectedCategoryId,
            percentReduction,
            label: `Cut ${cat.name} by ${percentReduction}%`,
          };
        }
        break;
      }
      case 'add_income': {
        if (incomeAmount > 0) {
          mod = {
            type: 'add_income',
            amountChange: incomeAmount,
            label: `Add $${incomeAmount}/mo income`,
          };
        }
        break;
      }
    }

    if (mod) {
      setModifications([...modifications, mod]);
      // Reset form
      setSelectedRecurringId('');
      setSelectedCategoryId('');
      setIncomeAmount(0);
    }
  };

  const handleRemoveModification = (index: number) => {
    setModifications(modifications.filter((_, i) => i !== index));
    setResult(null);
  };

  const handleSimulate = async () => {
    if (modifications.length === 0) return;

    try {
      setLoading(true);
      setError(null);
      const simResult = await window.api.recoveryPlan.simulateScenario(
        modifications.map(m => ({
          type: m.type,
          categoryId: m.categoryId,
          subscriptionId: m.subscriptionId,
          recurringItemId: m.recurringItemId,
          percentReduction: m.percentReduction,
          amountChange: m.amountChange,
        }))
      );
      setResult(simResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setModifications([]);
    setResult(null);
  };

  const handleApplyAll = async () => {
    // Apply each modification that can be applied
    for (const mod of modifications) {
      if (mod.type === 'pause_expense' || mod.type === 'cancel_subscription') {
        if (mod.recurringItemId) {
          await window.api.recurring.update(mod.recurringItemId, { isActive: false });
        }
      }
    }
    // Reload and clear
    await loadData();
    setModifications([]);
    setResult(null);
  };

  return (
    <div className="what-if-simulator">
      <h3 style={{ marginBottom: '16px' }}>What-If Scenario Simulator</h3>

      {/* Current Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Current Days Until Negative</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: currentStatus && currentStatus.daysUntilNegative !== null ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {currentStatus && currentStatus.daysUntilNegative !== null ? `${currentStatus.daysUntilNegative} days` : 'Safe'}
          </div>
        </div>
        <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Lowest Projected Balance</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: (currentStatus?.lowestBalance ?? 0) < 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
            ${((currentStatus?.lowestBalance ?? 0) / 100).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Add Modification Panel */}
      <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div style={{ fontWeight: '500', marginBottom: '12px' }}>Add Modification</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Type</label>
            <select
              value={newModType}
              onChange={(e) => setNewModType(e.target.value as ModificationType)}
              style={{ minWidth: '150px' }}
            >
              <option value="pause_expense">Pause Expense</option>
              <option value="cut_category">Cut Category %</option>
              <option value="add_income">Add Income</option>
            </select>
          </div>

          {(newModType === 'pause_expense' || newModType === 'cancel_subscription') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Expense</label>
              <select
                value={selectedRecurringId}
                onChange={(e) => setSelectedRecurringId(e.target.value)}
                style={{ minWidth: '200px' }}
              >
                <option value="">Select expense...</option>
                {recurringItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.description} (${(Math.abs(item.amount) / 100).toFixed(0)}/{item.frequency.slice(0, 3)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {newModType === 'cut_category' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  style={{ minWidth: '150px' }}
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Reduction %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={percentReduction}
                  onChange={(e) => setPercentReduction(parseInt(e.target.value) || 0)}
                  style={{ width: '80px' }}
                />
              </div>
            </>
          )}

          {newModType === 'add_income' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Amount/month</label>
              <input
                type="number"
                min="0"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '120px' }}
                placeholder="$0"
              />
            </div>
          )}

          <button onClick={handleAddModification} className="btn btn-secondary">
            Add
          </button>
        </div>
      </div>

      {/* Current Modifications */}
      {modifications.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: '500', marginBottom: '8px' }}>Scenario Modifications ({modifications.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {modifications.map((mod, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                }}
              >
                <span>{mod.label}</span>
                <button
                  onClick={() => handleRemoveModification(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    fontSize: '16px',
                    padding: '0 4px',
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={handleSimulate}
          disabled={loading || modifications.length === 0}
          className="btn btn-primary"
        >
          {loading ? 'Simulating...' : 'Run Simulation'}
        </button>
        <button
          onClick={handleClear}
          disabled={modifications.length === 0}
          className="btn btn-secondary"
        >
          Clear All
        </button>
      </div>

      {/* Results */}
      {error && (
        <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '16px' }}>Simulation Results</div>

          {/* Comparison Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div></div>
            <div style={{ textAlign: 'center', fontWeight: '500', color: 'var(--color-text-muted)' }}>Current</div>
            <div style={{ textAlign: 'center', fontWeight: '500', color: 'var(--color-primary)' }}>With Changes</div>

            <div style={{ fontWeight: '500' }}>Days Until Negative</div>
            <div style={{ textAlign: 'center', color: result.originalDaysUntilNegative !== null ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {result.originalDaysUntilNegative !== null ? `${result.originalDaysUntilNegative} days` : 'Safe'}
            </div>
            <div style={{ textAlign: 'center', color: result.modifiedDaysUntilNegative !== null ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '600' }}>
              {result.modifiedDaysUntilNegative !== null ? `${result.modifiedDaysUntilNegative} days` : 'Safe'}
            </div>

            <div style={{ fontWeight: '500' }}>Lowest Balance</div>
            <div style={{ textAlign: 'center', color: result.originalLowestBalance < 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
              ${(result.originalLowestBalance / 100).toFixed(0)}
            </div>
            <div style={{ textAlign: 'center', color: result.modifiedLowestBalance < 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '600' }}>
              ${(result.modifiedLowestBalance / 100).toFixed(0)}
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: '12px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px' }}>{result.summary}</div>
            {result.totalMonthlySavings > 0 && (
              <div style={{ marginTop: '8px', color: 'var(--color-success)', fontWeight: '500' }}>
                Monthly savings: ${(result.totalMonthlySavings / 100).toFixed(0)}
              </div>
            )}
          </div>

          {/* Apply Button */}
          <button onClick={handleApplyAll} className="btn btn-success" style={{ width: '100%' }}>
            Apply All Changes
          </button>
        </div>
      )}

      {!result && modifications.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
          Add modifications above to see how they would affect your cash flow
        </div>
      )}
    </div>
  );
};

export default WhatIfSimulator;
