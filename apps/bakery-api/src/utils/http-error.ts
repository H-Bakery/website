/**
 * Uniform error responses.
 *
 * Every error body carries `error` (machine-readable code) **and** `message`
 * (German text): the frontend `ApiClient` throws `new Error(data.message)`,
 * so a body without `message` loses the text the user should see.
 */
import { ErrorRequestHandler, RequestHandler, Response } from 'express'

export interface ErrorBody {
  success: false
  error: string
  message: string
  [key: string]: unknown
}

export function sendError(
  res: Response,
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {}
): Response {
  const body: ErrorBody = { ...extra, success: false, error, message }
  return res.status(status).json(body)
}

/** JSON 404 for every route that is not mounted. */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(
    res,
    404,
    'not_found',
    `Unbekannter Endpunkt: ${req.method} ${req.path}`
  )
}

interface HttpLikeError {
  status?: number
  statusCode?: number
  type?: string
  expose?: boolean
  message?: string
}

/**
 * Global error handler. Body-parser errors (bad JSON, body too large) map to
 * their 4xx; everything else is a 500 without internals in the body.
 */
export function createErrorHandler(
  log: (message: string, error: unknown) => void = (message, error) =>
    console.error(`[ERROR] ${message}`, error)
): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err)
      return
    }
    const e = (err ?? {}) as HttpLikeError
    const status = e.status ?? e.statusCode

    if (e.type === 'entity.parse.failed') {
      sendError(
        res,
        400,
        'invalid_json',
        'Die Anfrage enthält kein gültiges JSON.'
      )
      return
    }
    if (e.type === 'entity.too.large') {
      sendError(res, 413, 'payload_too_large', 'Die Anfrage ist zu groß.')
      return
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      sendError(res, status, 'bad_request', 'Die Anfrage ist ungültig.')
      return
    }

    log(`Unhandled error on ${req.method} ${req.originalUrl}`, err)
    sendError(res, 500, 'internal_error', 'Interner Serverfehler.')
  }
}
