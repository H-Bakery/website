/**
 * `/api/backzettel` - the Backzettel (Z3, roadmap §5). Mounted below the
 * global session guard; every answer is `{ success, data }`, every error
 * `{ success: false, error, message }` (German).
 *
 *   GET  /config                                  any session: normalised config + validation,
 *                                                 Z4: pendingApproval, writable, working (write-worktree version)
 *   PUT  /config/base                             inhaber, backstube (Z4): one Grundmenge → hq (rolling PR)
 *   GET  /reference?weekday=&weeks=6              inhaber, backstube (Z4): median sold per item (info only)
 *   GET  /:date                                   any session: the day (draft live / confirmed frozen + deltas)
 *   GET  /:date/prep                              any session: Vorbereitung for the day (done on d−1)
 *   PUT  /:date/season                            inhaber, backstube: { factor } (draft only)
 *   PUT  /:date/lines/:itemId/correction          inhaber, backstube: { correction, reason } (draft only)
 *   PUT  /:date/lines/:itemId/:variant/correction   same, for one variant
 *   POST /:date/confirm                           inhaber, backstube: freeze lines + preorder snapshot
 *   POST /:date/reopen                            inhaber: back to draft { reason? }
 *   POST /:date/lines/:lineId/done | /undone      inhaber, backstube: tick (confirmed only);
 *                                                 done takes { expectedTotal } → 409 line_changed if more is due now
 *   POST /:date/deltas/:id/ack                    inhaber, backstube: mark a delta as seen
 *   POST /:date/deltas/ack                        same for { ids: [...] } at once (all or nothing)
 *
 * Season and correction PUTs take the value the editor started from
 * (`expectedFactor`, `expected: { correction, reason }`); a different stored
 * value is 409 `season_changed` / `correction_changed` (W4-verify r4).
 *
 * Missing or invalid master data: GET answers `status: 'no-config'` with
 * `reasons` (a confirmed day stays readable, with `configStatus: 'no-config'`);
 * writes answer 409 `no_config`. A non-production weekday is 409 `ruhetag`.
 * Planning writes (season, correction, confirm) outside today − 7 … today + 90
 * days (Berlin) are 400 `date_out_of_range` (W4 verification).
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requireRole } from '../auth/middleware'
import {
  BackzettelSource,
  BackzettelSourceOptions,
  createBackzettelSource,
} from '../services/backzettel-source'
import {
  BackzettelError,
  BackzettelHooks,
  BackzettelService,
  createBackzettelService,
} from '../services/backzettel.service'
import {
  BackzettelConfigWriteOptions,
  createBackzettelConfigWriter,
} from '../services/backzettel-config-write'
import {
  BackzettelReferenceOptions,
  createBackzettelReference,
} from '../services/backzettel-reference'
import { sendError } from '../utils/http-error'

export type BackzettelRouterOptions = BackzettelSourceOptions &
  BackzettelHooks & {
    /** Z4: where Grundmengen are written (B5 write worktree + B5b hooks). */
    write?: BackzettelConfigWriteOptions
    /** Z4: cash-register reports for the reference column. */
    reference?: BackzettelReferenceOptions
  }

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
  return createBackzettel(options).router
}

/**
 * Router plus service: `app.ts` hands `service.recordPreorderDeltas` to the
 * preorders (W4: deltas are recorded on the preorder write path) and runs
 * `service.reconcileConfirmedDays` once at start.
 */
export function createBackzettel(options: BackzettelRouterOptions = {}): {
  router: Router
  service: BackzettelService
  /** The master-data source, shared with „Rest am Abend“ (M4). */
  source: BackzettelSource
} {
  const source = createBackzettelSource(options)
  const service = createBackzettelService(source, {
    onConfirmed: options.onConfirmed,
    onReopened: options.onReopened,
    now: options.now,
  })
  const writer = createBackzettelConfigWriter(source, options.write)
  const reference = createBackzettelReference(source, options.reference)
  const router = Router()
  const planners = requireRole('backstube') // inhaber passes every check
  const owner = requireRole('inhaber')

  router.get(
    '/config',
    handle(async () => ({ ...service.getConfig(), ...(await writer.status()) }))
  )

  // Z4 - before `/:date`, which would otherwise take "reference" as a date.
  router.put(
    '/config/base',
    planners,
    handle(async (req) => ({
      ...service.getConfig(),
      ...(await writer.setBase(req.body, {
        id: req.user?.id ?? null,
        displayName: req.user?.displayName || 'unbekannt',
      })),
    }))
  )

  router.get(
    '/reference',
    planners,
    handle(async (req) => reference.get(req.query as Record<string, unknown>))
  )

  router.get(
    '/:date',
    handle(async (req) => service.getDay(req.params['date']))
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
      service.setDone(
        req.params['date'],
        req.params['lineId'],
        true,
        req,
        req.body
      )
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
    '/:date/deltas/ack',
    planners,
    handle(async (req) =>
      service.acknowledgeDeltas(req.params['date'], req.body, req)
    )
  )

  router.post(
    '/:date/deltas/:id/ack',
    planners,
    handle(async (req) =>
      service.acknowledgeDelta(req.params['date'], req.params['id'], req)
    )
  )

  return { router, service, source }
}
