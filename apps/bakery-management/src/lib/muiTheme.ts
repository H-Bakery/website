import { createTheme, type Theme } from '@mui/material/styles'

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
 */
export function createManagementTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
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
  })
}
