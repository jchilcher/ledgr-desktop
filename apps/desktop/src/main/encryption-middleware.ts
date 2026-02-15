import { BudgetDatabase } from './database';
import {
  generateDEK,
  wrapDEKWithUEK,
  unwrapDEKWithUEK,
  wrapDEKWithRSA,
  unwrapDEKWithRSA,
  encryptField,
  decryptField,
  encryptNumber,
  decryptNumber,
} from './crypto-engine';
import { sessionKeys } from './session-keys';
import type { EncryptableEntityType } from '../shared/types';

const SENSITIVE_FIELDS: Record<string, { text: string[]; number: string[] }> = {
  account: { text: ['name', 'institution'], number: ['balance'] },
  recurring_item: { text: ['description'], number: ['amount'] },
  savings_goal: { text: ['name'], number: ['targetAmount', 'currentAmount'] },
  manual_asset: { text: ['name', 'notes'], number: ['value'] },
  manual_liability: { text: ['name', 'notes'], number: ['balance', 'monthlyPayment'] },
  investment_account: { text: ['name', 'institution'], number: [] },
  transaction: { text: ['description', 'notes'], number: ['amount'] },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encryptEntityFields(entityType: string, data: Record<string, any>, dek: Buffer): Record<string, any> {
  const fields = SENSITIVE_FIELDS[entityType];
  if (!fields) return data;

  const result = { ...data };

  for (const field of fields.text) {
    if (result[field] != null && typeof result[field] === 'string' && result[field] !== '') {
      const envelope = encryptField(result[field], dek);
      result[field] = JSON.stringify(envelope);
    }
  }

  for (const field of fields.number) {
    if (result[field] != null && typeof result[field] === 'number') {
      const envelope = encryptNumber(result[field], dek);
      result[field] = JSON.stringify(envelope);
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptEntityFields(entityType: string, data: Record<string, any>, dek: Buffer): Record<string, any> {
  const fields = SENSITIVE_FIELDS[entityType];
  if (!fields) return data;

  const result = { ...data };

  for (const field of fields.text) {
    if (result[field] != null && typeof result[field] === 'string') {
      try {
        const envelope = JSON.parse(result[field]);
        if (envelope && envelope.c && envelope.iv && envelope.tag) {
          result[field] = decryptField(envelope.c, envelope.iv, envelope.tag, dek);
        }
      } catch {
        console.warn(`[Encryption] Failed to decrypt ${entityType}.${field}, defaulting to ''`);
        result[field] = '';
      }
    }
  }

  for (const field of fields.number) {
    if (result[field] != null && typeof result[field] === 'string') {
      try {
        const envelope = JSON.parse(result[field]);
        if (envelope && envelope.c && envelope.iv && envelope.tag) {
          result[field] = decryptNumber(envelope.c, envelope.iv, envelope.tag, dek);
        }
      } catch {
        console.warn(`[Encryption] Failed to decrypt ${entityType}.${field}, defaulting to 0`);
        result[field] = 0;
      }
    }
  }

  return result;
}

export function getDecryptionDEK(
  db: BudgetDatabase,
  entityType: EncryptableEntityType,
  entityId: string,
  ownerId: string,
  currentUserId: string
): Buffer | null {
  // Try direct ownership first — owner's session has UEK to unwrap DEK
  if (ownerId === currentUserId) {
    const session = sessionKeys.getSession(currentUserId);
    if (!session) return null;

    const dekRecord = db.getDEK(entityId, entityType);
    if (!dekRecord) return null;

    try {
      return unwrapDEKWithUEK(dekRecord.wrappedDek, dekRecord.dekIv, dekRecord.dekTag, session.uek);
    } catch {
      return null;
    }
  }

  // Try shared access — recipient has the DEK wrapped with their RSA public key
  const session = sessionKeys.getSession(currentUserId);
  if (!session) return null;

  const shares = db.getSharesForEntity(entityId, entityType);
  const myShare = shares.find(s => s.recipientId === currentUserId);
  if (!myShare) return null;

  try {
    return unwrapDEKWithRSA(myShare.wrappedDek, session.privateKey);
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptEntityList(
  db: BudgetDatabase,
  entityType: EncryptableEntityType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[],
  currentUserId: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  if (!currentUserId) {
    // No current user — return only unencrypted items
    return items.filter(item => !item.isEncrypted);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = [];

  for (const item of items) {
    if (!item.isEncrypted) {
      result.push(item);
      continue;
    }

    const ownerId = item.ownerId;
    if (!ownerId) {
      // Encrypted but no owner — skip (shouldn't happen)
      continue;
    }

    const dek = getDecryptionDEK(db, entityType, item.id, ownerId, currentUserId);
    if (dek) {
      result.push(decryptEntityFields(entityType, item, dek));
    } else {
      console.warn(`[Encryption] Could not get DEK for ${entityType} ${item.id}, excluding from results`);
    }
  }

  return result;
}

export function applyBlanketShares(
  db: BudgetDatabase,
  entityType: EncryptableEntityType,
  entityId: string,
  ownerId: string,
  dek: Buffer
): void {
  const defaults = db.getSharingDefaults(ownerId, entityType);

  for (const sd of defaults) {
    // Get recipient's public key to wrap the DEK for them
    const recipientKeys = db.getUserKeys(sd.recipientId);
    if (!recipientKeys) continue;

    const wrappedDek = wrapDEKWithRSA(dek, recipientKeys.publicKey);

    db.createShare({
      entityId,
      entityType,
      ownerId,
      recipientId: sd.recipientId,
      wrappedDek,
      permissions: sd.permissions,
    });
  }
}

export function createAndStoreDEK(
  db: BudgetDatabase,
  entityType: EncryptableEntityType,
  entityId: string,
  ownerId: string
): Buffer | null {
  const session = sessionKeys.getSession(ownerId);
  if (!session) return null;

  const dek = generateDEK();
  const wrapped = wrapDEKWithUEK(dek, session.uek);

  db.setDEK({
    id: entityId,
    entityType,
    ownerId,
    wrappedDek: wrapped.wrappedDek,
    dekIv: wrapped.iv,
    dekTag: wrapped.authTag,
  });

  return dek;
}
