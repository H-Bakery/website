/**
 * Z9 `cli.js snapshot-preorders` on a temp SQLite file and a temp bare
 * origin: sums per product/variant and counts only, no names; a rerun on
 * unchanged data commits nothing. Synthetic preorders.
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { main } from '../../src/cli'
import { openDatabase } from '../../src/db/database'
import { runMigrations } from '../../src/db/migrate'
import { initializeModels, Preorder, PreorderItem } from '../../src/models'
import {
  commonGitDir,
  LOCK_FILE,
  NETWORK_LOCK_FILE,
} from '../../src/services/hq-git'
import { git, removeTempDirs } from '../helpers/hqProducts'
import { HqRemote, makeHqRemote, originFile } from '../helpers/hqRemote'

jest.setTimeout(60000)

const DATE = '2026-12-19'
const FILE = `data/production/vorbestellungen/${DATE}.json`

let dir: string
let remote: HqRemote
const saved: Record<string, string | undefined> = {}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-z9-cli-'))
  remote = makeHqRemote()
  for (const key of ['DB_PATH', 'HQ_SNAPSHOT_DIR'])
    saved[key] = process.env[key]
  process.env['DB_PATH'] = path.join(dir, 'cli.db')
  process.env['HQ_SNAPSHOT_DIR'] = remote.snapshot

  const { sequelize } = await openDatabase({ storage: process.env['DB_PATH'] })
  await runMigrations(sequelize, { log: () => undefined })
  await initializeModels(sequelize)
  type Channel = 'laden' | 'telefon' | 'whatsapp' | 'shop' | 'sammelstelle'
  type Status = 'offen' | 'bereit' | 'abgeholt' | 'storniert'
  const rows: [string, Channel, Status, number][] = [
    ['LA', 'telefon', 'offen', 2],
    ['LA', 'laden', 'abgeholt', 3],
    ['MO', 'sammelstelle', 'bereit', 1],
    ['LA', 'whatsapp', 'storniert', 9],
  ]
  let n = 0
  for (const [prefix, channel, status, qty] of rows) {
    n += 1
    const p = await Preorder.create({
      code: `${prefix}-${DATE}-0${n}`,
      channel,
      customerName: `Kundin Geheim ${n}`,
      customerPhone: `0170 99999${n}`,
      note: 'Notiz mit Namen',
      pickupDate: DATE,
      pickupPointId: prefix === 'MO' ? 'kindergarten-moersbach' : null,
      status,
    })
    await PreorderItem.create({
      preorderId: p.id,
      productId: 'teststollen',
      productName: 'Teststollen',
      unitPrice: 12.5,
      quantity: qty,
      variant: '',
    })
  }
  await sequelize.close()
})

afterAll(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  fs.rmSync(dir, { recursive: true, force: true })
  removeTempDirs()
})

describe('snapshot-preorders', () => {
  it('writes sums and counts to main, without personal data', async () => {
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(await main(['snapshot-preorders', '--date', DATE])).toBe(0)
    } finally {
      quiet.mockRestore()
      err.mockRestore()
    }
    const raw = originFile(remote, 'main', FILE) as string
    const json = JSON.parse(raw)
    expect(json).toMatchObject({
      kind: 'vorbestellungen',
      date: DATE,
      preorderCount: 3,
      items: [
        { productId: 'teststollen', variant: null, quantity: 6, preorders: 3 },
      ],
      channels: { laden: 1, telefon: 1, whatsapp: 0, shop: 0, sammelstelle: 1 },
    })
    expect(json.pickupPoints).toEqual(
      expect.arrayContaining([
        { id: 'laden', name: 'Laden', count: 2 },
        expect.objectContaining({ id: 'kindergarten-moersbach', count: 1 }),
      ])
    )
    for (const secret of ['Geheim', '0170', 'Notiz', `LA-${DATE}`, '12.5']) {
      expect(raw).not.toContain(secret)
    }
    expect(git(remote.bare, 'log', '-1', '--format=%s|%an', 'main')).toBe(
      `chore(production): Vorbestellungen ${DATE} (App)|Verwaltung (App)`
    )
  })

  it('a rerun on unchanged data commits nothing', async () => {
    const before = git(remote.bare, 'rev-list', '--count', 'main')
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(await main(['snapshot-preorders', `--date=${DATE}`])).toBe(0)
    } finally {
      quiet.mockRestore()
      err.mockRestore()
    }
    expect(git(remote.bare, 'rev-list', '--count', 'main')).toBe(before)
  })

  it('the server holding the locks (another process): the CLI waits instead of losing the snapshot', async () => {
    const OTHER = '2026-12-20'
    const gitDir = commonGitDir(remote.snapshot) as string
    const server = spawn(process.execPath, [
      '-e',
      'setTimeout(() => {}, 20000)',
    ])
    const local = path.join(gitDir, LOCK_FILE)
    const net = path.join(gitDir, NETWORK_LOCK_FILE)
    fs.writeFileSync(local, `${server.pid} ${Date.now()}\n`)
    fs.writeFileSync(net, `${server.pid} ${Date.now()}\n`)
    // the "server" finishes its commit after 1 s and its push after 2.5 s
    const t1 = setTimeout(() => fs.rmSync(local, { force: true }), 1000)
    const t2 = setTimeout(() => fs.rmSync(net, { force: true }), 2500)
    const quiet = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const t0 = Date.now()
    try {
      expect(await main(['snapshot-preorders', '--date', OTHER])).toBe(0)
    } finally {
      quiet.mockRestore()
      err.mockRestore()
      clearTimeout(t1)
      clearTimeout(t2)
      server.kill('SIGKILL')
      fs.rmSync(local, { force: true })
      fs.rmSync(net, { force: true })
    }
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2400)
    expect(
      originFile(
        remote,
        'main',
        `data/production/vorbestellungen/${OTHER}.json`
      )
    ).not.toBeNull()
  })

  it('refuses bad input and a missing HQ_SNAPSHOT_DIR (exit 1)', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(await main(['snapshot-preorders', '--date', '2026-02-30'])).toBe(1)
      expect(await main(['snapshot-preorders', '--force'])).toBe(1)
      delete process.env['HQ_SNAPSHOT_DIR']
      expect(await main(['snapshot-preorders', '--date', DATE])).toBe(1)
      expect(err.mock.calls.flat().join(' ')).toContain('HQ_SNAPSHOT_DIR')
    } finally {
      process.env['HQ_SNAPSHOT_DIR'] = remote.snapshot
      err.mockRestore()
    }
  })
})
