import React, { useState, useEffect } from 'react';
import { CategoryRule, Category } from '../../shared/types';

const CategoryRules: React.FC = () => {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRunRulesModal, setShowRunRulesModal] = useState(false);
  const [runRulesOnlyUncategorized, setRunRulesOnlyUncategorized] = useState(true);
  const [runRulesResult, setRunRulesResult] = useState<{ updated: number; total: number } | null>(null);
  const [runningRules, setRunningRules] = useState(false);
  
  // Form state
  const [formPattern, setFormPattern] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPriority, setFormPriority] = useState(50);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRules, allCategories] = await Promise.all([
        window.api.categoryRules.getAll(),
        window.api.categories.getAll(),
      ]);
      // Sort by priority (highest first), then by pattern
      allRules.sort((a, b) => b.priority - a.priority || a.pattern.localeCompare(b.pattern));
      setRules(allRules);
      setCategories(allCategories);
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId: string): string => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? `${category.icon || ''} ${category.name}`.trim() : 'Unknown';
  };

  const filteredRules = rules.filter((rule) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const categoryName = getCategoryName(rule.categoryId).toLowerCase();
    return rule.pattern.toLowerCase().includes(query) || categoryName.includes(query);
  });

  const openAddModal = () => {
    setFormPattern('');
    setFormCategoryId(categories[0]?.id || '');
    setFormPriority(50);
    setEditingRule(null);
    setShowAddModal(true);
  };

  const openEditModal = (rule: CategoryRule) => {
    setFormPattern(rule.pattern);
    setFormCategoryId(rule.categoryId);
    setFormPriority(rule.priority);
    setEditingRule(rule);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingRule(null);
  };

  const handleSaveRule = async () => {
    if (!formPattern.trim() || !formCategoryId) return;

    const normalizedPattern = formPattern.trim().toLowerCase();

    // Check for existing rule with same pattern (excluding the rule being edited)
    const existingRule = rules.find(
      (r) => r.pattern.toLowerCase() === normalizedPattern && r.id !== editingRule?.id
    );

    if (existingRule) {
      const existingCategory = getCategoryName(existingRule.categoryId);
      const confirmed = window.confirm(
        `A rule for "${normalizedPattern}" already exists (assigned to ${existingCategory}). ` +
        `Saving will update the existing rule. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      if (editingRule) {
        await window.api.categoryRules.update(editingRule.id, {
          pattern: normalizedPattern,
          categoryId: formCategoryId,
          priority: formPriority,
        });
      } else {
        await window.api.categoryRules.create({
          pattern: normalizedPattern,
          categoryId: formCategoryId,
          priority: formPriority,
        });
      }
      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      closeModal(); // Ensure modal closes even on error
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleDeleteRule = async (ruleId: string) => {
    setShowDeleteConfirm(null); // Close confirm dialog

    try {
      await window.api.categoryRules.delete(ruleId);
      await loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleRunRules = async () => {
    setRunningRules(true);
    setRunRulesResult(null);
    try {
      const result = await window.api.categoryRules.applyToTransactions(runRulesOnlyUncategorized);
      setRunRulesResult(result);
    } catch (error) {
      console.error('Error running rules:', error);
    } finally {
      setRunningRules(false);
    }
  };

  return (
    <div className="category-rules">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Categorization Rules</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => { setShowRunRulesModal(true); setRunRulesResult(null); }}
            className="btn btn-success"
            data-testid="run-rules-btn"
          >
            ▶ Run Rules
          </button>
          <button
            onClick={openAddModal}
            className="btn btn-primary"
            data-testid="add-rule-btn"
          >
            + Add Rule
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search rules by pattern or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '10px', fontSize: '14px', boxSizing: 'border-box' }}
          data-testid="rules-search"
        />
      </div>

      <div style={{
        backgroundColor: 'var(--color-info-bg)',
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <strong>ℹ️ How Rules Work:</strong> When importing transactions, patterns are matched against descriptions.
        Higher priority rules (100 = highest) are checked first. The pattern matches anywhere in the description.
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
                <th>Category</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Priority</th>
                <th style={{ textAlign: 'center', width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id}>
                  <td style={{ fontFamily: 'monospace' }}>{rule.pattern}</td>
                  <td>{getCategoryName(rule.categoryId)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: rule.priority >= 80 ? 'var(--color-success-bg)' : rule.priority >= 50 ? 'var(--color-warning-bg)' : 'var(--color-warning-bg)',
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
                      data-testid="edit-rule-btn"
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
                      data-testid="delete-rule-btn"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center' }}>
                    {searchQuery ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>No rules match your search.</span>
                    ) : (
                      <div>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>{'⚙️'}</div>
                        <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>No categorization rules yet</p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>Rules auto-sort transactions as you import them.</p>
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

      {/* Add/Edit Rule Modal */}
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
          data-testid="rule-modal-overlay"
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
            data-testid="rule-modal"
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
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="e.g., amazon, walmart, starbucks"
                style={{ width: '100%', padding: '8px', fontSize: '14px', fontFamily: 'monospace', boxSizing: 'border-box' }}
                data-testid="rule-pattern-input"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Category:
              </label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="rule-category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
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
                data-testid="rule-priority-input"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                <span>Low (1)</span>
                <span>Medium (50)</span>
                <span>High (100)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                className="btn btn-secondary"
                data-testid="rule-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!formPattern.trim() || !formCategoryId}
                className="btn btn-success"
                data-testid="rule-save-btn"
              >
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
          data-testid="delete-confirm-overlay"
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
            <p>Are you sure you want to delete this categorization rule?</p>
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

      {/* Run Rules Modal */}
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
          data-testid="run-rules-modal-overlay"
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
            <h3 style={{ marginTop: 0 }}>Run Categorization Rules</h3>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Apply your {rules.length} categorization rule{rules.length !== 1 ? 's' : ''} to existing transactions.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                <input
                  type="radio"
                  checked={runRulesOnlyUncategorized}
                  onChange={() => setRunRulesOnlyUncategorized(true)}
                />
                <span>
                  <strong>Only uncategorized transactions</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Won&apos;t change transactions you&apos;ve already categorized
                  </span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!runRulesOnlyUncategorized}
                  onChange={() => setRunRulesOnlyUncategorized(false)}
                />
                <span>
                  <strong>All transactions</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Re-categorize everything based on current rules (overwrites manual changes)
                  </span>
                </span>
              </label>
            </div>

            {runRulesResult && (
              <div style={{
                backgroundColor: runRulesResult.updated > 0 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                ✅ Updated <strong>{runRulesResult.updated}</strong> of {runRulesResult.total} transactions
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

export default CategoryRules;
