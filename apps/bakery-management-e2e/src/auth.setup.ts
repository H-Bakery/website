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
