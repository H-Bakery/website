/**
 * `/api/abgleich` - „Abgleich Produktion ↔ Kasse“, only `inhaber`. Mounted
 * below the global session guard; answers `{ success, data }`, errors
 * `{ success: false, error, message }` (German). Rules and formulas:
 * `services/abgleich.core.js`.
 *
 *   GET /?from=&to=&folgetag=  Stück je Posten und Euro je Backtag/Abschnitt
 *   GET /csv?from=&to=   the same as CSV (csvCell, BOM)
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requireRole } from '../auth/middleware'
import {
  createAbgleichService,
  AbgleichOptions,
} from '../services/abgleich.service'
import { BackzettelSource } from '../services/backzettel-source'
import {
  BackzettelError,
  BackzettelService,
} from '../services/backzettel.service'
import { sendError } from '../utils/http-error'

const BOM = String.fromCharCode(0xfeff)

export type AbgleichRouterOptions = AbgleichOptions

function handle(
  fn: (req: Request, res: Response) => Promise<unknown>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).then(
      (data) => {
        if (!res.headersSent) res.json({ success: true, data })
      },
      (error) => {
        if (error instanceof BackzettelError) {
          sendError(res, error.status, error.code, error.message, error.extra)
          return
        }
        next(error)
      }
    )
  }
}

export function createAbgleichRouter(
  source: BackzettelSource,
  backzettel: BackzettelService,
  options: AbgleichRouterOptions = {}
): Router {
  const service = createAbgleichService(source, backzettel, options)
  const router = Router()
  const owner = requireRole('inhaber')

  router.get(
    '/',
    owner,
    handle(async (req) =>
      service.reconcile(req.query as Record<string, unknown>)
    )
  )

  router.get(
    '/csv',
    owner,
    handle(async (req, res) => {
      const { csv, filename } = await service.csv(
        req.query as Record<string, unknown>
      )
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      // BOM voran, sonst zeigt Excel die Umlaute als Buchstabensalat.
      res.send(BOM + csv)
      return undefined
    })
  )

  return router
}
