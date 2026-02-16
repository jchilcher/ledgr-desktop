import { randomUUID } from 'crypto'
import type {
  Account,
  Transaction,
  Category,
  RecurringItem,
  SavingsGoal,
  ManualAsset,
  ManualLiability,
  Holding,
  CostBasisLot,
  InvestmentAccount,
  AccountType,
  TransactionType,
  ImportSource,
  RecurringFrequency,
  RecurringItemType,
  ManualAssetCategory,
  AssetLiquidity,
  ManualLiabilityType,
  InvestmentAccountType,
} from '../../../shared/types'

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: randomUUID(),
    name: 'Test Checking Account',
    type: 'checking' as AccountType,
    institution: 'Test Bank',
    balance: 500000,
    lastSynced: null,
    createdAt: new Date(),
    ofxUrl: null,
    ofxOrg: null,
    ofxFid: null,
    ofxUsername: null,
    ofxAccountId: null,
    ownership: 'mine',
    ownerId: null,
    isEncrypted: false,
    ...overrides,
  }
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: randomUUID(),
    accountId: randomUUID(),
    date: new Date(),
    description: 'Test Transaction',
    amount: -5000,
    categoryId: null,
    isRecurring: false,
    importSource: 'file' as ImportSource,
    createdAt: new Date(),
    fitId: null,
    isInternalTransfer: false,
    notes: null,
    isHidden: false,
    ...overrides,
  }
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: randomUUID(),
    name: 'Test Category',
    type: 'expense' as TransactionType,
    icon: '🏷️',
    color: '#3498db',
    isDefault: false,
    parentId: null,
    ...overrides,
  }
}

export function makeRecurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    id: randomUUID(),
    description: 'Test Recurring Item',
    amount: -10000,
    frequency: 'monthly' as RecurringFrequency,
    startDate: now,
    nextOccurrence: nextMonth,
    accountId: null,
    endDate: null,
    categoryId: null,
    dayOfMonth: 1,
    dayOfWeek: null,
    itemType: 'bill' as RecurringItemType,
    enableReminders: true,
    reminderDays: 3,
    autopay: false,
    isActive: true,
    ownerId: null,
    isEncrypted: false,
    createdAt: now,
    ...overrides,
  }
}

export function makeSavingsGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  const now = new Date()
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  return {
    id: randomUUID(),
    name: 'Test Savings Goal',
    targetAmount: 1000000,
    currentAmount: 250000,
    targetDate: nextYear,
    accountId: null,
    icon: '🎯',
    color: '#2ecc71',
    isActive: true,
    ownerId: null,
    isEncrypted: false,
    createdAt: now,
    ...overrides,
  }
}

export function makeManualAsset(overrides: Partial<ManualAsset> = {}): ManualAsset {
  const now = new Date()

  return {
    id: randomUUID(),
    name: 'Test Asset',
    category: 'property' as ManualAssetCategory,
    customCategory: null,
    value: 5000000,
    liquidity: 'illiquid' as AssetLiquidity,
    notes: 'Test asset notes',
    reminderFrequency: null,
    lastReminderDate: null,
    nextReminderDate: null,
    ownerId: null,
    isEncrypted: false,
    lastUpdated: now,
    createdAt: now,
    ...overrides,
  }
}

export function makeManualLiability(
  overrides: Partial<ManualLiability> = {}
): ManualLiability {
  const now = new Date()

  return {
    id: randomUUID(),
    name: 'Test Liability',
    type: 'mortgage' as ManualLiabilityType,
    balance: 30000000,
    interestRate: 0.045,
    monthlyPayment: 150000,
    originalAmount: 35000000,
    startDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    termMonths: 360,
    payoffDate: new Date(now.getFullYear() + 29, now.getMonth(), now.getDate()),
    totalInterest: null,
    ownerId: null,
    isEncrypted: false,
    lastUpdated: now,
    notes: 'Test liability notes',
    createdAt: now,
    ...overrides,
  }
}

export function makeHolding(overrides: Partial<Holding> = {}): Holding {
  const now = new Date()

  return {
    id: randomUUID(),
    accountId: randomUUID(),
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sharesOwned: 100000,
    avgCostPerShare: 15000,
    currentPrice: 18000,
    sector: 'Technology',
    lastPriceUpdate: now,
    createdAt: now,
    ...overrides,
  }
}

export function makeCostBasisLot(overrides: Partial<CostBasisLot> = {}): CostBasisLot {
  const now = new Date()
  const purchaseDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)

  return {
    id: randomUUID(),
    holdingId: randomUUID(),
    purchaseDate,
    shares: 100000,
    costPerShare: 15000,
    remainingShares: 100000,
    createdAt: now,
    ...overrides,
  }
}

export function makeInvestmentAccount(
  overrides: Partial<InvestmentAccount> = {}
): InvestmentAccount {
  const now = new Date()

  return {
    id: randomUUID(),
    name: 'Test Brokerage',
    institution: 'Test Brokerage Inc.',
    accountType: 'taxable' as InvestmentAccountType,
    ownerId: null,
    isEncrypted: false,
    createdAt: now,
    ...overrides,
  }
}

export function generateTransactionHistory(
  accountId: string,
  months: number = 6,
  txPerMonth: number = 20
): Transaction[] {
  const transactions: Transaction[] = []
  const now = new Date()

  const patterns = [
    { description: 'Netflix Subscription', amount: -1499, dayOfMonth: 5 },
    { description: 'Spotify Premium', amount: -999, dayOfMonth: 10 },
    { description: 'Groceries - Whole Foods', amount: -8500, weekly: true },
    { description: 'Coffee Shop', amount: -450, frequency: 3 },
    { description: 'Monthly Salary', amount: 500000, dayOfMonth: 1 },
    { description: 'Rent Payment', amount: -180000, dayOfMonth: 1 },
  ]

  for (let month = 0; month < months; month++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - month, 1)

    for (const pattern of patterns) {
      if (pattern.weekly) {
        for (let week = 0; week < 4; week++) {
          transactions.push(
            makeTransaction({
              accountId,
              date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 7 + week * 7),
              description: pattern.description,
              amount: pattern.amount + Math.floor(Math.random() * 1000),
              isRecurring: true,
            })
          )
        }
      } else if (pattern.dayOfMonth) {
        transactions.push(
          makeTransaction({
            accountId,
            date: new Date(monthDate.getFullYear(), monthDate.getMonth(), pattern.dayOfMonth),
            description: pattern.description,
            amount: pattern.amount,
            isRecurring: true,
          })
        )
      } else if (pattern.frequency) {
        for (let i = 0; i < pattern.frequency; i++) {
          const day = Math.floor(Math.random() * 28) + 1
          transactions.push(
            makeTransaction({
              accountId,
              date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
              description: pattern.description,
              amount: pattern.amount + Math.floor(Math.random() * 200),
              isRecurring: false,
            })
          )
        }
      }
    }

    const randomTransactions = txPerMonth - transactions.filter(
      t => t.date.getMonth() === monthDate.getMonth() && t.date.getFullYear() === monthDate.getFullYear()
    ).length

    for (let i = 0; i < randomTransactions; i++) {
      const day = Math.floor(Math.random() * 28) + 1
      const isExpense = Math.random() > 0.3
      transactions.push(
        makeTransaction({
          accountId,
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
          description: `Random ${isExpense ? 'Expense' : 'Income'} ${i + 1}`,
          amount: isExpense
            ? -(Math.floor(Math.random() * 10000) + 1000)
            : Math.floor(Math.random() * 50000) + 5000,
          isRecurring: false,
        })
      )
    }
  }

  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
}
