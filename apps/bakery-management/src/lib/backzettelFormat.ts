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
  DeltaExtras,
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
 * Name einer Sorte: der Füllungsname aus den Stammdaten („Nussfüllung“),
 * sonst die ID mit großem Anfangsbuchstaben. `null` an einem Posten mit
 * Sorten heißt: Vorbestellung ohne Füllungsangabe.
 */
export function variantLabel(
  variant: string | null,
  config?: Pick<BackzettelConfigData, 'fillings'> | null
): string | null {
  if (!variant) return null
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

/** Zeilenname mit Sorte: „Zopf gefüllt – Nussfüllung“. */
export function lineLabel(
  line: Pick<BackzettelLine, 'name' | 'variant' | 'itemId'>,
  config?: Pick<BackzettelConfigData, 'fillings' | 'items'> | null
): string {
  const v = variantLabel(line.variant, config)
  if (v) return `${line.name} – ${v}`
  if (itemHasVariants(line.itemId, config))
    return `${line.name} – ohne Füllungsangabe`
  return line.name
}

export const DELTA_KIND_LABELS: Record<string, string> = {
  added: 'neu',
  changed: 'geändert',
  cancelled: 'storniert',
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
