import type { PartybrezelConfig } from '../config/partybrezel.config'
import { sanitizeOrderState, type OrderState } from './orderState'

/** Nur Bequemlichkeit: der Entwurf bleibt im Browser dieses Geräts. */
export const DRAFT_STORAGE_KEY = 'bakery-partybrezel-draft-v1'

export interface StoredDraft {
  state: OrderState
  /** Zuletzt offener Schritt (0-basiert); ob er erreichbar ist, prüft die Seite. */
  step: number
}

function readStep(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0
}

export function loadDraft(config: PartybrezelConfig): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const state = sanitizeOrderState(parsed, config)
    if (!state) return null
    const step = readStep((parsed as { step?: unknown }).step)
    return { state, step }
  } catch {
    return null
  }
}

export function saveDraft(state: OrderState, step = 0): void {
  try {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ ...state, step })
    )
  } catch {
    // privater Modus, voller Speicher - der Entwurf ist nur Komfort
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // siehe saveDraft
  }
}
