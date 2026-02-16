import { createTestDatabase, type TestDatabaseContext } from './helpers/test-database'
import { setupEncryptionForUser, encryptAndStore } from './helpers/test-encryption'
import { makeAccount, makeTransaction } from './helpers/mock-data'
import { IPCHandlers } from '../ipc-handlers'
import { ipcMain } from 'electron'
import type { Transaction } from '../../shared/types'
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

describe('IPC Handlers - Transactions', () => {
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

  describe('transactions:create without encryption', () => {
    it('should create transaction without encryption for unencrypted account', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test Account' }))

      const handler = getHandler('transactions:create')
      const txData = {
        accountId: account.id,
        date: new Date('2026-01-15'),
        description: 'Test Transaction',
        amount: -5000,
        categoryId: null,
        isRecurring: false,
        importSource: 'manual' as const,
      }

      const result = await handler!(mockEvent, txData)

      expect(result.id).toBeDefined()
      expect(result.description).toBe('Test Transaction')
      expect(result.amount).toBe(-5000)
    })
  })

  describe('transactions:create with encryption', () => {
    it('should inherit encryption from parent account', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted Account', ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted Account', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      const handler = getHandler('transactions:create')
      const txData = {
        accountId: account.id,
        date: new Date('2026-01-15'),
        description: 'Secret Purchase',
        amount: -7500,
        categoryId: null,
        isRecurring: false,
        importSource: 'manual' as const,
      }

      const result = await handler!(mockEvent, txData)

      const dbTx = ctx.db.getTransactionById(result.id)
      expect(dbTx).toBeTruthy()
      expect(dbTx!.description).not.toBe('Secret Purchase')
      expect(dbTx!.amount).not.toBe(-7500)
    })

    it('should encrypt transaction fields using account DEK', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Test', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Test', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const handler = getHandler('transactions:create')
      const txData = {
        accountId: account.id,
        date: new Date('2026-01-20'),
        description: 'Sensitive Transaction',
        notes: 'Private notes',
        amount: -12000,
        categoryId: null,
        isRecurring: false,
        importSource: 'manual' as const,
      }

      await handler!(mockEvent, txData)

      const txs = ctx.db.getTransactionsByAccount(account.id)
      expect(txs.length).toBe(1)

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      expect(dek).toBeTruthy()
    })

    it('should create transaction without encryption if no DEK available', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const account = ctx.db.createAccount(makeAccount({ name: 'Test', ownerId: user.id }))
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const handler = getHandler('transactions:create')
      const txData = {
        accountId: account.id,
        date: new Date('2026-01-15'),
        description: 'Test',
        amount: -5000,
        categoryId: null,
        isRecurring: false,
        importSource: 'manual' as const,
      }

      const result = await handler!(mockEvent, txData)

      const dbTx = ctx.db.getTransactionById(result.id)
      expect(dbTx!.description).toBe('Test')
      expect(dbTx!.amount).toBe(-5000)
    })
  })

  describe('transactions:getAll', () => {
    it('should return all transactions without encryption', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Tx 1', amount: -1000 }))
      ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Tx 2', amount: -2000 }))

      const handler = getHandler('transactions:getAll')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(2)
      const descriptions = result.map((t: { description: string }) => t.description).sort()
      expect(descriptions).toEqual(['Tx 1', 'Tx 2'])
    })

    it('should decrypt transactions from encrypted accounts', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Test Tx', amount: -5000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Test Tx', amount: -5000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, tx.id)

      const handler = getHandler('transactions:getAll')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(1)
      expect(result[0].description).toBe('Test Tx')
      expect(result[0].amount).toBe(-5000)
    })

    it('should handle mixed encrypted and unencrypted transactions', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const plainAccount = ctx.db.createAccount(makeAccount({ name: 'Plain' }))
      const encAccount = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', encAccount.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(encAccount.id)

      const plainTx = ctx.db.createTransaction(makeTransaction({ accountId: plainAccount.id, description: 'Plain Tx', amount: -1000 }))
      const encTx = ctx.db.createTransaction(makeTransaction({ accountId: encAccount.id, description: 'Encrypted Tx', amount: -2000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', encAccount.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Encrypted Tx', amount: -2000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, encTx.id)

      const handler = getHandler('transactions:getAll')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(2)
      const plainResult = result.find((t: Transaction) => t.id === plainTx.id)
      const encResult = result.find((t: Transaction) => t.id === encTx.id)

      expect(plainResult.description).toBe('Plain Tx')
      expect(plainResult.amount).toBe(-1000)
      expect(encResult.description).toBe('Encrypted Tx')
      expect(encResult.amount).toBe(-2000)
    })
  })

  describe('transactions:getByAccount', () => {
    it('should return transactions for specific account', async () => {
      const account1 = ctx.db.createAccount(makeAccount({ name: 'Account 1' }))
      const account2 = ctx.db.createAccount(makeAccount({ name: 'Account 2' }))

      ctx.db.createTransaction(makeTransaction({ accountId: account1.id, description: 'A1 Tx' }))
      ctx.db.createTransaction(makeTransaction({ accountId: account2.id, description: 'A2 Tx' }))

      const handler = getHandler('transactions:getByAccount')
      const result = await handler!(mockEvent, account1.id)

      expect(result.length).toBe(1)
      expect(result[0].description).toBe('A1 Tx')
    })

    it('should decrypt transactions for encrypted account', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Secret Tx', amount: -3500 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Secret Tx', amount: -3500 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, tx.id)

      const handler = getHandler('transactions:getByAccount')
      const result = await handler!(mockEvent, account.id)

      expect(result.length).toBe(1)
      expect(result[0].description).toBe('Secret Tx')
      expect(result[0].amount).toBe(-3500)
    })

    it('should return encrypted transactions as-is when no session', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Test', amount: -1000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Test', amount: -1000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, tx.id)

      const handler = getHandler('transactions:getByAccount')
      const result = await handler!(mockEvent, account.id)

      expect(result.length).toBe(1)
      expect(result[0].description).not.toBe('Test')
      expect(result[0].amount).not.toBe(-1000)
    })
  })

  describe('transactions:update', () => {
    it('should update transaction without encryption', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Original', amount: -1000 }))

      const handler = getHandler('transactions:update')
      const result = await handler!(mockEvent, tx.id, { description: 'Updated', amount: -2000 })

      expect(result.description).toBe('Updated')
      expect(result.amount).toBe(-2000)
    })

    it('should re-encrypt modified fields on update', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Original', amount: -1000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Original', amount: -1000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, tx.id)

      const handler = getHandler('transactions:update')
      const result = await handler!(mockEvent, tx.id, { description: 'Updated Description', amount: -5000 })

      expect(result.description).toBe('Updated Description')
      expect(result.amount).toBe(-5000)

      const dbTx = ctx.db.getTransactionById(tx.id)
      expect(dbTx!.description).not.toBe('Updated Description')
      expect(dbTx!.amount).not.toBe(-5000)
    })

    it('should update non-sensitive fields without re-encryption', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const category = ctx.db.createCategory({ name: 'Food', type: 'expense', icon: '🍔', color: '#FF5733', isDefault: false, parentId: null })
      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Test', amount: -1000, categoryId: null }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const encrypted = encryptEntityFields('transaction', { description: 'Test', amount: -1000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?')
        .run(encrypted.description, encrypted.amount, tx.id)

      const handler = getHandler('transactions:update')
      await handler!(mockEvent, tx.id, { categoryId: category.id })

      const dbTx = ctx.db.getTransactionById(tx.id)
      expect(dbTx!.categoryId).toBe(category.id)
    })
  })

  describe('transactions:delete', () => {
    it('should delete transaction', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test' }))
      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'To Delete' }))

      const handler = getHandler('transactions:delete')
      await handler!(mockEvent, tx.id)

      const deleted = ctx.db.getTransactionById(tx.id)
      expect(deleted).toBeNull()
    })

    it('should delete encrypted transaction', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })

      const tx = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'To Delete' }))

      const handler = getHandler('transactions:delete')
      await handler!(mockEvent, tx.id)

      const deleted = ctx.db.getTransactionById(tx.id)
      expect(deleted).toBeNull()
    })
  })

  describe('transactions:search on encrypted data', () => {
    it('should search decrypted transaction descriptions', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Encrypted', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Encrypted', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)

      const tx1 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Coffee Shop', amount: -450 }))
      const tx2 = ctx.db.createTransaction(makeTransaction({ accountId: account.id, description: 'Grocery Store', amount: -5000 }))

      const dek = getDecryptionDEK(ctx.db, 'account', account.id, user.id, user.id)
      const enc1 = encryptEntityFields('transaction', { description: 'Coffee Shop', amount: -450 }, dek!)
      const enc2 = encryptEntityFields('transaction', { description: 'Grocery Store', amount: -5000 }, dek!)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?').run(enc1.description, enc1.amount, tx1.id)
      ctx.db.rawDb.prepare('UPDATE transactions SET description = ?, amount = ? WHERE id = ?').run(enc2.description, enc2.amount, tx2.id)

      const handler = getHandler('transactions:getAll')
      const allTxs = await handler!(mockEvent)

      const coffeeMatches = allTxs.filter((t: Transaction) => t.description.includes('Coffee'))
      expect(coffeeMatches.length).toBe(1)
      expect(coffeeMatches[0].description).toBe('Coffee Shop')
    })
  })
})
