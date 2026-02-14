import crypto = require('crypto');

const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha512';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const RSA_MODULUS_LENGTH = 2048;

export function deriveUEK(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

export function generateKeypair(): { publicKeyPem: string; privateKeyDer: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return { publicKeyPem: publicKey, privateKeyDer: privateKey };
}

export function encryptPrivateKey(
  privateKeyDer: Buffer,
  uek: Buffer
): { ciphertext: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, uek, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyDer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function decryptPrivateKey(
  ciphertext: string,
  iv: string,
  authTag: string,
  uek: Buffer
): crypto.KeyObject {
  const decipher = crypto.createDecipheriv(
    AES_ALGORITHM,
    uek,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return crypto.createPrivateKey({ key: decrypted, format: 'der', type: 'pkcs8' });
}

export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function wrapDEKWithUEK(
  dek: Buffer,
  uek: Buffer
): { wrappedDek: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, uek, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    wrappedDek: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export function unwrapDEKWithUEK(
  wrappedDek: string,
  iv: string,
  authTag: string,
  uek: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(
    AES_ALGORITHM,
    uek,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(wrappedDek, 'hex')),
    decipher.final(),
  ]);
}

export function wrapDEKWithRSA(dek: Buffer, publicKeyPem: string): string {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    dek
  );
  return encrypted.toString('hex');
}

export function unwrapDEKWithRSA(wrappedDek: string, privateKey: crypto.KeyObject): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(wrappedDek, 'hex')
  );
}

export function encryptField(
  plaintext: string,
  dek: Buffer
): { c: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, dek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    c: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
  };
}

export function decryptField(
  ciphertext: string,
  iv: string,
  authTag: string,
  dek: Buffer
): string {
  const decipher = crypto.createDecipheriv(
    AES_ALGORITHM,
    dek,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function encryptNumber(
  value: number,
  dek: Buffer
): { c: string; iv: string; tag: string } {
  return encryptField(String(value), dek);
}

export function decryptNumber(
  ciphertext: string,
  iv: string,
  authTag: string,
  dek: Buffer
): number {
  const decrypted = decryptField(ciphertext, iv, authTag, dek);
  return Number(decrypted);
}
