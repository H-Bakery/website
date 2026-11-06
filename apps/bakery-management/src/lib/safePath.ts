/**
 * Ob `value` ein Pfad innerhalb dieser App ist, den `?next=` anspringen darf
 * (W4-Verifikation Runde 2). Ein bloßer Präfix-Test (`/admin…`) ließ
 * `/admin/..//fremder-host/x`, `/admin/%2e%2e//…` und `/admin/../\host`
 * durch - der Router holte dann eine Seite von einem fremden Host.
 *
 * Erlaubt: absoluter Pfad ohne Backslash, ohne Steuerzeichen, ohne `//`,
 * ohne `%`-Kodierung im Pfadteil und ohne `.`/`..`-Segmente. Query und
 * Fragment dürfen folgen (`?date=…&point=…`), dort ohne Backslash.
 */
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/') || value.length > 2048) return false
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false
  const cut = value.search(/[?#]/)
  const path = cut === -1 ? value : value.slice(0, cut)
  if (path.includes('//') || path.includes('%')) return false
  return !path.split('/').some((segment) => segment === '.' || segment === '..')
}
