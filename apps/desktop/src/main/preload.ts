import { contextBridge, ipcRenderer } from 'electron';
import {
  Account,
  Transaction,
  Category,
  CategoryRule,
  RecurringTransaction,
  RecurringItem,
  RecurringPayment,
  Tag,

  TransactionSplit,
  BudgetGoal,
  SpendingAlert,
  Bill,
  BillPayment,
  CategoryCorrection,
  Asset,
  Liability,
  SavingsGoal,
  SavingsContribution,
  Investment,
  InvestmentHistory,
  Receipt,
  RecurringSuggestion,
  InvestmentAccount,
  Holding,
  CostBasisLot,
  InvestmentTransaction,
  InvestmentSettings,
  ManualAsset,
  ManualLiability,
  NetWorthSnapshot,
  AssetValueHistory,
  LiabilityValueHistory,
  EncryptableEntityType,
  SharePermissions,
} from '../shared/types';
import { NetWorthProjectionConfig } from '@ledgr/core';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  version: process.versions.electron,

  // Users API (household support)
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    getById: (id: string) => ipcRenderer.invoke('users:getById', id),
    getDefault: () => ipcRenderer.invoke('users:getDefault'),
    create: (name: string, color: string) => ipcRenderer.invoke('users:create', name, color),
    update: (id: string, updates: Partial<{ name: string; color: string; isDefault: boolean }>) =>
      ipcRenderer.invoke('users:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('users:delete', id),
  },

  // Account API
  accounts: {
    getAll: () => ipcRenderer.invoke('accounts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('accounts:getById', id),
    create: (account: Omit<Account, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('accounts:create', account),
    update: (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('accounts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('accounts:delete', id),
    getDefault: () => ipcRenderer.invoke('accounts:getDefault'),
    setDefault: (accountId: string) => ipcRenderer.invoke('accounts:setDefault', accountId),
  },

  // Transaction API
  transactions: {
    getAll: () => ipcRenderer.invoke('transactions:getAll'),
    getByAccount: (accountId: string) =>
      ipcRenderer.invoke('transactions:getByAccount', accountId),
    create: (transaction: Omit<Transaction, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('transactions:create', transaction),
    update: (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('transactions:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('transactions:delete', id),
    bulkUpdateCategory: (pattern: string, categoryId: string, createRule: boolean, filterCategoryId: string | null) =>
      ipcRenderer.invoke('transactions:bulkUpdateCategory', pattern, categoryId, createRule, filterCategoryId),
    countByPattern: (pattern: string, filterCategoryId?: string | null) =>
      ipcRenderer.invoke('transactions:countByPattern', pattern, filterCategoryId),
    samplesByPattern: (pattern: string, limit?: number, filterCategoryId?: string | null) =>
      ipcRenderer.invoke('transactions:samplesByPattern', pattern, limit, filterCategoryId),
    bulkDelete: (ids: string[]) =>
      ipcRenderer.invoke('transactions:bulkDelete', ids),
    bulkUpdateCategoryByIds: (ids: string[], categoryId: string | null) =>
      ipcRenderer.invoke('transactions:bulkUpdateCategoryByIds', ids, categoryId),
  },

  // Category API
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    getById: (id: string) => ipcRenderer.invoke('categories:getById', id),
    create: (category: Omit<Category, 'id'>) =>
      ipcRenderer.invoke('categories:create', category),
    update: (id: string, updates: Partial<Omit<Category, 'id'>>) =>
      ipcRenderer.invoke('categories:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('categories:delete', id),
    addMissingDefaults: () => ipcRenderer.invoke('categories:addMissingDefaults'),
  },

  // Category Rules API
  categoryRules: {
    getAll: () => ipcRenderer.invoke('categoryRules:getAll'),
    getById: (id: string) => ipcRenderer.invoke('categoryRules:getById', id),
    create: (rule: Omit<CategoryRule, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('categoryRules:create', rule),
    update: (id: string, updates: Partial<Omit<CategoryRule, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('categoryRules:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('categoryRules:delete', id),
    applyToTransactions: (onlyUncategorized: boolean) =>
      ipcRenderer.invoke('categoryRules:applyToTransactions', onlyUncategorized),
    suggestCategory: (description: string) =>
      ipcRenderer.invoke('categoryRules:suggestCategory', description),
  },

  // Import API
  import: {
    selectFile: () => ipcRenderer.invoke('import:selectFile'),
    file: (accountId: string, filePath: string) =>
      ipcRenderer.invoke('import:file', accountId, filePath),
    // Legacy - use 'file' instead
    csv: (accountId: string, filePath: string) =>
      ipcRenderer.invoke('import:csv', accountId, filePath),
  },

  // Transaction Import API (with wizard support)
  transactionImport: {
    selectFile: (): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('transactionImport:selectFile'),

    preview: (
      filePath: string,
      accountId: string,
      columnMapping?: {
        date: string | null;
        description: string | null;
        amount: string | null;
        debit: string | null;
        credit: string | null;
        category: string | null;
        balance: string | null;
        amountType: 'single' | 'split';
        headerRow?: number;
      }
    ): Promise<{
      success: boolean;
      detectedFormat: string | null;
      formatDisplayName: string;
      rows: Array<{
        date: Date;
        description: string;
        amount: number;
        category?: string | null;
        balance?: number | null;
        status: 'new' | 'duplicate' | 'error';
        errorMessage?: string;
        existingTransactionId?: string;
        selected: boolean;
        rawRow: Record<string, string>;
      }>;
      availableColumns: string[];
      suggestedMapping: {
        date: string | null;
        description: string | null;
        amount: string | null;
        debit: string | null;
        credit: string | null;
        category: string | null;
        balance: string | null;
        amountType: 'single' | 'split';
        headerRow?: number;
      } | null;
      sampleData?: Record<string, string>[];
      rawData?: {
        rawRows: string[][];
        totalRows: number;
        detectedHeaderRow: number;
        detectedDelimiter: string;
        suggestedMapping: {
          date: string | null;
          description: string | null;
          amount: string | null;
          debit: string | null;
          credit: string | null;
          category: string | null;
          balance: string | null;
          amountType: 'single' | 'split';
        } | null;
      };
      stats: {
        total: number;
        new: number;
        duplicates: number;
        errors: number;
      };
      error?: string;
    }> => ipcRenderer.invoke('transactionImport:preview', filePath, accountId, columnMapping),

    commit: (
      accountId: string,
      rows: Array<{
        date: Date;
        description: string;
        amount: number;
        category?: string | null;
        balance?: number | null;
        status: 'new' | 'duplicate' | 'error';
        errorMessage?: string;
        existingTransactionId?: string;
        selected: boolean;
        rawRow: Record<string, string>;
      }>,
      duplicateAction: 'skip' | 'replace' | 'add'
    ): Promise<{
      success: boolean;
      imported: number;
      skipped: number;
      errors: number;
      error?: string;
    }> => ipcRenderer.invoke('transactionImport:commit', accountId, rows, duplicateAction),
  },

  // Analytics API
  analytics: {
    getSpendingByCategory: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('analytics:getSpendingByCategory', startDate, endDate),
    getIncomeVsExpensesOverTime: (grouping: 'day' | 'week' | 'month' | 'year', startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('analytics:getIncomeVsExpensesOverTime', grouping, startDate, endDate),
    getCategoryTrendsOverTime: (categoryIds: string[], grouping: 'day' | 'week' | 'month' | 'year', startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('analytics:getCategoryTrendsOverTime', categoryIds, grouping, startDate, endDate),
    getCategoryTrendsSelectedCategories: () =>
      ipcRenderer.invoke('categoryTrends:getSelectedCategories'),
    setCategoryTrendsSelectedCategories: (categoryIds: string) =>
      ipcRenderer.invoke('categoryTrends:setSelectedCategories', categoryIds),
  },

  // Forecast API
  forecast: {
    spending: (forecastDays: number, historyDays?: number) =>
      ipcRenderer.invoke('forecast:spending', forecastDays, historyDays),
    multiPeriod: (periods: number[]) =>
      ipcRenderer.invoke('forecast:multiPeriod', periods),
    categorySpending: (categoryId: string, forecastDays: number, historyDays?: number) =>
      ipcRenderer.invoke('forecast:categorySpending', categoryId, forecastDays, historyDays),
    allCategories: (forecastDays?: number, historyDays?: number) =>
      ipcRenderer.invoke('forecast:allCategories', forecastDays, historyDays),
    // Enhanced long-term forecasting (5-year support)
    categoryLongTerm: (categoryId: string, options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      trendDampeningFactor?: number;
      historyMonths?: number;
    }) => ipcRenderer.invoke('forecast:categoryLongTerm', categoryId, options),
    allCategoriesLongTerm: (options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      trendDampeningFactor?: number;
      historyMonths?: number;
    }) => ipcRenderer.invoke('forecast:allCategoriesLongTerm', options),
    selectGranularity: (forecastDays: number) =>
      ipcRenderer.invoke('forecast:selectGranularity', forecastDays),
  },

  // Recurring Transactions API (legacy)
  recurringTransactions: {
    getAll: () => ipcRenderer.invoke('recurringTransactions:getAll'),
    getByAccount: (accountId: string) =>
      ipcRenderer.invoke('recurringTransactions:getByAccount', accountId),
    getById: (id: string) => ipcRenderer.invoke('recurringTransactions:getById', id),
    create: (recurringTx: Omit<RecurringTransaction, 'id'>) =>
      ipcRenderer.invoke('recurringTransactions:create', recurringTx),
    update: (id: string, updates: Partial<Omit<RecurringTransaction, 'id'>>) =>
      ipcRenderer.invoke('recurringTransactions:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('recurringTransactions:delete', id),
  },

  // Unified Recurring Items API (replaces bills and recurringTransactions)
  recurring: {
    getAll: () => ipcRenderer.invoke('recurring:getAll'),
    getActive: () => ipcRenderer.invoke('recurring:getActive'),
    getById: (id: string) => ipcRenderer.invoke('recurring:getById', id),
    getByAccount: (accountId: string) => ipcRenderer.invoke('recurring:getByAccount', accountId),
    create: (item: Omit<RecurringItem, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('recurring:create', item),
    update: (id: string, updates: Partial<Omit<RecurringItem, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('recurring:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('recurring:delete', id),
    migrate: () => ipcRenderer.invoke('recurring:migrate'),
  },

  recurringPayments: {
    getAll: (recurringItemId: string) =>
      ipcRenderer.invoke('recurringPayments:getAll', recurringItemId),
    getById: (id: string) => ipcRenderer.invoke('recurringPayments:getById', id),
    getUpcoming: (days?: number) => ipcRenderer.invoke('recurringPayments:getUpcoming', days),
    getByDateRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('recurringPayments:getByDateRange', startDate, endDate),
    create: (payment: Omit<RecurringPayment, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('recurringPayments:create', payment),
    update: (id: string, updates: Partial<Omit<RecurringPayment, 'id' | 'createdAt' | 'recurringItemId'>>) =>
      ipcRenderer.invoke('recurringPayments:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('recurringPayments:delete', id),
  },

  // Cash Flow API
  cashflow: {
    forecast: (accountId: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke('cashflow:forecast', accountId, startDate, endDate),
    projectTransactions: (accountId: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke('cashflow:projectTransactions', accountId, startDate, endDate),
    // Enhanced cashflow with category trends (5-year support)
    forecastEnhanced: (accountId: string, options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      includeCategoryTrends?: boolean;
      trendDampeningFactor?: number;
      historyMonths?: number;
    }, lowBalanceThreshold?: number) =>
      ipcRenderer.invoke('cashflow:forecastEnhanced', accountId, options, lowBalanceThreshold),
  },

  // OFX Direct Connect API
  ofx: {
    getBanks: () =>
      ipcRenderer.invoke('ofx:getBanks'),
    searchBanks: (query: string) =>
      ipcRenderer.invoke('ofx:searchBanks', query),
    testConnection: (bankId: string, username: string, password: string) =>
      ipcRenderer.invoke('ofx:testConnection', bankId, username, password),
    saveConnection: (connectionData: {
      bankId: string;
      bankName: string;
      ofxUrl: string;
      org: string;
      fid: string;
      username: string;
      accountId: string;
      accountType: string;
    }) =>
      ipcRenderer.invoke('ofx:saveConnection', connectionData),
    syncTransactions: (accountId: string, password: string, startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('ofx:syncTransactions', accountId, password, startDate, endDate),
    disconnectAccount: (accountId: string) =>
      ipcRenderer.invoke('ofx:disconnectAccount', accountId),
  },

  // ==================== Phase 1: Data Export ====================
  export: {
    transactions: (options: {
      format: 'csv' | 'json';
      includeCategories?: boolean;
      includeTags?: boolean;
      accountId?: string;
      startDate?: string;
      endDate?: string;
    }) => ipcRenderer.invoke('export:transactions', options),
    allData: () => ipcRenderer.invoke('export:allData'),
  },

  // ==================== Phase 1: Tags ====================
  tags: {
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    getById: (id: string) => ipcRenderer.invoke('tags:getById', id),
    create: (tag: Omit<Tag, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('tags:create', tag),
    update: (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('tags:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('tags:delete', id),
    getForTransaction: (transactionId: string) =>
      ipcRenderer.invoke('tags:getForTransaction', transactionId),
    addToTransaction: (transactionId: string, tagId: string) =>
      ipcRenderer.invoke('tags:addToTransaction', transactionId, tagId),
    removeFromTransaction: (transactionId: string, tagId: string) =>
      ipcRenderer.invoke('tags:removeFromTransaction', transactionId, tagId),
    setForTransaction: (transactionId: string, tagIds: string[]) =>
      ipcRenderer.invoke('tags:setForTransaction', transactionId, tagIds),
    getTransactions: (tagId: string) =>
      ipcRenderer.invoke('tags:getTransactions', tagId),
  },

  // ==================== Phase 1: Split Transactions ====================
  splits: {
    getAll: (parentTransactionId: string) =>
      ipcRenderer.invoke('splits:getAll', parentTransactionId),
    getById: (id: string) => ipcRenderer.invoke('splits:getById', id),
    create: (split: Omit<TransactionSplit, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('splits:create', split),
    update: (id: string, updates: Partial<Omit<TransactionSplit, 'id' | 'createdAt' | 'parentTransactionId'>>) =>
      ipcRenderer.invoke('splits:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('splits:delete', id),
    deleteAll: (parentTransactionId: string) =>
      ipcRenderer.invoke('splits:deleteAll', parentTransactionId),
    getTransactionIds: () =>
      ipcRenderer.invoke('splits:getTransactionIds'),
    getByTransactionIds: (ids: string[]) =>
      ipcRenderer.invoke('splits:getByTransactionIds', ids),
  },

  // ==================== Phase 1: Search ====================
  search: {
    transactions: (query: string, options?: {
      accountId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      minAmount?: number;
      maxAmount?: number;
      tagIds?: string[];
      limit?: number;
      offset?: number;
    }) => ipcRenderer.invoke('transactions:search', query, options),
  },

  // ==================== Phase 2: Budget Goals ====================
  budgetGoals: {
    getAll: () => ipcRenderer.invoke('budgetGoals:getAll'),
    getById: (id: string) => ipcRenderer.invoke('budgetGoals:getById', id),
    getByCategory: (categoryId: string) =>
      ipcRenderer.invoke('budgetGoals:getByCategory', categoryId),
    create: (goal: Omit<BudgetGoal, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('budgetGoals:create', goal),
    update: (id: string, updates: Partial<Omit<BudgetGoal, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('budgetGoals:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('budgetGoals:delete', id),
  },

  // ==================== Budget Suggestions ====================
  budgetSuggestions: {
    getAll: (options?: { historyMonths?: number; bufferPercent?: number }) =>
      ipcRenderer.invoke('budgetSuggestions:getAll', options),
    forCategory: (categoryId: string, options?: { historyMonths?: number; userGoal?: 'reduce_spending' }) =>
      ipcRenderer.invoke('budgetSuggestions:forCategory', categoryId, options),
    apply: (suggestion: { categoryId: string; suggestedAmount: number; period: string }) =>
      ipcRenderer.invoke('budgetSuggestions:apply', suggestion),
  },

  // ==================== Phase 2: Spending Alerts ====================
  spendingAlerts: {
    getAll: () => ipcRenderer.invoke('spendingAlerts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('spendingAlerts:getById', id),
    getActive: () => ipcRenderer.invoke('spendingAlerts:getActive'),
    create: (alert: Omit<SpendingAlert, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('spendingAlerts:create', alert),
    update: (id: string, updates: Partial<Omit<SpendingAlert, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('spendingAlerts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('spendingAlerts:delete', id),
  },

  // ==================== Phase 3: Bills ====================
  bills: {
    getAll: () => ipcRenderer.invoke('bills:getAll'),
    getActive: () => ipcRenderer.invoke('bills:getActive'),
    getById: (id: string) => ipcRenderer.invoke('bills:getById', id),
    create: (bill: Omit<Bill, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('bills:create', bill),
    update: (id: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('bills:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('bills:delete', id),
  },

  billPayments: {
    getAll: (billId: string) => ipcRenderer.invoke('billPayments:getAll', billId),
    getById: (id: string) => ipcRenderer.invoke('billPayments:getById', id),
    getUpcoming: (days?: number) => ipcRenderer.invoke('billPayments:getUpcoming', days),
    create: (payment: Omit<BillPayment, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('billPayments:create', payment),
    update: (id: string, updates: Partial<Omit<BillPayment, 'id' | 'createdAt' | 'billId'>>) =>
      ipcRenderer.invoke('billPayments:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('billPayments:delete', id),
  },

  // ==================== Phase 3: Category Corrections ====================
  categoryCorrections: {
    getAll: () => ipcRenderer.invoke('categoryCorrections:getAll'),
    getById: (id: string) => ipcRenderer.invoke('categoryCorrections:getById', id),
    find: (description: string) => ipcRenderer.invoke('categoryCorrections:find', description),
    create: (correction: Omit<CategoryCorrection, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('categoryCorrections:create', correction),
    update: (id: string, updates: Partial<Omit<CategoryCorrection, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('categoryCorrections:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('categoryCorrections:delete', id),
    incrementUsage: (id: string) => ipcRenderer.invoke('categoryCorrections:incrementUsage', id),
  },

  // ==================== Phase 4: Assets ====================
  assets: {
    getAll: () => ipcRenderer.invoke('assets:getAll'),
    getById: (id: string) => ipcRenderer.invoke('assets:getById', id),
    create: (asset: Omit<Asset, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('assets:create', asset),
    update: (id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('assets:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('assets:delete', id),
    getTotal: () => ipcRenderer.invoke('assets:getTotal'),
  },

  // ==================== Phase 4: Liabilities ====================
  liabilities: {
    getAll: () => ipcRenderer.invoke('liabilities:getAll'),
    getById: (id: string) => ipcRenderer.invoke('liabilities:getById', id),
    create: (liability: Omit<Liability, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('liabilities:create', liability),
    update: (id: string, updates: Partial<Omit<Liability, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('liabilities:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('liabilities:delete', id),
    getTotal: () => ipcRenderer.invoke('liabilities:getTotal'),
  },

  // ==================== Phase 4: Net Worth (Legacy) ====================
  netWorth: {
    createHistory: () => ipcRenderer.invoke('netWorth:createHistory'),
    getHistory: (limit?: number) => ipcRenderer.invoke('netWorth:getHistory', limit),
    getById: (id: string) => ipcRenderer.invoke('netWorth:getById', id),
  },

  // ==================== Phase 4: Savings Goals ====================
  savingsGoals: {
    getAll: () => ipcRenderer.invoke('savingsGoals:getAll'),
    getActive: () => ipcRenderer.invoke('savingsGoals:getActive'),
    getById: (id: string) => ipcRenderer.invoke('savingsGoals:getById', id),
    create: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('savingsGoals:create', goal),
    update: (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('savingsGoals:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('savingsGoals:delete', id),
    pinAccount: (goalId: string, accountId: string) =>
      ipcRenderer.invoke('savingsGoals:pinAccount', goalId, accountId),
    unpinAccount: (goalId: string) =>
      ipcRenderer.invoke('savingsGoals:unpinAccount', goalId),
    syncWithAccount: (goalId: string) =>
      ipcRenderer.invoke('savingsGoals:syncWithAccount', goalId),
    getGrowthData: (goalId: string) =>
      ipcRenderer.invoke('savingsGoals:getGrowthData', goalId),
    getMonthlyContributions: (goalId: string) =>
      ipcRenderer.invoke('savingsGoals:getMonthlyContributions', goalId),
    getAlerts: () =>
      ipcRenderer.invoke('savingsGoals:getAlerts'),
  },

  savingsContributions: {
    getAll: (goalId: string) => ipcRenderer.invoke('savingsContributions:getAll', goalId),
    getById: (id: string) => ipcRenderer.invoke('savingsContributions:getById', id),
    create: (contribution: Omit<SavingsContribution, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('savingsContributions:create', contribution),
    delete: (id: string) => ipcRenderer.invoke('savingsContributions:delete', id),
  },

  // ==================== Phase 5: Investments ====================
  investments: {
    getAll: () => ipcRenderer.invoke('investments:getAll'),
    getById: (id: string) => ipcRenderer.invoke('investments:getById', id),
    create: (investment: Omit<Investment, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('investments:create', investment),
    update: (id: string, updates: Partial<Omit<Investment, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('investments:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('investments:delete', id),
    getTotal: () => ipcRenderer.invoke('investments:getTotal'),
  },

  investmentHistory: {
    getAll: (investmentId: string) =>
      ipcRenderer.invoke('investmentHistory:getAll', investmentId),
    create: (history: Omit<InvestmentHistory, 'id'>) =>
      ipcRenderer.invoke('investmentHistory:create', history),
  },

  // ==================== Phase 6: Receipts ====================
  receipts: {
    getAll: () => ipcRenderer.invoke('receipts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('receipts:getById', id),
    getByTransaction: (transactionId: string) =>
      ipcRenderer.invoke('receipts:getByTransaction', transactionId),
    create: (receipt: Omit<Receipt, 'id'>) =>
      ipcRenderer.invoke('receipts:create', receipt),
    update: (id: string, updates: Partial<Omit<Receipt, 'id'>>) =>
      ipcRenderer.invoke('receipts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('receipts:delete', id),
  },

  // ==================== Recurring Detection ====================
  recurringDetection: {
    analyze: () => ipcRenderer.invoke('recurringDetection:analyze'),
    approve: (suggestion: RecurringSuggestion, enableReminders: boolean, itemType?: string) =>
      ipcRenderer.invoke('recurringDetection:approve', suggestion, enableReminders, itemType),
    // Legacy methods for backwards compatibility
    approveAsBill: (suggestion: RecurringSuggestion) =>
      ipcRenderer.invoke('recurringDetection:approveAsBill', suggestion),
    approveAsRecurring: (suggestion: RecurringSuggestion) =>
      ipcRenderer.invoke('recurringDetection:approveAsRecurring', suggestion),
  },

  // ==================== Window Management ====================
  window: {
    openNewWindow: (view: string) => ipcRenderer.invoke('window:openNewWindow', view),
  },

  // ==================== Phase 7: Prediction & Reporting ====================

  // Anomaly Detection
  anomalyDetection: {
    detect: (options?: {
      zScoreThreshold?: number;
      historyDays?: number;
      lookbackDays?: number;
      gracePeriodDays?: number;
      duplicateWindowDays?: number;
    }) => ipcRenderer.invoke('anomalyDetection:detect', options),
    detectUnusualAmounts: (zScoreThreshold?: number, historyDays?: number, lookbackDays?: number) =>
      ipcRenderer.invoke('anomalyDetection:detectUnusualAmounts', zScoreThreshold, historyDays, lookbackDays),
    detectMissingRecurring: (gracePeriodDays?: number) =>
      ipcRenderer.invoke('anomalyDetection:detectMissingRecurring', gracePeriodDays),
    detectDuplicateCharges: (windowDays?: number, lookbackDays?: number) =>
      ipcRenderer.invoke('anomalyDetection:detectDuplicateCharges', windowDays, lookbackDays),
  },

  // Seasonal Analysis
  seasonalAnalysis: {
    analyze: (options?: { minMonths?: number; spikeThreshold?: number }) =>
      ipcRenderer.invoke('seasonalAnalysis:analyze', options),
    getPatterns: (categoryId?: string) =>
      ipcRenderer.invoke('seasonalAnalysis:getPatterns', categoryId),
    predictMonthlySpending: (categoryId: string, month: number) =>
      ipcRenderer.invoke('seasonalAnalysis:predictMonthlySpending', categoryId, month),
    detectHolidaySpikes: (spikeThreshold?: number) =>
      ipcRenderer.invoke('seasonalAnalysis:detectHolidaySpikes', spikeThreshold),
  },

  // Income Analysis
  incomeAnalysis: {
    analyze: (options?: { historyDays?: number; minOccurrences?: number }) =>
      ipcRenderer.invoke('incomeAnalysis:analyze', options),
    identifyStreams: (options?: { historyDays?: number; minOccurrences?: number }) =>
      ipcRenderer.invoke('incomeAnalysis:identifyStreams', options),
    getSmoothedIncome: (windowMonths?: number) =>
      ipcRenderer.invoke('incomeAnalysis:getSmoothedIncome', windowMonths),
  },

  // Financial Health
  financialHealth: {
    getHistory: (limit?: number) =>
      ipcRenderer.invoke('financialHealth:getHistory', limit),
    getLatest: () =>
      ipcRenderer.invoke('financialHealth:getLatest'),
    createSnapshot: (data: { overallScore: number; factorScores: string }) =>
      ipcRenderer.invoke('financialHealth:createSnapshot', data),
  },

  // Bill Preferences
  billPreferences: {
    getAll: () => ipcRenderer.invoke('billPreferences:getAll'),
    getByRecurringItem: (recurringItemId: string) =>
      ipcRenderer.invoke('billPreferences:getByRecurringItem', recurringItemId),
    upsert: (data: { recurringItemId: string; preferredDueDay?: number | null; notes?: string | null }) =>
      ipcRenderer.invoke('billPreferences:upsert', data),
    delete: (recurringItemId: string) =>
      ipcRenderer.invoke('billPreferences:delete', recurringItemId),
  },

  // Spending Velocity
  spendingVelocity: {
    calculate: (period?: 'weekly' | 'monthly' | 'yearly') =>
      ipcRenderer.invoke('spendingVelocity:calculate', period),
    forCategory: (categoryId: string, period?: 'weekly' | 'monthly' | 'yearly') =>
      ipcRenderer.invoke('spendingVelocity:forCategory', categoryId, period),
  },

  // Comparison Reports
  comparison: {
    generate: (type?: 'month_over_month' | 'year_over_year') =>
      ipcRenderer.invoke('comparison:generate', type),
    budgetAdherenceHistory: (monthsBack?: number) =>
      ipcRenderer.invoke('comparison:budgetAdherenceHistory', monthsBack),
  },

  // Subscription Audit
  subscriptionAudit: {
    audit: (options?: { includeInactive?: boolean; minMonthlyCost?: number }) =>
      ipcRenderer.invoke('subscriptionAudit:audit', options),
  },

  // Financial Health Calculator
  financialHealthCalc: {
    calculate: () => ipcRenderer.invoke('financialHealthCalc:calculate'),
  },

  // ==================== Phase 3: Goal & Debt Projections ====================

  // Savings Projections
  savingsProjection: {
    generate: (options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => ipcRenderer.invoke('savingsProjection:generate', options),
    forGoal: (goalId: string, options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => ipcRenderer.invoke('savingsProjection:forGoal', goalId, options),
  },

  // Debt Payoff
  debtPayoff: {
    generate: (options?: {
      extraPaymentAmounts?: number[];
    }) => ipcRenderer.invoke('debtPayoff:generate', options),
    calculateStrategy: (strategy: 'minimum' | 'snowball' | 'avalanche', extraMonthly?: number) =>
      ipcRenderer.invoke('debtPayoff:calculateStrategy', strategy, extraMonthly),
  },

  // Net Worth Projection
  netWorthProjection: {
    generate: (options?: {
      projectionMonths?: number;
      confidenceLevel?: number;
    }) => ipcRenderer.invoke('netWorthProjection:generate', options),
    getTrend: () => ipcRenderer.invoke('netWorthProjection:getTrend'),
    getMilestones: () => ipcRenderer.invoke('netWorthProjection:getMilestones'),
  },

  // ==================== Phase 4: Cash Flow Intelligence ====================

  // Category Migration
  categoryMigration: {
    analyze: (options?: {
      monthsBack?: number;
      shiftThreshold?: number;
    }) => ipcRenderer.invoke('categoryMigration:analyze', options),
    getPeriods: (monthsBack?: number) => ipcRenderer.invoke('categoryMigration:getPeriods', monthsBack),
  },

  // Cash Flow Optimization
  cashFlowOptimization: {
    optimize: (options?: {
      projectionDays?: number;
      warningThreshold?: number;
      criticalThreshold?: number;
    }) => ipcRenderer.invoke('cashFlowOptimization:optimize', options),
    getProjections: (days?: number) => ipcRenderer.invoke('cashFlowOptimization:getProjections', days),
  },

  // Recovery Plan
  recoveryPlan: {
    generate: (options?: { thresholdDays?: number }) =>
      ipcRenderer.invoke('recoveryPlan:generate', options),
    getQuickWins: () => ipcRenderer.invoke('recoveryPlan:getQuickWins'),
    simulateScenario: (modifications: Array<{
      type: 'cut_category' | 'add_income' | 'cancel_subscription' | 'pause_expense';
      categoryId?: string;
      subscriptionId?: string;
      recurringItemId?: string;
      percentReduction?: number;
      amountChange?: number;
    }>, projectionDays?: number) =>
      ipcRenderer.invoke('recoveryPlan:simulateScenario', modifications, projectionDays),
    getEmergencyStatus: (thresholdDays?: number) =>
      ipcRenderer.invoke('recoveryPlan:getEmergencyStatus', thresholdDays),
    getSurvivalMode: () => ipcRenderer.invoke('recoveryPlan:getSurvivalMode'),
    applyQuickWin: (quickWin: {
      id: string;
      type: string;
      metadata: Record<string, unknown>;
    }) => ipcRenderer.invoke('recoveryPlan:applyQuickWin', quickWin),
  },

  // ==================== v1.1: Investment Tracking ====================

  // Investment Accounts API
  investmentAccounts: {
    getAll: () => ipcRenderer.invoke('investmentAccounts:getAll'),
    getById: (id: string) => ipcRenderer.invoke('investmentAccounts:getById', id),
    create: (account: Omit<InvestmentAccount, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('investmentAccounts:create', account),
    update: (id: string, updates: Partial<Omit<InvestmentAccount, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('investmentAccounts:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('investmentAccounts:delete', id),
  },

  // Holdings API
  holdings: {
    getAll: () => ipcRenderer.invoke('holdings:getAll'),
    getByAccount: (accountId: string) => ipcRenderer.invoke('holdings:getByAccount', accountId),
    getById: (id: string) => ipcRenderer.invoke('holdings:getById', id),
    create: (holding: Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>) =>
      ipcRenderer.invoke('holdings:create', holding),
    update: (id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>>) =>
      ipcRenderer.invoke('holdings:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('holdings:delete', id),
    bulkDelete: (ids: string[]) => ipcRenderer.invoke('holdings:bulkDelete', ids),
  },

  // Cost Basis Lots API
  lots: {
    getByHolding: (holdingId: string) => ipcRenderer.invoke('lots:getByHolding', holdingId),
    getById: (id: string) => ipcRenderer.invoke('lots:getById', id),
    create: (lot: Omit<CostBasisLot, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('lots:create', lot),
    update: (id: string, updates: Partial<Omit<CostBasisLot, 'id' | 'createdAt' | 'holdingId'>>) =>
      ipcRenderer.invoke('lots:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('lots:delete', id),
  },

  // ==================== Phase 2: Price Service ====================
  prices: {
    // Get price (from cache or API if needed)
    get: (symbol: string) => ipcRenderer.invoke('prices:get', symbol),

    // Force fetch from API (respects manual)
    fetch: (symbol: string) => ipcRenderer.invoke('prices:fetch', symbol),

    // Batch fetch with progress events
    fetchBatch: (symbols: string[], options?: { skipManual?: boolean }) =>
      ipcRenderer.invoke('prices:fetchBatch', symbols, options),

    // Get cached prices (no API)
    getCached: (symbols: string[]) => ipcRenderer.invoke('prices:getCached', symbols),

    // Manual price override
    setManual: (symbol: string, priceInCents: number) =>
      ipcRenderer.invoke('prices:setManual', symbol, priceInCents),

    // Clear manual override
    clearManual: (symbol: string) => ipcRenderer.invoke('prices:clearManual', symbol),

    // Check staleness
    isStale: (symbol: string) => ipcRenderer.invoke('prices:isStale', symbol),

    // Cache statistics
    getStats: () => ipcRenderer.invoke('prices:getStats'),

    // Validate symbol
    validateSymbol: (symbol: string) => ipcRenderer.invoke('prices:validateSymbol', symbol),

    // Listen for progress updates during batch fetch
    onProgress: (callback: (progress: { completed: number; total: number; currentSymbol: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: { completed: number; total: number; currentSymbol: string }) => {
        callback(progress);
      };
      ipcRenderer.on('prices:progress', handler);
      return () => ipcRenderer.removeListener('prices:progress', handler);
    },
  },

  // ==================== Holdings Import API (Phase 6) ====================
  holdingsImport: {
    selectFile: (): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('holdings:import:selectFile'),

    preview: (
      filePath: string,
      accountId: string,
      columnMapping?: {
        ticker: string | null;
        shares: string | null;
        costBasis: string | null;
        costBasisType: 'total' | 'per_share';
        headerRow?: number;
      }
    ): Promise<{
      success: boolean;
      detectedFormat: string | null;
      formatDisplayName: string;
      rows: Array<{
        ticker: string;
        shares: number;
        costBasis: number;
        costPerShare: number;
        status: 'new' | 'duplicate' | 'error';
        errorMessage?: string;
        existingHoldingId?: string;
        selected: boolean;
        rawRow: Record<string, string>;
      }>;
      availableColumns: string[];
      suggestedMapping: {
        ticker: string | null;
        shares: string | null;
        costBasis: string | null;
        costBasisType: 'total' | 'per_share';
        headerRow?: number;
      } | null;
      rawData?: {
        rawRows: string[][];
        totalRows: number;
        detectedHeaderRow: number;
        detectedDelimiter: string;
        suggestedMapping: {
          ticker: string | null;
          shares: string | null;
          costBasis: string | null;
          costBasisType: 'total' | 'per_share';
        } | null;
      };
      stats: {
        total: number;
        new: number;
        duplicates: number;
        errors: number;
      };
      error?: string;
    }> => ipcRenderer.invoke('holdings:import:preview', filePath, accountId, columnMapping),

    commit: (
      accountId: string,
      rows: Array<{
        ticker: string;
        shares: number;
        costBasis: number;
        costPerShare: number;
        status: 'new' | 'duplicate' | 'error';
        errorMessage?: string;
        existingHoldingId?: string;
        selected: boolean;
        rawRow: Record<string, string>;
      }>,
      duplicateAction: 'skip' | 'replace' | 'add'
    ): Promise<{
      success: boolean;
      imported: number;
      skipped: number;
      errors: number;
      error?: string;
    }> => ipcRenderer.invoke('holdings:import:commit', accountId, rows, duplicateAction),

    getFormats: (): Promise<Array<{ name: string; displayName: string }>> =>
      ipcRenderer.invoke('holdings:import:formats'),
  },

  // ==================== Investment Transactions (Phase 3) ====================
  investmentTransactions: {
    getAll: () => ipcRenderer.invoke('investmentTransactions:getAll'),
    getByHolding: (holdingId: string) => ipcRenderer.invoke('investmentTransactions:getByHolding', holdingId),
    getById: (id: string) => ipcRenderer.invoke('investmentTransactions:getById', id),
    create: (tx: Omit<InvestmentTransaction, 'id' | 'createdAt' | 'lotId'>) =>
      ipcRenderer.invoke('investmentTransactions:create', tx),
    update: (id: string, updates: Partial<Omit<InvestmentTransaction, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('investmentTransactions:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('investmentTransactions:delete', id),
  },

  // Investment Settings API
  investmentSettings: {
    get: () => ipcRenderer.invoke('investmentSettings:get'),
    update: (settings: Partial<InvestmentSettings>) =>
      ipcRenderer.invoke('investmentSettings:update', settings),
  },

  // ==================== Performance Analytics (Phase 4 - v1.1) ====================
  performance: {
    getMetrics: (options: {
      period: string;
      customStartDate?: Date;
      customEndDate?: Date;
      includeBenchmark?: boolean;
    }) => ipcRenderer.invoke('performance:getMetrics', options),
    getPositionGainLoss: (holdingId: string) =>
      ipcRenderer.invoke('performance:getPositionGainLoss', holdingId),
    getRealizedGains: (options: {
      period: string;
      customStartDate?: Date;
      customEndDate?: Date;
    }) => ipcRenderer.invoke('performance:getRealizedGains', options),
    getBenchmark: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('performance:getBenchmark', startDate, endDate),
    getDefaultPeriod: () => ipcRenderer.invoke('performance:getDefaultPeriod'),
    setDefaultPeriod: (period: string) =>
      ipcRenderer.invoke('performance:setDefaultPeriod', period),
  },

  // ==================== Net Worth Integration (Phase 5 - v1.1) ====================
  // Manual Assets API
  manualAssets: {
    getAll: () => ipcRenderer.invoke('manualAssets:getAll'),
    getById: (id: string) => ipcRenderer.invoke('manualAssets:getById', id),
    create: (asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>) =>
      ipcRenderer.invoke('manualAssets:create', asset),
    update: (id: string, updates: Partial<Omit<ManualAsset, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('manualAssets:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('manualAssets:delete', id),
    getDueReminders: () => ipcRenderer.invoke('manualAssets:getDueReminders'),
  },

  // Manual Liabilities API
  manualLiabilities: {
    getAll: () => ipcRenderer.invoke('manualLiabilities:getAll'),
    getById: (id: string) => ipcRenderer.invoke('manualLiabilities:getById', id),
    create: (liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>) =>
      ipcRenderer.invoke('manualLiabilities:create', liability),
    update: (id: string, updates: Partial<Omit<ManualLiability, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('manualLiabilities:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('manualLiabilities:delete', id),
  },

  // Net Worth Snapshots API (Phase 5)
  netWorthSnapshots: {
    getSnapshots: (limit?: number) => ipcRenderer.invoke('netWorth:getSnapshots', limit),
    getSnapshotsByRange: (startDate: number, endDate: number) =>
      ipcRenderer.invoke('netWorth:getSnapshotsByRange', startDate, endDate),
    getLatest: () => ipcRenderer.invoke('netWorth:getLatest'),
    createSnapshot: (snapshot: Omit<NetWorthSnapshot, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('netWorth:createSnapshot', snapshot),
  },

  // Net Worth Calculation API (Phase 5)
  netWorthCalc: {
    calculate: () => ipcRenderer.invoke('netWorth:calculate'),
    forceSnapshot: () => ipcRenderer.invoke('netWorth:forceSnapshot'),
    getChangeSummary: (startDate: number, endDate: number) =>
      ipcRenderer.invoke('netWorth:getChangeSummary', startDate, endDate),
    getProjections: (config: NetWorthProjectionConfig) => ipcRenderer.invoke('netWorth:getProjections', config),
    calculateLoanPayoff: (liabilityId: string) =>
      ipcRenderer.invoke('netWorth:calculateLoanPayoff', liabilityId),
    calculateExtraPaymentImpact: (liabilityId: string, extraPayment: number) =>
      ipcRenderer.invoke('netWorth:calculateExtraPaymentImpact', liabilityId, extraPayment),
  },

  // Asset Value History API
  assetHistory: {
    getByAsset: (assetId: string) => ipcRenderer.invoke('assetHistory:getByAsset', assetId),
    create: (history: Omit<AssetValueHistory, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('assetHistory:create', history),
  },

  // Liability Value History API
  liabilityHistory: {
    getByLiability: (liabilityId: string) => ipcRenderer.invoke('liabilityHistory:getByLiability', liabilityId),
    create: (history: Omit<LiabilityValueHistory, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('liabilityHistory:create', history),
  },

  // ==================== Phase 8: Auto-Update ====================
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
    openReleasesPage: () => ipcRenderer.invoke('updater:openReleasesPage'),
    onChecking: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('updater:checking', handler);
      return () => ipcRenderer.removeListener('updater:checking', handler);
    },
    onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string; releaseDate?: string; releaseNotes?: string }) => callback(info);
      ipcRenderer.on('updater:available', handler);
      return () => ipcRenderer.removeListener('updater:available', handler);
    },
    onUpdateNotAvailable: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('updater:not-available', handler);
      return () => ipcRenderer.removeListener('updater:not-available', handler);
    },
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: { percent: number; transferred: number; total: number }) => callback(progress);
      ipcRenderer.on('updater:progress', handler);
      return () => ipcRenderer.removeListener('updater:progress', handler);
    },
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
      ipcRenderer.on('updater:downloaded', handler);
      return () => ipcRenderer.removeListener('updater:downloaded', handler);
    },
    onError: (callback: (error: { message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: { message: string }) => callback(error);
      ipcRenderer.on('updater:error', handler);
      return () => ipcRenderer.removeListener('updater:error', handler);
    },
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // ==================== Transaction Attachments ====================
  attachments: {
    getByTransaction: (transactionId: string) =>
      ipcRenderer.invoke('attachments:getByTransaction', transactionId),
    getById: (id: string) => ipcRenderer.invoke('attachments:getById', id),
    add: (transactionId: string, sourceFilePath: string) =>
      ipcRenderer.invoke('attachments:add', transactionId, sourceFilePath),
    delete: (id: string) => ipcRenderer.invoke('attachments:delete', id),
    open: (id: string) => ipcRenderer.invoke('attachments:open', id),
    getCountsByTransactionIds: (transactionIds: string[]) =>
      ipcRenderer.invoke('attachments:getCountsByTransactionIds', transactionIds),
    selectFile: (): Promise<{ canceled: boolean; filePaths?: string[] }> =>
      ipcRenderer.invoke('attachments:selectFile'),
  },

  // ==================== Onboarding ====================
  onboarding: {
    getStatus: (): Promise<string> => ipcRenderer.invoke('onboarding:getStatus'),
    setComplete: (value: string): Promise<void> => ipcRenderer.invoke('onboarding:setComplete', value),
  },

  // ==================== Tutorials ====================
  tutorials: {
    isCompleted: (toolId: string): Promise<string> => ipcRenderer.invoke('tutorials:isCompleted', toolId),
    markCompleted: (toolId: string): Promise<void> => ipcRenderer.invoke('tutorials:markCompleted', toolId),
    resetAll: (): Promise<void> => ipcRenderer.invoke('tutorials:resetAll'),
  },

  // ==================== Find in Page ====================
  find: {
    findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) =>
      ipcRenderer.invoke('find:findInPage', text, options),
    stopFindInPage: () => ipcRenderer.invoke('find:stopFindInPage'),
    onOpen: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('find:open', handler);
      return () => ipcRenderer.removeListener('find:open', handler);
    },
    onResult: (callback: (result: { activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, result: { activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => {
        callback(result);
      };
      ipcRenderer.on('find:result', handler);
      return () => ipcRenderer.removeListener('find:result', handler);
    },
  },

  // ==================== Transaction Reimbursements ====================
  reimbursements: {
    getForExpense: (expenseId: string) => ipcRenderer.invoke('reimbursements:getForExpense', expenseId),
    getForIncome: (incomeId: string) => ipcRenderer.invoke('reimbursements:getForIncome', incomeId),
    getAll: () => ipcRenderer.invoke('reimbursements:getAll'),
    create: (data: { expenseTransactionId: string; reimbursementTransactionId: string; amount: number }) =>
      ipcRenderer.invoke('reimbursements:create', data),
    delete: (id: string) => ipcRenderer.invoke('reimbursements:delete', id),
    getSummary: (transactionId: string) => ipcRenderer.invoke('reimbursements:getSummary', transactionId),
    validate: (expenseId: string, amount: number, excludeLinkId?: string) =>
      ipcRenderer.invoke('reimbursements:validate', expenseId, amount, excludeLinkId),
    getCandidates: (expenseId: string) => ipcRenderer.invoke('reimbursements:getCandidates', expenseId),
  },

  // ==================== Saved Reports ====================
  savedReports: {
    getAll: () => ipcRenderer.invoke('savedReports:getAll'),
    getById: (id: string) => ipcRenderer.invoke('savedReports:getById', id),
    create: (name: string, config: string) =>
      ipcRenderer.invoke('savedReports:create', name, config),
    update: (id: string, updates: Partial<{ name: string; config: string; lastAccessedAt: number }>) =>
      ipcRenderer.invoke('savedReports:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('savedReports:delete', id),
    getRecent: (limit?: number) => ipcRenderer.invoke('savedReports:getRecent', limit),
  },

  // ==================== Security ====================
  security: {
    lock: () => ipcRenderer.invoke('security:lock'),
    getAutoLock: () => ipcRenderer.invoke('security:getAutoLock'),
    setAutoLock: (minutes: number) => ipcRenderer.invoke('security:setAutoLock', minutes),
    heartbeat: () => ipcRenderer.invoke('security:heartbeat'),
    getMemberAuthStatus: () => ipcRenderer.invoke('security:getMemberAuthStatus'),
    enableMemberPassword: (userId: string, password: string) =>
      ipcRenderer.invoke('security:enableMemberPassword', userId, password),
    disableMemberPassword: (userId: string, currentPassword: string) =>
      ipcRenderer.invoke('security:disableMemberPassword', userId, currentPassword),
    changeMemberPassword: (userId: string, oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('security:changeMemberPassword', userId, oldPassword, newPassword),
    unlockMember: (userId: string, password: string | null) =>
      ipcRenderer.invoke('security:unlockMember', userId, password),
    unlockMemberStartup: (userId: string, password: string | null) =>
      ipcRenderer.invoke('security:unlockMemberStartup', userId, password),
    onLock: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('app:lock', handler);
      return () => ipcRenderer.removeListener('app:lock', handler);
    },
    onUnlock: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('app:unlock', handler);
      return () => ipcRenderer.removeListener('app:unlock', handler);
    },
  },

  // ==================== Budget Settings (Flex Mode) ====================
  budgetSettings: {
    getMode: (): Promise<string> =>
      ipcRenderer.invoke('budgetSettings:getMode'),
    setMode: (mode: string): Promise<void> =>
      ipcRenderer.invoke('budgetSettings:setMode', mode),
    getFlexTarget: (): Promise<number> =>
      ipcRenderer.invoke('budgetSettings:getFlexTarget'),
    setFlexTarget: (amountCents: number): Promise<void> =>
      ipcRenderer.invoke('budgetSettings:setFlexTarget', amountCents),
    getFixedCategoryIds: (): Promise<string[]> =>
      ipcRenderer.invoke('budgetSettings:getFixedCategoryIds'),
    setFixedCategoryIds: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke('budgetSettings:setFixedCategoryIds', ids),
  },

  // ==================== Budget Income Override ====================
  budgetIncome: {
    getOverride: (): Promise<number | null> =>
      ipcRenderer.invoke('budgetIncome:getOverride'),
    setOverride: (amountCents: number | null): Promise<void> =>
      ipcRenderer.invoke('budgetIncome:setOverride', amountCents),
  },

  // ==================== Dashboard Layout ====================
  dashboardLayout: {
    get: (): Promise<string> => ipcRenderer.invoke('dashboardLayout:get'),
    set: (layout: string): Promise<void> => ipcRenderer.invoke('dashboardLayout:set', layout),
    getWidgets: (): Promise<string> => ipcRenderer.invoke('dashboardWidgets:get'),
    setWidgets: (widgets: string): Promise<void> => ipcRenderer.invoke('dashboardWidgets:set', widgets),
  },

  // ==================== Phase 10: Database Export/Import ====================
  database: {
    export: () => ipcRenderer.invoke('database:export'),
    importSelect: () => ipcRenderer.invoke('database:import:select'),
    importGetCurrentMetadata: () => ipcRenderer.invoke('database:import:metadata'),
    importConfirm: (importPath: string) => ipcRenderer.invoke('database:import:confirm', importPath),
    onMenuExport: (callback: () => void) => {
      ipcRenderer.on('menu:export-database', () => callback());
      return () => ipcRenderer.removeAllListeners('menu:export-database');
    },
    onMenuImport: (callback: () => void) => {
      ipcRenderer.on('menu:import-database', () => callback());
      return () => ipcRenderer.removeAllListeners('menu:import-database');
    },
  },

  // ==================== Sharing ====================
  sharing: {
    createShare: (entityId: string, entityType: EncryptableEntityType, recipientId: string, permissions: SharePermissions) =>
      ipcRenderer.invoke('sharing:createShare', entityId, entityType, recipientId, permissions),
    revokeShare: (shareId: string) =>
      ipcRenderer.invoke('sharing:revokeShare', shareId),
    updatePermissions: (shareId: string, permissions: SharePermissions) =>
      ipcRenderer.invoke('sharing:updatePermissions', shareId, permissions),
    getSharesForEntity: (entityId: string, entityType: EncryptableEntityType) =>
      ipcRenderer.invoke('sharing:getSharesForEntity', entityId, entityType),
    getSharedWithMe: () =>
      ipcRenderer.invoke('sharing:getSharedWithMe'),
    getDefaults: (ownerId: string, entityType?: EncryptableEntityType) =>
      ipcRenderer.invoke('sharing:getDefaults', ownerId, entityType),
    setDefault: (ownerId: string, recipientId: string, entityType: EncryptableEntityType, permissions: SharePermissions) =>
      ipcRenderer.invoke('sharing:setDefault', ownerId, recipientId, entityType, permissions),
    removeDefault: (defaultId: string) =>
      ipcRenderer.invoke('sharing:removeDefault', defaultId),
  },
});
