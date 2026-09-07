import { PrepTaskItem } from '../types/prepTask'

type TrayFields = Pick<
  PrepTaskItem,
  'tray_number' | 'tray_numbers' | 'trays_of'
>

const isTrayNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Die Blechnummern einer Position, bereinigt: nur endliche Zahlen; eine
 * Position ohne Angabe ergibt ein leeres Array.
 */
export const getTrayNumbers = (item: TrayFields): number[] => {
  if (Array.isArray(item.tray_numbers)) {
    return item.tray_numbers.filter(isTrayNumber)
  }
  return isTrayNumber(item.tray_number) ? [item.tray_number] : []
}

/**
 * Blech-Angabe einer Position als Text - oder `null`, wenn keine Blechnummer
 * hinterlegt ist. Eine Position ohne Blech bekommt keinen Text, damit nie
 * "Blech undefined" in der Liste oder im Druck steht.
 *
 * Beispiele: "Blech 5", "Bleche 11, 12, 13", "3 Bleche à 5 (Bleche 11, 12, 13)".
 */
export const formatTrayInfo = (item: TrayFields): string | null => {
  const trays = getTrayNumbers(item)
  if (trays.length === 0) return null

  const list =
    trays.length === 1 ? `Blech ${trays[0]}` : `Bleche ${trays.join(', ')}`

  if (trays.length > 1 && isTrayNumber(item.trays_of) && item.trays_of > 0) {
    return `${trays.length} Bleche à ${item.trays_of} (${list})`
  }
  return list
}
