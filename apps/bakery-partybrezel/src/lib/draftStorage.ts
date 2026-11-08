import type { PartybrezelConfig } from '../config/partybrezel.config'
import { sanitizeOrderState, type OrderState } from './orderState'

/** Nur Bequemlichkeit: der Entwurf bleibt im Browser dieses Geräts. */
export const DRAFT_STORAGE_KEY = 'bakery-partybrezel-draft-v1'

export function loadDraft(config: PartybrezelConfig): OrderState | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    return sanitizeOrderState(JSON.parse(raw), config)
  } catch {
    return null
  }
}

export function saveDraft(state: OrderState): void {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state))
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
