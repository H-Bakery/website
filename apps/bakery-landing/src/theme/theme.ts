'use client'
import { ThemeOptions, createTheme } from '@mui/material'

const headlines = {
  fontFamily: '"Cinzel", serif',
  fontWeight: 700,
}

const buttons = {
  fontFamily: '"Merriweather", serif',
  fontWeight: 700,
}

// Brand color palette
const brandColors = {
  // Primary - Dark Brown
  primary: {
    main: '#5A2E2A', // dark-brown
    light: '#928168', // macchiato
    dark: '#3B2B28', // text
    contrastText: '#FFFFFF',
  },
  // Secondary - Brand Highlight Magenta
  secondary: {
    main: '#d038ba', // highlight
    light: '#E87DD4', // light magenta
    dark: '#A82994', // deep magenta
    contrastText: '#FFFFFF',
  },
  // Warm scale mapped to brand palette
  warmScale: {
    50: '#FFF3E6', // cream (background)
    100: '#F5EDE4', // soft beige (surface)
    200: '#E6D8C3', // beige
    300: '#D4C4B0', // warm sand
    400: '#928168', // macchiato
    500: '#7A6B5D', // warm grey
    600: '#5A2E2A', // dark-brown
    700: '#4A3A35', // medium warm
    800: '#3B2B28', // text
    900: '#2A1F18', // dark warm (footer)
  },
  // Gold for star ratings
  gold: '#D4A574',
  // Leaf green for success/open states
  leafGreen: '#7A9B6B',
}

// Define common options across both themes
const getThemeOptions = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: brandColors.primary,
    secondary: brandColors.secondary,
    success: {
      main: brandColors.leafGreen,
    },
    warning: {
      main: brandColors.gold,
    },
    grey: {
      50: brandColors.warmScale[50],
      100: brandColors.warmScale[100],
      200: brandColors.warmScale[200],
      300: brandColors.warmScale[300],
      400: brandColors.warmScale[400],
      500: brandColors.warmScale[500],
      600: brandColors.warmScale[600],
      700: brandColors.warmScale[700],
      800: brandColors.warmScale[800],
      900: brandColors.warmScale[900],
    },
    background:
      mode === 'light'
        ? {
            paper: '#FFFFFF',
            default: brandColors.warmScale[50], // cream
          }
        : {
            paper: '#2A1F18',
            default: '#1A1310',
          },
    text:
      mode === 'light'
        ? {
            primary: brandColors.warmScale[800], // #3B2B28
            secondary: brandColors.warmScale[400], // macchiato #928168
            disabled: brandColors.warmScale[300],
          }
        : {
            primary: '#F5EDE4',
            secondary: '#928168',
            disabled: brandColors.warmScale[500],
          },
  },
  typography: {
    fontFamily:
      '"Merriweather", Georgia, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif',
    h1: { ...headlines, fontSize: '3rem', lineHeight: 1.2 },
    h2: { ...headlines, fontSize: '2.5rem', lineHeight: 1.3 },
    h3: { ...headlines, fontSize: '2rem', lineHeight: 1.4 },
    h4: { ...headlines, fontSize: '1.75rem', lineHeight: 1.4 },
    h5: { ...headlines, fontSize: '1.5rem', lineHeight: 1.5 },
    h6: { ...headlines, fontSize: '1.25rem', lineHeight: 1.5 },
    button: { ...buttons, letterSpacing: '0.5px' },
    body1: { lineHeight: 1.7, fontSize: '1.1rem' },
    body2: { lineHeight: 1.7, fontSize: '1rem' },
  },
})

// Create themes for both light and dark mode
export const lightTheme = createTheme(getThemeOptions('light'))
export const darkTheme = createTheme(getThemeOptions('dark'))

// Default to light theme
const theme = lightTheme

export default theme
