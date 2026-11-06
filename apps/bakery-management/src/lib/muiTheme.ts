import { createTheme, type Theme } from '@mui/material/styles'
import { deDE } from '@mui/material/locale'

/**
 * Touch-Geräte (Handy, Laden-Tablet, Backstube) und schmale Fenster: Knöpfe
 * mindestens 44 × 44 px (W4-Verifikation: 31-40 px auf Backschrank,
 * Dashboard, Backliste und in der AppBar). Am Büro-PC mit Maus bleibt MUI
 * kompakt.
 */
export const TOUCH_MEDIA = '@media (pointer: coarse), (max-width: 1199.95px)'

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
export function createManagementTheme(mode: 'light' | 'dark'): Theme {
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
      components: {
        MuiButton: {
          styleOverrides: { root: { [TOUCH_MEDIA]: { minHeight: 44 } } },
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
