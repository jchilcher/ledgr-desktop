import {
  Account,
  Transaction,
  Category,
  CategoryRule,
  RecurringTransaction,
  RecurringItem,
  RecurringPayment,
  RecurringPaymentWithItem,
  Tag,

  TransactionSplit,
  BudgetGoal,
  SpendingAlert,
  Bill,
  BillPayment,
  CategoryCorrection,
  Asset,
  Liability,
  NetWorthHistory,
  SavingsGoal,
  SavingsContribution,
  SavingsGoalAlert,
  SavingsGrowthPoint,
  SavingsMonthlyContribution,
  Investment,
  InvestmentHistory,
  Receipt,
  RecurringSuggestion,
  BudgetSuggestion,
  InvestmentAccount,
  Holding,
  CostBasisLot,
  PriceCacheEntry,
  InvestmentTransaction,
  InvestmentSettings,
  ManualAsset,
  ManualLiability,
  NetWorthSnapshot,
  AssetValueHistory,
  LiabilityValueHistory,
  TransactionColumnMapping,
  TransactionImportPreviewRow,
  TransactionImportPreviewResult,
  TransactionImportCommitResult,
  DuplicateAction,
  DatabaseMetadata,
  TransactionReimbursement,
  ReimbursementSummary,
  UserAuthStatus,
  SavedReport,
  User,
  TransactionAttachment,
  EncryptableEntityType,
  SharingEntityType,
  SharePermissions,
  DataShare,
  SharingDefault,
  SafeToSpendResult,
  AgeOfMoneyResult,
  TaxLotReport,
  EnhancedCategoryRule,
  AutomationRuleAction,
  PaycheckAllocation,
  PaycheckBudgetView,
} from './types';

import type {
  NetWorthCalculation,
  NetWorthChangeSummary,
  NetWorthProjectionConfig,
  NetWorthForecast,
  LoanPayoffCalculation,
  LoanExtraPaymentImpact,
} from '@ledgr/core';

export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  errors: number;
  error?: string;
}

export interface SpendingForecast {
  period: number;
  projectedSpending: number;
  confidence: number;
  historicalAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

export interface CategorySpendingForecast {
  categoryId: string;
  period: number;
  projectedSpending: number;
  confidence: number;
  historicalAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalityFactor: number;
  transactionCount: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

export interface ConnectionStatus {
  connected: boolean;
  institutionName?: string;
  lastSynced: Date | null;
  accountCount?: number;
}

export interface SyncResult {
  imported: number;
  duplicates: number;
  errors: number;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  recordCount?: number;
  error?: string;
}

// Extended Forecast Types (5-Year Support)
export type ForecastGranularity = 'daily' | 'weekly' | 'monthly';

export interface ExtendedForecastOptions {
  forecastDays: number;
  granularity?: ForecastGranularity;
  includeCategoryTrends?: boolean;
  selectedCategoryIds?: string[]; // specific categories to include in trends (all if empty/undefined)
  trendDampeningFactor?: number;
  historyMonths?: number;
}

export interface CategoryTrendProjection {
  date: Date;
  categoryId: string;
  categoryName?: string;
  projectedAmount: number;
  confidence: number;
  confidenceLower: number;
  confidenceUpper: number;
  source: 'trend';
  seasonalIndex?: number;
}

export interface LongTermCategoryForecast {
  categoryId: string;
  categoryName: string;
  projections: CategoryTrendProjection[];
  summary: {
    totalProjected: number;
    averageMonthly: number;
    averageConfidence: number;
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    seasonalVariation: number;
  };
}

export interface EnhancedProjectedTransaction {
  date: Date;
  description: string;
  amount: number;
  categoryId: string | null;
  source: 'recurring' | 'trend';
  confidence?: number;
}

export interface EnhancedBalanceProjection {
  date: Date;
  balance: number;
  balanceLower: number;
  balanceUpper: number;
  confidence: number;
  recurringTotal: number;
  trendTotal: number;
  transactions: EnhancedProjectedTransaction[];
  categoryTrends?: CategoryTrendProjection[];
}

export interface EnhancedCashFlowForecast {
  accountId: string;
  startingBalance: number;
  forecastDays: number;
  granularity: ForecastGranularity;
  includedCategoryTrends: boolean;
  projections: EnhancedBalanceProjection[];
  warnings: Array<{
    type: 'negative_balance' | 'low_balance' | 'high_uncertainty';
    date: Date;
    balance: number;
    message: string;
  }>;
  summary: {
    endingBalance: number;
    endingBalanceLower: number;
    endingBalanceUpper: number;
    totalRecurringIncome: number;
    totalRecurringExpenses: number;
    totalTrendExpenses: number;
    averageConfidence: number;
    lowestBalance: number;
    lowestBalanceDate: Date | null;
  };
}

export interface API {
  version: string;

  users: {
    getAll: () => Promise<User[]>;
    getById: (id: string) => Promise<User | null>;
    getDefault: () => Promise<User>;
    create: (name: string, color: string) => Promise<User>;
    update: (id: string, updates: Partial<{ name: string; color: string; isDefault: boolean }>) => Promise<User | null>;
    delete: (id: string) => Promise<boolean>;
  };

  accounts: {
    getAll: () => Promise<Account[]>;
    getById: (id: string) => Promise<Account | null>;
    create: (account: Omit<Account, 'id' | 'createdAt'>) => Promise<Account>;
    update: (
      id: string,
      updates: Partial<Omit<Account, 'id' | 'createdAt'>>
    ) => Promise<Account | null>;
    delete: (id: string) => Promise<boolean>;
    getDefault: () => Promise<string>;
    setDefault: (accountId: string) => Promise<boolean>;
  };

  transactions: {
    getAll: () => Promise<Transaction[]>;
    getByAccount: (accountId: string) => Promise<Transaction[]>;
    create: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<Transaction>;
    update: (
      id: string,
      updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
    ) => Promise<Transaction | null>;
    delete: (id: string) => Promise<boolean>;
    bulkUpdateCategory: (
      pattern: string,
      categoryId: string,
      createRule: boolean,
      filterCategoryId: string | null
    ) => Promise<{ updated: number; ruleCreated: boolean }>;
    countByPattern: (pattern: string, filterCategoryId?: string | null) => Promise<number>;
    samplesByPattern: (pattern: string, limit?: number, filterCategoryId?: string | null) => Promise<Transaction[]>;
    bulkDelete: (ids: string[]) => Promise<number>;
    bulkUpdateCategoryByIds: (ids: string[], categoryId: string | null) => Promise<number>;
  };

  categories: {
    getAll: () => Promise<Category[]>;
    getById: (id: string) => Promise<Category | null>;
    create: (category: Omit<Category, 'id'>) => Promise<Category>;
    update: (
      id: string,
      updates: Partial<Omit<Category, 'id'>>
    ) => Promise<Category | null>;
    delete: (id: string) => Promise<boolean>;
    addMissingDefaults: () => Promise<{ added: string[] }>;
  };

  categoryRules: {
    getAll: () => Promise<CategoryRule[]>;
    getById: (id: string) => Promise<CategoryRule | null>;
    create: (rule: Omit<CategoryRule, 'id' | 'createdAt'>) => Promise<CategoryRule>;
    update: (
      id: string,
      updates: Partial<Omit<CategoryRule, 'id' | 'createdAt'>>
    ) => Promise<CategoryRule | null>;
    delete: (id: string) => Promise<boolean>;
    applyToTransactions: (onlyUncategorized: boolean) => Promise<{ updated: number; total: number }>;
    suggestCategory: (description: string) => Promise<string | null>;
  };

  import: {
    selectFile: () => Promise<string | null>;
    file: (accountId: string, filePath: string) => Promise<ImportResult>;
    csv: (accountId: string, filePath: string) => Promise<ImportResult>;
  };

  transactionImport: {
    selectFile: () => Promise<{ canceled: boolean; filePath?: string }>;
    preview: (
      filePath: string,
      accountId: string,
      columnMapping?: TransactionColumnMapping
    ) => Promise<TransactionImportPreviewResult>;
    commit: (
      accountId: string,
      rows: TransactionImportPreviewRow[],
      duplicateAction: DuplicateAction
    ) => Promise<TransactionImportCommitResult>;
  };

  analytics: {
    getSpendingByCategory: (startDate?: string, endDate?: string) => Promise<Array<{
      categoryId: string;
      categoryName: string;
      total: number;
      count: number;
      color: string;
    }>>;
    getIncomeVsExpensesOverTime: (
      grouping: 'day' | 'week' | 'month' | 'year',
      startDate?: string,
      endDate?: string
    ) => Promise<Array<{
      period: string;
      income: number;
      expenses: number;
      net: number;
    }>>;
    getCategoryTrendsOverTime: (
      categoryIds: string[],
      grouping: 'day' | 'week' | 'month' | 'year',
      startDate?: string,
      endDate?: string
    ) => Promise<Array<{
      categoryId: string;
      categoryName: string;
      period: string;
      total: number;
      count: number;
      average: number;
      color: string;
    }>>;
    getCategoryTrendsSelectedCategories: () => Promise<string>;
    setCategoryTrendsSelectedCategories: (categoryIds: string) => Promise<void>;
  };

  forecast: {
    spending: (forecastDays: number, historyDays?: number) => Promise<SpendingForecast | null>;
    multiPeriod: (periods: number[]) => Promise<SpendingForecast[]>;
    categorySpending: (categoryId: string, forecastDays: number, historyDays?: number) => Promise<CategorySpendingForecast | null>;
    allCategories: (forecastDays?: number, historyDays?: number) => Promise<CategorySpendingForecast[]>;
    // Enhanced long-term forecasting (5-year support)
    categoryLongTerm: (categoryId: string, options: ExtendedForecastOptions) => Promise<LongTermCategoryForecast | null>;
    allCategoriesLongTerm: (options: ExtendedForecastOptions) => Promise<LongTermCategoryForecast[]>;
    selectGranularity: (forecastDays: number) => Promise<ForecastGranularity>;
  };

  recurringTransactions: {
    getAll: () => Promise<RecurringTransaction[]>;
    getByAccount: (accountId: string) => Promise<RecurringTransaction[]>;
    getById: (id: string) => Promise<RecurringTransaction | null>;
    create: (recurringTx: Omit<RecurringTransaction, 'id'>) => Promise<RecurringTransaction>;
    update: (
      id: string,
      updates: Partial<Omit<RecurringTransaction, 'id'>>
    ) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  // Unified Recurring Items API (replaces bills and recurringTransactions)
  recurring: {
    getAll: () => Promise<RecurringItem[]>;
    getActive: () => Promise<RecurringItem[]>;
    getById: (id: string) => Promise<RecurringItem | null>;
    getByAccount: (accountId: string) => Promise<RecurringItem[]>;
    create: (item: Omit<RecurringItem, 'id' | 'createdAt'>) => Promise<RecurringItem>;
    update: (id: string, updates: Partial<Omit<RecurringItem, 'id' | 'createdAt'>>) => Promise<RecurringItem | null>;
    delete: (id: string) => Promise<boolean>;
    migrate: () => Promise<RecurringItem[]>;
  };

  recurringPayments: {
    getAll: (recurringItemId: string) => Promise<RecurringPayment[]>;
    getById: (id: string) => Promise<RecurringPayment | null>;
    getUpcoming: (days?: number) => Promise<RecurringPayment[]>;
    getByDateRange: (startDate: string, endDate: string) => Promise<RecurringPaymentWithItem[]>;
    create: (payment: Omit<RecurringPayment, 'id' | 'createdAt'>) => Promise<RecurringPayment>;
    update: (id: string, updates: Partial<Omit<RecurringPayment, 'id' | 'createdAt' | 'recurringItemId'>>) => Promise<RecurringPayment | null>;
    delete: (id: string) => Promise<boolean>;
  };

  cashflow: {
    forecast: (accountId: string, startDate: string, endDate: string) => Promise<{
      accountId: string;
      startingBalance: number;
      projections: Array<{
        date: Date;
        balance: number;
        transactions: Array<{
          date: Date;
          description: string;
          amount: number;
          categoryId: string | null;
          source: 'recurring';
        }>;
      }>;
      warnings: Array<{
        type: 'negative_balance' | 'low_balance';
        date: Date;
        balance: number;
        message: string;
      }>;
    }>;
    projectTransactions: (accountId: string, startDate: string, endDate: string) => Promise<Array<{
      date: Date;
      description: string;
      amount: number;
      categoryId: string | null;
      source: 'recurring';
    }>>;
    // Enhanced cashflow with category trends (5-year support)
    forecastEnhanced: (accountId: string, options: ExtendedForecastOptions, lowBalanceThreshold?: number) => Promise<EnhancedCashFlowForecast>;
  };

  ofx: {
    getBanks: () => Promise<Array<{
      id: string;
      name: string;
      ofxUrl: string;
      org: string;
      fid: string;
    }>>;
    searchBanks: (query: string) => Promise<Array<{
      id: string;
      name: string;
      ofxUrl: string;
      org: string;
      fid: string;
    }>>;
    testConnection: (bankId: string, username: string, password: string) => Promise<{
      success: boolean;
      error?: string;
      accounts?: Array<{ accountId: string; accountType: string }>;
    }>;
    saveConnection: (connectionData: {
      bankId: string;
      bankName: string;
      ofxUrl: string;
      org: string;
      fid: string;
      username: string;
      accountId: string;
      accountType: string;
    }) => Promise<Account>;
    syncTransactions: (accountId: string, password: string, startDate?: string, endDate?: string) => Promise<{
      success: boolean;
      error?: string;
      imported?: number;
      duplicates?: number;
      balance?: number;
    }>;
    disconnectAccount: (accountId: string) => Promise<{ success: boolean }>;
  };

  // Phase 1: Data Export
  export: {
    transactions: (options: {
      format: 'csv' | 'json';
      includeCategories?: boolean;
      includeTags?: boolean;
      accountId?: string;
      startDate?: string;
      endDate?: string;
    }) => Promise<ExportResult>;
    allData: () => Promise<ExportResult>;
  };

  // Phase 1: Tags
  tags: {
    getAll: () => Promise<Tag[]>;
    getById: (id: string) => Promise<Tag | null>;
    create: (tag: Omit<Tag, 'id' | 'createdAt'>) => Promise<Tag>;
    update: (id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => Promise<Tag | null>;
    delete: (id: string) => Promise<boolean>;
    getForTransaction: (transactionId: string) => Promise<Tag[]>;
    addToTransaction: (transactionId: string, tagId: string) => Promise<void>;
    removeFromTransaction: (transactionId: string, tagId: string) => Promise<void>;
    setForTransaction: (transactionId: string, tagIds: string[]) => Promise<void>;
    getTransactions: (tagId: string) => Promise<Transaction[]>;
  };

  // Phase 1: Split Transactions
  splits: {
    getAll: (parentTransactionId: string) => Promise<TransactionSplit[]>;
    getById: (id: string) => Promise<TransactionSplit | null>;
    create: (split: Omit<TransactionSplit, 'id' | 'createdAt'>) => Promise<TransactionSplit>;
    update: (id: string, updates: Partial<Omit<TransactionSplit, 'id' | 'createdAt' | 'parentTransactionId'>>) => Promise<TransactionSplit | null>;
    delete: (id: string) => Promise<boolean>;
    deleteAll: (parentTransactionId: string) => Promise<number>;
    getTransactionIds: () => Promise<string[]>;
    getByTransactionIds: (ids: string[]) => Promise<TransactionSplit[]>;
  };

  // Phase 1: Search
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
    }) => Promise<Transaction[]>;
  };

  // Phase 2: Budget Goals
  budgetGoals: {
    getAll: () => Promise<BudgetGoal[]>;
    getById: (id: string) => Promise<BudgetGoal | null>;
    getByCategory: (categoryId: string) => Promise<BudgetGoal | null>;
    create: (goal: Omit<BudgetGoal, 'id' | 'createdAt'>) => Promise<BudgetGoal>;
    update: (id: string, updates: Partial<Omit<BudgetGoal, 'id' | 'createdAt'>>) => Promise<BudgetGoal | null>;
    delete: (id: string) => Promise<boolean>;
  };

  // Budget Suggestions
  budgetSuggestions: {
    getAll: (options?: { historyMonths?: number; bufferPercent?: number }) => Promise<BudgetSuggestion[]>;
    forCategory: (categoryId: string, options?: { historyMonths?: number; userGoal?: 'reduce_spending' }) => Promise<BudgetSuggestion | null>;
    apply: (suggestion: BudgetSuggestion) => Promise<BudgetGoal>;
  };

  // Phase 2: Spending Alerts
  spendingAlerts: {
    getAll: () => Promise<SpendingAlert[]>;
    getById: (id: string) => Promise<SpendingAlert | null>;
    getActive: () => Promise<SpendingAlert[]>;
    create: (alert: Omit<SpendingAlert, 'id' | 'createdAt'>) => Promise<SpendingAlert>;
    update: (id: string, updates: Partial<Omit<SpendingAlert, 'id' | 'createdAt'>>) => Promise<SpendingAlert | null>;
    delete: (id: string) => Promise<boolean>;
  };

  // Phase 3: Bills
  bills: {
    getAll: () => Promise<Bill[]>;
    getActive: () => Promise<Bill[]>;
    getById: (id: string) => Promise<Bill | null>;
    create: (bill: Omit<Bill, 'id' | 'createdAt'>) => Promise<Bill>;
    update: (id: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>) => Promise<Bill | null>;
    delete: (id: string) => Promise<boolean>;
  };

  billPayments: {
    getAll: (billId: string) => Promise<BillPayment[]>;
    getById: (id: string) => Promise<BillPayment | null>;
    getUpcoming: (days?: number) => Promise<BillPayment[]>;
    create: (payment: Omit<BillPayment, 'id' | 'createdAt'>) => Promise<BillPayment>;
    update: (id: string, updates: Partial<Omit<BillPayment, 'id' | 'createdAt' | 'billId'>>) => Promise<BillPayment | null>;
    delete: (id: string) => Promise<boolean>;
  };

  // Phase 3: Category Corrections
  categoryCorrections: {
    getAll: () => Promise<CategoryCorrection[]>;
    getById: (id: string) => Promise<CategoryCorrection | null>;
    find: (description: string) => Promise<CategoryCorrection | null>;
    create: (correction: Omit<CategoryCorrection, 'id' | 'createdAt'>) => Promise<CategoryCorrection>;
    update: (id: string, updates: Partial<Omit<CategoryCorrection, 'id' | 'createdAt'>>) => Promise<CategoryCorrection | null>;
    delete: (id: string) => Promise<boolean>;
    incrementUsage: (id: string) => Promise<void>;
  };

  // Phase 4: Assets
  assets: {
    getAll: () => Promise<Asset[]>;
    getById: (id: string) => Promise<Asset | null>;
    create: (asset: Omit<Asset, 'id' | 'createdAt'>) => Promise<Asset>;
    update: (id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt'>>) => Promise<Asset | null>;
    delete: (id: string) => Promise<boolean>;
    getTotal: () => Promise<number>;
  };

  // Phase 4: Liabilities
  liabilities: {
    getAll: () => Promise<Liability[]>;
    getById: (id: string) => Promise<Liability | null>;
    create: (liability: Omit<Liability, 'id' | 'createdAt'>) => Promise<Liability>;
    update: (id: string, updates: Partial<Omit<Liability, 'id' | 'createdAt'>>) => Promise<Liability | null>;
    delete: (id: string) => Promise<boolean>;
    getTotal: () => Promise<number>;
  };

  // Phase 4: Net Worth (Legacy)
  netWorth: {
    createHistory: () => Promise<NetWorthHistory>;
    getHistory: (limit?: number) => Promise<NetWorthHistory[]>;
    getById: (id: string) => Promise<NetWorthHistory | null>;
  };

  // Phase 4: Savings Goals
  savingsGoals: {
    getAll: () => Promise<SavingsGoal[]>;
    getActive: () => Promise<SavingsGoal[]>;
    getById: (id: string) => Promise<SavingsGoal | null>;
    create: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => Promise<SavingsGoal>;
    update: (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) => Promise<SavingsGoal | null>;
    delete: (id: string) => Promise<boolean>;
    pinAccount: (goalId: string, accountId: string) => Promise<SavingsGoal | null>;
    unpinAccount: (goalId: string) => Promise<SavingsGoal | null>;
    syncWithAccount: (goalId: string) => Promise<SavingsGoal | null>;
    getGrowthData: (goalId: string) => Promise<SavingsGrowthPoint[]>;
    getMonthlyContributions: (goalId: string) => Promise<SavingsMonthlyContribution[]>;
    getAlerts: () => Promise<SavingsGoalAlert[]>;
  };

  savingsContributions: {
    getAll: (goalId: string) => Promise<SavingsContribution[]>;
    getById: (id: string) => Promise<SavingsContribution | null>;
    create: (contribution: Omit<SavingsContribution, 'id' | 'createdAt'>) => Promise<SavingsContribution>;
    delete: (id: string) => Promise<boolean>;
  };

  // Phase 5: Investments
  investments: {
    getAll: () => Promise<Investment[]>;
    getById: (id: string) => Promise<Investment | null>;
    create: (investment: Omit<Investment, 'id' | 'createdAt'>) => Promise<Investment>;
    update: (id: string, updates: Partial<Omit<Investment, 'id' | 'createdAt'>>) => Promise<Investment | null>;
    delete: (id: string) => Promise<boolean>;
    getTotal: () => Promise<number>;
  };

  investmentHistory: {
    getAll: (investmentId: string) => Promise<InvestmentHistory[]>;
    create: (history: Omit<InvestmentHistory, 'id'>) => Promise<InvestmentHistory>;
  };

  // Phase 6: Receipts
  receipts: {
    getAll: () => Promise<Receipt[]>;
    getById: (id: string) => Promise<Receipt | null>;
    getByTransaction: (transactionId: string) => Promise<Receipt | null>;
    create: (receipt: Omit<Receipt, 'id'>) => Promise<Receipt>;
    update: (id: string, updates: Partial<Omit<Receipt, 'id'>>) => Promise<Receipt | null>;
    delete: (id: string) => Promise<boolean>;
  };

  // Recurring Payment Detection
  recurringDetection: {
    analyze: () => Promise<RecurringSuggestion[]>;
    approve: (suggestion: RecurringSuggestion, enableReminders: boolean, itemType?: string) => Promise<{ success: boolean; item: RecurringItem }>;
    // Legacy methods for backwards compatibility
    approveAsBill: (suggestion: RecurringSuggestion) => Promise<{ success: boolean; bill: Bill }>;
    approveAsRecurring: (suggestion: RecurringSuggestion) => Promise<{ success: boolean; recurring: RecurringTransaction }>;
  };

  // Window Management
  window: {
    openNewWindow: (view: string) => Promise<number>;
  };

  // Phase 7: Prediction & Reporting

  // Anomaly Detection
  anomalyDetection: {
    detect: (options?: {
      zScoreThreshold?: number;
      historyDays?: number;
      lookbackDays?: number;
      gracePeriodDays?: number;
      duplicateWindowDays?: number;
    }) => Promise<{
      anomalies: Array<{
        id: string;
        type: 'unusual_amount' | 'missing_recurring' | 'duplicate_charge';
        severity: 'low' | 'medium' | 'high';
        transactionId?: string | null;
        recurringItemId?: string | null;
        description: string;
        amount?: number | null;
        expectedAmount?: number | null;
        zScore?: number | null;
        relatedTransactionIds?: string[];
        detectedAt: Date;
        acknowledged: boolean;
        dismissedAt?: Date | null;
      }>;
      summary: {
        totalAnomalies: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
      };
    }>;
    detectUnusualAmounts: (zScoreThreshold?: number, historyDays?: number, lookbackDays?: number) =>
      Promise<Array<{
        id: string;
        type: 'unusual_amount';
        severity: 'low' | 'medium' | 'high';
        transactionId?: string | null;
        description: string;
        amount?: number | null;
        expectedAmount?: number | null;
        zScore?: number | null;
        detectedAt: Date;
        acknowledged: boolean;
      }>>;
    detectMissingRecurring: (gracePeriodDays?: number) =>
      Promise<Array<{
        id: string;
        type: 'missing_recurring';
        severity: 'low' | 'medium' | 'high';
        recurringItemId?: string | null;
        description: string;
        expectedAmount?: number | null;
        detectedAt: Date;
        acknowledged: boolean;
      }>>;
    detectDuplicateCharges: (windowDays?: number, lookbackDays?: number) =>
      Promise<Array<{
        id: string;
        type: 'duplicate_charge';
        severity: 'low' | 'medium' | 'high';
        transactionId?: string | null;
        description: string;
        amount?: number | null;
        relatedTransactionIds?: string[];
        detectedAt: Date;
        acknowledged: boolean;
      }>>;
  };

  // Seasonal Analysis
  seasonalAnalysis: {
    analyze: (options?: { minMonths?: number; spikeThreshold?: number }) => Promise<{
      patterns: Array<{
        id: string;
        categoryId: string;
        year: number;
        month: number;
        averageSpending: number;
        transactionCount: number;
        seasonalIndex: number;
        calculatedAt: Date;
      }>;
      categoryAverages: Record<string, number>;
      seasonalIndices: Record<string, Record<number, number>>;
      holidaySpikes: Array<{
        categoryId: string;
        categoryName: string;
        month: number;
        spike: number;
        description: string;
      }>;
    }>;
    getPatterns: (categoryId?: string) => Promise<Array<{
      id: string;
      categoryId: string;
      year: number;
      month: number;
      averageSpending: number;
      transactionCount: number;
      seasonalIndex: number;
      calculatedAt: Date;
    }>>;
    predictMonthlySpending: (categoryId: string, month: number) => Promise<number>;
    detectHolidaySpikes: (spikeThreshold?: number) => Promise<Array<{
      categoryId: string;
      categoryName: string;
      month: number;
      spike: number;
      description: string;
    }>>;
  };

  // Income Analysis
  incomeAnalysis: {
    analyze: (options?: { historyDays?: number; minOccurrences?: number }) => Promise<{
      streams: Array<{
        id: string;
        description: string;
        normalizedDescription: string;
        averageAmount: number;
        frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
        lastReceived: Date;
        occurrences: number;
        transactionIds: string[];
        varianceCoefficient: number;
        reliabilityScore: number;
      }>;
      summary: {
        totalMonthlyIncome: number;
        totalAnnualIncome: number;
        primaryIncomeStream?: {
          id: string;
          description: string;
          averageAmount: number;
          frequency: string;
          reliabilityScore: number;
        };
        incomeStabilityScore: number;
        diversificationScore: number;
      };
      recommendations: string[];
    }>;
    identifyStreams: (options?: { historyDays?: number; minOccurrences?: number }) => Promise<Array<{
      id: string;
      description: string;
      normalizedDescription: string;
      averageAmount: number;
      frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
      lastReceived: Date;
      occurrences: number;
      transactionIds: string[];
      varianceCoefficient: number;
      reliabilityScore: number;
    }>>;
    getSmoothedIncome: (windowMonths?: number) => Promise<Array<{
      month: string;
      actual: number;
      smoothed: number;
    }>>;
  };

  // Financial Health
  financialHealth: {
    getHistory: (limit?: number) => Promise<Array<{
      id: string;
      date: Date;
      overallScore: number;
      factorScores: string;
      createdAt: Date;
    }>>;
    getLatest: () => Promise<{
      id: string;
      date: Date;
      overallScore: number;
      factorScores: string;
      createdAt: Date;
    } | null>;
    createSnapshot: (data: { overallScore: number; factorScores: string }) => Promise<{
      id: string;
      date: Date;
      overallScore: number;
      factorScores: string;
      createdAt: Date;
    }>;
  };

  // Bill Preferences
  billPreferences: {
    getAll: () => Promise<Array<{
      id: string;
      recurringItemId: string;
      preferredDueDay: number | null;
      notes: string | null;
    }>>;
    getByRecurringItem: (recurringItemId: string) => Promise<{
      id: string;
      recurringItemId: string;
      preferredDueDay: number | null;
      notes: string | null;
    } | null>;
    upsert: (data: { recurringItemId: string; preferredDueDay?: number | null; notes?: string | null }) =>
      Promise<{ id: string; recurringItemId: string; preferredDueDay: number | null; notes: string | null }>;
    delete: (recurringItemId: string) => Promise<boolean>;
  };

  // Spending Velocity
  spendingVelocity: {
    calculate: (period: 'weekly' | 'monthly' | 'yearly') => Promise<{
      period: {
        startDate: Date;
        endDate: Date;
        daysElapsed: number;
        daysRemaining: number;
      };
      velocities: Array<{
        categoryId: string;
        categoryName: string;
        budgetAmount: number;
        currentSpent: number;
        dailyBurnRate: number;
        projectedTotal: number;
        daysRemaining: number;
        depletionDate: Date | null;
        percentUsed: number;
        status: 'safe' | 'warning' | 'danger';
        paceVsBudget: number;
      }>;
      summary: {
        categoriesAtRisk: number;
        totalBudget: number;
        totalProjectedSpending: number;
        overallStatus: 'safe' | 'warning' | 'danger';
      };
    }>;
  };

  // Comparison Reports
  comparison: {
    monthOverMonth: (months?: number) => Promise<{
      periods: Array<{
        startDate: Date;
        endDate: Date;
        label: string;
      }>;
      comparisons: Array<{
        categoryId: string;
        categoryName: string;
        periods: Array<{
          amount: number;
          transactionCount: number;
        }>;
        change: number;
        changePercent: number;
        trend: 'increasing' | 'decreasing' | 'stable';
      }>;
      summary: {
        totalSpendingByPeriod: number[];
        overallChange: number;
        overallChangePercent: number;
      };
    }>;
    yearOverYear: (currentMonth?: number) => Promise<{
      periods: Array<{
        year: number;
        month: number;
        label: string;
      }>;
      comparisons: Array<{
        categoryId: string;
        categoryName: string;
        periods: Array<{
          amount: number;
          transactionCount: number;
        }>;
        change: number;
        changePercent: number;
        trend: 'increasing' | 'decreasing' | 'stable';
      }>;
      summary: {
        totalSpendingByPeriod: number[];
        overallChange: number;
        overallChangePercent: number;
      };
    }>;
    budgetAdherence: (months?: number) => Promise<Array<{
      month: string;
      adherenceScore: number;
      categoriesOnBudget: number;
      categoriesOverBudget: number;
      totalBudget: number;
      totalSpent: number;
    }>>;
  };

  // Subscription Audit
  subscriptionAudit: {
    audit: (options?: { includeInactive?: boolean }) => Promise<{
      subscriptions: Array<{
        id: string;
        name: string;
        amount: number;
        frequency: string;
        monthlyEquivalent: number;
        annualCost: number;
        lastCharged: Date;
        categoryId?: string | null;
        daysSinceLastCharge: number;
        isActive: boolean;
        isPotentiallyUnused: boolean;
        unusedIndicators: string[];
      }>;
      summary: {
        totalMonthly: number;
        totalAnnual: number;
        activeCount: number;
        potentiallyUnusedCount: number;
        potentialSavings: number;
      };
      recommendations: string[];
    }>;
  };

  // Financial Health Calculator
  financialHealthCalc: {
    calculate: () => Promise<{
      overallScore: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      factors: Array<{
        name: string;
        score: number;
        weight: number;
        status: 'excellent' | 'good' | 'fair' | 'poor';
        recommendation?: string;
        metric?: { currentValue: string; targetValue: string; unit: string };
      }>;
      recommendations: string[];
      trend: 'improving' | 'stable' | 'declining';
      previousScore?: number;
    }>;
  };

  // Savings Projection
  savingsProjection: {
    generate: (options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => Promise<{
      projections: Array<{
        goalId: string;
        goalName: string;
        targetAmount: number;
        currentAmount: number;
        remainingAmount: number;
        percentComplete: number;
        targetDate: Date | null;
        currentMonthlyRate: number;
        averageContribution: number;
        projectedCompletionDate: Date | null;
        monthsToCompletion: number | null;
        requiredMonthlyToHitTarget: number | null;
        onTrack: boolean;
        scenarios: Array<{
          type: 'current_pace' | 'aggressive' | 'conservative';
          label: string;
          monthlyContribution: number;
          projectedCompletionDate: Date | null;
          monthsToCompletion: number | null;
          totalContributions: number;
          onTrack: boolean;
        }>;
        contributionHistory: Array<{
          month: string;
          amount: number;
        }>;
      }>;
      summary: {
        totalTargetAmount: number;
        totalCurrentAmount: number;
        totalRemainingAmount: number;
        goalsOnTrack: number;
        goalsAtRisk: number;
        averagePercentComplete: number;
        estimatedTotalMonthlyNeeded: number;
      };
      recommendations: string[];
    }>;
    forGoal: (goalId: string, options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => Promise<{
      goalId: string;
      goalName: string;
      targetAmount: number;
      currentAmount: number;
      remainingAmount: number;
      percentComplete: number;
      targetDate: Date | null;
      currentMonthlyRate: number;
      averageContribution: number;
      projectedCompletionDate: Date | null;
      monthsToCompletion: number | null;
      requiredMonthlyToHitTarget: number | null;
      onTrack: boolean;
      scenarios: Array<{
        type: 'current_pace' | 'aggressive' | 'conservative';
        label: string;
        monthlyContribution: number;
        projectedCompletionDate: Date | null;
        monthsToCompletion: number | null;
        totalContributions: number;
        onTrack: boolean;
      }>;
      contributionHistory: Array<{
        month: string;
        amount: number;
      }>;
    } | null>;
  };

  // Debt Payoff
  debtPayoff: {
    generate: (options?: {
      extraPaymentAmounts?: number[];
    }) => Promise<{
      debts: Array<{
        id: string;
        name: string;
        balance: number;
        interestRate: number;
        minimumPayment: number;
        type?: string;
      }>;
      totalDebt: number;
      totalMinimumPayments: number;
      strategies: Array<{
        strategy: 'minimum' | 'snowball' | 'avalanche';
        label: string;
        totalInterestPaid: number;
        totalPaid: number;
        payoffDate: Date;
        monthsToPayoff: number;
        debtPayoffPlans: Array<{
          debtId: string;
          debtName: string;
          originalBalance: number;
          interestRate: number;
          minimumPayment: number;
          totalInterestPaid: number;
          totalPaid: number;
          payoffDate: Date;
          monthsToPayoff: number;
        }>;
        payoffOrder: string[];
      }>;
      recommended: 'minimum' | 'snowball' | 'avalanche';
      recommendationReason: string;
      extraPaymentImpacts: Array<{
        extraMonthlyAmount: number;
        monthsSaved: number;
        interestSaved: number;
        newPayoffDate: Date;
        newTotalPaid: number;
      }>;
    }>;
    calculateStrategy: (strategy: 'minimum' | 'snowball' | 'avalanche', extraMonthly?: number) => Promise<{
      strategy: 'minimum' | 'snowball' | 'avalanche';
      label: string;
      totalInterestPaid: number;
      totalPaid: number;
      payoffDate: Date;
      monthsToPayoff: number;
      debtPayoffPlans: Array<{
        debtId: string;
        debtName: string;
        originalBalance: number;
        interestRate: number;
        minimumPayment: number;
        totalInterestPaid: number;
        totalPaid: number;
        payoffDate: Date;
        monthsToPayoff: number;
      }>;
      payoffOrder: string[];
    }>;
  };

  // Net Worth Projection
  netWorthProjection: {
    generate: (options?: {
      projectionMonths?: number;
      confidenceLevel?: number;
    }) => Promise<{
      currentNetWorth: number;
      trend: {
        direction: 'increasing' | 'decreasing' | 'stable';
        monthlyGrowthRate: number;
        monthlyGrowthAmount: number;
        annualizedGrowthRate: number;
        volatility: number;
      };
      projections: Array<{
        date: Date;
        projectedNetWorth: number;
        confidenceLower: number;
        confidenceUpper: number;
        monthsFromNow: number;
      }>;
      milestones: Array<{
        amount: number;
        label: string;
        achieved: boolean;
        achievedDate?: Date | null;
        projectedDate?: Date | null;
        monthsAway?: number | null;
      }>;
      historicalData: Array<{
        date: Date;
        netWorth: number;
      }>;
      summary: {
        oneYearProjection: number;
        fiveYearProjection: number;
        tenYearProjection: number;
        nextMilestone: {
          amount: number;
          label: string;
          achieved: boolean;
          projectedDate?: Date | null;
          monthsAway?: number | null;
        } | null;
      };
    }>;
    getTrend: () => Promise<{
      direction: 'increasing' | 'decreasing' | 'stable';
      monthlyGrowthRate: number;
      monthlyGrowthAmount: number;
      annualizedGrowthRate: number;
      volatility: number;
    }>;
    getMilestones: () => Promise<Array<{
      amount: number;
      label: string;
      achieved: boolean;
      achievedDate?: Date | null;
      projectedDate?: Date | null;
      monthsAway?: number | null;
    }>>;
  };

  // Category Migration
  categoryMigration: {
    analyze: (options?: {
      monthsBack?: number;
      shiftThreshold?: number;
    }) => Promise<{
      periods: Array<{
        period: string;
        startDate: Date;
        endDate: Date;
        totalSpending: number;
        categories: Array<{
          categoryId: string;
          categoryName: string;
          amount: number;
          proportion: number;
          transactionCount: number;
        }>;
      }>;
      shifts: Array<{
        categoryId: string;
        categoryName: string;
        previousProportion: number;
        currentProportion: number;
        proportionChange: number;
        amountChange: number;
        direction: 'increasing' | 'decreasing';
        significance: 'minor' | 'moderate' | 'significant';
      }>;
      trends: Array<{
        categoryId: string;
        categoryName: string;
        trend: 'increasing' | 'decreasing' | 'stable';
        averageProportion: number;
        volatility: number;
        history: Array<{
          period: string;
          proportion: number;
          amount: number;
        }>;
      }>;
      summary: {
        totalPeriodsAnalyzed: number;
        significantShifts: number;
        mostGrowingCategory: string | null;
        mostDecliningCategory: string | null;
        mostVolatileCategory: string | null;
        mostStableCategory: string | null;
      };
      recommendations: string[];
    }>;
    getPeriods: (monthsBack?: number) => Promise<Array<{
      period: string;
      startDate: Date;
      endDate: Date;
      totalSpending: number;
      categories: Array<{
        categoryId: string;
        categoryName: string;
        amount: number;
        proportion: number;
        transactionCount: number;
      }>;
    }>>;
  };

  // Cash Flow Optimization
  cashFlowOptimization: {
    optimize: (options?: {
      projectionDays?: number;
      warningThreshold?: number;
      criticalThreshold?: number;
    }) => Promise<{
      projectionDays: number;
      projections: Array<{
        date: Date;
        balance: number;
        inflows: number;
        outflows: number;
        items: Array<{
          name: string;
          amount: number;
          type: 'income' | 'expense';
        }>;
      }>;
      lowBalanceWindows: Array<{
        startDate: Date;
        endDate: Date;
        lowestBalance: number;
        lowestDate: Date;
        daysAtRisk: number;
        severity: 'warning' | 'critical';
        triggeringItems: string[];
      }>;
      billClusters: Array<{
        dayRange: [number, number];
        bills: Array<{
          id: string;
          name: string;
          amount: number;
          dayOfMonth: number;
        }>;
        totalAmount: number;
        percentOfMonthlyBills: number;
      }>;
      recommendations: Array<{
        recurringItemId: string;
        recurringItemName: string;
        currentDayOfMonth: number | null;
        recommendedDayOfMonth: number;
        reason: string;
        projectedImpact: number;
      }>;
      summary: {
        lowestProjectedBalance: number;
        lowestBalanceDate: Date | null;
        averageBalance: number;
        daysAtRisk: number;
        billClusteringScore: number;
        optimizationPotential: number;
      };
      insights: string[];
    }>;
    getProjections: (days?: number) => Promise<Array<{
      date: Date;
      balance: number;
      inflows: number;
      outflows: number;
      items: Array<{
        name: string;
        amount: number;
        type: 'income' | 'expense';
      }>;
    }>>;
  };

  // Recovery Plan
  recoveryPlan: {
    generate: (options?: { thresholdDays?: number }) => Promise<{
      emergencyStatus: {
        level: 'none' | 'caution' | 'warning' | 'critical';
        daysUntilNegative: number | null;
        projectedNegativeDate: Date | null;
        lowestProjectedBalance: number;
        triggeringExpenses: string[];
      };
      quickWins: Array<{
        id: string;
        type: 'cancel_subscription' | 'move_bill_due_date' | 'reduce_budget' | 'optimize_debt_payment' | 'transfer_funds';
        title: string;
        description: string;
        potentialSavings: number;
        annualImpact: number;
        urgency: 'immediate' | 'soon' | 'flexible';
        confidence: number;
        actionable: boolean;
        sourceEngine: string;
        metadata: Record<string, unknown>;
      }>;
      totalPotentialMonthlySavings: number;
      survivalMode: {
        essentialExpenses: Array<{
          id: string;
          name: string;
          amount: number;
          frequency: string;
          monthlyEquivalent: number;
          isEssential: boolean;
          categoryId?: string | null;
          categoryName?: string;
          canPause: boolean;
          pauseReason?: string;
        }>;
        pausableExpenses: Array<{
          id: string;
          name: string;
          amount: number;
          frequency: string;
          monthlyEquivalent: number;
          isEssential: boolean;
          categoryId?: string | null;
          categoryName?: string;
          canPause: boolean;
          pauseReason?: string;
        }>;
        totalEssentialMonthly: number;
        totalPausableMonthly: number;
        potentialSavingsIfAllPaused: number;
        recommendations: string[];
      } | null;
      insights: string[];
      generatedAt: Date;
    }>;
    getQuickWins: () => Promise<Array<{
      id: string;
      type: 'cancel_subscription' | 'move_bill_due_date' | 'reduce_budget' | 'optimize_debt_payment' | 'transfer_funds';
      title: string;
      description: string;
      potentialSavings: number;
      annualImpact: number;
      urgency: 'immediate' | 'soon' | 'flexible';
      confidence: number;
      actionable: boolean;
      sourceEngine: string;
      metadata: Record<string, unknown>;
    }>>;
    simulateScenario: (modifications: Array<{
      type: 'cut_category' | 'add_income' | 'cancel_subscription' | 'pause_expense';
      categoryId?: string;
      subscriptionId?: string;
      recurringItemId?: string;
      percentReduction?: number;
      amountChange?: number;
    }>, projectionDays?: number) => Promise<{
      modifications: Array<{
        type: 'cut_category' | 'add_income' | 'cancel_subscription' | 'pause_expense';
        categoryId?: string;
        subscriptionId?: string;
        recurringItemId?: string;
        percentReduction?: number;
        amountChange?: number;
      }>;
      originalProjections: Array<{
        date: Date;
        balance: number;
        inflows: number;
        outflows: number;
        items: Array<{ name: string; amount: number; type: 'income' | 'expense' }>;
      }>;
      modifiedProjections: Array<{
        date: Date;
        balance: number;
        inflows: number;
        outflows: number;
        items: Array<{ name: string; amount: number; type: 'income' | 'expense' }>;
      }>;
      originalDaysUntilNegative: number | null;
      modifiedDaysUntilNegative: number | null;
      originalLowestBalance: number;
      modifiedLowestBalance: number;
      totalMonthlySavings: number;
      summary: string;
    }>;
    getEmergencyStatus: (thresholdDays?: number) => Promise<{
      level: 'none' | 'caution' | 'warning' | 'critical';
      daysUntilNegative: number | null;
      projectedNegativeDate: Date | null;
      lowestProjectedBalance: number;
      triggeringExpenses: string[];
    }>;
    getSurvivalMode: () => Promise<{
      essentialExpenses: Array<{
        id: string;
        name: string;
        amount: number;
        frequency: string;
        monthlyEquivalent: number;
        isEssential: boolean;
        categoryId?: string | null;
        categoryName?: string;
        canPause: boolean;
        pauseReason?: string;
      }>;
      pausableExpenses: Array<{
        id: string;
        name: string;
        amount: number;
        frequency: string;
        monthlyEquivalent: number;
        isEssential: boolean;
        categoryId?: string | null;
        categoryName?: string;
        canPause: boolean;
        pauseReason?: string;
      }>;
      totalEssentialMonthly: number;
      totalPausableMonthly: number;
      potentialSavingsIfAllPaused: number;
      recommendations: string[];
    }>;
    applyQuickWin: (quickWin: {
      id: string;
      type: string;
      metadata: Record<string, unknown>;
    }) => Promise<{ success: boolean; action?: string; error?: string; itemId?: string; goalId?: string; newDay?: number }>;
  };

  // ==================== v1.1: Investment Tracking ====================
  investmentAccounts: {
    getAll: () => Promise<InvestmentAccount[]>;
    getById: (id: string) => Promise<InvestmentAccount | null>;
    create: (account: Omit<InvestmentAccount, 'id' | 'createdAt'>) => Promise<InvestmentAccount>;
    update: (id: string, updates: Partial<Omit<InvestmentAccount, 'id' | 'createdAt'>>) => Promise<InvestmentAccount | null>;
    delete: (id: string) => Promise<boolean>;
  };

  holdings: {
    getAll: () => Promise<Holding[]>;
    getByAccount: (accountId: string) => Promise<Holding[]>;
    getById: (id: string) => Promise<Holding | null>;
    create: (holding: Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>) => Promise<Holding>;
    update: (id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>>) => Promise<Holding | null>;
    delete: (id: string) => Promise<boolean>;
    bulkDelete: (ids: string[]) => Promise<number>;
  };

  lots: {
    getByHolding: (holdingId: string) => Promise<CostBasisLot[]>;
    getById: (id: string) => Promise<CostBasisLot | null>;
    create: (lot: Omit<CostBasisLot, 'id' | 'createdAt'>) => Promise<CostBasisLot>;
    update: (id: string, updates: Partial<Omit<CostBasisLot, 'id' | 'createdAt' | 'holdingId'>>) => Promise<CostBasisLot | null>;
    delete: (id: string) => Promise<boolean>;
  };

  // ==================== Phase 2: Price Service ====================
  prices: {
    get: (symbol: string) => Promise<PriceCacheEntry | null>;
    fetch: (symbol: string) => Promise<PriceCacheEntry | null>;
    fetchBatch: (
      symbols: string[],
      options?: { skipManual?: boolean }
    ) => Promise<{ results: PriceCacheEntry[]; errors: Array<{ symbol: string; error: string }> }>;
    getCached: (symbols: string[]) => Promise<Record<string, PriceCacheEntry>>;
    setManual: (symbol: string, priceInCents: number) => Promise<PriceCacheEntry>;
    clearManual: (symbol: string) => Promise<boolean>;
    isStale: (symbol: string) => Promise<boolean>;
    getStats: () => Promise<{ total: number; manual: number; stale: number; fresh: number }>;
    validateSymbol: (symbol: string) => Promise<boolean>;
    onProgress: (
      callback: (progress: { completed: number; total: number; currentSymbol: string }) => void
    ) => () => void;
  };

  // ==================== Holdings Import API (Phase 6) ====================
  holdingsImport: {
    selectFile: () => Promise<{ canceled: boolean; filePath?: string }>;

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
    ) => Promise<{
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
          headerRow?: number;
        } | null;
      };
      stats: {
        total: number;
        new: number;
        duplicates: number;
        errors: number;
      };
      error?: string;
    }>;

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
    ) => Promise<{
      success: boolean;
      imported: number;
      skipped: number;
      errors: number;
      error?: string;
    }>;

    getFormats: () => Promise<Array<{ name: string; displayName: string }>>;
  };

  // ==================== Investment Transactions (Phase 3) ====================
  investmentTransactions: {
    getAll: () => Promise<InvestmentTransaction[]>;
    getByHolding: (holdingId: string) => Promise<InvestmentTransaction[]>;
    getById: (id: string) => Promise<InvestmentTransaction | null>;
    create: (tx: Omit<InvestmentTransaction, 'id' | 'createdAt' | 'lotId'>) => Promise<InvestmentTransaction>;
    update: (id: string, updates: Partial<Omit<InvestmentTransaction, 'id' | 'createdAt'>>) => Promise<InvestmentTransaction | null>;
    delete: (id: string) => Promise<boolean>;
  };

  investmentSettings: {
    get: () => Promise<InvestmentSettings | null>;
    update: (settings: Partial<InvestmentSettings>) => Promise<InvestmentSettings>;
  };

  // ==================== Performance Analytics (Phase 4 - v1.1) ====================
  performance: {
    getMetrics: (options: PerformanceOptions) => Promise<PerformanceMetrics>;
    getPositionGainLoss: (holdingId: string) => Promise<PositionGainLoss | null>;
    getRealizedGains: (options: PerformanceOptions) => Promise<RealizedGain[]>;
    getBenchmark: (startDate: string, endDate: string) => Promise<{
      symbol: string;
      name: string;
      startDate: Date;
      endDate: Date;
      startPrice: number;
      endPrice: number;
      totalReturn: number;
      annualizedReturn: number;
    }>;
    getDefaultPeriod: () => Promise<PerformancePeriod>;
    setDefaultPeriod: (period: PerformancePeriod) => Promise<void>;
  };

  // ==================== Net Worth Integration (Phase 5 - v1.1) ====================
  manualAssets: {
    getAll: () => Promise<ManualAsset[]>;
    getById: (id: string) => Promise<ManualAsset | null>;
    create: (asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<ManualAsset>;
    update: (id: string, updates: Partial<Omit<ManualAsset, 'id' | 'createdAt'>>) => Promise<ManualAsset | null>;
    delete: (id: string) => Promise<boolean>;
    getDueReminders: () => Promise<ManualAsset[]>;
  };

  manualLiabilities: {
    getAll: () => Promise<ManualLiability[]>;
    getById: (id: string) => Promise<ManualLiability | null>;
    create: (liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>) => Promise<ManualLiability>;
    update: (id: string, updates: Partial<Omit<ManualLiability, 'id' | 'createdAt'>>) => Promise<ManualLiability | null>;
    delete: (id: string) => Promise<boolean>;
  };

  netWorthSnapshots: {
    getSnapshots: (limit?: number) => Promise<NetWorthSnapshot[]>;
    getSnapshotsByRange: (startDate: number, endDate: number) => Promise<NetWorthSnapshot[]>;
    getLatest: () => Promise<NetWorthSnapshot | null>;
    createSnapshot: (snapshot: Omit<NetWorthSnapshot, 'id' | 'createdAt'>) => Promise<NetWorthSnapshot>;
  };

  netWorthCalc: {
    calculate: () => Promise<NetWorthCalculation>;
    forceSnapshot: () => Promise<NetWorthSnapshot>;
    getChangeSummary: (startDate: number, endDate: number) => Promise<NetWorthChangeSummary | null>;
    getProjections: (config: NetWorthProjectionConfig) => Promise<NetWorthForecast>;
    calculateLoanPayoff: (liabilityId: string) => Promise<LoanPayoffCalculation>;
    calculateExtraPaymentImpact: (liabilityId: string, extraPayment: number) => Promise<LoanExtraPaymentImpact>;
  };

  assetHistory: {
    getByAsset: (assetId: string) => Promise<AssetValueHistory[]>;
    create: (history: Omit<AssetValueHistory, 'id' | 'createdAt'>) => Promise<AssetValueHistory>;
  };

  liabilityHistory: {
    getByLiability: (liabilityId: string) => Promise<LiabilityValueHistory[]>;
    create: (history: Omit<LiabilityValueHistory, 'id' | 'createdAt'>) => Promise<LiabilityValueHistory>;
  };

  updater: {
    checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string }>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    openReleasesPage: () => Promise<void>;
    onChecking: (callback: () => void) => () => void;
    onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => () => void;
    onUpdateNotAvailable: (callback: () => void) => () => void;
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
  };

  app: {
    getVersion: () => Promise<{ app: string; electron: string; node: string; chrome: string }>;
    restart: () => Promise<void>;
  };

  shell: {
    openExternal: (url: string) => Promise<void>;
  };

  // ==================== Transaction Reimbursements ====================
  reimbursements: {
    getForExpense: (expenseId: string) => Promise<TransactionReimbursement[]>;
    getForIncome: (incomeId: string) => Promise<TransactionReimbursement[]>;
    getAll: () => Promise<TransactionReimbursement[]>;
    create: (data: { expenseTransactionId: string; reimbursementTransactionId: string; amount: number }) => Promise<TransactionReimbursement>;
    delete: (id: string) => Promise<boolean>;
    getSummary: (transactionId: string) => Promise<ReimbursementSummary>;
    validate: (expenseId: string, amount: number, excludeLinkId?: string) => Promise<{ valid: boolean; remaining: number }>;
    getCandidates: (expenseId: string) => Promise<Transaction[]>;
  };

  // ==================== Saved Reports ====================
  savedReports: {
    getAll: () => Promise<SavedReport[]>;
    getById: (id: string) => Promise<SavedReport | null>;
    create: (name: string, config: string) => Promise<SavedReport>;
    update: (id: string, updates: Partial<{ name: string; config: string; lastAccessedAt: number }>) => Promise<SavedReport | null>;
    delete: (id: string) => Promise<boolean>;
    getRecent: (limit?: number) => Promise<SavedReport[]>;
  };

  // ==================== Security ====================
  security: {
    lock: () => Promise<void>;
    getAutoLock: () => Promise<number>;
    setAutoLock: (minutes: number) => Promise<void>;
    heartbeat: () => Promise<void>;
    getMemberAuthStatus: () => Promise<UserAuthStatus[]>;
    enableMemberPassword: (userId: string, password: string) => Promise<void>;
    disableMemberPassword: (userId: string, currentPassword: string) => Promise<void>;
    changeMemberPassword: (userId: string, oldPassword: string, newPassword: string) => Promise<void>;
    unlockMember: (userId: string, password: string | null) => Promise<boolean>;
    unlockMemberStartup: (userId: string, password: string | null) => Promise<string | false>;
    getCurrentUser: () => Promise<string | null>;
    onLock: (callback: () => void) => () => void;
    onUnlock: (callback: () => void) => () => void;
  };

  // ==================== Budget Settings (Flex Mode) ====================
  budgetSettings: {
    getMode: () => Promise<string>;
    setMode: (mode: string) => Promise<void>;
    getFlexTarget: () => Promise<number>;
    setFlexTarget: (amountCents: number) => Promise<void>;
    getFixedCategoryIds: () => Promise<string[]>;
    setFixedCategoryIds: (ids: string[]) => Promise<void>;
  };

  // ==================== Budget Income Override ====================
  budgetIncome: {
    getOverride: () => Promise<number | null>;
    setOverride: (amountCents: number | null) => Promise<void>;
  };

  // ==================== Find in Page ====================
  find: {
    findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) => Promise<void>;
    stopFindInPage: () => Promise<void>;
    onOpen: (callback: () => void) => () => void;
    onResult: (callback: (result: { activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void) => () => void;
  };

  // ==================== Onboarding ====================
  onboarding: {
    getStatus: () => Promise<string>;
    setComplete: (value: string) => Promise<void>;
  };

  // ==================== Tutorials ====================
  tutorials: {
    isCompleted: (toolId: string) => Promise<string>;
    markCompleted: (toolId: string) => Promise<void>;
    resetAll: () => Promise<void>;
  };

  // ==================== Dashboard Layout ====================
  dashboardLayout: {
    get: () => Promise<string>;
    set: (layout: string) => Promise<void>;
    getWidgets: () => Promise<string>;
    setWidgets: (widgets: string) => Promise<void>;
  };

  // ==================== Phase 8: Transaction Attachments ====================
  attachments: {
    getByTransaction: (transactionId: string) => Promise<TransactionAttachment[]>;
    getById: (id: string) => Promise<TransactionAttachment | null>;
    add: (transactionId: string, sourceFilePath: string) => Promise<TransactionAttachment>;
    delete: (id: string) => Promise<boolean>;
    open: (id: string) => Promise<void>;
    getCountsByTransactionIds: (transactionIds: string[]) => Promise<Record<string, number>>;
    selectFile: () => Promise<{ canceled: boolean; filePaths?: string[] }>;
  };

  // ==================== Phase 10: Database Export/Import ====================
  database: {
    export: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
    importSelect: () => Promise<{ canceled: boolean; metadata?: DatabaseMetadata; filePath?: string; error?: string }>;
    importGetCurrentMetadata: () => Promise<DatabaseMetadata>;
    importConfirm: (importPath: string) => Promise<{ success: boolean; backupPath?: string; error?: string }>;
    onMenuExport: (callback: () => void) => () => void;
    onMenuImport: (callback: () => void) => () => void;
  };

  // ==================== Sharing ====================
  sharing: {
    createShare: (entityId: string, entityType: EncryptableEntityType, recipientId: string, permissions: SharePermissions) => Promise<DataShare>;
    revokeShare: (shareId: string) => Promise<boolean>;
    updatePermissions: (shareId: string, permissions: SharePermissions) => Promise<boolean>;
    getSharesForEntity: (entityId: string, entityType: EncryptableEntityType) => Promise<DataShare[]>;
    getSharedWithMe: () => Promise<DataShare[]>;
    getDefaults: (ownerId: string, entityType?: EncryptableEntityType) => Promise<SharingDefault[]>;
    setDefault: (ownerId: string, recipientId: string, entityType: SharingEntityType, permissions: SharePermissions) => Promise<SharingDefault>;
    updateDefault: (defaultId: string, updates: { entityType?: SharingEntityType; permissions?: SharePermissions }) => Promise<boolean>;
    removeDefault: (defaultId: string) => Promise<boolean>;
  };

  // ==================== Safe to Spend ====================
  safeToSpend: {
    calculate: () => Promise<SafeToSpendResult>;
  };

  // ==================== Age of Money ====================
  ageOfMoney: {
    calculate: () => Promise<AgeOfMoneyResult>;
  };

  // ==================== Tax Lot Reports ====================
  taxLotReport: {
    generate: (taxYear: number) => Promise<TaxLotReport>;
    exportCSV: (taxYear: number) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  };

  // ==================== Enhanced Automation Rules ====================
  automationActions: {
    getForRule: (ruleId: string) => Promise<AutomationRuleAction[]>;
    create: (action: { ruleId: string; actionType: string; actionValue: string | null }) => Promise<AutomationRuleAction>;
    delete: (id: string) => Promise<boolean>;
    getEnhancedRules: () => Promise<EnhancedCategoryRule[]>;
    updateRuleConditions: (id: string, conditions: {
      amountMin?: number | null;
      amountMax?: number | null;
      accountFilter?: string[] | null;
      directionFilter?: 'income' | 'expense' | null;
    }) => Promise<boolean>;
  };

  // ==================== Paycheck-Based Budgeting ====================
  paycheckAllocations: {
    getAll: () => Promise<PaycheckAllocation[]>;
    getByStream: (incomeStreamId: string) => Promise<PaycheckAllocation[]>;
    create: (allocation: {
      incomeStreamId: string;
      incomeDescription: string;
      allocationType: string;
      targetId: string;
      amount: number;
    }) => Promise<PaycheckAllocation>;
    update: (id: string, updates: { amount?: number }) => Promise<PaycheckAllocation | null>;
    delete: (id: string) => Promise<boolean>;
    getBudgetView: (incomeStreamId: string) => Promise<PaycheckBudgetView | null>;
  };
}

declare global {
  interface Window {
    api: API;
  }
}
