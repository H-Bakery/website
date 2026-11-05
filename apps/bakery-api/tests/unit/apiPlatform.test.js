/**
 * B0 platform of the TypeScript API: config (env.ts), error responses
 * (http-error.ts) and the SQLite layer (db/database.ts), loaded from the TS
 * sources through esbuild (see tests/helpers/loadTs.js).
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')
const { loadTs } = require('../helpers/loadTs')

jest.setTimeout(30000)

let api
beforeAll(async () => {
  api = await loadTs([
    'src/config/env',
    'src/utils/http-error',
    'src/db/database',
  ])
})

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-api-b0-'))
}

describe('resolveDbPath', () => {
  test('development: default ./data/bakery.db relative to cwd', () => {
    expect(api.resolveDbPath(undefined, false, '/srv/x')).toBe(
      '/srv/x/data/bakery.db'
    )
    expect(api.resolveDbPath('  ', false, '/srv/x')).toBe(
      '/srv/x/data/bakery.db'
    )
    expect(api.resolveDbPath('db/t.db', false, '/srv/x')).toBe('/srv/x/db/t.db')
    expect(api.resolveDbPath(':memory:', false)).toBe(':memory:')
  })

  test('production: required, absolute, not :memory:, directory must exist', () => {
    const dir = tempDir()
    try {
      const file = path.join(dir, 'bakery.db')
      expect(api.resolveDbPath(file, true)).toBe(file)
      expect(() => api.resolveDbPath(undefined, true)).toThrow(api.ConfigError)
      expect(() => api.resolveDbPath('./data/bakery.db', true)).toThrow(
        /absolute/
      )
      expect(() => api.resolveDbPath(':memory:', true)).toThrow(/:memory:/)
      expect(() =>
        api.resolveDbPath(path.join(dir, 'nope', 'sub', 'x.db'), true)
      ).toThrow(/does not exist/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ensureJwtSecret', () => {
  const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => {})

  test('production refuses a missing, short or default secret', () => {
    expect(() => api.ensureJwtSecret({ NODE_ENV: 'production' })).toThrow(
      api.ConfigError
    )
    expect(() =>
      api.ensureJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' })
    ).toThrow(/32/)
    expect(() =>
      api.ensureJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: 'dev-jwt-secret-do-not-use-in-production-minimum-32-chars',
      })
    ).toThrow(/development default/)
    expect(() =>
      api.ensureJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
      })
    ).not.toThrow()
  })

  test('development falls back to a fixed default', () => {
    const warn = quiet()
    const env = { NODE_ENV: 'development' }
    api.ensureJwtSecret(env)
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
    warn.mockRestore()
  })
})

describe('loadHqConfig (B5)', () => {
  test('development: everything optional, HQ_DIR gives products/', () => {
    expect(api.loadHqConfig({}, '/srv/x')).toEqual({
      productsDir: null,
      writeDir: null,
    })
    expect(api.loadHqConfig({ HQ_DIR: '/srv/hq' }, '/srv/x')).toEqual({
      productsDir: '/srv/hq/products',
      writeDir: null,
    })
    expect(
      api.loadHqConfig(
        { HQ_DIR: '/srv/hq', HQ_PRODUCTS_DIR: 'p', HQ_WRITE_DIR: 'w' },
        '/srv/x'
      )
    ).toEqual({ productsDir: '/srv/x/p', writeDir: '/srv/x/w' })
  })

  test('production: read clone and write worktree required and absolute', () => {
    const prod = { NODE_ENV: 'production' }
    expect(() => api.loadHqConfig({ ...prod, HQ_WRITE_DIR: '/var/w' })).toThrow(
      /HQ_PRODUCTS_DIR/
    )
    expect(() =>
      api.loadHqConfig({ ...prod, HQ_PRODUCTS_DIR: '/var/hq/products' })
    ).toThrow(/HQ_WRITE_DIR is required/)
    expect(() =>
      api.loadHqConfig({
        ...prod,
        HQ_PRODUCTS_DIR: 'hq/products',
        HQ_WRITE_DIR: '/var/w',
      })
    ).toThrow(/absolute/)
    expect(() =>
      api.loadHqConfig({
        ...prod,
        HQ_PRODUCTS_DIR: '/var/hq/products',
        HQ_WRITE_DIR: 'w',
      })
    ).toThrow(/absolute/)
    expect(
      api.loadHqConfig({
        ...prod,
        HQ_DIR: '/var/hq',
        HQ_WRITE_DIR: '/var/hq-write',
      })
    ).toEqual({ productsDir: '/var/hq/products', writeDir: '/var/hq-write' })
  })

  test('the write worktree may never be (inside) the read clone', () => {
    for (const env of [
      { HQ_PRODUCTS_DIR: '/var/hq/products', HQ_WRITE_DIR: '/var/hq' },
      {
        HQ_PRODUCTS_DIR: '/var/hq/products',
        HQ_WRITE_DIR: '/var/hq/products/w',
      },
      { HQ_DIR: '/var/hq', HQ_WRITE_DIR: '/var/hq/w' },
      { HQ_DIR: '/var/hq', HQ_WRITE_DIR: '/var' },
      {
        NODE_ENV: 'production',
        HQ_PRODUCTS_DIR: '/var/hq/products',
        HQ_WRITE_DIR: '/var/hq/w',
      },
      {
        NODE_ENV: 'production',
        HQ_DIR: '/var/hq',
        HQ_WRITE_DIR: '/var/hq',
      },
    ]) {
      expect(() => api.loadHqConfig(env, '/srv/x')).toThrow(/separate clone/)
    }
  })
})

describe('parsePort / loadConfig', () => {
  test('port', () => {
    expect(api.parsePort(undefined)).toBe(5000)
    expect(api.parsePort('5110')).toBe(5110)
    for (const bad of ['0', '70000', 'abc', '50.5']) {
      expect(() => api.parsePort(bad)).toThrow(api.ConfigError)
    }
  })

  test('CORS_ORIGIN list and busy timeout', () => {
    const config = api.loadConfig(
      {
        CORS_ORIGIN: 'https://a.example, https://b.example,',
        DB_BUSY_TIMEOUT_MS: '250',
      },
      '/srv/x'
    )
    expect(config.corsOrigins).toEqual([
      'https://a.example',
      'https://b.example',
    ])
    expect(config.dbBusyTimeoutMs).toBe(250)
    expect(config.dbPath).toBe('/srv/x/data/bakery.db')
    expect(config.isProduction).toBe(false)
    expect(config.host).toBeUndefined()
    expect(api.loadConfig({ HOST: ' 127.0.0.1 ' }, '/srv/x').host).toBe(
      '127.0.0.1'
    )
    expect(() => api.loadConfig({ DB_BUSY_TIMEOUT_MS: '-1' })).toThrow(
      api.ConfigError
    )
  })

  test('HQ_REPORTS_DIR / HQ_FINANCE_DIR (B4): resolved against cwd, empty = unset', () => {
    const config = api.loadConfig(
      { HQ_REPORTS_DIR: ' /var/lib/hq/data/reports ', HQ_FINANCE_DIR: 'fin' },
      '/srv/x'
    )
    expect(config.hqReportsDir).toBe('/var/lib/hq/data/reports')
    expect(config.hqFinanceDir).toBe('/srv/x/fin')
    const unset = api.loadConfig({ HQ_REPORTS_DIR: '  ' }, '/srv/x')
    expect(unset.hqReportsDir).toBeUndefined()
    expect(unset.hqFinanceDir).toBeUndefined()
  })
})

describe('error responses', () => {
  function appWith(setup) {
    const app = express()
    app.use(express.json({ limit: '1kb' }))
    setup(app)
    app.use(api.notFoundHandler)
    app.use(api.createErrorHandler(() => undefined))
    return app
  }

  const thrown = (status) => (_req, _res, next) =>
    next(Object.assign(new Error('x'), { status }))

  test('unknown route, bad JSON, too large, unhandled', async () => {
    const app = appWith((a) => {
      a.post('/echo', (req, res) => res.json(req.body))
      a.get('/boom', () => {
        throw new Error('secret internals')
      })
    })

    let res = await request(app).get('/nope')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'not_found' })
    expect(res.body.message).toMatch(/Unbekannter Endpunkt/)

    res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_json')

    res = await request(app)
      .post('/echo')
      .send({ a: 'x'.repeat(2000) })
    expect(res.status).toBe(413)
    expect(res.body.error).toBe('payload_too_large')

    res = await request(app).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      success: false,
      error: 'internal_error',
      message: 'Interner Serverfehler.',
    })
  })

  test('a thrown 4xx keeps its meaning (401, 403, 429)', async () => {
    const app = appWith((a) => {
      a.get('/401', thrown(401))
      a.get('/403', thrown(403))
      a.get('/429', thrown(429))
      a.get('/418', thrown(418))
    })
    const expected = {
      401: 'unauthorized',
      403: 'forbidden',
      429: 'too_many_requests',
      418: 'bad_request',
    }
    for (const [status, error] of Object.entries(expected)) {
      const res = await request(app).get(`/${status}`)
      expect(res.status).toBe(Number(status))
      expect(res.body.error).toBe(error)
      expect(typeof res.body.message).toBe('string')
    }
  })

  test('ensureErrorShape fills in error + German message', async () => {
    const app = appWith((a) => {
      a.use(api.ensureErrorShape)
      a.get('/lib-401', (_req, res) =>
        res.status(401).json({ success: false, error: 'Invalid credentials' })
      )
      a.get('/lib-400', (_req, res) =>
        res.status(400).json({ errors: [{ msg: 'Username is required' }] })
      )
      a.get('/ok-shape', (_req, res) =>
        res.status(409).json({ error: 'conflict_x', message: 'Schon da.' })
      )
      a.get('/success', (_req, res) => res.json({ success: true }))
    })

    let res = await request(app).get('/lib-401')
    expect(res.body).toMatchObject({
      error: 'unauthorized',
      message: 'Bitte melden Sie sich an.',
      detail: 'Invalid credentials',
    })

    res = await request(app).get('/lib-400')
    expect(res.body.error).toBe('bad_request')
    expect(res.body.message).toBe('Die Anfrage ist ungültig.')
    expect(res.body.errors).toHaveLength(1)

    res = await request(app).get('/ok-shape')
    expect(res.body).toEqual({ error: 'conflict_x', message: 'Schon da.' })

    res = await request(app).get('/success')
    expect(res.body).toEqual({ success: true })
  })
})

describe('SQLite: serialised write transactions', () => {
  let dir
  let sequelize

  beforeEach(async () => {
    dir = tempDir()
    ;({ sequelize } = await api.openDatabase({
      storage: path.join(dir, 't.db'),
      busyTimeoutMs: 2000,
    }))
    await sequelize.query(
      'CREATE TABLE t (id INTEGER PRIMARY KEY, seq INTEGER NOT NULL UNIQUE)'
    )
  })

  afterEach(async () => {
    await sequelize.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const pause = (ms) => new Promise((r) => setTimeout(r, ms))

  test('20 concurrent read-then-write transactions all succeed, in order', async () => {
    // Exactly the partner-visit pattern: max(sequence) then insert. Without
    // the queue this fails with SQLITE_BUSY (deferred lock upgrade).
    const one = () =>
      sequelize.transaction(async (transaction) => {
        const [[row]] = await sequelize.query('SELECT max(seq) AS m FROM t', {
          transaction,
        })
        await pause(5)
        const seq = (row.m || 0) + 1
        await sequelize.query('INSERT INTO t (seq) VALUES (?)', {
          replacements: [seq],
          transaction,
        })
        return seq
      })

    const reads = Array.from({ length: 5 }, () =>
      sequelize.query('SELECT count(*) AS n FROM t')
    )
    const results = await Promise.all([
      ...Array.from({ length: 20 }, one),
      ...reads,
    ])
    const seqs = results.slice(0, 20).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  test('a failing transaction rolls back and releases the queue', async () => {
    await expect(
      sequelize.transaction(async (transaction) => {
        await sequelize.query('INSERT INTO t (seq) VALUES (1)', { transaction })
        throw new Error('abort')
      })
    ).rejects.toThrow('abort')
    const next = await sequelize.transaction(async (transaction) => {
      await sequelize.query('INSERT INTO t (seq) VALUES (1)', { transaction })
      return 'ok'
    })
    expect(next).toBe('ok')
  })

  test('unmanaged transactions hold the slot until commit / rollback', async () => {
    const first = await sequelize.transaction()
    let secondStarted = false
    const second = sequelize.transaction().then((t) => {
      secondStarted = true
      return t
    })
    await pause(50)
    expect(secondStarted).toBe(false)
    await sequelize.query('INSERT INTO t (seq) VALUES (1)', {
      transaction: first,
    })
    await first.commit()
    const t2 = await second
    expect(secondStarted).toBe(true)
    await t2.rollback()
    const third = await sequelize.transaction()
    await third.commit()
  })

  test('a nested call inside a managed transaction does not deadlock', async () => {
    const result = await sequelize.transaction(async (outer) => {
      await sequelize.query('INSERT INTO t (seq) VALUES (1)', {
        transaction: outer,
      })
      // Savepoint on the same connection.
      return sequelize.transaction({ transaction: outer }, async (inner) => {
        await sequelize.query('INSERT INTO t (seq) VALUES (2)', {
          transaction: inner,
        })
        return 'nested'
      })
    })
    expect(result).toBe('nested')
    const [[row]] = await sequelize.query('SELECT count(*) AS n FROM t')
    expect(row.n).toBe(2)
  })
})
