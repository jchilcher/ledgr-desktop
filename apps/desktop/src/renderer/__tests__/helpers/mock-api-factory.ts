import type {
  Account,
  Transaction,
  Category,
  RecurringItem,
  SavingsGoal,
  InvestmentAccount,
  Holding,
  NetWorthSnapshot,
  User,
} from '../../../shared/types'

export function mockAccountsApi(accounts?: Account[]) {
  const defaultAccounts: Account[] = accounts || [
    {
      id: '1',
      name: 'Checking Account',
      type: 'checking',
      institution: 'Test Bank',
      balance: 500000,
      lastSynced: null,
      createdAt: new Date('2025-01-01'),
      ownership: 'mine',
      ownerId: null,
      isEncrypted: false,
    },
    {
      id: '2',
      name: 'Savings Account',
      type: 'savings',
      institution: 'Test Bank',
      balance: 1000000,
      lastSynced: null,
      createdAt: new Date('2025-01-01'),
      ownership: 'mine',
      ownerId: null,
      isEncrypted: false,
    },
  ]

  return {
    getAll: jest.fn().mockResolvedValue(defaultAccounts),
    getById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(defaultAccounts.find(a => a.id === id) || null)
    ),
    create: jest.fn().mockImplementation((account: Omit<Account, 'id' | 'createdAt'>) =>
      Promise.resolve({
        ...account,
        id: '3',
        createdAt: new Date(),
      })
    ),
    update: jest.fn().mockImplementation((id: string, updates: Partial<Account>) =>
      Promise.resolve({
        ...defaultAccounts.find(a => a.id === id),
        ...updates,
      })
    ),
    delete: jest.fn().mockResolvedValue(true),
    getDefault: jest.fn().mockResolvedValue(defaultAccounts[0]?.id || '1'),
    setDefault: jest.fn().mockResolvedValue(true),
  }
}

export function mockTransactionsApi(transactions?: Transaction[]) {
  const defaultTransactions: Transaction[] = transactions || [
    {
      id: '1',
      accountId: '1',
      date: new Date('2025-01-15'),
      description: 'Grocery Store',
      amount: -8500,
      categoryId: null,
      isRecurring: false,
      importSource: 'file',
      createdAt: new Date('2025-01-15'),
      fitId: null,
      isInternalTransfer: false,
      notes: null,
      isHidden: false,
    },
    {
      id: '2',
      accountId: '1',
      date: new Date('2025-01-01'),
      description: 'Salary',
      amount: 500000,
      categoryId: null,
      isRecurring: true,
      importSource: 'file',
      createdAt: new Date('2025-01-01'),
      fitId: null,
      isInternalTransfer: false,
      notes: null,
      isHidden: false,
    },
  ]

  return {
    getAll: jest.fn().mockResolvedValue(defaultTransactions),
    getByAccount: jest.fn().mockImplementation((accountId: string) =>
      Promise.resolve(defaultTransactions.filter(t => t.accountId === accountId))
    ),
    create: jest.fn().mockImplementation((tx: Omit<Transaction, 'id' | 'createdAt'>) =>
      Promise.resolve({
        ...tx,
        id: '3',
        createdAt: new Date(),
      })
    ),
    update: jest.fn().mockImplementation((id: string, updates: Partial<Transaction>) =>
      Promise.resolve({
        ...defaultTransactions.find(t => t.id === id),
        ...updates,
      })
    ),
    delete: jest.fn().mockResolvedValue(true),
    bulkUpdateCategory: jest.fn().mockResolvedValue({ updated: 5, ruleCreated: true }),
    countByPattern: jest.fn().mockResolvedValue(10),
    samplesByPattern: jest.fn().mockResolvedValue(defaultTransactions.slice(0, 5)),
    bulkDelete: jest.fn().mockResolvedValue(5),
    bulkUpdateCategoryByIds: jest.fn().mockResolvedValue(5),
  }
}

export function mockCategoriesApi(categories?: Category[]) {
  const defaultCategories: Category[] = categories || [
    {
      id: '1',
      name: 'Groceries',
      type: 'expense',
      icon: '🛒',
      color: '#3498db',
      isDefault: true,
      parentId: null,
    },
    {
      id: '2',
      name: 'Salary',
      type: 'income',
      icon: '💰',
      color: '#2ecc71',
      isDefault: true,
      parentId: null,
    },
    {
      id: '3',
      name: 'Rent',
      type: 'expense',
      icon: '🏠',
      color: '#e74c3c',
      isDefault: true,
      parentId: null,
    },
  ]

  return {
    getAll: jest.fn().mockResolvedValue(defaultCategories),
    getById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(defaultCategories.find(c => c.id === id) || null)
    ),
    create: jest.fn().mockImplementation((category: Omit<Category, 'id'>) =>
      Promise.resolve({
        ...category,
        id: '4',
      })
    ),
    update: jest.fn().mockImplementation((id: string, updates: Partial<Category>) =>
      Promise.resolve({
        ...defaultCategories.find(c => c.id === id),
        ...updates,
      })
    ),
    delete: jest.fn().mockResolvedValue(true),
    addMissingDefaults: jest.fn().mockResolvedValue({ added: [] }),
  }
}

export function mockRecurringApi(items?: RecurringItem[]) {
  const defaultItems: RecurringItem[] = items || [
    {
      id: '1',
      description: 'Netflix Subscription',
      amount: -1499,
      frequency: 'monthly',
      startDate: new Date('2025-01-01'),
      nextOccurrence: new Date('2025-02-01'),
      accountId: '1',
      endDate: null,
      categoryId: null,
      dayOfMonth: 1,
      dayOfWeek: null,
      itemType: 'subscription',
      enableReminders: true,
      reminderDays: 3,
      autopay: true,
      isActive: true,
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      description: 'Rent',
      amount: -180000,
      frequency: 'monthly',
      startDate: new Date('2025-01-01'),
      nextOccurrence: new Date('2025-02-01'),
      accountId: '1',
      endDate: null,
      categoryId: '3',
      dayOfMonth: 1,
      dayOfWeek: null,
      itemType: 'bill',
      enableReminders: true,
      reminderDays: 5,
      autopay: false,
      isActive: true,
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
  ]

  return {
    getAll: jest.fn().mockResolvedValue(defaultItems),
    getActive: jest.fn().mockResolvedValue(defaultItems.filter(i => i.isActive)),
    getById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(defaultItems.find(i => i.id === id) || null)
    ),
    getByAccount: jest.fn().mockImplementation((accountId: string) =>
      Promise.resolve(defaultItems.filter(i => i.accountId === accountId))
    ),
    create: jest.fn().mockImplementation((item: Omit<RecurringItem, 'id' | 'createdAt'>) =>
      Promise.resolve({
        ...item,
        id: '3',
        createdAt: new Date(),
      })
    ),
    update: jest.fn().mockImplementation((id: string, updates: Partial<RecurringItem>) =>
      Promise.resolve({
        ...defaultItems.find(i => i.id === id),
        ...updates,
      })
    ),
    delete: jest.fn().mockResolvedValue(true),
    migrate: jest.fn().mockResolvedValue(defaultItems),
  }
}

export function mockSavingsApi(goals?: SavingsGoal[]) {
  const defaultGoals: SavingsGoal[] = goals || [
    {
      id: '1',
      name: 'Emergency Fund',
      targetAmount: 1000000,
      currentAmount: 250000,
      targetDate: new Date('2026-12-31'),
      accountId: '2',
      icon: '🏦',
      color: '#f39c12',
      isActive: true,
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      name: 'Vacation',
      targetAmount: 500000,
      currentAmount: 100000,
      targetDate: new Date('2025-12-31'),
      accountId: '2',
      icon: '✈️',
      color: '#9b59b6',
      isActive: true,
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
  ]

  return {
    getAll: jest.fn().mockResolvedValue(defaultGoals),
    getActive: jest.fn().mockResolvedValue(defaultGoals.filter(g => g.isActive)),
    getById: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(defaultGoals.find(g => g.id === id) || null)
    ),
    create: jest.fn().mockImplementation((goal: Omit<SavingsGoal, 'id' | 'createdAt'>) =>
      Promise.resolve({
        ...goal,
        id: '3',
        createdAt: new Date(),
      })
    ),
    update: jest.fn().mockImplementation((id: string, updates: Partial<SavingsGoal>) =>
      Promise.resolve({
        ...defaultGoals.find(g => g.id === id),
        ...updates,
      })
    ),
    delete: jest.fn().mockResolvedValue(true),
  }
}

export function mockInvestmentsApi(accounts?: InvestmentAccount[], holdings?: Holding[]) {
  const defaultAccounts: InvestmentAccount[] = accounts || [
    {
      id: '1',
      name: 'Roth IRA',
      institution: 'Vanguard',
      accountType: 'roth_ira',
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      name: 'Taxable Brokerage',
      institution: 'Fidelity',
      accountType: 'taxable',
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
  ]

  const defaultHoldings: Holding[] = holdings || [
    {
      id: '1',
      accountId: '1',
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      sharesOwned: 100000,
      avgCostPerShare: 20000,
      currentPrice: 22000,
      sector: 'Diversified',
      lastPriceUpdate: new Date(),
      createdAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      accountId: '2',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sharesOwned: 50000,
      avgCostPerShare: 15000,
      currentPrice: 18000,
      sector: 'Technology',
      lastPriceUpdate: new Date(),
      createdAt: new Date('2025-01-01'),
    },
  ]

  return {
    accounts: {
      getAll: jest.fn().mockResolvedValue(defaultAccounts),
      getById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(defaultAccounts.find(a => a.id === id) || null)
      ),
      create: jest.fn().mockImplementation((account: Omit<InvestmentAccount, 'id' | 'createdAt'>) =>
        Promise.resolve({
          ...account,
          id: '3',
          createdAt: new Date(),
        })
      ),
      update: jest.fn().mockResolvedValue(defaultAccounts[0]),
      delete: jest.fn().mockResolvedValue(true),
    },
    holdings: {
      getAll: jest.fn().mockResolvedValue(defaultHoldings),
      getByAccount: jest.fn().mockImplementation((accountId: string) =>
        Promise.resolve(defaultHoldings.filter(h => h.accountId === accountId))
      ),
      getById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(defaultHoldings.find(h => h.id === id) || null)
      ),
      create: jest.fn().mockImplementation((holding: Omit<Holding, 'id' | 'createdAt'>) =>
        Promise.resolve({
          ...holding,
          id: '3',
          createdAt: new Date(),
        })
      ),
      update: jest.fn().mockResolvedValue(defaultHoldings[0]),
      delete: jest.fn().mockResolvedValue(true),
    },
  }
}

export function mockNetWorthApi(snapshots?: NetWorthSnapshot[]) {
  const defaultSnapshots: NetWorthSnapshot[] = snapshots || [
    {
      id: '1',
      date: new Date('2025-01-31'),
      bankAccountsTotal: 1500000,
      investmentAccountsTotal: 5000000,
      manualAssetsTotal: 30000000,
      totalAssets: 36500000,
      manualLiabilitiesTotal: 25000000,
      totalLiabilities: 25000000,
      netWorth: 11500000,
      assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
      liabilityBreakdown: JSON.stringify({ liabilities: [] }),
      changeFromPrevious: null,
      changePercentFromPrevious: null,
      createdAt: new Date('2025-01-31'),
    },
  ]

  return {
    calculate: jest.fn().mockResolvedValue({
      totalAssets: 36500000,
      totalLiabilities: 25000000,
      netWorth: 11500000,
      bankAccounts: { total: 1500000, accounts: [] },
      investments: { total: 5000000, accounts: [] },
      manualAssets: { total: 30000000, assets: [] },
      manualLiabilities: { total: 25000000, liabilities: [] },
    }),
    getSnapshots: jest.fn().mockResolvedValue(defaultSnapshots),
    createSnapshot: jest.fn().mockImplementation(() =>
      Promise.resolve(defaultSnapshots[0])
    ),
    deleteSnapshot: jest.fn().mockResolvedValue(true),
  }
}

export function mockSecurityApi() {
  const defaultUsers: User[] = [
    {
      id: '1',
      name: 'Default User',
      color: '#3498db',
      isDefault: true,
      createdAt: new Date('2025-01-01'),
    },
  ]

  return {
    getUserAuthStatus: jest.fn().mockResolvedValue(
      defaultUsers.map(u => ({
        userId: u.id,
        name: u.name,
        color: u.color,
        hasPassword: false,
      }))
    ),
    checkPassword: jest.fn().mockResolvedValue(true),
    enableMemberPassword: jest.fn().mockResolvedValue(undefined),
    updateMemberPassword: jest.fn().mockResolvedValue(undefined),
    removeMemberPassword: jest.fn().mockResolvedValue(undefined),
    unlockMember: jest.fn().mockResolvedValue({ success: true }),
    lockMember: jest.fn().mockResolvedValue(undefined),
  }
}

export function mockSharingApi() {
  return {
    getSharedWithMe: jest.fn().mockResolvedValue([]),
    getMyShares: jest.fn().mockResolvedValue([]),
    createShare: jest.fn().mockResolvedValue(undefined),
    updateShare: jest.fn().mockResolvedValue(undefined),
    deleteShare: jest.fn().mockResolvedValue(undefined),
    getDefaults: jest.fn().mockResolvedValue([]),
    setDefault: jest.fn().mockResolvedValue(undefined),
    deleteDefault: jest.fn().mockResolvedValue(undefined),
  }
}

export function mockAnalyticsApi() {
  return {
    getSpendingByCategory: jest.fn().mockResolvedValue([
      { categoryId: '1', categoryName: 'Groceries', total: 50000, count: 10, color: '#3498db' },
      { categoryId: '3', categoryName: 'Rent', total: 180000, count: 1, color: '#e74c3c' },
    ]),
    getIncomeVsExpensesOverTime: jest.fn().mockResolvedValue([
      { period: '2025-01', income: 500000, expenses: 230000, net: 270000 },
      { period: '2025-02', income: 500000, expenses: 250000, net: 250000 },
    ]),
    getCategoryTrendsOverTime: jest.fn().mockResolvedValue([]),
    getCategoryTrendsSelectedCategories: jest.fn().mockResolvedValue(''),
    setCategoryTrendsSelectedCategories: jest.fn().mockResolvedValue(undefined),
  }
}

export function mockForecastApi() {
  return {
    spending: jest.fn().mockResolvedValue({
      period: 30,
      projectedSpending: 250000,
      confidence: 85,
      historicalAverage: 240000,
      trend: 'increasing',
      confidenceInterval: { lower: 230000, upper: 270000 },
    }),
    multiPeriod: jest.fn().mockResolvedValue([]),
    categorySpending: jest.fn().mockResolvedValue(null),
    allCategories: jest.fn().mockResolvedValue([]),
    categoryLongTerm: jest.fn().mockResolvedValue(null),
    allCategoriesLongTerm: jest.fn().mockResolvedValue([]),
    selectGranularity: jest.fn().mockResolvedValue('monthly'),
  }
}

export const mockTransactions = [
  {
    id: '1',
    accountId: '1',
    date: new Date('2025-01-15'),
    description: 'Grocery Store',
    amount: -8500,
    categoryId: '1',
    isRecurring: false,
    importSource: 'file',
    createdAt: new Date('2025-01-15'),
    fitId: null,
    isInternalTransfer: false,
    notes: null,
    isHidden: false,
  },
]

export const mockCategories = [
  {
    id: '1',
    name: 'Groceries',
    type: 'expense' as const,
    icon: '🛒',
    color: '#3498db',
    isDefault: true,
    parentId: null,
  },
  {
    id: '2',
    name: 'Salary',
    type: 'income' as const,
    icon: '💰',
    color: '#2ecc71',
    isDefault: true,
    parentId: null,
  },
]

export const mockAccounts = [
  {
    id: 'acc1',
    name: 'Checking Account',
    type: 'checking' as const,
    institution: 'Test Bank',
    balance: 500000,
    lastSynced: null,
    createdAt: new Date('2025-01-01'),
    ownership: 'mine' as const,
    ownerId: null,
    isEncrypted: false,
  },
]

export const mockInvestmentHoldings = [
  {
    id: '1',
    accountId: '1',
    ticker: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    sharesOwned: 100000,
    avgCostPerShare: 20000,
    currentPrice: 22000,
    sector: 'Diversified',
    lastPriceUpdate: new Date(),
    createdAt: new Date('2025-01-01'),
  },
]
