import { createTheme, type Theme } from '@mui/material/styles'
import { deDE } from '@mui/material/locale'

/**
 * Touch-Geräte (Handy, Laden-Tablet, Backstube) und schmale Fenster: Knöpfe
 * mindestens 44 × 44 px (W4-Verifikation: 31-40 px auf Backschrank,
 * Dashboard, Backliste und in der AppBar). Am Büro-PC mit Maus bleibt MUI
 * kompakt.
 */
export const TOUCH_MEDIA = '@media (pointer: coarse), (max-width: 1199.95px)'

/** MUI-Breakpoint `md` (Seitenleiste fest, größere Überschriften). */
const MD_MIN_WIDTH = 900

/** Inline-Links (Telefonnummer, Kurzcode) als 44-px-Touch-Ziel. */
export const TOUCH_LINK_STYLE = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  minWidth: 44,
} as const

/**
 * MUI-Theme der Verwaltung (W4-Verifikation: Kontrast).
 *
 * Zwei Abweichungen vom MUI-Standard, beide wegen 4,5:1 für kleine Schrift:
 *
 * - `contrastThreshold: 4.5` - MUI wählt die Schriftfarbe auf `*.main`
 *   (Chips, gefüllte Knöpfe) erst ab 4,5:1 weiß, sonst schwarz. Mit dem
 *   Standard 3 stand Weiß auf Orange (#ed6c02, 3,1:1), auf Info-Blau (3,9:1)
 *   und im Dunkelmodus auf Rot (#f44336, 3,7:1).
 * - Hell: `warning.main` #a14a00 (weiß darauf 6,0:1, als Text auf Weiß
 *   6,0:1, auf dem 14-%-Tönungsgrund 4,9:1) und `info.main` #0277bd
 *   (4,8:1). Das MUI-Orange #ed6c02 erreicht als Text nur 3,1:1.
 *
 * `primary`, Hintergründe und Papier bleiben MUI-Standard - `pwa.spec.ts`
 * rechnet die Statusleistenfarben daraus nach.
 *
 * Sprache: MUI-Locale `deDE` - sonst heißt das X einer Meldung „Close“
 * (W4-Verifikation Runde 3), ebenso Autocomplete und Tabellen-Blättern.
 */
/** Schrift von Text-/Umriss-Knöpfen im hellen Modus (MUI `primary.dark`). */
export const LIGHT_PRIMARY_TEXT = '#1565c0'

/**
 * Tastatur-Fokusring (Review r2, a11y): MUI setzt an jedem `ButtonBase`
 * `outline: 0` und zeigt Fokus nur als Ripple - weiß auf der blauen AppBar
 * (1,9:1), `rgba(0,0,0,.08)` auf Stations-Kacheln (1,1:1), an einem
 * ungeschalteten Switch im hellen Modus weiß auf weiß (unsichtbar). Darum
 * ein Ring in `primary` (hell `primary.dark`, 5,8:1 auf Weiß; dunkel
 * #90caf9, 9,6:1 auf `paper`), in der AppBar in Schriftfarbe.
 */
export const FOCUS_RING_COLOR = {
  light: LIGHT_PRIMARY_TEXT,
  dark: '#90caf9',
} as const

/** Nur bei Tastaturfokus (`Mui-focusVisible`), nie beim Tippen/Klicken. */
export function focusRing(color: string, offset = 2) {
  return {
    outline: '2px solid',
    outlineColor: color,
    outlineOffset: offset,
  } as const
}

export function createManagementTheme(mode: 'light' | 'dark'): Theme {
  const ring = FOCUS_RING_COLOR[mode]
  return createTheme(
    {
      palette: {
        mode,
        contrastThreshold: 4.5,
        ...(mode === 'light'
          ? {
              warning: { main: '#a14a00' },
              info: { main: '#0277bd' },
            }
          : {}),
      },
      // Layout-Kit (src/components/layout): `h1` ist der Seitentitel
      // (PageHeader), `h2` die Abschnittsüberschrift (PageSection) - je eine
      // Größe für die ganze App statt h3/h4/h5/h6 nach Laune. Am Handy kleiner,
      // damit lange Titel („Abholliste Gemeindehaus …“) nicht drei Zeilen
      // füllen. h3-h6 bleiben MUI-Standard (Kennzahlen, Altseiten).
      typography: {
        h1: {
          fontSize: '1.625rem',
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: 0,
          [`@media (min-width:${MD_MIN_WIDTH}px)`]: { fontSize: '2rem' },
        },
        h2: {
          fontSize: '1.125rem',
          fontWeight: 600,
          lineHeight: 1.35,
          letterSpacing: 0,
          [`@media (min-width:${MD_MIN_WIDTH}px)`]: { fontSize: '1.25rem' },
        },
      },
      shape: { borderRadius: 8 },
      components: {
        // Fokusring für alles Klickbare (Knöpfe, Chips, Reiter, Kacheln,
        // Listeneinträge). Einträge in Listen und Menüs innen (-2), weil die
        // scrollende Seitenleiste / das Menü einen Ring außen abschnitte.
        MuiButtonBase: {
          styleOverrides: {
            root: {
              '&.Mui-focusVisible': focusRing(ring),
              '&.MuiListItemButton-root.Mui-focusVisible, &.MuiMenuItem-root.Mui-focusVisible':
                { outlineOffset: -2 },
              // Blaue AppBar (hell): ein blauer Ring verschwände - dort in
              // der Schriftfarbe der Leiste (contrastText).
              '.MuiAppBar-root &.Mui-focusVisible': {
                outlineColor: 'currentColor',
              },
            },
          },
        },
        // Tabellenköpfe überall gleich: halbfett, damit Kopf und Daten auch
        // ohne Hintergrundfarbe (grey.* ist im Dunkelmodus verboten) trennen.
        MuiTableCell: {
          styleOverrides: { head: { fontWeight: 600 } },
        },
        MuiButton: {
          styleOverrides: {
            root: { [TOUCH_MEDIA]: { minHeight: 44 } },
            // W4-verify r4: blaue Schrift auf hellem Grund (Hover-Tönung,
            // grauer Kartengrund #f4f4f4) fiel mit `primary.main` #1976d2
            // auf 4,2-4,4:1. Hell deshalb `primary.dark` für Text- und
            // Umriss-Knöpfe; der Rahmen und gefüllte Knöpfe bleiben.
            ...(mode === 'light'
              ? {
                  textPrimary: { color: LIGHT_PRIMARY_TEXT },
                  outlinedPrimary: { color: LIGHT_PRIMARY_TEXT },
                }
              : {}),
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: { [TOUCH_MEDIA]: { minWidth: 44, minHeight: 44 } },
          },
        },
        MuiToggleButton: {
          styleOverrides: { root: { [TOUCH_MEDIA]: { minHeight: 44 } } },
        },
        // W4-verify r2: auch Eingabefelder (Datum, Ort, Suche - `size="small"`
        // waren 40 px) und Schalter (38 px) auf dem Handy mindestens 44 px.
        MuiInputBase: {
          styleOverrides: { root: { [TOUCH_MEDIA]: { minHeight: 44 } } },
        },
        MuiSwitch: {
          styleOverrides: {
            root: {
              // Fokus am Daumen statt als Ring um den runden switchBase: der
              // Ripple eines ungeschalteten Schalters ist im hellen Modus
              // weiß auf weißer Karte (Review r2, „Tage ohne Bericht
              // ausblenden“, „Noch nicht bezahlt“).
              '& .MuiSwitch-switchBase.Mui-focusVisible': { outline: 'none' },
              '& .MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb':
                focusRing(ring),
              [TOUCH_MEDIA]: {
                '&.MuiSwitch-sizeMedium': {
                  width: 64,
                  height: 44,
                  padding: 15,
                  '& .MuiSwitch-switchBase': { padding: 12 },
                },
              },
            },
          },
        },
      },
    },
    deDE
  )
}
