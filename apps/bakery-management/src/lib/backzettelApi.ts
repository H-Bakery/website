/**
 * Client der Backzettel-API (Z3, `docs/api/backzettel.md`). Geteilt von der
 * Tagesplanung (`/admin/backzettel`, Z5/Z7) und der Backstube-Ansicht
 * (`/backstube`, Z6).
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
  /**
   * W4-Verifikation: was das nach dem Aufrunden zusätzlich zu backen heißt
   * (Einheit der Zeile; +0,25 Kranz → 1 oder 0). Fehlt bei älteren Servern.
   */
  bake?: number
  /** Summe der noch nicht quittierten Nachträge (W4-Verifikation Runde 5). */
  openQty?: number
  /** Was die noch nicht quittierten zusätzlich zu backen heißen. */
  bakeOpen?: number
}

/** Hefeteig/Füllungen: was die Nachträge zusätzlich brauchen (nur Änderungen). */
export interface DeltaExtras {
  doughs: Array<{
    id: string
    name: string
    /** Zusätzliche Teigstücke; `totalPieces` = mit Nachträgen. */
    pieces: number
    totalPieces: number
    dough_g: number
    totalDough_g: number
    /** Chargen mit Nachträgen. */
    batches: number | null
    /** Chargen bei der Freigabe; ältere Server: fehlt. */
    batchesBefore?: number | null
    batch_max_kg?: number | null
    weighing: Array<{ piece_g: number; pieces: number; total: number }>
  }>
  fillings: Array<{
    id: string
    name: string
    grams: number
    totalGrams: number
    /** Rezept für die zusätzliche Menge; `null`, wenn nicht hochrechenbar. */
    recipe?: ScaledRecipe | null
  }>
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
  /** Füllung/Sorte; `null` = keine (bzw. „ohne Füllungsangabe“). */
  variant: string | null
  base: number
  /** `true`: Grundmenge noch nicht festgelegt (≠ 0 = wird nicht gebacken). */
  baseUnset: boolean
  /** Zuschlag durch den Saisonfaktor (aufgerundet − Basis). */
  seasonal: number
  preorders: number
  preordersExact?: number
  /** Basis × Saison + Vorbestellt + CAP vor dem Aufrunden (nur Entwurf). */
  subtotalExact?: number
  /**
   * `true`: Viertel aus mehreren Quellen wurden erst summiert, dann
   * aufgerundet - Saison/Vorbestellt/CAP stehen dann genau (z. B. 0,75).
   */
  quartersPooled?: boolean
  preorderIds?: number[]
  cap: number
  correction: number
  correctionReason: string | null
  correctionBy: BackzettelUserRef | null
  total: number
  /**
   * `true`: die Korrektur drückt die Zeile unter 0, `total` ist auf 0 gekappt
   * (nur Entwurf; dazu Warnung `correction_exceeds_line`).
   */
  correctionClamped?: boolean
  /** Blechangabe, z. B. „Blech 7-9“ (nur Anzeige). */
  tray: string | null
  plu: number[]
  /** Nur Liter-Posten mit `pieces_per_liter`. */
  loavesEstimate?: number
  doneAt: string | null
  doneBy: BackzettelUserRef | null
  /**
   * Nur freigegeben, nur offene Zeilen: der Haken, den eine erneute Freigabe
   * wegen geänderter Menge entfernt hat - `qty` war damals schon gebacken.
   */
  previouslyDone?: {
    qty: number
    at: string | null
    by: BackzettelUserRef | null
  } | null
  delta: BackzettelLineDelta | null
  // ---- Z10 (Backzettel v2), additiv; ältere Server und alte Tage: fehlen
  /** Backtag der Zeile; ≠ `date` des Zettels = Teig heute, gebacken später. */
  bakeDate?: string
  /** Teigtag (= Datum des Zettels, auf dem die Zeile steht). */
  doughDate?: string
  /** Teigtage vor dem Backtag (0 = am Backtag selbst). */
  lead?: number
  /** `size` = Laibgröße, `filling` = Füllung/Sorte, `null` = keine. */
  variantKind?: 'size' | 'filling' | null
  /** Anzeigename der Variante vom Server (Größe „500 g“, Füllungsname). */
  variantLabel?: string | null
  /** Nur Bruch-Posten (Brötchen aus der Teilmaschine). */
  bruch?: { group: string; perProduct: number }
  /** Nur Backliste: Status des Zettels, von dem die Zeile kommt. */
  sheetStatus?: 'draft' | 'confirmed'
  /** Nur Backliste: „Teig vom Samstag“ / „Teig von heute“. */
  madeOn?: string
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
  /** `null` (Z10): in den Stammdaten offen. */
  piecesPerProduct: number | null
  pieces: number | null
}

export interface HefeteigWeighing {
  /** `null` (Z10): Gramm je Teigstück offen. */
  piece_g: number | null
  pieces: number | null
  items: HefeteigWeighingItem[]
}

export interface HefeteigDough {
  id: string
  name: string
  batch_max_kg: number | null
  /** `null` (Z10): Teigstücke je Produkt in den Stammdaten offen. */
  pieces: number | null
  /** `null` (Z10): ein Teil des Teigs hat kein bekanntes Gewicht. */
  dough_g: number | null
  /** `null`, wenn die Chargengröße nicht festgelegt ist. */
  batches: number | null
  weighing: HefeteigWeighing[]
  // ---- Z10: nur Teigtag-Zettel
  kg?: number | null
  kgKnown?: number
  complete?: boolean
  missing?: MissingPart[]
  liters?: DoughLiters
}

export interface Hefeteig {
  doughs: HefeteigDough[]
  pieces: number | null
  dough_g: number | null
  complete?: boolean
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
  /** `null`: Rezept unvollständig, Chargengröße unbekannt. */
  batch_g: number | null
  grams: number
  /** `null`: nicht skaliert, weil eine Zutat keine Grammangabe hat. */
  factor: number | null
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
  /** Anzeigename der Variante aus der YAML (`variant_labels`), sonst `null`. */
  variantLabel?: string | null
  note?: string | null
  /** Kam erst durch einen Nachtrag dazu (W4-Verifikation Runde 6). */
  fromDelta?: boolean
}

export interface BackzettelWarning {
  code: string
  message: string
  [key: string]: unknown
}

export type BackzettelDeltaKind =
  | 'added'
  | 'changed'
  | 'cancelled'
  /** Zeile einer offenen Bestellung auf 0 (W4-Verifikation Runde 5). */
  | 'removed'
  /** Bestellung liegt jetzt an einem anderen Tag. */
  | 'moved'

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
  /** Die Bestellung liegt inzwischen an diesem Tag (ihr Code ist der neue). */
  preorderMovedTo?: string | null
  /** Wann der Server die Änderung bemerkt hat. */
  createdAt: string
  acknowledgedAt: string | null
  acknowledgedBy: BackzettelUserRef | null
  /** Z10: Backtag des Nachtrags (fehlt bei älteren Servern = Datum des Zettels). */
  bakeDate?: string
  /** Z10, nur Backliste: Zettel (Teigtag), auf dem der Nachtrag quittiert wird. */
  doughDate?: string
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
  /** Nur freigegebene Tage mit Nachträgen, die Teig oder Füllung ändern. */
  deltaExtras?: DeltaExtras | null
  /**
   * Nachträge je Zeilen-Schlüssel mit Backmenge (W4-Verifikation Runde 6) -
   * auch für Posten/Varianten ohne freigegebene Zeile, die `sections` nicht
   * enthält. Ältere Server: fehlt.
   */
  deltaTotals?: Record<string, BackzettelLineDelta>
  warnings: BackzettelWarning[]
  configStatus: 'ok' | 'no-config'
  /** Nur freigegeben: aktuelle Stammdaten ergäben jetzt etwas anderes. */
  configChangedSinceConfirm?: boolean | null
  /**
   * Nur freigegeben: Vorbestellungen haben sich geändert, die Deltas dazu
   * sind aber noch nicht erfasst (die API trägt sie gerade im Hintergrund
   * nach). `null` ohne gültige Stammdaten - dann weiß es niemand.
   */
  deltasPending?: boolean | null
  configReasons?: ConfigReason[]
  // ---- Z10 (Backzettel v2): Teigtag-Zettel. Fehlen an Tagen, die vor Z10
  // freigegeben wurden (`sheetVersion: 1`) - dann die alte Ansicht.
  /** 2 = Teigtag-Zettel mit Teigen/Maschine/Brot/Brötchen; 1 = alter Tag. */
  sheetVersion?: 1 | 2
  /** Wird an diesem Tag Teig gemacht (`dough_days`)? */
  isDoughDay?: boolean
  bakeDates?: SheetBakeDate[]
  plan?: BackzettelPlan
  doughs?: DoughSummary[]
  machine?: MachineBox[]
  bread?: BreadView
  rolls?: RollsBlock[]
  /** Stammdaten, die für diesen Zettel noch offen sind (null = unbekannt). */
  openMasterData?: OpenMasterData[]
  /** Nur freigegeben (v2): Maschinen-Kästen, die Nachträge verändern. */
  deltaMachine?: unknown[]
}

// ---------------------------------------------------------------- Z10 (v2)

/** Liter eines Teigs (§3): `null` + Grund, nie geschätzt. */
export interface DoughLiters {
  exact: number | null
  rounded: number | null
  /** `kg_per_liter_unknown` | `dough_incomplete` | `rounding_unknown` | null */
  reason: string | null
}

/** Ein Teil eines Teigs ohne bekanntes Gewicht. */
export interface MissingPart {
  itemId: string | null
  name: string
  field?: string
  code: string
  message: string
}

export interface DoughAddon {
  id: string
  name: string
  doughId: string
  g_per_liter: number | null
  grams: { exact: number; rounded: number | null } | null
  /** `g_per_liter_unknown` | `liters_unknown` | `rounding_unknown` | null */
  reason: string | null
}

export interface DoughSummary {
  /** `null` = „Teig offen“ (Posten ohne Teig-ID). */
  id: string | null
  name: string
  kg: number | null
  kgKnown: number
  complete: boolean
  missing: MissingPart[]
  liters: DoughLiters
  batches: number | null
  batch_max_kg: number | null
  addons: DoughAddon[]
  parts: {
    kind: 'sizes' | 'bruch' | 'pieces' | 'from_dough' | string
    itemId: string
    name: string
    bakeDate: string
    kg: number | null
  }[]
  extras: { name: string; kg: number | null; itemId: string }[]
  combinedWith: string | null
}

/** Ein Kasten an der Knetmaschine: ein Teig oder eine gemeinsame Gruppe. */
export interface MachineBox {
  id: string | null
  name: string
  doughIds: (string | null)[]
  kg: number | null
  kgKnown: number
  complete: boolean
  liters: DoughLiters
  batches: number | null
  batch_max_kg: number | null
  addons: DoughAddon[]
  /** Gemeinsamer Abschnitt der Teile (`hefeteig` → „Wasser … L“). */
  section?: string | null
}

export interface BreadCell {
  key: string
  variant: string | null
  total: number
  baseUnset: boolean
}

export interface BreadRow {
  itemId: string
  name: string
  bakeDate: string
  doughId: string | null
  unit: BackzettelUnit
  /** Je Größe der Tabelle; `null` = Posten hat diese Größe nicht. */
  cells: Record<string, BreadCell | null>
  /** Alte Liter-Posten (und Zeilen ohne Größe): eine Zelle. */
  single: (BreadCell & { unit: BackzettelUnit }) | null
  kg: number | null
  kgKnown?: number
  complete: boolean
  /** Gemeinsamer Teig, Anteil aus anderem Teig (vom Server formuliert). */
  note: string | null
}

export interface BreadView {
  sizes: { id: string; label: string }[]
  rows: BreadRow[]
}

export interface BruchSplit {
  key: string
  itemId: string
  name: string
  variant: string | null
  total: number
  perProduct: number
  doughPieces: number
}

export interface BruchGroup {
  key: string
  group: string
  name: string
  doughId: string | null
  bakeDate: string
  g: number | null
  piecesPerBruch: number | null
  pieces: number
  brueche: number | null
  kg: number | null
  /** Freie Stücke durch das Aufrunden (nur Anzeige, nie in den Zeilen). */
  spare: number | null
  split: BruchSplit[]
  complete: boolean
  missing: MissingPart[]
}

export interface SingleRow {
  key: string
  itemId: string
  name: string
  variant: string | null
  total: number
  baseUnset: boolean
  piece_g: number | null
  pieces: number | null
  kg: number | null
}

export interface RollsBlock {
  bakeDate: string
  /** „heute“ | „für Sonntag“ */
  label: string
  groups: BruchGroup[]
  singles: SingleRow[]
}

export interface SheetBakeDate {
  date: string
  weekday: number
  weekdayName: string
  label: string
  lineCount: number
}

export interface BackzettelPlan {
  version: number
  doughDate: string
  bakeDates: { date: string; itemIds: string[] | null }[]
}

export interface OpenMasterData {
  path: string
  code: string
  message: string
}

/** Quelle einer Backliste: ein Teigtag-Zettel. */
export interface BakeListSource {
  doughDate: string
  weekday?: number
  weekdayName?: string
  status: 'draft' | 'confirmed'
  confirmedAt: string | null
  lineCount?: number
}

/** `GET /api/backzettel/:datum/bake-list` - was am Backtag gebacken wird. */
export interface BakeList {
  date: string
  weekday: number | null
  weekdayName: string | null
  status: 'ok' | 'no-config' | 'ruhetag'
  message?: string
  reasons?: ConfigReason[]
  sources: BakeListSource[]
  sections: BackzettelSection[]
  rolls: RollsBlock[]
  deltas: BackzettelDeltaEntry[]
  deltasPending: boolean | null
  warnings: BackzettelWarning[]
}

/** Ein Teigtag-Zettel (Z10) - nicht ein Tag, der vor Z10 freigegeben wurde. */
export function isDoughDaySheet(
  day: Pick<BackzettelDay, 'sheetVersion'> | null | undefined
): boolean {
  return !!day && day.sheetVersion === 2
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
  /** Z10: Laibgrößen (dann sind `variants` die Größen-IDs). */
  sizes?: { id: string; label: string; dough_g?: number | null }[]
  variantKind?: 'size' | 'filling' | null
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
  /** Z10: offene Stammdaten (`null` in der YAML). */
  open?: OpenMasterData[]
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

/**
 * Saisonfaktor (0 < f ≤ 5) - nur im Entwurf. `expectedFactor` ist der Wert,
 * den die Seite angezeigt hat: hat ein anderes Gerät inzwischen etwas anderes
 * gespeichert, antwortet die API 409 `season_changed` statt zu überschreiben.
 */
export async function setSeasonFactor(
  date: string,
  factor: number | string,
  expectedFactor?: number
): Promise<BackzettelDay> {
  return unwrap(
    await apiClient.put<BackzettelDay>(`${datePath(date)}/season`, {
      factor,
      ...(expectedFactor !== undefined ? { expectedFactor } : {}),
    })
  )
}

/**
 * Korrektur einer Zeile; ≠ 0 braucht einen Grund, 0 löscht sie. Nur im
 * Entwurf. `expected` ist der Stand, auf dem der Editor geöffnet wurde -
 * weicht der gespeicherte ab, 409 `correction_changed` (W4-verify r4).
 * `options.bakeDate` (Z10): Backtag der Zeile, wenn er nicht der Tag des
 * Zettels ist (Brötchen für Dienstag auf dem Samstags-Zettel); sonst 400
 * `invalid_bake_date` bzw. 409 `owned_elsewhere` mit deutscher Meldung.
 */
export async function setCorrection(
  date: string,
  itemId: string,
  variant: string | null,
  correction: number,
  reason: string | null,
  expected?: { correction: number; reason: string | null },
  options?: { bakeDate?: string | null }
): Promise<BackzettelDay> {
  return unwrap(
    await apiClient.put<BackzettelDay>(correctionPath(date, itemId, variant), {
      correction,
      reason: correction === 0 ? null : reason,
      ...(expected ? { expected } : {}),
      ...(options?.bakeDate ? { bakeDate: options.bakeDate } : {}),
    })
  )
}

/**
 * Backliste eines Backtags (Z10): alle Zeilen, die an `date` gebacken
 * werden - auch die, deren Teig an einem früheren Tag gemacht wurde.
 * Ruhetag und fehlende Stammdaten sind Zustände (`status`), kein Fehler.
 */
export async function fetchBakeList(date: string): Promise<BakeList> {
  return unwrap(await apiClient.get<BakeList>(`${datePath(date)}/bake-list`))
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

/**
 * Abhaken (nur freigegebene Tage; Zeilen-ID, nicht `key`). `expectedTotal`
 * ist die Menge, die das Gerät angezeigt hat: ist auf dem Server inzwischen
 * mehr zu backen, antwortet die API 409 `line_changed` (W4-verify r4).
 */
export async function setLineDone(
  date: string,
  lineId: number,
  done: boolean,
  expectedTotal?: number
): Promise<LineDoneResult> {
  return unwrap(
    await apiClient.post<LineDoneResult>(
      `${datePath(date)}/lines/${lineId}/${done ? 'done' : 'undone'}`,
      done && expectedTotal !== undefined ? { expectedTotal } : {}
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

/** Mehrere Nachträge auf einmal quittieren (alles oder nichts). */
export async function acknowledgeDeltas(
  date: string,
  deltaIds: number[]
): Promise<BackzettelDeltaEntry[]> {
  return unwrap(
    await apiClient.post<BackzettelDeltaEntry[]>(
      `${datePath(date)}/deltas/ack`,
      { ids: deltaIds }
    )
  )
}

/**
 * Solange ein freigegebener Tag `deltasPending: true` meldet, lädt die Seite
 * nach so vielen ms erneut (höchstens `DELTAS_PENDING_MAX_RELOADS`-mal),
 * statt bis zum nächsten 60-s-Lauf zu warten.
 */
export const DELTAS_PENDING_RELOAD_MS = 5000
export const DELTAS_PENDING_MAX_RELOADS = 6

/**
 * Nachträge je Zeilen-Schlüssel: aus `deltaTotals`, ergänzt um die Angaben
 * an den Zeilen (ältere Server). Auch Nachträge zu Posten, die bei der
 * Freigabe nicht gebacken wurden, bekommen so ihre Backmenge.
 */
export function deltaTotalsByKey(
  day: Pick<BackzettelDay, 'sections' | 'deltaTotals'>
): Record<string, BackzettelLineDelta | null | undefined> {
  return {
    ...(day.deltaTotals ?? {}),
    ...Object.fromEntries(
      day.sections.flatMap((section) =>
        section.lines
          .filter((l) => l.delta)
          .map((l) => [l.key, l.delta] as const)
      )
    ),
  }
}
