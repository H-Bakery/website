/**
 * Archive service for notifications.
 *
 * The backend currently only offers `POST /api/notifications/:id/archive`
 * (which removes the notification from the active list). Listing, restoring
 * and permanently deleting archived notifications are therefore handled with
 * a browser-local archive (localStorage) as fallback. When the backend gains
 * the corresponding endpoints (`GET /api/notifications/archived`,
 * `POST /api/notifications/:id/restore`, `DELETE /api/notifications/:id/permanent`)
 * they are used automatically and the local store only acts as a cache.
 */
import type { Notification, ArchiveStats } from '@bakery/shared/types'

/** Notification as it arrives over the wire (dates serialised) */
export type ArchivedNotification = Omit<
  Notification,
  'createdAt' | 'expiresAt'
> & {
  createdAt: string | Date
  expiresAt?: string | Date
  archivedAt?: string
}

export interface ArchiveQueryOptions {
  category?: string
  priority?: string
}

export interface ArchiveListResult {
  notifications: ArchivedNotification[]
  total: number
  hasMore: boolean
  /** true when the result comes from the browser-local archive */
  local: boolean
}

const STORAGE_KEY = 'bakery-notification-archive'
const BASE_PATH = '/api/notifications'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readLocal = (): ArchivedNotification[] => {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeLocal = (items: ArchivedNotification[]) => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / privacy mode errors
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const tryFetch = async (
  input: string,
  init?: RequestInit
): Promise<Response | null> => {
  if (typeof fetch === 'undefined') return null
  try {
    const res = await fetch(input, init)
    return res
  } catch {
    return null
  }
}

const matchesFilters = (
  n: ArchivedNotification,
  options?: ArchiveQueryOptions
) => {
  if (options?.category && n.category !== options.category) return false
  if (options?.priority && n.priority !== options.priority) return false
  return true
}

export const notificationArchiveService = {
  /**
   * Archive a notification. Calls the backend and stores a copy locally so
   * it can be listed/restored even without backend support.
   */
  async archive(notification: ArchivedNotification): Promise<void> {
    const res = await tryFetch(`${BASE_PATH}/${notification.id}/archive`, {
      method: 'POST',
      headers: jsonHeaders,
    })
    if (res && !res.ok && res.status !== 404) {
      throw new Error(`Archivieren fehlgeschlagen (${res.status})`)
    }
    const local = readLocal().filter((n) => n.id !== notification.id)
    local.unshift({ ...notification, archivedAt: new Date().toISOString() })
    writeLocal(local)
  },

  /** List archived notifications (backend first, local fallback). */
  async list(options?: ArchiveQueryOptions): Promise<ArchiveListResult> {
    const params = new URLSearchParams()
    if (options?.category) params.set('category', options.category)
    if (options?.priority) params.set('priority', options.priority)
    const query = params.toString() ? `?${params}` : ''

    const res = await tryFetch(`${BASE_PATH}/archived${query}`)
    if (res && res.ok) {
      try {
        const body = await res.json()
        const data = body?.data ?? body
        const notifications: ArchivedNotification[] = Array.isArray(data)
          ? data
          : data?.notifications ?? []
        return {
          notifications,
          total: data?.total ?? notifications.length,
          hasMore: Boolean(data?.hasMore),
          local: false,
        }
      } catch {
        // fall through to local
      }
    }

    const notifications = readLocal().filter((n) => matchesFilters(n, options))
    return {
      notifications,
      total: notifications.length,
      hasMore: false,
      local: true,
    }
  },

  /** Aggregate statistics over the archive. */
  async stats(): Promise<ArchiveStats> {
    const { notifications } = await this.list()
    const stats: ArchiveStats = {
      total: notifications.length,
      read: 0,
      unread: 0,
      byCategory: {},
      byPriority: {},
    }
    notifications.forEach((n) => {
      if (n.read) stats.read += 1
      else stats.unread += 1
      stats.byCategory[n.category] = (stats.byCategory[n.category] || 0) + 1
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1
    })
    return stats
  },

  /**
   * Restore a notification. Uses the restore endpoint if available, otherwise
   * re-creates the notification via POST /api/notifications.
   */
  async restore(id: string): Promise<void> {
    const local = readLocal()
    const entry = local.find((n) => n.id === id)

    let res = await tryFetch(`${BASE_PATH}/${id}/restore`, {
      method: 'POST',
      headers: jsonHeaders,
    })
    if ((!res || !res.ok) && entry) {
      const payload: Partial<ArchivedNotification> = { ...entry }
      delete payload.archivedAt
      delete payload.id
      res = await tryFetch(BASE_PATH, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
    }
    if (res && !res.ok) {
      throw new Error(`Wiederherstellen fehlgeschlagen (${res.status})`)
    }
    writeLocal(local.filter((n) => n.id !== id))
  },

  /** Permanently delete an archived notification. */
  async permanentDelete(id: string): Promise<void> {
    const res = await tryFetch(`${BASE_PATH}/${id}/permanent`, {
      method: 'DELETE',
    })
    if (res && !res.ok && res.status !== 404) {
      throw new Error(`Löschen fehlgeschlagen (${res.status})`)
    }
    writeLocal(readLocal().filter((n) => n.id !== id))
  },
}
