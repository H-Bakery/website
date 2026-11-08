import type {
  PartybrezelConfig,
  SizeId,
  ToppingMode,
} from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import { isIsoDate } from './dates'
import type { OrderDraft, PretzelDraft } from './types'

export interface OrderState extends OrderDraft {
  /** Fortlaufende Nummer für stabile Brezel-IDs (React-Keys). */
  nextId: number
}

export type TextField = 'pickupTime' | 'name' | 'phone' | 'note'

export type OrderAction =
  | { type: 'setCount'; size: SizeId; count: number }
  | {
      type: 'setPartTopping'
      pretzelId: string
      part: number
      toppingId: string
    }
  | { type: 'setPretzelTopping'; pretzelId: string; toppingId: string }
  | { type: 'copyToAll'; pretzelId: string }
  | { type: 'setMode'; mode: ToppingMode }
  | { type: 'setPickupDate'; date: string | null }
  | { type: 'setField'; field: TextField; value: string }
  | { type: 'reset' }
  | { type: 'hydrate'; state: OrderState }

export function initialOrderState(config: PartybrezelConfig): OrderState {
  return {
    pretzels: [],
    toppingMode: config.defaultToppingMode,
    pickupDate: null,
    pickupTime: '',
    name: '',
    phone: '',
    note: '',
    nextId: 1,
  }
}

export function countBySize(pretzels: PretzelDraft[], size: SizeId): number {
  return pretzels.filter((p) => p.size === size).length
}

/** Größte erlaubte Anzahl einer Größe, wenn die übrigen Größen bleiben. */
export function maxCountForSize(
  pretzels: PretzelDraft[],
  size: SizeId,
  config: PartybrezelConfig
): number {
  const others = pretzels.length - countBySize(pretzels, size)
  return Math.max(0, config.maxPretzelsPerOrder - others)
}

function sortBySize(pretzels: PretzelDraft[], config: PartybrezelConfig) {
  const order = config.sizes.map((s) => s.id)
  // stabil: innerhalb einer Größe bleibt die Reihenfolge
  return [...pretzels].sort(
    (a, b) => order.indexOf(a.size) - order.indexOf(b.size)
  )
}

export function createOrderReducer(config: PartybrezelConfig) {
  return function orderReducer(
    state: OrderState,
    action: OrderAction
  ): OrderState {
    switch (action.type) {
      case 'setCount': {
        const size = getSize(config, action.size)
        const wanted = Math.floor(Number(action.count))
        const count = Math.min(
          Math.max(0, Number.isFinite(wanted) ? wanted : 0),
          maxCountForSize(state.pretzels, size.id, config)
        )
        const current = state.pretzels.filter((p) => p.size === size.id)
        if (count === current.length) return state
        let nextId = state.nextId
        let pretzels: PretzelDraft[]
        if (count > current.length) {
          const added: PretzelDraft[] = []
          for (let i = current.length; i < count; i += 1) {
            added.push({
              id: `p${nextId}`,
              size: size.id,
              toppings: Array(size.partsPerPretzel).fill(null),
            })
            nextId += 1
          }
          pretzels = sortBySize([...state.pretzels, ...added], config)
        } else {
          // die zuletzt hinzugefügten Brezeln dieser Größe fallen weg
          const drop = new Set(current.slice(count).map((p) => p.id))
          pretzels = state.pretzels.filter((p) => !drop.has(p.id))
        }
        return { ...state, pretzels, nextId }
      }
      case 'setPartTopping': {
        if (!findTopping(config, action.toppingId)) return state
        return {
          ...state,
          pretzels: state.pretzels.map((p) => {
            if (p.id !== action.pretzelId) return p
            const parts = getSize(config, p.size).partsPerPretzel
            if (action.part < 0 || action.part >= parts) return p
            const toppings = [...p.toppings]
            toppings[action.part] = action.toppingId
            return { ...p, toppings }
          }),
        }
      }
      case 'setPretzelTopping': {
        if (!findTopping(config, action.toppingId)) return state
        return {
          ...state,
          pretzels: state.pretzels.map((p) =>
            p.id === action.pretzelId
              ? {
                  ...p,
                  toppings: Array(getSize(config, p.size).partsPerPretzel).fill(
                    action.toppingId
                  ),
                }
              : p
          ),
        }
      }
      case 'copyToAll': {
        const source = state.pretzels.find((p) => p.id === action.pretzelId)
        if (!source) return state
        return {
          ...state,
          pretzels: state.pretzels.map((p) => {
            if (p.id === source.id) return p
            const parts = getSize(config, p.size).partsPerPretzel
            const toppings = Array.from(
              { length: parts },
              (_, i) => source.toppings[i % source.toppings.length] ?? null
            )
            return { ...p, toppings }
          }),
        }
      }
      case 'setMode':
        return { ...state, toppingMode: action.mode }
      case 'setPickupDate':
        return { ...state, pickupDate: action.date }
      case 'setField':
        return { ...state, [action.field]: action.value }
      case 'reset':
        return initialOrderState(config)
      case 'hydrate':
        return action.state
      default:
        return state
    }
  }
}

/**
 * Liest einen gespeicherten Entwurf vorsichtig: unbekannte Größen fallen weg,
 * unbekannte Beläge werden zu "offen", zu viele Brezeln werden abgeschnitten.
 * Liefert `null`, wenn nichts Brauchbares darin steht.
 */
export function sanitizeOrderState(
  raw: unknown,
  config: PartybrezelConfig
): OrderState | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const base = initialOrderState(config)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const sizes = new Set(config.sizes.map((s) => s.id))
  const pretzels: PretzelDraft[] = []
  let nextId = 1
  if (Array.isArray(value.pretzels)) {
    for (const entry of value.pretzels) {
      if (pretzels.length >= config.maxPretzelsPerOrder) break
      if (!entry || typeof entry !== 'object') continue
      const p = entry as Record<string, unknown>
      if (typeof p.size !== 'string' || !sizes.has(p.size as SizeId)) continue
      const size = getSize(config, p.size as SizeId)
      const rawToppings = Array.isArray(p.toppings) ? p.toppings : []
      pretzels.push({
        id: `p${nextId}`,
        size: size.id,
        toppings: Array.from({ length: size.partsPerPretzel }, (_, i) => {
          const t = rawToppings[i]
          return typeof t === 'string' && findTopping(config, t) ? t : null
        }),
      })
      nextId += 1
    }
  }
  const mode: ToppingMode =
    value.toppingMode === 'per-part' || value.toppingMode === 'per-pretzel'
      ? value.toppingMode
      : base.toppingMode
  return {
    pretzels: sortBySize(pretzels, config),
    toppingMode: mode,
    pickupDate: isIsoDate(value.pickupDate) ? value.pickupDate : null,
    pickupTime: str(value.pickupTime),
    name: str(value.name),
    phone: str(value.phone),
    note: str(value.note),
    nextId,
  }
}
