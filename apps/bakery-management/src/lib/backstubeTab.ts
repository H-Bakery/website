/**
 * Welcher Reiter des Backstube-Tablets zuerst offen ist (Z10,
 * docs/backzettel-v2.md §7.3). Rein, ohne React - `backstubeDay.ts` sagt,
 * welcher Tag; hier steht nur, welche Ansicht dieses Tages.
 *
 * - **Zettel**: der Teigtag-Zettel - was heute an Teig gemacht wird (Brot,
 *   Brötchen für morgen/übermorgen, Hefeteig).
 * - **Backen**: die Backliste - was heute in den Ofen kommt, auch aus Teig
 *   vom Vortag.
 * - **Vorbereitung**: unverändert (Z6).
 */

import type { BackzettelDayResult } from './backzettelApi'
import { isBackzettelDay } from './backzettelApi'

export type BackstubeTabId = 'zettel' | 'backen' | 'vorbereitung'

/**
 * Zettel, außer der Tag ist kein Teigtag oder sein Zettel hat keine Zeile -
 * dann Backen (Sonntag: es wird nur gebacken). Ein Ruhetag, fehlende
 * Stammdaten oder ein noch nicht geladener Tag bleiben beim Zettel (der sagt,
 * was los ist). Tage von vor Z10 (`sheetVersion` fehlt oder 1) sind immer
 * Teigtag = Backtag - also Zettel.
 */
export function defaultBackstubeTab(
  sheet: BackzettelDayResult | null | undefined
): BackstubeTabId {
  if (!isBackzettelDay(sheet)) return 'zettel'
  if (sheet.sheetVersion !== 2) return 'zettel'
  if (sheet.isDoughDay === false) return 'backen'
  const lines = sheet.sections.reduce((n, s) => n + s.lines.length, 0)
  return lines === 0 ? 'backen' : 'zettel'
}
