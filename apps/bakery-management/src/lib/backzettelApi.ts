/**
 * Client der Backzettel-API (Z3, `apps/bakery-api/CLAUDE.md` „Backzettel API
 * (Z3)"). Geteilt von der Tagesplanung (`/admin/backzettel`, Z5/Z7) und der
 * Backstube-Ansicht (`/backstube`, Z6).
 *
 * Kapselt `apiClient` wie `partnerApi.ts`: die Seiten kennen keine
 * Endpunkt-Strings. Fehler kommen als `ApiError` (Status, maschinenlesbarer
 * `code`, deutsche `message`) beim Aufrufer an - mit einer Ausnahme:
 * `fetchBackzettelDay` macht aus der 409 `ruhetag` einen normalen Zustand
 * (`status: 'ruhetag'`), weil ein Montag kein Fehler ist, sondern ein Tag ohne
 * Backzettel.
 *
 * Gerechnet wird hier nichts. Alle Mengen stammen aus `backzettel.core.js` auf
 * dem Server; der Client zeigt sie nur an.
 */

import { apiClient } from '@bakery/shared/data-access'

export type BackzettelUnit = 'Stück' | 'Liter' | 'Blech' | 'kg' | string

export interface BackzettelUserRef {
  id: number
  displayName: string
}

/** Nachträge zu einer Zeile (nur an freigegebenen Tagen). */
export interface BackzettelLineDelta {
  /** Summe aller Nachträge der Zeile (kann negativ sein). */
  qty: number
  /** Davon noch nicht quittiert (Anzahl Einträge). */
  open: number
  count: number
}

export interface BackzettelLine {
  /** Zeilen-ID; `null` in einem Entwurf ohne gespeicherte Zeile - dann `key` benutzen. */
  id: number | null
  /** `itemId|variant` - stabil in Entwurf und Freigabe. */
  key: string
  itemId: string
  name: string
  section: string | null
  unit: BackzettelUnit
  /** Füllung/Sorte; `null` = keine (bzw. „ohne Füllungsangabe"). */
  variant: string | null
  base: number
  /** `true`: Grundmenge noch nicht festgelegt (≠ 0 = wird nicht gebacken). */
  baseUnset: boolean
  /** Zuschlag durch den Saisonfaktor (aufgerundet − Basis). */
  seasonal: number
  preorders: number
  preordersExact?: number
  preorderIds?: number[]
  cap: number
  correction: number
  correctionReason: string | null
  correctionBy: BackzettelUserRef | null
  total: number
  /** Blechangabe, z. B. „Blech 7-9" (nur Anzeige). */
  tray: string | null
  plu: number[]
  /** Nur Liter-Posten mit `pieces_per_liter`. */
  loavesEstimate?: number
  doneAt: string | null
  doneBy: BackzettelUserRef | null
  delta: BackzettelLineDelta | null
}

export interface BackzettelSection {
  id: string
  label: string
  lines: BackzettelLine[]
}

export interface HefeteigWeighingItem {
  itemId: string
  name: string
  /** Zu backende Produkte (Zeilen-Gesamt). */
  products: number
  piecesPerProduct: number
  pieces: number
}

export interface HefeteigWeighing {
  piece_g: number
  pieces: number
  items: HefeteigWeighingItem[]
}

export interface HefeteigDough {
  id: string
  name: string
  batch_max_kg: number | null
  pieces: number
  dough_g: number
  /** `null`, wenn die Chargengröße nicht festgelegt ist. */
  batches: number | null
  weighing: HefeteigWeighing[]
}

export interface Hefeteig {
  doughs: HefeteigDough[]
  pieces: number
  dough_g: number
}

export interface ScaledIngredient {
  name: string
  g: number | null
  unit: string | null
  raw: string
  /** Auf 10 g gerundet; `null`, wenn die Zutat keine Grammangabe hat. */
  scaled_g: number | null
}

export interface ScaledRecipe {
  title: string
  batch_g: number
  grams: number
  factor: number
  complete: boolean
  ingredients: ScaledIngredient[]
}

export interface FillingNeedItem {
  itemId: string
  name: string
  pieces: number
  filling_g: number | null
  grams: number | null
}

export interface FillingNeed {
  id: string
  name: string
  grams: number
  /** Mindestens ein Posten ohne Füllungsgramm - `grams` ist dann zu klein. */
  missingFillingG: boolean
  items: FillingNeedItem[]
  recipe: ScaledRecipe | null
  recipeMissing: boolean
}

export interface PrepTask {
  id: string
  name: string
  variant: string | null
  note?: string | null
}

export interface BackzettelWarning {
  code: string
  message: string
  [key: string]: unknown
}

export type BackzettelDeltaKind = 'added' | 'changed' | 'cancelled'

/** Eine Vorbestellungsänderung nach der Freigabe (eine Zeile je Änderung). */
export interface BackzettelDeltaEntry {
  id: number
  key: string
  itemId: string
  name: string
  unit: BackzettelUnit | null
  variant: string | null
  qty: number
  kind: BackzettelDeltaKind | string
  preorderId: number | null
  preorderCode: string | null
  /** Wann der Server die Änderung bemerkt hat. */
  createdAt: string
  acknowledgedAt: string | null
  acknowledgedBy: BackzettelUserRef | null
}

export interface ConfigReason {
  path?: string
  message: string
}

export interface BackzettelDay {
  date: string
  weekday: number
  weekdayName: string
  status: 'draft' | 'confirmed'
  seasonFactor: number
  confirmedBy: BackzettelUserRef | null
  confirmedAt: string | null
  sections: BackzettelSection[]
  /** `null` nur an alten freigegebenen Tagen ohne Stammdaten. */
  hefeteig: Hefeteig | null
  fillings: FillingNeed[] | null
  prep: PrepTask[] | null
  /** Kalender-Vortag: dann wird vorbereitet. */
  prepDate: string
  /** Vortag ist selbst Ruhetag - wer vorbereitet, ist offen (Q-B2). */
  prepDateProvisional: boolean | null
  deltas: BackzettelDeltaEntry[]
  warnings: BackzettelWarning[]
  configStatus: 'ok' | 'no-config'
  /** Nur freigegeben: aktuelle Stammdaten ergäben jetzt etwas anderes. */
  configChangedSinceConfirm?: boolean | null
  configReasons?: ConfigReason[]
}

export interface BackzettelNoConfig {
  date: string
  status: 'no-config'
  reasons: ConfigReason[]
  warnings?: ConfigReason[]
}

export interface BackzettelRuhetag {
  date: string
  status: 'ruhetag'
  weekday: number | null
  message: string
}

export type BackzettelDayResult =
  | BackzettelDay
  | BackzettelNoConfig
  | BackzettelRuhetag

export function isBackzettelDay(
  result: BackzettelDayResult | null | undefined
): result is BackzettelDay {
  return (
    !!result && (result.status === 'draft' || result.status === 'confirmed')
  )
}

/** Normalisierte Stammdaten, soweit die Oberfläche sie braucht. */
export interface BackzettelConfigItem {
  id: string
  name: string
  section: string
  unit: BackzettelUnit
  variants: string[]
  [key: string]: unknown
}

export interface BackzettelConfigData {
  version: number
  days: number[]
  sections: string[]
  items: BackzettelConfigItem[]
  doughs: { id: string; name: string; batch_max_kg: number | null }[]
  fillings: { id: string; name: string; [key: string]: unknown }[]
  prep: { id: string; name: string; [key: string]: unknown }[]
}

export interface BackzettelConfigResponse {
  status: 'ok' | 'no-config'
  /** Nur der Dateiname, nie ein Serverpfad. */
  source: string
  loadedAt: string
  config: BackzettelConfigData | null
  errors: ConfigReason[]
  warnings: ConfigReason[]
  recipesMissing: { id: string; message: string }[]
  catalogSize: number | null
}

export interface PrepView {
  date: string
  weekday: number
  weekdayName: string
  status: 'draft' | 'confirmed'
  prepDate: string
  prepDateProvisional: boolean | null
  prep: PrepTask[] | null
  configStatus: 'ok' | 'no-config'
}

export interface LineDoneResult {
  id: number
  date: string
  itemId: string
  variant: string | null
  doneAt: string | null
  doneBy: BackzettelUserRef | null
}

const BASE = '/api/backzettel'

/** `data` einer `{ success, data }`-Antwort. */
function unwrap<T>(res: { data?: T } | undefined): T {
  return res?.data as T
}

function datePath(date: string): string {
  return `${BASE}/${encodeURIComponent(date)}`
}

/** Pfad einer Zeile für die Korrektur: Variante als eigenes Segment, ohne Variante weggelassen. */
export function correctionPath(
  date: string,
  itemId: string,
  variant: string | null | undefined
): string {
  const v = variant ? `/${encodeURIComponent(variant)}` : ''
  return `${datePath(date)}/lines/${encodeURIComponent(itemId)}${v}/correction`
}

export async function fetchBackzettelConfig(): Promise<BackzettelConfigResponse> {
  return unwrap(await apiClient.get<BackzettelConfigResponse>(`${BASE}/config`))
}

/**
 * Ein Tag: Entwurf (live gerechnet), freigegeben (eingefroren + Nachträge),
 * `no-config` (keine gültigen Stammdaten) oder `ruhetag`. Andere Fehler
 * (`invalid_date`, Netz, 401 nach gescheitertem Refresh) werfen.
 */
export async function fetchBackzettelDay(
  date: string
): Promise<BackzettelDayResult> {
  try {
    return unwrap(await apiClient.get<BackzettelDayResult>(datePath(date)))
  } catch (error) {
    // Nach Code, nicht `instanceof`: Specs ersetzen den ApiClient.
    const failed = error as { status?: number; code?: string; message?: string }
    if (failed && failed.status === 409 && failed.code === 'ruhetag') {
      return {
        date,
        status: 'ruhetag',
        weekday: null,
        message: failed.message || 'An diesem Tag ist Ruhetag.',
      }
    }
    throw error
  }
}

export async function fetchPrep(
  date: string
): Promise<PrepView | BackzettelNoConfig> {
  return unwrap(
    await apiClient.get<PrepView | BackzettelNoConfig>(`${datePath(date)}/prep`)
  )
}

/** Saisonfaktor (0 < f ≤ 5) - nur im Entwurf. */
export async function setSeasonFactor(
  date: string,
  factor: number | string
): Promise<BackzettelDay> {
  return unwrap(
    await apiClient.put<BackzettelDay>(`${datePath(date)}/season`, { factor })
  )
}

/** Korrektur einer Zeile; ≠ 0 braucht einen Grund, 0 löscht sie. Nur im Entwurf. */
export async function setCorrection(
  date: string,
  itemId: string,
  variant: string | null,
  correction: number,
  reason: string | null
): Promise<BackzettelDay> {
  return unwrap(
    await apiClient.put<BackzettelDay>(correctionPath(date, itemId, variant), {
      correction,
      reason: correction === 0 ? null : reason,
    })
  )
}

export async function confirmDay(date: string): Promise<BackzettelDay> {
  return unwrap(
    await apiClient.post<BackzettelDay>(`${datePath(date)}/confirm`, {})
  )
}

/** Nur Inhaber. */
export async function reopenDay(
  date: string,
  reason?: string
): Promise<BackzettelDay> {
  const body = reason && reason.trim() ? { reason: reason.trim() } : {}
  return unwrap(
    await apiClient.post<BackzettelDay>(`${datePath(date)}/reopen`, body)
  )
}

/** Abhaken (nur freigegebene Tage; Zeilen-ID, nicht `key`). */
export async function setLineDone(
  date: string,
  lineId: number,
  done: boolean
): Promise<LineDoneResult> {
  return unwrap(
    await apiClient.post<LineDoneResult>(
      `${datePath(date)}/lines/${lineId}/${done ? 'done' : 'undone'}`,
      {}
    )
  )
}

export async function acknowledgeDelta(
  date: string,
  deltaId: number
): Promise<BackzettelDeltaEntry> {
  return unwrap(
    await apiClient.post<BackzettelDeltaEntry>(
      `${datePath(date)}/deltas/${deltaId}/ack`,
      {}
    )
  )
}
