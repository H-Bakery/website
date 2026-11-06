/**
 * Client der Grundmengen (Z4, `/admin/backzettel/grundmengen`) - bewusst
 * getrennt von `backzettelApi.ts` (Tagesplanung, Z5).
 *
 *   GET /api/backzettel/config           Stammdaten: freigegeben (`config`),
 *                                        Arbeitsstand (`working`),
 *                                        `pendingApproval`, `writable`
 *   PUT /api/backzettel/config/base      eine Grundmenge → hq (rollende PR)
 *   GET /api/backzettel/reference        Median verkauft je Posten/Wochentag
 *
 * Fehler kommen als `ApiError` (Status, `code`, deutsche `message`) beim
 * Aufrufer an. Gerechnet wird hier nichts; die Hilfsfunktionen unten lesen
 * nur Werte aus der Config für die Tabelle.
 */

import { apiClient } from '@bakery/shared/data-access'

const BASE = '/api/backzettel'

/** Wert eines Wochentags: Zahl, `null` (offen) oder je Sorte. */
export type BaseDayValue = number | null | Record<string, number | null>

export interface ConfigReason {
  path: string
  message: string
}

export interface GrundmengenItem {
  id: string
  name: string
  section: string
  unit: string
  variants: string[]
  plu: number[]
  /** ISO-Wochentag → Wert; ein fehlender Tag heißt 0. */
  base: Record<string, BaseDayValue>
}

export interface GrundmengenConfig {
  days: number[]
  sections: string[]
  items: GrundmengenItem[]
  fillings?: { id: string; name: string }[]
}

export interface WorkingConfig {
  status: 'ok' | 'no-config'
  /**
   * Auch bei `no-config` gesetzt, solange die YAML lesbar ist (dann mit
   * `errors`) - fremde Fehler sperren das Pflegen der Grundmengen nicht.
   */
  config: GrundmengenConfig | null
  errors: ConfigReason[]
  warnings: ConfigReason[]
}

export interface BackzettelConfigView {
  /** Freigegebener Stand (damit rechnet der Backzettel). */
  status: 'ok' | 'no-config'
  config: GrundmengenConfig | null
  errors: ConfigReason[]
  warnings: ConfigReason[]
  /** Die YAML im hq-Schreibverzeichnis wartet auf Freigabe (PR offen). */
  pendingApproval: boolean
  /** Ob der Server speichern kann (Schreib-Worktree da und auf `app/edits`). */
  writable: boolean
  /** Warum nicht: `error` wie die 503 beim Speichern, `message` deutsch. */
  writeIssue?: { error: string; message: string } | null
  /** Stand, auf dem ein Speichern aufbaut (inkl. wartender Änderungen). */
  working: WorkingConfig
}

export interface SaveResult extends BackzettelConfigView {
  pending: boolean
  changed: boolean
}

export interface ReferenceItem {
  itemId: string
  plu: number[]
  median: number | null
  samples: number[]
  status: 'ok' | 'no_plu' | 'no_data'
  /**
   * W4-Verifikation Runde 6: `true` = mit dem Faktor des Backzettels in die
   * Einheit des Postens umgerechnet (Stück Kuchen → Kuchen, 500-g-Laib →
   * 0,5 l); sonst Stück laut Kasse. Ältere Server: fehlt.
   */
  converted?: boolean
}

export interface ReferenceWeekday {
  weekday: number
  weekdayName: string
  weeks: number
  dates: string[]
  skippedDates: string[]
  items: ReferenceItem[]
}

export interface ReferenceResponse {
  status: 'ok' | 'no-config'
  available: boolean
  today?: string
  weeks?: number
  weekdays: ReferenceWeekday[]
}

export type BaseEdit =
  | { itemId: string; weekday: number; value: number | null }
  | {
      itemId: string
      weekday: number
      variants: Record<string, number | null>
    }

function unwrap<T>(res: { data?: T } | undefined): T {
  if (!res || res.data === undefined) {
    throw new Error('Leere Antwort vom Server.')
  }
  return res.data
}

export async function fetchBackzettelConfig(): Promise<BackzettelConfigView> {
  return unwrap(await apiClient.get<BackzettelConfigView>(`${BASE}/config`))
}

export async function saveGrundmenge(edit: BaseEdit): Promise<SaveResult> {
  return unwrap(await apiClient.put<SaveResult>(`${BASE}/config/base`, edit))
}

export async function fetchReference(weeks = 6): Promise<ReferenceResponse> {
  return unwrap(
    await apiClient.get<ReferenceResponse>(`${BASE}/reference`, { weeks })
  )
}

// ---------------------------------------------------------------- Helfer

export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
}

export const WEEKDAY_LONG: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

export const SECTION_LABELS: Record<string, string> = {
  vorbereitung: 'Vorbereitung',
  brot: 'Brot',
  broetchen: 'Brötchen',
  laugen: 'Laugen',
  kaffeestueckchen: 'Kaffeestückchen',
  kuchen: 'Kuchen',
  hefeteig: 'Hefeteig',
}

function isRecord(value: unknown): value is Record<string, number | null> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Menge einer Zelle: `variant` `null` = die Zeile des Postens (ganzer Tag),
 * sonst die Sorte. `undefined` = kein Eintrag (zählt als 0), `null` = offen.
 * Steht am Tag eine Gesamtzahl, haben die Sorten-Zeilen keinen eigenen Wert.
 */
export function cellValue(
  item: Pick<GrundmengenItem, 'base'>,
  weekday: number,
  variant: string | null
): number | null | undefined {
  const day = item.base ? item.base[String(weekday)] : undefined
  if (variant === null) {
    return isRecord(day) ? undefined : day
  }
  if (day === null) return null
  if (isRecord(day)) return day[variant]
  return undefined
}

/** Steht am Tag eine Zuordnung je Sorte? */
export function isPerVariant(
  item: Pick<GrundmengenItem, 'base'>,
  weekday: number
): boolean {
  return isRecord(item.base ? item.base[String(weekday)] : undefined)
}

/** Text im Eingabefeld: kein Eintrag = „0“, offen = leer. */
export function displayValue(value: number | null | undefined): string {
  if (value === null) return ''
  if (value === undefined) return '0'
  return String(value).replace('.', ',')
}

/**
 * Eingabe lesen: leer = `null` (offen), sonst Zahl ≥ 0 mit Komma oder Punkt.
 * `NaN` heißt ungültig.
 */
export function parseInput(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN
  return Number(t)
}

/**
 * Warum eine Eingabe nicht gilt - als Satz für die Meldung (W4-Verifikation
 * Runde 3: „-5“ ist eine Zahl, nur keine erlaubte Menge).
 */
export function inputProblem(text: string): string {
  const t = text.trim().replace(',', '.')
  if (/^[-−–]\s*\d+(\.\d+)?$/.test(t)) {
    return 'Keine negativen Mengen - 0 heißt „wird nicht gebacken“, leer lassen heißt „offen“.'
  }
  return 'Bitte eine Zahl eingeben (z. B. 12 oder 2,5) - leer lassen heißt „offen“.'
}

/** Fehlermeldung mit Feldnamen davor - aber nicht doppelt, wenn der Server ihn schon nennt. */
export function labelledMessage(label: string, message: string): string {
  return message.startsWith(`${label}:`) ? message : `${label}: ${message}`
}

/** Referenz eines Postens an einem Wochentag. */
export function referenceFor(
  reference: ReferenceResponse | null,
  weekday: number,
  itemId: string
): ReferenceItem | null {
  if (!reference || reference.status !== 'ok') return null
  const day = reference.weekdays.find((w) => w.weekday === weekday)
  return day ? day.items.find((i) => i.itemId === itemId) ?? null : null
}

/** Posten nach Abschnitt, in der Reihenfolge von `sections`. */
export function groupBySection(
  config: GrundmengenConfig
): { id: string; label: string; items: GrundmengenItem[] }[] {
  const order = [
    ...config.sections,
    ...config.items
      .map((i) => i.section)
      .filter(
        (s, i, all) => !config.sections.includes(s) && all.indexOf(s) === i
      ),
  ]
  return order
    .map((id) => ({
      id,
      label: SECTION_LABELS[id] ?? id,
      items: config.items.filter((i) => i.section === id),
    }))
    .filter((s) => s.items.length > 0)
}

/** Anzeigename einer Sorte (Füllung) - sonst die ID. */
export function variantLabel(
  config: GrundmengenConfig,
  variant: string
): string {
  const filling = (config.fillings ?? []).find((f) => f.id === variant)
  return filling?.name ?? variant
}
