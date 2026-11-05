/**
 * hq write-back (B5b, roadmap D6/§4a): pure rules, dependency-free CommonJS
 * like the other `*.core.js` files. git and HTTP calls live in
 * `hq-git.ts`, `hq-edits-sync.service.ts` and `github-pr.ts`.
 *
 *   - which git failure is what (`classifyGitError`)
 *   - the editors of a commit range (`editorsFromLog`, from the
 *     `Co-authored-by` trailers B5 writes)
 *   - title and German body of the one rolling pull request
 */

/** Branch of the write worktree and the base of the rolling PR (D6). */
const EDITS_BRANCH = 'app/edits'
const BASE_BRANCH = 'main'
const DEFAULT_GITHUB_REPO = 'H-Bakery/hq'
const DEFAULT_GITHUB_API_URL = 'https://api.github.com'
const DEFAULT_RETRY_MS = 15 * 60 * 1000

const PR_TITLE = 'Stammdaten aus der Verwaltung'

const NETWORK_PATTERNS = [
  /could not resolve host/i,
  /unable to access/i,
  /connection (refused|timed out|reset)/i,
  /failed to connect/i,
  /operation timed out/i,
  /network is unreachable/i,
  /could not read from remote repository/i,
  /does not appear to be a git repository/i,
  /authentication failed/i,
  /could not read username/i,
  /repository .* not found/i,
  /the requested url returned error/i,
  /ssl/i,
]

const REJECTED_PATTERNS = [
  /\[rejected\]/i,
  /\[remote rejected\]/i,
  /non-fast-forward/i,
  /fetch first/i,
  /stale info/i,
  /updates were rejected/i,
]

const CONFLICT_PATTERNS = [/CONFLICT/, /could not apply/i, /merge conflict/i]

/**
 * Code for a failed git call (see `HqGitErrorCode` in `hq-git.ts`).
 * `args` = the git arguments without the global `-c` options.
 */
function classifyGitError(args, stderr) {
  const text = String(stderr || '')
  const command = Array.isArray(args) ? String(args[0] || '') : ''
  if (/not a git repository/i.test(text)) return 'not_a_repo'
  if (command === 'push' && REJECTED_PATTERNS.some((p) => p.test(text))) {
    return 'push_rejected'
  }
  if (
    (command === 'rebase' || command === 'pull' || command === 'merge') &&
    CONFLICT_PATTERNS.some((p) => p.test(text))
  ) {
    return 'rebase_conflict'
  }
  if (
    (command === 'push' ||
      command === 'fetch' ||
      command === 'pull' ||
      command === 'ls-remote') &&
    NETWORK_PATTERNS.some((p) => p.test(text))
  ) {
    return 'network'
  }
  if (command === 'pull' && REJECTED_PATTERNS.some((p) => p.test(text))) {
    return 'push_rejected'
  }
  return 'git_failed'
}

/**
 * Editor names from commit messages (`git log --format=%B`): every
 * `Co-authored-by: Name <mail>` trailer, names only, in first-seen order,
 * each once. The mail (`username@bakery.local`) is left out of the PR body.
 */
function editorsFromLog(log) {
  const names = []
  const seen = new Set()
  for (const line of String(log || '').split(/\r?\n/)) {
    const match = /^\s*Co-authored-by:\s*(.+?)\s*<[^>]*>\s*$/i.exec(line)
    if (!match) continue
    const name = match[1].trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    names.push(name)
  }
  return names
}

/** Non-empty, trimmed, unique lines (git `--name-only` output). */
function fileList(output) {
  return [
    ...new Set(
      String(output || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    ),
  ].sort()
}

/** Backticks would break the inline code in the PR body. */
function codeSpan(text) {
  return '`' + String(text).replace(/`/g, "'") + '`'
}

/**
 * German body of the rolling PR. It is written when the PR is opened; later
 * pushes to `app/edits` update the PR's commits and files by themselves
 * ("append = just push"), so the body says it shows the state at opening.
 */
function pullRequestBody({ files, editors, commitCount }) {
  const list = Array.isArray(files) ? files : []
  const people = Array.isArray(editors) ? editors : []
  const lines = [
    'Stammdaten-Änderungen aus der Verwaltungs-App (Bäckerei-Box), roadmap D6.',
    '',
    `Die App schreibt alle Änderungen auf den Branch ${codeSpan(
      EDITS_BRANCH
    )} und hängt sie an diese eine Pull-Request an. ` +
      'Die Prüfung in hq (Schema, erlaubte Pfade) mergt sie, wenn alles grün ist. ' +
      'Bis dahin zeigt die App die Änderungen als „wartet auf Freigabe“.',
    '',
    `**Geänderte Dateien beim Öffnen** (${list.length}):`,
    '',
    ...(list.length ? list.map((f) => `- ${codeSpan(f)}`) : ['- (keine)']),
    '',
    `**Bearbeitet von:** ${people.length ? people.join(', ') : 'unbekannt'}`,
    '',
    `Commits beim Öffnen: ${
      Number(commitCount) || 0
    }. Spätere Änderungen erscheinen ` +
      'als weitere Commits; die vollständige Liste steht unter „Files changed“.',
    '',
    'Autor der Commits ist „Verwaltung (App)“; wer gespeichert hat, steht als ' +
      '`Co-authored-by` in jedem Commit.',
    '',
  ]
  return lines.join('\n')
}

/** `owner/repo` → `{ owner, repo }`, or `null` when malformed. */
function parseRepo(full) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(
    String(full || '').trim()
  )
  return match ? { owner: match[1], repo: match[2] } : null
}

/** German text for an error code of the sync status. */
const SYNC_ERROR_MESSAGES = {
  disabled: 'Die Übertragung nach hq ist nicht eingerichtet.',
  network:
    'hq (GitHub) ist nicht erreichbar. Die Änderungen sind auf der Box gespeichert und werden alle 15 Minuten erneut übertragen.',
  push_rejected:
    'GitHub hat die Übertragung abgelehnt (der Branch wurde inzwischen geändert). Nächster Versuch in 15 Minuten.',
  rebase_conflict:
    'Die Änderungen lassen sich nicht auf den aktuellen Stand von hq setzen (jemand hat dieselben Dateien geändert). Die Änderungen bleiben auf der Box; bitte den Entwickler informieren.',
  worktree_dirty:
    'Im Schreibverzeichnis liegen ungespeicherte Änderungen. Bitte den Entwickler informieren.',
  wrong_branch:
    'Das Schreibverzeichnis steht auf dem falschen Branch. Bitte den Entwickler informieren.',
  not_a_repo:
    'Das Schreibverzeichnis für hq ist kein git-Arbeitsverzeichnis. Bitte die Einrichtung prüfen.',
  github_failed:
    'Die Pull-Request auf GitHub konnte nicht angelegt werden. Nächster Versuch in 15 Minuten.',
  git_timeout: 'git hat zu lange gebraucht. Nächster Versuch in 15 Minuten.',
  repo_locked:
    'Das Schreibverzeichnis war belegt. Nächster Versuch in 15 Minuten.',
  git_missing: 'git ist auf der Box nicht installiert.',
  git_failed:
    'Die Übertragung nach hq ist fehlgeschlagen. Nächster Versuch in 15 Minuten.',
}

function syncErrorMessage(code) {
  return SYNC_ERROR_MESSAGES[code] || SYNC_ERROR_MESSAGES.git_failed
}

module.exports = {
  BASE_BRANCH,
  DEFAULT_GITHUB_API_URL,
  DEFAULT_GITHUB_REPO,
  DEFAULT_RETRY_MS,
  EDITS_BRANCH,
  PR_TITLE,
  classifyGitError,
  editorsFromLog,
  fileList,
  parseRepo,
  pullRequestBody,
  syncErrorMessage,
}
