/**
 * Where the GitHub token for hq comes from (B5b push + PR, Z9 snapshots; Q3).
 *
 *   1. `HQ_GITHUB_TOKEN` - a fixed token (fine-grained PAT), as before.
 *   2. `HQ_GITHUB_TOKEN_FILE` - a file holding a GitHub App installation
 *      token. Those live one hour; `deploy/scripts/hq-token.sh` (root,
 *      `bakery-hq-token.timer`, every 30 min) writes a fresh one atomically.
 *      The file is therefore read **at the time of use** - before every
 *      fetch, push and GitHub API call - never once at startup.
 *   3. `GITHUB_TOKEN` - only when neither of the above is set.
 *
 * `loadHqSyncConfig()` (config/env.ts) applies that precedence; this module
 * reads. A missing, empty, unreadable or malformed file behaves like "no
 * token" - nothing throws, `read()` says what is wrong (German text via
 * `describeTokenProblem`). The token itself is never logged or returned in a
 * status.
 */
import * as fs from 'fs'

export type GitHubTokenProblem = 'missing' | 'empty' | 'unreadable' | 'invalid'

export interface GitHubTokenState {
  /** The token, or `null` (then git runs without credentials). */
  token: string | null
  source: 'env' | 'file' | 'none'
  /** `HQ_GITHUB_TOKEN_FILE`, else `null`. */
  file: string | null
  /** Last change of the token file (ISO), `null` without a readable file. */
  updatedAt: string | null
  /** Why a configured file gave no token, else `null`. */
  problem: GitHubTokenProblem | null
}

export interface GitHubTokenProvider {
  /** A token or a token file is configured (the retry timers run). */
  readonly configured: boolean
  readonly source: 'env' | 'file' | 'none'
  readonly file: string | null
  /** Reads now - the file on every call. Never throws. */
  read(): GitHubTokenState
}

/**
 * GitHub tokens are printable ASCII without blanks (`ghs_…`, `github_pat_…`).
 * Anything else - a newline above all - would end up in git's credential
 * protocol (`password=…`), so it is refused, not passed on.
 */
const TOKEN_PATTERN = /^[\x21-\x7e]+$/
/** An installation token is ~40 bytes; a bigger file is not a token file. */
const MAX_FILE_BYTES = 4096

export function readTokenFile(file: string): GitHubTokenState {
  const base = { token: null, source: 'file' as const, file }
  let fd: number
  try {
    fd = fs.openSync(file, 'r')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    return {
      ...base,
      updatedAt: null,
      problem:
        code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreadable',
    }
  }
  try {
    const stat = fs.fstatSync(fd)
    if (!stat.isFile()) {
      return { ...base, updatedAt: null, problem: 'unreadable' }
    }
    const updatedAt = stat.mtime.toISOString()
    if (stat.size > MAX_FILE_BYTES) {
      return { ...base, updatedAt, problem: 'invalid' }
    }
    const raw = fs.readFileSync(fd, 'utf8').trim()
    if (raw === '') return { ...base, updatedAt, problem: 'empty' }
    if (!TOKEN_PATTERN.test(raw)) {
      return { ...base, updatedAt, problem: 'invalid' }
    }
    return { ...base, token: raw, updatedAt, problem: null }
  } catch {
    return { ...base, updatedAt: null, problem: 'unreadable' }
  } finally {
    try {
      fs.closeSync(fd)
    } catch {
      // nothing to do
    }
  }
}

/**
 * The provider for `loadHqSyncConfig()`'s result: `token` wins (fixed token),
 * else `tokenFile` (read per use), else none.
 */
export function createGitHubTokenProvider(options: {
  token?: string | null
  tokenFile?: string | null
}): GitHubTokenProvider {
  const token = options.token?.trim() || null
  const file = token ? null : options.tokenFile?.trim() || null
  if (token) {
    const state: GitHubTokenState = {
      token,
      source: 'env',
      file: null,
      updatedAt: null,
      problem: null,
    }
    return {
      configured: true,
      source: 'env',
      file: null,
      read: () => ({ ...state }),
    }
  }
  if (file) {
    return {
      configured: true,
      source: 'file',
      file,
      read: () => readTokenFile(file),
    }
  }
  return {
    configured: false,
    source: 'none',
    file: null,
    read: () => ({
      token: null,
      source: 'none',
      file: null,
      updatedAt: null,
      problem: null,
    }),
  }
}

/** A fixed token (or none) - tests and `createApp()` defaults. */
export function staticGitHubToken(token: string | null): GitHubTokenProvider {
  return createGitHubTokenProvider({ token })
}

/** German: what is wrong with the token file (for the sync status). */
export function describeTokenProblem(state: GitHubTokenState): string | null {
  if (!state.problem || !state.file) return null
  switch (state.problem) {
    case 'missing':
      return `${state.file} fehlt`
    case 'empty':
      return `${state.file} ist leer`
    case 'unreadable':
      return `${state.file} ist nicht lesbar`
    case 'invalid':
      return `${state.file} enthält kein gültiges Token`
  }
}
