/**
 * Server configuration, read once from the environment.
 *
 * `loadEnvFile()` must run before anything reads `process.env` (B3's auth
 * service reads `JWT_SECRET` in `createApp()`). `main.ts` therefore imports
 * `./config/load-env` first; the CLI calls `loadEnvFile()` itself.
 */
import * as fs from 'fs'
import * as path from 'path'

export interface ServerConfig {
  nodeEnv: string
  isProduction: boolean
  port: number
  /**
   * Interface to listen on (`HOST`, e.g. `127.0.0.1` on the box behind Caddy).
   * Undefined = Node's default, all interfaces.
   */
  host: string | undefined
  /** Absolute path of the SQLite file, or `:memory:`. */
  dbPath: string
  /** Milliseconds a connection waits for a lock before SQLITE_BUSY. */
  dbBusyTimeoutMs: number
  /** Log every SQL statement (`DB_LOG_SQL=true`). */
  dbLogSql: boolean
  corsOrigins: string[]
  /**
   * Express `trust proxy` (`TRUST_PROXY`, default `loopback`): which hops may
   * set `X-Forwarded-For`. Decides `req.ip`, which the login rate limit keys on.
   */
  trustProxy: boolean | number | string
  /**
   * hq read clone paths (B4): `HQ_REPORTS_DIR` (holds `converted/`) and
   * `HQ_FINANCE_DIR`, resolved against `cwd`. Undefined = the modules'
   * default `<website>/../hq/data/{reports,finance}`.
   */
  hqReportsDir: string | undefined
  hqFinanceDir: string | undefined
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Default relative to the working directory - only allowed outside production. */
export const DEFAULT_DB_PATH = './data/bakery.db'
export const DEFAULT_PORT = 5000
export const DEFAULT_BUSY_TIMEOUT_MS = 5000
export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4201', // bakery-management
  'http://localhost:4200', // bakery-shop
  'http://localhost:3000', // bakery-landing
]

const DEV_JWT_SECRET =
  'dev-jwt-secret-do-not-use-in-production-minimum-32-chars'

/**
 * Loads `.env` from the working directory if there is one. Variables that are
 * already set (systemd `EnvironmentFile`, the shell) win over the file.
 */
export function loadEnvFile(cwd: string = process.cwd()): string | null {
  const file = path.join(cwd, '.env')
  if (!fs.existsSync(file)) return null
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void })
    .loadEnvFile
  if (typeof loader !== 'function') return null
  loader(file)
  return file
}

/**
 * JWT secret policy. Production refuses to start without a real secret
 * (at least 32 characters, not the development default); in development a
 * fixed default keeps tokens valid across restarts. The auth service (B3)
 * refuses secrets shorter than 32 characters in every environment.
 */
export function ensureJwtSecret(env: NodeJS.ProcessEnv = process.env): void {
  const isProduction = env['NODE_ENV'] === 'production'
  const secret = env['JWT_SECRET']
  if (!secret) {
    if (isProduction) {
      throw new ConfigError(
        'JWT_SECRET is not set. Refusing to start in production without it.'
      )
    }
    console.warn(
      '[WARN] JWT_SECRET not set - using the development default. Never in production.'
    )
    env['JWT_SECRET'] = DEV_JWT_SECRET
    return
  }
  if (isProduction && (secret.length < 32 || secret === DEV_JWT_SECRET)) {
    throw new ConfigError(
      'JWT_SECRET must be at least 32 characters and not the development default in production.'
    )
  }
  if (secret.length < 32) {
    throw new ConfigError('JWT_SECRET must be at least 32 characters long.')
  }
}

export function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_PORT
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`PORT must be an integer 1-65535, got "${raw}".`)
  }
  return port
}

function parsePositiveInt(
  name: string,
  raw: string | undefined,
  fallback: number
): number {
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new ConfigError(
      `${name} must be a non-negative integer, got "${raw}".`
    )
  }
  return value
}

/**
 * `DB_PATH`: absolute path in production (required); in development it
 * defaults to `./data/bakery.db` and relative paths resolve against `cwd`.
 */
export function resolveDbPath(
  raw: string | undefined,
  isProduction: boolean,
  cwd: string = process.cwd()
): string {
  const value = raw && raw.trim() !== '' ? raw.trim() : undefined
  if (isProduction) {
    if (!value) {
      throw new ConfigError(
        'DB_PATH is required in production (absolute path, e.g. /var/lib/bakery/bakery.db).'
      )
    }
    if (value === ':memory:') {
      throw new ConfigError(
        'DB_PATH=:memory: is not allowed in production - every record would be lost on restart.'
      )
    }
    if (!path.isAbsolute(value)) {
      throw new ConfigError(
        `DB_PATH must be absolute in production, got "${value}".`
      )
    }
    // Sequelize would create missing directories and an empty database, so
    // a typo in the path would start silently on a blank DB.
    const dir = path.dirname(value)
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new ConfigError(
        `The directory of DB_PATH does not exist in production: "${dir}".`
      )
    }
    return value
  }
  if (value === ':memory:') return value
  return path.resolve(cwd, value ?? DEFAULT_DB_PATH)
}

/**
 * `TRUST_PROXY`: unset → `loopback` (Caddy on the same box); `false`/`0` →
 * trust nobody; a number → that many hops; anything else is passed to
 * Express as is (e.g. `loopback, 10.0.0.0/8`).
 */
export function parseTrustProxy(
  raw: string | undefined
): boolean | number | string {
  const value = raw?.trim()
  if (!value) return 'loopback'
  if (value === 'false' || value === '0') return false
  if (value === 'true') {
    throw new ConfigError(
      'TRUST_PROXY=true would let every client fake its IP (and dodge the login rate limit). Use "loopback" or a hop count.'
    )
  }
  if (/^[0-9]+$/.test(value)) return Number(value)
  return value
}

/** Optional directory variable: trimmed, resolved against `cwd`, '' = unset. */
export function resolveOptionalDir(
  raw: string | undefined,
  cwd: string = process.cwd()
): string | undefined {
  const value = raw?.trim()
  return value ? path.resolve(cwd, value) : undefined
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): ServerConfig {
  const nodeEnv = env['NODE_ENV'] || 'development'
  const isProduction = nodeEnv === 'production'
  const corsOrigins = env['CORS_ORIGIN']
    ? env['CORS_ORIGIN']
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_CORS_ORIGINS

  return {
    nodeEnv,
    isProduction,
    port: parsePort(env['PORT']),
    host: env['HOST']?.trim() || undefined,
    dbPath: resolveDbPath(env['DB_PATH'], isProduction, cwd),
    dbBusyTimeoutMs: parsePositiveInt(
      'DB_BUSY_TIMEOUT_MS',
      env['DB_BUSY_TIMEOUT_MS'],
      DEFAULT_BUSY_TIMEOUT_MS
    ),
    dbLogSql: env['DB_LOG_SQL'] === 'true',
    corsOrigins,
    trustProxy: parseTrustProxy(env['TRUST_PROXY']),
    hqReportsDir: resolveOptionalDir(env['HQ_REPORTS_DIR'], cwd),
    hqFinanceDir: resolveOptionalDir(env['HQ_FINANCE_DIR'], cwd),
  }
}
