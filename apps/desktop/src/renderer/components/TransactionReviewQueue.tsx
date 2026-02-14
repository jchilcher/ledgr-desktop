import { useEffect, useState, useCallback } from 'react';
import { Transaction, Category } from '../../shared/types';

type ReviewMode = 'card' | 'list';

export default function TransactionReviewQueue() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ReviewMode>('card');

  // Card mode state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // List mode state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [listCategories, setListCategories] = useState<Map<string, string>>(new Map());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allTransactions, allCategories] = await Promise.all([
        window.api.transactions.getAll(),
        window.api.categories.getAll(),
      ]);

      const uncategorized = allTransactions
        .filter((txn) => txn.categoryId === null || txn.categoryId === undefined)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(uncategorized);
      setCategories(allCategories);
      setCurrentIndex(0);
      setSelectedCategory('');
      setSelectedIds(new Set());
      setListCategories(new Map());

      // Fetch suggestions for uncategorized transactions
      const suggestionMap = new Map<string, string | null>();
      const suggestionPromises = uncategorized.slice(0, 50).map(async (txn) => {
        try {
          const suggested = await window.api.categoryRules.suggestCategory(txn.description);
          suggestionMap.set(txn.id, suggested);
        } catch {
          suggestionMap.set(txn.id, null);
        }
      });
      await Promise.all(suggestionPromises);
      setSuggestions(suggestionMap);
    } catch (error) {
      console.error('Failed to load review queue data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amountInCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  // Card mode: assign category to current transaction
  const assignCategory = useCallback(async (categoryId: string) => {
    const txn = transactions[currentIndex];
    if (!txn || !categoryId) return;

    try {
      await window.api.transactions.update(txn.id, { categoryId });
      setTransactions((prev) => prev.filter((_, i) => i !== currentIndex));
      if (currentIndex >= transactions.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
      setSelectedCategory('');
    } catch (error) {
      console.error('Failed to assign category:', error);
    }
  }, [currentIndex, transactions]);

  const acceptSuggestion = useCallback(() => {
    const txn = transactions[currentIndex];
    if (!txn) return;
    const suggested = suggestions.get(txn.id);
    if (suggested) {
      assignCategory(suggested);
    }
  }, [currentIndex, transactions, suggestions, assignCategory]);

  const skipTransaction = useCallback(() => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedCategory('');
    }
  }, [currentIndex, transactions.length]);

  const prevTransaction = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedCategory('');
    }
  }, [currentIndex]);

  // Keyboard shortcuts for card mode
  useEffect(() => {
    if (mode !== 'card' || transactions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Enter') {
        const txn = transactions[currentIndex];
        if (txn) {
          const suggested = suggestions.get(txn.id);
          if (suggested) {
            e.preventDefault();
            acceptSuggestion();
          } else if (selectedCategory) {
            e.preventDefault();
            assignCategory(selectedCategory);
          }
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        skipTransaction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, transactions, currentIndex, suggestions, selectedCategory, acceptSuggestion, skipTransaction, assignCategory]);

  // List mode: toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }, [selectedIds.size, transactions]);

  // List mode: set category for individual row
  const setRowCategory = useCallback((txnId: string, categoryId: string) => {
    setListCategories((prev) => {
      const next = new Map(prev);
      if (categoryId) {
        next.set(txnId, categoryId);
      } else {
        next.delete(txnId);
      }
      return next;
    });
  }, []);

  // List mode: apply individual row category
  const applyRowCategory = useCallback(async (txnId: string) => {
    const categoryId = listCategories.get(txnId);
    if (!categoryId) return;

    try {
      await window.api.transactions.update(txnId, { categoryId });
      setTransactions((prev) => prev.filter((t) => t.id !== txnId));
      setListCategories((prev) => {
        const next = new Map(prev);
        next.delete(txnId);
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(txnId);
        return next;
      });
    } catch (error) {
      console.error('Failed to assign category:', error);
    }
  }, [listCategories]);

  // List mode: bulk assign
  const bulkAssign = useCallback(async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    try {
      await window.api.transactions.bulkUpdateCategoryByIds(ids, bulkCategoryId);
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      setBulkCategoryId('');
    } catch (error) {
      console.error('Failed to bulk assign categories:', error);
    }
  }, [bulkCategoryId, selectedIds]);

  const currentTransaction = transactions[currentIndex] || null;
  const currentSuggestion = currentTransaction ? suggestions.get(currentTransaction.id) : null;

  // Get accounts for display
  const [accounts, setAccounts] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    window.api.accounts.getAll().then((accs) => {
      const map = new Map<string, string>();
      for (const acc of accs) {
        map.set(acc.id, acc.name);
      }
      setAccounts(map);
    }).catch(() => {});
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading review queue...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="review-queue" style={{ padding: '20px' }}>
        <h2>Transaction Review Queue</h2>
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>&#x2705;</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
            All caught up!
          </div>
          <p>No uncategorized transactions to review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-queue" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ marginBottom: 0 }}>Transaction Review Queue</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn ${mode === 'card' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('card')}
          >
            Card View
          </button>
          <button
            className={`btn ${mode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('list')}
          >
            List View
          </button>
        </div>
      </div>

      {mode === 'card' && currentTransaction && (
        <div>
          {/* Progress indicator */}
          <div className="review-queue-progress">
            {currentIndex + 1} of {transactions.length} to review
          </div>

          {/* Card */}
          <div className="review-queue-card">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
                {currentTransaction.description}
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: currentTransaction.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                marginBottom: 'var(--space-3)',
              }}>
                {formatCurrency(currentTransaction.amount)}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                <span>{formatDate(currentTransaction.date)}</span>
                <span>{accounts.get(currentTransaction.accountId) || 'Unknown Account'}</span>
              </div>
            </div>

            {/* Category selection */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '14px' }}>
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="review-queue-actions">
              {currentSuggestion && (
                <button className="btn btn-success" onClick={acceptSuggestion}>
                  Accept: {getCategoryName(currentSuggestion)} (Enter)
                </button>
              )}
              {selectedCategory && (
                <button className="btn btn-primary" onClick={() => assignCategory(selectedCategory)}>
                  Assign Selected
                </button>
              )}
              <button className="btn btn-secondary" onClick={prevTransaction} disabled={currentIndex === 0}>
                Previous
              </button>
              <button className="btn btn-secondary" onClick={skipTransaction} disabled={currentIndex >= transactions.length - 1}>
                Skip (Tab)
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'list' && (
        <div>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              marginBottom: 'var(--space-4)',
              backgroundColor: 'var(--color-primary-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-primary)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                {selectedIds.size} selected
              </span>
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                style={{ minWidth: '200px' }}
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={bulkAssign}
                disabled={!bulkCategoryId}
              >
                Categorize Selected
              </button>
            </div>
          )}

          {/* Table */}
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === transactions.length && transactions.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Category</th>
                <th style={{ width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => {
                const suggested = suggestions.get(txn.id);
                const rowCat = listCategories.get(txn.id) || '';
                return (
                  <tr key={txn.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(txn.id)}
                        onChange={() => toggleSelect(txn.id)}
                      />
                    </td>
                    <td>{formatDate(txn.date)}</td>
                    <td>{txn.description}</td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: txn.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {formatCurrency(txn.amount)}
                    </td>
                    <td>
                      <select
                        value={rowCat}
                        onChange={(e) => setRowCategory(txn.id, e.target.value)}
                        style={{ minWidth: '160px' }}
                      >
                        <option value="">
                          {suggested ? `Suggested: ${getCategoryName(suggested)}` : 'Select...'}
                        </option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {(rowCat || suggested) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (rowCat) {
                              applyRowCategory(txn.id);
                            } else if (suggested) {
                              setRowCategory(txn.id, suggested);
                              // Apply after setting — use direct API call
                              window.api.transactions.update(txn.id, { categoryId: suggested }).then(() => {
                                setTransactions((prev) => prev.filter((t) => t.id !== txn.id));
                              }).catch(() => {});
                            }
                          }}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          {rowCat ? 'Apply' : 'Accept'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
