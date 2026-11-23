import express, { type Request, type Response, Router } from 'express'
import { pipeline } from 'node:stream/promises'

import { requirePersonalSession, requireRole } from '../auth/middleware'
import {
  bookingId,
  ReceiptLinksService,
  type ReceiptLinksOptions,
} from '../services/receipt-links.service'
import { ReceiptError } from '../services/receipt-db'
import { FILE_TYPES, MAX_RECEIPT_BYTES } from '../services/receipt-files'
import {
  parseReceiptMonth,
  receiptId,
  ReceiptsService,
  type ReceiptsOptions,
} from '../services/receipts.service'
import { sendError } from '../utils/http-error'

const ownerOnly = [requireRole('inhaber'), requirePersonalSession]
const rawFile = express.raw({
  type: [
    ...Object.values(FILE_TYPES),
    'application/octet-stream',
    'image/heif',
    'text/xml',
  ],
  limit: MAX_RECEIPT_BYTES,
  inflate: false,
})

function handle(
  fn: (req: Request, res: Response) => Promise<unknown>,
  status = 200
) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    fn(req, res)
      .then((data) => {
        if (!res.headersSent) res.status(status).json({ success: true, data })
      })
      .catch((error) => {
        if (error instanceof ReceiptError && !res.headersSent) {
          sendError(res, error.status, error.code, error.message, error.extra)
        } else {
          next(error)
        }
      })
  }
}

export function createReceiptsRoutes(
  options: ReceiptsOptions & ReceiptLinksOptions
) {
  const service = new ReceiptsService(options)
  const matches = new ReceiptLinksService(options)
  const router = Router()
  router.use('/api/receipts', ...ownerOnly)
  router.use('/api/transaction-links', ...ownerOnly)
  const month = (req: Request) =>
    parseReceiptMonth(req.query['monat'], service.today().slice(0, 7))

  async function upload(req: Request, res: Response, id: number | null) {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new ReceiptError(
        415,
        'receipt_file_required',
        'Bitte eine Belegdatei als Rohdaten hochladen.'
      )
    }
    const hint =
      id === null && req.query['buchung'] !== undefined
        ? bookingId(req.query['buchung'])
        : null
    if (hint && !matches.bookingHint(hint)) {
      throw new ReceiptError(
        404,
        'booking_not_found',
        'Die Buchung wurde nicht gefunden.'
      )
    }
    const file = await service.upload(req.body, id, hint, req)
    // Die Verarbeitung startet erst nach der gespeicherten 201-Antwort.
    if (res.destroyed) service.scheduleExtraction(file)
    else {
      res.once('finish', () => service.scheduleExtraction(file))
      res.once('close', () => {
        if (!res.writableFinished) service.scheduleExtraction(file)
      })
    }
    return { id: file.receipt_id, file_id: file.id, status: 'gespeichert' }
  }

  router.post(
    '/api/receipts',
    rawFile,
    handle((req, res) => upload(req, res, null), 201)
  )
  router.post(
    '/api/receipts/:id/files',
    rawFile,
    handle((req, res) => upload(req, res, receiptId(req.params['id'])), 201)
  )
  router.get(
    '/api/receipts',
    handle(async (req) => {
      const selected = month(req)
      const rows = await service.listRows(selected, req.query['status'])
      return {
        month: selected,
        receipts: rows.map((row) => service.summarize(row)),
      }
    })
  )
  router.get(
    '/api/receipts/without-booking',
    handle(async (req) => {
      const selected = month(req)
      const rows = await matches.receiptWithoutBooking(
        await service.listRows(selected, undefined)
      )
      return {
        month: selected,
        receipts: rows.map((row) => service.summarize(row)),
      }
    })
  )
  router.get(
    '/api/receipts/matches',
    handle(async (req) => {
      const receipt = req.query['beleg']
      const booking = req.query['buchung']
      return matches.matches({
        month:
          req.query['monat'] === undefined &&
          (receipt !== undefined || booking !== undefined)
            ? undefined
            : month(req),
        receiptId: receipt === undefined ? undefined : receiptId(receipt),
        bookingId: booking === undefined ? undefined : bookingId(booking),
      })
    })
  )
  async function withBookingHint(
    detail: Awaited<ReturnType<ReceiptsService['detail']>>
  ) {
    const booking_hint = detail.booking_hint
      ? await matches.receiptBookingHint(detail.booking_hint, detail)
      : null
    return { ...detail, booking_hint }
  }

  router.get(
    '/api/receipts/:id',
    handle(async (req) =>
      withBookingHint(await service.detail(receiptId(req.params['id'])))
    )
  )
  router.get(
    '/api/receipts/:id/files/:fileId',
    handle(async (req, res) => {
      const { file, stream } = await service.file(
        receiptId(req.params['id']),
        receiptId(req.params['fileId'])
      )
      const extension = file.path.split('.').at(-1)
      res.set({
        'Content-Type': file.mime,
        'Content-Length': String(file.size),
        'Content-Disposition': `attachment; filename="Beleg-${file.receipt_id}-${file.page}.${extension}"`,
        'X-Receipt-Sha256': file.sha256,
      })
      await pipeline(stream, res)
    })
  )
  router.patch(
    '/api/receipts/:id',
    handle(async (req) =>
      withBookingHint(
        await service.patch(receiptId(req.params['id']), req.body, req)
      )
    )
  )
  for (const action of ['confirm', 'discard'] as const) {
    router.post(
      `/api/receipts/:id/${action}`,
      handle(async (req) =>
        withBookingHint(
          await service.transition(receiptId(req.params['id']), action, req)
        )
      )
    )
  }
  router.delete(
    '/api/receipts/:id',
    handle((req) =>
      service.transition(receiptId(req.params['id']), 'delete', req)
    )
  )
  router.post(
    '/api/transaction-links',
    handle(
      (req) => matches.decide(req.body, null, req, service.timestamp()),
      201
    )
  )
  router.post(
    '/api/transaction-links/:id/reject',
    handle((req) =>
      matches.decide(undefined, req.params['id'], req, service.timestamp())
    )
  )
  router.get(
    '/api/finance/transactions/without-receipt',
    ...ownerOnly,
    handle((req) => matches.expensesWithoutReceipt(month(req)))
  )
  return { router, service }
}
