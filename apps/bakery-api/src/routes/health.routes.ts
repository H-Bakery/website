/**
 * Health check - the only route besides login that needs no session (D5).
 *
 * Answers 200 when the process is up and, if a database is passed in, a
 * `SELECT 1` succeeds; 503 otherwise. Mounted at `/health` (systemd / the
 * Telegram health check on the box) and at `/api/health` (reachable through
 * the Caddy `/api` proxy).
 */
import { Router } from 'express'
import { Sequelize } from 'sequelize'

export interface HealthOptions {
  sequelize?: Sequelize
  version?: string
}

export function createHealthRouter(options: HealthOptions = {}): Router {
  const router = Router()

  router.get('/', async (_req, res) => {
    const body: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] || 'development',
      version: options.version ?? process.env['APP_VERSION'] ?? 'dev',
    }

    if (options.sequelize) {
      try {
        await options.sequelize.query('SELECT 1')
        body['database'] = 'ok'
      } catch {
        body['status'] = 'error'
        body['database'] = 'error'
        res.status(503).json({
          ...body,
          success: false,
          error: 'database_unavailable',
          message: 'Die Datenbank ist nicht erreichbar.',
        })
        return
      }
    }

    res.json(body)
  })

  return router
}
