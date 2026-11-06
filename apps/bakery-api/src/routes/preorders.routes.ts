/**
 * Vorbestellungen (B7). Drei Router über demselben Service:
 *
 * `/api/preorders` - das neue, allgemeine Modell
 *
 *   GET    /                  ?date= &from= &to= &status=a,b &channel= &pickupPointId=<id>|laden &q=
 *                             { success, data: Preorder[], count }
 *   GET    /sums?date=[&pickupPointId=]   { success, data: { date, pickupPointId, preorderCount, items, summary } }
 *                             (`summary` seit W4 - Kopfzahlen ohne Namen, für die Backliste)
 *   GET    /day?date=[&pickupPointId=<id>|laden]
 *                             { success, data: { date, pickupPointId, summary, sums, pickupPoints, preorders } }
 *   GET    /pickup-points     { success, data: (PickupPoint + updatedAt)[] }
 *   PUT    /pickup-points/:id { success, data: PickupPoint + updatedAt }  inhaber (P2);
 *                             optional `expectedUpdatedAt` → 409 stale_pickup_point (W4)
 *   POST   /bulk-status       { ids, status?, notCollected?, paid?, expectedUpdatedAt?: { [id]: ISO } }
 *                             { success, data: { counts, results: [{ id, result, error?, message?, data? }] } }
 *                             eine Transaktion, Ergebnis je id (W4); Rollen wie /:id/status
 *   GET    /variants          { success, data: { [productId]: Sorten[] }, configured }
 *   GET    /:id               { success, data: Preorder }
 *   POST   /                  201 { success, data }          verkauf, inhaber
 *                             (optional `requestId`: a repeat returns the earlier order, 200)
 *   PATCH  /:id               { success, data }              verkauf, inhaber
 *   POST   /:id/status        { status, notCollected?, paid? } verkauf, inhaber, fahrer*
 *   POST   /:id/cancel        { success, data }              verkauf, inhaber
 *
 *   Lesen: verkauf, inhaber, fahrer; `/sums` zusätzlich backstube (keine Namen,
 *   für die Backstube auch ohne `summary` - keine Beträge).
 *   *fahrer: nur `abgeholt` und „nicht abgeholt“ (+ bezahlt) - Übergabe.
 *   „Nicht abgeholt“ erst ab dem Abholtag (409 not_collected_too_early, W4).
 *
 * `/api/deliveries` - Alias im Mock-Vertrag der Mörsbach-Maske (D3), siehe
 * `simple-server.js`: rohe Objekte ohne Hülle, Mock-Status
 * (open/handed_over/not_collected/cancelled), nur Sammelstellen-Bestellungen.
 *
 * `/api/orders` - nur `POST`, der Shop-Vertrag (`shop-orders.core.js`) →
 * Vorbestellung mit Kanal `shop`. Hinter der Anmeldung (Shop außerhalb des
 * Pilots, API nur im LAN).
 *
 * Fehler immer über `sendError` (`error` + deutsche `message`).
 */
import { Request, Response, Router } from 'express'

import { asyncHandler, requireRole } from '../auth/middleware'
import {
  PickupPointDto,
  PreorderRecord,
  PreordersOptions,
  PreordersService,
  Result,
  expectedVersionGuard,
  isFailure,
  toDto,
} from '../services/preorders.service'
import { sendError } from '../utils/http-error'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('../services/delivery-preorders.core')
const tours = require('../services/delivery-tours.core')
const shopOrders = require('../services/shop-orders.core')
/* eslint-enable @typescript-eslint/no-var-requires */

const READ_ROLES = ['verkauf', 'fahrer'] as const // inhaber passes every check
const WRITE_ROLES = ['verkauf'] as const
/** Was der Fahrer setzen darf: Übergabe. */
const FAHRER_TARGETS = ['abgeholt', 'nicht_abgeholt']

export interface PreorderRouters {
  preorders: Router
  deliveries: Router
  orders: Router
  service: PreordersService
}

/** „Invalid window“ (Mock-Code) → `invalid_window`. */
function machineCode(error: string): string {
  return (
    String(error)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'bad_request'
  )
}

function fail(res: Response, result: Result<unknown>): boolean {
  if (!isFailure(result)) return false
  sendError(res, result.status, result.error, result.message, result.extra)
  return true
}

async function dtoOf(service: PreordersService, record: PreorderRecord) {
  const points = await service.pickupPoints()
  return toDto(
    record,
    record.pickupPointId ? points.get(record.pickupPointId) ?? null : null,
    service.now()
  )
}

async function legacyOf(service: PreordersService, record: PreorderRecord) {
  const points = await service.pickupPoints()
  return core.toLegacyPreorder(
    record,
    record.pickupPointId ? points.get(record.pickupPointId) ?? null : null,
    service.now()
  )
}

// ------------------------------------------------------------ /api/preorders

function createPreordersRouter(service: PreordersService): Router {
  const router = Router()

  router.get(
    '/',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.list(req.query)
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: result.data, count: result.data.length })
    })
  )

  // Vor `/:id` - sonst schluckt der Parameter „sums“ und „day“.
  router.get(
    '/sums',
    requireRole(...READ_ROLES, 'backstube'),
    asyncHandler(async (req, res) => {
      const result = await service.sums(req.query)
      if (fail(res, result) || !result.ok) return
      // Die Backstube braucht Mengen, keine Beträge und keinen Bezahlstand
      // (wie `/day`, das sie gar nicht lesen darf): ohne `summary`.
      if (req.user?.role === 'backstube') {
        const { summary: _summary, ...data } = result.data as Record<
          string,
          unknown
        >
        res.json({ success: true, data })
        return
      }
      res.json({ success: true, data: result.data })
    })
  )

  router.get(
    '/day',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.day(req.query)
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: result.data })
    })
  )

  router.get(
    '/pickup-points',
    requireRole(...READ_ROLES),
    asyncHandler(async (_req, res) => {
      // Mit `updatedAt` (W4) - das Formular schickt es als
      // `expectedUpdatedAt` zurück.
      const data = await service.listPickupPointsVersioned()
      res.json({ success: true, data, count: data.length })
    })
  )

  // Stammdaten einer Sammelstelle (P2: Mörsbach-Seite „Lieferstelle“).
  // Dieselbe Prüfung wie der Alias, aber die Hülle und Fehler-Codes von
  // `/api/preorders` (`invalid_window` statt „Invalid window“). Keine
  // Adresssuche: eine geänderte Adresse verliert ihre Koordinaten.
  // Optional `expectedUpdatedAt` → 409 `stale_pickup_point` (W4).
  router.put(
    '/pickup-points/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.updatePickupPoint(
        req.params['id'],
        req.body,
        req
      )
      if (isFailure(result)) {
        sendError(
          res,
          result.status,
          machineCode(result.error),
          result.message,
          result.extra
        )
        return
      }
      res.json({
        success: true,
        data: {
          ...result.data,
          updatedAt: await service.pickupPointVersion(req.params['id']),
        },
      })
    })
  )

  // Sammel-Statuswechsel der Abholliste (W4): „alle bereit“, Tagesabschluss.
  // Eine Transaktion, ein Ergebnis je Bestellung; dieselben Rollen wie
  // `POST /:id/status` (Fahrer nur übergeben / nicht abgeholt).
  router.post(
    '/bulk-status',
    requireRole(...WRITE_ROLES, 'fahrer'),
    asyncHandler(async (req, res) => {
      const result = await service.bulkStatus(req.body, req, {
        allowedTargets:
          req.user?.role === 'fahrer' ? FAHRER_TARGETS : undefined,
        notCollectedFrom: service.today(),
      })
      if (fail(res, result) || !result.ok) return
      const points = await service.pickupPoints()
      const now = service.now()
      res.json({
        success: true,
        data: {
          counts: result.data.counts,
          results: result.data.results.map((r) => ({
            ...r,
            ...(r.data
              ? {
                  data: toDto(
                    r.data,
                    r.data.pickupPointId
                      ? points.get(r.data.pickupPointId) ?? null
                      : null,
                    now
                  ),
                }
              : {}),
          })),
        },
      })
    })
  )

  // Sorten-Chips der Erfassungsmaske (P1): welche Produkte laut
  // `backzettel.yaml` eine Sorte brauchen. Ohne Stammdaten leer.
  router.get('/variants', requireRole(...READ_ROLES), (_req, res) => {
    const { configured, products } = service.variantsByProduct()
    res.json({
      success: true,
      data: products,
      configured,
      count: Object.keys(products).length,
    })
  })

  router.get(
    '/:id',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.get(req.params['id'])
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: result.data })
    })
  )

  router.post(
    '/',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.create(req.body, req, {
        strictPickup: true,
      })
      if (fail(res, result) || !result.ok) return
      // 200 (not 201) when `requestId` matched an order created before: the
      // retried save of a lost answer (W4-verify r4).
      res
        .status(result.status === 200 ? 200 : 201)
        .json({ success: true, data: await dtoOf(service, result.data) })
    })
  )

  router.patch(
    '/:id',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.update(req.params['id'], req.body, req, {
        lockCancelled: true,
        strictPickup: true,
        guard: expectedVersionGuard(req.body),
      })
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: await dtoOf(service, result.data) })
    })
  )

  router.post(
    '/:id/status',
    requireRole(...WRITE_ROLES, 'fahrer'),
    asyncHandler(async (req, res) => {
      const result = await service.changeStatus(
        req.params['id'],
        req.body,
        req,
        {
          allowedTargets:
            req.user?.role === 'fahrer' ? FAHRER_TARGETS : undefined,
          notCollectedFrom: service.today(),
          guard: expectedVersionGuard(req.body),
        }
      )
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: await dtoOf(service, result.data) })
    })
  )

  router.post(
    '/:id/cancel',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.cancel(
        req.params['id'],
        req,
        expectedVersionGuard(req.body)
      )
      if (fail(res, result) || !result.ok) return
      res.json({ success: true, data: await dtoOf(service, result.data) })
    })
  )

  return router
}

// --------------------------------------------- /api/deliveries (Mock-Alias)

const LEGACY_NOT_FOUND = {
  status: 404,
  error: 'Preorder not found',
  message: 'Diese Vorbestellung existiert nicht.',
}

const LEGACY_STATUS_MESSAGE =
  'Status muss "open", "handed_over", "not_collected" oder "cancelled" sein.'

function legacyNotFound(res: Response): void {
  sendError(res, 404, LEGACY_NOT_FOUND.error, LEGACY_NOT_FOUND.message)
}

/** Prüft `date` und `status` der Query wie der Mock; false = geantwortet. */
function checkLegacyQuery(req: Request, res: Response): boolean {
  const { date, status } = req.query
  if (date !== undefined && !tours.isBusinessDate(date)) {
    sendError(
      res,
      400,
      'Invalid date',
      'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
    )
    return false
  }
  if (status !== undefined && !core.PREORDER_STATUS.includes(status)) {
    sendError(res, 400, 'Invalid status', LEGACY_STATUS_MESSAGE)
    return false
  }
  return true
}

/** Sammelstellen-Bestellungen als Mock-Objekte, gefiltert wie im Mock. */
async function legacyList(
  service: PreordersService,
  query: Request['query']
): Promise<Record<string, unknown>[]> {
  const filters: Record<string, unknown> = {}
  if (typeof query['date'] === 'string') filters['date'] = query['date']
  if (query['pickupPointId'] !== undefined) {
    filters['pickupPointId'] = String(query['pickupPointId'])
  }
  const result = await service.list(filters)
  if (!result.ok) return []
  const points = await service.pickupPoints()
  const now = service.now()
  return result.data
    .filter((p) => p.pickupPointId !== null)
    .map((p) =>
      core.toLegacyPreorder(
        { ...p, items: p.items },
        points.get(p.pickupPointId as string) ?? null,
        now
      )
    )
    .filter(
      (p: { status: string }) =>
        query['status'] === undefined || p.status === query['status']
    )
    .sort(
      (a: { date: string; reference: string }, b: typeof a) =>
        a.date.localeCompare(b.date) ||
        String(a.reference).localeCompare(String(b.reference))
    )
}

function createDeliveriesRouter(service: PreordersService): Router {
  const router = Router()

  router.get(
    '/pickup-points',
    requireRole(...READ_ROLES),
    asyncHandler(async (_req, res) => {
      res.json(await service.listPickupPoints())
    })
  )

  // Keine Adresssuche (Nominatim) auf der Box: eine geänderte Adresse
  // verliert ihre Koordinaten, bis sie von Hand gesetzt werden (B8).
  router.put(
    '/pickup-points/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      const result = await service.updatePickupPoint(
        req.params['id'],
        req.body,
        req
      )
      if (fail(res, result) || !result.ok) return
      res.json(result.data)
    })
  )

  router.get(
    '/preorders',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      if (!checkLegacyQuery(req, res)) return
      res.json(await legacyList(service, req.query))
    })
  )

  router.get(
    '/preorders/summary',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const { date, pickupPointId } = req.query
      if (!tours.isBusinessDate(date)) {
        sendError(
          res,
          400,
          'Invalid date',
          'Für die Backliste wird ein Datum im Format JJJJ-MM-TT gebraucht.'
        )
        return
      }
      if (!checkLegacyQuery(req, res)) return
      const points = await service.pickupPoints()
      const point: PickupPointDto | null =
        pickupPointId === undefined
          ? [...points.values()].find((p) => p.active !== false) ?? null
          : points.get(String(pickupPointId)) ?? null
      const list = await legacyList(service, req.query)
      res.json({
        date,
        pickupPointId:
          pickupPointId === undefined ? null : String(pickupPointId),
        deadline: point ? core.deadlineFor(date, point.orderDeadline) : null,
        // Touren gibt es auf der echten API nicht (D11, Liste wird gedruckt):
        // „hat einen Stopp“ heißt hier „die Stelle wird an diesem Tag beliefert“.
        hasPickupStop: point
          ? core
              .pickupPointsForDate([point], date)
              .some((p: PickupPointDto) => p.id === point.id)
          : false,
        ...core.summarizePreorders(list),
      })
    })
  )

  router.get(
    '/preorders/:id',
    requireRole(...READ_ROLES),
    asyncHandler(async (req, res) => {
      const record = await service.findRecord(req.params['id'])
      if (!record || !record.pickupPointId) return legacyNotFound(res)
      res.json(await legacyOf(service, record))
    })
  )

  router.post(
    '/preorders',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      const points = await service.pickupPoints()
      const point = body['pickupPointId']
        ? points.get(String(body['pickupPointId'])) ?? null
        : [...points.values()].find((p) => p.active !== false) ?? null
      if (!point) {
        sendError(
          res,
          400,
          'Pickup point not found',
          'Diese Lieferstelle existiert nicht.'
        )
        return
      }
      if (
        body['status'] !== undefined &&
        !core.PREORDER_STATUS.includes(body['status'])
      ) {
        sendError(res, 400, 'Invalid status', LEGACY_STATUS_MESSAGE)
        return
      }
      const input = {
        ...core.fromLegacyInput(body, null),
        pickupPointId: point.id,
      }
      const result = await service.create(input, req, {
        requireVariant: false,
      })
      if (fail(res, result) || !result.ok) return
      res.status(201).json(await legacyOf(service, result.data))
    })
  )

  router.patch(
    '/preorders/:id',
    requireRole(...WRITE_ROLES, 'fahrer'),
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (
        body['status'] !== undefined &&
        !core.PREORDER_STATUS.includes(body['status'])
      ) {
        sendError(res, 400, 'Invalid status', LEGACY_STATUS_MESSAGE)
        return
      }
      if (req.user?.role === 'fahrer') {
        const keys = Object.keys(body)
        if (
          keys.some((k) => k !== 'status') ||
          !['handed_over', 'not_collected'].includes(String(body['status']))
        ) {
          sendError(
            res,
            403,
            'forbidden',
            'Fahrer können Vorbestellungen nur als übergeben oder nicht abgeholt markieren.'
          )
          return
        }
      }
      const guard = (current: PreorderRecord): Result<never> | null => {
        if (!current.pickupPointId) {
          return { ok: false, ...LEGACY_NOT_FOUND }
        }
        // W4-verify r3: the Fahrer never takes a handover back (same rule
        // as `POST /:id/status`); checked inside the write transaction.
        if (
          req.user?.role === 'fahrer' &&
          current.status === 'abgeholt' &&
          body['status'] !== 'handed_over'
        ) {
          const refused = core.handoverUndoForbidden()
          return {
            ok: false,
            status: refused.status,
            error: refused.error,
            message: refused.message,
          }
        }
        if (body['status'] !== undefined) {
          const blocked = core.checkStatusTransition(
            core.toLegacyStatus(current),
            body['status']
          )
          if (blocked) {
            return {
              ok: false,
              status: blocked.status,
              error: blocked.error,
              message: blocked.message,
            }
          }
        }
        if (core.legacyItemsLoseVariants(current.items, body['items'])) {
          return {
            ok: false,
            status: 409,
            error: 'has_variants',
            message:
              'Diese Vorbestellung enthält Sorten (z. B. Füllungen) und lässt sich nur in der neuen Vorbestell-Maske ändern.',
          }
        }
        return null
      }
      const mapBody = (current: PreorderRecord) =>
        core.fromLegacyInput(body, current)
      // Reines Abhaken (nur `status`) geht am Formular vorbei: keine erneute
      // Prüfung von Liefertag, Positionen usw. - sonst ließe sich eine
      // Bestellung nach einer Wochentagsänderung der Stelle nicht mehr übergeben.
      const statusOnly =
        Object.keys(body).length === 1 && body['status'] !== undefined
      const result = statusOnly
        ? await service.changeStatus(req.params['id'], body, req, {
            guard,
            mapBody,
            keepPaymentOnUndo: true,
          })
        : await service.update(req.params['id'], body, req, {
            requireVariant: false,
            guard,
            mapBody,
          })
      if (!result.ok && result.status === 404) return legacyNotFound(res)
      if (fail(res, result) || !result.ok) return
      res.json(await legacyOf(service, result.data))
    })
  )

  // Stornieren statt Löschen - wie im Mock.
  router.delete(
    '/preorders/:id',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const result = await service.cancel(req.params['id'], req, (current) => {
        if (!current.pickupPointId) return { ok: false, ...LEGACY_NOT_FOUND }
        const blocked = core.checkStatusTransition(
          core.toLegacyStatus(current),
          'cancelled'
        )
        return blocked
          ? {
              ok: false,
              status: blocked.status,
              error: blocked.error,
              message: blocked.message,
            }
          : null
      })
      if (!result.ok && result.status === 404) return legacyNotFound(res)
      if (fail(res, result) || !result.ok) return
      res.json(await legacyOf(service, result.data))
    })
  )

  return router
}

// ------------------------------------------------- /api/orders (Shop, POST)

function createOrdersRouter(service: PreordersService): Router {
  const router = Router()

  router.post(
    '/',
    requireRole(...WRITE_ROLES),
    asyncHandler(async (req, res) => {
      const check = shopOrders.validateShopOrder(req.body, {
        lookupProduct: service.lookupProduct,
        todayIso: service.today(),
      })
      if (!check.ok) {
        sendError(res, 400, 'invalid_order', check.message, {
          field: check.field,
        })
        return
      }
      const order = check.order
      const result = await service.create(
        {
          channel: 'shop',
          customerName: order.customerName,
          customerPhone: order.phone,
          pickupDate: order.pickupDate,
          pickupTime: order.pickupTime,
          note: order.notes ?? null,
          items: order.items.map(
            (i: { productId: string; quantity: number }) => ({
              productId: i.productId,
              quantity: i.quantity,
            })
          ),
        },
        req,
        { requireVariant: false }
      )
      if (isFailure(result)) {
        sendError(res, result.status, 'invalid_order', result.message, {
          field: 'items',
        })
        return
      }
      const p = result.data
      // Mock-Form (`simple-server.js`): `id` = Code (für die URL, nicht
      // fortlaufend), `orderNumber` = laufende Nummer. E-Mail wird nicht
      // gespeichert (keine Spalte, Datensparsamkeit).
      res.status(201).json({
        success: true,
        data: {
          customerName: p.customerName,
          phone: p.customerPhone,
          pickupDate: p.pickupDate,
          pickupTime: p.pickupTime,
          items: p.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          total: p.total,
          ...(p.note ? { notes: p.note } : {}),
          id: p.code,
          orderNumber: p.id,
          status: 'pending',
          createdAt: new Date(p.createdAt).toISOString(),
          updatedAt: new Date(p.updatedAt).toISOString(),
        },
      })
    })
  )

  return router
}

export function createPreorderRouters(
  options: PreordersOptions & { service?: PreordersService } = {}
): PreorderRouters {
  const service = options.service ?? new PreordersService(options)
  return {
    preorders: createPreordersRouter(service),
    deliveries: createDeliveriesRouter(service),
    orders: createOrdersRouter(service),
    service,
  }
}
