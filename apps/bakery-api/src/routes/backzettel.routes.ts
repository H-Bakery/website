/**
 * `/api/backzettel` - the Backzettel (Z3, roadmap §5). Mounted below the
 * global session guard; every answer is `{ success, data }`, every error
 * `{ success: false, error, message }` (German).
 *
 *   GET  /config                                  any session: normalised config + validation
 *   GET  /:date                                   any session: the day (draft live / confirmed frozen + deltas)
 *   GET  /:date/prep                              any session: Vorbereitung for the day (done on d−1)
 *   PUT  /:date/season                            inhaber, backstube: { factor } (draft only)
 *   PUT  /:date/lines/:itemId/correction          inhaber, backstube: { correction, reason } (draft only)
 *   PUT  /:date/lines/:itemId/:variant/correction   same, for one variant
 *   POST /:date/confirm                           inhaber, backstube: freeze lines + preorder snapshot
 *   POST /:date/reopen                            inhaber: back to draft { reason? }
 *   POST /:date/lines/:lineId/done | /undone      inhaber, backstube: tick (confirmed only)
 *   POST /:date/deltas/:id/ack                    inhaber, backstube: mark a delta as seen
 *
 * Missing or invalid master data: GET answers `status: 'no-config'` with
 * `reasons` (a confirmed day stays readable, with `configStatus: 'no-config'`);
 * writes answer 409 `no_config`. A non-production weekday is 409 `ruhetag`.
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requireRole } from '../auth/middleware'
import {
  BackzettelSourceOptions,
  createBackzettelSource,
} from '../services/backzettel-source'
import {
  BackzettelError,
  BackzettelHooks,
  createBackzettelService,
} from '../services/backzettel.service'
import { sendError } from '../utils/http-error'

export type BackzettelRouterOptions = BackzettelSourceOptions & BackzettelHooks

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

export function createBackzettelRouter(
  options: BackzettelRouterOptions = {}
): Router {
  const service = createBackzettelService(createBackzettelSource(options), {
    onConfirmed: options.onConfirmed,
  })
  const router = Router()
  const planners = requireRole('backstube') // inhaber passes every check
  const owner = requireRole('inhaber')

  router.get(
    '/config',
    handle(async () => service.getConfig())
  )

  router.get(
    '/:date',
    handle(async (req) => service.getDay(req.params['date'], { req }))
  )

  router.get(
    '/:date/prep',
    handle(async (req) => service.getPrep(req.params['date']))
  )

  router.put(
    '/:date/season',
    planners,
    handle(async (req) =>
      service.setSeasonFactor(req.params['date'], req.body, req)
    )
  )

  router.put(
    '/:date/lines/:itemId/correction',
    planners,
    handle(async (req) =>
      service.setCorrection(
        req.params['date'],
        req.params['itemId'],
        undefined,
        req.body,
        req
      )
    )
  )

  router.put(
    '/:date/lines/:itemId/:variant/correction',
    planners,
    handle(async (req) =>
      service.setCorrection(
        req.params['date'],
        req.params['itemId'],
        req.params['variant'],
        req.body,
        req
      )
    )
  )

  router.post(
    '/:date/confirm',
    planners,
    handle(async (req) => service.confirm(req.params['date'], req))
  )

  router.post(
    '/:date/reopen',
    owner,
    handle(async (req) => service.reopen(req.params['date'], req.body, req))
  )

  router.post(
    '/:date/lines/:lineId/done',
    planners,
    handle(async (req) =>
      service.setDone(req.params['date'], req.params['lineId'], true, req)
    )
  )

  router.post(
    '/:date/lines/:lineId/undone',
    planners,
    handle(async (req) =>
      service.setDone(req.params['date'], req.params['lineId'], false, req)
    )
  )

  router.post(
    '/:date/deltas/:id/ack',
    planners,
    handle(async (req) =>
      service.acknowledgeDelta(req.params['date'], req.params['id'], req)
    )
  )

  return router
}
