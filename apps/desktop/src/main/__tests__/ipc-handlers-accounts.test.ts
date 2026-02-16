import { createTestDatabase, type TestDatabaseContext } from './helpers/test-database'
import { setupEncryptionForUser, encryptAndStore, setupSharedAccess } from './helpers/test-encryption'
import { makeAccount } from './helpers/mock-data'
import { IPCHandlers } from '../ipc-handlers'
import { ipcMain } from 'electron'
import type { Account } from '../../shared/types'
import { decryptEntityList } from '../encryption-middleware'

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

describe('IPC Handlers - Accounts', () => {
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

  describe('accounts:create without encryption', () => {
    it('should create account without encryption when no user session', async () => {
      const handler = getHandler('accounts:create')
      expect(handler).toBeDefined()

      const accountData = {
        name: 'Test Checking',
        type: 'checking' as const,
        institution: 'Test Bank',
        balance: 500000,
        lastSynced: null,
      }

      const result = await handler!(mockEvent, accountData)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Test Checking')
      expect(result.balance).toBe(500000)
      expect(result.isEncrypted).toBe(false)
    })

    it('should create account without encryption when ownerId is null', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const handler = getHandler('accounts:create')
      const accountData = {
        name: 'Shared Account',
        type: 'checking' as const,
        institution: 'Test Bank',
        balance: 300000,
        lastSynced: null,
        ownerId: null,
      }

      const result = await handler!(mockEvent, accountData)

      expect(result.isEncrypted).toBe(false)
      expect(result.balance).toBe(300000)
    })
  })

  describe('accounts:create with encryption', () => {
    it('should create encrypted account when user has session', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const handler = getHandler('accounts:create')
      const accountData = {
        name: 'Private Checking',
        type: 'checking' as const,
        institution: 'Secure Bank',
        balance: 1000000,
        lastSynced: null,
        ownerId: user.id,
      }

      const result = await handler!(mockEvent, accountData)

      expect(result.id).toBeDefined()
      expect(result.isEncrypted).toBe(true)

      const dbAccount = ctx.db.getAccountById(result.id)
      expect(dbAccount).toBeTruthy()
      expect(dbAccount!.balance).not.toBe(1000000)
    })

    it('should apply blanket shares on account creation', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')
      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      ctx.db.setSharingDefault({
        ownerId: alice.id,
        recipientId: bob.id,
        entityType: 'account',
        permissions: { view: true, combine: true, reports: true },
      })

      ipcHandlers.setCurrentUserId(alice.id)

      const handler = getHandler('accounts:create')
      const accountData = {
        name: 'Alice Account',
        type: 'savings' as const,
        institution: 'Bank',
        balance: 500000,
        lastSynced: null,
        ownerId: alice.id,
      }

      const result = await handler!(mockEvent, accountData)

      const shares = ctx.db.getSharesForEntity(result.id, 'account')
      expect(shares.length).toBe(1)
      expect(shares[0].recipientId).toBe(bob.id)
      expect(shares[0].ownerId).toBe(alice.id)
    })
  })

  describe('accounts:getAll', () => {
    it('should return all accounts without encryption', async () => {
      ctx.db.createAccount(makeAccount({ name: 'Account 1' }))
      ctx.db.createAccount(makeAccount({ name: 'Account 2' }))

      const handler = getHandler('accounts:getAll')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(2)
      const names = result.map((a: Account) => a.name).sort()
      expect(names).toEqual(['Account 1', 'Account 2'])
    })

    it('should return decrypted accounts for current user', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Test Account', balance: 750000, ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, {
        name: 'Encrypted Account',
        balance: 750000,
      })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      const handler = getHandler('accounts:getAll')
      const result = await handler!(mockEvent)

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Encrypted Account')
      expect(result[0].balance).toBe(750000)
    })

    it('should filter out inaccessible encrypted accounts', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')
      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const aliceAccount = ctx.db.createAccount(makeAccount({ name: 'Alice Account', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', aliceAccount.id, alice.id, { name: 'Alice Private', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(aliceAccount.id)

      ipcHandlers.setCurrentUserId(bob.id)

      const handler = getHandler('accounts:getAll')
      const result = await handler!(mockEvent)

      const filtered = result.filter((a: Account) => a.id === aliceAccount.id)
      expect(filtered.length).toBe(0)
    })

    it('should include shared encrypted accounts', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')
      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const aliceAccount = ctx.db.createAccount(makeAccount({ name: 'Shared Account', balance: 500000, ownerId: alice.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', aliceAccount.id, alice.id, { name: 'Shared Account', balance: 500000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, aliceAccount.id)

      setupSharedAccess(ctx.db, aliceAccount.id, 'account', alice.id, bob.id)

      ipcHandlers.setCurrentUserId(bob.id)

      const handler = getHandler('accounts:getAll')
      const result = await handler!(mockEvent)

      const shared = result.find((a: Account) => a.id === aliceAccount.id)
      expect(shared).toBeTruthy()
      expect(shared.name).toBe('Shared Account')
      expect(shared.balance).toBe(500000)
    })
  })

  describe('accounts:getById', () => {
    it('should return account by id without encryption', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Test Account' }))

      const handler = getHandler('accounts:getById')
      const result = await handler!(mockEvent, account.id)

      expect(result.id).toBe(account.id)
      expect(result.name).toBe('Test Account')
    })

    it('should return decrypted account for owner', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Test', balance: 250000, ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Private Account', balance: 250000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      const handler = getHandler('accounts:getById')
      const result = await handler!(mockEvent, account.id)

      expect(result.name).toBe('Private Account')
      expect(result.balance).toBe(250000)
    })

    it('should return null for inaccessible encrypted account', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')
      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const aliceAccount = ctx.db.createAccount(makeAccount({ name: 'Alice Account', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', aliceAccount.id, alice.id, { name: 'Private', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(aliceAccount.id)

      ipcHandlers.setCurrentUserId(bob.id)

      const handler = getHandler('accounts:getById')
      const result = await handler!(mockEvent, aliceAccount.id)

      expect(result).toBeNull()
    })
  })

  describe('accounts:update', () => {
    it('should update account without encryption', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'Original', balance: 100000 }))

      const handler = getHandler('accounts:update')
      const result = await handler!(mockEvent, account.id, { name: 'Updated', balance: 200000 })

      expect(result.name).toBe('Updated')
      expect(result.balance).toBe(200000)
    })

    it('should re-encrypt modified fields on update', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Original', balance: 100000, ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Original', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      const handler = getHandler('accounts:update')
      const result = await handler!(mockEvent, account.id, { name: 'Updated Name', balance: 300000 })

      expect(result.name).toBe('Updated Name')
      expect(result.balance).toBe(300000)

      const dbAccount = ctx.db.getAccountById(account.id)
      expect(dbAccount!.balance).not.toBe(300000)
      expect(dbAccount!.isEncrypted).toBe(true)

      const decrypted = decryptEntityList(ctx.db, 'account', [dbAccount!], user.id)
      expect(decrypted[0].balance).toBe(300000)
    })

    it('should update non-sensitive fields without re-encryption', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Test', balance: 100000, type: 'checking' as const, ownerId: user.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Test', balance: 100000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      const handler = getHandler('accounts:update')
      await handler!(mockEvent, account.id, { type: 'savings' as const })

      const dbAccount = ctx.db.getAccountById(account.id)
      expect(dbAccount!.type).toBe('savings')
    })
  })

  describe('accounts:delete', () => {
    it('should delete account without encryption', async () => {
      const account = ctx.db.createAccount(makeAccount({ name: 'To Delete' }))

      const handler = getHandler('accounts:delete')
      await handler!(mockEvent, account.id)

      const deleted = ctx.db.getAccountById(account.id)
      expect(deleted).toBeNull()
    })

    it('should delete account and remove DEK', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'To Delete', ownerId: user.id }))
      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'To Delete', balance: 100000 })

      const dekBefore = ctx.db.getDEK(account.id, 'account')
      expect(dekBefore).toBeTruthy()

      const handler = getHandler('accounts:delete')
      await handler!(mockEvent, account.id)

      const dekAfter = ctx.db.getDEK(account.id, 'account')
      expect(dekAfter).toBeNull()
    })

    it('should delete account and remove shares', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')
      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Shared Account', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Shared Account', balance: 500000 })
      setupSharedAccess(ctx.db, account.id, 'account', alice.id, bob.id)

      const sharesBefore = ctx.db.getSharesForEntity(account.id, 'account')
      expect(sharesBefore.length).toBe(1)

      const handler = getHandler('accounts:delete')
      await handler!(mockEvent, account.id)

      const sharesAfter = ctx.db.getSharesForEntity(account.id, 'account')
      expect(sharesAfter.length).toBe(0)
    })
  })
})
