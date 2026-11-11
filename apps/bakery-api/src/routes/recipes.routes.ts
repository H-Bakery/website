/**
 * `/api/recipes` - Rezepte aus `hq/data/recipes` (Owner-Wunsch 2026-11-11).
 * Unter dem globalen Sitzungs-Guard gemountet; jede Antwort ist
 * `{ success, data }`, jeder Fehler `{ success: false, error, message }`
 * (deutsch). Vertrag: `docs/api/recipes.md`.
 *
 *   GET    /?category=&q=        inhaber, backstubenleiter, backstube
 *                                { status: 'ok' | 'no-data', categories, recipes, count,
 *                                  units, writable, writeIssue, canDelete, deleteIssue }
 *   GET    /:category/:slug      dieselben Rollen: ein Rezept (mit `version`)
 *   POST   /                     inhaber, backstubenleiter: 201 { data, pending, changed }
 *   PUT    /:category/:slug      inhaber, backstubenleiter: { expectedVersion, … }
 *   DELETE /:category/:slug      inhaber, backstubenleiter: `expectedVersion` im Body
 *                                oder als `?expectedVersion=`
 *
 * `verkauf` und `fahrer` bekommen überall 403. Geschrieben wird nach hq wie
 * bei den Produkten (Schreib-Worktree `app/edits`, rollende PR); jede
 * Änderung steht zusätzlich im Audit-Log.
 */
import { Request, Response, Router } from 'express'

import { auditQuietly } from '../auth/audit'
import { asyncHandler, requireRole } from '../auth/middleware'
import {
  RecipesOptions,
  RecipesService,
  RecipeWriteResult,
} from '../services/recipes.service'
import { sendError } from '../utils/http-error'

/** Lesen: Backstube (die Backstubenleitung zählt dazu, `inhaber` besteht jede Prüfung). */
export const RECIPE_READ_ROLES = ['backstube'] as const
/** Anlegen, Ändern, Löschen. */
export const RECIPE_WRITE_ROLES = ['backstubenleiter'] as const

function editorOf(req: Request) {
  return {
    id: req.user?.id ?? null,
    // Nie auf den Login zurückfallen: der Name geht nach hq (D13).
    displayName: req.user?.displayName || 'unbekannt',
  }
}

async function answer(
  req: Request,
  res: Response,
  result: RecipeWriteResult
): Promise<void> {
  if (!result.ok) {
    sendError(
      res,
      result.status,
      result.error ?? 'internal_error',
      result.message ?? 'Interner Serverfehler.',
      result.extra
    )
    return
  }
  if (result.audit) {
    // Die Datei ist geschrieben (und committet): ein Fehler im Audit-Log
    // macht daraus keinen Fehler der Anfrage.
    await auditQuietly(
      req,
      result.audit.action,
      'recipe',
      result.audit.id,
      result.audit.data
    )
  }
  res.status(result.status).json({
    success: true,
    data: result.data,
    pending: result.pending === true,
    changed: result.changed === true,
  })
}

export function createRecipesRouter(
  options: RecipesOptions & { service?: RecipesService } = {}
): { router: Router; service: RecipesService } {
  const service = options.service ?? new RecipesService(options)
  const router = Router()
  const readers = requireRole(...RECIPE_READ_ROLES)
  const writers = requireRole(...RECIPE_WRITE_ROLES)

  router.get(
    '/',
    readers,
    asyncHandler(async (req, res) => {
      res.json({
        success: true,
        data: await service.list({
          category: req.query['category'],
          q: req.query['q'],
        }),
      })
    })
  )

  router.get(
    '/:category/:slug',
    readers,
    asyncHandler(async (req, res) => {
      const recipe = await service.get(
        req.params['category'],
        req.params['slug']
      )
      if (!recipe) {
        sendError(res, 404, 'not_found', 'Rezept nicht gefunden.')
        return
      }
      res.json({ success: true, data: recipe })
    })
  )

  router.post(
    '/',
    writers,
    asyncHandler(async (req, res) => {
      await answer(req, res, await service.create(req.body, editorOf(req)))
    })
  )

  router.put(
    '/:category/:slug',
    writers,
    asyncHandler(async (req, res) => {
      await answer(
        req,
        res,
        await service.update(
          req.params['category'],
          req.params['slug'],
          req.body,
          editorOf(req)
        )
      )
    })
  )

  router.delete(
    '/:category/:slug',
    writers,
    asyncHandler(async (req, res) => {
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {}
      await answer(
        req,
        res,
        await service.remove(
          req.params['category'],
          req.params['slug'],
          body['expectedVersion'] ?? req.query['expectedVersion'],
          editorOf(req)
        )
      )
    })
  )

  return { router, service }
}
