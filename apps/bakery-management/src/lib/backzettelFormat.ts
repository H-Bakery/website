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
  DeltaBruchGroup,
  DeltaExtras,
  DoughAddon,
  DoughLiters,
  FillingNeed,
  MachineBox,
  RollsBlock,
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

/**
 * U9: der Tagestyp aus dem Kalender in einer Zeile - „Samstags-Satz –
 * danach geschlossen: Fr 25.12. 1. Weihnachtstag …“. `null` am normalen
 * Tag oder ohne Angabe (ältere Server). Der Text kommt vom Server
 * (`label`, `detail`); hier wird nur zusammengesetzt.
 */
export function dayKindLine(
  dayKind: { label: string | null; detail: string | null } | null | undefined
): string | null {
  if (!dayKind || !dayKind.label) return null
  return dayKind.detail ? `${dayKind.label} – ${dayKind.detail}` : dayKind.label
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
  Liter: 'L',
  kg: 'kg',
  Blech: 'Bl.',
  Charge: 'Charge',
}

/** Menge mit Einheit; Stück ohne Zusatz („40“, „4,5 L“, „3 Bl.“, „1,12 Charge“). */
export function formatQty(n: number, unit: BackzettelUnit | null): string {
  const suffix = unit ? UNIT_SUFFIX[unit] : undefined
  return suffix ? `${formatNumber(n)} ${suffix}` : formatNumber(n)
}

/**
 * Menge einer Zeile, Zelle oder eines Bruch-Mitglieds, deren Grundmenge offen
 * sein kann (Review Z10 Runde 2) - eine Regel für Planung, Tablet, Backliste
 * und Druck: „12“; mit `totalIsMinimum` (Server: Grundmenge offen, bekannt
 * sind nur Vorbestellt/CAP) „≥ 4“ bzw. „offen“, wenn noch nichts bekannt
 * ist. Nie eine nackte Zahl, die sich wie die ganze Backmenge liest.
 */
export function minQtyText(
  q: {
    total: number | null
    totalIsMinimum?: boolean
    dayDecision?: 'none' | 'amount'
  },
  unit: BackzettelUnit | null = null
): string {
  if (q.total === null || q.total === undefined) return 'offen'
  // „Heute keine“ (Tagesentscheidung bei offener Grundmenge): das Wort,
  // nicht eine 0, die sich wie eine Grundmenge liest.
  if (q.dayDecision === 'none' && q.total === 0) return 'keine'
  if (!q.totalIsMinimum) return formatQty(q.total, unit)
  return q.total > 0 ? `≥ ${formatQty(q.total, unit)}` : 'offen'
}

/**
 * Zusammensetzung in Kurzform, nur Bestandteile ≠ 0: „Basis 60 · CAP 10 ·
 * Korr. −5“, „Basis offen · Vorb. 7“ - Tablet und Planung (Brötchen).
 */
export function lineBreakdown(line: BackzettelLine): string {
  const parts: string[] = []
  parts.push(
    line.baseUnset
      ? line.dayDecision === 'none'
        ? 'Basis offen – heute keine'
        : line.dayDecision === 'amount'
        ? 'Basis offen – für heute festgelegt'
        : 'Basis offen'
      : `Basis ${formatNumber(line.base)}`
  )
  if (line.seasonal) parts.push(`Saison ${formatSigned(line.seasonal)}`)
  if (line.preorders) parts.push(`Vorb. ${formatNumber(line.preorders)}`)
  if (line.cap) parts.push(`CAP ${formatNumber(line.cap)}`)
  if (line.correction) {
    parts.push(
      `Korr. ${formatSigned(line.correction)}${
        line.correctionReason ? ` (${line.correctionReason})` : ''
      }`
    )
  }
  return parts.join(' · ')
}

/**
 * Was zu einer offenen Grundmenge an der Zeile steht - eine Regel für
 * Planung, Tablet, Backliste und Druck: „Grundmenge offen“, mit
 * Tagesentscheidung „Heute keine …“ bzw. „Für heute festgelegt …“ (die
 * Grundmenge bleibt offen, die Menge gilt nur für diesen Tag), sonst `null`.
 */
export function baseOpenText(q: {
  baseUnset?: boolean
  dayDecision?: 'none' | 'amount'
}): string | null {
  if (!q.baseUnset) return null
  if (q.dayDecision === 'none') return 'Heute keine · Grundmenge offen'
  if (q.dayDecision === 'amount')
    return 'Für heute festgelegt · Grundmenge offen'
  return 'Grundmenge offen'
}

/** Hinweis zu `minQtyText`: „Grundmenge offen“ oder `null`. */
export function minQtyHint(q: { totalIsMinimum?: boolean }): string | null {
  return q.totalIsMinimum ? 'Grundmenge offen' : null
}

/**
 * Eine erneute Freigabe hat die Menge einer schon abgehakten Zeile geändert
 * (W4-Verifikation Runde 2): „bereits 30 erledigt (06.11. 05:10 · Bernd) -
 * noch +10". `null`, wenn die Zeile keinen entfernten Haken hat oder wieder
 * abgehakt ist.
 */
export function previouslyDoneText(line: BackzettelLine): string | null {
  if (line.doneAt) return null
  return previousTickText(line, line.previouslyDone, 'erledigt')
}

/**
 * Z10 O5: dasselbe für den gebacken-Haken der Backliste - eine erneute
 * Freigabe mit mehr Stück hat ihn entfernt („bereits 66 gebacken … - noch +5“).
 */
export function previouslyBakedText(line: BackzettelLine): string | null {
  if (line.bakedAt) return null
  return previousTickText(line, line.previouslyBaked, 'gebacken')
}

function previousTickText(
  line: BackzettelLine,
  prev: BackzettelLine['previouslyDone'],
  verb: string
): string | null {
  if (!prev) return null
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
  return `bereits ${formatQty(prev.qty, line.unit)} ${verb}${
    who ? ` (${who})` : ''
  } - ${tail}`
}

/** Nachträge, die erst nach dem Abhaken einer Zeile kamen. */
export interface DeltaAfterDone {
  /** Summe der Nachtragsmengen nach dem Haken (Einheit der Zeile). */
  qty: number
  /** Was das zusätzlich zu backen heißt; > 0 = die Zeile ist wieder offen. */
  bake: number
  /** Anzahl dieser Nachträge (gesehen oder nicht). */
  count: number
}

/**
 * UI-Runde 1: Ein Nachtrag, der nach dem Abhaken kam, ist mit dem Haken
 * nicht gebacken - auch nicht, nachdem ihn jemand „gesehen“ hat. Vorher
 * stand die Zeile grün „erledigt“ da und die Zusatzmenge nirgends mehr
 * offen. `null`, wenn die Zeile nicht abgehakt ist oder seither nichts kam.
 *
 * Die Backmenge kommt vom Server (`delta.bake`), wenn alle Nachträge der
 * Zeile nach dem Haken kamen; sonst die aufgerundete Menge (Stück/Blech).
 */
export function deltaAfterDone(
  line: Pick<BackzettelLine, 'key' | 'doneAt' | 'delta' | 'unit'>,
  deltas: ReadonlyArray<
    Pick<BackzettelDeltaEntry, 'key' | 'qty' | 'createdAt'>
  > | null
): DeltaAfterDone | null {
  if (!line.doneAt || !deltas?.length) return null
  const doneAt = Date.parse(line.doneAt)
  if (Number.isNaN(doneAt)) return null
  const mine = deltas.filter((d) => d.key === line.key)
  const after = mine.filter((d) => {
    const at = Date.parse(d.createdAt)
    return !Number.isNaN(at) && at > doneAt
  })
  if (after.length === 0) return null
  const qty = Math.round(after.reduce((s, d) => s + d.qty, 0) * 100) / 100
  let bake: number
  if (after.length === mine.length && typeof line.delta?.bake === 'number') {
    bake = line.delta.bake
  } else if (isIntegerUnit(line.unit)) {
    bake = qty > 0 ? Math.ceil(qty - 1e-9) : Math.floor(qty + 1e-9)
  } else {
    bake = qty
  }
  return { qty, bake, count: after.length }
}

/**
 * Text an einer abgehakten Zeile mit späterem Nachtrag: „erledigt 07.11.
 * 02:54 · Bernd – danach Nachtrag: noch +12 backen“.
 */
export function deltaAfterDoneText(
  line: Pick<BackzettelLine, 'doneAt' | 'doneBy' | 'unit'>,
  after: DeltaAfterDone
): string {
  const who = [formatTimestamp(line.doneAt), line.doneBy?.displayName]
    .filter(Boolean)
    .join(' · ')
  const tail =
    after.bake > 0
      ? `noch ${formatSignedQty(after.bake, line.unit)} backen`
      : after.qty < 0
      ? `${formatQty(-after.qty, line.unit)} weniger nötig`
      : 'nichts mehr backen'
  return `erledigt${who ? ` ${who}` : ''} – danach Nachtrag: ${tail}`
}

/** Zu- und Abschläge: „+2“, „−1“, „–“ für 0. */
export function formatSigned(n: number): string {
  if (!n) return '–'
  return n > 0 ? `+${formatNumber(n)}` : `−${formatNumber(Math.abs(n))}`
}

/** Zu- und Abschläge mit Einheit: „+1 L“, „−2“, „+0,5 kg“; „–“ für 0. */
export function formatSignedQty(
  n: number,
  unit: BackzettelUnit | null
): string {
  if (!n) return '–'
  return `${n > 0 ? '+' : '−'}${formatQty(Math.abs(n), unit)}`
}

/**
 * Text des Nachtrag-Abzeichens einer Zeile (W4-Verifikation): mit Einheit
 * („Nachtrag +1 L“) und - wenn das Aufrunden etwas anderes ergibt als der
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
      .filter((w): w is typeof w & { pieces: number } => Boolean(w.pieces))
      .map(
        (w) =>
          `${formatNumber(Math.abs(w.pieces))} × ${
            w.piece_g === null ? '? g' : `${formatNumber(w.piece_g)} g`
          } ${w.pieces > 0 ? 'zusätzlich' : 'weniger'} abwiegen`
      )
      .join(', ')
    // Unbekanntes bleibt unbekannt (Review Z10 Runde 2): nie „+0 g Teig“.
    const dough =
      d.dough_g === null
        ? 'Zusatzteig unbekannt'
        : `${d.dough_g < 0 ? '−' : '+'}${formatGrams(Math.abs(d.dough_g))} Teig`
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
      max && d.dough_g !== null && d.dough_g > max * 1000
        ? `; den Zusatzteig in ${formatNumber(
            Math.ceil(d.dough_g / (max * 1000) - 1e-9)
          )} Chargen ansetzen`
        : ''
    const pieces =
      d.pieces === null
        ? 'Teigstücke unbekannt'
        : d.pieces
        ? `${formatNumber(Math.abs(d.pieces))} Teigstücke ${
            d.pieces > 0 ? 'mehr' : 'weniger'
          }`
        : 'Teigstücke unverändert'
    out.push(
      `${d.name}: ${pieces} (${dough})${
        weighing ? `: ${weighing}` : ''
      }; mit Nachträgen ${deltaTotalPiecesText(d)}, ${deltaTotalDoughText(
        d
      )}${batchNote}${extraBatches}`
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
    const total =
      f.totalComplete === false
        ? f.totalGrams > 0
          ? `≥ ${formatGrams(f.totalGrams)} (Grundmenge offen)`
          : 'unbekannt (Grundmenge offen)'
        : formatGrams(f.totalGrams)
    out.push(
      `${f.name}: ${f.grams > 0 ? '+' : '−'}${formatGrams(
        Math.abs(f.grams)
      )}; mit Nachträgen ${total}${recipe}`
    )
  }
  return out
}

type DeltaDough = DeltaExtras['doughs'][number]

/** „37 Teigstücke“, „≥ 37 Teigstücke“ (Grundmenge offen) oder unbekannt. */
function deltaTotalPiecesText(d: DeltaDough): string {
  if (d.totalPieces === null) return 'Teigstücke unbekannt'
  if (d.totalPiecesComplete === false) {
    return d.totalPieces > 0
      ? `≥ ${formatNumber(d.totalPieces)} Teigstücke`
      : 'Teigstücke unbekannt'
  }
  return `${formatNumber(d.totalPieces)} Teigstücke`
}

/** „16,5 kg“, „≥ 16,5 kg Teig“ (Teig unvollständig) oder „Teig unbekannt“. */
function deltaTotalDoughText(d: DeltaDough): string {
  if (d.totalDough_g !== null) return formatGrams(d.totalDough_g)
  const known = d.totalDoughKnown_g ?? null
  return known ? `≥ ${formatGrams(known)} Teig` : 'Teig gesamt unbekannt'
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
      .filter((w): w is typeof w & { pieces: number } => Boolean(w.pieces))
      .map(
        (w) =>
          `${sign(w.pieces)}${formatNumber(Math.abs(w.pieces))} × ${
            w.piece_g === null ? '?' : formatNumber(w.piece_g)
          } g`
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
    return `${formatNumber(liters.exact)} L (${litersExactWhy(liters)})`
  }
  return `${formatNumber(liters.rounded)} L`
}

/**
 * Warum nur die genauen Liter dastehen: „Rundung offen“ (Stammdaten) oder
 * eine kleine Menge unter der Rundungsstufe („unter 1 L, nicht gerundet“ -
 * ein einzelner Kranz unter der Woche wäre sonst „0 L“).
 */
export function litersExactWhy(
  liters: Pick<DoughLiters, 'reason' | 'step'>
): string {
  if (liters.reason !== 'below_rounding_step') return 'Rundung offen'
  return liters.step
    ? `unter ${formatNumber(liters.step)} L, nicht gerundet`
    : 'kleine Menge, nicht gerundet'
}

/**
 * Nur die Zahl für die große Anzeige (Maschinenleiste, Hefeteig-Karte,
 * Tablet): „6,5 L“, ohne Rundung die genauen „6,47 L“, sonst „unbekannt“.
 * Der Zusatz („Rundung offen …“) steht klein darunter (`litersHint`), wie im
 * Druck - nicht in der großen Schrift.
 */
export function litersFigure(liters: DoughLiters | null | undefined): string {
  if (!liters || liters.exact === null) return 'unbekannt'
  return `${formatNumber(liters.rounded ?? liters.exact)} L`
}

/** Warum die Liter fehlen oder ungerundet sind - `null`, wenn alles bekannt ist. */
export function litersHint(
  liters: DoughLiters | null | undefined
): string | null {
  if (!liters) return 'Liter: unbekannt'
  switch (liters.reason) {
    case 'kg_per_liter_unknown':
      return 'Liter: unbekannt (kg je Liter offen)'
    case 'dough_incomplete':
      return 'Liter: unbekannt (Teig unvollständig – ein Gewicht offen)'
    case 'rounding_unknown':
      return 'Rundung offen – angezeigt sind die genauen Liter'
    case 'below_rounding_step':
      return `Kleine Menge (${litersExactWhy(
        liters
      )}) – angezeigt sind die genauen Liter`
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

/**
 * Stück einer Gewichtsstufe der Abwiegeliste: „15“, „≥ 15“, wenn ein Posten
 * dieser Stufe eine offene Grundmenge hat (Regel 8), „–“ wenn unbekannt oder
 * noch nichts bekannt ist (nie das leere „≥ 0“).
 */
export function weighingPiecesText(w: {
  pieces: number | null
  isMinimum?: boolean
}): string {
  if (w.pieces === null) return '–'
  if (w.isMinimum) return w.pieces > 0 ? `≥ ${formatNumber(w.pieces)}` : '–'
  return formatNumber(w.pieces)
}

/**
 * Posten einer Gewichtsstufe: „Zopf gefüllt 15“, „Kranz gefüllt 14 × 2“, mit
 * offener Grundmenge „Zopf gefüllt ≥ 6“ bzw. „Zopf gefüllt offen“.
 */
export function weighingItemsText(
  items: Array<{
    name: string
    products: number
    piecesPerProduct: number | null
    isMinimum?: boolean
  }>
): string {
  return items
    .map((i) => {
      if (i.isMinimum && !(i.products > 0)) return `${i.name} offen`
      const count = `${i.isMinimum ? '≥ ' : ''}${formatNumber(i.products)}`
      return i.piecesPerProduct === 1
        ? `${i.name} ${count}`
        : `${i.name} ${count} × ${i.piecesPerProduct ?? '?'}`
    })
    .join(', ')
}

/**
 * Teigstücke einer Hefeteig-Karte: „≥ 12“, wenn eine Grundmenge des Teigs
 * offen ist (Regel 8), „–“ wenn unbekannt.
 */
export function hefeteigPiecesText(d: {
  pieces: number | null
  piecesComplete?: boolean
}): string {
  if (d.pieces === null) return '–'
  if (d.piecesComplete === false) {
    // nichts bekannt: „–“ wie beim Teiggewicht, nie das leere „≥ 0“
    return d.pieces > 0 ? `≥ ${formatNumber(d.pieces)}` : '–'
  }
  return formatNumber(d.pieces)
}

/**
 * Teig gesamt einer Hefeteig-Karte - dieselbe Zahl wie die Maschinenleiste
 * (Teigtag-Zettel: `kg`/`kgKnown` vom Server, „≥ 16,5 kg“ bei offenen Teilen);
 * ältere Tage in Gramm.
 */
export function hefeteigDoughText(d: {
  dough_g: number | null
  kg?: number | null
  kgKnown?: number
}): string {
  if (d.kg === undefined) return formatKnownGrams(d.dough_g)
  if (d.kg !== null) return formatGrams(Math.round(d.kg * 1000))
  return d.kgKnown && d.kgKnown > 0
    ? `≥ ${formatGrams(Math.round(d.kgKnown * 1000))}`
    : '–'
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
      hint:
        addon.reason === 'below_rounding_step'
          ? 'kleine Menge, nicht gerundet – genaue Gramm'
          : 'Rundung offen – genaue Gramm',
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
 * Bruch-Gruppe in einer Zeile: „7 Bruch × 1250 g – 12 Teststern, 8 Testkäse
 * · +8 frei“. Unbekanntes bleibt sichtbar: eine offene Grundmenge macht
 * „≥ 1 Bruch“ bzw. „? Bruch“ und „Testkäse offen“, nie „0“ (Regel 8). „frei“
 * steht in Produkten; haben die Mitglieder verschieden viele Teigstücke je
 * Produkt, in Teigstücken.
 */
export function bruchGroupText(group: BruchGroup): string {
  const weight =
    group.g === null ? '? g (Bruchgewicht offen)' : `${formatNumber(group.g)} g`
  return `${bruchCountText(group)} × ${weight}${bruchAddonsText(
    group
  )} – ${bruchSplitText(group)}${bruchSpareText(group)}`
}

/**
 * Zugaben je Bruch (U3): „ + 1,2 kg Körnermischung“ (Brüche × g je Bruch),
 * „ + ≥ 600 g …“ (Grundmenge offen) oder „ + Körnermischung (Menge offen)“ -
 * nie 0 für unbekannt. Leer ohne Zugaben. Bildschirm und Druck nehmen genau
 * diesen Text.
 */
export function bruchAddonsText(group: Pick<BruchGroup, 'addons'>): string {
  return (group.addons ?? [])
    .map((a) => {
      if (a.g !== null) return ` + ${formatGrams(a.g)} ${a.name}`
      if (a.gKnown) return ` + ≥ ${formatGrams(a.gKnown)} ${a.name}`
      return ` + ${a.name} (Menge offen)`
    })
    .join('')
}

/** „7 Bruch“, „≥ 1 Bruch“ (Grundmenge offen) oder „? Bruch“. */
export function bruchCountText(group: BruchGroup): string {
  const known = group.bruecheKnown ?? null
  if (group.brueche !== null) return `${formatNumber(group.brueche)} Bruch`
  return known ? `≥ ${formatNumber(known)} Bruch` : '? Bruch'
}

/**
 * Aufteilung „12 Teststern, Testkäse offen“; mit `lineByKey` (Druck) je
 * Mitglied auch die Korrektur mit Grund: „42 Testdoppel (Korr. +30 Fest)“.
 */
export function bruchSplitText(
  group: BruchGroup,
  lineByKey?: Map<string, BackzettelLine>
): string {
  return group.split
    .map((s) => {
      // Grundmenge offen: die bekannten Stück als Mindestmenge („≥ 7
      // Roggen“), „offen“ nur, wenn noch nichts bekannt ist.
      const qty = minQtyText(s)
      const base = qty === 'offen' ? `${s.name} offen` : `${qty} ${s.name}`
      const line = lineByKey ? lineByKey.get(s.key) : undefined
      const corr = line && line.correction ? line.correction : 0
      if (!corr) return base
      return `${base} (Korr. ${formatSigned(corr)}${
        line && line.correctionReason ? ` ${line.correctionReason}` : ''
      })`
    })
    .join(', ')
}

/**
 * „ · +4 frei“ (Produkte) bzw. „ · +9 Teigstücke frei“; leer, wenn unbekannt.
 * Ergeben die freien Teigstücke kein ganzes Produkt (Doppelweck, 1 Stück
 * übrig), stehen sie in Teigstücken - nie „+0 frei“ neben freiem Teig.
 * Bildschirm und Druck nehmen genau diesen Text.
 */
export function bruchSpareText(group: BruchGroup): string {
  if (group.spare === null) return ''
  if (group.spareProducts !== undefined && group.spareProducts !== null) {
    if (group.spareProducts === 0 && group.spare > 0) {
      return ` · +${formatNumber(group.spare)} ${
        group.spare === 1 ? 'Teigstück' : 'Teigstücke'
      } frei`
    }
    return ` · +${formatNumber(group.spareProducts)} frei`
  }
  if (group.spareProducts === null && group.perProduct !== 1) {
    return ` · +${formatNumber(group.spare)} Teigstücke frei`
  }
  return ` · +${formatNumber(group.spare)} frei`
}

/** „Teig: 2,4 kg“, „Teig: ≥ 2 kg“ (Grundmenge offen) oder „Teig: – kg“. */
export function bruchKgText(group: BruchGroup): string {
  if (group.kg !== null) return `Teig: ${formatKnown(group.kg, 'kg')}`
  if (group.kgKnown) return `Teig: ≥ ${formatKnown(group.kgKnown, 'kg')}`
  return 'Teig: – kg'
}

/**
 * Zugaben je Bruch in den Nachträgen (U3): „ · +150 g Testkörner (jetzt
 * 900 g)“; offen nur, wenn sich die Brüche ändern oder unbekannt sind -
 * „ · Testkörner: Menge offen“. Leer ohne Änderung.
 */
export function deltaAddonsText(
  g: Pick<DeltaBruchGroup, 'addons' | 'bruecheDelta'>
): string {
  return (g.addons ?? [])
    .map((a) => {
      if (a.gDelta === null) {
        return g.bruecheDelta === 0 ? '' : ` · ${a.name}: Menge offen`
      }
      if (a.gDelta === 0) return ''
      const sign = a.gDelta > 0 ? '+' : '−'
      return ` · ${sign}${formatGrams(Math.abs(a.gDelta))} ${a.name}${
        a.g !== null ? ` (jetzt ${formatGrams(a.g)})` : ''
      }`
    })
    .join('')
}

/**
 * Was die Nachträge eines freigegebenen Teigtag-Zettels für Teilmaschine und
 * Teige heißen (Review Z10 Runde 1) - nur Text aus den Server-Zahlen
 * (`deltaBruch`, `deltaMachine`), gerechnet wird hier nichts:
 * „Testdoppel für Di: +6 Teigstücke – 1 Bruch mehr (jetzt 6)“,
 * „… – passt in die freien Stücke (noch +2 frei)“,
 * „Testweck: +1,2 kg Teig (jetzt 17,2 kg) · Liter 5,5 L → 6 L“.
 */
export function deltaDoughLines(
  day: Pick<BackzettelDay, 'date' | 'deltaBruch' | 'deltaMachine'>
): string[] {
  const out: string[] = []
  for (const g of day.deltaBruch ?? []) {
    const when =
      g.bakeDate && g.bakeDate !== day.date
        ? ` für ${WEEKDAY_SHORT[isoWeekday(g.bakeDate)]}`
        : ''
    const pieces = `${formatSigned(g.piecesDelta)} Teigstücke`
    let effect: string
    if (g.bruecheDelta === null) {
      effect = 'Brüche unbekannt (Stammdaten offen)'
    } else if (g.bruecheDelta > 0) {
      effect = `${formatNumber(
        g.bruecheDelta
      )} Bruch mehr (jetzt ${formatNumber(g.brueche as number)})`
    } else if (g.bruecheDelta < 0) {
      effect = `${formatNumber(
        Math.abs(g.bruecheDelta)
      )} Bruch weniger (jetzt ${formatNumber(g.brueche as number)})`
    } else if (g.piecesDelta > 0) {
      const free = g.spareProducts ?? g.spare
      effect = `passt in die freien Stücke${
        free !== null ? ` (noch +${formatNumber(free)} frei)` : ''
      }`
    } else {
      effect = 'gleich viele Brüche'
    }
    out.push(`${g.name}${when}: ${pieces} – ${effect}${deltaAddonsText(g)}`)
  }
  for (const m of day.deltaMachine ?? []) {
    const parts = [
      `${formatSigned(m.kgDelta)} kg Teig${
        m.kg !== null ? ` (jetzt ${formatKnown(m.kg, 'kg')})` : ''
      }`,
    ]
    // Liter: gerundet, sonst die genauen mit „Rundung offen“ (Review Z10
    // Runde 2 - die Maschinenleiste darüber zeigt sie auch); „unbekannt“ nur,
    // wenn kg je Liter offen oder der Teig unvollständig ist.
    const liters = m.liters
    const exactOnly = liters?.rounded == null && liters?.exact != null
    const value = (l: DoughLiters | null | undefined) =>
      l == null ? null : exactOnly ? l.exact : l.rounded
    const before = value(m.litersBefore)
    const after = value(liters)
    if (after === null) {
      parts.push(
        liters?.reason === 'kg_per_liter_unknown'
          ? 'Liter unbekannt (kg je Liter offen)'
          : liters?.reason === 'dough_incomplete'
          ? 'Liter unbekannt (Teig unvollständig)'
          : 'Liter unbekannt'
      )
    } else if (before !== after) {
      parts.push(
        `Liter ${
          before === null ? '–' : `${formatNumber(before)} L`
        } → ${formatNumber(after)} L${
          exactOnly && liters ? ` (${litersExactWhy(liters)})` : ''
        }`
      )
    }
    if (
      m.batches !== null &&
      m.batchesBefore !== null &&
      m.batches !== m.batchesBefore
    ) {
      parts.push(
        `${formatNumber(m.batchesBefore)} → ${formatNumber(m.batches)} Chargen`
      )
    }
    out.push(`${m.name}: ${parts.join(' · ')}`)
  }
  return out
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
  filling: Pick<
    FillingNeed,
    'grams' | 'missingFillingG' | 'items' | 'baseUnset'
  >
): string {
  const open = filling.baseUnset === true
  if (!filling.missingFillingG && !open) return formatGrams(filling.grams)
  const known = filling.items.some((i) => i.grams !== null)
  if (!known || !filling.grams) return open ? 'offen' : 'Gramm unbekannt'
  return `≥ ${formatGrams(filling.grams)}`
}

/**
 * Hinweis zu einer Füllung, deren gefüllter Posten keine Grundmenge hat
 * (Review Z10 Runde 2): „Grundmenge offen: Zopf gefüllt – Apfel – …“.
 */
export function fillingOpenNote(
  filling: Pick<FillingNeed, 'baseUnset' | 'openItems'>
): string | null {
  if (!filling.baseUnset) return null
  const names = (filling.openItems ?? []).join(', ')
  return `Grundmenge offen${
    names ? `: ${names}` : ''
  } – die Menge ist nur der bekannte Teil (Vorbestellungen, CAP), das Rezept wird nicht hochgerechnet.`
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

/** Schlüssel aller Zeilen, die Brot-Tabelle und Brötchen-Blöcke zeigen. */
export function v2CoveredKeys(day: {
  bread?: {
    rows: {
      cells: Record<string, { key: string } | null>
      single: { key: string } | null
    }[]
  } | null
  rolls?: RollsBlock[] | null
}): Set<string> {
  const keys = new Set<string>()
  for (const row of day.bread?.rows ?? []) {
    if (row.single) keys.add(row.single.key)
    for (const c of Object.values(row.cells)) if (c) keys.add(c.key)
  }
  for (const block of day.rolls ?? []) {
    for (const g of block.groups) for (const s of g.split) keys.add(s.key)
    for (const s of block.singles) keys.add(s.key)
  }
  return keys
}

/** Für Specs und andere Ansichten: die Zeile zu einem Schlüssel. */
export function linesByKey(
  sections: { lines: BackzettelLine[] }[]
): Map<string, BackzettelLine> {
  return new Map(sections.flatMap((s) => s.lines).map((l) => [l.key, l]))
}
