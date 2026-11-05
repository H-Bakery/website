/**
 * B3 accounts outside HTTP: the idempotent `create-user` CLI (src/cli.ts,
 * run against a temp SQLite file) and the development bootstrap admin.
 * Synthetic users only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { main, parseArgs } from '../../src/cli'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import { AuditLog, AuthSession, User, initializeModels } from '../../src/models'
import { bootstrapAdmin } from '../../src/auth/users.service'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../../src/services/auth-crypto.core')

jest.setTimeout(30000)

let dir: string
const savedEnv = { ...process.env }

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b3-cli-'))
  process.env['DB_PATH'] = path.join(dir, 'cli.db')
  delete process.env['CREATE_USER_PIN']
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
  process.env = { ...savedEnv }
  fs.rmSync(dir, { recursive: true, force: true })
})

async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  const { sequelize } = await openDatabase({ storage: process.env['DB_PATH']! })
  try {
    await runMigrations(sequelize, { log: () => undefined })
    await initializeModels(sequelize)
    return await fn()
  } finally {
    await sequelize.close()
  }
}

const args = (username: string, role = 'verkauf', name = 'Test Laden') => [
  'create-user',
  '--username',
  username,
  '--display-name',
  name,
  '--role',
  role,
]

describe('create-user CLI', () => {
  it('creates a user on a fresh database (migrating it first)', async () => {
    process.env['CREATE_USER_PASSWORD'] = 'Erstes-Passwort-1'
    process.env['CREATE_USER_PIN'] = '0042'
    expect(await main(args('Test.Cli'))).toBe(0)

    await withDb(async () => {
      const user = await User.scope('withSecrets').findOne({
        where: { username: 'test.cli' },
      })
      expect(user).toMatchObject({
        displayName: 'Test Laden',
        role: 'verkauf',
        active: true,
      })
      await expect(
        authCrypto.verifySecret('Erstes-Passwort-1', user!.passwordHash)
      ).resolves.toBe(true)
      await expect(
        authCrypto.verifySecret('0042', user!.pinHash)
      ).resolves.toBe(true)
      const audit = await AuditLog.findOne({ where: { action: 'cli_create' } })
      expect(audit).toMatchObject({ userId: null, entityId: String(user!.id) })
      expect(JSON.stringify(audit!.data)).not.toMatch(/Passwort|0042/)
    })
  })

  it('is idempotent: reactivates and resets an existing user, ends its sessions', async () => {
    process.env['CREATE_USER_PASSWORD'] = 'Erstes-Passwort-1'
    expect(await main(args('test.cli'))).toBe(0)
    await withDb(async () => {
      const user = await User.findOne({ where: { username: 'test.cli' } })
      user!.active = false
      await user!.save()
      await AuthSession.create({
        userId: user!.id,
        kind: 'personal',
        expiresAt: new Date(Date.now() + 3_600_000),
      })
    })

    process.env['CREATE_USER_PASSWORD'] = 'Zweites-Passwort-2'
    expect(await main(args('test.cli', 'inhaber', 'Test Chef'))).toBe(0)

    await withDb(async () => {
      expect(await User.count()).toBe(1)
      const user = await User.scope('withSecrets').findOne({
        where: { username: 'test.cli' },
      })
      expect(user).toMatchObject({
        displayName: 'Test Chef',
        role: 'inhaber',
        active: true,
      })
      await expect(
        authCrypto.verifySecret('Zweites-Passwort-2', user!.passwordHash)
      ).resolves.toBe(true)
      const open = await AuthSession.count({ where: { revokedAt: null } })
      expect(open).toBe(0)
      expect(await AuditLog.count({ where: { action: 'cli_reset' } })).toBe(1)
    })
  })

  it.each([
    ['a short password', ['test.cli'], { CREATE_USER_PASSWORD: 'kurz' }],
    [
      'an unknown role',
      ['test.cli', 'admin'],
      { CREATE_USER_PASSWORD: 'Lang-genug-1' },
    ],
    [
      'a bad PIN',
      ['test.cli'],
      { CREATE_USER_PASSWORD: 'Lang-genug-1', CREATE_USER_PIN: '12' },
    ],
  ])('refuses %s without touching the database', async (_case, a, env) => {
    Object.assign(process.env, env)
    const [username, role] = a as [string, string?]
    expect(await main(args(username, role))).toBe(1)
    expect(fs.existsSync(process.env['DB_PATH']!)).toBe(false)
  })

  it('refuses missing options and unknown commands', async () => {
    process.env['CREATE_USER_PASSWORD'] = 'Lang-genug-1'
    expect(await main(['create-user', '--username', 'test.x'])).toBe(1)
    expect(await main(['delete-user'])).toBe(1)
    expect(await main(['create-user', 'stray'])).toBe(1)
    expect(await main(['help'])).toBe(0)
  })

  it('parses --flag value and --flag=value', () => {
    expect(
      parseArgs(['create-user', '--username=a.b', '--role', 'fahrer'])
    ).toEqual({
      command: 'create-user',
      flags: { username: 'a.b', role: 'fahrer' },
    })
  })

  it('refuses a relative DB_PATH in production', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['DB_PATH'] = 'relativ.db'
    process.env['CREATE_USER_PASSWORD'] = 'Lang-genug-1'
    expect(await main(args('test.cli'))).toBe(1)
  })
})

describe('bootstrapAdmin (development only)', () => {
  const log = { log: jest.fn(), warn: jest.fn() }

  it('creates the inhaber once in development, never in production', async () => {
    await withDb(async () => {
      const env = {
        NODE_ENV: 'development',
        BOOTSTRAP_ADMIN_USER: 'Dev.Chef',
        BOOTSTRAP_ADMIN_PASSWORD: 'Entwicklung-2026',
      }
      expect(await bootstrapAdmin(env, log)).toBe('created')
      expect(await bootstrapAdmin(env, log)).toBe('exists')
      const user = await User.findOne({ where: { username: 'dev.chef' } })
      expect(user?.role).toBe('inhaber')

      expect(
        await bootstrapAdmin(
          { ...env, NODE_ENV: 'production', BOOTSTRAP_ADMIN_USER: 'prod.chef' },
          log
        )
      ).toBe('skipped')
      expect(await User.count({ where: { username: 'prod.chef' } })).toBe(0)

      expect(await bootstrapAdmin({ NODE_ENV: 'development' }, log)).toBe(
        'skipped'
      )
      expect(
        await bootstrapAdmin(
          { NODE_ENV: 'development', BOOTSTRAP_ADMIN_USER: 'nur.name' },
          log
        )
      ).toBe('skipped')
      expect(
        await bootstrapAdmin(
          {
            NODE_ENV: 'development',
            BOOTSTRAP_ADMIN_USER: 'zu.kurz',
            BOOTSTRAP_ADMIN_PASSWORD: 'kurz',
          },
          log
        )
      ).toBe('skipped')
      expect(
        await AuditLog.count({ where: { action: 'bootstrap_create' } })
      ).toBe(1)
    })
  })
})
