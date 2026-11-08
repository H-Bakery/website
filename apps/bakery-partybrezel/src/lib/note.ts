/**
 * Die Anmerkung der Vorbestellung: Belagsliste je Brezel plus die Anmerkung
 * der Kundschaft. Eigenes Modul, weil Prüfung (validation.ts) und Payload
 * (payload.ts) dieselbe Länge brauchen - die API nimmt höchstens 500 Zeichen
 * für die ganze Anmerkung.
 */
import type {
  PartybrezelConfig,
  SizeId,
  ToppingMode,
} from '../config/partybrezel.config'
import { findTopping, getSize } from './configLookup'
import type { PretzelDraft } from './types'

/** Wie die API (delivery-preorders.core.js): Anmerkung höchstens 500 Zeichen. */
export const API_MAX_NOTE_LENGTH = 500

const NOTE_PREFIX = 'Partybrezel – '
const CUSTOMER_NOTE_PREFIX = ' | Anmerkung: '

function sizeLabel(config: PartybrezelConfig, id: SizeId) {
  return getSize(config, id).label
}

/** "Käse, Schinken, Butter" bzw. "3× Käse" (alle Teile gleich). */
function describeParts(
  pretzel: PretzelDraft,
  mode: ToppingMode,
  config: PartybrezelConfig
): string {
  const size = getSize(config, pretzel.size)
  const labels: string[] = []
  for (let part = 0; part < size.partsPerPretzel; part += 1) {
    labels.push(
      findTopping(config, pretzel.toppings[part])?.label ?? 'ohne Belag'
    )
  }
  if (labels.every((l) => l === labels[0])) {
    return mode === 'per-pretzel'
      ? `${labels[0]} (ganze Brezel)`
      : `${labels.length}× ${labels[0]}`
  }
  return labels.join(', ')
}

/** [1, 2, 3, 5, 7, 8] -> "1–3, 5, 7, 8" (Läufe ab drei Nummern als Spanne). */
function formatNumbers(numbers: number[]): string {
  const out: string[] = []
  let i = 0
  while (i < numbers.length) {
    let j = i
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j] + 1) j += 1
    if (j - i >= 2) out.push(`${numbers[i]}–${numbers[j]}`)
    else for (let k = i; k <= j; k += 1) out.push(String(numbers[k]))
    i = j + 1
  }
  return out.join(', ')
}

/**
 * "Brezel 1, 2 (groß): Käse, Schinken, Butter; Brezel 3 (klein): 3× Butter".
 * Gleich belegte Brezeln einer Größe stehen in einer Gruppe - die Nummern
 * bleiben, damit die Zuordnung Teil → Brezel erhalten bleibt.
 */
export function describePretzels(
  pretzels: PretzelDraft[],
  mode: ToppingMode,
  config: PartybrezelConfig
): string {
  const groups = new Map<string, { numbers: number[]; text: string }>()
  pretzels.forEach((p, i) => {
    const parts = describeParts(p, mode, config)
    const key = `${p.size}|${parts}`
    const group = groups.get(key)
    if (group) group.numbers.push(i + 1)
    else
      groups.set(key, {
        numbers: [i + 1],
        text: `(${sizeLabel(config, p.size)}): ${parts}`,
      })
  })
  return [...groups.values()]
    .map((g) => `Brezel ${formatNumbers(g.numbers)} ${g.text}`)
    .join('; ')
}

export interface ComposedNote {
  note: string
  truncated: boolean
  fullLength: number
}

/**
 * Anmerkung = "Partybrezel – <Belagsliste>" + " | Anmerkung: <Text der
 * Kundschaft>". Ist sie länger als die API erlaubt, wird gekürzt - nie still:
 * `truncated` geht als Warnung in die Vorschau. Die Oberfläche lässt es gar
 * nicht so weit kommen (`validateNoteFits` in validation.ts).
 */
export function composeNote(
  description: string,
  customerNote: string,
  maxLength: number = API_MAX_NOTE_LENGTH
): ComposedNote {
  const extra = customerNote.trim()
  const full = `${NOTE_PREFIX}${description}${
    extra ? `${CUSTOMER_NOTE_PREFIX}${extra}` : ''
  }`
  if (full.length <= maxLength)
    return { note: full, truncated: false, fullLength: full.length }
  return {
    note: `${full.slice(0, maxLength - 1)}…`,
    truncated: true,
    fullLength: full.length,
  }
}
