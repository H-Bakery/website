/**
 * auth-crypto.core.js (B3, D12): scrypt for passwords and PINs, opaque
 * tokens, input validation. Synthetic secrets only.
 */
const crypto = require('crypto')
const core = require('../../src/services/auth-crypto.core')

jest.setTimeout(20000)

describe('hashSecret / verifySecret', () => {
  test('hash format carries the parameters and a random salt', async () => {
    const a = await core.hashSecret('Teig-Probe-2026')
    const b = await core.hashSecret('Teig-Probe-2026')
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
    expect(a).not.toBe(b) // salt
    const parsed = core.parseHash(a)
    expect(parsed.salt.length).toBe(16)
    expect(parsed.hash.length).toBe(core.SCRYPT_KEY_LENGTH)
  })

  test('verifies the right secret and rejects a wrong one', async () => {
    const stored = await core.hashSecret('Teig-Probe-2026')
    await expect(core.verifySecret('Teig-Probe-2026', stored)).resolves.toBe(
      true
    )
    await expect(core.verifySecret('teig-probe-2026', stored)).resolves.toBe(
      false
    )
    await expect(core.verifySecret('', stored)).resolves.toBe(false)
    await expect(core.verifySecret(undefined, stored)).resolves.toBe(false)
    await expect(core.verifySecret(1234, stored)).resolves.toBe(false)
  })

  test('PINs keep leading zeros', async () => {
    const stored = await core.hashSecret('0042')
    await expect(core.verifySecret('0042', stored)).resolves.toBe(true)
    await expect(core.verifySecret('42', stored)).resolves.toBe(false)
  })

  test('unicode is normalised (NFC) on both sides', async () => {
    const composed = 'Brötchen-123'
    const decomposed = 'Brötchen-123'
    const stored = await core.hashSecret(decomposed)
    await expect(core.verifySecret(composed, stored)).resolves.toBe(true)
  })

  test('missing or malformed hashes never verify, and still cost one scrypt', async () => {
    const spy = jest.spyOn(crypto, 'scrypt')
    for (const stored of [
      null,
      undefined,
      '',
      '!legacy-user-disabled',
      'scrypt$16384$8$1$abc',
      'bcrypt$2b$10$xxxxxxxxxxxxxxxxxxxxxx',
    ]) {
      spy.mockClear()
      await expect(core.verifySecret('irgendwas', stored)).resolves.toBe(false)
      expect(spy).toHaveBeenCalled()
    }
    spy.mockRestore()
  })

  test('rejects parameters outside the bounds (tampered rows)', () => {
    const salt = Buffer.alloc(16, 1).toString('base64url')
    const hash = Buffer.alloc(64, 2).toString('base64url')
    expect(core.parseHash(`scrypt$16384$8$1$${salt}$${hash}`)).not.toBeNull()
    expect(core.parseHash(`scrypt$${2 ** 24}$8$1$${salt}$${hash}`)).toBeNull()
    expect(core.parseHash(`scrypt$1000$8$1$${salt}$${hash}`)).toBeNull()
    expect(core.parseHash(`scrypt$16384$99$1$${salt}$${hash}`)).toBeNull()
    expect(core.parseHash(`scrypt$16384$8$0$${salt}$${hash}`)).toBeNull()
    expect(core.parseHash(`scrypt$16384$8$1$${salt}$!!`)).toBeNull()
    expect(core.parseHash(`scrypt$16384$8$1$$${hash}`)).toBeNull()
  })

  test('verifies hashes made with other (bounded) parameters', async () => {
    const stored = await core.hashSecret('Sauerteig-77', {
      N: 1024,
      r: 8,
      p: 1,
    })
    expect(stored.startsWith('scrypt$1024$8$1$')).toBe(true)
    await expect(core.verifySecret('Sauerteig-77', stored)).resolves.toBe(true)
    expect(core.needsRehash(stored)).toBe(true)
    expect(core.needsRehash(await core.hashSecret('x1234567'))).toBe(false)
  })

  test('refuses to hash an empty secret', async () => {
    await expect(core.hashSecret('')).rejects.toThrow(TypeError)
    await expect(core.hashSecret(null)).rejects.toThrow(TypeError)
  })
})

describe('validation', () => {
  test('password: 8-200 characters, not only spaces', () => {
    expect(core.validatePassword('12345678')).toBeNull()
    expect(core.validatePassword('1234567')).toMatch(/mindestens 8/)
    expect(core.validatePassword('x'.repeat(201))).toMatch(/höchstens/)
    expect(core.validatePassword('        ')).toMatch(/Leerzeichen/)
    expect(core.validatePassword(undefined)).toMatch(/Passwort/)
    expect(core.validatePassword(12345678)).toMatch(/Passwort/)
  })

  test('PIN: 4-6 digits as a string', () => {
    for (const ok of ['0000', '1234', '12345', '123456']) {
      expect(core.validatePin(ok)).toBeNull()
    }
    for (const bad of ['123', '1234567', '12a4', ' 1234', 1234, null, '']) {
      expect(core.validatePin(bad)).toMatch(/4 bis 6 Ziffern/)
    }
  })

  test('user id: one canonical spelling per user (PIN rate-limit key)', () => {
    expect(core.parseUserId(2)).toBe(2)
    expect(core.parseUserId('2')).toBe(2)
    expect(core.parseUserId('1234567890')).toBe(1234567890)
    for (const bad of [
      '02',
      '002',
      '00002',
      ' 2',
      '2 ',
      '2.0',
      '2e0',
      '0x2',
      '+2',
      '0',
      '-2',
      '',
      '12345678901',
      0,
      -2,
      2.5,
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
      Infinity,
      null,
      undefined,
      true,
      [2],
      { id: 2 },
    ]) {
      expect(core.parseUserId(bad)).toBeNull()
    }
  })

  test('username is normalised to lower case and restricted', () => {
    expect(core.normalizeUsername('  Anna.B ')).toBe('anna.b')
    expect(core.validateUsername('Anna.B')).toBeNull()
    expect(core.validateUsername('a')).not.toBeNull()
    expect(core.validateUsername('.anna')).not.toBeNull()
    expect(core.validateUsername('anna b')).not.toBeNull()
    expect(core.validateUsername('x'.repeat(65))).not.toBeNull()
    expect(core.validateUsername(undefined)).not.toBeNull()
  })

  test('display name is trimmed and limited', () => {
    expect(core.normalizeDisplayName('  Test   Verkauf ')).toBe('Test Verkauf')
    expect(core.validateDisplayName('   ')).toMatch(/Anzeigenamen/)
    expect(core.validateDisplayName('x'.repeat(121))).toMatch(/höchstens/)
  })

  test('roles and the inhaber rule', () => {
    expect(core.validateRole('verkauf')).toBeNull()
    expect(core.validateRole('admin')).toMatch(/Unbekannte Rolle/)
    expect(core.roleAllows('inhaber', ['backstube'])).toBe(true)
    expect(core.roleAllows('inhaber', [])).toBe(true)
    expect(core.roleAllows('backstube', ['backstube', 'verkauf'])).toBe(true)
    expect(core.roleAllows('fahrer', ['backstube'])).toBe(false)
    expect(core.roleAllows('fahrer', undefined)).toBe(false)
  })
})

describe('opaque tokens', () => {
  test('random, prefixed, 256 bits', () => {
    const a = core.generateToken('rt_')
    const b = core.generateToken('rt_')
    expect(a).toMatch(/^rt_[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })

  test('stored as SHA-256 hex', () => {
    expect(core.hashToken('st_abc')).toBe(
      crypto.createHash('sha256').update('st_abc').digest('hex')
    )
    expect(core.hashToken('st_abc')).toHaveLength(64)
  })
})
