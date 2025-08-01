'use client'
import { ThemeOptions, createTheme } from '@mui/material'

const headlines = {
  fontFamily: '"Playfair Display", serif',
  fontWeight: 700,
}

const buttons = {
  fontFamily: '"Lora", serif',
  fontWeight: 500,
}

// Define common options across both themes
const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#D038BA',
      dark: '#A02E94', // WCAG AA compliant on white backgrounds
      light: '#E666D3',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#1ADA67',
    },
    grey: {
      50: '#F6F8FC',
      100: '#F2F5FB',
      200: '#E8EEFB',
      300: '#D8E1F4',
      400: '#B0BFD9',
      500: '#909FBE',
      600: '#677695',
      700: '#485776',
      800: '#293858',
      900: '#131F37',
    },
    background: mode === 'light' 
      ? {
          paper: '#FFFFFF',
          default: '#F6F8FC',
        }
      : {
          paper: '#1E1E1E',
          default: '#121212',
        },
    text: mode === 'light'
      ? {
          primary: '#131F37',
          secondary: '#485776',
          disabled: '#909FBE',
        }
      : {
          primary: '#FFFFFF',
          secondary: '#B0BFD9',
          disabled: '#677695',
        },
  },
  typography: {
    fontFamily: '"Lora", "Ubuntu", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { ...headlines, fontSize: '3.5rem', lineHeight: 1.2 },
    h2: { ...headlines, fontSize: '2.75rem', lineHeight: 1.3 },
    h3: { ...headlines, fontSize: '2.25rem', lineHeight: 1.4 },
    h4: { ...headlines, fontSize: '1.75rem', lineHeight: 1.4 },
    h5: { ...headlines, fontSize: '1.5rem', lineHeight: 1.5 },
    h6: { ...headlines, fontSize: '1.25rem', lineHeight: 1.5 },
    button: { ...buttons, letterSpacing: '0.5px' },
    body1: { lineHeight: 1.7, fontSize: '1.05rem' },
    body2: { lineHeight: 1.6, fontSize: '0.95rem' },
  },
})

// Create themes for both light and dark mode
export const lightTheme = createTheme(getThemeOptions('light'))
export const darkTheme = createTheme(getThemeOptions('dark'))

// Default to light theme
const theme = lightTheme

export default theme
