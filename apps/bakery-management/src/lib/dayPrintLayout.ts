/**
 * Druckbild eines Teigtag-Zettels (Z10, überarbeitet in U8/Z13): welche
 * Zeilen in welchen Block gehören, in welcher Reihenfolge die Blöcke stehen
 * und wie sie auf A4-Blätter verteilt werden.
 *
 * Reine Anzeige-Hilfen - keine Menge wird hier gerechnet, nur zugeordnet und
 * gezählt, wie hoch ein Block wird (wie `notfallLayout` beim Notfallblatt).
 * Die Schätzung in mm ist bewusst grob und eher zu groß; geprüft wird das
 * echte Blatt mit `page.pdf()` (docs/domains/backzettel.md, „Druck").
 */

import type {
  BackzettelDay,
  BackzettelLine,
  BackzettelSection,
  BakeList,
  BreadRow,
  BruchGroup,
  MachineBox,
  SingleRow,
} from './backzettelApi'
import {
  WEEKDAY_SHORT,
  deltaDoughLines,
  formatDateShort,
  isoWeekday,
  v2CoveredKeys,
} from './backzettelFormat'

/** Abschnitt, der im Druck zum Hefeteig-Block gehört. */
export const HEFETEIG_SECTION = 'hefeteig'

/** Eine Dichtestufe: Grundschrift, Zeilenhöhe, große Literzahl. */
export interface PrintStep {
  fontPt: number
  rowMm: number
  bigPt: number
}

/**
 * Dichtestufen der Backliste (`bakeListPrintLayout`), von luftig bis knapp.
 * Der Teigtag-Zettel hat eigene, größere Stufen (`SHEET_STEPS`).
 */
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
 * Rundungen des Browsers.
 */
export const PAGE_HEIGHT_MM = 297 - 2 * PAGE_MARGIN_MM - 9
/** Nutzbare Breite in mm. */
export const PAGE_WIDTH_MM = 210 - 2 * PAGE_MARGIN_MM
/** Leerzeilen für Notizen am Ende des letzten Blatts und ihre Höhe in mm. */
export const NOTE_LINES = 4
export const NOTE_LINE_MM = 7

/** Ein Posten im Hefeteig-Block: alle Sorten zusammen. */
export interface HefeteigPrintRow {
  itemId: string
  name: string
  lines: BackzettelLine[]
}

/** Was nicht in Brot-Tabelle oder Brötchen steht, aufgeteilt für den Druck. */
export interface DayPrintParts {
  /** Hefeteig-Posten, je Posten ein Eintrag (gefüllt: alle Sorten). */
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

// ---------------------------------------------------------------------------
// Tagestyp im Kopf

/**
 * Was der Tag für die Backstube ist, groß im Kopf des Zettels:
 * „Heute backen + Teig für So 29.11. und Di 01.12.“, „Nur Teig für Di
 * 01.12.“, „Backtag ohne Teig – siehe Backliste“. Nur aus den Backtagen
 * des Zettels (Server), nichts gerechnet.
 *
 * Der Kalender (U9: Feiertage, „vor Feiertag“, Samstags-Satz) stellt seinen
 * Tagestyp davor - der Kopf hat dafür Platz (`.dd-daytype`).
 */
export function sheetDayTypeText(
  day: Pick<BackzettelDay, 'date' | 'sections' | 'bakeDates' | 'isDoughDay'>
): string {
  if (day.sections.length === 0 || day.isDoughDay === false) {
    return 'Backtag ohne Teig – was gebacken wird, steht auf der Backliste'
  }
  const dates = new Set<string>()
  for (const b of day.bakeDates ?? []) if (b.lineCount > 0) dates.add(b.date)
  if (dates.size === 0) {
    for (const s of day.sections)
      for (const l of s.lines) dates.add(l.bakeDate ?? day.date)
  }
  const later = Array.from(dates)
    .filter((d) => d !== day.date)
    .sort()
  const forLater =
    later.length === 0
      ? ''
      : `Teig für ${later
          .map(formatDateShort)
          .join(later.length === 2 ? ' und ' : ', ')}`
  if (!dates.has(day.date)) return `Nur ${forLater}`
  return forLater ? `Heute backen + ${forLater}` : 'Heute backen'
}

/**
 * Für welche Backtage ein Maschinen-Kasten Teig macht: „heute + So + Di“
 * (aus den Teilen der Teige vom Server). Leer, wenn der Server keine Teile
 * nennt.
 */
export function boxBakeDaysText(
  day: Pick<BackzettelDay, 'date' | 'doughs'>,
  box: Pick<MachineBox, 'doughIds'>
): string {
  const dates = new Set<string>()
  for (const d of day.doughs ?? []) {
    if (!box.doughIds.includes(d.id)) continue
    for (const p of d.parts) if (p.bakeDate) dates.add(p.bakeDate)
  }
  // Kurz („So + Di“): die Daten stehen groß im Kopf (Tagestyp).
  return Array.from(dates)
    .sort()
    .map((d) => (d === day.date ? 'heute' : WEEKDAY_SHORT[isoWeekday(d)]))
    .join(' + ')
}

// ---------------------------------------------------------------------------
// Blöcke: je Teig ein Block in Arbeitsreihenfolge

/** Brötchen eines Teigs für einen Backtag. */
export interface RollsForDay {
  bakeDate: string
  groups: BruchGroup[]
  singles: SingleRow[]
}

/**
 * Alles, was aus einem Maschinen-Kasten (Teig oder gemeinsame Gruppe)
 * entsteht: Brot, Brötchen je Backtag, Hefeteig-Posten. `box: null` sind
 * die Sammelblöcke für Zeilen ohne Kasten („Weiteres Brot“ - z. B.
 * Spezialbrote nach Liter oder Charge -, „Weitere Brötchen“, „Hefeteig“).
 */
export interface DoughPrintBlock {
  key: string
  title: string
  box: MachineBox | null
  bread: BreadRow[]
  /** Chronologisch: heute, dann die späteren Backtage. */
  rolls: RollsForDay[]
  hefeteig: HefeteigPrintRow[]
}

/**
 * Ordnet Brot-Zeilen, Bruch-Gruppen, Einzelstücke und Hefeteig-Posten ihrem
 * Maschinen-Kasten zu. Reihenfolge = Reihenfolge der Kästen vom Server, also
 * `doughs:` in hq `config/backzettel.yaml` - die Arbeitsreihenfolge stellt
 * der Inhaber dort ein. Zugeordnet wird über die Teig-ID der Zeile bzw. die
 * Teile der Teige (`day.doughs[].parts`); was keinem Kasten gehört, kommt in
 * einen Sammelblock - nie weggelassen.
 */
export function doughPrintBlocks(
  day: BackzettelDay,
  parts: DayPrintParts = dayPrintParts(day)
): DoughPrintBlock[] {
  const boxes = day.machine ?? []
  const blocks: DoughPrintBlock[] = boxes.map((box) => ({
    key: box.id ?? 'offen',
    title: box.name,
    box,
    bread: [],
    rolls: [],
    hefeteig: [],
  }))
  const byDough = new Map<string | null, DoughPrintBlock>()
  boxes.forEach((box, i) => {
    for (const id of box.doughIds) byDough.set(id, blocks[i])
  })
  // Teig eines Postens je Backtag aus den Teilen der Teige.
  const partDough = new Map<string, string | null>()
  const itemDough = new Map<string, string | null>()
  for (const d of day.doughs ?? []) {
    for (const p of d.parts) {
      partDough.set(`${p.itemId}|${p.bakeDate}`, d.id)
      if (!itemDough.has(p.itemId)) itemDough.set(p.itemId, d.id)
    }
  }
  const extra: Record<'brot' | 'broetchen' | 'hefeteig', DoughPrintBlock> = {
    brot: sammel('weiteres-brot', 'Weiteres Brot'),
    broetchen: sammel('weitere-broetchen', 'Weitere Brötchen'),
    hefeteig: sammel('hefeteig', 'Hefeteig'),
  }
  const find = (doughId: string | null | undefined) =>
    doughId === undefined ? undefined : byDough.get(doughId)

  for (const row of day.bread?.rows ?? []) {
    // `from_dough` (Anteil aus einem anderen Teig): die Zeile hat keinen
    // eigenen Teig, ihr Teil nennt ihn.
    const key = `${row.itemId}|${row.bakeDate}`
    const id =
      row.doughId !== null
        ? row.doughId
        : partDough.has(key)
        ? partDough.get(key)
        : undefined
    ;(find(id) ?? extra.brot).bread.push(row)
  }
  const rollsOf = (block: DoughPrintBlock, bakeDate: string) => {
    let r = block.rolls.find((x) => x.bakeDate === bakeDate)
    if (!r) {
      r = { bakeDate, groups: [], singles: [] }
      block.rolls.push(r)
    }
    return r
  }
  for (const rb of day.rolls ?? []) {
    for (const g of rb.groups) {
      rollsOf(find(g.doughId) ?? extra.broetchen, rb.bakeDate).groups.push(g)
    }
    for (const s of rb.singles) {
      const key = `${s.itemId}|${rb.bakeDate}`
      const id = partDough.has(key) ? partDough.get(key) : undefined
      rollsOf(find(id) ?? extra.broetchen, rb.bakeDate).singles.push(s)
    }
  }
  const hefeBox = blocks.find((b) => b.box?.section === HEFETEIG_SECTION)
  for (const row of parts.hefeteig) {
    const id = itemDough.has(row.itemId) ? itemDough.get(row.itemId) : undefined
    ;(find(id) ?? hefeBox ?? extra.hefeteig).hefeteig.push(row)
  }
  for (const b of [...blocks, ...Object.values(extra)]) {
    b.rolls.sort((a, c) => a.bakeDate.localeCompare(c.bakeDate))
  }

  // Sammelblöcke hinter den letzten Block derselben Art.
  const has = (b: DoughPrintBlock) =>
    b.bread.length + b.rolls.length + b.hefeteig.length > 0
  const out = blocks.filter(has)
  const insertAfter = (
    block: DoughPrintBlock,
    like: (b: DoughPrintBlock) => boolean
  ) => {
    if (!has(block)) return
    let at = -1
    out.forEach((b, i) => {
      if (like(b)) at = i
    })
    out.splice(at + 1, 0, block)
  }
  insertAfter(extra.brot, (b) => b.bread.length > 0)
  insertAfter(extra.broetchen, (b) => b.rolls.length > 0 || b.bread.length > 0)
  insertAfter(extra.hefeteig, () => true)
  return out
}

function sammel(key: string, title: string): DoughPrintBlock {
  return { key, title, box: null, bread: [], rolls: [], hefeteig: [] }
}

/** Ein Block des Druckbilds - nie über einen Seitenumbruch geteilt. */
export type SheetBlock =
  /** „Teige heute“: Liter zuerst, ein Kasten je Zeile. */
  | { kind: 'doughs'; key: string; boxes: MachineBox[] }
  | { kind: 'dough'; key: string; block: DoughPrintBlock }
  /**
   * Übriger Abschnitt. Nur ein Abschnitt, der allein höher als ein Blatt
   * ist, wird geteilt - das Stück auf dem nächsten Blatt heißt „… (Forts.)“.
   */
  | {
      kind: 'section'
      key: string
      section: BackzettelSection
      lines: BackzettelLine[]
      continued: boolean
    }
  /** Kein Teig heute (Sonntag): Hinweis auf die Backliste. */
  | { kind: 'empty'; key: string }
  | { kind: 'deltas'; key: string }
  /** „Hinweise“ und „Offen: …“. */
  | { kind: 'footnotes'; key: string }

/** Alle Blöcke in Druckreihenfolge (ohne Kopf und Notizzeilen). */
export function sheetBlocks(
  day: BackzettelDay,
  parts: DayPrintParts = dayPrintParts(day)
): SheetBlock[] {
  const out: SheetBlock[] = []
  const boxes = day.machine ?? []
  if (boxes.length > 0) out.push({ kind: 'doughs', key: 'doughs', boxes })
  for (const block of doughPrintBlocks(day, parts)) {
    out.push({ kind: 'dough', key: `dough-${block.key}`, block })
  }
  for (const section of parts.others) {
    out.push({
      kind: 'section',
      key: `section-${section.id}`,
      section,
      lines: section.lines,
      continued: false,
    })
  }
  if (day.sections.length === 0) out.push({ kind: 'empty', key: 'empty' })
  if ((day.deltas ?? []).length > 0) out.push({ kind: 'deltas', key: 'deltas' })
  if (parts.hints.length + parts.open.length > 0) {
    out.push({ kind: 'footnotes', key: 'footnotes' })
  }
  return out
}

// ---------------------------------------------------------------------------
// Höhe und Verteilung auf Blätter

/**
 * Dichtestufe des Teigtag-Zettels: Grundschrift, Zeilenhöhe, Menge je Zeile
 * (`qtyPt`) und Literzahl (`bigPt`). Lesbar in der Backstube heißt: nie unter
 * 9 pt, Mengen mindestens 13 pt - lieber ein Blatt mehr (U8).
 */
export interface SheetStep extends PrintStep {
  qtyPt: number
}

/** Von luftig bis knapp; die letzte Stufe ist die dichteste. */
export const SHEET_STEPS: readonly SheetStep[] = [
  { fontPt: 11, rowMm: 7.6, qtyPt: 16, bigPt: 24 },
  { fontPt: 10, rowMm: 6.8, qtyPt: 14.5, bigPt: 21 },
  { fontPt: 9, rowMm: 6.0, qtyPt: 13, bigPt: 18 },
]

const PT_MM = 0.3528

/** Höhe einer Textzeile in mm bei `pt` Schriftgröße. */
function lineMm(pt: number, leading = 1.25): number {
  return pt * PT_MM * leading
}

/** Zeilen (Text), die ein Fließtext von `chars` Zeichen braucht. */
function textLines(chars: number, fontPt: number, widthMm = PAGE_WIDTH_MM) {
  // Arial: im Mittel gut ein halbes Geviert je Zeichen.
  const charMm = fontPt * PT_MM * 0.52
  const perLine = Math.max(12, Math.floor(widthMm / charMm))
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
      line.preorders > 0 ||
      line.cap > 0 ||
      (line.delta && line.delta.count > 0)
  )
}

/**
 * Ab so vielen Zeilen setzt ein übriger Abschnitt seine Zeilen in zwei
 * Spalten (Überschrift über beiden, die Zeilen nie ohne Überschrift).
 */
export const TWO_COLUMN_LINES = 6

/** Höhe des Kopfs von Blatt 1 (Wochentag groß, Tagestyp, Freigabe) in mm. */
export function firstHeaderMm(s: SheetStep): number {
  return lineMm(30, 1.1) + lineMm(s.fontPt * 1.35) + 4 + lineMm(s.fontPt) + 3
}

/** Höhe des Kopfs ab Blatt 2 („Samstag, 28.11.2026 – Blatt 2 von 3“) in mm. */
export function nextHeaderMm(s: SheetStep): number {
  return lineMm(s.fontPt * 1.35) + 5
}

/** Überschrift eines Blocks (fett, mit Strich) in mm. */
function blockHeadMm(s: SheetStep): number {
  return lineMm(s.fontPt * 1.35) + 4
}

/** Eine Tabellen-/Listenzeile mit großer Menge in mm. */
function qtyRowMm(s: SheetStep): number {
  return Math.max(s.rowMm, lineMm(s.qtyPt, 1.1) + 1.2)
}

/** Die kleine zweite Zeile unter einem Namen in mm. */
function detailMm(s: SheetStep): number {
  return lineMm(s.fontPt * 0.85)
}

/**
 * Eine Zeile mit großer Menge, Name und `sub` kleinen Zeilen darunter
 * (Aufteilung, Hinweis, Angaben): so hoch wie die höhere der beiden Spalten.
 * Gemessen mit `page.pdf()` (U8): Name + kleine Zeilen + Rand 0,8 mm.
 */
function stackMm(s: SheetStep, sub: number): number {
  return Math.max(qtyRowMm(s), lineMm(s.fontPt) + sub * detailMm(s) + 0.8)
}

/** Höhe eines Bruch- oder Einzelstück-Eintrags (mit Aufteilung darunter). */
function rollRowsMm(
  r: RollsForDay,
  s: SheetStep,
  lineByKey: Map<string, BackzettelLine>
): number {
  let h = lineMm(s.fontPt) + 2 // „für Sonntag, 29.11.“
  // Name und Aufteilung stehen in einer Spalte von gut 100 mm; eine lange
  // Aufteilung (Stern-Gruppe) bricht um. Zusatzzeilen (Hinweis je Posten,
  // später z. B. Körner je Bruch) zählen als weitere kleine Zeile.
  for (const g of r.groups) {
    const chars =
      g.split.reduce((n, x) => n + x.name.length + 6, 0) +
      g.missing.length * 30 +
      12
    const hints = new Set(
      g.split.map((x) => lineByKey.get(x.key)?.hint).filter(Boolean)
    ).size
    h += stackMm(s, textLines(chars, s.fontPt * 0.85, 100) + hints)
  }
  for (const x of r.singles) {
    const sub =
      (x.pieces === null || x.baseUnset ? 1 : 0) +
      (lineByKey.get(x.key)?.hint ? 1 : 0)
    h += stackMm(s, sub)
  }
  return h
}

/** Kleine Zeilen unter dem Namen: Hinweis (fett) und Angaben je eine. */
function lineSubRows(line: BackzettelLine): number {
  return (
    (line.hint ? 1 : 0) + (hasPrintDetail({ ...line, hint: undefined }) ? 1 : 0)
  )
}

/** Höhe eines Hefeteig-Postens: Name und je Sorte eine Zeile. */
function hefeteigItemMm(row: HefeteigPrintRow, s: SheetStep): number {
  const variants = row.lines.length > 1 || !!row.lines[0]?.variant
  return (
    (variants ? lineMm(s.fontPt) + 1.5 : 0) +
    row.lines.reduce((h, l) => h + stackMm(s, lineSubRows(l)), 0)
  )
}

/**
 * Zwei Spalten: Höhe der höheren, Einträge bleiben ganz. Chrome verteilt
 * nicht immer optimal - eine halbe Zeile Reserve.
 */
function twoColumnsMm(heights: number[], s: SheetStep): number {
  if (heights.length === 0) return 0
  const total = heights.reduce((a, b) => a + b, 0)
  let best = total
  let left = 0
  for (const h of heights) {
    left += h
    best = Math.min(best, Math.max(left, total - left))
  }
  return best + (heights.length > 1 ? s.rowMm / 2 : 0)
}

/** Zeilen eines Tages nach Schlüssel (für Hinweise an Brot und Brötchen). */
function linesByKeyOf(day: BackzettelDay): Map<string, BackzettelLine> {
  return new Map(day.sections.flatMap((x) => x.lines).map((l) => [l.key, l]))
}

/** Ob eine Brot-Zeile einen Hinweis (Zukauf, `note`) trägt. */
function breadHasHint(
  row: BreadRow,
  lineByKey: Map<string, BackzettelLine>
): boolean {
  return [row.single, ...Object.values(row.cells)].some(
    (c) => !!c && !!lineByKey.get(c.key)?.hint
  )
}

/** Geschätzte Höhe eines Blocks in mm (eher zu groß). */
export function blockHeightMm(
  block: SheetBlock,
  day: BackzettelDay,
  parts: DayPrintParts,
  s: SheetStep
): number {
  const gap = 3
  switch (block.kind) {
    case 'doughs': {
      let h = blockHeadMm(s) + lineMm(s.fontPt * 0.85) + 1.5
      for (const box of block.boxes) {
        // Literzahl groß; darunter der Grund, wenn sie unbekannt ist. Links
        // je Zugabe eine kleine Zeile unter dem Namen.
        const right =
          lineMm(s.bigPt, 1.1) + 0.8 + (box.liters.reason ? detailMm(s) : 0)
        const left = lineMm(s.fontPt) + box.addons.length * detailMm(s) + 0.8
        h += Math.max(right, left, s.rowMm)
      }
      return h + gap
    }
    case 'dough': {
      const b = block.block
      const lineByKey = linesByKeyOf(day)
      let h = blockHeadMm(s)
      if (b.hefeteig.length > 0 && (day.hefeteig?.doughs ?? []).length > 0) {
        h += lineMm(s.fontPt * 0.85) + 1 // „Testhefe: 12 Teigstücke · 6,6 kg“
      }
      if (b.bread.length > 0) {
        h += lineMm(s.fontPt * 0.85) + 1.5
        for (const r of b.bread) {
          const sub =
            (r.note ? 1 : 0) +
            (!r.complete || r.single?.baseUnset ? 1 : 0) +
            (breadHasHint(r, lineByKey) ? 1 : 0)
          h += stackMm(s, sub)
        }
      }
      for (const r of b.rolls) h += rollRowsMm(r, s, lineByKey)
      if (b.hefeteig.length > 0) {
        h += twoColumnsMm(
          b.hefeteig.map((row) => hefeteigItemMm(row, s)),
          s
        )
      }
      return h + gap
    }
    case 'section': {
      const rows = block.lines.map((l) => stackMm(s, lineSubRows(l)))
      const body =
        block.lines.length >= TWO_COLUMN_LINES
          ? twoColumnsMm(rows, s)
          : rows.reduce((a, b) => a + b, 0)
      return blockHeadMm(s) + body + gap
    }
    case 'empty':
      return s.rowMm * 2 + gap
    case 'deltas': {
      const keys = new Set((day.deltas ?? []).map((d) => d.key)).size
      const doughChars = deltaDoughLines(day).join('; ').length
      return (
        blockHeadMm(s) +
        Math.ceil(keys / 2) * qtyRowMm(s) +
        (doughChars > 0
          ? textLines(doughChars + 30, s.fontPt * 0.85) * detailMm(s) + 1
          : 0) +
        gap
      )
    }
    case 'footnotes': {
      const small = s.fontPt * 0.9
      const hintChars = parts.hints.join('; ').length
      const openChars = parts.open.join('; ').length
      return (
        (hintChars ? textLines(hintChars + 12, small) * lineMm(small) + 1 : 0) +
        (openChars ? textLines(openChars + 8, small) * lineMm(small) + 1 : 0) +
        gap
      )
    }
  }
}

/** Ein Blatt des Druckbilds. */
export interface DaySheet {
  blocks: SheetBlock[]
  /** Geschätzte Höhe in mm (Kopf, Blöcke, auf dem letzten die Notizen). */
  estimatedMm: number
}

export interface DayPrintLayout extends SheetStep {
  /** Index in `SHEET_STEPS` (0 = luftig). */
  step: number
  /** Mindestens ein Blatt; Blöcke werden nie zwischen zwei Blättern geteilt. */
  sheets: DaySheet[]
  /** Notizzeilen am Ende des letzten Blatts (0 … `NOTE_LINES`). */
  noteLines: number
}

/** So viele Zeilen stehen mindestens unter einer Überschrift (geteilter Abschnitt). */
export const MIN_SPLIT_LINES = 3

/** Verteilt die Blöcke bei einer Stufe auf Blätter. */
export function packSheets(
  day: BackzettelDay,
  parts: DayPrintParts,
  blocks: SheetBlock[],
  s: SheetStep
): { sheets: DaySheet[]; noteLines: number } {
  const sheets: DaySheet[] = [{ blocks: [], estimatedMm: firstHeaderMm(s) }]
  const cur = () => sheets[sheets.length - 1]
  const room = () => PAGE_HEIGHT_MM - cur().estimatedMm
  const fresh = PAGE_HEIGHT_MM - nextHeaderMm(s)
  const next = () => sheets.push({ blocks: [], estimatedMm: nextHeaderMm(s) })
  const add = (b: SheetBlock, h: number) => {
    cur().blocks.push(b)
    cur().estimatedMm += h
  }
  const height = (b: SheetBlock) => blockHeightMm(b, day, parts, s)

  for (const block of blocks) {
    const h = height(block)
    if (h <= room()) {
      add(block, h)
      continue
    }
    if (block.kind === 'section' && h > fresh) {
      // Ein Abschnitt höher als ein Blatt: Stück für Stück, jedes mit
      // Überschrift („… (Forts.)“) und mindestens MIN_SPLIT_LINES Zeilen.
      let rest = block.lines
      let continued = block.continued
      while (rest.length > 0) {
        let take = 0
        while (take < rest.length) {
          const chunk = { ...block, lines: rest.slice(0, take + 1), continued }
          if (height(chunk) > room()) break
          take++
        }
        if (take < Math.min(MIN_SPLIT_LINES, rest.length)) {
          if (cur().blocks.length > 0) {
            next()
            continue
          }
          take = Math.max(1, take)
        }
        const chunk: SheetBlock = {
          ...block,
          key: continued ? `${block.key}-forts-${sheets.length}` : block.key,
          lines: rest.slice(0, take),
          continued,
        }
        add(chunk, height(chunk))
        rest = rest.slice(take)
        continued = true
        if (rest.length > 0) next()
      }
      continue
    }
    if (cur().blocks.length > 0) next()
    // Passt ein Block (Teig) allein nicht auf ein Blatt, steht er trotzdem
    // ganz da; der Browser bricht dann zwischen Zeilen um.
    add(block, h)
  }

  const noteHead = lineMm(SHEET_STEPS[0].fontPt) + 1
  const noteLines = Math.max(
    0,
    Math.min(NOTE_LINES, Math.floor((room() - noteHead) / NOTE_LINE_MM))
  )
  if (noteLines > 0) cur().estimatedMm += noteHead + noteLines * NOTE_LINE_MM
  for (const sheet of sheets) sheet.estimatedMm = Math.round(sheet.estimatedMm)
  return { sheets, noteLines }
}

/**
 * Druckbild eines Teigtag-Zettels: so wenige Blätter wie möglich bei
 * lesbarer Schrift (`SHEET_STEPS`, nie unter 9 pt), bei gleicher Blattzahl
 * die luftigste Stufe. Ein Block (Teig, Abschnitt, Nachträge) wird nie
 * zwischen zwei Blättern geteilt; der volle Samstag geht so auf zwei bis drei
 * Blätter, die Grenze liegt zwischen zwei Teigen - wie beim alten
 * Samstags-Satz, ein Blatt je Station.
 */
export function dayPrintLayout(day: BackzettelDay): DayPrintLayout {
  const parts = dayPrintParts(day)
  const blocks = sheetBlocks(day, parts)
  let best: DayPrintLayout | null = null
  SHEET_STEPS.forEach((s, step) => {
    const packed = packSheets(day, parts, blocks, s)
    if (!best || packed.sheets.length < best.sheets.length) {
      best = { ...s, step, ...packed }
    }
  })
  return best as unknown as DayPrintLayout
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
      s.fontPt * PT_MM * 1.6 +
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
