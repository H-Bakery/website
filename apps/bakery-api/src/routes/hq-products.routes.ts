/**
 * hq-Produkte (B5) - Vertrag des Mock-Servers (D3), aus `simple-server.js`:
 *
 *   GET  /api/products[?category=]   { success, data: HQProduct[], count }
 *   GET  /api/hq-products            { success, data, count }   (neu, s. u.)
 *   GET  /api/hq-products/:id        { success, data: HQProduct }
 *
 * `/api/products` (Shop) liefert den freigegebenen Stand (Lese-Klon).
 * `/api/hq-products` (Verwaltung) liefert den Stand im Schreib-Worktree - den,
 * auf dem ein PUT aufbaut -, bei wartenden Produkten mit `approved` (dem
 * freigegebenen Stand, `null` für neue). Sonst schriebe das Formular, das
 * immer alle Felder schickt, die freigegebenen Werte über eine wartende
 * Änderung.
 *   PUT  /api/hq-products/:id        { success, data, pending }   nur `inhaber`
 *   POST /api/hq-products            201 { success, data, pending } nur `inhaber`
 *
 * Kein DELETE: ein Produkt entfernen heißt eine Datei in hq löschen.
 * Lesen darf jede Sitzung (globaler Guard in `app.ts`). Jedes Produkt trägt
 * zusätzlich `pendingApproval` (Datei im Schreib-Worktree weicht vom
 * Lese-Klon ab, D6 "wartet auf Freigabe").
 *
 * Fehler über `sendError` mit `error` (Code) und deutschem `message`.
 */
import { Request, Response, Router } from 'express'

import { asyncHandler, requireRole } from '../auth/middleware'
import {
  HqProductsOptions,
  HqProductsService,
  WriteResult,
} from '../services/hq-products.service'
import { sendError } from '../utils/http-error'

export interface HqProductsRouters {
  /** Mount unter `/api/products`. */
  products: Router
  /** Mount unter `/api/hq-products`. */
  hqProducts: Router
  service: HqProductsService
}

function editorOf(req: Request) {
  return {
    username: req.user?.username ?? 'unbekannt',
    displayName: req.user?.displayName ?? req.user?.username ?? 'unbekannt',
  }
}

function answer(res: Response, result: WriteResult): void {
  if (!result.ok) {
    sendError(res, result.status, result.error, result.message)
    return
  }
  res.status(result.status).json({
    success: true,
    data: { ...result.data, pendingApproval: result.pending },
    pending: result.pending,
  })
}

export function createHqProductsRouters(
  options: HqProductsOptions & { service?: HqProductsService } = {}
): HqProductsRouters {
  const service = options.service ?? new HqProductsService(options)

  const products = Router()
  products.get('/', (req, res) => {
    const data = service.list({ category: req.query['category'] })
    res.json({ success: true, data, count: data.length })
  })

  const hqProducts = Router()
  // Nicht im Mock (dort liest die Verwaltung die Dateien direkt). Wie
  // /api/products, aber im Stand des Schreib-Worktrees, inkl. neuer Produkte.
  hqProducts.get('/', (req, res) => {
    const data = service.listManaged({ category: req.query['category'] })
    res.json({ success: true, data, count: data.length })
  })

  hqProducts.get('/:id', (req, res) => {
    const product = service.getManaged(req.params['id'])
    if (!product) {
      sendError(res, 404, 'not_found', 'Produkt nicht gefunden.')
      return
    }
    res.json({ success: true, data: product })
  })

  hqProducts.put(
    '/:id',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      answer(
        res,
        await service.update(req.params['id'], req.body, editorOf(req))
      )
    })
  )

  hqProducts.post(
    '/',
    requireRole('inhaber'),
    asyncHandler(async (req, res) => {
      answer(res, await service.create(req.body, editorOf(req)))
    })
  )

  return { products, hqProducts, service }
}
