import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, Account, Category, TransactionReimbursement } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableNumber, EditableDate, EditableSelect } from './inline-edit';
import ReimbursementModal from './ReimbursementModal';
import SplitTransactionModal from './SplitTransactionModal';
import AttachmentPanel from './AttachmentPanel';

// Inline notes cell with click-to-edit behavior
const NotesCell: React.FC<{ value: string; onSave: (value: string) => void }> = ({ value, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{
          cursor: 'pointer',
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minHeight: '1.2em',
          color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
          fontStyle: value ? 'normal' : 'italic',
        }}
        title={value || 'Click to add notes'}
      >
        {value || 'Add note...'}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      autoFocus
      style={{
        width: '100%',
        fontSize: '12px',
        padding: '2px 4px',
        boxSizing: 'border-box',
      }}
      placeholder="Add note..."
    />
  );
};

interface TransactionListProps {
  accountId?: string | null;
}

type SortColumn = 'date' | 'description' | 'amount' | 'category';
type SortDirection = 'asc' | 'desc';

interface BulkCategoryModal {
  isOpen: boolean;
  description: string;
  currentCategoryId: string;
  matchCount: number;
  pattern: string;
  sampleMatches: Transaction[];
}

interface BulkSelectionCategoryModal {
  isOpen: boolean;
  selectedCategoryId: string;
}

interface EditFormData {
  id: string;
  date: string;
  description: string;
  amount: string;
  categoryId: string;
}

const TransactionList: React.FC<TransactionListProps> = ({ accountId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Category suggestions for uncategorized transactions
  const [suggestions, setSuggestions] = useState<Map<string, string>>(new Map());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccountId, setFilterAccountId] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Bulk categorization modal
  const [bulkModal, setBulkModal] = useState<BulkCategoryModal>({
    isOpen: false,
    description: '',
    currentCategoryId: '',
    matchCount: 0,
    pattern: '',
    sampleMatches: [],
  });
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [createRule, setCreateRule] = useState(true);
  const [patternLoading, setPatternLoading] = useState(false);
  const [bulkFilterCategory, setBulkFilterCategory] = useState<string | null>(null); // null = all, 'uncategorized', or specific categoryId

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSelectionCategoryModal, setBulkSelectionCategoryModal] = useState<BulkSelectionCategoryModal>({
    isOpen: false,
    selectedCategoryId: '',
  });

  // Reimbursement state
  const [reimbursementLinks, setReimbursementLinks] = useState<TransactionReimbursement[]>([]);
  const [reimbursementModalTx, setReimbursementModalTx] = useState<Transaction | null>(null);

  // Split transaction state
  const [splitModalTx, setSplitModalTx] = useState<Transaction | null>(null);
  const [splitTransactionIds, setSplitTransactionIds] = useState<Set<string>>(new Set());

  // Attachment state
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [attachmentPanelTx, setAttachmentPanelTx] = useState<Transaction | null>(null);

  // Show hidden transactions toggle (default: off)
  const [showHidden, setShowHidden] = useState(false);

  // Scroll position preservation
  const scrollPositionRef = useRef<number | null>(null);

  // Add transaction modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    categoryId: '',
    accountId: '',
    isExpense: true,
  });

  // Inline edit hook for full row editing
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      const amount = parseFloat(data.amount || '0');
      if (isNaN(amount)) {
        throw new Error('Please enter a valid amount');
      }

      if (!data.description?.trim()) {
        throw new Error('Description is required');
      }

      // Convert dollars to cents for storage
      const amountInCents = Math.round(amount * 100);

      await window.api.transactions.update(id, {
        date: data.date ? new Date(data.date) : undefined,
        description: data.description.trim(),
        amount: amountInCents,
        categoryId: data.categoryId || null,
      });
      await loadData();
    },
    validateField: (field, value) => {
      if (field === 'description' && (!value || !(value as string).trim())) {
        return 'Required';
      }
      if (field === 'amount') {
        const num = parseFloat(value as string);
        if (isNaN(num)) {
          return 'Invalid';
        }
      }
      return null;
    },
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // Restore scroll position after data reload
  useEffect(() => {
    if (!loading && scrollPositionRef.current !== null) {
      const savedPosition = scrollPositionRef.current;
      scrollPositionRef.current = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
      });
    }
  }, [loading]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, filterAccountId, filterCategoryId, startDate, endDate, minAmount, maxAmount]);

  const loadData = async () => {
    try {
      scrollPositionRef.current = window.scrollY;
      setLoading(true);
      const [allTransactions, allAccounts, allCategories, allReimbursementLinks, allSplitIds] = await Promise.all([
        accountId
          ? window.api.transactions.getByAccount(accountId)
          : window.api.transactions.getAll(),
        window.api.accounts.getAll(),
        window.api.categories.getAll(),
        window.api.reimbursements.getAll().catch(() => []),
        window.api.splits.getTransactionIds().catch(() => []),
      ]);
      setTransactions(allTransactions);
      setAccounts(allAccounts);
      setCategories(allCategories);
      setReimbursementLinks(allReimbursementLinks);
      setSplitTransactionIds(new Set(allSplitIds));

      // Load attachment counts for visible transactions
      const txIds = allTransactions.map(t => t.id);
      if (txIds.length > 0) {
        const counts = await window.api.attachments.getCountsByTransactionIds(txIds).catch(() => ({}));
        setAttachmentCounts(counts);
      }

      // Compute suggestions for uncategorized transactions
      await computeSuggestions(allTransactions, allCategories);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeSuggestions = async (txList: Transaction[], cats: Category[]) => {
    // Find the "Uncategorized" category to treat those transactions as needing suggestions
    const uncategorizedCategory = cats.find(c => c.name === 'Uncategorized');
    const uncategorizedId = uncategorizedCategory?.id;

    // Include transactions with no category OR with the "Uncategorized" category
    const needsSuggestion = txList.filter(tx =>
      !tx.categoryId || tx.categoryId === uncategorizedId
    );
    const newSuggestions = new Map<string, string>();

    // Process suggestions in parallel for better performance
    const suggestionPromises = needsSuggestion.map(async (tx) => {
      const suggested = await window.api.categoryRules.suggestCategory(tx.description);
      // Only suggest if it's different from the current category
      if (suggested && suggested !== tx.categoryId) {
        return { id: tx.id, categoryId: suggested };
      }
      return null;
    });

    const results = await Promise.all(suggestionPromises);
    results.forEach(result => {
      if (result) {
        newSuggestions.set(result.id, result.categoryId);
      }
    });

    setSuggestions(newSuggestions);
  };

  const handleAcceptSuggestion = async (transactionId: string, categoryId: string) => {
    await handleCategoryChange(transactionId, categoryId);
    // Remove the suggestion since the transaction is now categorized
    setSuggestions(prev => {
      const newMap = new Map(prev);
      newMap.delete(transactionId);
      return newMap;
    });
  };

  const getCategoryName = (categoryId: string | null | undefined): string => {
    if (!categoryId) return 'Unknown';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getAccountName = (accId: string | null | undefined): string => {
    if (!accId) return 'Unknown';
    const account = accounts.find((a) => a.id === accId);
    return account ? account.name : 'Unknown';
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Apply filters and sorting
  const filteredAndSortedTransactions = transactions
    .filter((tx) => {
      // Hidden filter: hide hidden transactions unless toggle is on
      if (!showHidden && tx.isHidden) {
        return false;
      }

      // Search filter
      if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Account filter
      if (filterAccountId && tx.accountId !== filterAccountId) {
        return false;
      }

      // Category filter
      if (filterCategoryId && tx.categoryId !== filterCategoryId) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const txDate = new Date(tx.date);
        const start = new Date(startDate);
        if (txDate < start) return false;
      }
      if (endDate) {
        const txDate = new Date(tx.date);
        const end = new Date(endDate);
        if (txDate > end) return false;
      }

      // Amount filter (user enters dollars, tx.amount is in cents)
      if (minAmount && tx.amount < parseFloat(minAmount) * 100) {
        return false;
      }
      if (maxAmount && tx.amount > parseFloat(maxAmount) * 100) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'category':
          comparison = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  const resetFilters = () => {
    setSearchQuery('');
    setFilterAccountId('');
    setFilterCategoryId('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setCurrentPage(1);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString();
  };

  // Compute reimbursement summaries client-side from flat links list
  const reimbursementSummaries = useMemo(() => {
    const expenseMap = new Map<string, number>(); // expenseId -> total reimbursed
    const incomeSet = new Set<string>(); // income tx IDs that are reimbursements
    for (const link of reimbursementLinks) {
      expenseMap.set(link.expenseTransactionId, (expenseMap.get(link.expenseTransactionId) || 0) + link.amount);
      incomeSet.add(link.reimbursementTransactionId);
    }
    return { expenseMap, incomeSet };
  }, [reimbursementLinks]);

  const getReimbursementInfo = (tx: Transaction) => {
    if (tx.amount < 0) {
      const totalReimbursed = reimbursementSummaries.expenseMap.get(tx.id) || 0;
      if (totalReimbursed === 0) return { status: 'none' as const, totalReimbursed: 0, netAmount: Math.abs(tx.amount) };
      const originalAmount = Math.abs(tx.amount);
      const status = totalReimbursed >= originalAmount ? 'full' as const : 'partial' as const;
      return { status, totalReimbursed, netAmount: originalAmount - totalReimbursed };
    }
    if (reimbursementSummaries.incomeSet.has(tx.id)) {
      return { status: 'is_reimbursement' as const, totalReimbursed: 0, netAmount: tx.amount };
    }
    return null;
  };

  const formatAmount = (amount: number): string => {
    const dollars = amount / 100;
    const formatted = Math.abs(dollars).toFixed(2);
    return dollars < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const handleCategoryChange = async (transactionId: string, newCategoryId: string) => {
    try {
      await window.api.transactions.update(transactionId, { categoryId: newCategoryId });
      // Reload data to reflect changes
      await loadData();
    } catch (error) {
      console.error('Error updating transaction category:', error);
    }
  };

  const handleToggleInternalTransfer = async (transactionId: string, currentValue: boolean) => {
    try {
      await window.api.transactions.update(transactionId, { isInternalTransfer: !currentValue });
      await loadData();
    } catch (error) {
      console.error('Error toggling internal transfer:', error);
    }
  };

  const handleToggleHidden = async (transactionId: string, currentValue: boolean) => {
    try {
      await window.api.transactions.update(transactionId, { isHidden: !currentValue });
      await loadData();
    } catch (error) {
      console.error('Error toggling hidden status:', error);
    }
  };

  const handleNotesChange = async (transactionId: string, notes: string) => {
    try {
      await window.api.transactions.update(transactionId, { notes: notes || null });
      await loadData();
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handleStartInlineEdit = (tx: Transaction) => {
    inlineEdit.startEdit(tx.id, {
      id: tx.id,
      date: tx.date instanceof Date
        ? tx.date.toISOString().split('T')[0]
        : new Date(tx.date).toISOString().split('T')[0],
      description: tx.description,
      amount: (tx.amount / 100).toString(), // Convert cents to dollars for editing
      categoryId: tx.categoryId || '',
    });
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!confirm(`Delete transaction "${tx.description}"?`)) return;
    try {
      await window.api.transactions.delete(tx.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const openBulkCategoryModal = async (description: string, currentCategoryId: string) => {
    try {
      // Extract a smart default pattern from the description
      const defaultPattern = extractDefaultPattern(description);
      // Default to filtering by current category if it's set
      const defaultFilter = currentCategoryId || 'uncategorized';
      const [count, samples] = await Promise.all([
        window.api.transactions.countByPattern(defaultPattern, defaultFilter),
        window.api.transactions.samplesByPattern(defaultPattern, 5, defaultFilter),
      ]);
      setBulkModal({
        isOpen: true,
        description,
        currentCategoryId,
        matchCount: count,
        pattern: defaultPattern,
        sampleMatches: samples,
      });
      setBulkCategoryId(currentCategoryId);
      setBulkFilterCategory(defaultFilter);
      setCreateRule(true);
    } catch (error) {
      console.error('Error getting transaction count:', error);
    }
  };

  // Extract a smart default pattern from description
  const extractDefaultPattern = (description: string): string => {
    let pattern = description.toLowerCase();
    // Remove common suffixes: numbers, dates, reference codes
    pattern = pattern.replace(/\s+#\d+$/i, '');
    pattern = pattern.replace(/\s+\*[\w\d]+$/i, '');
    pattern = pattern.replace(/\s+\d{4,}$/i, '');
    pattern = pattern.replace(/\s+x{2,}\d+$/i, '');
    pattern = pattern.replace(/\s+to\s+x+\d+$/i, '');
    pattern = pattern.replace(/\s+\d{1,2}\/\d{1,2}$/i, '');
    return pattern.trim();
  };

  // Update match count when pattern or filter changes
  const updatePatternPreview = async (newPattern: string, newFilter?: string | null) => {
    const pattern = newPattern;
    const filter = newFilter !== undefined ? newFilter : bulkFilterCategory;
    
    setBulkModal(prev => ({ ...prev, pattern }));
    
    if (!pattern.trim()) {
      setBulkModal(prev => ({ ...prev, matchCount: 0, sampleMatches: [] }));
      return;
    }

    setPatternLoading(true);
    try {
      const [count, samples] = await Promise.all([
        window.api.transactions.countByPattern(pattern, filter),
        window.api.transactions.samplesByPattern(pattern, 5, filter),
      ]);
      setBulkModal(prev => ({ ...prev, matchCount: count, sampleMatches: samples }));
    } catch (error) {
      console.error('Error updating pattern preview:', error);
    } finally {
      setPatternLoading(false);
    }
  };

  // Update preview when filter changes
  const updateFilterCategory = async (newFilter: string | null) => {
    setBulkFilterCategory(newFilter);
    await updatePatternPreview(bulkModal.pattern, newFilter);
  };

  const closeBulkModal = () => {
    setBulkModal({
      isOpen: false,
      description: '',
      currentCategoryId: '',
      matchCount: 0,
      pattern: '',
      sampleMatches: [],
    });
    setBulkFilterCategory(null);
  };

  const handleBulkCategoryUpdate = async () => {
    if (!bulkModal.pattern.trim()) return;
    
    try {
      await window.api.transactions.bulkUpdateCategory(
        bulkModal.pattern,
        bulkCategoryId,
        createRule,
        bulkFilterCategory
      );
      closeBulkModal();
      await loadData();
    } catch (error) {
      console.error('Error bulk updating categories:', error);
    }
  };

  const openAddModal = () => {
    setNewTransaction({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      categoryId: categories[0]?.id || '',
      accountId: accounts[0]?.id || '',
      isExpense: true,
    });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.description.trim() || !newTransaction.amount || !newTransaction.accountId) {
      return;
    }

    try {
      const amount = parseFloat(newTransaction.amount);
      const finalAmount = newTransaction.isExpense ? -Math.abs(amount) : Math.abs(amount);
      // Convert dollars to cents for storage
      const amountInCents = Math.round(finalAmount * 100);

      await window.api.transactions.create({
        date: new Date(newTransaction.date),
        description: newTransaction.description.trim(),
        amount: amountInCents,
        categoryId: newTransaction.categoryId || null,
        accountId: newTransaction.accountId,
        isRecurring: false,
        importSource: 'file',
      });
      
      closeAddModal();
      await loadData();
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  // Bulk selection handlers
  const handleSelectTransaction = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = (selected: boolean) => {
    if (selected) {
      const visibleIds = paginatedTransactions.map(tx => tx.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    } else {
      // Deselect only visible transactions
      const visibleIds = new Set(paginatedTransactions.map(tx => tx.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const handleSelectAllMatching = () => {
    const allMatchingIds = filteredAndSortedTransactions.map(tx => tx.id);
    setSelectedIds(new Set(allMatchingIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected transaction${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    try {
      await window.api.transactions.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error bulk deleting transactions:', error);
    }
  };

  const openBulkSelectionCategoryModal = () => {
    setBulkSelectionCategoryModal({
      isOpen: true,
      selectedCategoryId: categories[0]?.id || '',
    });
  };

  const closeBulkSelectionCategoryModal = () => {
    setBulkSelectionCategoryModal({
      isOpen: false,
      selectedCategoryId: '',
    });
  };

  const handleBulkSelectionCategoryUpdate = async () => {
    if (selectedIds.size === 0 || !bulkSelectionCategoryModal.selectedCategoryId) return;

    try {
      await window.api.transactions.bulkUpdateCategoryByIds(
        Array.from(selectedIds),
        bulkSelectionCategoryModal.selectedCategoryId
      );
      closeBulkSelectionCategoryModal();
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Error bulk updating categories:', error);
    }
  };

  // Compute selection state for header checkbox
  const allVisibleSelected = paginatedTransactions.length > 0 &&
    paginatedTransactions.every(tx => selectedIds.has(tx.id));
  const someVisibleSelected = paginatedTransactions.some(tx => selectedIds.has(tx.id));
  const isIndeterminate = someVisibleSelected && !allVisibleSelected;

  return (
    <div className="transaction-list">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', flex: 1, marginRight: 'var(--space-3)' }}>
          <strong>💡 Tip:</strong> Use the &quot;Apply to All&quot; button in the Actions column to categorize multiple similar transactions at once!
        </div>
        <button
          onClick={openAddModal}
          className="btn btn-primary"
          data-testid="add-transaction-btn"
        >
          + Add Transaction
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-primary-bg)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
          data-testid="bulk-action-bar"
        >
          <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {selectedIds.size} selected
          </span>

          {selectedIds.size < filteredAndSortedTransactions.length && (
            <button
              onClick={handleSelectAllMatching}
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: '13px' }}
              data-testid="select-all-matching-btn"
            >
              Select all {filteredAndSortedTransactions.length} matching
            </button>
          )}

          <button
            onClick={handleClearSelection}
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '13px' }}
            data-testid="clear-selection-btn"
          >
            Clear selection
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={openBulkSelectionCategoryModal}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            data-testid="bulk-set-category-btn"
          >
            Set Category
          </button>

          <button
            onClick={handleBulkDelete}
            className="btn btn-outline-danger"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            data-testid="bulk-delete-btn"
          >
            Delete Selected
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Filters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search description..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            data-testid="search-input"
          />

          <select
            value={filterAccountId}
            onChange={(e) => { setFilterAccountId(e.target.value); setCurrentPage(1); }}
            data-testid="account-filter"
          >
            <option value="">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategoryId}
            onChange={(e) => { setFilterCategoryId(e.target.value); setCurrentPage(1); }}
            data-testid="category-filter"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            placeholder="Start Date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            data-testid="start-date"
          />

          <input
            type="date"
            placeholder="End Date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            data-testid="end-date"
          />

          <input
            type="number"
            placeholder="Min Amount"
            value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }}
            data-testid="min-amount"
          />

          <input
            type="number"
            placeholder="Max Amount"
            value={maxAmount}
            onChange={(e) => { setMaxAmount(e.target.value); setCurrentPage(1); }}
            data-testid="max-amount"
          />

          <button onClick={resetFilters} className="btn btn-secondary" data-testid="reset-filters">
            Reset Filters
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => { setShowHidden(e.target.checked); setCurrentPage(1); }}
              data-testid="show-hidden-toggle"
            />
            Show hidden
          </label>
        </div>
      </div>

      {loading ? (
        <p>Loading transactions...</p>
      ) : (
        <>
          <p data-testid="transaction-count">
            Showing {paginatedTransactions.length} of {filteredAndSortedTransactions.length} transactions
          </p>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '850px' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = isIndeterminate;
                      }
                    }}
                    onChange={(e) => handleSelectAllVisible(e.target.checked)}
                    title="Select all visible transactions"
                    aria-label="Select all visible transactions"
                  />
                </th>
                <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('description')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Description {sortColumn === 'description' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Amount {sortColumn === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                  Category {sortColumn === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Account</th>
                <th style={{ minWidth: '120px' }}>Notes</th>
                <th style={{ whiteSpace: 'nowrap' }} title="Internal transfers are excluded from spending reports">Transfer</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }} title="Hide from reports and analytics">Hide</th>
                <th style={{ whiteSpace: 'nowrap' }} title="Reimbursement status">Reimb.</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((tx) => {
                const isEditing = inlineEdit.editingId === tx.id;
                const editData = inlineEdit.editData as EditFormData;

                const categoryOptions = categories.map(cat => ({
                  value: cat.id,
                  label: cat.name,
                  icon: cat.icon,
                }));

                if (isEditing) {
                  return (
                    <tr key={tx.id} className="inline-edit-row" data-testid="transaction-row" onKeyDown={inlineEdit.handleKeyDown}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                          disabled={inlineEdit.isSubmitting}
                          aria-label={`Select transaction ${tx.description}`}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <EditableDate
                          value={editData.date || ''}
                          isEditing={true}
                          onChange={(v) => inlineEdit.updateField('date', v)}
                          onKeyDown={inlineEdit.handleKeyDown}
                          disabled={inlineEdit.isSubmitting}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <EditableText
                          value={editData.description || ''}
                          isEditing={true}
                          onChange={(v) => inlineEdit.updateField('description', v)}
                          onKeyDown={inlineEdit.handleKeyDown}
                          error={inlineEdit.errors.description}
                          disabled={inlineEdit.isSubmitting}
                          autoFocus
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
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
                      </td>
                      <td style={{ padding: '8px' }}>
                        <EditableSelect
                          value={editData.categoryId || ''}
                          isEditing={true}
                          options={categoryOptions}
                          onChange={(v) => inlineEdit.updateField('categoryId', v)}
                          onKeyDown={inlineEdit.handleKeyDown}
                          allowEmpty
                          emptyLabel="Uncategorized"
                          disabled={inlineEdit.isSubmitting}
                        />
                      </td>
                      <td>{getAccountName(tx.accountId)}</td>
                      <td style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {tx.notes || ''}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={tx.isInternalTransfer || false}
                          onChange={() => handleToggleInternalTransfer(tx.id, tx.isInternalTransfer || false)}
                          title="Mark as internal transfer (excluded from spending reports)"
                          disabled={inlineEdit.isSubmitting}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleHidden(tx.id, tx.isHidden || false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '2px 6px',
                            opacity: tx.isHidden ? 1 : 0.4,
                          }}
                          title={tx.isHidden ? 'Unhide transaction (include in reports)' : 'Hide transaction (exclude from reports)'}
                          disabled={inlineEdit.isSubmitting}
                        >
                          {tx.isHidden ? '\u{1F6AB}' : '\u{1F441}'}
                        </button>
                      </td>
                      <td></td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => inlineEdit.saveEdit()}
                            className="btn btn-success"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            disabled={inlineEdit.isSubmitting}
                          >
                            {inlineEdit.isSubmitting ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={inlineEdit.cancelEdit}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            disabled={inlineEdit.isSubmitting}
                          >
                            Cancel
                          </button>
                        </div>
                        {inlineEdit.errors._form && (
                          <div className="inline-edit-error" style={{ marginTop: '4px' }}>
                            {inlineEdit.errors._form}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={tx.id} data-testid="transaction-row" className={selectedIds.has(tx.id) ? 'selected-row' : ''} style={tx.isHidden ? { opacity: 0.5 } : undefined}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tx.id)}
                        onChange={(e) => handleSelectTransaction(tx.id, e.target.checked)}
                        aria-label={`Select transaction ${tx.description}`}
                        data-testid="transaction-checkbox"
                      />
                    </td>
                    <td>{formatDate(tx.date)}</td>
                    <td>
                      {tx.description}
                      {splitTransactionIds.has(tx.id) && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: 'var(--color-primary)',
                            background: 'var(--color-primary-bg, rgba(59, 130, 246, 0.1))',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSplitModalTx(tx)}
                          title="This transaction has category splits"
                        >
                          Split
                        </span>
                      )}
                      {attachmentCounts[tx.id] > 0 && (
                        <span
                          className="attachment-indicator"
                          onClick={() => setAttachmentPanelTx(tx)}
                          title={`${attachmentCounts[tx.id]} attachment${attachmentCounts[tx.id] > 1 ? 's' : ''}`}
                        >
                          {'\u{1F4CE}'} {attachmentCounts[tx.id]}
                        </span>
                      )}
                    </td>
                    <td style={{ color: tx.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {formatAmount(tx.amount)}
                      {(() => {
                        const info = getReimbursementInfo(tx);
                        if (info && (info.status === 'partial' || info.status === 'full')) {
                          return (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Net: {formatAmount(-info.netAmount)}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td>
                      {/* Show suggestion for uncategorized transactions (including those with "Uncategorized" category) */}
                      {suggestions.has(tx.id) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              color: 'var(--color-text-muted)',
                              fontStyle: 'italic',
                              fontSize: '13px',
                            }}>
                              Suggested: {getCategoryName(suggestions.get(tx.id) || null)}
                            </span>
                            <button
                              onClick={() => handleAcceptSuggestion(tx.id, suggestions.get(tx.id)!)}
                              className="btn btn-success"
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                minWidth: 'auto',
                              }}
                              title="Accept this suggestion"
                              data-testid="accept-suggestion-btn"
                            >
                              Accept
                            </button>
                          </div>
                          <select
                            value=""
                            onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                            style={{ width: '100%', fontSize: '12px' }}
                            data-testid="category-dropdown"
                          >
                            <option value="" disabled>Choose different...</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <select
                          value={tx.categoryId || ''}
                          onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                          style={{ width: '100%' }}
                          data-testid="category-dropdown"
                        >
                          {!tx.categoryId && (
                            <option value="">Select category...</option>
                          )}
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{getAccountName(tx.accountId)}</td>
                    <td style={{ maxWidth: '200px', fontSize: '12px' }}>
                      <NotesCell
                        value={tx.notes || ''}
                        onSave={(val) => handleNotesChange(tx.id, val)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={tx.isInternalTransfer || false}
                        onChange={() => handleToggleInternalTransfer(tx.id, tx.isInternalTransfer || false)}
                        title="Mark as internal transfer (excluded from spending reports)"
                        data-testid="internal-transfer-checkbox"
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleHidden(tx.id, tx.isHidden || false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '2px 6px',
                          opacity: tx.isHidden ? 1 : 0.4,
                        }}
                        title={tx.isHidden ? 'Unhide transaction (include in reports)' : 'Hide transaction (exclude from reports)'}
                        data-testid="hide-toggle-btn"
                      >
                        {tx.isHidden ? '\u{1F6AB}' : '\u{1F441}'}
                      </button>
                      {tx.isHidden && (
                        <span style={{
                          display: 'block',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--color-warning)',
                        }}>
                          Hidden
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const info = getReimbursementInfo(tx);
                        if (!info) return null;
                        if (info.status === 'is_reimbursement') {
                          return (
                            <span title="This income is linked as a reimbursement" style={{ color: 'var(--color-info, #3b82f6)', fontSize: '13px' }}>
                              Linked
                            </span>
                          );
                        }
                        if (info.status === 'none') return null;
                        return (
                          <span
                            onClick={() => setReimbursementModalTx(tx)}
                            style={{
                              cursor: 'pointer',
                              color: info.status === 'full' ? 'var(--color-success)' : 'var(--color-warning)',
                              fontWeight: 600,
                              fontSize: '13px',
                            }}
                            title={`Net: ${formatAmount(info.status === 'full' ? 0 : -info.netAmount)}`}
                          >
                            {info.status === 'full' ? 'Full' : 'Partial'}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleStartInlineEdit(tx)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          title="Edit this transaction"
                        >
                          Edit
                        </button>
                        {tx.amount < 0 && (
                          <button
                            onClick={() => setReimbursementModalTx(tx)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title="Link reimbursement income to this expense"
                          >
                            Reimb.
                          </button>
                        )}
                        {!tx.isInternalTransfer && (
                          <button
                            onClick={() => setSplitModalTx(tx)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title="Split this transaction across multiple categories"
                          >
                            Split
                          </button>
                        )}
                        <button
                          onClick={() => setAttachmentPanelTx(tx)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          title="Manage attachments for this transaction"
                        >
                          Files
                        </button>
                        <button
                          onClick={() => openBulkCategoryModal(tx.description, tx.categoryId || '')}
                          className="btn btn-success"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          title="Apply category to all transactions with this description"
                          data-testid="bulk-category-btn"
                        >
                          Apply to All
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx)}
                          className="btn btn-outline-danger"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          title="Delete this transaction"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn btn-secondary"
                data-testid="prev-page"
              >
                Previous
              </button>
              <span data-testid="page-info" style={{ color: 'var(--color-text-muted)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn btn-secondary"
                data-testid="next-page"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Bulk Category Modal */}
      {bulkModal.isOpen && (
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
          onClick={closeBulkModal}
          data-testid="bulk-modal-overlay"
        >
          <div
            className="card"
            style={{
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="bulk-modal"
          >
            <h3 style={{ marginTop: 0 }}>Bulk Categorize Transactions</h3>
            
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '8px' }}>
              <strong>Original Description:</strong><br />
              <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{bulkModal.description}</span>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Match Pattern:
                <span style={{ fontWeight: 'normal', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                  (matches any description containing this text)
                </span>
              </label>
              <input
                type="text"
                value={bulkModal.pattern}
                onChange={(e) => updatePatternPreview(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter pattern to match..."
                data-testid="bulk-pattern-input"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Apply to transactions with current category:
              </label>
              <select
                value={bulkFilterCategory || 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  updateFilterCategory(val === 'all' ? null : val);
                }}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="bulk-filter-select"
              >
                <option value="all">All matching transactions</option>
                <option value="uncategorized">Only uncategorized</option>
                <optgroup label="Only with specific category:">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            
            <div style={{
              backgroundColor: patternLoading ? 'var(--color-warning-bg)' : 'var(--color-info-bg)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              {patternLoading ? (
                <span>Searching...</span>
              ) : (
                <>
                  <strong>{bulkModal.matchCount}</strong> transaction{bulkModal.matchCount !== 1 ? 's' : ''} will be updated
                </>
              )}
            </div>

            {bulkModal.sampleMatches.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Sample Matches:
                </label>
                <div style={{
                  maxHeight: '120px',
                  overflow: 'auto',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}>
                  {bulkModal.sampleMatches.map((tx, idx) => (
                    <div
                      key={tx.id}
                      style={{
                        padding: '6px 8px',
                        borderBottom: idx < bulkModal.sampleMatches.length - 1 ? '1px solid var(--color-border)' : 'none',
                        fontFamily: 'monospace',
                      }}
                    >
                      {tx.description}
                    </div>
                  ))}
                  {bulkModal.matchCount > 5 && (
                    <div style={{ padding: '6px 8px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      ... and {bulkModal.matchCount - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Category:
              </label>
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="bulk-category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createRule}
                  onChange={(e) => setCreateRule(e.target.checked)}
                  data-testid="create-rule-checkbox"
                />
                <span>
                  Create rule for future imports
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    New transactions matching &quot;{bulkModal.pattern}&quot; will be auto-categorized
                  </span>
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeBulkModal}
                className="btn btn-secondary"
                data-testid="bulk-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCategoryUpdate}
                disabled={!bulkModal.pattern.trim() || bulkModal.matchCount === 0 || patternLoading}
                className="btn btn-success"
                data-testid="bulk-apply-btn"
              >
                Apply to All ({bulkModal.matchCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
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
          onClick={closeAddModal}
          data-testid="add-modal-overlay"
        >
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="add-modal"
          >
            <h3 style={{ marginTop: 0 }}>Add Transaction</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Date:
              </label>
              <input
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                data-testid="add-date-input"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Description:
              </label>
              <input
                type="text"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Grocery Store, Gas Station..."
                style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                data-testid="add-description-input"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Amount:
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  style={{ flex: 1, padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                  data-testid="add-amount-input"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newTransaction.isExpense}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, isExpense: e.target.checked }))}
                    data-testid="add-expense-checkbox"
                  />
                  Expense
                </label>
              </div>
              <small style={{ color: 'var(--color-text-muted)' }}>
                {newTransaction.isExpense ? 'Will be recorded as negative (expense)' : 'Will be recorded as positive (income)'}
              </small>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Account:
              </label>
              <select
                value={newTransaction.accountId}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, accountId: e.target.value }))}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="add-account-select"
              >
                <option value="">Select an account...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Category:
              </label>
              <select
                value={newTransaction.categoryId}
                onChange={(e) => setNewTransaction(prev => ({ ...prev, categoryId: e.target.value }))}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="add-category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeAddModal}
                className="btn btn-secondary"
                data-testid="add-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={!newTransaction.description.trim() || !newTransaction.amount || !newTransaction.accountId}
                className="btn btn-primary"
                data-testid="add-submit-btn"
              >
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Selection Category Modal */}
      {bulkSelectionCategoryModal.isOpen && (
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
          onClick={closeBulkSelectionCategoryModal}
          data-testid="bulk-selection-modal-overlay"
        >
          <div
            className="card"
            style={{
              maxWidth: '450px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="bulk-selection-modal"
          >
            <h3 style={{ marginTop: 0 }}>Set Category for Selected Transactions</h3>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
              <strong>{selectedIds.size}</strong> transaction{selectedIds.size !== 1 ? 's' : ''} will be updated.
            </p>

            <div style={{
              backgroundColor: 'var(--color-warning-bg)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              marginBottom: '16px',
              color: 'var(--color-warning-text, var(--color-text))',
            }}>
              <strong>Note:</strong> No categorization rule will be created. This only updates the selected transactions.
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Category:
              </label>
              <select
                value={bulkSelectionCategoryModal.selectedCategoryId}
                onChange={(e) => setBulkSelectionCategoryModal(prev => ({ ...prev, selectedCategoryId: e.target.value }))}
                style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                data-testid="bulk-selection-category-select"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeBulkSelectionCategoryModal}
                className="btn btn-secondary"
                data-testid="bulk-selection-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSelectionCategoryUpdate}
                disabled={!bulkSelectionCategoryModal.selectedCategoryId}
                className="btn btn-primary"
                data-testid="bulk-selection-apply-btn"
              >
                Apply to {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reimbursement Modal */}
      {reimbursementModalTx && (
        <ReimbursementModal
          transaction={reimbursementModalTx}
          onClose={() => setReimbursementModalTx(null)}
          onSave={() => loadData()}
        />
      )}

      {/* Split Transaction Modal */}
      {splitModalTx && (
        <SplitTransactionModal
          transaction={splitModalTx}
          onClose={() => setSplitModalTx(null)}
          onSave={() => loadData()}
        />
      )}

      {attachmentPanelTx && (
        <AttachmentPanel
          transactionId={attachmentPanelTx.id}
          transactionDescription={attachmentPanelTx.description}
          onClose={() => {
            setAttachmentPanelTx(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default TransactionList;
