import { detectRecurringPayments } from '../recurring-detection-engine'
import { createTestDatabase } from './helpers/test-database'
import type { BudgetDatabase } from '../database'

// Helper: create a date N months ago from now (on given day)
function monthsAgo(n: number, day: number = 15): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(day)
  d.setHours(12, 0, 0, 0)
  return d
}

// Helper: create a date N weeks ago from now
function weeksAgo(n: number): Date {
  return new Date(Date.now() - n * 7 * 86400000)
}

describe('Recurring Detection Engine', () => {
  let db: BudgetDatabase
  let accountId: string
  let categoryId: string
  let cleanup: () => void

  beforeEach(() => {
    const context = createTestDatabase()
    db = context.db
    cleanup = context.cleanup
    const account = db.createAccount({
      name: 'Checking',
      type: 'checking',
      balance: 0,
      institution: 'Test Bank',
    })
    accountId = account.id

    const category = db.createCategory({ name: 'Bills', type: 'expense' })
    categoryId = category.id
  })

  afterEach(() => {
    cleanup()
  })

  describe('pattern detection', () => {
    it('should detect monthly payments with same description', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: -5000,
          description: 'Netflix Subscription',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      expect(suggestions.length).toBeGreaterThan(0)
      const netflix = suggestions.find(s => s.description.includes('Netflix'))
      expect(netflix).toBeDefined()
      expect(netflix!.frequency).toBe('monthly')
    })

    it('should detect weekly patterns', () => {
      for (let i = 0; i < 5; i++) {
        db.createTransaction({
          accountId,
          date: weeksAgo(4 - i),
          amount: -1500,
          description: 'Coffee Shop',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const coffee = suggestions.find(s => s.description.includes('Coffee'))
      expect(coffee).toBeDefined()
      expect(coffee!.frequency).toBe('weekly')
    })

    it('should detect biweekly patterns', () => {
      for (let i = 0; i < 4; i++) {
        const date = new Date(Date.now() - (3 - i) * 14 * 86400000)
        db.createTransaction({
          accountId,
          date,
          amount: 250000,
          description: 'Paycheck',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const paycheck = suggestions.find(s => s.description.includes('Paycheck'))
      expect(paycheck).toBeDefined()
      expect(paycheck!.frequency).toBe('biweekly')
    })

    it('should detect quarterly patterns', () => {
      for (let i = 0; i < 3; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo((2 - i) * 3, 1),
          amount: -15000,
          description: 'Insurance Premium',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const insurance = suggestions.find(s => s.description.includes('Insurance'))
      expect(insurance).toBeDefined()
      expect(insurance!.frequency).toBe('quarterly')
    })

    it('should detect yearly patterns', () => {
      const now = new Date()
      for (let i = 0; i < 3; i++) {
        const date = new Date(now.getFullYear() - (2 - i), now.getMonth(), 1)
        db.createTransaction({
          accountId,
          date,
          amount: -50000,
          description: 'Annual Membership',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const membership = suggestions.find(s => s.description.includes('Membership'))
      expect(membership).toBeDefined()
      expect(membership!.frequency).toBe('yearly')
    })
  })

  describe('confidence scoring', () => {
    it('should score consistent intervals higher', () => {
      for (let i = 0; i < 6; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(5 - i),
          amount: -5000,
          description: 'Regular Bill',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const bill = suggestions.find(s => s.description.includes('Regular'))
      expect(bill).toBeDefined()
      expect(bill!.confidence).toBeGreaterThan(60)
    })

    it('should score variable amounts lower', () => {
      const amounts = [-5000, -5100, -4900, -5200]
      for (let i = 0; i < amounts.length; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: amounts[i],
          description: 'Variable Bill',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const bill = suggestions.find(s => s.description.includes('Variable'))
      expect(bill).toBeDefined()
      expect(bill!.confidenceFactors.amountVariance).toBeLessThan(100)
    })
  })

  describe('filtering', () => {
    it('should exclude already-tracked recurring items', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: -5000,
          description: 'Netflix',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions, ['Netflix'])

      const netflix = suggestions.find(s => s.normalizedDescription.includes('netflix'))
      expect(netflix).toBeUndefined()
    })

    it('should exclude tracked bill names', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: -5000,
          description: 'Electric Bill',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions, [], ['Electric Bill'])

      const electric = suggestions.find(s => s.normalizedDescription.includes('electric'))
      expect(electric).toBeUndefined()
    })
  })

  describe('minimum occurrences', () => {
    it('should require enough data points', () => {
      for (let i = 0; i < 2; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(1 - i),
          amount: -5000,
          description: 'Rare Transaction',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions, [], [], 3)

      const rare = suggestions.find(s => s.description.includes('Rare'))
      expect(rare).toBeUndefined()
    })
  })

  describe('description normalization', () => {
    it('should group similar descriptions together', () => {
      // Descriptions that differ only by trailing numbers/IDs should be grouped
      const descriptions = [
        'Netflix #12345',
        'Netflix #67890',
        'NETFLIX 98765',
        'Netflix #11111',
      ]

      for (let i = 0; i < descriptions.length; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: -5000,
          description: descriptions[i],
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const netflix = suggestions.filter(s => s.normalizedDescription.includes('netflix'))
      expect(netflix.length).toBeGreaterThan(0)
      const totalOccurrences = netflix.reduce((sum, s) => sum + s.occurrences, 0)
      expect(totalOccurrences).toBe(4)
    })
  })

  describe('edge cases', () => {
    it('should not detect single transaction', () => {
      db.createTransaction({
        accountId,
        date: monthsAgo(0),
        amount: -5000,
        description: 'One Time Purchase',
        categoryId,
        importSource: 'file',
        isRecurring: false,
      })

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const oneTime = suggestions.find(s => s.description.includes('One Time'))
      expect(oneTime).toBeUndefined()
    })

    it('should still detect with varied amounts if interval consistent', () => {
      const amounts = [-5000, -5500, -4800, -5200]
      for (let i = 0; i < amounts.length; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: amounts[i],
          description: 'Utility Bill',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const utility = suggestions.find(s => s.description.includes('Utility'))
      expect(utility).toBeDefined()
      expect(utility!.frequency).toBe('monthly')
    })

    it('should handle zero amounts gracefully', () => {
      db.createTransaction({
        accountId,
        date: monthsAgo(0),
        amount: 0,
        description: 'Zero Transaction',
        categoryId,
        importSource: 'file',
        isRecurring: false,
      })

      const transactions = db.getTransactions()

      expect(() => detectRecurringPayments(transactions)).not.toThrow()
    })

    it('should separate income from expenses', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: 250000,
          description: 'Salary',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i, 1),
          amount: -5000,
          description: 'Rent',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const salary = suggestions.find(s => s.description.includes('Salary'))
      const rent = suggestions.find(s => s.description.includes('Rent'))

      expect(salary).toBeDefined()
      expect(salary!.type).toBe('income')
      expect(rent).toBeDefined()
      expect(rent!.type).toBe('expense')
    })

    it('should suggest reminders for fixed expenses', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: -5000,
          description: 'Fixed Bill',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const bill = suggestions.find(s => s.description.includes('Fixed'))
      expect(bill).toBeDefined()
      expect(bill!.suggestReminders).toBe(true)
    })

    it('should not suggest reminders for income', () => {
      for (let i = 0; i < 4; i++) {
        db.createTransaction({
          accountId,
          date: monthsAgo(3 - i),
          amount: 250000,
          description: 'Income',
          categoryId,
          importSource: 'file',
          isRecurring: false,
        })
      }

      const transactions = db.getTransactions()
      const suggestions = detectRecurringPayments(transactions)

      const income = suggestions.find(s => s.description.includes('Income'))
      expect(income).toBeDefined()
      expect(income!.suggestReminders).toBe(false)
    })
  })
})
