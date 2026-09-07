/**
 * @fileoverview Anmeldung, die es nicht gibt.
 *
 * Die Verwaltung hat keinen Login - `/admin/login` existiert nicht, und die
 * `data-testid`s unten kommen in der App nicht vor. Die Datei gehört zu
 * `management-workflows.spec.ts` (übersprungen) und wird von keinem
 * Playwright-Projekt mehr aufgenommen: `playwright.config.ts` hat kein
 * `setup`-Projekt. Sie bleibt als Vorlage, falls eine Anmeldung gebaut wird.
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  // Perform authentication steps
  await page.goto('/admin/login')

  // Fill login form
  await page.fill('[data-testid="email-input"]', 'admin@bakery.com')
  await page.fill('[data-testid="password-input"]', 'admin123')

  // Submit form
  await page.click('[data-testid="login-button"]')

  // Wait for redirect to admin dashboard
  await page.waitForURL('/admin')

  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  await expect(page.locator('[data-testid="user-email"]')).toContainText(
    'admin@bakery.com'
  )

  // Save signed-in state
  await page.context().storageState({ path: authFile })
})
