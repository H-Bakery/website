/**
 * Farbschema der Fahrer-App: System / Hell / Dunkel.
 *
 * Die Farben selbst stehen als CSS-Variablen in `src/app/global.css`. Hier steht
 * nur, welche Wahl gilt und wie sie ans Dokument kommt - ueber das Attribut
 * `data-theme` auf `<html>`. Bei `system` wird das Attribut *entfernt*, damit
 * `@media (prefers-color-scheme: dark)` wieder greift; ein `data-theme="system"`
 * wuerde die Media Query nicht ersetzen, sondern nur im Weg stehen.
 */

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bakery-delivery-theme'

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark']

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
}

/** Vorlesbarer Zusatz fuer das `aria-label` der drei Knoepfe. */
export const THEME_DESCRIPTION: Record<ThemeChoice, string> = {
  system: 'Farbschema wie im Betriebssystem',
  light: 'Farbschema hell',
  dark: 'Farbschema dunkel',
}

/**
 * Die Adressleiste des Browsers. Kein CSS moeglich - Next liest das als
 * Metadatum, bevor irgendein Stylesheet gilt. Die Werte sind `--color-accent`
 * (hell) und `--color-bg` (dunkel) aus `global.css`; beide Stellen zusammen
 * aendern, sonst steht ueber der dunklen App ein heller Balken.
 */
export const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#8b4513',
  dark: '#16130f',
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark'
}

/**
 * Gespeicherte Wahl lesen. Wirft nie: im privaten Modus mancher Browser
 * knallt schon der Zugriff auf `localStorage`, und ein Farbschema ist kein
 * Grund, die Fahrer-App abstuerzen zu lassen.
 *
 * Nur im Effect aufrufen, nie waehrend des Renderns - Server und Client
 * kaemen sonst zu unterschiedlichem Markup (Hydration-Mismatch).
 */
export function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeChoice(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Kein Speicher - die Wahl gilt dann nur bis zum Neuladen.
  }
}

/** Setzt `data-theme` auf `<html>`. Muss zum Inline-Skript unten passen. */
export function applyTheme(choice: ThemeChoice): void {
  const root = typeof document === 'undefined' ? null : document.documentElement
  if (!root) return

  if (choice === 'light' || choice === 'dark') {
    root.setAttribute('data-theme', choice)
  } else {
    root.removeAttribute('data-theme')
  }
}

/**
 * Laeuft in `layout.tsx` als Inline-Skript im `<head>`, also **vor** dem ersten
 * Paint: ohne das blitzt die helle Seite auf, bevor React hydriert ist. Es steht
 * genau hier, damit Skript und `applyTheme()` nicht auseinanderlaufen koennen.
 *
 * Bewusst ohne `throw`-Pfad: ein Fehler im `<head>` wuerde die Seite anhalten,
 * und `localStorage` ist im privaten Modus mancher Browser schon beim Zugriff
 * ein Fehler.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(c==='dark'||c==='light'){document.documentElement.setAttribute('data-theme',c)}}catch(e){}})()`
