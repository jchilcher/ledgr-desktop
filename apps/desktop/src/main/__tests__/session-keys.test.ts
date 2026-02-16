import crypto = require('crypto')
import { sessionKeys } from '../session-keys'

describe('session-keys', () => {
  afterEach(() => {
    sessionKeys.clearAll()
  })

  describe('setSession and getSession', () => {
    it('stores and retrieves session data', () => {
      const userId = 'user-1'
      const uek = crypto.randomBytes(32)
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8',
      })

      sessionKeys.setSession(userId, uek, privateKeyObj)
      const session = sessionKeys.getSession(userId)

      expect(session).not.toBeNull()
      expect(session!.uek.equals(uek)).toBe(true)
      expect(session!.privateKey).toBe(privateKeyObj)
    })

    it('returns null for non-existent user', () => {
      const session = sessionKeys.getSession('non-existent-user')

      expect(session).toBeNull()
    })

    it('isolates sessions for different users', () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const uek1 = crypto.randomBytes(32)
      const uek2 = crypto.randomBytes(32)
      const { privateKey: pk1 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const { privateKey: pk2 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKey1 = crypto.createPrivateKey({ key: pk1, format: 'der', type: 'pkcs8' })
      const privateKey2 = crypto.createPrivateKey({ key: pk2, format: 'der', type: 'pkcs8' })

      sessionKeys.setSession(user1, uek1, privateKey1)
      sessionKeys.setSession(user2, uek2, privateKey2)

      const session1 = sessionKeys.getSession(user1)
      const session2 = sessionKeys.getSession(user2)

      expect(session1!.uek.equals(uek1)).toBe(true)
      expect(session2!.uek.equals(uek2)).toBe(true)
      expect(session1!.privateKey).toBe(privateKey1)
      expect(session2!.privateKey).toBe(privateKey2)
    })

    it('overwrites existing session when setSession is called again', () => {
      const userId = 'user-1'
      const uek1 = crypto.randomBytes(32)
      const uek2 = crypto.randomBytes(32)
      const { privateKey: pk1 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const { privateKey: pk2 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKey1 = crypto.createPrivateKey({ key: pk1, format: 'der', type: 'pkcs8' })
      const privateKey2 = crypto.createPrivateKey({ key: pk2, format: 'der', type: 'pkcs8' })

      sessionKeys.setSession(userId, uek1, privateKey1)
      sessionKeys.setSession(userId, uek2, privateKey2)

      const session = sessionKeys.getSession(userId)

      expect(session!.uek.equals(uek2)).toBe(true)
      expect(session!.privateKey).toBe(privateKey2)
    })
  })

  describe('hasSession', () => {
    it('returns true for users with sessions', () => {
      const userId = 'user-1'
      const uek = crypto.randomBytes(32)
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8',
      })

      sessionKeys.setSession(userId, uek, privateKeyObj)

      expect(sessionKeys.hasSession(userId)).toBe(true)
    })

    it('returns false for users without sessions', () => {
      expect(sessionKeys.hasSession('non-existent-user')).toBe(false)
    })
  })

  describe('clearSession', () => {
    it('zeroes the UEK buffer', () => {
      const userId = 'user-1'
      const uek = crypto.randomBytes(32)
      const originalBytes = Buffer.from(uek)
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8',
      })

      sessionKeys.setSession(userId, uek, privateKeyObj)
      sessionKeys.clearSession(userId)

      const allZeros = uek.every(byte => byte === 0)
      expect(allZeros).toBe(true)
      expect(uek.equals(originalBytes)).toBe(false)
    })

    it('removes session from map', () => {
      const userId = 'user-1'
      const uek = crypto.randomBytes(32)
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKeyObj = crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8',
      })

      sessionKeys.setSession(userId, uek, privateKeyObj)
      sessionKeys.clearSession(userId)

      expect(sessionKeys.hasSession(userId)).toBe(false)
      expect(sessionKeys.getSession(userId)).toBeNull()
    })

    it('does nothing when clearing non-existent session', () => {
      expect(() => {
        sessionKeys.clearSession('non-existent-user')
      }).not.toThrow()
    })
  })

  describe('clearAll', () => {
    it('clears all sessions', () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const uek1 = crypto.randomBytes(32)
      const uek2 = crypto.randomBytes(32)
      const { privateKey: pk1 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const { privateKey: pk2 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKey1 = crypto.createPrivateKey({ key: pk1, format: 'der', type: 'pkcs8' })
      const privateKey2 = crypto.createPrivateKey({ key: pk2, format: 'der', type: 'pkcs8' })

      sessionKeys.setSession(user1, uek1, privateKey1)
      sessionKeys.setSession(user2, uek2, privateKey2)
      sessionKeys.clearAll()

      expect(sessionKeys.hasSession(user1)).toBe(false)
      expect(sessionKeys.hasSession(user2)).toBe(false)
      expect(sessionKeys.getSession(user1)).toBeNull()
      expect(sessionKeys.getSession(user2)).toBeNull()
    })

    it('zeroes all UEK buffers', () => {
      const user1 = 'user-1'
      const user2 = 'user-2'
      const uek1 = crypto.randomBytes(32)
      const uek2 = crypto.randomBytes(32)
      const { privateKey: pk1 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const { privateKey: pk2 } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      })
      const privateKey1 = crypto.createPrivateKey({ key: pk1, format: 'der', type: 'pkcs8' })
      const privateKey2 = crypto.createPrivateKey({ key: pk2, format: 'der', type: 'pkcs8' })

      sessionKeys.setSession(user1, uek1, privateKey1)
      sessionKeys.setSession(user2, uek2, privateKey2)
      sessionKeys.clearAll()

      expect(uek1.every(byte => byte === 0)).toBe(true)
      expect(uek2.every(byte => byte === 0)).toBe(true)
    })

    it('does nothing when no sessions exist', () => {
      expect(() => {
        sessionKeys.clearAll()
      }).not.toThrow()
    })
  })
})
