/**
 * `/api/dienstplan` - Dienstplan und Urlaubsplanung (TASK-042, after the
 * pilot). Mounted below the global session guard; **`inhaber` only, from a
 * personal session** (not at a PIN station - staff data). Answers
 * `{ success, data }`, writes that hit an absence/shift overlap add
 * `warnings: [{ code, message }]` (a warning, never an error). Errors
 * `{ success: false, error, message }` (German). Rules and formulas:
 * `services/vacation.core.js`; reads and writes: `dienstplan.service.ts`.
 *
 *   GET    /?from&to                       calendar: employees, shifts, absences, days[]
 *   GET    /employees                      all employees (incl. deactivated)
 *   POST   /employees                      create
 *   GET    /employees/:id?year             profile: entitlements, balance, absences, upcoming shifts
 *   PATCH  /employees/:id                  change, `active: false` deactivates (no DELETE)
 *   GET    /employees/:id/entitlements     entitlement rows, newest year first
 *   PUT    /employees/:id/entitlements/:year  { entitlementDays, carryoverDays } (null = offen)
 *   GET    /shift-templates                POST /shift-templates, PATCH/DELETE /shift-templates/:id
 *   GET    /shifts?from&to[&employeeId]    POST /shifts, PATCH/DELETE /shifts/:id
 *   GET    /absences?from&to[&employeeId]  POST /absences, PATCH/DELETE /absences/:id
 *   GET    /balance?year[&employeeId]      vacation balance per employee
 */
import { NextFunction, Request, Response, Router } from 'express'

import { requirePersonalSession, requireRole } from '../auth/middleware'
import {
  DienstplanError,
  DienstplanOptions,
  DienstplanService,
  ServiceResult,
} from '../services/dienstplan.service'
import { sendError } from '../utils/http-error'

export type DienstplanRouterOptions = DienstplanOptions

function handle(
  fn: (req: Request) => Promise<ServiceResult>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req).then(
      (result) => {
        const body: Record<string, unknown> = {
          success: true,
          data: result.data,
        }
        if (result.warnings) body['warnings'] = result.warnings
        res.status(result.status ?? 200).json(body)
      },
      (error) => {
        if (error instanceof DienstplanError) {
          sendError(res, error.status, error.code, error.message)
          return
        }
        next(error)
      }
    )
  }
}

export function createDienstplanRouter(
  options: DienstplanRouterOptions = {}
): Router {
  const service = new DienstplanService(options)
  const router = Router()
  router.use(requireRole('inhaber'), requirePersonalSession)

  router.get(
    '/',
    handle((req) => service.calendar(req))
  )

  router.get(
    '/employees',
    handle(() => service.listEmployees())
  )
  router.post(
    '/employees',
    handle((req) => service.createEmployee(req))
  )
  router.get(
    '/employees/:id',
    handle((req) => service.employeeProfile(req))
  )
  router.patch(
    '/employees/:id',
    handle((req) => service.updateEmployee(req))
  )
  router.get(
    '/employees/:id/entitlements',
    handle((req) => service.listEntitlements(req))
  )
  router.put(
    '/employees/:id/entitlements/:year',
    handle((req) => service.putEntitlement(req))
  )

  router.get(
    '/shift-templates',
    handle(() => service.listTemplates())
  )
  router.post(
    '/shift-templates',
    handle((req) => service.createTemplate(req))
  )
  router.patch(
    '/shift-templates/:id',
    handle((req) => service.updateTemplate(req))
  )
  router.delete(
    '/shift-templates/:id',
    handle((req) => service.deleteTemplate(req))
  )

  router.get(
    '/shifts',
    handle((req) => service.listShifts(req))
  )
  router.post(
    '/shifts',
    handle((req) => service.createShift(req))
  )
  router.patch(
    '/shifts/:id',
    handle((req) => service.updateShift(req))
  )
  router.delete(
    '/shifts/:id',
    handle((req) => service.deleteShift(req))
  )

  router.get(
    '/absences',
    handle((req) => service.listAbsences(req))
  )
  router.post(
    '/absences',
    handle((req) => service.createAbsence(req))
  )
  router.patch(
    '/absences/:id',
    handle((req) => service.updateAbsence(req))
  )
  router.delete(
    '/absences/:id',
    handle((req) => service.deleteAbsence(req))
  )

  router.get(
    '/balance',
    handle((req) => service.balance(req))
  )

  return router
}
