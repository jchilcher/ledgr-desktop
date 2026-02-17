import React, { useState, useEffect } from 'react';
import { RecurringItemRule, RecurringItem, Account } from '../../shared/types';

const RecurringItemRules: React.FC = () => {
  const [rules, setRules] = useState<RecurringItemRule[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringItemRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRunRulesModal, setShowRunRulesModal] = useState(false);
  const [runRulesResult, setRunRulesResult] = useState<{ matched: number; total: number } | null>(null);
  const [runningRules, setRunningRules] = useState(false);

  const [formPattern, setFormPattern] = useState('');
  const [formRecurringItemId, setFormRecurringItemId] = useState('');
  const [formPriority, setFormPriority] = useState(50);
  const [formAmountMin, setFormAmountMin] = useState('');
  const [formAmountMax, setFormAmountMax] = useState('');
  const [formAccountFilter, setFormAccountFilter] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [patternTestCount, setPatternTestCount] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRules, allItems, allAccounts] = await Promise.all([
        window.api.recurringItemRules.getAll(),
        window.api.recurring.getAll(),
        window.api.accounts.getAll(),
      ]);
      allRules.sort((a, b) => b.priority - a.priority || a.pattern.localeCompare(b.pattern));
      setRules(allRules);
      setRecurringItems(allItems);
      setAccounts(allAccounts);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecurringItemName = (id: string): string => {
    const item = recurringItems.find(i => i.id === id);
    return item ? item.description : 'Unknown';
  };

  const filteredRules = rules.filter((rule) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const itemName = getRecurringItemName(rule.recurringItemId).toLowerCase();
    return rule.pattern.toLowerCase().includes(query) || itemName.includes(query);
  });

  const openAddModal = () => {
    setFormPattern('');
    setFormRecurringItemId(recurringItems[0]?.id || '');
    setFormPriority(50);
    setFormAmountMin('');
    setFormAmountMax('');
    setFormAccountFilter('');
    setEditingRule(null);
    setShowAddModal(true);
    setPatternTestCount(null);
  };

  const openEditModal = (rule: RecurringItemRule) => {
    setFormPattern(rule.pattern);
    setFormRecurringItemId(rule.recurringItemId);
    setFormPriority(rule.priority);
    setFormAmountMin(rule.amountMin != null ? (rule.amountMin / 100).toFixed(2) : '');
    setFormAmountMax(rule.amountMax != null ? (rule.amountMax / 100).toFixed(2) : '');
    setFormAccountFilter(rule.accountFilter || '');
    setEditingRule(rule);
    setShowAddModal(true);
    setPatternTestCount(null);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingRule(null);
  };

  const handleTestPattern = async () => {
    if (!formPattern.trim()) {
      setPatternTestCount(null);
      return;
    }
    try {
      const count = await window.api.transactions.countByPattern(formPattern.trim().toLowerCase());
      setPatternTestCount(count);
    } catch (error) {
      console.error('Error testing pattern:', error);
      setPatternTestCount(null);
    }
  };

  const handleSaveRule = async () => {
    if (!formPattern.trim() || !formRecurringItemId) return;

    const amountMinCents = formAmountMin ? Math.round(parseFloat(formAmountMin) * 100) : null;
    const amountMaxCents = formAmountMax ? Math.round(parseFloat(formAmountMax) * 100) : null;
    if (amountMinCents != null && amountMaxCents != null && amountMinCents > amountMaxCents) {
      window.alert('Minimum amount cannot be greater than maximum amount.');
      return;
    }

    const normalizedPattern = formPattern.trim().toLowerCase();

    const existingRule = rules.find(
      (r) => r.pattern.toLowerCase() === normalizedPattern && r.id !== editingRule?.id
    );

    if (existingRule) {
      const existingItem = getRecurringItemName(existingRule.recurringItemId);
      const confirmed = window.confirm(
        `A rule for "${normalizedPattern}" already exists (assigned to ${existingItem}). ` +
        `Saving will update the existing rule. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      if (editingRule) {
        await window.api.recurringItemRules.update(editingRule.id, {
          pattern: normalizedPattern,
          recurringItemId: formRecurringItemId,
          priority: formPriority,
          amountMin: amountMinCents,
          amountMax: amountMaxCents,
          accountFilter: formAccountFilter || null,
        });
      } else {
        await window.api.recurringItemRules.create({
          pattern: normalizedPattern,
          recurringItemId: formRecurringItemId,
          priority: formPriority,
          amountMin: amountMinCents,
          amountMax: amountMaxCents,
          accountFilter: formAccountFilter || null,
        });
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      closeModal();
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setShowDeleteConfirm(null);

    try {
      await window.api.recurringItemRules.delete(ruleId);
      await loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleRunRules = async () => {
    setRunningRules(true);
    setRunRulesResult(null);
    try {
      const result = await window.api.recurringItemRules.runRules();
      setRunRulesResult(result);
    } catch (error) {
      console.error('Error running rules:', error);
    } finally {
      setRunningRules(false);
    }
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    marginRight: '4px',
  };

  return (
    <div className="recurring-item-rules">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Payment Matching Rules</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => { setShowRunRulesModal(true); setRunRulesResult(null); }}
            className="btn btn-success"
          >
            ▶ Run Rules
          </button>
          <button
            onClick={openAddModal}
            className="btn btn-primary"
          >
            + Add Rule
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search rules by pattern or recurring item..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{
        backgroundColor: 'var(--color-info-bg)',
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <strong>How Rules Work:</strong> When transactions are imported, patterns are matched against descriptions.
        Higher priority rules (100 = highest) are checked first. When a match is found, the payment is automatically
        linked to the recurring item. Rules can also filter by amount range and specific accounts.
      </div>

      {loading ? (
        <p>Loading rules...</p>
      ) : (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '10px' }}>
            {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''} found
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Recurring Item</th>
                <th style={{ textAlign: 'center', width: '160px' }}>Conditions</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Priority</th>
                <th style={{ textAlign: 'center', width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const hasConditions = rule.amountMin != null || rule.amountMax != null || rule.accountFilter;
                const conditionParts: string[] = [];
                if (rule.amountMin != null && rule.amountMax != null) {
                  conditionParts.push(`$${(rule.amountMin / 100).toFixed(2)}–$${(rule.amountMax / 100).toFixed(2)}`);
                } else if (rule.amountMin != null) {
                  conditionParts.push(`≥ $${(rule.amountMin / 100).toFixed(2)}`);
                } else if (rule.amountMax != null) {
                  conditionParts.push(`≤ $${(rule.amountMax / 100).toFixed(2)}`);
                }
                if (rule.accountFilter) {
                  conditionParts.push('1 acct');
                }
                const condSummary = conditionParts.join(', ');

                return (
                  <tr key={rule.id}>
                    <td style={{ fontFamily: 'monospace' }}>{rule.pattern}</td>
                    <td>{getRecurringItemName(rule.recurringItemId)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {hasConditions ? (
                        <span
                          title={condSummary}
                          style={{ ...badgeStyle, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info-text, var(--color-text))' }}
                        >
                          Conditions
                        </span>
                      ) : (
                        <span style={{ ...badgeStyle, backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                          Basic
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        backgroundColor: rule.priority >= 80 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                      }}>
                        {rule.priority}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => openEditModal(rule)}
                        style={{
                          padding: '4px 12px',
                          marginRight: '8px',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-primary)',
                          color: 'var(--color-primary)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(rule.id)}
                        style={{
                          padding: '4px 12px',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-danger)',
                          color: 'var(--color-danger)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>
                    {searchQuery ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>No rules match your search.</span>
                    ) : (
                      <div>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚙️</div>
                        <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>No payment matching rules yet</p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>Rules auto-link transactions to recurring items as you import them.</p>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">Create Rule</button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showAddModal && (
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
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{editingRule ? 'Edit Rule' : 'Add Rule'}</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Pattern:
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  (matches anywhere in description, case-insensitive)
                </span>
              </label>
              <input
                type="text"
                value={formPattern}
                onChange={(e) => { setFormPattern(e.target.value); setPatternTestCount(null); }}
                placeholder="e.g., netflix, spotify, electric bill"
                style={{ width: '100%', padding: '8px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={handleTestPattern} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                  Test Pattern
                </button>
                {patternTestCount !== null && (
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Matches {patternTestCount} transaction{patternTestCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Recurring Item:
              </label>
              <select
                value={formRecurringItemId}
                onChange={(e) => setFormRecurringItemId(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
              >
                {recurringItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Priority: {formPriority}
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  (higher = checked first, 1-100)
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={formPriority}
                onChange={(e) => setFormPriority(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span>Low (1)</span>
                <span>Medium (50)</span>
                <span>High (100)</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Conditions (optional)
              </label>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Amount Range:
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Min ($)"
                    value={formAmountMin}
                    onChange={(e) => setFormAmountMin(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <span style={{ color: 'var(--color-text-muted)' }}>–</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Max ($)"
                    value={formAmountMax}
                    onChange={(e) => setFormAmountMax(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '4px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Account Filter:
                </label>
                <select
                  value={formAccountFilter}
                  onChange={(e) => setFormAccountFilter(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                >
                  <option value="">All Accounts</option>
                  {accounts.map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.name} ({acct.institution})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!formPattern.trim() || !formRecurringItemId}
                className="btn btn-success"
              >
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
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
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Delete Rule?</h3>
            <p>Are you sure you want to delete this payment matching rule?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRule(showDeleteConfirm)}
                className="btn btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showRunRulesModal && (
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
          onClick={() => setShowRunRulesModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Run Payment Matching Rules</h3>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Apply your {rules.length} rule{rules.length !== 1 ? 's' : ''} to existing transactions.
              This will automatically link matching transactions to their recurring payment records.
            </p>

            {runRulesResult && (
              <div style={{
                backgroundColor: runRulesResult.matched > 0 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                Matched <strong>{runRulesResult.matched}</strong> of {runRulesResult.total} transactions
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRunRulesModal(false)}
                className="btn btn-secondary"
              >
                {runRulesResult ? 'Close' : 'Cancel'}
              </button>
              {!runRulesResult && (
                <button
                  onClick={handleRunRules}
                  disabled={runningRules || rules.length === 0}
                  className="btn btn-success"
                >
                  {runningRules ? 'Running...' : 'Run Rules'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringItemRules;
