import crypto = require('crypto')
import {
  deriveUEK,
  generateKeypair,
  encryptPrivateKey,
  decryptPrivateKey,
  generateDEK,
  wrapDEKWithUEK,
  unwrapDEKWithUEK,
  wrapDEKWithRSA,
  unwrapDEKWithRSA,
  encryptField,
  decryptField,
  encryptNumber,
  decryptNumber,
} from '../crypto-engine'

describe('crypto-engine', () => {
  describe('deriveUEK', () => {
    it('derives a 32-byte key from password and salt', () => {
      const password = 'test-password'
      const salt = crypto.randomBytes(16)
      const uek = deriveUEK(password, salt)

      expect(Buffer.isBuffer(uek)).toBe(true)
      expect(uek.length).toBe(32)
    })

    it('produces the same key for the same password and salt', () => {
      const password = 'test-password'
      const salt = crypto.randomBytes(16)
      const uek1 = deriveUEK(password, salt)
      const uek2 = deriveUEK(password, salt)

      expect(uek1.equals(uek2)).toBe(true)
    })

    it('produces different keys for different salts', () => {
      const password = 'test-password'
      const salt1 = crypto.randomBytes(16)
      const salt2 = crypto.randomBytes(16)
      const uek1 = deriveUEK(password, salt1)
      const uek2 = deriveUEK(password, salt2)

      expect(uek1.equals(uek2)).toBe(false)
    })

    it('produces different keys for different passwords', () => {
      const salt = crypto.randomBytes(16)
      const uek1 = deriveUEK('password1', salt)
      const uek2 = deriveUEK('password2', salt)

      expect(uek1.equals(uek2)).toBe(false)
    })
  })

  describe('generateKeypair', () => {
    it('generates an RSA keypair', () => {
      const { publicKeyPem, privateKeyDer } = generateKeypair()

      expect(typeof publicKeyPem).toBe('string')
      expect(publicKeyPem).toContain('BEGIN PUBLIC KEY')
      expect(Buffer.isBuffer(privateKeyDer)).toBe(true)
      expect(privateKeyDer.length).toBeGreaterThan(0)
    })

    it('generates keypairs that work for RSA encryption round-trip', () => {
      const { publicKeyPem, privateKeyDer } = generateKeypair()
      const privateKey = crypto.createPrivateKey({
        key: privateKeyDer,
        format: 'der',
        type: 'pkcs8',
      })

      const plaintext = crypto.randomBytes(32)
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        plaintext
      )
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encrypted
      )

      expect(decrypted.equals(plaintext)).toBe(true)
    })

    it('generates different keypairs on each call', () => {
      const keypair1 = generateKeypair()
      const keypair2 = generateKeypair()

      expect(keypair1.publicKeyPem).not.toBe(keypair2.publicKeyPem)
      expect(keypair1.privateKeyDer.equals(keypair2.privateKeyDer)).toBe(false)
    })
  })

  describe('encryptPrivateKey and decryptPrivateKey', () => {
    it('encrypts and decrypts a private key successfully', () => {
      const { privateKeyDer } = generateKeypair()
      const uek = crypto.randomBytes(32)

      const { ciphertext, iv, authTag } = encryptPrivateKey(privateKeyDer, uek)
      const decryptedKey = decryptPrivateKey(ciphertext, iv, authTag, uek)

      expect(decryptedKey).toBeDefined()
      expect(decryptedKey.type).toBe('private')
    })

    it('round-trips private key correctly', () => {
      const { publicKeyPem, privateKeyDer } = generateKeypair()
      const uek = crypto.randomBytes(32)

      const { ciphertext, iv, authTag } = encryptPrivateKey(privateKeyDer, uek)
      const decryptedKey = decryptPrivateKey(ciphertext, iv, authTag, uek)

      const originalKey = crypto.createPrivateKey({
        key: privateKeyDer,
        format: 'der',
        type: 'pkcs8',
      })

      const testData = crypto.randomBytes(32)
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        testData
      )

      const decryptedOriginal = crypto.privateDecrypt(
        {
          key: originalKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encrypted
      )
      const decryptedRoundtrip = crypto.privateDecrypt(
        {
          key: decryptedKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encrypted
      )

      expect(decryptedRoundtrip.equals(decryptedOriginal)).toBe(true)
    })

    it('throws when decrypting with wrong UEK', () => {
      const { privateKeyDer } = generateKeypair()
      const uek = crypto.randomBytes(32)
      const wrongUEK = crypto.randomBytes(32)

      const { ciphertext, iv, authTag } = encryptPrivateKey(privateKeyDer, uek)

      expect(() => {
        decryptPrivateKey(ciphertext, iv, authTag, wrongUEK)
      }).toThrow()
    })

    it('throws when ciphertext is tampered', () => {
      const { privateKeyDer } = generateKeypair()
      const uek = crypto.randomBytes(32)

      const { ciphertext, iv, authTag } = encryptPrivateKey(privateKeyDer, uek)
      const tamperedCiphertext = ciphertext.slice(0, -4) + 'aaaa'

      expect(() => {
        decryptPrivateKey(tamperedCiphertext, iv, authTag, uek)
      }).toThrow()
    })
  })

  describe('generateDEK', () => {
    it('generates a 32-byte buffer', () => {
      const dek = generateDEK()

      expect(Buffer.isBuffer(dek)).toBe(true)
      expect(dek.length).toBe(32)
    })

    it('generates different keys on each call', () => {
      const dek1 = generateDEK()
      const dek2 = generateDEK()

      expect(dek1.equals(dek2)).toBe(false)
    })
  })

  describe('wrapDEKWithUEK and unwrapDEKWithUEK', () => {
    it('wraps and unwraps a DEK successfully', () => {
      const dek = generateDEK()
      const uek = crypto.randomBytes(32)

      const { wrappedDek, iv, authTag } = wrapDEKWithUEK(dek, uek)
      const unwrappedDek = unwrapDEKWithUEK(wrappedDek, iv, authTag, uek)

      expect(unwrappedDek.equals(dek)).toBe(true)
    })

    it('throws when unwrapping with wrong UEK', () => {
      const dek = generateDEK()
      const uek = crypto.randomBytes(32)
      const wrongUEK = crypto.randomBytes(32)

      const { wrappedDek, iv, authTag } = wrapDEKWithUEK(dek, uek)

      expect(() => {
        unwrapDEKWithUEK(wrappedDek, iv, authTag, wrongUEK)
      }).toThrow()
    })

    it('throws when wrapped DEK is tampered', () => {
      const dek = generateDEK()
      const uek = crypto.randomBytes(32)

      const { wrappedDek, iv, authTag } = wrapDEKWithUEK(dek, uek)
      const tamperedWrappedDek = wrappedDek.slice(0, -4) + 'aaaa'

      expect(() => {
        unwrapDEKWithUEK(tamperedWrappedDek, iv, authTag, uek)
      }).toThrow()
    })
  })

  describe('wrapDEKWithRSA and unwrapDEKWithRSA', () => {
    it('wraps and unwraps a DEK successfully', () => {
      const dek = generateDEK()
      const { publicKeyPem, privateKeyDer } = generateKeypair()
      const privateKey = crypto.createPrivateKey({
        key: privateKeyDer,
        format: 'der',
        type: 'pkcs8',
      })

      const wrappedDek = wrapDEKWithRSA(dek, publicKeyPem)
      const unwrappedDek = unwrapDEKWithRSA(wrappedDek, privateKey)

      expect(unwrappedDek.equals(dek)).toBe(true)
    })

    it('throws when unwrapping with wrong private key', () => {
      const dek = generateDEK()
      const { publicKeyPem } = generateKeypair()
      const { privateKeyDer: wrongPrivateKeyDer } = generateKeypair()
      const wrongPrivateKey = crypto.createPrivateKey({
        key: wrongPrivateKeyDer,
        format: 'der',
        type: 'pkcs8',
      })

      const wrappedDek = wrapDEKWithRSA(dek, publicKeyPem)

      expect(() => {
        unwrapDEKWithRSA(wrappedDek, wrongPrivateKey)
      }).toThrow()
    })
  })

  describe('encryptField and decryptField', () => {
    it('encrypts and decrypts a string successfully', () => {
      const dek = generateDEK()
      const plaintext = 'sensitive data'

      const { c, iv, tag } = encryptField(plaintext, dek)
      const decrypted = decryptField(c, iv, tag, dek)

      expect(decrypted).toBe(plaintext)
    })

    it('handles Unicode strings correctly', () => {
      const dek = generateDEK()
      const plaintext = 'Hello 世界 🌍'

      const { c, iv, tag } = encryptField(plaintext, dek)
      const decrypted = decryptField(c, iv, tag, dek)

      expect(decrypted).toBe(plaintext)
    })

    it('handles empty strings', () => {
      const dek = generateDEK()
      const plaintext = ''

      const { c, iv, tag } = encryptField(plaintext, dek)
      const decrypted = decryptField(c, iv, tag, dek)

      expect(decrypted).toBe(plaintext)
    })

    it('throws when decrypting with wrong DEK', () => {
      const dek = generateDEK()
      const wrongDEK = generateDEK()
      const plaintext = 'sensitive data'

      const { c, iv, tag } = encryptField(plaintext, dek)

      expect(() => {
        decryptField(c, iv, tag, wrongDEK)
      }).toThrow()
    })

    it('throws when ciphertext is tampered', () => {
      const dek = generateDEK()
      const plaintext = 'sensitive data'

      const { c, iv, tag } = encryptField(plaintext, dek)
      const tamperedC = c.slice(0, -4) + 'aaaa'

      expect(() => {
        decryptField(tamperedC, iv, tag, dek)
      }).toThrow()
    })
  })

  describe('encryptNumber and decryptNumber', () => {
    it('encrypts and decrypts integers successfully', () => {
      const dek = generateDEK()
      const value = 42

      const { c, iv, tag } = encryptNumber(value, dek)
      const decrypted = decryptNumber(c, iv, tag, dek)

      expect(decrypted).toBe(value)
    })

    it('encrypts and decrypts decimal numbers successfully', () => {
      const dek = generateDEK()
      const value = 123.45

      const { c, iv, tag } = encryptNumber(value, dek)
      const decrypted = decryptNumber(c, iv, tag, dek)

      expect(decrypted).toBe(value)
    })

    it('encrypts and decrypts zero successfully', () => {
      const dek = generateDEK()
      const value = 0

      const { c, iv, tag } = encryptNumber(value, dek)
      const decrypted = decryptNumber(c, iv, tag, dek)

      expect(decrypted).toBe(value)
    })

    it('encrypts and decrypts negative numbers successfully', () => {
      const dek = generateDEK()
      const value = -500

      const { c, iv, tag } = encryptNumber(value, dek)
      const decrypted = decryptNumber(c, iv, tag, dek)

      expect(decrypted).toBe(value)
    })

    it('preserves precision for currency amounts (2 decimals)', () => {
      const dek = generateDEK()
      const value = 1234.56

      const { c, iv, tag } = encryptNumber(value, dek)
      const decrypted = decryptNumber(c, iv, tag, dek)

      expect(decrypted).toBe(value)
    })

    it('throws when decrypting with wrong DEK', () => {
      const dek = generateDEK()
      const wrongDEK = generateDEK()
      const value = 12345

      const { c, iv, tag } = encryptNumber(value, dek)

      expect(() => {
        decryptNumber(c, iv, tag, wrongDEK)
      }).toThrow()
    })
  })
})
