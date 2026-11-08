/**
 * `audit()` - one row in `audit_log` (D5: every write is attributed).
 *
 *   await audit(req, 'update', 'user', user.id, { changes }, { transaction: t })
 *
 * The acting user is `req.user.id` unless `options.userId` says otherwise
 * (`null` for the CLI or a failed login). Pass the transaction of the write
 * it documents, so both commit or neither. Keep personal data that gets
 * anonymised elsewhere out of `data` (see `AuditLog`); never put a password,
 * PIN or token in it.
 */
import type { Request } from 'express'
import type { Transaction } from 'sequelize'

import { AuditLog } from '../models'
import './types'

export interface AuditOptions {
  transaction?: Transaction
  /** Acting user; default `req.user?.id`, `null` = system/anonymous. */
  userId?: number | null
}

export async function audit(
  req: Request | null,
  action: string,
  entity: string,
  entityId: string | number | null | undefined,
  data?: Record<string, unknown> | null,
  options: AuditOptions = {}
): Promise<AuditLog> {
  const userId =
    options.userId !== undefined ? options.userId : req?.user?.id ?? null
  return AuditLog.create(
    {
      userId,
      action,
      entity,
      entityId:
        entityId === null || entityId === undefined ? null : String(entityId),
      data: data ?? null,
    },
    { transaction: options.transaction }
  )
}

/**
 * Fire-and-forget variant for events that must not fail the request (failed
 * logins): errors are logged, never thrown.
 */
export function auditQuietly(
  req: Request | null,
  action: string,
  entity: string,
  entityId: string | number | null | undefined,
  data?: Record<string, unknown> | null,
  options: AuditOptions = {}
): Promise<void> {
  return audit(req, action, entity, entityId, data, options).then(
    () => undefined,
    (error) => {
      console.error(`[ERROR] audit ${action} ${entity} failed`, error)
    }
  )
}
