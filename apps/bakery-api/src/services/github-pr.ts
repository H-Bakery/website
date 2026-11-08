/**
 * The one rolling pull request of `app/edits` (B5b, D6) through the GitHub
 * REST API, with Node's `fetch` - no SDK.
 *
 *   GET  /repos/{owner}/{repo}/pulls?state=open&head={owner}:app/edits&base=main
 *   POST /repos/{owner}/{repo}/pulls   (only when none is open)
 *
 * GitHub allows one open PR per head and base, so "exactly one" means: look,
 * and open one only if there is none. An open PR updates itself on every
 * push to `app/edits`; the body is not rewritten.
 *
 * The base URL is configurable (`GITHUB_API_URL`), so tests run against a
 * local fake server and never against GitHub.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./hq-writeback.core')
/* eslint-enable @typescript-eslint/no-var-requires */

export type FetchLike = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
    signal?: AbortSignal
  }
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface GitHubOptions {
  apiUrl: string
  token: string
  /** `owner/repo`. */
  repo: string
  fetch?: FetchLike
  timeoutMs?: number
}

export class GitHubError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

export interface PullRequestRef {
  number: number
  url: string
  created: boolean
}

async function call(
  options: GitHubOptions,
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<unknown> {
  const doFetch: FetchLike =
    options.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 20_000
  )
  timer.unref?.()
  const url = `${options.apiUrl.replace(/\/+$/, '')}${pathAndQuery}`
  let response
  try {
    response = await doFetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${options.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bakery-api-hq-writeback',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    throw new GitHubError(
      `GitHub ${method} ${pathAndQuery} nicht erreichbar: ${
        (error as Error).message
      }`
    )
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    // GitHub's own message only (no token, no headers).
    let detail = ''
    try {
      const data = (await response.json()) as { message?: unknown }
      detail = typeof data?.message === 'string' ? data.message : ''
    } catch {
      detail = ''
    }
    throw new GitHubError(
      `GitHub ${method} ${pathAndQuery}: ${response.status}${
        detail ? ` ${detail}` : ''
      }`,
      response.status
    )
  }
  return response.json()
}

function prRef(raw: unknown, created: boolean): PullRequestRef {
  const pr = raw as { number?: unknown; html_url?: unknown }
  if (typeof pr?.number !== 'number' || typeof pr?.html_url !== 'string') {
    throw new GitHubError('GitHub hat eine unerwartete Antwort geschickt.')
  }
  return { number: pr.number, url: pr.html_url, created }
}

/** The open PR from `head` into `base`, or `null`. */
export async function findOpenPullRequest(
  options: GitHubOptions,
  head: string,
  base: string
): Promise<PullRequestRef | null> {
  const repo = core.parseRepo(options.repo)
  if (!repo) throw new GitHubError(`Ungültiges Repository „${options.repo}“.`)
  const query = new URLSearchParams({
    state: 'open',
    head: `${repo.owner}:${head}`,
    base,
    per_page: '10',
  })
  const list = await call(
    options,
    'GET',
    `/repos/${repo.owner}/${repo.repo}/pulls?${query.toString()}`
  )
  if (!Array.isArray(list)) {
    throw new GitHubError('GitHub hat eine unerwartete Antwort geschickt.')
  }
  if (list.length === 0) return null
  // Oldest first: should there ever be more than one, keep using the first.
  const sorted = [...list].sort(
    (a, b) => Number((a as any).number) - Number((b as any).number)
  )
  return prRef(sorted[0], false)
}

/** Finds the open PR, or opens it. */
export async function ensurePullRequest(
  options: GitHubOptions,
  pr: { head: string; base: string; title: string; body: string }
): Promise<PullRequestRef> {
  const existing = await findOpenPullRequest(options, pr.head, pr.base)
  if (existing) return existing
  const repo = core.parseRepo(options.repo)
  try {
    const created = await call(
      options,
      'POST',
      `/repos/${repo.owner}/${repo.repo}/pulls`,
      {
        title: pr.title,
        head: pr.head,
        base: pr.base,
        body: pr.body,
        maintainer_can_modify: false,
      }
    )
    return prRef(created, true)
  } catch (error) {
    // 422 "A pull request already exists" (a race with another opener):
    // look again instead of failing.
    if (error instanceof GitHubError && error.status === 422) {
      const again = await findOpenPullRequest(options, pr.head, pr.base)
      if (again) return again
    }
    throw error
  }
}
