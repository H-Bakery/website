import express, { Request, RequestHandler, Response, Router } from 'express'
import { requireRole } from '../auth/middleware'
import { BackzettelError } from '../services/backzettel.service'
import type { createRestService } from '../services/rest-am-abend.service'
import { createSpracheService, VoiceOptions } from '../services/sprache.service'
import { logger } from '../utils/logger'
import { sendError } from '../utils/http-error'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ACTIONS } = require('../services/sprache.core')

export function createSpracheRouter(
  rest: Pick<ReturnType<typeof createRestService>, 'getDay'>,
  hqDir: string,
  options?: VoiceOptions
): Router {
  const router = Router()
  const service = createSpracheService(hqDir, options)
  const counters = requireRole(...ACTIONS.rest.roles)

  const handle =
    (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    (req, res) => {
      void fn(req, res).then(
        (data) => {
          if (!res.destroyed && !res.headersSent)
            res.json({ success: true, data })
        },
        (error) => {
          if (!(error instanceof BackzettelError))
            logger.error('Spracheingabe: interner Fehler.')
          if (res.destroyed || res.headersSent) return
          if (error instanceof BackzettelError) {
            sendError(res, error.status, error.code, error.message)
          } else {
            sendError(
              res,
              500,
              'internal_error',
              'Die Spracheingabe konnte nicht verarbeitet werden.'
            )
          }
        }
      )
    }

  router.get(
    '/status',
    counters,
    handle(async () => service.status())
  )
  router.post(
    '/verstehen',
    counters,
    (req, res, next) => {
      const cfg = service.settings()
      if (!cfg.enabled) {
        sendError(
          res,
          503,
          'voice_disabled',
          'Spracheingabe ist ausgeschaltet – bitte tippen.'
        )
      } else if (!req.secure) {
        sendError(
          res,
          403,
          'voice_https_required',
          'Spracheingabe braucht HTTPS – bitte tippen.'
        )
      } else if (req.query['screen'] !== 'rest') {
        sendError(
          res,
          400,
          'voice_screen',
          'Für diesen Bildschirm gibt es keine Spracheingabe.'
        )
      } else if (!req.is('audio/*')) {
        sendError(
          res,
          415,
          'voice_audio_format',
          'Bitte eine WAV-Aufnahme senden.'
        )
      } else {
        res.locals['voiceConfig'] = cfg
        next()
      }
    },
    express.raw({ type: 'audio/*', limit: '1mb', inflate: false }),
    handle(async (req, res) => {
      if (!req.is(['audio/wav', 'audio/x-wav'])) {
        throw new BackzettelError(
          415,
          'voice_audio_format',
          'Bitte eine WAV-Aufnahme senden.'
        )
      }
      if (!Buffer.isBuffer(req.body)) {
        throw new BackzettelError(
          400,
          'voice_audio_missing',
          'Die Aufnahme fehlt.'
        )
      }
      const day = await rest.getDay(req.query)
      if (!day.editable) {
        throw new BackzettelError(
          409,
          'voice_day_locked',
          day.editIssue || 'Dieser Tag ist gesperrt.'
        )
      }
      const controller = new AbortController()
      const abort = () => controller.abort()
      res.once('close', abort)
      if (res.destroyed) abort()
      try {
        return await service.understand(
          res.locals['voiceConfig'],
          'rest',
          req.user,
          req.body,
          day,
          controller.signal
        )
      } finally {
        res.off('close', abort)
      }
    })
  )
  return router
}
