/**
 * `/api/rest` - „Rest am Abend“ (roadmap §6 M4, after the pilot). Mounted
 * below the global session guard; answers `{ success, data }`, errors
 * `{ success: false, error, message }` (German). Rules and formulas:
 * `services/rest-am-abend.core.js`.
 *
 *   GET  /?date=YYYY-MM-DD          verkauf, backstube: the day's count list
 *                                   (default today, Berlin) from the Backzettel
 *   PUT  /:date                     verkauf: { items: [{ itemId, variant?, productId?,
 *                                   qty | null, expected? }] } - all or nothing
 *   GET  /summary?from=&to=         inhaber: baked / sold / rest / rate per item
 *   GET  /summary.csv?from=&to=     inhaber: the same as CSV (csvCell)
 *   GET  /averages?weeks=6          backstube: Rest Ø per weekday (Grundmengen, info only)
 *
 * `inhaber` passes every role check. `fahrer` gets 403 everywhere. Station
 * (PIN) sessions are fine - the shop tablet is where Verkauf counts.
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requireRole } from '../auth/middleware'
import { BackzettelSource } from '../services/backzettel-source'
import {
  BackzettelError,
  BackzettelService,
} from '../services/backzettel.service'
import {
  createRestService,
  RestOptions,
} from '../services/rest-am-abend.service'
import { sendError } from '../utils/http-error'

const BOM = String.fromCharCode(0xfeff)

export type RestRouterOptions = RestOptions

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

export function createRestRouter(
  source: BackzettelSource,
  backzettel: BackzettelService,
  options: RestRouterOptions = {}
): Router {
  const service = createRestService(source, backzettel, options)
  const router = Router()
  const readers = requireRole('verkauf', 'backstube')
  const counters = requireRole('verkauf')
  const owner = requireRole('inhaber')
  const planners = requireRole('backstube')

  router.get(
    '/',
    readers,
    handle(async (req) => service.getDay(req.query as Record<string, unknown>))
  )

  router.get(
    '/summary',
    owner,
    handle(async (req) => service.summary(req.query as Record<string, unknown>))
  )

  router.get(
    '/summary.csv',
    owner,
    handle(async (req, res) => {
      const { csv, filename } = await service.summaryCsv(
        req.query as Record<string, unknown>
      )
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      // BOM voran, sonst zeigt Excel die Umlaute als Buchstabensalat.
      res.send(BOM + csv)
      return undefined
    })
  )

  router.get(
    '/averages',
    planners,
    handle(async (req) =>
      service.averages(req.query as Record<string, unknown>)
    )
  )

  router.put(
    '/:date',
    counters,
    handle(async (req) => service.saveDay(req.params['date'], req.body, req))
  )

  return router
}
