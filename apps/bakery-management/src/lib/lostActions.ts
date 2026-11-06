/**
 * Aktionen, die nicht gespeichert wurden, weil die Sitzung mitten darin
 * endete (W4-Verifikation Runde 2). Die App springt dann sofort zur
 * Anmeldung - ohne diesen Merker sähe niemand, dass z. B. eine Übergabe
 * fehlt. Liegt in `sessionStorage` (nur dieser Tab, keine Kundendaten außer
 * Code und Namen, endet mit dem Tab) und wird auf der Anmeldeseite und der
 * Abholliste angezeigt, bis jemand es wegklickt.
 */
const KEY = 'bakery-management-lost-actions'
const MAX = 10

export interface LostAction {
  text: string
  at: string
  /**
   * Seite, auf der es passierte (Pfad + Query) - die Station führt nach der
   * PIN dorthin zurück (W4-Verifikation Runde 4).
   */
  path?: string
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readLostActions(): LostAction[] {
  try {
    const raw = storage()?.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list)
      ? list.filter(
          (a): a is LostAction =>
            !!a && typeof (a as LostAction).text === 'string'
        )
      : []
  } catch {
    return []
  }
}

export function rememberLostAction(
  text: string,
  now = new Date(),
  path?: string
): void {
  try {
    const entry: LostAction = { text, at: now.toISOString() }
    if (path && path.startsWith('/') && !path.startsWith('//')) {
      entry.path = path
    }
    const list = [...readLostActions(), entry]
    storage()?.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {
    // ohne Speicher bleibt die Meldung auf der Seite selbst
  }
}

export function clearLostActions(): void {
  try {
    storage()?.removeItem(KEY)
  } catch {
    // nichts zu tun
  }
}

/** Die Seite der jüngsten verlorenen Aktion, die `allowed` zulässt. */
export function lostActionReturnPath(
  actions: LostAction[],
  allowed: (pathname: string) => boolean
): string | null {
  for (let i = actions.length - 1; i >= 0; i--) {
    const path = actions[i].path
    if (!path || !path.startsWith('/') || path.startsWith('//')) continue
    const pathname = path.split(/[?#]/)[0]
    if (allowed(pathname)) return path
  }
  return null
}
