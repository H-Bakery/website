/**
 * Druckbild eines Teigtag-Zettels auf EINER A4-Seite (Z10, docs/backzettel-v2.md
 * §7.5): welche Zeilen in welchen Block gehören und wie dicht gesetzt wird.
 *
 * Reine Anzeige-Hilfen - keine Menge wird hier gerechnet, nur gezählt, wie
 * viele Zeilen das Blatt hat (wie `notfallLayout` beim Notfallblatt). Die
 * Schätzung in mm ist bewusst grob und eher zu groß; geprüft wird das echte
 * Blatt mit `page.pdf()` (docs/domains/backzettel.md, „Druck").
 */

import type {
  BackzettelDay,
  BackzettelLine,
  BackzettelSection,
  BakeList,
} from './backzettelApi'
import { deltaDoughLines, v2CoveredKeys } from './backzettelFormat'

/** Abschnitt, der im Druck einen eigenen Block in zwei Spalten bekommt. */
export const HEFETEIG_SECTION = 'hefeteig'

/** Eine Dichtestufe: Grundschrift, Zeilenhöhe, große Literzahl. */
export interface PrintStep {
  fontPt: number
  rowMm: number
  bigPt: number
}

/** Von luftig bis knapp; die letzte Stufe ist die dichteste. */
export const DAY_PRINT_STEPS: readonly PrintStep[] = [
  { fontPt: 10, rowMm: 5.6, bigPt: 20 },
  { fontPt: 9, rowMm: 4.9, bigPt: 18 },
  { fontPt: 8, rowMm: 4.3, bigPt: 16 },
  { fontPt: 7.5, rowMm: 3.9, bigPt: 14 },
  { fontPt: 7, rowMm: 3.6, bigPt: 13 },
]

/** Seitenrand des Teigtag-Zettels in mm (`@page`). */
export const PAGE_MARGIN_MM = 10
/**
 * Nutzbare Höhe einer Seite in mm: A4 (297) − 2 × Rand, mit Reserve für
 * Umbrüche in Spalten und Rundungen des Browsers.
 */
export const PAGE_HEIGHT_MM = 297 - 2 * PAGE_MARGIN_MM - 9
/** Nutzbare Breite in mm. */
export const PAGE_WIDTH_MM = 210 - 2 * PAGE_MARGIN_MM
/** Leerzeilen für Notizen am Ende des Blatts und ihre Höhe in mm. */
export const NOTE_LINES = 4
export const NOTE_LINE_MM = 5.5

/** Ein Posten im Hefeteig-Block: alle Sorten einer Zeile zusammen. */
export interface HefeteigPrintRow {
  itemId: string
  name: string
  lines: BackzettelLine[]
}

/** Was nicht in Brot-Tabelle oder Brötchen steht, aufgeteilt für den Druck. */
export interface DayPrintParts {
  /** Hefeteig-Posten, je Posten eine Zeile (gefüllt: Sorten nebeneinander). */
  hefeteig: HefeteigPrintRow[]
  /** Übrige Abschnitte (Kaffeestückchen, Kuchen, Laugen …), ohne leere. */
  others: BackzettelSection[]
  /** Hinweise und offene Stammdaten, ohne doppelte Texte. */
  hints: string[]
  /** Offene Stammdaten (Fußnote „Offen: …“), ohne doppelte Texte. */
  open: string[]
}

/** Teilt die Zeilen eines Teigtag-Zettels auf die Blöcke des Druckbilds. */
export function dayPrintParts(day: BackzettelDay): DayPrintParts {
  const covered = v2CoveredKeys(day)
  const hefeteig: HefeteigPrintRow[] = []
  const others: BackzettelSection[] = []
  for (const section of day.sections) {
    const lines = section.lines.filter((l) => !covered.has(l.key))
    if (lines.length === 0) continue
    if (section.id !== HEFETEIG_SECTION) {
      others.push({ ...section, lines })
      continue
    }
    for (const line of lines) {
      const last = hefeteig[hefeteig.length - 1]
      // Sorten eines Postens stehen in der API direkt hintereinander.
      if (last && last.itemId === line.itemId && line.variant) {
        last.lines.push(line)
      } else {
        hefeteig.push({ itemId: line.itemId, name: line.name, lines: [line] })
      }
    }
  }
  // Ohne Schlusspunkt: der Druck reiht sie mit „;“ aneinander.
  const unique = (texts: string[]) =>
    Array.from(
      new Set(
        texts.map((t) => (t ?? '').trim().replace(/\.$/, '')).filter(Boolean)
      )
    )
  const open = unique([
    ...(day.openMasterData ?? []).map((o) => o.message),
    ...(day.doughs ?? []).flatMap((d) => d.missing.map((m) => m.message)),
  ])
  const hints = unique(day.warnings.map((w) => w.message)).filter(
    (h) => !open.includes(h)
  )
  return { hefeteig, others, hints, open }
}

/** Zeilen (Text), die ein Fließtext von `chars` Zeichen braucht. */
function textLines(chars: number, fontPt: number): number {
  // Arial: im Mittel gut ein halbes Geviert je Zeichen.
  const charMm = fontPt * 0.3528 * 0.52
  const perLine = Math.max(20, Math.floor(PAGE_WIDTH_MM / charMm))
  return Math.ceil(chars / perLine)
}

/** Ob eine Zeile im Druck eine zweite, kleine Zeile mit Angaben bekommt. */
export function hasPrintDetail(line: BackzettelLine): boolean {
  return Boolean(
    line.tray ||
      line.hint ||
      line.correctionReason ||
      line.baseUnset ||
      line.previouslyDone ||
      line.loavesEstimate ||
      (line.delta && line.delta.count > 0)
  )
}

/**
 * Abschnitte bis zu so vielen Zeilen bleiben im Zwei-Spalten-Druck in einer
 * Spalte (Review Z10 Runde 2); längere dürfen auf die zweite Spalte umbrechen.
 */
export const KEEP_SECTION_LINES = 8
/**
 * Bricht ein langer Abschnitt um, stehen mindestens so viele Zeilen unter der
 * Überschrift und mindestens so viele unter „… (Forts.)“ - nie eine
 * Überschrift allein unten in der linken Spalte.
 */
export const MIN_SPLIT_LINES = 3
/** Höhe einer Abschnitts-Überschrift in Zeilen (Schätzung der Seite, eher zu groß). */
const SECTION_HEAD_ROWS = 1.5
/**
 * Zum Verteilen auf die Spalten: so hoch, wie sie im Druck wirklich sind
 * (gemessen mit `page.pdf()` am vollen Samstag: Überschrift und Zeile mit
 * kleiner Angabe kaum höher als eine Zeile). Mit den großzügigen Werten der
 * Schätzung stand links deutlich mehr als rechts.
 */
const BALANCE_HEAD_ROWS = 1.1
const BALANCE_DETAIL_ROWS = 1.1

/** Ein Stück eines Abschnitts in einer Druckspalte. */
export interface PrintColumnChunk {
  section: BackzettelSection
  lines: BackzettelLine[]
  /** Fortsetzung aus der linken Spalte: Überschrift „… (Forts.)“. */
  continued: boolean
}

/** Höhe einer Zeile der übrigen Abschnitte in Zeilen (mit kleiner Angabe höher). */
function otherLineRows(line: BackzettelLine): number {
  return hasPrintDetail(line) ? 1.7 : 1
}

/** Geschätzte Höhe einer Spalte in Zeilen (für die Seite, eher zu groß). */
export function printColumnRows(chunks: PrintColumnChunk[]): number {
  let rows = 0
  for (const c of chunks) {
    rows += SECTION_HEAD_ROWS
    for (const l of c.lines) rows += otherLineRows(l)
  }
  return rows
}

/**
 * Verteilt die übrigen Abschnitte auf zwei Spalten (links zuerst, Reihenfolge
 * bleibt). Gewählt wird die Teilung mit der niedrigsten höheren Spalte -
 * zwischen zwei Abschnitten oder in einem Abschnitt mit mehr als
 * `KEEP_SECTION_LINES` Zeilen, dort mit mindestens `MIN_SPLIT_LINES` Zeilen auf
 * jeder Seite. Die Fortsetzung bekommt ihre Überschrift „… (Forts.)“ - eine
 * Zeile steht nie ohne ihren Abschnitt oben in der rechten Spalte.
 *
 * Gerechnet wird hier und nicht mit CSS-Spalten: dort lässt Chrome eine
 * Überschrift unten links stehen und setzt die Zeilen ohne Überschrift nach
 * rechts (Review Z10, voller Samstag).
 */
export function printColumns(
  sections: BackzettelSection[]
): [PrintColumnChunk[], PrintColumnChunk[]] {
  const HEAD = BALANCE_HEAD_ROWS
  const rowsOf = sections.map((s) =>
    s.lines.map((l) => (hasPrintDetail(l) ? BALANCE_DETAIL_ROWS : 1))
  )
  const total = rowsOf.reduce(
    (n, r) => n + HEAD + r.reduce((a, b) => a + b, 0),
    0
  )
  // Kandidaten: vor Abschnitt i (k = 0) oder nach k Zeilen von Abschnitt i.
  let best = { i: sections.length, k: 0, height: total, left: total }
  const better = (height: number, k: number, left: number) => {
    if (Math.abs(height - best.height) > 1e-9) return height < best.height
    // Gleich hoch: lieber zwischen Abschnitten, dann links voller.
    if (k > 0 !== best.k > 0) return k === 0
    return left > best.left
  }
  let before = 0
  for (let i = 0; i <= sections.length; i++) {
    const consider = (k: number, left: number, right: number) => {
      const height = Math.max(left, right)
      if (better(height, k, left)) best = { i, k, height, left }
    }
    consider(0, before, total - before)
    if (i === sections.length) break
    const rows = rowsOf[i]
    if (rows.length > KEEP_SECTION_LINES) {
      let left = before + HEAD
      for (let k = 1; k < rows.length; k++) {
        left += rows[k - 1]
        if (k < MIN_SPLIT_LINES || rows.length - k < MIN_SPLIT_LINES) continue
        consider(k, left, total - left + HEAD)
      }
    }
    before += HEAD + rows.reduce((a, b) => a + b, 0)
  }
  const { i, k } = best
  const left: PrintColumnChunk[] = sections
    .slice(0, i)
    .map((section) => ({ section, lines: section.lines, continued: false }))
  const right: PrintColumnChunk[] = []
  if (i < sections.length) {
    const split = sections[i]
    if (k > 0) {
      left.push({
        section: split,
        lines: split.lines.slice(0, k),
        continued: false,
      })
      right.push({
        section: split,
        lines: split.lines.slice(k),
        continued: true,
      })
    } else {
      right.push({ section: split, lines: split.lines, continued: false })
    }
    for (const section of sections.slice(i + 1)) {
      right.push({ section, lines: section.lines, continued: false })
    }
  }
  return [left, right]
}

export interface DayPrintLayout extends PrintStep {
  /** Index in `DAY_PRINT_STEPS` (0 = luftig). */
  step: number
  /**
   * Passt es selbst in der dichtesten Stufe nicht, kommen die übrigen
   * Abschnitte auf ein zweites Blatt (docs/backzettel-v2.md §9 Nr. 3) - nie
   * abgeschnitten, nie weggelassen.
   */
  othersOnSecondSheet: boolean
  /**
   * Notizzeilen am Ende von Seite 1: `NOTE_LINES`, weniger (bis 0), wenn die
   * übrigen Abschnitte sonst auf Blatt 2 müssten - Notizen gehen vor.
   */
  noteLines: number
  /** Geschätzte Höhe von Seite 1 in mm (für Specs und Fehlersuche). */
  estimatedMm: number
  /**
   * Dichte von Blatt 2 (nur mit `othersOnSecondSheet`): eigene Stufe, nach
   * der Höhe von Blatt 2 gewählt - nicht die von Seite 1, sonst lief ein
   * Blatt 2, das knapp gesetzt passt, luftig auf ein drittes (Review Z10).
   */
  secondSheet: SecondSheetLayout | null
}

/** Dichte und geschätzte Höhe von Blatt 2 (übrige Abschnitte). */
export interface SecondSheetLayout extends PrintStep {
  /** Index in `DAY_PRINT_STEPS` (0 = luftig). */
  step: number
  /** Geschätzte Höhe von Blatt 2 in mm. */
  estimatedMm: number
}

/**
 * Höhe des Kastens „ENTWURF – noch nicht freigegeben“ in mm (`.banner` aus
 * `backzettelPrintStyles`: 12 pt, 1,5 mm Innen-, 2 mm Außenabstand).
 */
const DRAFT_BANNER_MM = 14

/**
 * Geschätzte Höhe von Blatt 2 in mm: Titel (1,5-fache Schrift), beim Entwurf
 * der Kasten „ENTWURF“, dann die übrigen Abschnitte in zwei Spalten.
 */
export function dayPrintSecondSheetHeight(
  day: BackzettelDay,
  parts: DayPrintParts,
  s: PrintStep
): number {
  return (
    s.fontPt * 0.3528 * 1.5 * 1.2 +
    (day.status === 'confirmed' ? 0 : DRAFT_BANNER_MM) +
    dayPrintHeights(day, parts, s).others
  )
}

/**
 * Stufe von Blatt 2: die luftigste, in der es passt. Passt es selbst in der
 * dichtesten nicht, bleibt die dichteste - dann läuft Blatt 2 weiter
 * (docs/backzettel-v2.md §9 Nr. 3, Grenze).
 */
function secondSheetLayout(
  day: BackzettelDay,
  parts: DayPrintParts
): SecondSheetLayout {
  const heights = DAY_PRINT_STEPS.map((s) =>
    dayPrintSecondSheetHeight(day, parts, s)
  )
  const found = heights.findIndex((h) => h <= PAGE_HEIGHT_MM)
  const step = found === -1 ? DAY_PRINT_STEPS.length - 1 : found
  return {
    ...DAY_PRINT_STEPS[step],
    step,
    estimatedMm: Math.round(heights[step]),
  }
}

/** Geschätzte Höhen der Blöcke von Seite 1 in mm bei einer Dichtestufe. */
export function dayPrintHeights(
  day: BackzettelDay,
  parts: DayPrintParts,
  s: PrintStep,
  noteLines: number = NOTE_LINES
): { fixed: number; others: number } {
  const row = s.rowMm
  const heading = row * 1.5
  const small = row * 0.75
  let fixed = 0

  // Kopf: Titel, Teige heute, Freigabe/Entwurf.
  fixed +=
    s.fontPt * 0.3528 * 1.6 + row * 2 + (day.status === 'confirmed' ? 0 : row)

  // Maschine: vier Kästen je Reihe, Höhe nach dem vollsten Kasten.
  const machine = day.machine ?? []
  for (let i = 0; i < machine.length; i += 4) {
    const boxes = machine.slice(i, i + 4)
    const lines = Math.max(
      ...boxes.map(
        (b) =>
          3 + // Name, kg, Chargen
          b.addons.length +
          (b.liters.reason ? 1 : 0)
      )
    )
    fixed += lines * small + s.bigPt * 0.3528 * 1.25 + 3
  }

  // Brot: Kopfzeile + je Brot eine Zeile (+ kleiner Hinweis).
  const bread = day.bread?.rows ?? []
  if (bread.length > 0) {
    fixed += heading + row
    // Der Hinweis steht klein hinter dem Namen; lange brechen um.
    for (const r of bread) fixed += row + (r.note ? small * 0.5 : 0)
  }

  // Brötchen: je Backtag eine Spalte (höchstens drei nebeneinander).
  const rolls = day.rolls ?? []
  for (let i = 0; i < rolls.length; i += 3) {
    const cols = rolls.slice(i, i + 3)
    const tallest = Math.max(
      ...cols.map(
        (b) =>
          row + // Backtag
          b.groups.length * (row + small * 0.4) + // Brüche – Aufteilung
          b.singles.length * row
      )
    )
    fixed += (i === 0 ? heading : 2) + tallest
  }

  // Hefeteig: zwei Spalten.
  if (parts.hefeteig.length > 0) {
    fixed += heading + Math.ceil(parts.hefeteig.length / 2) * row
  }

  // Nachträge: eine Zeile je Posten.
  const deltaKeys = new Set((day.deltas ?? []).map((d) => d.key)).size
  if (deltaKeys > 0) fixed += heading + Math.ceil(deltaKeys / 2) * row * 1.2
  // … und was sie für Teig und Teilmaschine heißen (eine kleine Textzeile).
  const doughChars = deltaDoughLines(day).join('; ').length
  if (doughChars > 0) {
    fixed += textLines(doughChars + 30, s.fontPt * 0.85) * small + 1
  }

  // Hinweise und „Offen: …“ in kleiner Schrift.
  const smallPt = s.fontPt * 0.85
  const hintChars = parts.hints.join(' · ').length
  const openChars = parts.open.join('; ').length
  if (hintChars > 0) fixed += textLines(hintChars + 10, smallPt) * small + 1
  if (openChars > 0) fixed += textLines(openChars + 8, smallPt) * small + 1

  // Notizzeilen (ohne Zeilen auch ohne Überschrift).
  if (noteLines > 0) fixed += row + noteLines * NOTE_LINE_MM

  // Übrige Abschnitte: zwei Spalten (`printColumns`), so hoch wie die höhere.
  const others =
    parts.others.length > 0
      ? heading +
        (Math.ceil(
          Math.max(...printColumns(parts.others).map(printColumnRows))
        ) +
          1) *
          row
      : 0

  return { fixed, others }
}

/**
 * Dichte des Druckbilds: die luftigste Stufe, in der Seite 1 passt. Passt es
 * nirgends, stehen die übrigen Abschnitte auf einem zweiten Blatt (mit
 * Hinweis auf Seite 1); Seite 1 und Blatt 2 wählen ihre Stufe dann je für
 * sich.
 */
export function dayPrintLayout(day: BackzettelDay): DayPrintLayout {
  const parts = dayPrintParts(day)
  let tightest: { fixed: number; others: number } | null = null
  for (let i = 0; i < DAY_PRINT_STEPS.length; i++) {
    const h = dayPrintHeights(day, parts, DAY_PRINT_STEPS[i])
    tightest = h
    if (h.fixed + h.others <= PAGE_HEIGHT_MM) {
      return {
        ...DAY_PRINT_STEPS[i],
        step: i,
        othersOnSecondSheet: false,
        noteLines: NOTE_LINES,
        estimatedMm: Math.round(h.fixed + h.others),
        secondSheet: null,
      }
    }
  }
  const last = DAY_PRINT_STEPS.length - 1
  // Vor Blatt 2: in der dichtesten Stufe erst die Notizzeilen kürzen
  // (Review Z10 Runde 1 - ein voller Samstag ging sonst auf zwei Blätter,
  // obwohl unten Platz blieb).
  if (parts.others.length > 0) {
    for (let n = NOTE_LINES - 1; n >= 0; n--) {
      const h = dayPrintHeights(day, parts, DAY_PRINT_STEPS[last], n)
      if (h.fixed + h.others <= PAGE_HEIGHT_MM) {
        return {
          ...DAY_PRINT_STEPS[last],
          step: last,
          othersOnSecondSheet: false,
          noteLines: n,
          estimatedMm: Math.round(h.fixed + h.others),
          secondSheet: null,
        }
      }
    }
  }
  const h = tightest as { fixed: number; others: number }
  if (parts.others.length === 0) {
    return {
      ...DAY_PRINT_STEPS[last],
      step: last,
      othersOnSecondSheet: false,
      noteLines: NOTE_LINES,
      estimatedMm: Math.round(h.fixed + h.others),
      secondSheet: null,
    }
  }
  // Blatt 2: Seite 1 trägt statt der Abschnitte nur den Kasten „Weitere
  // Abschnitte auf Blatt 2: …“ (zwei Zeilen) und darf wieder luftiger werden.
  // Blatt 2 bekommt seine eigene Stufe (`secondSheet`).
  const page1 = (s: PrintStep) =>
    dayPrintHeights(day, parts, s).fixed + 2 * s.rowMm
  const found = DAY_PRINT_STEPS.findIndex((s) => page1(s) <= PAGE_HEIGHT_MM)
  const step = found === -1 ? last : found
  return {
    ...DAY_PRINT_STEPS[step],
    step,
    othersOnSecondSheet: true,
    noteLines: NOTE_LINES,
    estimatedMm: Math.round(page1(DAY_PRINT_STEPS[step])),
    secondSheet: secondSheetLayout(day, parts),
  }
}

export interface BakeListPrintLayout extends PrintStep {
  step: number
  /** Ab vielen Zeilen in zwei Spalten, damit es ein Blatt bleibt. */
  columns: 1 | 2
  estimatedMm: number
}

/** Dichte der gedruckten Backliste (eine Seite je Backtag). */
export function bakeListPrintLayout(
  list: Pick<BakeList, 'sections' | 'deltas' | 'warnings' | 'sources'>
): BakeListPrintLayout {
  const lines = list.sections.reduce((n, s) => n + s.lines.length, 0)
  const sections = list.sections.filter((s) => s.lines.length > 0).length
  const deltaKeys = new Set(list.deltas.map((d) => d.key)).size
  const hintChars = list.warnings.map((w) => w.message).join(' · ').length
  const height = (s: PrintStep, columns: 1 | 2) => {
    const row = s.rowMm * 1.15 // größere Zahlen als auf dem Zettel
    const body = (sections * 1.5 + lines) / columns + 1
    return (
      s.fontPt * 0.3528 * 1.6 +
      s.rowMm * 3 + // Kopf, Quellen, Entwurf
      body * row +
      (deltaKeys > 0 ? (1.5 + deltaKeys * 1.1) * s.rowMm : 0) +
      (hintChars > 0
        ? textLines(hintChars, s.fontPt * 0.85) * s.rowMm * 0.75
        : 0)
    )
  }
  for (const columns of [1, 2] as const) {
    for (let i = 0; i < DAY_PRINT_STEPS.length; i++) {
      const h = height(DAY_PRINT_STEPS[i], columns)
      if (h <= PAGE_HEIGHT_MM) {
        return {
          ...DAY_PRINT_STEPS[i],
          step: i,
          columns,
          estimatedMm: Math.round(h),
        }
      }
    }
  }
  const last = DAY_PRINT_STEPS.length - 1
  return {
    ...DAY_PRINT_STEPS[last],
    step: last,
    columns: 2,
    estimatedMm: Math.round(height(DAY_PRINT_STEPS[last], 2)),
  }
}
