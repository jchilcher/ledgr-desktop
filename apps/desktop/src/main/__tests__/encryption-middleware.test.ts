import { randomUUID } from 'crypto'
import { createTestDatabase } from './helpers/test-database'
import { setupEncryptionForUser } from './helpers/test-encryption'
import { generateDEK } from '../crypto-engine'
import {
  encryptEntityFields,
  decryptEntityFields,
  getDecryptionDEK,
  decryptEntityList,
  createAndStoreDEK,
  applyBlanketShares,
} from '../encryption-middleware'
import { sessionKeys } from '../session-keys'
import type { EncryptableEntityType } from '../../shared/types'

describe('encryption-middleware', () => {
  afterEach(() => {
    sessionKeys.clearAll()
  })

  describe('encryptEntityFields', () => {
    it('encrypts only sensitive text fields for account', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Test Checking',
        institution: 'Test Bank',
        balance: 100000,
        type: 'checking',
      }

      const encrypted = encryptEntityFields('account', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.type).toBe(data.type)
      expect(typeof encrypted.name).toBe('string')
      expect(encrypted.name).not.toBe('Test Checking')
      expect(JSON.parse(encrypted.name)).toHaveProperty('c')
      expect(JSON.parse(encrypted.name)).toHaveProperty('iv')
      expect(JSON.parse(encrypted.name)).toHaveProperty('tag')
      expect(typeof encrypted.institution).toBe('string')
      expect(encrypted.institution).not.toBe('Test Bank')
      expect(typeof encrypted.balance).toBe('string')
      expect(encrypted.balance).not.toBe(100000)
    })

    it('encrypts only sensitive fields for recurring_item', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        description: 'Monthly Rent',
        amount: -150000,
        frequency: 'monthly',
        itemType: 'bill',
      }

      const encrypted = encryptEntityFields('recurring_item', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.frequency).toBe(data.frequency)
      expect(encrypted.itemType).toBe(data.itemType)
      expect(typeof encrypted.description).toBe('string')
      expect(encrypted.description).not.toBe('Monthly Rent')
      expect(typeof encrypted.amount).toBe('string')
      expect(encrypted.amount).not.toBe(-150000)
    })

    it('encrypts only sensitive fields for savings_goal', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Emergency Fund',
        targetAmount: 1000000,
        currentAmount: 250000,
        isActive: true,
      }

      const encrypted = encryptEntityFields('savings_goal', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.isActive).toBe(data.isActive)
      expect(typeof encrypted.name).toBe('string')
      expect(encrypted.name).not.toBe('Emergency Fund')
      expect(typeof encrypted.targetAmount).toBe('string')
      expect(typeof encrypted.currentAmount).toBe('string')
    })

    it('encrypts only sensitive fields for manual_asset', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'House',
        notes: 'Primary residence',
        value: 50000000,
        category: 'property',
      }

      const encrypted = encryptEntityFields('manual_asset', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.category).toBe(data.category)
      expect(typeof encrypted.name).toBe('string')
      expect(encrypted.name).not.toBe('House')
      expect(typeof encrypted.notes).toBe('string')
      expect(encrypted.notes).not.toBe('Primary residence')
      expect(typeof encrypted.value).toBe('string')
    })

    it('encrypts only sensitive fields for manual_liability', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Mortgage',
        notes: 'Home loan',
        balance: 30000000,
        monthlyPayment: 150000,
        type: 'mortgage',
      }

      const encrypted = encryptEntityFields('manual_liability', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.type).toBe(data.type)
      expect(typeof encrypted.name).toBe('string')
      expect(encrypted.name).not.toBe('Mortgage')
      expect(typeof encrypted.notes).toBe('string')
      expect(typeof encrypted.balance).toBe('string')
      expect(typeof encrypted.monthlyPayment).toBe('string')
    })

    it('encrypts only sensitive fields for investment_account', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Brokerage',
        institution: 'Vanguard',
        accountType: 'taxable',
      }

      const encrypted = encryptEntityFields('investment_account', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.accountType).toBe(data.accountType)
      expect(typeof encrypted.name).toBe('string')
      expect(encrypted.name).not.toBe('Brokerage')
      expect(typeof encrypted.institution).toBe('string')
      expect(encrypted.institution).not.toBe('Vanguard')
    })

    it('encrypts only sensitive fields for transaction', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        description: 'Grocery shopping',
        notes: 'Weekly groceries',
        amount: -8500,
        date: new Date(),
      }

      const encrypted = encryptEntityFields('transaction', data, dek)

      expect(encrypted.id).toBe(data.id)
      expect(encrypted.date).toBe(data.date)
      expect(typeof encrypted.description).toBe('string')
      expect(encrypted.description).not.toBe('Grocery shopping')
      expect(typeof encrypted.notes).toBe('string')
      expect(encrypted.notes).not.toBe('Weekly groceries')
      expect(typeof encrypted.amount).toBe('string')
    })

    it('skips null fields', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Test',
        institution: null,
        balance: 100000,
      }

      const encrypted = encryptEntityFields('account', data, dek)

      expect(encrypted.institution).toBeNull()
    })

    it('skips empty string fields', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: '',
        institution: 'Test Bank',
        balance: 100000,
      }

      const encrypted = encryptEntityFields('account', data, dek)

      expect(encrypted.name).toBe('')
    })

    it('returns data unchanged for unknown entity type', () => {
      const dek = generateDEK()
      const data = { id: randomUUID(), name: 'Test' }

      const encrypted = encryptEntityFields('unknown_type', data, dek)

      expect(encrypted).toEqual(data)
    })
  })

  describe('decryptEntityFields', () => {
    it('decrypts account fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Test Checking',
        institution: 'Test Bank',
        balance: 100000,
        type: 'checking',
      }

      const encrypted = encryptEntityFields('account', original, dek)
      const decrypted = decryptEntityFields('account', encrypted, dek)

      expect(decrypted.id).toBe(original.id)
      expect(decrypted.name).toBe(original.name)
      expect(decrypted.institution).toBe(original.institution)
      expect(decrypted.balance).toBe(original.balance)
      expect(decrypted.type).toBe(original.type)
    })

    it('decrypts recurring_item fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        description: 'Monthly Rent',
        amount: -150000,
        frequency: 'monthly',
      }

      const encrypted = encryptEntityFields('recurring_item', original, dek)
      const decrypted = decryptEntityFields('recurring_item', encrypted, dek)

      expect(decrypted.description).toBe(original.description)
      expect(decrypted.amount).toBe(original.amount)
    })

    it('decrypts savings_goal fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Emergency Fund',
        targetAmount: 1000000,
        currentAmount: 250000,
      }

      const encrypted = encryptEntityFields('savings_goal', original, dek)
      const decrypted = decryptEntityFields('savings_goal', encrypted, dek)

      expect(decrypted.name).toBe(original.name)
      expect(decrypted.targetAmount).toBe(original.targetAmount)
      expect(decrypted.currentAmount).toBe(original.currentAmount)
    })

    it('decrypts manual_asset fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'House',
        notes: 'Primary residence',
        value: 50000000,
      }

      const encrypted = encryptEntityFields('manual_asset', original, dek)
      const decrypted = decryptEntityFields('manual_asset', encrypted, dek)

      expect(decrypted.name).toBe(original.name)
      expect(decrypted.notes).toBe(original.notes)
      expect(decrypted.value).toBe(original.value)
    })

    it('decrypts manual_liability fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Mortgage',
        notes: 'Home loan',
        balance: 30000000,
        monthlyPayment: 150000,
      }

      const encrypted = encryptEntityFields('manual_liability', original, dek)
      const decrypted = decryptEntityFields('manual_liability', encrypted, dek)

      expect(decrypted.name).toBe(original.name)
      expect(decrypted.notes).toBe(original.notes)
      expect(decrypted.balance).toBe(original.balance)
      expect(decrypted.monthlyPayment).toBe(original.monthlyPayment)
    })

    it('decrypts investment_account fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Brokerage',
        institution: 'Vanguard',
      }

      const encrypted = encryptEntityFields('investment_account', original, dek)
      const decrypted = decryptEntityFields('investment_account', encrypted, dek)

      expect(decrypted.name).toBe(original.name)
      expect(decrypted.institution).toBe(original.institution)
    })

    it('decrypts transaction fields correctly', () => {
      const dek = generateDEK()
      const original = {
        id: randomUUID(),
        description: 'Grocery shopping',
        notes: 'Weekly groceries',
        amount: -8500,
      }

      const encrypted = encryptEntityFields('transaction', original, dek)
      const decrypted = decryptEntityFields('transaction', encrypted, dek)

      expect(decrypted.description).toBe(original.description)
      expect(decrypted.notes).toBe(original.notes)
      expect(decrypted.amount).toBe(original.amount)
    })

    it('defaults text fields to empty string when not encrypted JSON', () => {
      const dek = generateDEK()
      const data = {
        id: randomUUID(),
        name: 'Plain Text',
        balance: 100000,
      }

      const result = decryptEntityFields('account', data, dek)

      // decryptEntityFields tries JSON.parse on text fields; plain strings throw → default to ''
      expect(result.name).toBe('')
      // number fields that are already numbers (not strings) pass through unchanged
      expect(result.balance).toBe(100000)
    })

    it('returns empty string for text fields when DEK is wrong', () => {
      const dek = generateDEK()
      const wrongDEK = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Test Account',
        balance: 100000,
      }

      const encrypted = encryptEntityFields('account', original, dek)
      const decrypted = decryptEntityFields('account', encrypted, wrongDEK)

      expect(decrypted.name).toBe('')
    })

    it('returns zero for number fields when DEK is wrong', () => {
      const dek = generateDEK()
      const wrongDEK = generateDEK()
      const original = {
        id: randomUUID(),
        name: 'Test Account',
        balance: 100000,
      }

      const encrypted = encryptEntityFields('account', original, dek)
      const decrypted = decryptEntityFields('account', encrypted, wrongDEK)

      expect(decrypted.balance).toBe(0)
    })
  })

  describe('getDecryptionDEK', () => {
    let cleanup: () => void

    afterEach(() => {
      if (cleanup) cleanup()
    })

    it('returns DEK when owner requests own entity', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()
      setupEncryptionForUser(db, userId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, userId)

      const retrievedDEK = getDecryptionDEK(db, entityType, entityId, userId, userId)

      expect(retrievedDEK).not.toBeNull()
      expect(retrievedDEK?.equals(dek!)).toBe(true)
    })

    it('returns DEK when shared recipient requests entity', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()
      const recipientId = randomUUID()
      setupEncryptionForUser(db, ownerId)
      setupEncryptionForUser(db, recipientId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, ownerId)

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { wrapDEKWithRSA } = require('../crypto-engine')
      const recipientKeys = db.getUserKeys(recipientId)
      const wrappedDek = wrapDEKWithRSA(dek!, recipientKeys!.publicKey)
      db.createShare({
        entityId,
        entityType,
        ownerId,
        recipientId,
        wrappedDek,
        permissions: { view: true, combine: true, reports: true },
      })

      const retrievedDEK = getDecryptionDEK(db, entityType, entityId, ownerId, recipientId)

      expect(retrievedDEK).not.toBeNull()
      expect(retrievedDEK?.equals(dek!)).toBe(true)
    })

    it('returns null when non-recipient requests entity', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()
      const otherId = randomUUID()
      setupEncryptionForUser(db, ownerId)
      setupEncryptionForUser(db, otherId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      createAndStoreDEK(db, entityType, entityId, ownerId)

      const retrievedDEK = getDecryptionDEK(db, entityType, entityId, ownerId, otherId)

      expect(retrievedDEK).toBeNull()
    })

    it('returns null when no session exists', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'

      const retrievedDEK = getDecryptionDEK(db, entityType, entityId, userId, userId)

      expect(retrievedDEK).toBeNull()
    })
  })

  describe('decryptEntityList', () => {
    let cleanup: () => void

    afterEach(() => {
      if (cleanup) cleanup()
    })

    it('filters out inaccessible encrypted items', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()
      const otherId = randomUUID()
      setupEncryptionForUser(db, ownerId)
      setupEncryptionForUser(db, otherId)

      const entityType: EncryptableEntityType = 'account'
      const items = [
        { id: randomUUID(), name: 'Encrypted Account', ownerId, isEncrypted: true },
        { id: randomUUID(), name: 'Public Account', ownerId: null, isEncrypted: false },
      ]

      const result = decryptEntityList(db, entityType, items, otherId)

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Public Account')
    })

    it('includes non-encrypted items always', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()

      const entityType: EncryptableEntityType = 'account'
      const items = [
        { id: randomUUID(), name: 'Account 1', isEncrypted: false },
        { id: randomUUID(), name: 'Account 2', isEncrypted: false },
      ]

      const result = decryptEntityList(db, entityType, items, userId)

      expect(result.length).toBe(2)
    })

    it('returns only non-encrypted items when currentUserId is null', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup

      const entityType: EncryptableEntityType = 'account'
      const items = [
        { id: randomUUID(), name: 'Encrypted', ownerId: randomUUID(), isEncrypted: true },
        { id: randomUUID(), name: 'Public', isEncrypted: false },
      ]

      const result = decryptEntityList(db, entityType, items, null)

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Public')
    })

    it('decrypts accessible encrypted items', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()
      setupEncryptionForUser(db, userId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, userId)

      const original = { id: entityId, name: 'Test Account', balance: 100000, ownerId: userId, isEncrypted: true }
      const encrypted = encryptEntityFields('account', original, dek!)

      const result = decryptEntityList(db, entityType, [encrypted], userId)

      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Test Account')
      expect(result[0].balance).toBe(100000)
    })
  })

  describe('createAndStoreDEK', () => {
    let cleanup: () => void

    afterEach(() => {
      if (cleanup) cleanup()
    })

    it('generates and stores wrapped DEK', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()
      setupEncryptionForUser(db, userId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'

      const dek = createAndStoreDEK(db, entityType, entityId, userId)

      expect(dek).not.toBeNull()
      expect(Buffer.isBuffer(dek)).toBe(true)
      expect(dek!.length).toBe(32)

      const dekRecord = db.getDEK(entityId, entityType)
      expect(dekRecord).not.toBeNull()
      expect(dekRecord!.id).toBe(entityId)
      expect(dekRecord!.entityType).toBe(entityType)
      expect(dekRecord!.ownerId).toBe(userId)
    })

    it('returns null when no session exists', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const userId = randomUUID()

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'

      const dek = createAndStoreDEK(db, entityType, entityId, userId)

      expect(dek).toBeNull()
    })
  })

  describe('applyBlanketShares', () => {
    let cleanup: () => void

    afterEach(() => {
      if (cleanup) cleanup()
    })

    it('creates share for each sharing default', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()
      const recipient1 = randomUUID()
      const recipient2 = randomUUID()

      setupEncryptionForUser(db, ownerId)
      setupEncryptionForUser(db, recipient1)
      setupEncryptionForUser(db, recipient2)

      db.setSharingDefault({
        ownerId,
        recipientId: recipient1,
        entityType: 'account',
        permissions: { view: true, combine: true, reports: true },
      })
      db.setSharingDefault({
        ownerId,
        recipientId: recipient2,
        entityType: 'account',
        permissions: { view: true, combine: false, reports: true },
      })

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, ownerId)

      applyBlanketShares(db, entityType, entityId, ownerId, dek!)

      const shares = db.getSharesForEntity(entityId, entityType)
      expect(shares.length).toBe(2)

      const share1 = shares.find(s => s.recipientId === recipient1)
      const share2 = shares.find(s => s.recipientId === recipient2)
      expect(share1).toBeDefined()
      expect(share2).toBeDefined()
      expect(share1!.permissions.combine).toBe(true)
      expect(share2!.permissions.combine).toBe(false)
    })

    it('skips recipients without keys', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()
      const recipientWithKeys = randomUUID()
      const recipientWithoutKeys = randomUUID()

      setupEncryptionForUser(db, ownerId)
      setupEncryptionForUser(db, recipientWithKeys)

      db.setSharingDefault({
        ownerId,
        recipientId: recipientWithKeys,
        entityType: 'account',
        permissions: { view: true, combine: true, reports: true },
      })
      db.setSharingDefault({
        ownerId,
        recipientId: recipientWithoutKeys,
        entityType: 'account',
        permissions: { view: true, combine: true, reports: true },
      })

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, ownerId)

      applyBlanketShares(db, entityType, entityId, ownerId, dek!)

      const shares = db.getSharesForEntity(entityId, entityType)
      expect(shares.length).toBe(1)
      expect(shares[0].recipientId).toBe(recipientWithKeys)
    })

    it('creates no shares when no defaults exist', () => {
      const { db, cleanup: dbCleanup } = createTestDatabase()
      cleanup = dbCleanup
      const ownerId = randomUUID()

      setupEncryptionForUser(db, ownerId)

      const entityId = randomUUID()
      const entityType: EncryptableEntityType = 'account'
      const dek = createAndStoreDEK(db, entityType, entityId, ownerId)

      applyBlanketShares(db, entityType, entityId, ownerId, dek!)

      const shares = db.getSharesForEntity(entityId, entityType)
      expect(shares.length).toBe(0)
    })
  })
})
