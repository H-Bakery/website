'use client'
import { ThemeOptions, createTheme } from '@mui/material'

const headlines = {
  fontFamily: 'Averia Serif Libre',
}

const buttons = {
  fontFamily: 'Averia Serif Libre',
}

// Define common options across both themes
const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#D038BA',
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
    fontFamily: "'Ubuntu', sans-serif",
    h1: { ...headlines },
    h2: { ...headlines },
    h3: { ...headlines },
    h4: { ...headlines },
    h5: { ...headlines },
    h6: { ...headlines },
    button: { ...buttons },
  },
})

// Create themes for both light and dark mode
export const lightTheme = createTheme(getThemeOptions('light'))
export const darkTheme = createTheme(getThemeOptions('dark'))

// Default to light theme
const theme = lightTheme

export default theme
