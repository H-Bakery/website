import {
  experimental_extendTheme as extendTheme,
  type Theme,
} from '@mui/material/styles'

/** Mindestgröße für Touch-Ziele. */
export const TOUCH_TARGET = 44

/**
 * Hintergrund hinter der Szene, solange noch nichts gezeichnet ist: die
 * Horizontfarbe des Modells (sRGB 0,74 / 0,80 / 0,86). Die Szene bleibt in
 * beiden Modi hell - Dark Mode gilt nur für die Bedienelemente.
 */
export const SCENE_BACKDROP = '#bdccdb'

/**
 * Stapelfolge der Bedienelemente über der Szene. Dialoge („Alles hier“,
 * „Quellen“) liegen als MUI-Modal bei 1300 darüber.
 */
export const EBENE = {
  pfeile: 10,
  leiste: 11,
  hinweis: 12,
  sheet: 20,
  ladebild: 30,
} as const

/**
 * Ab hier gibt es Platz neben der Szene: Sheet und Liste stehen als Karte am
 * rechten Rand statt unten (Desktop und Handy im Querformat), damit sie das
 * Bild nicht verdecken.
 */
export const SEITLICH_ABFRAGE =
  '(min-width: 900px), (orientation: landscape) and (max-height: 500px)'
export const SEITLICH = `@media ${SEITLICH_ABFRAGE}`

/** Die Blickpunkt-Leiste passt in eine Zeile. */
export const LEISTE_EINZEILIG = '@media (min-width: 600px)'

/** Bewegung nur, wenn das Gerät sie nicht abgestellt hat. */
export const BEWEGUNG_OK = '@media (prefers-reduced-motion: no-preference)'
export const WENIGER_BEWEGUNG = '(prefers-reduced-motion: reduce)'

/** Abstand zum Rand, mit Rücksicht auf Notch und Home-Balken. */
export const rand = (
  seite: 'top' | 'right' | 'bottom' | 'left',
  px = 12
): string => `max(${px}px, env(safe-area-inset-${seite}))`

/**
 * Markenpalette (docs/brand-identity.md): Highlight #d038ba, für Text und
 * Flächen die dunklere Stufe #A02E94 (Kontrast), Dunkelbraun #5A2E2A, Crème
 * #FFF3E6, Text #3B2B28. Hell und dunkel nach `prefers-color-scheme`.
 * Systemschrift - keine Fremd-Fonts.
 */
const palette = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#a02e94', contrastText: '#ffffff' },
        secondary: { main: '#5a2e2a', contrastText: '#ffffff' },
        background: { default: '#fff3e6', paper: '#ffffff' },
        text: { primary: '#3b2b28', secondary: '#6b5a52' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#e666d3', contrastText: '#2a1420' },
        secondary: { main: '#e6d8c3', contrastText: '#3b2b28' },
        background: { default: '#1c1513', paper: '#2a201d' },
        text: { primary: '#fff3e6', secondary: '#d4c4b4' },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET, textTransform: 'none' },
      },
    },
    // Tastatur: Jeder Knopf zeigt den Fokus mit demselben kräftigen Rahmen
    // (Pfeile, „Alles hier“, „Quellen“, Knöpfe der Karte) - der Ripple
    // allein ist auf Weiß kaum zu sehen.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '3px solid',
            outlineOffset: 2,
          },
        },
      },
    },
    // Zeilen der Liste füllen die Breite: Rahmen nach innen.
    MuiListItemButton: {
      styleOverrides: {
        root: { '&.Mui-focusVisible': { outlineOffset: -3 } },
      },
    },
  },
})

/** Unter dieser Abfrage gilt das dunkle Schema - allein nach dem System. */
export const DUNKEL = '@media (prefers-color-scheme: dark)'

const wurzel = palette.generateCssVars()
const hell = palette.generateCssVars('light')
const dunkel = palette.generateCssVars('dark')

const istObjekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Tiefes Zusammenführen einfacher Objekte (die Variablen-Bäume von MUI). */
function vereine<T>(a: T, b: unknown): T {
  if (!istObjekt(a) || !istObjekt(b)) return (b === undefined ? a : b) as T
  const out: Record<string, unknown> = { ...a }
  for (const [key, wert] of Object.entries(b)) {
    out[key] = key in out ? vereine(out[key], wert) : wert
  }
  return out as T
}

/**
 * Das Theme der App. Hell oder dunkel entscheidet **allein das CSS** nach
 * `prefers-color-scheme` - ohne JavaScript, ohne Aufblitzen beim Laden und
 * ohne etwas auf dem Gerät zu speichern.
 *
 * Warum nicht `CssVarsProvider`: Der schreibt die Wahl in `localStorage`
 * (`mui-mode`, `mui-color-scheme-*`), auch ohne Umschalter. Die App verspricht
 * „keine Cookies“, und Gerätespeicher zählt rechtlich dazu (§ 25 TDDDG).
 * Darum hier dasselbe von Hand: Die Komponenten lesen ihre Farben aus
 * CSS-Variablen (`theme.vars`), `FARBSCHEMA_CSS` setzt sie für hell an
 * `:root` und überschreibt sie unter der Medienabfrage für dunkel.
 */
export const digitaleBaeckereiTheme = {
  ...palette,
  ...palette.colorSchemes.light,
  palette: { ...palette.colorSchemes.light.palette, colorScheme: 'light' },
  vars: vereine(vereine(wurzel.vars, hell.vars), dunkel.vars),
  getColorSchemeSelector: (schema: string) =>
    schema === 'dark' ? DUNKEL : '@media (prefers-color-scheme: light)',
} as unknown as Theme

/** Die CSS-Variablen beider Schemata für `<GlobalStyles>`. */
export const FARBSCHEMA_CSS = {
  ':root': { ...wurzel.css, ...hell.css, colorScheme: 'light dark' },
  [DUNKEL]: { ':root': dunkel.css },
}
