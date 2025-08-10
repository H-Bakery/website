/**
 * Color accessibility utilities
 * Ensures WCAG AA compliance for color contrast
 */

import { darken, lighten, alpha } from '@mui/material/styles'

/**
 * Calculate relative luminance of a color
 * Based on WCAG formula
 */
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16)
  const r = (rgb >> 16) & 0xff
  const g = (rgb >> 8) & 0xff
  const b = (rgb >> 0) & 0xff

  const sRGB = [r, g, b].map((val) => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function getContrastRatio(
  foreground: string,
  background: string
): number {
  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if color combination meets WCAG AA standards
 * Normal text: 4.5:1 minimum
 * Large text: 3:1 minimum
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  largeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return largeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * Check if color combination meets WCAG AAA standards
 * Normal text: 7:1 minimum
 * Large text: 4.5:1 minimum
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  largeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)
  return largeText ? ratio >= 4.5 : ratio >= 7
}

/**
 * Adjust color to meet contrast requirements
 * Darkens or lightens the color until it meets the target ratio
 */
export function adjustColorForContrast(
  color: string,
  background: string,
  targetRatio = 4.5,
  preferDarken = true
): string {
  let adjustedColor = color
  let ratio = getContrastRatio(adjustedColor, background)
  let step = 0

  while (ratio < targetRatio && step < 20) {
    step += 0.05
    adjustedColor = preferDarken ? darken(color, step) : lighten(color, step)
    ratio = getContrastRatio(adjustedColor, background)
  }

  return adjustedColor
}

/**
 * Get accessible text color for a given background
 * Returns either dark or light text based on background luminance
 */
export function getAccessibleTextColor(background: string): string {
  const luminance = getLuminance(background)
  // Use dark text on light backgrounds, light text on dark backgrounds
  return luminance > 0.5 ? '#131F37' : '#FFFFFF'
}

/**
 * Primary brand color adjustments for accessibility
 */
export const accessibleColors = {
  // Original brand color
  primaryOriginal: '#D038BA',

  // Darker version for better contrast on white
  primaryDark: '#A02E94', // Adjusted for 4.5:1 on white

  // Even darker for small text
  primaryDarker: '#7A2270', // Adjusted for 7:1 on white

  // Lighter version for dark backgrounds
  primaryLight: '#E666D3',

  // Very light for backgrounds
  primaryBackground: alpha('#D038BA', 0.08),

  // For hover states
  primaryHover: '#B530A3',
}

/**
 * Check common color combinations in the app
 */
export const colorChecks = {
  // Primary on white
  primaryOnWhite: {
    original: getContrastRatio('#D038BA', '#FFFFFF'),
    adjusted: getContrastRatio(accessibleColors.primaryDark, '#FFFFFF'),
  },

  // White on primary
  whiteOnPrimary: {
    original: getContrastRatio('#FFFFFF', '#D038BA'),
    needsAdjustment: !meetsWCAGAA('#FFFFFF', '#D038BA'),
  },

  // Primary on light gray
  primaryOnGray: {
    original: getContrastRatio('#D038BA', '#F6F8FC'),
    adjusted: getContrastRatio(accessibleColors.primaryDark, '#F6F8FC'),
  },
}
