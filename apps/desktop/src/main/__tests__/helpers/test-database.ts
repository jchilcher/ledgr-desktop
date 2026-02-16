import { randomUUID } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { BudgetDatabase } from '../../database'
import type {
  Account,
  Transaction,
  Category,
  RecurringItem,
  SavingsGoal,
  ManualAsset,
  ManualLiability,
  InvestmentAccount,
  Holding,
  AccountType,
  RecurringFrequency,
  ManualAssetCategory,
  ManualLiabilityType,
  InvestmentAccountType,
} from '../../../shared/types'

export interface TestDatabaseContext {
  db: BudgetDatabase
  dbPath: string
  cleanup: () => void
}

export function createTestDatabase(name?: string): TestDatabaseContext {
  const dbName = name || `test-${randomUUID()}.db`
  const dbPath = path.join(os.tmpdir(), dbName)

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }

  const db = new BudgetDatabase(dbPath)

  const cleanup = () => {
    try {
      db.close()
    } catch (e) {
      // Ignore close errors
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  }

  return { db, dbPath, cleanup }
}

export function seedAccounts(db: BudgetDatabase, count: number = 3): Account[] {
  const accountTypes: AccountType[] = ['checking', 'savings', 'credit']
  const accounts: Account[] = []

  for (let i = 0; i < count; i++) {
    const type = accountTypes[i % accountTypes.length]
    const account = db.createAccount({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Account ${i + 1}`,
      type,
      institution: `Bank ${i + 1}`,
      balance: (i + 1) * 100000, // $1000, $2000, $3000 in cents
      lastSynced: null,
    })
    accounts.push(account)
  }

  return accounts
}

export function seedTransactions(
  db: BudgetDatabase,
  accountId: string,
  count: number = 10,
  months: number = 3
): Transaction[] {
  const transactions: Transaction[] = []
  const categories = db.getCategories()
  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1)

  for (let i = 0; i < count; i++) {
    const daysOffset = Math.floor((i / count) * months * 30)
    const transactionDate = new Date(startDate)
    transactionDate.setDate(transactionDate.getDate() + daysOffset)

    const isIncome = i % 5 === 0
    const categoryList = isIncome ? incomeCategories : expenseCategories
    const category = categoryList[i % categoryList.length]

    const transaction = db.createTransaction({
      accountId,
      date: transactionDate,
      description: isIncome
        ? `Income Transaction ${i + 1}`
        : `Expense Transaction ${i + 1}`,
      amount: isIncome ? (i + 1) * 10000 : -(i + 1) * 5000,
      categoryId: category?.id || null,
      isRecurring: false,
      importSource: 'file',
    })
    transactions.push(transaction)
  }

  return transactions
}

export function seedCategories(db: BudgetDatabase): Category[] {
  const customCategories: Category[] = []

  customCategories.push(
    db.createCategory({
      name: 'Custom Shopping',
      type: 'expense',
      icon: '🛒',
      color: '#FF5733',
      isDefault: false,
      parentId: null,
    })
  )

  customCategories.push(
    db.createCategory({
      name: 'Freelance Income',
      type: 'income',
      icon: '💼',
      color: '#4CAF50',
      isDefault: false,
      parentId: null,
    })
  )

  customCategories.push(
    db.createCategory({
      name: 'Online Shopping',
      type: 'expense',
      icon: '📦',
      color: '#9C27B0',
      isDefault: false,
      parentId: customCategories[0].id,
    })
  )

  return customCategories
}

export function seedRecurringItems(
  db: BudgetDatabase,
  accountId?: string
): RecurringItem[] {
  const recurringItems: RecurringItem[] = []
  const categories = db.getCategories()
  const rentCategory = categories.find(c => c.name === 'Rent')
  const salaryCategory = categories.find(c => c.name === 'Salary')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  recurringItems.push(
    db.createRecurringItem({
      description: 'Monthly Rent',
      amount: -150000,
      frequency: 'monthly' as RecurringFrequency,
      startDate: startOfMonth,
      nextOccurrence: nextMonth,
      accountId: accountId || null,
      categoryId: rentCategory?.id || null,
      itemType: 'bill',
      enableReminders: true,
      reminderDays: 3,
      autopay: false,
      isActive: true,
      dayOfMonth: 1,
      dayOfWeek: null,
    })
  )

  recurringItems.push(
    db.createRecurringItem({
      description: 'Biweekly Paycheck',
      amount: 250000,
      frequency: 'biweekly' as RecurringFrequency,
      startDate: startOfMonth,
      nextOccurrence: new Date(now.getFullYear(), now.getMonth(), 15),
      accountId: accountId || null,
      categoryId: salaryCategory?.id || null,
      itemType: 'cashflow',
      enableReminders: false,
      reminderDays: null,
      autopay: false,
      isActive: true,
      dayOfMonth: null,
      dayOfWeek: null,
    })
  )

  recurringItems.push(
    db.createRecurringItem({
      description: 'Streaming Subscription',
      amount: -1499,
      frequency: 'monthly' as RecurringFrequency,
      startDate: startOfMonth,
      nextOccurrence: new Date(now.getFullYear(), now.getMonth(), 5),
      accountId: accountId || null,
      categoryId: null,
      itemType: 'subscription',
      enableReminders: true,
      reminderDays: 1,
      autopay: true,
      isActive: true,
      dayOfMonth: 5,
      dayOfWeek: null,
    })
  )

  return recurringItems
}

export function seedSavingsGoals(db: BudgetDatabase, count: number = 2): SavingsGoal[] {
  const savingsGoals: SavingsGoal[] = []
  const now = new Date()

  savingsGoals.push(
    db.createSavingsGoal({
      name: 'Emergency Fund',
      targetAmount: 1000000, // $10,000
      currentAmount: 250000, // $2,500
      targetDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      accountId: null,
      isActive: true,
    })
  )

  if (count > 1) {
    savingsGoals.push(
      db.createSavingsGoal({
        name: 'Vacation',
        targetAmount: 500000, // $5,000
        currentAmount: 100000, // $1,000
        targetDate: new Date(now.getFullYear(), 11, 31), // End of year
        accountId: null,
        isActive: true,
      })
    )
  }

  for (let i = 2; i < count; i++) {
    savingsGoals.push(
      db.createSavingsGoal({
        name: `Goal ${i + 1}`,
        targetAmount: (i + 1) * 100000,
        currentAmount: (i + 1) * 20000,
        targetDate: null,
        accountId: null,
        isActive: true,
      })
    )
  }

  return savingsGoals
}

export function seedManualAssets(db: BudgetDatabase, count: number = 2): ManualAsset[] {
  const assets: ManualAsset[] = []
  const categories: ManualAssetCategory[] = ['property', 'vehicle', 'valuables', 'other']

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length]
    assets.push(
      db.createManualAsset({
        name: `${category.charAt(0).toUpperCase() + category.slice(1)} Asset ${i + 1}`,
        category,
        value: (i + 1) * 1000000, // $10k, $20k, etc. in cents
        liquidity: i % 2 === 0 ? 'liquid' : 'illiquid',
        notes: `Notes for asset ${i + 1}`,
      })
    )
  }

  return assets
}

export function seedManualLiabilities(
  db: BudgetDatabase,
  count: number = 2
): ManualLiability[] {
  const liabilities: ManualLiability[] = []
  const types: ManualLiabilityType[] = [
    'mortgage',
    'auto_loan',
    'student_loan',
    'credit_card',
  ]

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length]
    liabilities.push(
      db.createManualLiability({
        name: `${type.replace('_', ' ').toUpperCase()} ${i + 1}`,
        type,
        balance: (i + 1) * 500000, // $5k, $10k, etc. in cents
        interestRate: 0.05 + i * 0.01, // 5%, 6%, 7%, etc.
        monthlyPayment: (i + 1) * 10000, // $100, $200, etc. in cents
      })
    )
  }

  return liabilities
}

export function seedInvestmentAccounts(
  db: BudgetDatabase,
  count: number = 2
): { accounts: InvestmentAccount[]; holdings: Holding[] } {
  const accounts: InvestmentAccount[] = []
  const allHoldings: Holding[] = []
  const accountTypes: InvestmentAccountType[] = [
    'taxable',
    'traditional_ira',
    'roth_ira',
    '401k',
  ]

  for (let i = 0; i < count; i++) {
    const accountType = accountTypes[i % accountTypes.length]
    const account = db.createInvestmentAccount({
      name: `${accountType.replace('_', ' ').toUpperCase()} Account ${i + 1}`,
      institution: `Brokerage ${i + 1}`,
      accountType,
    })
    accounts.push(account)

    const holdings = seedHoldings(db, account.id, 2)
    allHoldings.push(...holdings)
  }

  return { accounts, holdings: allHoldings }
}

export function seedHoldings(
  db: BudgetDatabase,
  accountId: string,
  count: number = 3
): Holding[] {
  const holdings: Holding[] = []
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA']
  const sectors = ['Technology', 'Consumer', 'Industrial']

  for (let i = 0; i < count; i++) {
    const ticker = tickers[i % tickers.length]
    const sector = sectors[i % sectors.length]

    holdings.push(
      db.createHolding({
        accountId,
        ticker,
        name: `${ticker} Inc.`,
        sharesOwned: (i + 1) * 100000, // 10 shares, 20 shares, etc. (x10000 precision)
        avgCostPerShare: (i + 1) * 10000, // $100, $200, etc. per share in cents
        currentPrice: (i + 1) * 12000, // $120, $240, etc. per share in cents
        sector,
      })
    )
  }

  return holdings
}
