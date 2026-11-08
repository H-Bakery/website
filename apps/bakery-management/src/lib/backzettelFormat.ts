/**
 * Anzeige-Helfer des Backzettels (Z5/Z6/Z7): Kalendertage, Zahlen, Einheiten,
 * Beschriftungen. Reine Funktionen ohne API - die Mengen selbst rechnet nur
 * der Server (`backzettel.core.js`); hier wird nichts gerechnet, was auf dem
 * Zettel steht.
 */

import type {
  BackzettelConfigData,
  BackzettelDay,
  BackzettelDeltaEntry,
  BackzettelLine,
  BackzettelLineDelta,
  BackzettelUnit,
  BruchGroup,
  DeltaExtras,
  DoughAddon,
  DoughLiters,
  FillingNeed,
  MachineBox,
  ScaledIngredient,
  ScaledRecipe,
} from './backzettelApi'

/** ISO-Wochentage, an denen gebacken wird, solange keine Stammdaten da sind (Di–So). */
export const DEFAULT_PRODUCTION_DAYS: readonly number[] = [2, 3, 4, 5, 6, 7]

export const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
}

export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Kalendarisch gültiges `JJJJ-MM-TT` (kein 30. Februar). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Heute in Ortszeit des Geräts als `JJJJ-MM-TT`. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )}`
}

/** ISO-Wochentag, 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: string): number {
  const day = toUtc(date).getUTCDay()
  return day === 0 ? 7 : day
}

function productionDays(days?: readonly number[] | null): readonly number[] {
  return days && days.length > 0 ? days : DEFAULT_PRODUCTION_DAYS
}

/**
 * Produktionstage von heute an über `horizon` Kalendertage (heute
 * eingeschlossen) - die Übersicht zeigt die kommende Woche.
 */
export function upcomingProductionDays(
  today: string,
  days?: readonly number[] | null,
  horizon = 7
): string[] {
  const allowed = productionDays(days)
  const out: string[] = []
  for (let i = 0; i < horizon; i += 1) {
    const date = addDays(today, i)
    if (allowed.includes(isoWeekday(date))) out.push(date)
  }
  return out
}

/**
 * Der nächste Tag, den man planen und freigeben will: der erste
 * Produktionstag **nach** heute. Heute wird schon gebacken (ab 2 Uhr).
 */
export function nextProductionDay(
  today: string,
  days?: readonly number[] | null
): string {
  const allowed = productionDays(days)
  for (let i = 1; i <= 14; i += 1) {
    const date = addDays(today, i)
    if (allowed.includes(isoWeekday(date))) return date
  }
  return addDays(today, 1)
}

/** Nächster/voriger Produktionstag neben `date` (für Vor/Zurück). */
export function neighbourProductionDay(
  date: string,
  direction: 1 | -1,
  days?: readonly number[] | null
): string {
  const allowed = productionDays(days)
  for (let i = 1; i <= 14; i += 1) {
    const candidate = addDays(date, i * direction)
    if (allowed.includes(isoWeekday(candidate))) return candidate
  }
  return addDays(date, direction)
}

/** „28.11.2026“ */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

/** „Samstag, 28.11.2026“ */
export function formatDateLong(date: string): string {
  return `${WEEKDAY_NAMES[isoWeekday(date)]}, ${formatDate(date)}`
}

/** „Sa 28.11.“ */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${WEEKDAY_SHORT[isoWeekday(date)]} ${d}.${m}.`
}

/** Uhrzeit + Datum eines Zeitstempels in Ortszeit, „27.11. 14:05“. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** Zahl deutsch, höchstens zwei Nachkommastellen („1,24“). */
export function formatNumber(n: number): string {
  return NUMBER.format(n)
}

const UNIT_SUFFIX: Record<string, string> = {
  Liter: 'l',
  kg: 'kg',
  Blech: 'Bl.',
}

/** Menge mit Einheit; Stück ohne Zusatz („40“, „4,5 l“, „3 Bl.“). */
export function formatQty(n: number, unit: BackzettelUnit | null): string {
  const suffix = unit ? UNIT_SUFFIX[unit] : undefined
  return suffix ? `${formatNumber(n)} ${suffix}` : formatNumber(n)
}

/**
 * Eine erneute Freigabe hat die Menge einer schon abgehakten Zeile geändert
 * (W4-Verifikation Runde 2): „bereits 30 erledigt (06.11. 05:10 · Bernd) -
 * noch +10". `null`, wenn die Zeile keinen entfernten Haken hat oder wieder
 * abgehakt ist.
 */
export function previouslyDoneText(line: BackzettelLine): string | null {
  const prev = line.previouslyDone
  if (!prev || line.doneAt) return null
  const who = [formatTimestamp(prev.at), prev.by?.displayName]
    .filter(Boolean)
    .join(' · ')
  const rest = Math.round((line.total - prev.qty) * 100) / 100
  const tail =
    rest > 0
      ? `noch ${formatSignedQty(rest, line.unit)}`
      : rest < 0
      ? `jetzt ${formatQty(-rest, line.unit)} weniger nötig`
      : 'Menge unverändert'
  return `bereits ${formatQty(prev.qty, line.unit)} erledigt${
    who ? ` (${who})` : ''
  } - ${tail}`
}

/** Zu- und Abschläge: „+2“, „−1“, „–“ für 0. */
export function formatSigned(n: number): string {
  if (!n) return '–'
  return n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(Math.abs(n))}`
}

/** Zu- und Abschläge mit Einheit: „+1 l“, „−2“, „+0,5 kg“; „–“ für 0. */
export function formatSignedQty(
  n: number,
  unit: BackzettelUnit | null
): string {
  if (!n) return '–'
  return `${n > 0 ? '+' : '−'}${formatQty(Math.abs(n), unit)}`
}

/**
 * Text des Nachtrag-Abzeichens einer Zeile (W4-Verifikation): mit Einheit
 * („Nachtrag +1 l“) und - wenn das Aufrunden etwas anderes ergibt als der
 * Nachtrag selbst (Viertel) - was zusätzlich zu backen ist
 * („Nachtrag +0,25 · 1 mehr backen“, „… · nichts mehr backen“).
 */
export function deltaBadgeText(
  delta: BackzettelLineDelta,
  unit: BackzettelUnit | null
): string {
  // W4-Verifikation Runde 3: Neu + Storno heben sich auf - statt eines
  // nackten „Nachtrag –“ sagen, dass nichts zu tun ist.
  if (!delta.qty && !delta.bake) return 'Nachtrag ±0 · nichts ändern'
  const base = `Nachtrag ${formatSignedQty(delta.qty, unit)}`
  const bake = delta.bake
  if (bake === undefined || bake === null || bake === delta.qty) return base
  if (bake === 0) {
    return `${base} · ${
      delta.qty > 0 ? 'nichts mehr backen' : 'nicht weniger backen'
    }`
  }
  return `${base} · ${formatQty(Math.abs(bake), unit)} ${
    bake > 0 ? 'mehr' : 'weniger'
  } backen`
}

/**
 * Was die Nachträge an Hefeteig und Füllung zusätzlich brauchen, je eine
 * Zeile Text (W4-Verifikation: die Abwiegeliste bleibt der freigegebene
 * Stand, die Nachträge kommen hier dazu).
 */
export function deltaExtrasLines(
  extras: DeltaExtras | null | undefined
): string[] {
  if (!extras) return []
  const out: string[] = []
  for (const d of extras.doughs) {
    // W4-Verifikation Runde 3: eine Abnahme liest sich als „weniger“ - ein
    // „−2 × 600 g abwiegen“ übersieht man aus 1,5 m leicht.
    const weighing = d.weighing
      .filter((w) => w.pieces)
      .map(
        (w) =>
          `${formatNumber(Math.abs(w.pieces))} × ${formatNumber(w.piece_g)} g ${
            w.pieces > 0 ? 'zusätzlich' : 'weniger'
          } abwiegen`
      )
      .join(', ')
    const dough = `${d.dough_g < 0 ? '−' : '+'}${formatGrams(
      Math.abs(d.dough_g)
    )} Teig`
    // Chargen (W4-Verifikation Runde 2): ändert sich ihre Zahl, steht es
    // da - und ist der Zusatzteig selbst größer als eine Charge, wie er sich
    // aufteilt.
    const max = d.batch_max_kg ?? null
    const batchNote =
      d.batches != null &&
      d.batchesBefore != null &&
      d.batches !== d.batchesBefore
        ? `; jetzt ${formatNumber(d.batches)} Chargen statt ${formatNumber(
            d.batchesBefore
          )}${max ? ` (je max. ${formatNumber(max)} kg)` : ''}`
        : ''
    const extraBatches =
      max && d.dough_g > max * 1000
        ? `; den Zusatzteig in ${formatNumber(
            Math.ceil(d.dough_g / (max * 1000) - 1e-9)
          )} Chargen ansetzen`
        : ''
    const pieces = d.pieces
      ? `${formatNumber(Math.abs(d.pieces))} Teigstücke ${
          d.pieces > 0 ? 'mehr' : 'weniger'
        }`
      : 'Teigstücke unverändert'
    out.push(
      `${d.name}: ${pieces} (${dough})${
        weighing ? `: ${weighing}` : ''
      }; mit Nachträgen ${formatNumber(
        d.totalPieces
      )} Teigstücke, ${formatGrams(d.totalDough_g)}${batchNote}${extraBatches}`
    )
  }
  for (const f of extras.fillings) {
    const recipe =
      f.recipe && f.recipe.factor !== null
        ? `; dafür Rezept „${f.recipe.title}“ × ${formatNumber(
            f.recipe.factor
          )}: ${f.recipe.ingredients
            .map(
              (ing) =>
                `${ing.name} ${ingredientAmount(ing, f.recipe ?? null).text}`
            )
            .join(', ')}`
        : ''
    out.push(
      `${f.name}: ${f.grams > 0 ? '+' : '−'}${formatGrams(
        Math.abs(f.grams)
      )}; mit Nachträgen ${formatGrams(f.totalGrams)}${recipe}`
    )
  }
  return out
}

/**
 * Die Mengen eines Nachtrags zum Abwiegen, groß fürs Backstube-Tablet
 * (W4-verify r4): „+26 × 600 g“, „+25,1 kg Teig“, „15 Chargen statt 13“,
 * „Nussfüllung +9,8 kg“ - je Teig bzw. Füllung eine Gruppe. Der ganze Satz
 * steht weiter darunter (`deltaExtrasLines`).
 */
export function deltaExtrasHighlights(
  extras: DeltaExtras | null | undefined
): Array<{ key: string; label: string; amounts: string[] }> {
  if (!extras) return []
  const sign = (n: number) => (n < 0 ? '−' : '+')
  const out: Array<{ key: string; label: string; amounts: string[] }> = []
  for (const d of extras.doughs) {
    const amounts = d.weighing
      .filter((w) => w.pieces)
      .map(
        (w) =>
          `${sign(w.pieces)}${formatNumber(
            Math.abs(w.pieces)
          )} × ${formatNumber(w.piece_g)} g`
      )
    if (d.dough_g) {
      amounts.push(`${sign(d.dough_g)}${formatGrams(Math.abs(d.dough_g))} Teig`)
    }
    if (
      d.batches != null &&
      d.batchesBefore != null &&
      d.batches !== d.batchesBefore
    ) {
      amounts.push(
        `${formatNumber(d.batches)} Chargen statt ${formatNumber(
          d.batchesBefore
        )}`
      )
    }
    if (amounts.length > 0) {
      out.push({ key: `dough-${d.id}`, label: d.name, amounts })
    }
  }
  for (const f of extras.fillings) {
    if (!f.grams) continue
    out.push({
      key: `filling-${f.id}`,
      label: f.name,
      amounts: [`${sign(f.grams)}${formatGrams(Math.abs(f.grams))}`],
    })
  }
  return out
}

/** Spaltenwert ohne Vorzeichen; 0 als „–“, damit die Zahlen hervortreten. */
export function formatOrDash(n: number): string {
  return n ? formatNumber(n) : '–'
}

/** Gramm lesbar: unter 1 kg in g, sonst kg mit bis zu zwei Stellen. */
export function formatGrams(g: number): string {
  if (Math.abs(g) < 1000) return `${formatNumber(g)} g`
  return `${formatNumber(Math.round(g / 10) / 100)} kg`
}

/** Saisonfaktor als Text „1,2“ (bzw. „1,0“). */
export function formatFactor(f: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(f)
}

/**
 * Zahl aus einer Eingabe: Komma oder Punkt, Leerzeichen egal. `NaN`, wenn es
 * keine Zahl ist - der Server prüft trotzdem selbst.
 */
/**
 * Vorzeichen eines eingetippten Werts umdrehen (Knopf „±“ am Korrekturfeld:
 * die Ziffernblöcke von iOS haben kein Minus). Leer → „-“ zum Weitertippen.
 */
export function toggleSign(value: string): string {
  const trimmed = value.trim()
  if (/^[-\u2212]/.test(trimmed)) return trimmed.slice(1)
  if (trimmed.startsWith('+')) return `-${trimmed.slice(1)}`
  return `-${trimmed}`
}

export function parseDecimal(value: string): number {
  // U+2212 (−) ist das Minus der Beschriftung; manche Tastaturen setzen es ein.
  const cleaned = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\u2212/g, '-')
    .replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

/** Ganzzahlige Einheiten (Korrekturen dort nur ganze Zahlen). */
export function isIntegerUnit(unit: BackzettelUnit | null): boolean {
  return unit === 'Stück' || unit === 'Blech' || !unit
}

/**
 * Name einer Sorte: die Laibgröße („500 g“, Z10) bzw. der Füllungsname aus
 * den Stammdaten („Nussfüllung“), sonst die ID mit großem Anfangsbuchstaben.
 * `null` an einem Posten mit Sorten heißt: Vorbestellung ohne Füllungsangabe.
 * `itemId` braucht es nur für Größen (die gehören einem Posten).
 */
export function variantLabel(
  variant: string | null,
  config?:
    | (Pick<BackzettelConfigData, 'fillings'> &
        Partial<Pick<BackzettelConfigData, 'items'>>)
    | null,
  itemId?: string
): string | null {
  if (!variant) return null
  if (itemId) {
    const item = config?.items?.find((i) => i.id === itemId)
    const size = item?.sizes?.find((sz) => sz.id === variant)
    if (size?.label) return size.label
  }
  const filling = config?.fillings?.find((f) => f.id === variant)
  if (filling?.name) return filling.name
  return variant.charAt(0).toUpperCase() + variant.slice(1)
}

/** Posten mit Sorten (aus den Stammdaten) - für „ohne Füllungsangabe“. */
export function itemHasVariants(
  itemId: string,
  config?: Pick<BackzettelConfigData, 'items'> | null
): boolean {
  const item = config?.items?.find((i) => i.id === itemId)
  return !!item && Array.isArray(item.variants) && item.variants.length > 0
}

/** Posten mit Laibgrößen (Z10). */
function itemHasSizes(
  itemId: string,
  config?: Pick<BackzettelConfigData, 'items'> | null
): boolean {
  const item = config?.items?.find((i) => i.id === itemId)
  return !!item && Array.isArray(item.sizes) && item.sizes.length > 0
}

/**
 * Zeilenname mit Sorte: „Zopf gefüllt – Nussfüllung“, „Testkorn – 500 g“.
 * Steht die Zeile auf dem Zettel eines anderen Tages als ihrem Backtag
 * (Z10: Teig heute, gebacken später), mit „· für Di 01.12.“.
 */
export function lineLabel(
  line: Pick<BackzettelLine, 'name' | 'variant' | 'itemId'> &
    Partial<
      Pick<
        BackzettelLine,
        'variantLabel' | 'variantKind' | 'bakeDate' | 'doughDate'
      >
    >,
  config?: Pick<BackzettelConfigData, 'fillings' | 'items'> | null
): string {
  const v = line.variant
    ? line.variantLabel || variantLabel(line.variant, config, line.itemId)
    : null
  const base = v
    ? `${line.name} – ${v}`
    : line.variantKind === 'size' || itemHasSizes(line.itemId, config)
    ? `${line.name} – ohne Größe`
    : itemHasVariants(line.itemId, config)
    ? `${line.name} – ohne Füllungsangabe`
    : line.name
  return line.bakeDate && line.doughDate && line.bakeDate !== line.doughDate
    ? `${base} · für ${formatDateShort(line.bakeDate)}`
    : base
}

export const DELTA_KIND_LABELS: Record<string, string> = {
  added: 'neu',
  changed: 'geändert',
  cancelled: 'storniert',
  removed: 'entfernt',
  moved: 'verschoben',
}

/**
 * Code eines Nachtrags; liegt die Bestellung inzwischen an einem anderen
 * Tag, mit „jetzt Di 10.11.“ - ihr Code ist dann der des neuen Tags
 * (W4-Verifikation Runde 5).
 */
export function deltaCodeText(d: {
  preorderCode: string | null
  preorderMovedTo?: string | null
}): string | null {
  if (!d.preorderCode) return null
  return d.preorderMovedTo
    ? `${d.preorderCode} (jetzt ${formatDateShort(d.preorderMovedTo)})`
    : d.preorderCode
}

/** Offene (nicht quittierte) Nachträge. */
export function openDeltas(
  day: Pick<BackzettelDay, 'deltas'> | null | undefined
): BackzettelDeltaEntry[] {
  return (day?.deltas ?? []).filter((d) => !d.acknowledgedAt)
}

/** Alle Zeilen eines Tages in Abschnittsreihenfolge. */
export function allLines(
  day: Pick<BackzettelDay, 'sections'>
): BackzettelLine[] {
  return day.sections.flatMap((s) => s.lines)
}

export interface ChangedTotal {
  line: BackzettelLine
  /** Gesamt vor der Aktion; `null` = Zeile stand vorher nicht da. */
  before: number | null
  /** Gesamt danach; `null` = Zeile ist weggefallen. */
  after: number | null
}

/**
 * Zeilen, deren Gesamt sich zwischen zwei Ständen desselben Tages
 * unterscheidet - z. B. Anzeige vor „Freigeben“ und freigegebener Zettel,
 * wenn inzwischen eine Vorbestellung dazukam. Verglichen werden nur die
 * Zahlen des Servers; gerechnet wird nichts.
 */
export function changedTotals(
  before: Pick<BackzettelDay, 'sections'>,
  after: Pick<BackzettelDay, 'sections'>
): ChangedTotal[] {
  const old = new Map(allLines(before).map((l) => [l.key, l]))
  const out: ChangedTotal[] = []
  for (const line of allLines(after)) {
    const prev = old.get(line.key)
    old.delete(line.key)
    if (!prev) {
      if (line.total !== 0) out.push({ line, before: null, after: line.total })
    } else if (prev.total !== line.total) {
      out.push({ line, before: prev.total, after: line.total })
    }
  }
  for (const prev of Array.from(old.values())) {
    if (prev.total !== 0)
      out.push({ line: prev, before: prev.total, after: null })
  }
  return out
}

/**
 * Zeilen des Zettels, in denen Vorbestellungen stecken (für die Übersicht).
 * Bewusst keine Stücksumme: die Zeilen stehen in Produktionseinheiten
 * (Viertel aufgerundet, Liter), eine Summe wäre weder „bestellte Stück“ noch
 * „gebackene Stück“.
 */
export function linesWithPreorders(
  day: Pick<BackzettelDay, 'sections'>
): number {
  return allLines(day).filter((l) => (l.preorders || 0) > 0).length
}

/** „Di–So“ für zusammenhängende Tage, sonst „Di, Do, Sa“. */
function weekdayList(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (contiguous && sorted.length > 2) {
    return `${WEEKDAY_SHORT[sorted[0]]}–${
      WEEKDAY_SHORT[sorted[sorted.length - 1]]
    }`
  }
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ')
}

/**
 * Untertitel der Übersicht aus `config.days`: „Die kommenden Produktionstage
 * (Di–So). Montag ist Ruhetag." Ohne Stammdaten ohne Wochentage.
 */
export function describeProductionDays(
  days: readonly number[] | null | undefined
): string {
  if (!days || days.length === 0) return 'Die kommenden Produktionstage.'
  const closed = [1, 2, 3, 4, 5, 6, 7].filter((d) => !days.includes(d))
  const base = `Die kommenden Produktionstage (${weekdayList(days)}).`
  if (closed.length === 0) return `${base} Kein Ruhetag.`
  const names = closed.map((d) => WEEKDAY_NAMES[d])
  if (names.length === 1) return `${base} ${names[0]} ist Ruhetag.`
  return `${base} ${names.slice(0, -1).join(', ')} und ${
    names[names.length - 1]
  } sind Ruhetage.`
}

/** Ob der Tag eine Hefeteig- oder Füllungsseite hat (Druckseite 2, Karte). */
export function hasHefeteig(
  day: Pick<BackzettelDay, 'hefeteig' | 'fillings'>
): boolean {
  return (
    (day.hefeteig?.doughs?.length ?? 0) > 0 || (day.fillings?.length ?? 0) > 0
  )
}

/**
 * Kopfzeile eines Füllungsrezepts: „Rezept „Nussfüllung“ × 1,5“ - oder, wenn
 * es sich nicht hochrechnen lässt (Zutat ohne Grammangabe), ohne Faktor.
 */
export function recipeHeading(recipe: ScaledRecipe): string {
  return recipe.factor === null
    ? `Rezept „${recipe.title}“ – Grundrezept, nicht hochgerechnet`
    : `Rezept „${recipe.title}“ × ${formatNumber(recipe.factor)}`
}

/**
 * Hinweis zu einem unvollständigen Rezept (W4-Verifikation Runde 2): früher
 * wurde es nur mit den lesbaren Zutaten hochgerechnet - aus „1 Dose Äpfel +
 * 200 g Zucker“ und 400 g Bedarf wurde „× 2“ mit doppeltem Zucker.
 */
export function recipeIncompleteNote(recipe: ScaledRecipe): string | null {
  if (recipe.complete) return null
  return recipe.factor === null
    ? `Rezept unvollständig – nicht jede Zutat hat eine Grammangabe, deshalb nicht hochgerechnet. Unten das Grundrezept; gebraucht werden ${formatGrams(
        recipe.grams
      )} Füllung.`
    : 'Rezept unvollständig – Zutaten ohne Grammangabe bitte nach Gefühl.'
}

/** Menge einer Zutat: skaliert, sonst die Angabe aus dem Rezept. */
export function ingredientAmount(
  ing: ScaledIngredient,
  recipe: ScaledRecipe | null
): { text: string; scaled: boolean } {
  if (ing.scaled_g !== null) {
    return { text: formatGrams(ing.scaled_g), scaled: true }
  }
  return {
    text:
      recipe && recipe.factor === null
        ? ing.raw
        : `${ing.raw} (nicht skaliert)`,
    scaled: false,
  }
}

// ------------------------------------------------------------ Z10 (v2)

/**
 * Eine Zahl, die unbekannt sein kann (Stammdaten offen): „–“ für `null`,
 * sonst deutsch mit Einheit. Nie 0 für unbekannt (docs/backzettel-v2.md §3).
 */
export function formatKnown(
  value: number | null | undefined,
  unit?: string | null
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '–'
  }
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value)
}

/** Gramm, die unbekannt sein können: „–“ für `null`. */
export function formatKnownGrams(value: number | null | undefined): string {
  return value === null || value === undefined ? '–' : formatGrams(value)
}

/**
 * Liter an der Maschine: „6,5 L“, ohne Rundung „6,47 L (Rundung offen)“,
 * ohne kg je Liter oder bei unvollständigem Teig „unbekannt“.
 */
export function litersText(liters: DoughLiters | null | undefined): string {
  if (!liters || liters.exact === null) return 'unbekannt'
  if (liters.rounded === null) {
    return `${formatNumber(liters.exact)} L (Rundung offen)`
  }
  return `${formatNumber(liters.rounded)} L`
}

/** Warum die Liter fehlen oder ungerundet sind - `null`, wenn alles bekannt ist. */
export function litersHint(
  liters: DoughLiters | null | undefined
): string | null {
  if (!liters) return 'Liter: unbekannt'
  switch (liters.reason) {
    case 'kg_per_liter_unknown':
      return 'Liter: unbekannt (kg je Liter fehlt)'
    case 'dough_incomplete':
      return 'Liter: unbekannt (Teig unvollständig – ein Gewicht fehlt)'
    case 'rounding_unknown':
      return 'Rundung offen – angezeigt sind die genauen Liter'
    default:
      return liters.exact === null ? 'Liter: unbekannt' : null
  }
}

/**
 * kg eines Teigs: „12,4 kg“; unvollständig „≥ 12,4 kg“ (nur wenn schon
 * etwas bekannt ist), sonst „unbekannt“.
 */
export function kgText(d: {
  kg: number | null
  kgKnown?: number | null
  complete?: boolean
}): string {
  if (d.kg !== null && d.kg !== undefined) return `${formatNumber(d.kg)} kg`
  if (d.kgKnown && d.kgKnown > 0) return `≥ ${formatNumber(d.kgKnown)} kg`
  return 'unbekannt'
}

/** Chargen: Zahl, sonst „unbekannt“ mit Grund. */
export function batchesText(
  box: Pick<MachineBox, 'batches' | 'batch_max_kg'>
): {
  text: string
  hint: string | null
} {
  if (box.batches !== null && box.batches !== undefined) {
    return {
      text: `${formatNumber(box.batches)} ${
        box.batches === 1 ? 'Charge' : 'Chargen'
      }`,
      hint:
        box.batch_max_kg !== null && box.batch_max_kg !== undefined
          ? `je max. ${formatNumber(box.batch_max_kg)} kg`
          : null,
    }
  }
  return {
    text: 'Chargen: unbekannt',
    hint:
      box.batch_max_kg === null || box.batch_max_kg === undefined
        ? 'Chargengröße offen'
        : 'Teiggewicht unbekannt',
  }
}

/** Bezeichnung der Literzahl: Hefeteig „Wasser“, sonst nur „Liter“. */
export function litersLabel(box: Pick<MachineBox, 'section'>): string {
  return box.section === 'hefeteig' ? 'Wasser' : 'Liter'
}

/** Zugabe (z. B. Sauer): „Testsauer 20 g“ bzw. „Testsauer: unbekannt“. */
export function addonText(addon: DoughAddon): {
  text: string
  hint: string | null
} {
  if (!addon.grams) {
    return {
      text: `${addon.name}: unbekannt`,
      hint:
        addon.reason === 'g_per_liter_unknown'
          ? 'Gramm je Liter offen'
          : 'Liter des Teigs unbekannt',
    }
  }
  if (addon.grams.rounded === null) {
    return {
      text: `${addon.name} ${formatNumber(addon.grams.exact)} g`,
      hint: 'Rundung offen – genaue Gramm',
    }
  }
  return {
    text: `${addon.name} ${formatNumber(addon.grams.rounded)} g`,
    hint: null,
  }
}

/** Backtag für eine Überschrift: „heute backen“ bzw. „für Sonntag, 29.11.“. */
export function bakeDayLabel(bakeDate: string, sheetDate: string): string {
  if (bakeDate === sheetDate) return 'heute backen'
  return `für ${WEEKDAY_NAMES[isoWeekday(bakeDate)]}, ${formatDate(
    bakeDate
  ).slice(0, 6)}`
}

/**
 * Bruch-Gruppe in einer Zeile: „7 Bruch × 1150 g – 12 Teststern, 8 Testkäse
 * · +8 frei“. Unbekanntes bleibt sichtbar („? Bruch“, „g unbekannt“).
 */
export function bruchGroupText(group: BruchGroup): string {
  const brueche =
    group.brueche === null ? '? Bruch' : `${formatNumber(group.brueche)} Bruch`
  const weight = group.g === null ? 'g unbekannt' : `${formatNumber(group.g)} g`
  const split = group.split
    .map((s) => `${formatNumber(s.total)} ${s.name}`)
    .join(', ')
  const spare =
    group.spare === null ? '' : ` · +${formatNumber(group.spare)} frei`
  return `${brueche} × ${weight} – ${split}${spare}`
}

/**
 * Stück für „+1 Bruch“: so viele Brötchen ergibt ein Druck der Teilmaschine
 * (Stück je Bruch ÷ Teigstücke je Brötchen). `null`, wenn die Stückzahl je
 * Bruch offen ist oder es nicht aufgeht - dann gibt es den Knopf nicht.
 */
export function bruchStep(
  piecesPerBruch: number | null | undefined,
  perProduct: number | null | undefined
): number | null {
  if (!piecesPerBruch || !perProduct) return null
  const step = piecesPerBruch / perProduct
  return Number.isInteger(step) ? step : null
}

/**
 * Kopfzeile eines Teigtag-Zettels: „Teige heute: Korn + Holz · Testweck für
 * So + Di · Testhefe“ - aus `machine` und den Teilen der Teige (Server).
 */
export function doughsTodayText(
  day: Pick<BackzettelDay, 'date' | 'machine' | 'doughs'>
): string | null {
  const boxes = day.machine ?? []
  if (boxes.length === 0) return null
  const names = boxes.map((box) => {
    const dates = new Set<string>()
    for (const d of day.doughs ?? []) {
      if (!box.doughIds.includes(d.id)) continue
      for (const p of d.parts) if (p.bakeDate) dates.add(p.bakeDate)
    }
    const later = Array.from(dates)
      .filter((d) => d !== day.date)
      .sort()
    if (later.length === 0) return box.name
    const days = later.map((d) => WEEKDAY_SHORT[isoWeekday(d)])
    if (dates.has(day.date)) days.unshift('heute')
    return `${box.name} für ${days.join(' + ')}`
  })
  return `Teige heute: ${names.join(' · ')}`
}

/**
 * Füllungsbedarf mit offenen Gramm (Z10, Regel 7): „Gramm unbekannt“, wenn
 * kein Posten Gramm hat; „≥ 1,2 kg“, wenn nur ein Teil bekannt ist.
 */
export function fillingGramsText(
  filling: Pick<FillingNeed, 'grams' | 'missingFillingG' | 'items'>
): string {
  if (!filling.missingFillingG) return formatGrams(filling.grams)
  const known = filling.items.some((i) => i.grams !== null)
  if (!known || !filling.grams) return 'Gramm unbekannt'
  return `≥ ${formatGrams(filling.grams)}`
}

/**
 * Quelle einer Backliste (Z10): „Teig von heute · Entwurf“,
 * „Teig vom Samstag · freigegeben“.
 */
export function bakeSourceText(
  source: {
    doughDate: string
    weekdayName?: string | null
    status: 'draft' | 'confirmed'
  },
  date: string
): string {
  const day =
    source.doughDate === date
      ? 'Teig von heute'
      : `Teig vom ${source.weekdayName || formatDateShort(source.doughDate)}`
  return `${day} · ${source.status === 'confirmed' ? 'freigegeben' : 'Entwurf'}`
}
