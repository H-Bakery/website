import { experimental_extendTheme as extendTheme } from '@mui/material/styles'

/** Mindestgröße für Touch-Ziele. */
export const TOUCH_TARGET = 44

/**
 * Hintergrund hinter der Szene, solange noch nichts gezeichnet ist: die
 * Horizontfarbe des Modells (sRGB 0,74 / 0,80 / 0,86). Die Szene bleibt in
 * beiden Modi hell - Dark Mode gilt nur für die Bedienelemente.
 */
export const SCENE_BACKDROP = '#bdccdb'

/**
 * Markenpalette (docs/brand-identity.md): Highlight #d038ba, für Text und
 * Flächen die dunklere Stufe #A02E94 (Kontrast), Dunkelbraun #5A2E2A, Crème
 * #FFF3E6, Text #3B2B28. Hell und dunkel nach `prefers-color-scheme`.
 * Systemschrift - keine Fremd-Fonts.
 */
export const digitaleBaeckereiTheme = extendTheme({
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
  },
})
