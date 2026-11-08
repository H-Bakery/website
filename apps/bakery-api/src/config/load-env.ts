/**
 * Side-effect module: imported first by `main.ts`, before anything that reads
 * `process.env` while it is being imported (see `env.ts`).
 */
import { ConfigError, ensureJwtSecret, loadEnvFile } from './env'

loadEnvFile()

try {
  ensureJwtSecret()
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`[ERROR] ${error.message}`)
    process.exit(1)
  }
  throw error
}
