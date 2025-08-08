/**
 * Playwright Browser Configuration Helper
 * Ensures consistent viewport sizes and browser setup
 */

export interface ViewportConfig {
  width: number
  height: number
  deviceScaleFactor?: number
}

// Standard viewport configurations
export const VIEWPORTS = {
  // Desktop viewports
  DESKTOP_DEFAULT: { width: 1280, height: 720 } as ViewportConfig,
  DESKTOP_FULL_HD: { width: 1920, height: 1080 } as ViewportConfig,
  DESKTOP_LARGE: { width: 1440, height: 900 } as ViewportConfig,

  // Mobile viewports
  MOBILE_DEFAULT: {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
  } as ViewportConfig,
  MOBILE_LARGE: {
    width: 414,
    height: 896,
    deviceScaleFactor: 3,
  } as ViewportConfig,

  // Tablet viewports
  TABLET_DEFAULT: {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
  } as ViewportConfig,
  TABLET_LANDSCAPE: {
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
  } as ViewportConfig,
} as const

// Maximum dimensions for Claude's image processing
export const CLAUDE_MAX_DIMENSION = 8000

/**
 * Ensures the viewport is within Claude's maximum dimensions
 */
export function getClaudeSafeViewport(
  viewport: ViewportConfig
): ViewportConfig {
  const maxDimension = Math.max(viewport.width, viewport.height)

  if (maxDimension > CLAUDE_MAX_DIMENSION) {
    const scale = CLAUDE_MAX_DIMENSION / maxDimension
    return {
      width: Math.floor(viewport.width * scale),
      height: Math.floor(viewport.height * scale),
      deviceScaleFactor: viewport.deviceScaleFactor,
    }
  }

  return viewport
}

/**
 * Default browser setup configuration
 */
export const DEFAULT_BROWSER_CONFIG = {
  viewport: VIEWPORTS.DESKTOP_DEFAULT,
  ignoreHTTPSErrors: true,
  hasTouch: false,
  javascriptEnabled: true,
}

/**
 * Screenshot configuration defaults
 */
export const SCREENSHOT_CONFIG = {
  type: 'jpeg' as const,
  quality: 80,
  fullPage: false, // Always false to avoid Claude's dimension limits
}

/**
 * Helper to take a safe screenshot with proper viewport
 */
export async function takeClaudeSafeScreenshot(
  page: any,
  filename: string,
  options: any = {}
) {
  // Ensure viewport is set before screenshot
  const viewport = options.viewport || VIEWPORTS.DESKTOP_DEFAULT
  await page.setViewportSize(getClaudeSafeViewport(viewport))

  // Take screenshot with safe defaults
  return await page.screenshot({
    ...SCREENSHOT_CONFIG,
    path: filename,
    ...options,
    fullPage: false, // Always override to false
  })
}
