/**
 * Q3: the GitHub token for hq from `HQ_GITHUB_TOKEN` or, for a GitHub App,
 * from `HQ_GITHUB_TOKEN_FILE` - read at the time of use, never cached; a
 * missing/empty/broken file behaves like "no token" and never throws.
 * Synthetic tokens only.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {
  createGitHubTokenProvider,
  describeTokenProblem,
  readTokenFile,
} from '../../src/services/github-token'
import { HqEditsSync } from '../../src/services/hq-edits-sync.service'

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-gh-token-'))
  file = path.join(dir, 'hq-token')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('createGitHubTokenProvider', () => {
  it('reads the file on every use, not once', () => {
    const provider = createGitHubTokenProvider({ tokenFile: file })
    expect(provider).toMatchObject({ configured: true, source: 'file', file })
    fs.writeFileSync(file, 'ghs_synthetic_one\n')
    expect(provider.read().token).toBe('ghs_synthetic_one')
    // hq-token.sh renews it (tmp + rename) - the same provider sees the new one
    const tmp = path.join(dir, '.hq-token.tmp')
    fs.writeFileSync(tmp, 'ghs_synthetic_two\n')
    fs.renameSync(tmp, file)
    expect(provider.read()).toMatchObject({
      token: 'ghs_synthetic_two',
      source: 'file',
      problem: null,
    })
    expect(provider.read().updatedAt).toBe(
      fs.statSync(file).mtime.toISOString()
    )
  })

  it('the fixed token wins over the file', () => {
    fs.writeFileSync(file, 'ghs_from_file')
    const provider = createGitHubTokenProvider({
      token: 'fixed-token',
      tokenFile: file,
    })
    expect(provider).toMatchObject({ source: 'env', file: null })
    expect(provider.read()).toMatchObject({ token: 'fixed-token', file: null })
  })

  it('nothing configured', () => {
    const provider = createGitHubTokenProvider({ token: ' ', tokenFile: '' })
    expect(provider.configured).toBe(false)
    expect(provider.read()).toEqual({
      token: null,
      source: 'none',
      file: null,
      updatedAt: null,
      problem: null,
    })
  })
})

describe('readTokenFile: a bad file is "no token", never an exception', () => {
  it('missing', () => {
    const state = readTokenFile(file)
    expect(state).toMatchObject({ token: null, problem: 'missing' })
    expect(describeTokenProblem(state)).toBe(`${file} fehlt`)
    expect(readTokenFile(path.join(file, 'below-a-file'))).toMatchObject({
      problem: 'missing',
    })
  })

  it('empty or blank', () => {
    fs.writeFileSync(file, '')
    expect(readTokenFile(file)).toMatchObject({ token: null, problem: 'empty' })
    fs.writeFileSync(file, '  \n\n')
    const state = readTokenFile(file)
    expect(state.problem).toBe('empty')
    expect(describeTokenProblem(state)).toBe(`${file} ist leer`)
  })

  it('trims the newline hq-token.sh writes', () => {
    fs.writeFileSync(file, '  ghs_synthetic_abc123\r\n')
    expect(readTokenFile(file).token).toBe('ghs_synthetic_abc123')
  })

  it('two lines or blanks inside are refused (git credential protocol)', () => {
    fs.writeFileSync(file, 'ghs_one\nusername=evil\n')
    expect(readTokenFile(file)).toMatchObject({
      token: null,
      problem: 'invalid',
    })
    fs.writeFileSync(file, 'ghs one')
    expect(readTokenFile(file).problem).toBe('invalid')
    fs.writeFileSync(file, 'x'.repeat(5000))
    expect(readTokenFile(file).problem).toBe('invalid')
  })

  it('a directory or an unreadable file', () => {
    fs.mkdirSync(file)
    expect(readTokenFile(file)).toMatchObject({
      token: null,
      problem: 'unreadable',
    })
    fs.rmdirSync(file)
    if (process.getuid?.() !== 0) {
      fs.writeFileSync(file, 'ghs_secret', { mode: 0o000 })
      const state = readTokenFile(file)
      expect(state).toMatchObject({ token: null, problem: 'unreadable' })
      expect(describeTokenProblem(state)).toBe(`${file} ist nicht lesbar`)
    }
  })
})

describe('HqEditsSync status with a token file', () => {
  const sync = () =>
    new HqEditsSync({
      writeDir: dir,
      tokenProvider: createGitHubTokenProvider({ tokenFile: file }),
      git: () => Promise.reject(new Error('no git in this test')),
      log: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      },
    })

  it('missing → disabled, the reason names the file; the token never shows', () => {
    const edits = sync()
    expect(edits.enabled).toBe(false)
    expect(edits.status()).toMatchObject({
      enabled: false,
      reason: `Kein GitHub-Token (HQ_GITHUB_TOKEN_FILE: ${file} fehlt) - Änderungen bleiben als Commits auf der Box.`,
      token: { source: 'file', file, updatedAt: null, problem: 'missing' },
    })
    fs.writeFileSync(file, '')
    expect(edits.status()).toMatchObject({
      enabled: false,
      reason: expect.stringContaining(`${file} ist leer`),
      token: { problem: 'empty' },
    })
  })

  it('becomes enabled as soon as the timer has written a token', () => {
    const edits = sync()
    expect(edits.enabled).toBe(false)
    fs.writeFileSync(file, 'ghs_synthetic_secret\n')
    expect(edits.enabled).toBe(true)
    const status = edits.status()
    expect(status).toMatchObject({
      enabled: true,
      reason: null,
      token: { source: 'file', file, problem: null },
    })
    expect(status.token.updatedAt).toEqual(expect.any(String))
    expect(JSON.stringify(status)).not.toContain('ghs_synthetic_secret')
  })

  it('a fixed token keeps the old wording', () => {
    const edits = new HqEditsSync({ writeDir: dir, token: null })
    expect(edits.status()).toMatchObject({
      enabled: false,
      reason: expect.stringContaining('Kein GitHub-Token (HQ_GITHUB_TOKEN)'),
      token: { source: 'none', file: null, problem: null },
    })
    expect(
      new HqEditsSync({ writeDir: dir, token: 't' }).status()
    ).toMatchObject({ enabled: true, token: { source: 'env' } })
  })
})
