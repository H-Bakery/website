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

/** Code and German text per status, for errors that bring neither. */
export const STATUS_ERRORS: Record<number, { error: string; message: string }> =
  {
    400: { error: 'bad_request', message: 'Die Anfrage ist ungültig.' },
    401: {
      error: 'unauthorized',
      message: 'Bitte melden Sie sich an.',
    },
    403: {
      error: 'forbidden',
      message: 'Für diese Aktion fehlt die Berechtigung.',
    },
    404: { error: 'not_found', message: 'Nicht gefunden.' },
    405: {
      error: 'method_not_allowed',
      message: 'Diese Methode ist hier nicht erlaubt.',
    },
    409: {
      error: 'conflict',
      message: 'Die Änderung steht im Konflikt mit dem aktuellen Stand.',
    },
    413: { error: 'payload_too_large', message: 'Die Anfrage ist zu groß.' },
    415: {
      error: 'unsupported_media_type',
      message: 'Das Format der Anfrage wird nicht unterstützt.',
    },
    422: {
      error: 'validation_failed',
      message: 'Die Eingaben sind unvollständig oder ungültig.',
    },
    429: {
      error: 'too_many_requests',
      message: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.',
    },
    500: { error: 'internal_error', message: 'Interner Serverfehler.' },
    501: {
      error: 'not_implemented',
      message: 'Diese Funktion ist noch nicht verfügbar.',
    },
    503: {
      error: 'service_unavailable',
      message: 'Der Dienst ist vorübergehend nicht erreichbar.',
    },
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
      const known = STATUS_ERRORS[status] ?? STATUS_ERRORS[400]
      sendError(res, status, known.error, known.message)
      return
    }

    log(`Unhandled error on ${req.method} ${req.originalUrl}`, err)
    sendError(res, 500, 'internal_error', 'Interner Serverfehler.')
  }
}
