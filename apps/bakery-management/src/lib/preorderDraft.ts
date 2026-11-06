/**
 * Entwurf der Vorbestell-Maske (W4-Verifikation Runde 4): eine halb erfasste
 * Telefonbestellung ging verloren, wenn die Sitzung endete (Station 10 min
 * ohne Bedienung, 12 h nach der PIN, widerrufen) oder jemand nach einem
 * WLAN-Fehler die Seite neu lud - der Kunde hatte da schon aufgelegt.
 *
 * Der Entwurf liegt in `sessionStorage` (nur dieser Tab, endet mit ihm) und
 * gehört **einem Benutzer**: an einer gemeinsamen Station sieht ihn nur, wer
 * ihn angefangen hat. Nach `DRAFT_MAX_AGE_MS` verfällt er. Mit ihm wandert
 * die `requestId` des Speicherns, damit ein Wiederholen nach verlorener
 * Antwort keine zweite Bestellung anlegt.
 */
import type { PreorderChannel } from './preordersTypes'

const KEY = 'bakery-management-preorder-draft'
/** Wie die PIN-Sitzung: danach ist ein Entwurf sicher überholt. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface PreorderDraftLine {
  key: string
  productId: string
  name: string
  variant: string
  unit: string
  unitPrice: number
  quantity: number
}

export interface PreorderDraftFields {
  customerName: string
  customerPhone: string
  channel: PreorderChannel
  pickupPointId: string
  pickupDate: string
  pickupTime: string
  paid: boolean
  note: string
  lines: PreorderDraftLine[]
}

export interface PreorderDraft extends PreorderDraftFields {
  userId: string
  savedAt: string
  requestId: string | null
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Steht überhaupt etwas drin, das man vermissen würde? */
export function draftHasContent(fields: PreorderDraftFields): boolean {
  return (
    fields.customerName.trim() !== '' ||
    fields.customerPhone.trim() !== '' ||
    fields.note.trim() !== '' ||
    fields.lines.length > 0
  )
}

export function readPreorderDraft(
  userId: string | number | null | undefined,
  now: Date = new Date()
): PreorderDraft | null {
  if (userId === null || userId === undefined || userId === '') return null
  try {
    const raw = storage()?.getItem(KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as PreorderDraft
    if (!draft || typeof draft !== 'object') return null
    if (String(draft.userId) !== String(userId)) return null
    const at = Date.parse(draft.savedAt)
    if (!Number.isFinite(at) || now.getTime() - at > DRAFT_MAX_AGE_MS) {
      return null
    }
    if (!Array.isArray(draft.lines)) return null
    return draft
  } catch {
    return null
  }
}

export function savePreorderDraft(
  userId: string | number | null | undefined,
  fields: PreorderDraftFields,
  requestId: string | null,
  now: Date = new Date()
): void {
  if (userId === null || userId === undefined || userId === '') return
  try {
    if (!draftHasContent(fields)) {
      // Nichts Eigenes - aber den Entwurf eines anderen nicht löschen.
      const raw = storage()?.getItem(KEY)
      const other = raw ? (JSON.parse(raw) as PreorderDraft) : null
      if (!other || String(other.userId) === String(userId)) {
        storage()?.removeItem(KEY)
      }
      return
    }
    const draft: PreorderDraft = {
      ...fields,
      userId: String(userId),
      savedAt: now.toISOString(),
      requestId,
    }
    storage()?.setItem(KEY, JSON.stringify(draft))
  } catch {
    // ohne Speicher bleibt nur die Maske selbst
  }
}

export function clearPreorderDraft(userId?: string | number | null): void {
  try {
    if (userId !== undefined && userId !== null) {
      const raw = storage()?.getItem(KEY)
      const draft = raw ? (JSON.parse(raw) as PreorderDraft) : null
      if (draft && String(draft.userId) !== String(userId)) return
    }
    storage()?.removeItem(KEY)
  } catch {
    // nichts zu tun
  }
}

/** Kennung für ein Speichern (`requestId`), über Wiederholungen gleich. */
export function newRequestId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
    if (c && typeof c.getRandomValues === 'function') {
      const bytes = c.getRandomValues(new Uint8Array(16))
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // weiter unten
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
