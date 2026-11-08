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
import { v2CoveredKeys } from './backzettelFormat'

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
      line.correctionReason ||
      line.baseUnset ||
      line.previouslyDone ||
      line.loavesEstimate ||
      (line.delta && line.delta.count > 0)
  )
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
  /** Geschätzte Höhe von Seite 1 in mm (für Specs und Fehlersuche). */
  estimatedMm: number
}

/** Geschätzte Höhen der Blöcke von Seite 1 in mm bei einer Dichtestufe. */
export function dayPrintHeights(
  day: BackzettelDay,
  parts: DayPrintParts,
  s: PrintStep
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

  // Hinweise und „Offen: …“ in kleiner Schrift.
  const smallPt = s.fontPt * 0.85
  const hintChars = parts.hints.join(' · ').length
  const openChars = parts.open.join('; ').length
  if (hintChars > 0) fixed += textLines(hintChars + 10, smallPt) * small + 1
  if (openChars > 0) fixed += textLines(openChars + 8, smallPt) * small + 1

  // Notizzeilen.
  fixed += row + NOTE_LINES * NOTE_LINE_MM

  // Übrige Abschnitte: zwei Spalten.
  let othersRows = 0
  for (const section of parts.others) {
    othersRows += 1.5
    for (const l of section.lines) othersRows += hasPrintDetail(l) ? 1.7 : 1
  }
  const others =
    parts.others.length > 0
      ? heading + (Math.ceil(othersRows / 2) + 1) * row
      : 0

  return { fixed, others }
}

/**
 * Dichte des Druckbilds: die luftigste Stufe, in der Seite 1 passt. Passt es
 * nirgends, stehen die übrigen Abschnitte auf einem zweiten Blatt (mit
 * Hinweis auf Seite 1).
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
        estimatedMm: Math.round(h.fixed + h.others),
      }
    }
  }
  const last = DAY_PRINT_STEPS.length - 1
  const h = tightest as { fixed: number; others: number }
  return {
    ...DAY_PRINT_STEPS[last],
    step: last,
    othersOnSecondSheet: parts.others.length > 0,
    estimatedMm: Math.round(h.fixed + (parts.others.length > 0 ? 0 : h.others)),
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
