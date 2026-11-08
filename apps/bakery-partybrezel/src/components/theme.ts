import { experimental_extendTheme as extendTheme } from '@mui/material/styles'

/** Mindestgröße für Touch-Ziele. */
export const TOUCH_TARGET = 44

/**
 * Hell und dunkel nach `prefers-color-scheme` (CssVarsProvider, Modus
 * "system"). Kontrastschwelle 4,5:1 wie in der Verwaltung.
 */
export const partybrezelTheme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#8a4b14' },
        secondary: { main: '#5c6b2e' },
        background: { default: '#fbf6ef', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#e8ad66' },
        secondary: { main: '#b9c98a' },
        background: { default: '#16110c', paper: '#221b14' },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 700 },
    h2: { fontSize: '1.35rem', fontWeight: 700 },
    h3: { fontSize: '1.1rem', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET, textTransform: 'none' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET, textTransform: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { minHeight: TOUCH_TARGET, height: 'auto', fontSize: '0.95rem' },
        label: { paddingTop: 6, paddingBottom: 6, whiteSpace: 'normal' },
      },
    },
    MuiStepButton: {
      styleOverrides: { root: { minHeight: TOUCH_TARGET } },
    },
  },
})
