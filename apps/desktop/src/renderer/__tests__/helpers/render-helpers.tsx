import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HouseholdProvider } from '../../contexts/HouseholdContext'
import { ThemeProvider } from '../../contexts/ThemeContext'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface AllProvidersProps {
  children: React.ReactNode
  queryClient?: QueryClient
}

function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createQueryClient()

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <HouseholdProvider>
          {children}
        </HouseholdProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderWithProvidersOptions
) {
  const { queryClient, ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  })
}

export function createMockApi() {
  return {
    version: '1.0.0',

    users: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      getDefault: jest.fn().mockResolvedValue({ id: '1', name: 'Default User', color: '#3498db', isDefault: true, createdAt: new Date() }),
      create: jest.fn().mockResolvedValue({ id: '1', name: 'User', color: '#3498db', isDefault: false, createdAt: new Date() }),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    accounts: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      getDefault: jest.fn().mockResolvedValue(''),
      setDefault: jest.fn().mockResolvedValue(false),
    },

    transactions: {
      getAll: jest.fn().mockResolvedValue([]),
      getByAccount: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      bulkUpdateCategory: jest.fn().mockResolvedValue({ updated: 0, ruleCreated: false }),
      countByPattern: jest.fn().mockResolvedValue(0),
      samplesByPattern: jest.fn().mockResolvedValue([]),
      bulkDelete: jest.fn().mockResolvedValue(0),
      bulkUpdateCategoryByIds: jest.fn().mockResolvedValue(0),
    },

    categories: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      addMissingDefaults: jest.fn().mockResolvedValue({ added: [] }),
    },

    categoryRules: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      applyToTransactions: jest.fn().mockResolvedValue({ updated: 0, total: 0 }),
      suggestCategory: jest.fn().mockResolvedValue(null),
    },

    import: {
      selectFile: jest.fn().mockResolvedValue(null),
      file: jest.fn().mockResolvedValue({ success: false, imported: 0, duplicates: 0, errors: 0 }),
      csv: jest.fn().mockResolvedValue({ success: false, imported: 0, duplicates: 0, errors: 0 }),
    },

    transactionImport: {
      selectFile: jest.fn().mockResolvedValue({ canceled: true }),
      preview: jest.fn().mockResolvedValue({ success: false, detectedFormat: null, formatDisplayName: '', rows: [], availableColumns: [], suggestedMapping: null, stats: { total: 0, new: 0, duplicates: 0, errors: 0 } }),
      commit: jest.fn().mockResolvedValue({ success: false, imported: 0, skipped: 0, errors: 0 }),
    },

    analytics: {
      getSpendingByCategory: jest.fn().mockResolvedValue([]),
      getIncomeVsExpensesOverTime: jest.fn().mockResolvedValue([]),
      getCategoryTrendsOverTime: jest.fn().mockResolvedValue([]),
      getCategoryTrendsSelectedCategories: jest.fn().mockResolvedValue(''),
      setCategoryTrendsSelectedCategories: jest.fn().mockResolvedValue(undefined),
    },

    forecast: {
      spending: jest.fn().mockResolvedValue(null),
      multiPeriod: jest.fn().mockResolvedValue([]),
      categorySpending: jest.fn().mockResolvedValue(null),
      allCategories: jest.fn().mockResolvedValue([]),
      categoryLongTerm: jest.fn().mockResolvedValue(null),
      allCategoriesLongTerm: jest.fn().mockResolvedValue([]),
      selectGranularity: jest.fn().mockResolvedValue('monthly'),
    },

    recurringTransactions: {
      getAll: jest.fn().mockResolvedValue([]),
      getByAccount: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    },

    recurring: {
      getAll: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      getByAccount: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      migrate: jest.fn().mockResolvedValue([]),
    },

    recurringPayments: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      getUpcoming: jest.fn().mockResolvedValue([]),
      getByDateRange: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      generate: jest.fn().mockResolvedValue({ generated: 0, overdue: 0 }),
      markPaid: jest.fn().mockResolvedValue(null),
      linkTransaction: jest.fn().mockResolvedValue(null),
      getForCurrentPeriod: jest.fn().mockResolvedValue([]),
    },

    recurringItemRules: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      runRules: jest.fn().mockResolvedValue({ matched: 0, total: 0 }),
    },

    cashflow: {
      forecast: jest.fn().mockResolvedValue({ accountId: '', startingBalance: 0, projections: [], warnings: [] }),
      projectTransactions: jest.fn().mockResolvedValue([]),
      forecastEnhanced: jest.fn().mockResolvedValue({
        accountId: '',
        startingBalance: 0,
        forecastDays: 0,
        granularity: 'monthly',
        includedCategoryTrends: false,
        projections: [],
        warnings: [],
        summary: {
          endingBalance: 0,
          endingBalanceLower: 0,
          endingBalanceUpper: 0,
          totalRecurringIncome: 0,
          totalRecurringExpenses: 0,
          totalTrendExpenses: 0,
          averageConfidence: 0,
          lowestBalance: 0,
          lowestBalanceDate: null,
        },
      }),
    },

    ofx: {
      getBanks: jest.fn().mockResolvedValue([]),
      searchBanks: jest.fn().mockResolvedValue([]),
      testConnection: jest.fn().mockResolvedValue({ success: false }),
      saveConnection: jest.fn(),
      syncTransactions: jest.fn().mockResolvedValue({ success: false }),
      disconnectAccount: jest.fn().mockResolvedValue({ success: false }),
    },

    export: {
      transactions: jest.fn().mockResolvedValue({ success: false }),
      allData: jest.fn().mockResolvedValue({ success: false }),
    },

    tags: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      getForTransaction: jest.fn().mockResolvedValue([]),
      addToTransaction: jest.fn().mockResolvedValue(undefined),
      removeFromTransaction: jest.fn().mockResolvedValue(undefined),
      setForTransaction: jest.fn().mockResolvedValue(undefined),
      getTransactions: jest.fn().mockResolvedValue([]),
    },

    splits: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
      deleteAll: jest.fn().mockResolvedValue(0),
      getTransactionIds: jest.fn().mockResolvedValue([]),
      getByTransactionIds: jest.fn().mockResolvedValue([]),
    },

    budgetGoals: {
      getAll: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    savingsGoals: {
      getAll: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    savingsContributions: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue(false),
    },

    investmentAccounts: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    holdings: {
      getAll: jest.fn().mockResolvedValue([]),
      getByAccount: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    lots: {
      getByHolding: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    prices: {
      get: jest.fn().mockResolvedValue(null),
      fetch: jest.fn().mockResolvedValue(null),
      fetchBatch: jest.fn().mockResolvedValue({ results: [], errors: [] }),
      getCached: jest.fn().mockResolvedValue({}),
      setManual: jest.fn().mockResolvedValue(undefined),
      clearManual: jest.fn().mockResolvedValue(false),
      isStale: jest.fn().mockResolvedValue(false),
      getStats: jest.fn().mockResolvedValue({ total: 0, manual: 0, stale: 0, fresh: 0 }),
      validateSymbol: jest.fn().mockResolvedValue(true),
      onProgress: jest.fn().mockReturnValue(() => {}),
      getAll: jest.fn().mockResolvedValue([]),
      refresh: jest.fn().mockResolvedValue({ completed: 0, total: 0, currentSymbol: '', errors: [] }),
      clearCache: jest.fn().mockResolvedValue(undefined),
    },

    performance: {
      calculate: jest.fn().mockResolvedValue({
        portfolio: {
          totalValue: 0,
          totalCostBasis: 0,
          unrealizedGain: 0,
          unrealizedGainPercent: 0,
          realizedGainYTD: 0,
          realizedGainTotal: 0,
          dayChange: 0,
          dayChangePercent: 0,
        },
        positions: [],
        realizedGains: [],
        returns: {
          twr: 0,
          mwr: 0,
          periodDays: 0,
          startDate: new Date(),
          endDate: new Date(),
          startValue: 0,
          endValue: 0,
          netCashFlow: 0,
        },
        calculatedAt: new Date(),
      }),
    },

    manualAssets: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    manualLiabilities: {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false),
    },

    netWorth: {
      calculate: jest.fn().mockResolvedValue({
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        bankAccounts: { total: 0, accounts: [] },
        investments: { total: 0, accounts: [] },
        manualAssets: { total: 0, assets: [] },
        manualLiabilities: { total: 0, liabilities: [] },
      }),
      getSnapshots: jest.fn().mockResolvedValue([]),
      createSnapshot: jest.fn(),
      deleteSnapshot: jest.fn().mockResolvedValue(false),
    },

    netWorthCalc: {
      calculate: jest.fn().mockResolvedValue({
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        bankAccounts: { total: 0, accounts: [] },
        investments: { total: 0, accounts: [] },
        manualAssets: { total: 0, assets: [] },
        manualLiabilities: { total: 0, liabilities: [] },
      }),
      forceSnapshot: jest.fn().mockResolvedValue({ id: '1', totalAssets: 0, totalLiabilities: 0, netWorth: 0, createdAt: new Date() }),
      getChangeSummary: jest.fn().mockResolvedValue(null),
      getProjections: jest.fn().mockResolvedValue({ periods: [], summary: { currentNetWorth: 0, projectedNetWorth: 0, totalGrowth: 0, growthPercent: 0 } }),
      calculateLoanPayoff: jest.fn().mockResolvedValue({ monthsToPayoff: 0, totalInterest: 0, payoffDate: new Date() }),
    },

    netWorthSnapshots: {
      getSnapshots: jest.fn().mockResolvedValue([]),
      getSnapshotsByRange: jest.fn().mockResolvedValue([]),
      getLatest: jest.fn().mockResolvedValue(null),
      createSnapshot: jest.fn().mockResolvedValue({ id: '1', totalAssets: 0, totalLiabilities: 0, netWorth: 0, createdAt: new Date() }),
    },

    security: {
      getUserAuthStatus: jest.fn().mockResolvedValue([]),
      getMemberAuthStatus: jest.fn().mockResolvedValue([]),
      checkPassword: jest.fn().mockResolvedValue(false),
      enableMemberPassword: jest.fn().mockResolvedValue(undefined),
      updateMemberPassword: jest.fn().mockResolvedValue(undefined),
      removeMemberPassword: jest.fn().mockResolvedValue(undefined),
      unlockMember: jest.fn().mockResolvedValue({ success: false }),
      lockMember: jest.fn().mockResolvedValue(undefined),
      getCurrentUser: jest.fn().mockResolvedValue(null),
      onLock: jest.fn().mockReturnValue(() => {}),
      onUnlock: jest.fn().mockReturnValue(() => {}),
    },

    sharing: {
      getSharedWithMe: jest.fn().mockResolvedValue([]),
      getMyShares: jest.fn().mockResolvedValue([]),
      createShare: jest.fn().mockResolvedValue(undefined),
      updateShare: jest.fn().mockResolvedValue(undefined),
      deleteShare: jest.fn().mockResolvedValue(undefined),
      getDefaults: jest.fn().mockResolvedValue([]),
      setDefault: jest.fn().mockResolvedValue(undefined),
      deleteDefault: jest.fn().mockResolvedValue(undefined),
    },

    recurringDetection: {
      detectPatterns: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn().mockResolvedValue([]),
      approveSuggestion: jest.fn().mockResolvedValue(undefined),
      dismissSuggestion: jest.fn().mockResolvedValue(undefined),
    },

    app: {
      getVersion: jest.fn().mockResolvedValue('1.0.0'),
      quit: jest.fn().mockResolvedValue(undefined),
    },

    updater: {
      checkForUpdates: jest.fn().mockResolvedValue({ available: false }),
      downloadUpdate: jest.fn().mockResolvedValue(undefined),
      installUpdate: jest.fn().mockResolvedValue(undefined),
    },

    window: {
      minimize: jest.fn().mockResolvedValue(undefined),
      maximize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    },

    database: {
      getMetadata: jest.fn().mockResolvedValue({ schemaVersion: 1, accountCount: 0, transactionCount: 0, dateRange: null, fileSizeBytes: 0 }),
      exportDatabase: jest.fn().mockResolvedValue({ success: false }),
      importDatabase: jest.fn().mockResolvedValue({ success: false }),
      getImportPreview: jest.fn().mockResolvedValue({ current: null, imported: null }),
    },

    attachments: {
      getAll: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(false),
      open: jest.fn().mockResolvedValue(undefined),
    },

    reimbursements: {
      getAll: jest.fn().mockResolvedValue([]),
      getSummary: jest.fn().mockResolvedValue({ status: 'none', originalAmount: 0, totalReimbursed: 0, netAmount: 0, links: [] }),
      linkTransactions: jest.fn().mockResolvedValue(undefined),
      unlinkTransactions: jest.fn().mockResolvedValue(undefined),
    },

    dashboardLayout: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      getWidgets: jest.fn().mockResolvedValue(null),
      setWidgets: jest.fn().mockResolvedValue(undefined),
    },

    safeToSpend: {
      calculate: jest.fn().mockResolvedValue({
        safeAmount: 0,
        totalBalance: 0,
        upcomingBills: 0,
        savingsCommitments: 0,
        budgetRemaining: 0,
        status: 'healthy',
        breakdown: { bills: [], savings: [], budgetItems: [] },
      }),
    },

    ageOfMoney: {
      calculate: jest.fn().mockResolvedValue({
        currentAge: 0,
        previousMonthAge: null,
        trend: 'stable',
        explanation: '',
      }),
    },

    taxLotReport: {
      generate: jest.fn().mockResolvedValue({
        taxYear: new Date().getFullYear(),
        shortTermGains: { totalProceeds: 0, totalCostBasis: 0, totalGain: 0, entries: [] },
        longTermGains: { totalProceeds: 0, totalCostBasis: 0, totalGain: 0, entries: [] },
        totalDividends: 0,
        washSaleFlags: [],
        summary: { netShortTermGain: 0, netLongTermGain: 0, totalDividends: 0 },
      }),
    },

    paycheckAllocations: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getView: jest.fn().mockResolvedValue({
        incomeStream: { id: '', description: '', averageAmount: 0, frequency: '' },
        allocations: [],
        totalAllocated: 0,
        unallocated: 0,
      }),
    },
  }
}

export function setupWindowApi(overrides?: Partial<ReturnType<typeof createMockApi>>) {
  const mockApi = createMockApi()

  Object.assign(mockApi, overrides)

  Object.defineProperty(window, 'api', {
    writable: true,
    configurable: true,
    value: mockApi,
  })

  return mockApi
}

export function cleanupWindowApi() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
}
