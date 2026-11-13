/**
 * `/api/invoices` - Ausgangsrechnungen mit ZUGFeRD/Factur-X-PDF. Unter dem
 * globalen Sitzungsschutz gemountet; **nur `inhaber` mit persönlicher
 * Sitzung** (keine PIN-Station). Antworten
 * `{ success, data }`, Fehler `{ success: false, error, message }` (deutsch).
 * Regeln und Formeln: `services/invoice.core.js`.
 *
 *   GET    /config        Vorgaben (Steuersätze, Zahlungsziel), Verkäufer,
 *                         ob die Bankverbindung eingerichtet ist
 *   GET    /              Liste (?status=entwurf|ausgestellt|storniert, ?preorderId=)
 *   GET    /:id           eine Rechnung mit Positionen, Summen und `missing`
 *   POST   /              Entwurf anlegen - leer oder `{ preorderId }` (vorbelegt)
 *   PUT    /:id           Entwurf ändern (409 `invoice_immutable`, wenn ausgestellt)
 *   DELETE /:id           Entwurf löschen
 *   POST   /:id/issue     ausstellen: Pflichtangaben prüfen, festschreiben
 *   POST   /:id/cancel    `{ reason }` - ausgestellte Rechnung stornieren
 *   GET    /:id/pdf       PDF/A-3 mit eingebetteter `factur-x.xml` - die beim
 *                         Ausstellen festgeschriebenen Bytes (`X-Invoice-Sha256`);
 *                         `?variant=storniert`: Fassung mit Storno-Aufdruck
 *   GET    /:id/xml       die Factur-X-XML allein
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requirePersonalSession, requireRole } from '../auth/middleware'
import {
  InvoiceError,
  InvoicesOptions,
  InvoicesService,
} from '../services/invoices.service'
import { sendError } from '../utils/http-error'

export type InvoicesRouterOptions = InvoicesOptions

function handle(
  fn: (req: Request, res: Response) => Promise<unknown>,
  status = 200
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).then(
      (data) => {
        if (!res.headersSent) res.status(status).json({ success: true, data })
      },
      (error) => {
        if (error instanceof InvoiceError) {
          sendError(res, error.status, error.code, error.message, error.extra)
          return
        }
        next(error)
      }
    )
  }
}

function attachment(res: Response, type: string, filename: string): void {
  res.setHeader('Content-Type', type)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}

export function createInvoicesRouter(options: InvoicesRouterOptions = {}): {
  router: Router
  service: InvoicesService
} {
  const service = new InvoicesService(options)
  const router = Router()
  // Kundenanschriften und rechtsverbindliche Belege: wie Benutzer und Finanzen
  // nur mit Passwort-Sitzung, nicht mit der PIN an einer Station.
  router.use(requireRole('inhaber'), requirePersonalSession)

  router.get(
    '/config',
    handle(async () => service.config())
  )
  router.get(
    '/',
    handle(async (req) => service.list(req.query as Record<string, unknown>))
  )
  router.post(
    '/',
    handle(async (req) => service.create(req.body, req), 201)
  )
  router.get(
    '/:id',
    handle(async (req) => service.get(req.params['id']))
  )
  router.put(
    '/:id',
    handle(async (req) => service.update(req.params['id'], req.body, req))
  )
  router.delete(
    '/:id',
    handle(async (req) => service.remove(req.params['id'], req))
  )
  router.post(
    '/:id/issue',
    handle(async (req) => service.issue(req.params['id'], req))
  )
  router.post(
    '/:id/cancel',
    handle(async (req) => service.cancel(req.params['id'], req.body, req))
  )
  router.get(
    '/:id/pdf',
    handle(async (req, res) => {
      const { filename, pdf, sha256 } = await service.pdf(
        req.params['id'],
        req.query['variant'],
        req
      )
      attachment(res, 'application/pdf', filename)
      res.setHeader('X-Invoice-Sha256', sha256)
      res.send(pdf)
      return undefined
    })
  )
  router.get(
    '/:id/xml',
    handle(async (req, res) => {
      const { filename, xml } = await service.xml(req.params['id'])
      attachment(res, 'application/xml; charset=utf-8', filename)
      res.send(xml)
      return undefined
    })
  )

  return { router, service }
}
