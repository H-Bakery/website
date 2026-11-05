/**
 * Passwords, PINs and opaque tokens for the pilot auth (roadmap B3, D12).
 *
 * Dependency-free CommonJS (only `node:crypto`), like the other `*.core.js`
 * files: the TS API `require`s it, esbuild bundles it, the CLI uses it, and
 * `tests/unit/authCrypto.test.js` tests it directly.
 *
 * Secrets (password, PIN) are hashed with scrypt - no native `bcrypt` build
 * on the box. Stored format, one string per secret:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 *
 * The parameters travel with the hash, so they can be raised later without
 * invalidating existing hashes. `verifySecret` refuses parameters outside
 * sane bounds (a tampered row must not make one login burn a gigabyte).
 *
 * Opaque tokens (refresh tokens, station tokens) are 32 random bytes; only
 * their SHA-256 is stored. A slow hash buys nothing for 256 bits of entropy,
 * and the lookup needs an exact, indexable value.
 */

'use strict'

const crypto = require('crypto')

const SCRYPT_PREFIX = 'scrypt'
/** Cost parameters for new hashes: N = 2^14, r = 8, p = 1 (16 MiB, ~50 ms). */
const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1 })
const SCRYPT_KEY_LENGTH = 64
const SALT_BYTES = 16
/** Bounds `verifySecret` accepts for stored parameters. */
const MAX_N = 1 << 20
const MAX_R = 32
const MAX_P = 16

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 200
const PIN_PATTERN = /^[0-9]{4,6}$/
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/
const DISPLAY_NAME_MAX_LENGTH = 120
const ROLES = Object.freeze(['inhaber', 'verkauf', 'backstube', 'fahrer'])

const TOKEN_BYTES = 32

function scryptAsync(secret, salt, keyLength, params) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      secret,
      salt,
      keyLength,
      {
        N: params.N,
        r: params.r,
        p: params.p,
        // Node's default maxmem (32 MiB) is exactly 2 x 128*N*r for N=2^14;
        // allow headroom for raised parameters within the bounds above.
        maxmem: 256 * params.N * params.r + 1024 * 1024,
      },
      (error, key) => (error ? reject(error) : resolve(key))
    )
  })
}

/**
 * Hashes a password or PIN.
 * @param {string} secret
 * @returns {Promise<string>} `scrypt$N$r$p$salt$hash`
 */
async function hashSecret(secret, params = SCRYPT_PARAMS) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new TypeError('hashSecret: secret must be a non-empty string')
  }
  const salt = crypto.randomBytes(SALT_BYTES)
  const key = await scryptAsync(
    secret.normalize('NFC'),
    salt,
    SCRYPT_KEY_LENGTH,
    params
  )
  return [
    SCRYPT_PREFIX,
    params.N,
    params.r,
    params.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0
}

/**
 * Parses a stored hash. `null` for anything that is not a well-formed scrypt
 * hash within the bounds (legacy markers like `!legacy-user-disabled`,
 * truncated strings, absurd parameters).
 */
function parseHash(stored) {
  if (typeof stored !== 'string') return null
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== SCRYPT_PREFIX) return null
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts
  if (![nRaw, rRaw, pRaw].every((v) => /^[0-9]+$/.test(v))) return null
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!isPowerOfTwo(N) || N > MAX_N) return null
  if (r < 1 || r > MAX_R || p < 1 || p > MAX_P) return null
  if (!/^[A-Za-z0-9_-]+$/.test(saltRaw) || !/^[A-Za-z0-9_-]+$/.test(hashRaw)) {
    return null
  }
  const salt = Buffer.from(saltRaw, 'base64url')
  const hash = Buffer.from(hashRaw, 'base64url')
  if (salt.length < 8 || hash.length < 16) return null
  return { N, r, p, salt, hash }
}

/** A valid hash of nothing anyone knows, for constant-time misses. */
let dummyHashPromise = null
function dummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashSecret(crypto.randomBytes(18).toString('base64url'))
  }
  return dummyHashPromise
}

/**
 * Checks a secret against a stored hash in constant time.
 *
 * With `stored` null/undefined or malformed (unknown user, user without PIN,
 * legacy marker) it still runs one scrypt against a dummy hash, so the
 * answer takes as long as a real miss and does not reveal which users exist.
 *
 * @returns {Promise<boolean>}
 */
async function verifySecret(secret, stored) {
  const parsed = parseHash(stored)
  const target = parsed || parseHash(await dummyHash())
  const candidate = typeof secret === 'string' ? secret.normalize('NFC') : ''
  const key = await scryptAsync(candidate, target.salt, target.hash.length, {
    N: target.N,
    r: target.r,
    p: target.p,
  })
  const equal = crypto.timingSafeEqual(key, target.hash)
  return Boolean(parsed) && typeof secret === 'string' && equal
}

/** True when the hash uses weaker parameters than the current ones. */
function needsRehash(stored) {
  const parsed = parseHash(stored)
  if (!parsed) return true
  return (
    parsed.N < SCRYPT_PARAMS.N ||
    parsed.r < SCRYPT_PARAMS.r ||
    parsed.p < SCRYPT_PARAMS.p
  )
}

// ------------------------------------------------------------- validation

/**
 * @returns {string|null} German error text, or null when the password is ok.
 */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Bitte ein Passwort angeben.'
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Das Passwort darf höchstens ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`
  }
  if (password.trim().length === 0) {
    return 'Das Passwort darf nicht nur aus Leerzeichen bestehen.'
  }
  return null
}

/** PIN = 4 to 6 digits, as a string (leading zeros count). */
function validatePin(pin) {
  if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
    return 'Die PIN muss aus 4 bis 6 Ziffern bestehen.'
  }
  return null
}

/** Usernames are compared and stored lower-case, without surrounding spaces. */
function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : ''
}

function validateUsername(username) {
  const value = normalizeUsername(username)
  if (!USERNAME_PATTERN.test(value)) {
    return 'Der Benutzername muss 2 bis 64 Zeichen lang sein: Kleinbuchstaben, Ziffern, Punkt, Binde- oder Unterstrich, am Anfang ein Buchstabe oder eine Ziffer.'
  }
  return null
}

function normalizeDisplayName(displayName) {
  return typeof displayName === 'string'
    ? displayName.trim().replace(/\s+/g, ' ')
    : ''
}

function validateDisplayName(displayName) {
  const value = normalizeDisplayName(displayName)
  if (value.length === 0) return 'Bitte einen Anzeigenamen angeben.'
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Der Anzeigename darf höchstens ${DISPLAY_NAME_MAX_LENGTH} Zeichen lang sein.`
  }
  return null
}

function validateRole(role) {
  if (!ROLES.includes(role)) {
    return `Unbekannte Rolle. Erlaubt: ${ROLES.join(', ')}.`
  }
  return null
}

/**
 * `inhaber` passes every role check; everyone else needs one of `allowed`.
 */
function roleAllows(role, allowed) {
  if (role === 'inhaber') return true
  return Array.isArray(allowed) && allowed.includes(role)
}

// ----------------------------------------------------------------- tokens

/** A new opaque token: 32 random bytes, base64url, with a readable prefix. */
function generateToken(prefix = '') {
  return prefix + crypto.randomBytes(TOKEN_BYTES).toString('base64url')
}

/** SHA-256 (hex) of an opaque token - what the database stores. */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex')
}

module.exports = {
  SCRYPT_PARAMS,
  SCRYPT_KEY_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  ROLES,
  hashSecret,
  verifySecret,
  parseHash,
  needsRehash,
  validatePassword,
  validatePin,
  validateUsername,
  normalizeUsername,
  validateDisplayName,
  normalizeDisplayName,
  validateRole,
  roleAllows,
  generateToken,
  hashToken,
}
