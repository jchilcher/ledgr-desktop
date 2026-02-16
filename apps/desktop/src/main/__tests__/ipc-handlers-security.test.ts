import { createTestDatabase, type TestDatabaseContext } from './helpers/test-database'
import { setupEncryptionForUser, encryptAndStore } from './helpers/test-encryption'
import { makeAccount, makeRecurringItem } from './helpers/mock-data'
import { IPCHandlers } from '../ipc-handlers'
import { ipcMain } from 'electron'
import { sessionKeys } from '../session-keys'

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
    getAllWindows: jest.fn(() => [
      {
        webContents: {
          send: jest.fn(),
        },
      },
    ]),
  },
  app: {
    getPath: jest.fn(() => '/tmp'),
    getVersion: jest.fn(() => '1.0.0'),
  },
  shell: {
    openExternal: jest.fn(),
  },
}))

describe('IPC Handlers - Security', () => {
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
    sessionKeys.clearAll()
    ctx.cleanup()
    jest.clearAllMocks()
  })

  describe('security:enableMemberPassword', () => {
    it('should create password hash and salt', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const hash = ctx.db.getSetting(`user_password_hash_${user.id}`, '')
      const salt = ctx.db.getSetting(`user_password_salt_${user.id}`, '')

      expect(hash).toBeTruthy()
      expect(hash.length).toBeGreaterThan(0)
      expect(salt).toBeTruthy()
      expect(salt.length).toBeGreaterThan(0)
    })

    it('should generate keypair and store user keys', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const keys = ctx.db.getUserKeys(user.id)
      expect(keys).toBeTruthy()
      expect(keys!.publicKey).toBeTruthy()
      expect(keys!.encryptedPrivateKey).toBeTruthy()
      expect(keys!.privateKeyIv).toBeTruthy()
      expect(keys!.privateKeyTag).toBeTruthy()
      expect(keys!.encryptionSalt).toBeTruthy()
    })

    it('should establish session with UEK and private key', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const session = sessionKeys.getSession(user.id)
      expect(session).toBeTruthy()
      expect(session!.uek).toBeTruthy()
      expect(session!.privateKey).toBeTruthy()
    })

    it('should set current user after enabling password', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const getCurrentUserHandler = getHandler('security:getCurrentUser')
      const currentUser = await getCurrentUserHandler!(mockEvent)
      expect(currentUser).toBe(user.id)
    })

    it('should encrypt existing entities owned by user', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const account = ctx.db.createAccount(makeAccount({ name: 'Test Account', balance: 100000, ownerId: user.id }))

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const dbAccount = ctx.db.getAccountById(account.id)
      expect(dbAccount!.isEncrypted).toBe(true)
      expect(dbAccount!.balance).not.toBe(100000)

      const dek = ctx.db.getDEK(account.id, 'account')
      expect(dek).toBeTruthy()
    })

    it('should encrypt transactions for owned accounts', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const account = ctx.db.createAccount(makeAccount({ name: 'Test', ownerId: user.id }))
      const tx = ctx.db.createTransaction({ accountId: account.id, date: new Date(), description: 'Test Tx', amount: -5000, categoryId: null, isRecurring: false, importSource: 'manual' as const })

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, user.id, 'alice-password-123')

      const dbTx = ctx.db.getTransactionById(tx.id)
      expect(dbTx!.description).not.toBe('Test Tx')
      expect(dbTx!.amount).not.toBe(-5000)
    })

    it('should apply blanket shares to encrypted entities', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      ctx.db.setSharingDefault({
        ownerId: alice.id,
        recipientId: bob.id,
        entityType: 'account',
        permissions: { view: true, combine: true, reports: true },
      })

      const account = ctx.db.createAccount(makeAccount({ name: 'Alice Account', ownerId: alice.id }))

      const handler = getHandler('security:enableMemberPassword')
      await handler!(mockEvent, alice.id, 'alice-password-123')

      const shares = ctx.db.getSharesForEntity(account.id, 'account')
      expect(shares.length).toBe(1)
      expect(shares[0].recipientId).toBe(bob.id)
    })

    it('should reject password shorter than 4 characters', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const handler = getHandler('security:enableMemberPassword')
      expect(() => handler!(mockEvent, user.id, 'abc')).toThrow('Password must be at least 4 characters')
    })

    it('should reject if not current user', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      ipcHandlers.setCurrentUserId(alice.id)

      const handler = getHandler('security:enableMemberPassword')
      expect(() => handler!(mockEvent, bob.id, 'bob-password')).toThrow('You can only set your own password')
    })
  })

  describe('security:unlockMember', () => {
    it('should verify password and establish session', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      await enableHandler!(mockEvent, user.id, 'alice-password-123')

      sessionKeys.clearSession(user.id)
      ipcHandlers.setCurrentUserId(null!)

      const unlockHandler = getHandler('security:unlockMember')
      const result = await unlockHandler!(mockEvent, user.id, 'alice-password-123')

      expect(result).toBe(true)

      const session = sessionKeys.getSession(user.id)
      expect(session).toBeTruthy()
    })

    it('should reject incorrect password', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      await enableHandler!(mockEvent, user.id, 'alice-password-123')

      sessionKeys.clearSession(user.id)

      const unlockHandler = getHandler('security:unlockMember')
      const result = await unlockHandler!(mockEvent, user.id, 'wrong-password')

      expect(result).toBe(false)
    })

    it('should unlock user without password when none set', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')

      const unlockHandler = getHandler('security:unlockMember')
      const result = await unlockHandler!(mockEvent, user.id, null)

      expect(result).toBe(true)

      const currentUserHandler = getHandler('security:getCurrentUser')
      const currentUser = await currentUserHandler!(mockEvent)
      expect(currentUser).toBe(user.id)
    })

    it('should set isLocked to false', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      ipcHandlers.setLocked(true)

      const unlockHandler = getHandler('security:unlockMember')
      await unlockHandler!(mockEvent, user.id, null)

      expect(ipcHandlers.getIsLocked()).toBe(false)
    })
  })

  describe('security:changeMemberPassword', () => {
    it('should verify old password', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      enableHandler!(mockEvent, user.id, 'old-password')

      const changeHandler = getHandler('security:changeMemberPassword')
      expect(() => changeHandler!(mockEvent, user.id, 'wrong-old-password', 'new-password')).toThrow('Incorrect current password')
    })

    it('should update password hash and salt', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      await enableHandler!(mockEvent, user.id, 'old-password')

      const oldHash = ctx.db.getSetting(`user_password_hash_${user.id}`, '')
      const oldSalt = ctx.db.getSetting(`user_password_salt_${user.id}`, '')

      const changeHandler = getHandler('security:changeMemberPassword')
      await changeHandler!(mockEvent, user.id, 'old-password', 'new-password')

      const newHash = ctx.db.getSetting(`user_password_hash_${user.id}`, '')
      const newSalt = ctx.db.getSetting(`user_password_salt_${user.id}`, '')

      expect(newHash).not.toBe(oldHash)
      expect(newSalt).not.toBe(oldSalt)
    })

    it('should re-wrap all DEKs with new UEK', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      enableHandler!(mockEvent, user.id, 'old-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Test', balance: 100000, ownerId: user.id }))
      const recurringItem = ctx.db.createRecurringItem(makeRecurringItem({ description: 'Rent', amount: -150000, ownerId: user.id }))

      encryptAndStore(ctx.db, 'account', account.id, user.id, { name: 'Test', balance: 100000 })
      encryptAndStore(ctx.db, 'recurring_item', recurringItem.id, user.id, { description: 'Rent', amount: -150000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET isEncrypted = 1 WHERE id = ?').run(account.id)
      ctx.db.rawDb.prepare('UPDATE recurring_items SET isEncrypted = 1 WHERE id = ?').run(recurringItem.id)

      const accountDekBefore = ctx.db.getDEK(account.id, 'account')
      const recurringDekBefore = ctx.db.getDEK(recurringItem.id, 'recurring_item')

      expect(accountDekBefore).toBeTruthy()
      expect(recurringDekBefore).toBeTruthy()

      const changeHandler = getHandler('security:changeMemberPassword')
      changeHandler!(mockEvent, user.id, 'old-password', 'new-password')

      const accountDekAfter = ctx.db.getDEK(account.id, 'account')
      const recurringDekAfter = ctx.db.getDEK(recurringItem.id, 'recurring_item')

      expect(accountDekAfter!.wrappedDek).not.toBe(accountDekBefore!.wrappedDek)
      expect(recurringDekAfter!.wrappedDek).not.toBe(recurringDekBefore!.wrappedDek)
    })

    it('should decrypt entities with new password', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      const enableHandler = getHandler('security:enableMemberPassword')
      await enableHandler!(mockEvent, user.id, 'old-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Test Account', balance: 250000, ownerId: user.id }))

      const changeHandler = getHandler('security:changeMemberPassword')
      await changeHandler!(mockEvent, user.id, 'old-password', 'new-password-123')

      sessionKeys.clearSession(user.id)

      const unlockHandler = getHandler('security:unlockMember')
      await unlockHandler!(mockEvent, user.id, 'new-password-123')

      const accountsHandler = getHandler('accounts:getAll')
      const accounts = await accountsHandler!(mockEvent)

      const decryptedAccount = accounts.find((a: { id: string }) => a.id === account.id)
      expect(decryptedAccount).toBeTruthy()
      expect(decryptedAccount.balance).toBe(250000)
    })

    it('should reject if not current user', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      const enableHandler = getHandler('security:enableMemberPassword')
      enableHandler!(mockEvent, alice.id, 'alice-password')

      const changeHandler = getHandler('security:changeMemberPassword')
      expect(() => changeHandler!(mockEvent, bob.id, 'alice-password', 'new-password')).toThrow('You can only change your own password')
    })
  })

  describe('security:lock', () => {
    it('should clear all session keys', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      expect(sessionKeys.getSession(user.id)).toBeTruthy()

      const lockHandler = getHandler('security:lock')
      await lockHandler!(mockEvent)

      expect(sessionKeys.getSession(user.id)).toBeNull()
    })

    it('should set isLocked to true', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const lockHandler = getHandler('security:lock')
      await lockHandler!(mockEvent)

      expect(ipcHandlers.getIsLocked()).toBe(true)
    })

    it('should clear current user', async () => {
      const user = ctx.db.createUser('Alice', '#FF5733')
      setupEncryptionForUser(ctx.db, user.id, 'alice-password')
      ipcHandlers.setCurrentUserId(user.id)

      const lockHandler = getHandler('security:lock')
      await lockHandler!(mockEvent)

      const getCurrentUserHandler = getHandler('security:getCurrentUser')
      const currentUser = await getCurrentUserHandler!(mockEvent)
      expect(currentUser).toBeNull()
    })
  })

  describe('sharing:createShare', () => {
    it('should wrap DEK with recipient RSA public key', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Alice Account', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Alice Account', balance: 100000 })

      ipcHandlers.setCurrentUserId(alice.id)

      const shareHandler = getHandler('sharing:createShare')
      const share = await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })

      expect(share).toBeTruthy()
      expect(share.entityId).toBe(account.id)
      expect(share.recipientId).toBe(bob.id)
      expect(share.ownerId).toBe(alice.id)
      expect(share.wrappedDek).toBeTruthy()
    })

    it('should allow recipient to decrypt shared entity', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Shared Account', balance: 500000, ownerId: alice.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Shared Account', balance: 500000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      ipcHandlers.setCurrentUserId(alice.id)

      const shareHandler = getHandler('sharing:createShare')
      await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })

      ipcHandlers.setCurrentUserId(bob.id)

      const accountsHandler = getHandler('accounts:getAll')
      const accounts = await accountsHandler!(mockEvent)

      const sharedAccount = accounts.find((a: { id: string }) => a.id === account.id)
      expect(sharedAccount).toBeTruthy()
      expect(sharedAccount.name).toBe('Shared Account')
      expect(sharedAccount.balance).toBe(500000)
    })

    it('should reject if not authenticated', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Test', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Test', balance: 100000 })

      const shareHandler = getHandler('sharing:createShare')
      await expect(async () => {
        await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })
      }).rejects.toThrow('Not authenticated')
    })

    it('should reject if not the owner', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')
      ipcHandlers.setCurrentUserId(bob.id)

      const account = ctx.db.createAccount(makeAccount({ name: 'Alice Account', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Alice Account', balance: 100000 })

      const shareHandler = getHandler('sharing:createShare')
      await expect(async () => {
        await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })
      }).rejects.toThrow('Not the owner of this entity')
    })
  })

  describe('sharing:revokeShare', () => {
    it('should remove share record', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Shared', ownerId: alice.id }))
      encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Shared', balance: 100000 })

      ipcHandlers.setCurrentUserId(alice.id)

      const shareHandler = getHandler('sharing:createShare')
      const share = await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })

      const sharesBefore = ctx.db.getSharesForEntity(account.id, 'account')
      expect(sharesBefore.length).toBe(1)

      const revokeHandler = getHandler('sharing:revokeShare')
      await revokeHandler!(mockEvent, share.id)

      const sharesAfter = ctx.db.getSharesForEntity(account.id, 'account')
      expect(sharesAfter.length).toBe(0)
    })

    it('should prevent recipient from accessing entity after revoke', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      setupEncryptionForUser(ctx.db, alice.id, 'alice-password')
      setupEncryptionForUser(ctx.db, bob.id, 'bob-password')

      const account = ctx.db.createAccount(makeAccount({ name: 'Shared', balance: 300000, ownerId: alice.id }))
      const encryptedData = encryptAndStore(ctx.db, 'account', account.id, alice.id, { name: 'Shared', balance: 300000 })
      ctx.db.rawDb.prepare('UPDATE accounts SET name = ?, balance = ?, isEncrypted = 1 WHERE id = ?')
        .run(encryptedData.name, encryptedData.balance, account.id)

      ipcHandlers.setCurrentUserId(alice.id)

      const shareHandler = getHandler('sharing:createShare')
      const share = await shareHandler!(mockEvent, account.id, 'account', bob.id, { view: true, combine: true, reports: true })

      const revokeHandler = getHandler('sharing:revokeShare')
      await revokeHandler!(mockEvent, share.id)

      ipcHandlers.setCurrentUserId(bob.id)

      const accountsHandler = getHandler('accounts:getAll')
      const accounts = await accountsHandler!(mockEvent)

      const filtered = accounts.filter((a: { id: string }) => a.id === account.id)
      expect(filtered.length).toBe(0)
    })
  })

  describe('security:getMemberAuthStatus', () => {
    it('should return auth status for all users', async () => {
      const alice = ctx.db.createUser('Alice', '#FF5733')
      const bob = ctx.db.createUser('Bob', '#3498DB')

      const enableHandler = getHandler('security:enableMemberPassword')
      await enableHandler!(mockEvent, alice.id, 'alice-password')

      const statusHandler = getHandler('security:getMemberAuthStatus')
      const status = await statusHandler!(mockEvent)

      const aliceStatus = status.find((s: { userId: string }) => s.userId === alice.id)
      const bobStatus = status.find((s: { userId: string }) => s.userId === bob.id)

      expect(aliceStatus).toBeTruthy()
      expect(bobStatus).toBeTruthy()
      expect(aliceStatus.hasPassword).toBe(true)
      expect(bobStatus.hasPassword).toBe(false)
    })
  })
})
