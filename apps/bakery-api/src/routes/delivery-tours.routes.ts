/**
 * Liefertouren (B8) im Mock-Vertrag von `simple-server.js` (D3): rohe
 * Objekte ohne Hülle, Mock-Fehlercodes (`Tour not found`, …) plus deutsche
 * `message` - über `sendError`, also zusätzlich `success: false`. Die
 * Fahrer-App (`apps/bakery-delivery`) läuft damit unverändert.
 *
 *   GET    /depot                         verkauf, fahrer
 *   PUT    /depot                         inhaber
 *   GET    /drivers[?active=true|false]   verkauf, fahrer
 *   POST   /drivers                       inhaber      (+ `userId`, B8)
 *   PUT    /drivers/:id                   inhaber
 *   GET    /tours[?date&driverId&status]  verkauf, fahrer (nur eigene Touren)
 *   POST   /tours                         inhaber
 *   GET    /tours/:id                     verkauf, fahrer (eigene, sonst 403)
 *   PATCH  /tours/:id                     inhaber
 *   DELETE /tours/:id                     inhaber
 *   POST   /tours/:id/stops               inhaber
 *   PATCH  /tours/:id/stops/:stopId       inhaber; fahrer eigene Tour, nur abhaken
 *   DELETE /tours/:id/stops/:stopId       inhaber
 *   POST   /tours/:id/optimize            inhaber; fahrer eigene Tour
 *   POST   /tours/:id/position            inhaber; fahrer eigene Tour
 *   POST   /geocode                       inhaber
 *
 * `inhaber` besteht jede Rollenprüfung; `backstube` bekommt überall 403.
 * Gemountet in `app.ts` auf `/api/deliveries`, neben dem Mörsbach-Alias
 * (`preorders.routes.ts`, Pfade `/pickup-points*` und `/preorders*`) - die
 * Pfade überschneiden sich nicht.
 */
import { Request, Response, Router } from 'express'

import { asyncHandler, requireRole } from '../auth/middleware'
import {
  DeliveryToursService,
  FAHRER_STOP_FIELDS,
  PlainTour,
  TourAccess,
  isFailure,
  mayAccess,
  mockDepot,
  parseId,
} from '../services/delivery-tours.service'
import type { Result } from '../services/preorders.service'
import { sendError } from '../utils/http-error'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../services/delivery-tours.core')
/* eslint-enable @typescript-eslint/no-var-requires */

const READ_ROLES = ['verkauf', 'fahrer'] as const // inhaber passes every check

function fail(res: Response, result: Result<unknown>): boolean {
  if (!isFailure(result)) return false
  sendError(res, result.status, result.error, result.message, result.extra)
  return true
}

function tourNotFound(res: Response): void {
  sendError(res, 404, 'Tour not found', 'Diese Tour existiert nicht.')
}

/**
 * Welche Touren diese Sitzung sehen und abhaken darf: ein `fahrer` nur die
 * Touren des Fahrers, dem sein Konto zugeordnet ist (`delivery_drivers.user_id`).
 * Ohne Zuordnung keine.
 */
async function accessFor(
  service: DeliveryToursService,
  req: Request
): Promise<TourAccess> {
  if (req.user?.role !== 'fahrer') return { driverIds: null }
  return { driverIds: await service.ownDriverIds(req.user.id) }
}

export function createDeliveryToursRouter(
  service: DeliveryToursService
): Router {
  const router = Router()

  const respondTour = async (
    res: Response,
    result: Result<PlainTour>,
    status?: number
  ) => {
    if (fail(res, result) || !result.ok) return
    const [decorated] = await service.decorate([result.data])
    res.status(status ?? result.status).json(decorated)
  }

  /** `:id` → Tournummer, sonst 404 wie im Mock (`Number('x')` findet nichts). */
  const tourId = (req: Request, res: Response): number | null => {
    const id = parseId(req.params['id'])
    if (id === null) tourNotFound(res)
    return id
  }

  // ---------------------------------------------------------------- depot

  router.get(
    '/depot',
    requireRole(...READ_ROLES),
    asyncHandler(async (_req, res) => {
      res.json(mockDepot(await service.depot()))
    })
  )

  router.put(
    '/depot',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.updateDepot(req.body, req)
      if (fail(res, result) || !result.ok) return
      res.json(mockDepot(result.data))
    })
  )

  // -------------------------------------------------------------- drivers

  router.get(
    '/drivers',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const { active } = req.query
      res.json(
        await service.drivers(
          active === undefined ? undefined : active === 'true'
        )
      )
    })
  )

  router.post(
    '/drivers',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.createDriver(req.body, req)
      if (fail(res, result) || !result.ok) return
      res.status(201).json(result.data)
    })
  )

  router.put(
    '/drivers/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.updateDriver(req.params['id'], req.body, req)
      if (fail(res, result) || !result.ok) return
      res.json(result.data)
    })
  )

  // ---------------------------------------------------------------- tours

  router.get(
    '/tours',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const { date, driverId, status } = req.query
      if (date !== undefined && !core.isBusinessDate(date)) {
        sendError(
          res,
          400,
          'Invalid date',
          'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
        )
        return
      }
      const access = await accessFor(service, req)
      const where: Record<string, unknown> = {}
      if (date !== undefined) where['date'] = date
      let list = await service.loadTours(where)
      // Filter wie im Mock (`Number(driverId)`, Status als Text).
      if (driverId !== undefined) {
        list = list.filter((t) => t.driverId === Number(driverId))
      }
      if (status !== undefined) {
        list = list.filter((t) => t.status === status)
      }
      // Ein Fahrer sieht nur seine Touren - still gefiltert, keine 403: die
      // App fragt ohne `driverId` nach dem Tag.
      list = list.filter((t) => mayAccess(t, access))
      const depot = await service.depot()
      await service.hydrate(list, depot)
      res.json(await service.decorate(list, depot))
    })
  )

  router.post(
    '/tours',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      await respondTour(res, await service.createTour(req.body, req), 201)
    })
  )

  router.get(
    '/tours/:id',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      const tour = await service.loadTour(id)
      if (!tour) return tourNotFound(res)
      if (!mayAccess(tour, await accessFor(service, req))) {
        sendError(
          res,
          403,
          'not_own_tour',
          'Diese Tour ist einem anderen Fahrer zugeteilt.'
        )
        return
      }
      const depot = await service.depot()
      await service.hydrate([tour], depot)
      const [decorated] = await service.decorate([tour], depot)
      res.json(decorated)
    })
  )

  router.patch(
    '/tours/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      await respondTour(res, await service.updateTour(id, req.body, req))
    })
  )

  router.delete(
    '/tours/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      const result = await service.deleteTour(id, req)
      if (fail(res, result)) return
      res.json({ success: true, message: 'Tour gelöscht.' })
    })
  )

  // ---------------------------------------------------------------- stops

  router.post(
    '/tours/:id/stops',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      await respondTour(res, await service.addStop(id, req.body, req), 201)
    })
  )

  router.patch(
    '/tours/:id/stops/:stopId',
    requireRole('fahrer'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      const access = await accessFor(service, req)
      if (access.driverIds !== null) {
        // Ein Fahrer hakt ab - Adresse, Positionen und Koordinaten plant der
        // Inhaber. Ein unbekanntes Feld ist 403, nicht still ignoriert.
        const body = (req.body ?? {}) as Record<string, unknown>
        const foreign = Object.keys(body).filter(
          (k) => !FAHRER_STOP_FIELDS.includes(k)
        )
        if (foreign.length > 0) {
          sendError(
            res,
            403,
            'forbidden_fields',
            'Als Fahrer kann nur der Status eines Stopps geändert werden.',
            { fields: foreign }
          )
          return
        }
      }
      await respondTour(
        res,
        await service.updateStop(
          id,
          req.params['stopId'],
          req.body,
          req,
          access
        )
      )
    })
  )

  router.delete(
    '/tours/:id/stops/:stopId',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      await respondTour(
        res,
        await service.removeStop(id, req.params['stopId'], req)
      )
    })
  )

  router.post(
    '/tours/:id/optimize',
    requireRole('fahrer'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      const access = await accessFor(service, req)
      if (access.driverIds !== null) {
        const tour = await service.loadTour(id)
        if (!tour) return tourNotFound(res)
        if (!mayAccess(tour, access)) {
          sendError(
            res,
            403,
            'not_own_tour',
            'Diese Tour ist einem anderen Fahrer zugeteilt.'
          )
          return
        }
      }
      await respondTour(res, await service.optimize(id, req.body, req, access))
    })
  )

  router.post(
    '/tours/:id/position',
    requireRole('fahrer'),
    asyncHandler(async (req, res) => {
      const id = tourId(req, res)
      if (id === null) return
      const result = await service.reportPosition(
        id,
        req.body,
        await accessFor(service, req)
      )
      if (fail(res, result) || !result.ok) return
      res.json(result.data)
    })
  )

  router.post(
    '/geocode',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.geocode(req.body)
      if (fail(res, result) || !result.ok) return
      res.json(result.data)
    })
  )

  return router
}
