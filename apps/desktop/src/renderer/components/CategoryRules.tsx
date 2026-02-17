import React, { useState, useEffect } from 'react';
import { Category, Account, Tag, EnhancedCategoryRule, AutomationRuleAction, AutomationActionType } from '../../shared/types';

const CategoryRules: React.FC = () => {
  const [rules, setRules] = useState<EnhancedCategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<EnhancedCategoryRule | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRunRulesModal, setShowRunRulesModal] = useState(false);
  const [runRulesOnlyUncategorized, setRunRulesOnlyUncategorized] = useState(true);
  const [runRulesResult, setRunRulesResult] = useState<{ updated: number; total: number } | null>(null);
  const [runningRules, setRunningRules] = useState(false);

  // Basic form state
  const [formPattern, setFormPattern] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPriority, setFormPriority] = useState(50);

  // Enhanced conditions form state
  const [formAmountMin, setFormAmountMin] = useState('');
  const [formAmountMax, setFormAmountMax] = useState('');
  const [formAccountFilter, setFormAccountFilter] = useState<string[]>([]);
  const [formDirectionFilter, setFormDirectionFilter] = useState<'income' | 'expense' | ''>('');

  // Enhanced actions form state
  const [formActions, setFormActions] = useState<AutomationRuleAction[]>([]);
  const [pendingNewActions, setPendingNewActions] = useState<{ actionType: AutomationActionType; actionValue: string | null }[]>([]);
  const [actionsToDelete, setActionsToDelete] = useState<string[]>([]);

  // UI toggle state
  const [showConditions, setShowConditions] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionType, setNewActionType] = useState<AutomationActionType>('add_tag');
  const [newActionValue, setNewActionValue] = useState('');

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allRules, allCategories, allAccounts, allTags] = await Promise.all([
        window.api.automationActions.getEnhancedRules(),
        window.api.categories.getAll(),
        window.api.accounts.getAll(),
        window.api.tags.getAll(),
      ]);
      // Parse accountFilter from JSON string (comes as raw text from SQLite)
      const parsedRules = allRules.map(rule => ({
        ...rule,
        accountFilter: typeof rule.accountFilter === 'string'
          ? JSON.parse(rule.accountFilter as unknown as string) as string[]
          : rule.accountFilter,
      }));
      // Sort by priority (highest first), then by pattern
      parsedRules.sort((a, b) => b.priority - a.priority || a.pattern.localeCompare(b.pattern));
      setRules(parsedRules);
      setCategories(allCategories);
      setAccounts(allAccounts);
      setTags(allTags);
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

  const getTagName = (tagId: string): string => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown';
  };

  const hasEnhancedConditions = (rule: EnhancedCategoryRule): boolean => {
    return rule.amountMin != null || rule.amountMax != null ||
      (rule.accountFilter != null && rule.accountFilter.length > 0) ||
      rule.directionFilter != null;
  };

  const getConditionSummary = (rule: EnhancedCategoryRule): string => {
    const parts: string[] = [];
    if (rule.amountMin != null && rule.amountMax != null) {
      parts.push(`$${(rule.amountMin / 100).toFixed(2)}\u2013$${(rule.amountMax / 100).toFixed(2)}`);
    } else if (rule.amountMin != null) {
      parts.push(`\u2265 $${(rule.amountMin / 100).toFixed(2)}`);
    } else if (rule.amountMax != null) {
      parts.push(`\u2264 $${(rule.amountMax / 100).toFixed(2)}`);
    }
    if (rule.directionFilter) {
      parts.push(rule.directionFilter);
    }
    if (rule.accountFilter && rule.accountFilter.length > 0) {
      parts.push(`${rule.accountFilter.length} acct${rule.accountFilter.length !== 1 ? 's' : ''}`);
    }
    return parts.join(', ');
  };

  const actionLabel = (type: AutomationActionType): string => {
    switch (type) {
      case 'assign_category': return 'Assign Category';
      case 'add_tag': return 'Add Tag';
      case 'hide_from_reports': return 'Hide from Reports';
      case 'mark_transfer': return 'Mark as Transfer';
      default: return type;
    }
  };

  const getActionsSummary = (rule: EnhancedCategoryRule): string => {
    const extra = rule.actions.filter(a => a.actionType !== 'assign_category');
    if (extra.length === 0) return '';
    return extra.map(a => actionLabel(a.actionType)).join(', ');
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
    setFormAmountMin('');
    setFormAmountMax('');
    setFormAccountFilter([]);
    setFormDirectionFilter('');
    setFormActions([]);
    setPendingNewActions([]);
    setActionsToDelete([]);
    setShowConditions(false);
    setShowActions(false);
    setShowAddAction(false);
    setNewActionType('add_tag');
    setNewActionValue('');
    setEditingRule(null);
    setShowAddModal(true);
  };

  const openEditModal = (rule: EnhancedCategoryRule) => {
    setFormPattern(rule.pattern);
    setFormCategoryId(rule.categoryId);
    setFormPriority(rule.priority);
    setFormAmountMin(rule.amountMin != null ? (rule.amountMin / 100).toFixed(2) : '');
    setFormAmountMax(rule.amountMax != null ? (rule.amountMax / 100).toFixed(2) : '');
    setFormAccountFilter(rule.accountFilter || []);
    setFormDirectionFilter(rule.directionFilter || '');
    const extraActions = rule.actions.filter(a => a.actionType !== 'assign_category');
    setFormActions(extraActions);
    setPendingNewActions([]);
    setActionsToDelete([]);
    setShowConditions(hasEnhancedConditions(rule));
    setShowActions(extraActions.length > 0);
    setShowAddAction(false);
    setNewActionType('add_tag');
    setNewActionValue('');
    setEditingRule(rule);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingRule(null);
  };

  const handleSaveRule = async () => {
    if (!formPattern.trim() || !formCategoryId) return;

    // Validate amount range
    const amountMinCents = formAmountMin ? Math.round(parseFloat(formAmountMin) * 100) : null;
    const amountMaxCents = formAmountMax ? Math.round(parseFloat(formAmountMax) * 100) : null;
    if (amountMinCents != null && amountMaxCents != null && amountMinCents > amountMaxCents) {
      window.alert('Minimum amount cannot be greater than maximum amount.');
      return;
    }

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
      let ruleId: string;

      // Step 1: Save basic rule
      if (editingRule) {
        await window.api.categoryRules.update(editingRule.id, {
          pattern: normalizedPattern,
          categoryId: formCategoryId,
          priority: formPriority,
        });
        ruleId = editingRule.id;
      } else {
        const created = await window.api.categoryRules.create({
          pattern: normalizedPattern,
          categoryId: formCategoryId,
          priority: formPriority,
        });
        ruleId = created.id;
      }

      // Step 2: Save conditions
      await window.api.automationActions.updateRuleConditions(ruleId, {
        amountMin: amountMinCents,
        amountMax: amountMaxCents,
        accountFilter: formAccountFilter.length > 0 ? formAccountFilter : null,
        directionFilter: formDirectionFilter || null,
      });

      // Step 3: Delete removed actions
      for (const actionId of actionsToDelete) {
        await window.api.automationActions.delete(actionId);
      }

      // Step 4: Create new actions
      for (const action of pendingNewActions) {
        await window.api.automationActions.create({
          ruleId,
          actionType: action.actionType,
          actionValue: action.actionValue,
        });
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error saving rule:', error);
      closeModal();
    }
  };

  const handleAddPendingAction = () => {
    if (newActionType === 'add_tag' && !newActionValue) return;

    // Check for duplicates across existing + pending
    const allActions = [
      ...formActions.map(a => ({ actionType: a.actionType, actionValue: a.actionValue })),
      ...pendingNewActions,
    ];
    const isDuplicate = allActions.some(a => {
      if (a.actionType !== newActionType) return false;
      if (newActionType === 'add_tag') return a.actionValue === newActionValue;
      return true;
    });
    if (isDuplicate) return;

    const actionValue = newActionType === 'add_tag' ? newActionValue : 'true';
    setPendingNewActions(prev => [...prev, { actionType: newActionType, actionValue }]);
    setShowAddAction(false);
    setNewActionType('add_tag');
    setNewActionValue('');
  };

  const handleRemoveExistingAction = (actionId: string) => {
    setFormActions(prev => prev.filter(a => a.id !== actionId));
    setActionsToDelete(prev => [...prev, actionId]);
  };

  const handleRemovePendingAction = (index: number) => {
    setPendingNewActions(prev => prev.filter((_, i) => i !== index));
  };

  const toggleAccountFilter = (accountId: string) => {
    setFormAccountFilter(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleDeleteRule = async (ruleId: string) => {
    setShowDeleteConfirm(null);

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

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    marginRight: '4px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px 0',
    fontWeight: 'bold',
    fontSize: '14px',
    userSelect: 'none',
    color: 'var(--color-text)',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '12px',
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
        <strong>How Rules Work:</strong> When importing transactions, patterns are matched against descriptions.
        Higher priority rules (100 = highest) are checked first. Rules can also filter by amount range,
        transaction direction, and specific accounts. Additional actions like tagging or hiding from reports
        can be attached to any rule.
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
                <th style={{ textAlign: 'center', width: '160px' }}>Conditions</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Priority</th>
                <th style={{ textAlign: 'center', width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => {
                const enhanced = hasEnhancedConditions(rule);
                const condSummary = enhanced ? getConditionSummary(rule) : '';
                const actionsSummary = getActionsSummary(rule);
                return (
                  <tr key={rule.id}>
                    <td style={{ fontFamily: 'monospace' }}>{rule.pattern}</td>
                    <td>{getCategoryName(rule.categoryId)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {enhanced || actionsSummary ? (
                        <span>
                          {enhanced && (
                            <span
                              title={condSummary}
                              style={{ ...badgeStyle, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info-text, var(--color-text))' }}
                            >
                              Conditions
                            </span>
                          )}
                          {actionsSummary && (
                            <span
                              title={actionsSummary}
                              style={{ ...badgeStyle, backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning-text, var(--color-text))' }}
                            >
                              {rule.actions.filter(a => a.actionType !== 'assign_category').length} action{rule.actions.filter(a => a.actionType !== 'assign_category').length !== 1 ? 's' : ''}
                            </span>
                          )}
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
                );
              })}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center' }}>
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
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="rule-modal"
          >
            <h3 style={{ marginTop: 0 }}>{editingRule ? 'Edit Rule' : 'Add Rule'}</h3>

            {/* Pattern */}
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

            {/* Category */}
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

            {/* Priority */}
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

            {/* Conditions Section (collapsible) */}
            <div style={{ marginBottom: '16px' }}>
              <div
                onClick={() => setShowConditions(!showConditions)}
                style={sectionHeaderStyle}
              >
                <span>{showConditions ? '\u25BC' : '\u25B6'}</span>
                <span>Conditions</span>
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  (optional filters)
                </span>
              </div>

              {showConditions && (
                <div style={{ paddingLeft: '4px' }}>
                  {/* Amount Range */}
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
                        data-testid="rule-amount-min"
                      />
                      <span style={{ color: 'var(--color-text-muted)' }}>&ndash;</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Max ($)"
                        value={formAmountMax}
                        onChange={(e) => setFormAmountMax(e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', fontSize: '13px', boxSizing: 'border-box' }}
                        data-testid="rule-amount-max"
                      />
                    </div>
                  </div>

                  {/* Direction Filter */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Direction:
                    </label>
                    <select
                      value={formDirectionFilter}
                      onChange={(e) => setFormDirectionFilter(e.target.value as 'income' | 'expense' | '')}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                      data-testid="rule-direction-filter"
                    >
                      <option value="">Any</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>

                  {/* Account Filter */}
                  <div style={{ marginBottom: '4px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Accounts:
                      <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                        ({formAccountFilter.length === 0 ? 'all' : `${formAccountFilter.length} selected`})
                      </span>
                    </label>
                    <div style={{
                      maxHeight: '120px',
                      overflowY: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px',
                    }}>
                      {accounts.length === 0 ? (
                        <div style={{ padding: '8px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
                          No accounts found
                        </div>
                      ) : (
                        accounts.map(acct => (
                          <label
                            key={acct.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formAccountFilter.includes(acct.id)}
                              onChange={() => toggleAccountFilter(acct.id)}
                            />
                            <span>{acct.name}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>({acct.institution})</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Actions Section (collapsible) */}
            <div style={{ marginBottom: '20px' }}>
              <div
                onClick={() => setShowActions(!showActions)}
                style={sectionHeaderStyle}
              >
                <span>{showActions ? '\u25BC' : '\u25B6'}</span>
                <span>Additional Actions</span>
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  (tag, hide, transfer)
                </span>
              </div>

              {showActions && (
                <div style={{ paddingLeft: '4px' }}>
                  {/* Existing actions list */}
                  {formActions.length === 0 && pendingNewActions.length === 0 && (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 8px 0' }}>
                      No additional actions configured.
                    </p>
                  )}

                  {formActions.map(action => (
                    <div key={action.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: '4px',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                    }}>
                      <span>
                        {actionLabel(action.actionType)}
                        {action.actionType === 'add_tag' && action.actionValue && (
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                            ({getTagName(action.actionValue)})
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleRemoveExistingAction(action.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px 6px',
                        }}
                        title="Remove action"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Pending new actions */}
                  {pendingNewActions.map((action, idx) => (
                    <div key={`pending-${idx}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      marginBottom: '4px',
                      backgroundColor: 'var(--color-success-bg)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                    }}>
                      <span>
                        {actionLabel(action.actionType)}
                        {action.actionType === 'add_tag' && action.actionValue && (
                          <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                            ({getTagName(action.actionValue)})
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '6px' }}>(new)</span>
                      </span>
                      <button
                        onClick={() => handleRemovePendingAction(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-danger)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px 6px',
                        }}
                        title="Remove action"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Add Action form */}
                  {showAddAction ? (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <div style={{ marginBottom: '8px' }}>
                        <select
                          value={newActionType}
                          onChange={(e) => {
                            setNewActionType(e.target.value as AutomationActionType);
                            setNewActionValue('');
                          }}
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                          data-testid="new-action-type"
                        >
                          <option value="add_tag">Add Tag</option>
                          <option value="hide_from_reports">Hide from Reports</option>
                          <option value="mark_transfer">Mark as Transfer</option>
                        </select>
                      </div>

                      {newActionType === 'add_tag' && (
                        <div style={{ marginBottom: '8px' }}>
                          {tags.length === 0 ? (
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', margin: 0 }}>
                              No tags created yet. Create tags first to use this action.
                            </p>
                          ) : (
                            <select
                              value={newActionValue}
                              onChange={(e) => setNewActionValue(e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                              data-testid="new-action-tag-select"
                            >
                              <option value="">Select a tag...</option>
                              {tags.map(tag => (
                                <option key={tag.id} value={tag.id}>
                                  {tag.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setShowAddAction(false); setNewActionValue(''); }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddPendingAction}
                          disabled={newActionType === 'add_tag' && (!newActionValue || tags.length === 0)}
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: '12px' }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddAction(true)}
                      style={{
                        marginTop: '8px',
                        padding: '4px 12px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--color-primary)',
                        width: '100%',
                      }}
                    >
                      + Add Action
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Buttons */}
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
            <p>Are you sure you want to delete this categorization rule? Any associated conditions and actions will also be removed.</p>
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
                Updated <strong>{runRulesResult.updated}</strong> of {runRulesResult.total} transactions
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
