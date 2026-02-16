import { createTestDatabase, type TestDatabaseContext, seedRecurringItems } from './helpers/test-database'
import { setupEncryptionForUser, encryptAndStore } from './helpers/test-encryption'
import { makeAccount, makeTransaction, makeRecurringItem } from './helpers/mock-data'
import { IPCHandlers } from '../ipc-handlers'
import { ipcMain } from 'electron'
import { encryptEntityFields, getDecryptionDEK } from '../encryption-middleware'

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
  app: {
    getPath: jest.fn(() => '/tmp'),
    getVersion: jest.fn(() => '1.0.0'),
  },
  shell: {
    openExternal: jest.fn(),
  },
}))

describe('IPC Handlers - Analytics', () => {
  let ctx: TestDatabaseContext
  let ipcHandlers: IPCHandlers
  let getHandler: (channel: string) => ((...args: unknown[]) => unknown) | undefined
  const mockEvent = { senderFrame: { url: 'file:///test' } } as unknown as Electron.IpcMainInvokeEvent

  beforeEach(() => {
    ctx = createTestDatabase()
    ipcHandlers = new IPCHandlers(ctx.db)

    const mockHandle = ipcMain.handle as jest.Mock
    getHandler = (channel: string) => {
      const call = mockHandle.mock.calls.find((call) => call[0] === channel)
      return call ? call[1] : undefined
    }
  })

  afterEach(() => {
    ipcHandlers.removeHandlers()
    ctx.cleanup()
    jest.clearAllMocks()
  })

  describe('analytics:getSpendingByCategory', () => {
    it('should compute spending from unencrypted transactions', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const foodCategory = ctx.db.createCategory({ name: 'Food', type: 'expense', icon: '🍔', color: '#FF5733', isDefault: false, parentId: null })

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: foodCategory.id, amount: -5000 }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: foodCategory.id, amount: -3000 }))

      const handler = getHandler('analytics:getSpendingByCategory')
      const result = await handler!(mockEvent)

      const foodSpending = result.find((r: { categoryId: string }) => r.categoryId === foodCategory.id)
      expect(foodSpending).toBeTruthy()
      expect(foodSpending.total).toBe(8000)
      expect(foodSpending.count).toBe(2)
    })

    it('should compute spending from decrypted amounts not SQL SUM on ciphertext', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const foodCategory = ctx.db.createCategory({ name: 'Food', type: 'expense', icon: '🍔', color: '#FF5733', isDefault: false, parentId: null })

      const tx1 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: foodCategory.id, amount: -5000 }))
      const tx2 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: foodCategory.id, amount: -3000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const enc1 = encryptEntityFields('transaction', { amount: -5000 }, dek!)
      const enc2 = encryptEntityFields('transaction', { amount: -3000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc1.amount, tx1.id)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc2.amount, tx2.id)

      const handler = getHandler('analytics:getSpendingByCategory')
      const result = await handler!(mockEvent)

      const foodSpending = result.find((r: { categoryId: string }) => r.categoryId === foodCategory.id)
      expect(foodSpending).toBeTruthy()
      expect(foodSpending.total).toBe(8000)
      expect(foodSpending.count).toBe(2)
    })

    it('should filter by date range', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const category = ctx.db.createCategory({ name: 'Shopping', type: 'expense', icon: '🛒', color: '#3498DB', isDefault: false, parentId: null })

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: category.id, amount: -1000, date: new Date('2026-01-01') }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: category.id, amount: -2000, date: new Date('2026-01-15') }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: category.id, amount: -3000, date: new Date('2026-02-01') }))

      const handler = getHandler('analytics:getSpendingByCategory')
      const result = await handler!(mockEvent, '2026-01-01', '2026-01-31')

      const shopping = result.find((r: { categoryId: string }) => r.categoryId === category.id)
      expect(shopping).toBeTruthy()
      expect(shopping.total).toBe(3000)
      expect(shopping.count).toBe(2)
    })

    it('should exclude income transactions', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const salaryCategory = ctx.db.createCategory({ name: 'Salary', type: 'income', icon: '💰', color: '#2ECC71', isDefault: false, parentId: null })

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: salaryCategory.id, amount: 500000 }))

      const handler = getHandler('analytics:getSpendingByCategory')
      const result = await handler!(mockEvent)

      const salaryInResult = result.find((r: { categoryId: string }) => r.categoryId === salaryCategory.id)
      expect(salaryInResult).toBeUndefined()
    })

    it('should exclude internal transfers', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -5000, isInternalTransfer: true }))

      const handler = getHandler('analytics:getSpendingByCategory')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(0)
    })
  })

  describe('analytics:getIncomeVsExpensesOverTime', () => {
    it('should group by month with decrypted amounts', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx1 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: 500000, date: new Date('2026-01-15') }))
      const tx2 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -20000, date: new Date('2026-01-20') }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const enc1 = encryptEntityFields('transaction', { amount: 500000 }, dek!)
      const enc2 = encryptEntityFields('transaction', { amount: -20000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc1.amount, tx1.id)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc2.amount, tx2.id)

      const handler = getHandler('analytics:getIncomeVsExpensesOverTime')
      const result = await handler!(mockEvent, 'month')

      const jan2026 = result.find((r: { period: string }) => r.period === '2026-01')
      expect(jan2026).toBeTruthy()
      expect(jan2026.income).toBe(500000)
      expect(jan2026.expenses).toBe(20000)
      expect(jan2026.net).toBe(480000)
    })

    it('should group by day', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))

      // Use local-time constructors to match formatPeriod which uses getDate()/getMonth()
      const date1 = new Date(2026, 0, 15, 12)
      const date2 = new Date(2026, 0, 16, 12)
      const pad = (n: number) => String(n).padStart(2, '0')
      const period1 = `${date1.getFullYear()}-${pad(date1.getMonth() + 1)}-${pad(date1.getDate())}`
      const period2 = `${date2.getFullYear()}-${pad(date2.getMonth() + 1)}-${pad(date2.getDate())}`

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: 10000, date: date1 }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -3000, date: date1 }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -5000, date: date2 }))

      const handler = getHandler('analytics:getIncomeVsExpensesOverTime')
      const result = await handler!(mockEvent, 'day')

      const day1 = result.find((r: { period: string }) => r.period === period1)
      const day2 = result.find((r: { period: string }) => r.period === period2)

      expect(day1).toBeTruthy()
      expect(day1.income).toBe(10000)
      expect(day1.expenses).toBe(3000)

      expect(day2).toBeTruthy()
      expect(day2.income).toBe(0)
      expect(day2.expenses).toBe(5000)
    })

    it('should group by year', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: 500000, date: new Date('2025-06-01') }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -100000, date: new Date('2025-12-01') }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: 600000, date: new Date('2026-03-01') }))

      const handler = getHandler('analytics:getIncomeVsExpensesOverTime')
      const result = await handler!(mockEvent, 'year')

      const year2025 = result.find((r: { period: string }) => r.period === '2025')
      const year2026 = result.find((r: { period: string }) => r.period === '2026')

      expect(year2025).toBeTruthy()
      expect(year2025.income).toBe(500000)
      expect(year2025.expenses).toBe(100000)

      expect(year2026).toBeTruthy()
      expect(year2026.income).toBe(600000)
      expect(year2026.expenses).toBe(0)
    })

    it('should exclude internal transfers', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -5000, isInternalTransfer: true, date: new Date('2026-01-15') }))

      const handler = getHandler('analytics:getIncomeVsExpensesOverTime')
      const result = await handler!(mockEvent, 'month')

      expect(result.length).toBe(0)
    })
  })

  describe('forecast:spending', () => {
    it('should receive decrypted transaction data', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const now = new Date()
      for (let i = 0; i < 10; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i * 3)
        const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -5000, date }))

        const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
        const enc = encryptEntityFields('transaction', { amount: -5000 }, dek!)
        ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc.amount, tx.id)
      }

      const handler = getHandler('forecast:spending')
      const result = await handler!(mockEvent, 30, 90)

      expect(result).toBeDefined()
      expect(result.projectedSpending).toBeDefined()
    })

    it('should forecast from unencrypted data', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))

      const now = new Date()
      for (let i = 0; i < 10; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i * 3)
        ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -5000, date }))
      }

      const handler = getHandler('forecast:spending')
      const result = await handler!(mockEvent, 30, 90)

      expect(result).toBeDefined()
      expect(result.projectedSpending).toBeGreaterThan(0)
    })
  })

  describe('cashflow:forecast', () => {
    it('should receive decrypted recurring items', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))

      const recurringItem = ctx.db.createRecurringItem(makeRecurringItem({
        description: 'Monthly Bill',
        amount: -15000,
        accountId: account.id,
        ownerId: user.id,
      }))

      const encryptedData = encryptAndStore(ctx.db, 'recurring_item', recurringItem.id, user.id, {
        description: 'Monthly Bill',
        amount: -15000,
      })
      ctx.db.rawDb.prepare('UPDATE recurring_items SET description = ?, amount = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.description, encryptedData.amount, recurringItem.id)

      const handler = getHandler('cashflow:forecast')
      const startDate = new Date().toISOString()
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const result = await handler!(mockEvent, account.id, startDate, endDate)

      expect(result).toBeDefined()
      expect(result.projections).toBeDefined()
    })

    it('should forecast from unencrypted recurring items', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      seedRecurringItems(ctx.db, account.id)

      const handler = getHandler('cashflow:forecast')
      const startDate = new Date().toISOString()
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const result = await handler!(mockEvent, account.id, startDate, endDate)

      expect(result).toBeDefined()
      expect(result.projections.length).toBeGreaterThan(0)
    })
  })

  describe('analytics:getCategoryTrendsOverTime', () => {
    it('should return trends from decrypted amounts', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const category = ctx.db.createCategory({ name: 'Food', type: 'expense', icon: '🍔', color: '#FF5733', isDefault: false, parentId: null })

      const tx1 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: category.id, amount: -5000, date: new Date('2026-01-10') }))
      const tx2 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: category.id, amount: -3000, date: new Date('2026-01-20') }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const enc1 = encryptEntityFields('transaction', { amount: -5000 }, dek!)
      const enc2 = encryptEntityFields('transaction', { amount: -3000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc1.amount, tx1.id)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc2.amount, tx2.id)

      const handler = getHandler('analytics:getCategoryTrendsOverTime')
      const result = await handler!(mockEvent, [category.id], 'month')

      const jan = result.find((r: { period: string }) => r.period === '2026-01')
      expect(jan).toBeTruthy()
      expect(jan.total).toBe(8000)
      expect(jan.count).toBe(2)
    })

    it('should filter by category IDs', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const cat1 = ctx.db.createCategory({ name: 'Food', type: 'expense', icon: '🍔', color: '#FF5733', isDefault: false, parentId: null })
      const cat2 = ctx.db.createCategory({ name: 'Transport', type: 'expense', icon: '🚗', color: '#3498DB', isDefault: false, parentId: null })

      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: cat1.id, amount: -5000, date: new Date('2026-01-10') }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, categoryId: cat2.id, amount: -3000, date: new Date('2026-01-15') }))

      const handler = getHandler('analytics:getCategoryTrendsOverTime')
      const result = await handler!(mockEvent, [cat1.id], 'month')

      expect(result.length).toBe(1)
      expect(result[0].categoryId).toBe(cat1.id)
      expect(result[0].total).toBe(5000)
    })
  })

  describe('anomalyDetection:detect', () => {
    it('should detect anomalies from decrypted transactions', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)

      const now = new Date()
      for (let i = 0; i < 20; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i * 3)
        const amount = -5000
        const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount, date }))

        const enc = encryptEntityFields('transaction', { amount }, dek!)
        ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(enc.amount, tx.id)
      }

      const largeTx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, amount: -50000, date: new Date() }))
      const encLarge = encryptEntityFields('transaction', { amount: -50000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET amount = ? WHERE id = ?').run(encLarge.amount, largeTx.id)

      const handler = getHandler('anomalyDetection:detect')
      const result = await handler!(mockEvent)

      expect(result).toBeDefined()
      expect(result.anomalies).toBeDefined()
    })
  })

  describe('safeToSpend:calculate', () => {
    it('should calculate from decrypted account balances and recurring items', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', balance: 500000, ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, { balance: 500000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.balance, account.id)

      const recurringItem = ctx.db.createRecurringItem(makeRecurringItem({
        description: 'Rent',
        amount: -150000,
        accountId: account.id,
        ownerId: user.id,
      }))
      const encRecurring = encryptAndStore(ctx.db, 'recurring_item', recurringItem.id, user.id, { amount: -150000 })
      ctx.db.rawDb.prepare('UPDATE recurring_items SET amount = ?, isEncrypted = 1 WHERE id = ?')
        .run(encRecurring.amount, recurringItem.id)

      const handler = getHandler('safeToSpend:calculate')
      const result = await handler!(mockEvent)

      expect(result).toBeDefined()
      expect(result.safeAmount).toBeDefined()
    })
  })
})
