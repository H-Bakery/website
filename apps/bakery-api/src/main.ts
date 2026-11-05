/**
 * Entry point of the bundle (`dist/apps/bakery-api/bundle/main.js`).
 *
 * `./config/load-env` must stay the first import: it loads `.env` and the
 * JWT secret before the auth lib reads them while it is being imported.
 */
import './config/load-env'

import { ConfigError } from './config/env'
import { startServer } from './server'

startServer()
  .then((running) => {
    const shutdown = (signal: string) => {
      console.log(`[INFO] ${signal} received, shutting down`)
      running
        .close()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('[ERROR] Shutdown failed', error)
          process.exit(1)
        })
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  })
  .catch((error) => {
    if (error instanceof ConfigError) {
      console.error(`[ERROR] ${error.message}`)
    } else {
      console.error('[ERROR] Failed to start bakery-api', error)
    }
    process.exit(1)
  })
