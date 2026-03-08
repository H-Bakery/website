import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'pr13-test.spec.ts',
  timeout: 30000,
  use: {
    headless: true,
  },
})
