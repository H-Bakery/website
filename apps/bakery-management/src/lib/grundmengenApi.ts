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
  /**
   * Z14: Spalten für den Tag vor Schließtagen (`base.vor_feiertag` /
   * `base.samstag_ersatz`). Ein fehlender Schlüssel heißt hier **nicht
   * gesetzt** (der Zettel nimmt die Wochentags-Menge), nicht 0.
   */
  baseSpecial?: Record<string, BaseDayValue>
  /** Z10: Laibgrößen - dann sind `variants` die Größen-IDs. */
  sizes?: {
    id: string
    label: string
    dough_g?: number | null
    /** Kassennummern der Größe (Median je Größe); `null` = unbekannt. */
    plu?: number[] | null
  }[]
  variantKind?: 'size' | 'filling' | null
  /**
   * Z10: Bruch-Posten (Brötchen aus der Teilmaschine). Grundmenge in Stück
   * am **Backtag**; `piecesPerBruch` `null` = Stück je Bruch noch offen.
   */
  bruch?: {
    per_product?: number
    group?: string
    piecesPerBruch: number | null
  } | null
  /** Z10: Teigtage vor dem Backtag je Wochentag (`default` + Ausnahmen). */
  lead?: Record<string, number>
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
  /** Z10: offene Stammdaten (`null` in der YAML), nur zur Information. */
  open?: OpenMasterDataEntry[]
}

/** Eine offene Angabe der Stammdaten (`null` = unbekannt, Z10). */
export interface OpenMasterDataEntry {
  path: string
  code: string
  message: string
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
  /** Z10: offene Stammdaten des freigegebenen Stands. */
  open?: OpenMasterDataEntry[]
}

export interface SaveResult extends BackzettelConfigView {
  pending: boolean
  changed: boolean
}

export interface ReferenceItem {
  itemId: string
  /** Gesetzt, wenn die Referenz eine Laibgröße ist (`cellReference`). */
  sizeId?: string
  plu: number[]
  median: number | null
  samples: number[]
  /**
   * `unknown` nur bei einer Laibgröße ohne eigene Kassennummer
   * (`sizes[].plu` offen): der Median der Größe ist unbekannt.
   */
  status: 'ok' | 'no_plu' | 'no_data' | 'unknown'
  /**
   * W4-Verifikation Runde 6: `true` = mit dem Faktor des Backzettels in die
   * Einheit des Postens umgerechnet (Stück Kuchen → Kuchen, 500-g-Laib →
   * 0,5 l); sonst Stück laut Kasse. Ältere Server: fehlt.
   */
  converted?: boolean
  /**
   * M4: mittlerer Rest am Abend in der Einheit des Postens (letzte gleiche
   * Wochentage mit vollständiger Zählung, `GET /api/rest/averages`) - nur
   * Information. Setzt der Client dazu, der Server der Referenz kennt es nicht.
   */
  restMean?: number | null
  restDays?: number
  /**
   * Z10 (docs/backzettel-v2.md §9 Punkt 10): Median je Laibgröße, nur bei
   * Posten mit `sizes`. Ältere Server: fehlt.
   */
  sizes?: ReferenceSize[]
}

/** Median einer Laibgröße (über `sizes[].plu`). */
export interface ReferenceSize {
  sizeId: string
  plu: number[]
  median: number | null
  samples: number[]
  status: 'ok' | 'no_data' | 'unknown'
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

/** Z14: die Sonderspalten neben den Wochentagen (wie `SPECIAL_BASE_KEYS`). */
export type SpecialColumn = 'vor_feiertag' | 'samstag_ersatz'

export const SPECIAL_COLUMNS: {
  key: SpecialColumn
  short: string
  long: string
  hint: string
}[] = [
  {
    key: 'vor_feiertag',
    short: 'Vor FT',
    long: 'Vor Feiertag',
    hint: 'Teigtag direkt vor einem Feiertag/Schließtag. Leer = wie der Wochentag.',
  },
  {
    key: 'samstag_ersatz',
    short: 'Sa-Satz',
    long: 'Samstags-Satz',
    hint: 'Teigtag vor einem geschlossenen Samstag, wenn danach noch ein Backtag kommt. Leer = wie der Wochentag.',
  },
]

/** Wochentag 1…7 oder Sonderspalte (Z14). */
export type BaseColumn = number | SpecialColumn

export type BaseEdit =
  | { itemId: string; weekday: BaseColumn; value: number | null }
  | {
      itemId: string
      weekday: BaseColumn
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
  item: Pick<GrundmengenItem, 'base' | 'baseSpecial'>,
  weekday: BaseColumn,
  variant: string | null
): number | null | undefined {
  const map = typeof weekday === 'number' ? item.base : item.baseSpecial
  const day = map ? map[String(weekday)] : undefined
  if (variant === null) {
    return isRecord(day) ? undefined : day
  }
  if (day === null) return null
  if (isRecord(day)) return day[variant]
  return undefined
}

/** Steht am Tag eine Zuordnung je Sorte? */
export function isPerVariant(
  item: Pick<GrundmengenItem, 'base' | 'baseSpecial'>,
  weekday: BaseColumn
): boolean {
  const map = typeof weekday === 'number' ? item.base : item.baseSpecial
  return isRecord(map ? map[String(weekday)] : undefined)
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

/**
 * Rest Ø (M4) an die Referenz hängen. Ohne Zählung bleibt die Referenz, wie
 * sie ist; ein Posten ohne Referenzeintrag bekommt keinen.
 */
export function withRestAverages(
  reference: ReferenceResponse | null,
  averages: {
    status: string
    weekdays: {
      weekday: number
      items: { itemId: string; mean: number; dates: string[] }[]
    }[]
  } | null
): ReferenceResponse | null {
  if (!reference || reference.status !== 'ok') return reference
  if (
    !averages ||
    averages.status !== 'ok' ||
    !Array.isArray(averages.weekdays)
  ) {
    return reference
  }
  return {
    ...reference,
    weekdays: reference.weekdays.map((w) => {
      const rest = averages.weekdays.find((a) => a && a.weekday === w.weekday)
      if (!rest || !Array.isArray(rest.items) || rest.items.length === 0) {
        return w
      }
      return {
        ...w,
        items: w.items.map((item) => {
          const avg = rest.items.find((r) => r && r.itemId === item.itemId)
          return avg && typeof avg.mean === 'number'
            ? {
                ...item,
                restMean: avg.mean,
                restDays: Array.isArray(avg.dates) ? avg.dates.length : 0,
              }
            : item
        }),
      }
    }),
  }
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

/**
 * Referenz einer Zeile der Grundmengen: die Postenzeile (`variant` null) den
 * Median des Postens, eine Laibgrößen-Zeile (Z10) den Median der Größe -
 * aber nur, wenn der Posten selbst Kassennummern hat (sonst steht auch an
 * der Postenzeile nichts). Füllungs-Zeilen: keine Referenz.
 */
export function cellReference(
  reference: ReferenceResponse | null,
  weekday: number,
  item: Pick<GrundmengenItem, 'id' | 'variantKind'>,
  variant: string | null
): ReferenceItem | null {
  const ref = referenceFor(reference, weekday, item.id)
  if (variant === null) return ref
  if (item.variantKind !== 'size' || !ref || ref.status === 'no_plu') {
    return null
  }
  const size = ref.sizes?.find((sz) => sz.sizeId === variant)
  return size ? { itemId: item.id, ...size } : null
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

/**
 * Anzeigename einer Sorte: Laibgröße des Postens („500 g“, Z10), sonst
 * Füllung - sonst die ID.
 */
export function variantLabel(
  config: GrundmengenConfig,
  variant: string,
  item?: Pick<GrundmengenItem, 'sizes'> | null
): string {
  const size = item?.sizes?.find((sz) => sz.id === variant)
  if (size?.label) return size.label
  const filling = (config.fillings ?? []).find((f) => f.id === variant)
  return filling?.name ?? variant
}

/** Posten aus der Teilmaschine (Brötchen in Bruch, Z10)? */
export function isBruchItem(item: Pick<GrundmengenItem, 'bruch'>): boolean {
  return !!item.bruch
}

/**
 * Grauer Hinweis neben einer Bruch-Grundmenge (Z10): wie viele Brüche das
 * ungefähr sind - Stück × Teigstücke je Brötchen ÷ Stück je Bruch, eine
 * Nachkommastelle. Reine Anzeige der Stammdaten; gerechnet wird der Zettel
 * auf dem Server (dort je Gruppe und aufgerundet). `null`, wenn die Menge
 * offen ist oder die Stück je Bruch unbekannt sind - dann kein Hinweis.
 */
export function bruchHint(
  value: number | null | undefined,
  item: Pick<GrundmengenItem, 'bruch'>
): number | null {
  const per = item.bruch?.piecesPerBruch
  if (typeof value !== 'number' || !per || per <= 0) return null
  const perProduct = item.bruch?.per_product ?? 1
  return Math.round(((value * perProduct) / per) * 10) / 10
}

/** Hat ein Posten an irgendeinem Wochentag einen Vorlauf (Teig am Vortag)? */
export function hasLead(item: Pick<GrundmengenItem, 'lead'>): boolean {
  return Object.values(item.lead ?? {}).some(
    (n) => typeof n === 'number' && n > 0
  )
}
