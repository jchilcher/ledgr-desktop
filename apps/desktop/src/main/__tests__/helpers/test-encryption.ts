import { randomUUID } from 'crypto'
import type { BudgetDatabase } from '../../database'
import {
  deriveUEK,
  generateKeypair,
  encryptPrivateKey,
  generateDEK,
  wrapDEKWithUEK,
  wrapDEKWithRSA,
} from '../../crypto-engine'
import { sessionKeys } from '../../session-keys'
import { encryptEntityFields } from '../../encryption-middleware'
import type { EncryptableEntityType } from '../../../shared/types'
import crypto = require('crypto')

export interface EncryptionContext {
  uek: Buffer
  publicKeyPem: string
  privateKey: crypto.KeyObject
}

export function setupEncryptionForUser(
  db: BudgetDatabase,
  userId: string,
  password: string = 'test-password'
): EncryptionContext {
  // Ensure user exists in the database (required by FK constraint on user_keys)
  try {
    const existingUser = db.getUserById(userId)
    if (!existingUser) {
      db.createUser(`Test User ${userId.slice(0, 8)}`, '#FF5733')
      // createUser generates its own id, so we need to use raw SQL to insert with specific userId
      // Actually, let's just try a raw insert if getUserById doesn't find them
      const users = db.getUsers()
      const lastUser = users[users.length - 1]
      if (lastUser && lastUser.id !== userId) {
        // The createUser generates its own UUID, we need to insert with our specific userId
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).driver.run(
            'INSERT OR IGNORE INTO users (id, name, color, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
            [userId, `Test User ${userId.slice(0, 8)}`, '#FF5733', 0, Date.now()]
          )
        } catch { /* ignore if already exists */ }
      }
    }
  } catch {
    // If getUserById doesn't exist or fails, try raw insert
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).driver.run(
        'INSERT OR IGNORE INTO users (id, name, color, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
        [userId, `Test User ${userId.slice(0, 8)}`, '#FF5733', 0, Date.now()]
      )
    } catch { /* ignore */ }
  }

  const salt = Buffer.from(randomUUID().replace(/-/g, ''), 'hex')
  const uek = deriveUEK(password, salt)

  const { publicKeyPem, privateKeyDer } = generateKeypair()
  const { ciphertext, iv, authTag } = encryptPrivateKey(privateKeyDer, uek)

  db.setUserKeys({
    userId,
    encryptionSalt: salt.toString('hex'),
    publicKey: publicKeyPem,
    encryptedPrivateKey: ciphertext,
    privateKeyIv: iv,
    privateKeyTag: authTag,
    createdAt: new Date(),
  })

  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  })

  sessionKeys.setSession(userId, uek, privateKey)

  return { uek, publicKeyPem, privateKey }
}

export function encryptAndStore(
  db: BudgetDatabase,
  entityType: EncryptableEntityType,
  entityId: string,
  ownerId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const session = sessionKeys.getSession(ownerId)
  if (!session) {
    throw new Error(`No session found for user ${ownerId}`)
  }

  const dek = generateDEK()

  const { wrappedDek, iv, authTag } = wrapDEKWithUEK(dek, session.uek)

  db.setDEK({
    id: entityId,
    entityType,
    ownerId,
    wrappedDek,
    dekIv: iv,
    dekTag: authTag,
  })

  const encryptedData = encryptEntityFields(entityType, data, dek)

  return encryptedData
}

export function setupSharedAccess(
  db: BudgetDatabase,
  entityId: string,
  entityType: EncryptableEntityType,
  ownerId: string,
  recipientId: string
): void {
  const ownerSession = sessionKeys.getSession(ownerId)
  if (!ownerSession) {
    throw new Error(`No session found for owner ${ownerId}`)
  }

  const dekRecord = db.getDEK(entityId, entityType)
  if (!dekRecord) {
    throw new Error(`No DEK found for entity ${entityId} (${entityType})`)
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dek = require('../../crypto-engine').unwrapDEKWithUEK(
    dekRecord.wrappedDek,
    dekRecord.dekIv,
    dekRecord.dekTag,
    ownerSession.uek
  )

  const recipientKeys = db.getUserKeys(recipientId)
  if (!recipientKeys) {
    throw new Error(`No keys found for recipient ${recipientId}`)
  }

  const wrappedDekForRecipient = wrapDEKWithRSA(dek, recipientKeys.publicKey)

  db.createShare({
    entityId,
    entityType,
    ownerId,
    recipientId,
    wrappedDek: wrappedDekForRecipient,
    permissions: {
      view: true,
      combine: true,
      reports: true,
    },
  })
}
