/**
 * Entwurf der Vorbestell-Maske (W4-Verifikation Runde 4): eine halb erfasste
 * Telefonbestellung ging verloren, wenn die Sitzung endete (Station 10 min
 * ohne Bedienung, 12 h nach der PIN, widerrufen) oder jemand nach einem
 * WLAN-Fehler die Seite neu lud - der Kunde hatte da schon aufgelegt.
 *
 * Der Entwurf liegt in `sessionStorage` (nur dieser Tab, endet mit ihm),
 * **einer je Benutzer** (`draftKey`): an einer gemeinsamen Station sieht ihn
 * nur, wer ihn angefangen hat, und ein Kollege überschreibt ihn nicht. Nach `DRAFT_MAX_AGE_MS` verfällt er. Mit ihm wandert
 * die `requestId` des Speicherns, damit ein Wiederholen nach verlorener
 * Antwort keine zweite Bestellung anlegt.
 */
import type { PreorderChannel } from './preordersTypes'

const KEY = 'bakery-management-preorder-draft'
/** Wie die PIN-Sitzung: danach ist ein Entwurf sicher überholt. */
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000

/**
 * Ein Schlüssel je Benutzer (W4-Verifikation Runde 5): an der gemeinsamen
 * Laden-Station überschrieb sonst die Eingabe eines Kollegen den halb
 * erfassten Entwurf der Verkäuferin, die gerade abgemeldet wurde.
 */
export function draftKey(userId: string | number): string {
  return `${KEY}:${String(userId)}`
}

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
  /** Gesetzt, sobald gespeichert werden sollte (Antwort evtl. verloren). */
  requestId: string | null
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function noUser(userId: string | number | null | undefined): boolean {
  return userId === null || userId === undefined || userId === ''
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

function parseDraft(
  raw: string | null | undefined,
  userId: string | number,
  now: Date
): PreorderDraft | null {
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
}

export function readPreorderDraft(
  userId: string | number | null | undefined,
  now: Date = new Date()
): PreorderDraft | null {
  if (noUser(userId)) return null
  const id = userId as string | number
  try {
    const store = storage()
    // Der gemeinsame Schlüssel bis Runde 4 - ein Entwurf von vor dem Update
    // geht so nicht verloren.
    return (
      parseDraft(store?.getItem(draftKey(id)), id, now) ??
      parseDraft(store?.getItem(KEY), id, now)
    )
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
  if (noUser(userId)) return
  const id = userId as string | number
  try {
    if (!draftHasContent(fields)) {
      clearPreorderDraft(id)
      return
    }
    const draft: PreorderDraft = {
      ...fields,
      userId: String(id),
      savedAt: now.toISOString(),
      requestId,
    }
    storage()?.setItem(draftKey(id), JSON.stringify(draft))
    removeLegacy(id)
  } catch {
    // ohne Speicher bleibt nur die Maske selbst
  }
}

/** Den alten gemeinsamen Eintrag entfernen, wenn er diesem Benutzer gehört. */
function removeLegacy(userId: string | number): void {
  const raw = storage()?.getItem(KEY)
  const legacy = raw ? (JSON.parse(raw) as PreorderDraft) : null
  if (legacy && String(legacy.userId) === String(userId)) {
    storage()?.removeItem(KEY)
  }
}

export function clearPreorderDraft(userId?: string | number | null): void {
  if (noUser(userId)) return
  const id = userId as string | number
  try {
    storage()?.removeItem(draftKey(id))
    removeLegacy(id)
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

/* ------------------------------------------------------------------ *
 * Bearbeiten einer gespeicherten Bestellung (W4-Verifikation Runde 6)
 * ------------------------------------------------------------------ */

const EDIT_KEY = 'bakery-management-preorder-edit'

/**
 * Nicht gespeicherte Änderungen an einer schon gespeicherten Bestellung -
 * eine je Benutzer (bearbeitet wird immer nur eine). `baseUpdatedAt` ist die
 * Fassung, auf der die Änderungen beruhen: gespeichert wird später mit genau
 * dieser Version, damit ein inzwischen von anderer Stelle Geändertes nicht
 * still überschrieben wird (409 statt Überschreiben).
 */
export interface PreorderEditDraft {
  userId: string
  preorderId: number
  baseUpdatedAt: string | null
  savedAt: string
  fields: PreorderDraftFields
}

export function editDraftKey(userId: string | number): string {
  return `${EDIT_KEY}:${String(userId)}`
}

export function readPreorderEditDraft(
  userId: string | number | null | undefined,
  preorderId?: number,
  now: Date = new Date()
): PreorderEditDraft | null {
  if (noUser(userId)) return null
  try {
    const raw = storage()?.getItem(editDraftKey(userId as string | number))
    if (!raw) return null
    const draft = JSON.parse(raw) as PreorderEditDraft
    if (!draft || typeof draft !== 'object') return null
    if (String(draft.userId) !== String(userId)) return null
    if (!Number.isSafeInteger(draft.preorderId)) return null
    if (preorderId !== undefined && draft.preorderId !== preorderId) {
      return null
    }
    const at = Date.parse(draft.savedAt)
    if (!Number.isFinite(at) || now.getTime() - at > DRAFT_MAX_AGE_MS) {
      return null
    }
    if (!draft.fields || !Array.isArray(draft.fields.lines)) return null
    return draft
  } catch {
    return null
  }
}

export function savePreorderEditDraft(
  userId: string | number | null | undefined,
  preorderId: number,
  baseUpdatedAt: string | null,
  fields: PreorderDraftFields,
  now: Date = new Date()
): void {
  if (noUser(userId)) return
  const id = userId as string | number
  try {
    const draft: PreorderEditDraft = {
      userId: String(id),
      preorderId,
      baseUpdatedAt,
      savedAt: now.toISOString(),
      fields,
    }
    storage()?.setItem(editDraftKey(id), JSON.stringify(draft))
  } catch {
    // ohne Speicher bleibt nur die Maske selbst
  }
}

/** Ohne `preorderId`: jede; mit: nur, wenn er zu dieser Bestellung gehört. */
export function clearPreorderEditDraft(
  userId: string | number | null | undefined,
  preorderId?: number
): void {
  if (noUser(userId)) return
  const id = userId as string | number
  try {
    const key = editDraftKey(id)
    if (preorderId !== undefined) {
      // Ein Entwurf zu einer anderen Bestellung bleibt stehen.
      const raw = storage()?.getItem(key)
      const other = raw ? (JSON.parse(raw) as PreorderEditDraft) : null
      if (other && other.preorderId !== preorderId) return
    }
    storage()?.removeItem(key)
  } catch {
    // nichts zu tun
  }
}
