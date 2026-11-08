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
  /** Z10 O5: so viele Nachträge sind auf der Backliste „gebacken“ abgehakt. */
  baked?: number
  /** Summe der gebacken abgehakten Nachträge. */
  bakedQty?: number
  /** Was die noch nicht gebackenen zusätzlich zu backen heißen (aufgerundet). */
  bakeUnbaked?: number
}

/** Hefeteig/Füllungen: was die Nachträge zusätzlich brauchen (nur Änderungen). */
export interface DeltaExtras {
  doughs: Array<{
    id: string
    name: string
    /** Zusätzliche Teigstücke; `totalPieces` = mit Nachträgen. */
    pieces: number | null
    totalPieces: number | null
    /**
     * Z10: `false`, solange eine Grundmenge des Teigs offen ist - dann ist
     * `totalPieces` nur eine Mindestmenge („≥ 37“). Ältere Server: fehlt.
     */
    totalPiecesComplete?: boolean
    /** Zusatzteig in g; `null` = unbekannt (nie 0 für unbekannt). */
    dough_g: number | null
    /** Teig gesamt mit Nachträgen; `null` = unbekannt (Teig unvollständig). */
    totalDough_g: number | null
    /** Z10: der bekannte Teil von `totalDough_g` („≥ 16,5 kg“). */
    totalDoughKnown_g?: number | null
    /** Chargen mit Nachträgen. */
    batches: number | null
    /** Chargen bei der Freigabe; ältere Server: fehlt. */
    batchesBefore?: number | null
    batch_max_kg?: number | null
    weighing: Array<{
      piece_g: number | null
      pieces: number | null
      total: number | null
    }>
  }>
  fillings: Array<{
    id: string
    name: string
    grams: number
    totalGrams: number
    /** Z10: `false`, wenn `totalGrams` nur der bekannte Teil ist („≥ …“). */
    totalComplete?: boolean
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
   * Z10: `true`, solange die Grundmenge offen ist (ohne Korrektur): `total`
   * ist nur das Bekannte (Vorbestellt, CAP) - eine Mindestmenge („≥ 4“),
   * bei 0 „offen“. Anzeige über `minQtyText`, nie als fertige Zahl.
   */
  totalIsMinimum?: boolean
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
  /**
   * Z10, Inhaber-Entscheidung O5: „gebacken“ auf der Backliste - eigener
   * Haken, getrennt von `doneAt` (auf dem Zettel des Teigtags = gemacht).
   * Ältere Server: fehlt.
   */
  bakedAt?: string | null
  bakedBy?: BackzettelUserRef | null
  /** Wie `previouslyDone`, für den gebacken-Haken. */
  previouslyBaked?: {
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
  /** Z10: Grundmenge offen - `products` ist nur der bekannte Teil („≥ …“). */
  isMinimum?: boolean
}

export interface HefeteigWeighing {
  /** `null` (Z10): Gramm je Teigstück offen. */
  piece_g: number | null
  pieces: number | null
  items: HefeteigWeighingItem[]
  /** Z10: ein Posten dieser Stufe hat eine offene Grundmenge („≥ …“). */
  isMinimum?: boolean
}

export interface HefeteigDough {
  id: string
  name: string
  batch_max_kg: number | null
  /** `null` (Z10): Teigstücke je Produkt in den Stammdaten offen. */
  pieces: number | null
  /** `null` (Z10): ein Teil des Teigs hat kein bekanntes Gewicht. */
  dough_g: number | null
  /** `null`, wenn die Chargengröße offen ist. */
  batches: number | null
  weighing: HefeteigWeighing[]
  // ---- Z10: nur Teigtag-Zettel
  kg?: number | null
  kgKnown?: number
  complete?: boolean
  missing?: MissingPart[]
  liters?: DoughLiters
  /** `false`: eine Grundmenge des Teigs ist offen - Teigstücke sind „mindestens“. */
  piecesComplete?: boolean
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
  /**
   * Z10: ein gefüllter Posten hat keine Grundmenge - `grams` ist nur der
   * bekannte Teil (auch 0), `openItems` nennt die Posten. Fehlt sonst.
   */
  baseUnset?: boolean
  openItems?: string[]
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
  /** Z10 O5: der Nachtrag ist gebacken (eigener Haken). Ältere Server: fehlt. */
  bakedAt?: string | null
  bakedBy?: BackzettelUserRef | null
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
  deltaMachine?: DeltaMachineBox[]
  /** Nur freigegeben (v2): Bruch-Gruppen, deren Teigstücke Nachträge ändern. */
  deltaBruch?: DeltaBruchGroup[]
}

/** Was Nachträge für einen Maschinen-Kasten heißen (Server, `machineDeltaExtras`). */
export interface DeltaMachineBox {
  id: string
  name: string
  doughIds: string[]
  kgBefore: number | null
  kg: number | null
  kgDelta: number
  complete: boolean
  litersBefore: DoughLiters
  liters: DoughLiters
  batchesBefore: number | null
  batches: number | null
}

/** Was Nachträge für eine Bruch-Gruppe heißen (Server, `bruchDeltaExtras`). */
export interface DeltaBruchGroup {
  key: string
  group: string
  name: string
  bakeDate: string
  piecesBefore: number | null
  pieces: number | null
  piecesDelta: number
  bruecheBefore: number | null
  brueche: number | null
  /** `null`, wenn Stück je Bruch oder eine Grundmenge offen ist. */
  bruecheDelta: number | null
  spareBefore: number | null
  spare: number | null
  spareProductsBefore: number | null
  spareProducts: number | null
  complete: boolean
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
    /** from_dough: Anteil am Teig `from_dough.id`. */
    kg: number | null
    /** Nur from_dough: Laibe × Teig je Laib (Teig der Brot-Zeile). */
    loavesKg?: number | null
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
  /** Grundmenge offen: `total` ist eine Mindestmenge (siehe Zeile). */
  totalIsMinimum?: boolean
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
  /** Bekannte Stück; mit `totalIsMinimum` nur eine Mindestmenge (Grundmenge offen). */
  total: number | null
  perProduct: number
  doughPieces: number | null
  totalIsMinimum?: boolean
}

export interface BruchGroup {
  key: string
  group: string
  name: string
  doughId: string | null
  bakeDate: string
  g: number | null
  piecesPerBruch: number | null
  /** `null`, solange eine Grundmenge der Gruppe offen ist. */
  pieces: number | null
  brueche: number | null
  kg: number | null
  /** Freie Teigstücke durch das Aufrunden (nur Anzeige, nie in den Zeilen). */
  spare: number | null
  /** Dieselben freien Stücke in Produkten („+n frei“); `null` bei gemischten Teigstücken je Produkt. */
  spareProducts?: number | null
  /** Teigstücke je Produkt, wenn alle Mitglieder gleich sind. */
  perProduct?: number | null
  /** Nur die bekannten Mitglieder („≥ n Bruch“, „Teig: ≥ x kg“). */
  piecesKnown?: number
  bruecheKnown?: number | null
  kgKnown?: number | null
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
  totalIsMinimum?: boolean
  piece_g: number | null
  pieces: number | null
  kg: number | null
  /** Z10: kg des bekannten Teils (Grundmenge offen: „Teig: ≥ …“); ältere Server: fehlt. */
  kgKnown?: number | null
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

/** Antwort auf `POST /:backtag/bake/:lineId/baked|unbaked` (Z10 O5). */
export interface LineBakedResult {
  id: number
  /** Zettel (Teigtag) der Zeile. */
  date: string
  bakeDate: string
  itemId: string
  variant: string | null
  bakedAt: string | null
  bakedBy: BackzettelUserRef | null
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

/**
 * Z10, O5: „gebacken“ auf der Backliste des Backtags `bakeDate` (nicht des
 * Teigtags!). Nur Zeilen eines freigegebenen Zettels; `expectedTotal` wie
 * beim Abhaken (409 `line_changed`, wenn jetzt mehr zu backen ist).
 */
export async function setLineBaked(
  bakeDate: string,
  lineId: number,
  baked: boolean,
  expectedTotal?: number
): Promise<LineBakedResult> {
  return unwrap(
    await apiClient.post<LineBakedResult>(
      `${datePath(bakeDate)}/bake/${lineId}/${baked ? 'baked' : 'unbaked'}`,
      baked && expectedTotal !== undefined ? { expectedTotal } : {}
    )
  )
}

/**
 * Z10, O5: Nachträge auf der Backliste „gebacken“ (alles oder nichts).
 * Gebacken quittiert einen offenen Nachtrag gleich mit.
 */
export async function setDeltasBaked(
  bakeDate: string,
  deltaIds: number[],
  baked: boolean
): Promise<BackzettelDeltaEntry[]> {
  return unwrap(
    await apiClient.post<BackzettelDeltaEntry[]>(
      `${datePath(bakeDate)}/bake/deltas/${baked ? 'baked' : 'unbaked'}`,
      { ids: deltaIds }
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
