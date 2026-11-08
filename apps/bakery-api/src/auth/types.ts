/**
 * Types of the pilot auth (B3) and the `req.user` / `req.station`
 * augmentation of Express.
 */
import type { SessionKind } from '../models/AuthSession'
import type { Station } from '../models/Station'
import type { UserRole } from '../models/User'

export type { SessionKind, UserRole }

/** What every route behind the global guard finds on `req.user`. */
export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  sessionKind: SessionKind
  /** The `auth_sessions` row of this login. */
  sessionId: number
  /** Station the PIN was entered at (`sessionKind: 'station'`), else null. */
  stationId: number | null
}

declare global {
  // Express type augmentation: a namespace is the intended form here.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth` (global guard on `/api`). */
      user?: AuthUser
      /** Set by `requireStation` (header `X-Station-Token`). */
      station?: Station
    }
  }
}

/** An expected auth failure: answered with `status`, `error`, German `message`. */
export class AuthError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
  }
}
