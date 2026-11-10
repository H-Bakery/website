'use client'

import React from 'react'
import { GlobalStyles } from '@mui/material'
import {
  deltaTotalsByKey,
  type BackzettelConfigData,
  type BackzettelDay,
  type BackzettelLine,
  type BackzettelUnit,
  type BreadCell,
  type BreadRow,
  type DoughLiters,
  type MachineBox,
} from '../../lib/backzettelApi'
import {
  addonText,
  bakeDayLabel,
  bruchAddonsText,
  bruchCountText,
  bruchSpareText,
  bruchSplitText,
  deltaDoughLines,
  formatDate,
  formatDateLong,
  dayKindLine,
  formatFactor,
  formatKnownGrams,
  formatNumber,
  formatQty,
  formatSignedQty,
  formatTimestamp,
  hefeteigPiecesText,
  kgText,
  lineLabel,
  linesByKey,
  litersLabel,
  minQtyText,
  previouslyDoneText,
  variantLabel,
  WEEKDAY_NAMES,
  isoWeekday,
} from '../../lib/backzettelFormat'
import {
  NOTE_LINE_MM,
  PAGE_MARGIN_MM,
  TWO_COLUMN_LINES,
  boxBakeDaysText,
  dayPrintLayout,
  dayPrintParts,
  sheetDayTypeText,
  type DayPrintParts,
  type DoughPrintBlock,
  type HefeteigPrintRow,
  type RollsForDay,
  type SheetBlock,
} from '../../lib/dayPrintLayout'
import {
  groupDeltasForPrint,
  initials,
  printDeltaFigure,
  printLineDeltaNote,
} from './BackzettelPrint'
import { BackzettelPrintExtras } from './BackzettelPrintExtras'

/**
 * Druckregeln des Teigtag-Zettels. Ergänzen `backzettelPrintStyles` (die
 * blenden App-Hülle und `.bz-screen` aus und `.bz-print` ein); Schrift,
 * Zeilenhöhe und Zahlengröße kommen als CSS-Variablen aus `dayPrintLayout`.
 * Schwarz auf weiß: keine Flächen, nur Striche und Schriftstärke - druckt
 * auf jedem Laserdrucker gleich.
 */
const doughDayPrintStyles = (
  <GlobalStyles
    styles={{
      '@media print': {
        '@page': { size: 'A4', margin: `${PAGE_MARGIN_MM}mm` },
        '.dd-print .dd-sheet': {
          fontSize: 'var(--dd-font) !important',
          lineHeight: '1.25 !important',
        },
        '.dd-print .dd-sheet.bz-break': { breakBefore: 'page' },
        // Kopf von Blatt 1: Wochentag groß, Datum, Stempel.
        '.dd-print .dd-head': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '4mm',
        },
        '.dd-print .dd-title': {
          display: 'flex',
          alignItems: 'baseline',
          gap: '4mm',
          // Wochentag und Datum bleiben in einer Zeile; der Stempel bricht um.
          whiteSpace: 'nowrap',
          margin: 0,
          lineHeight: 1.1,
        },
        '.dd-print .dd-weekday': { fontSize: '30pt', fontWeight: 800 },
        '.dd-print .dd-date': { fontSize: '20pt', fontWeight: 700 },
        '.dd-print .dd-stamp': {
          border: '2pt solid #000',
          padding: '1mm 3mm',
          fontWeight: 800,
          fontSize: 'calc(var(--dd-font) * 1.2)',
          maxWidth: '62mm',
          textAlign: 'center',
          lineHeight: 1.2,
        },
        '.dd-print .dd-stamp.draft': { borderStyle: 'dashed' },
        // Tagestyp: gerahmt, groß - hier setzt der Kalender (U9) später
        // „vor Feiertag“ o. Ä. davor.
        '.dd-print .dd-daytype': {
          border: '1.5pt solid #000',
          padding: '0.8mm 2.5mm',
          margin: '2mm 0 1mm',
          fontSize: 'calc(var(--dd-font) * 1.35)',
          fontWeight: 700,
        },
        '.dd-print .dd-meta': { margin: '0 0 1mm' },
        // Kopf ab Blatt 2.
        '.dd-print .dd-head-next': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 'calc(var(--dd-font) * 1.35)',
          fontWeight: 700,
          borderBottom: '0.5pt solid #000',
          paddingBottom: '1mm',
          marginBottom: '1mm',
        },
        // Ein Block (Teig, Abschnitt, Nachträge) bleibt auf einem Blatt.
        '.dd-print .dd-block': {
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          marginTop: '3mm',
        },
        '.dd-print .dd-block-head': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '3mm',
          fontSize: 'calc(var(--dd-font) * 1.35)',
          fontWeight: 800,
          margin: '0 0 1mm',
          paddingBottom: '0.5mm',
          borderBottom: '2pt solid #000',
          breakAfter: 'avoid',
        },
        '.dd-print .dd-block-fig': {
          fontWeight: 700,
          whiteSpace: 'nowrap',
        },
        '.dd-print .dd-block-sub': { margin: '0 0 1mm' },
        '.dd-print h3.dd-day': {
          fontSize: 'var(--dd-font)',
          fontWeight: 800,
          margin: '1.5mm 0 0',
          textDecoration: 'underline',
        },
        '.dd-print table': {
          width: 'calc(100% - 1pt)',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        },
        '.dd-print th, .dd-print td': {
          borderBottom: '0.5pt solid #777',
          padding: '0.3mm 1.2mm',
          height: 'var(--dd-row)',
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        '.dd-print th': {
          fontSize: 'calc(var(--dd-font) * 0.85)',
          fontWeight: 700,
          height: 'auto',
        },
        '.dd-print .num': { textAlign: 'right', whiteSpace: 'nowrap' },
        // Die Menge: groß und fett, rechtsbündig.
        '.dd-print .qty': {
          fontSize: 'var(--dd-qty)',
          fontWeight: 800,
          lineHeight: 1.1,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        },
        '.dd-print .big': {
          fontSize: 'var(--dd-big)',
          fontWeight: 800,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        },
        '.dd-print .small, .dd-print .dd-sub': {
          fontSize: 'calc(var(--dd-font) * 0.85)',
        },
        '.dd-print .dd-sub': { display: 'block', lineHeight: 1.2 },
        '.dd-print .dd-hint': { fontWeight: 800 },
        '.dd-print .muted': { fontStyle: 'italic' },
        '.dd-print col.c-qty': { width: '24mm' },
        '.dd-print col.c-g': { width: '22mm' },
        '.dd-print col.c-tick': { width: '9mm' },
        '.dd-print col.c-size': { width: '17mm' },
        '.dd-print col.c-kg': { width: '18mm' },
        '.dd-print col.c-liters': { width: '30mm' },
        '.dd-print col.c-days': { width: '30mm' },
        '.dd-print col.c-batches': { width: '20mm' },
        '.dd-print td.tick, .dd-print th.tick': { textAlign: 'center' },
        '.dd-print .box': {
          display: 'inline-block',
          width: '5mm',
          height: '5mm',
          border: '1.2pt solid #000',
          verticalAlign: 'middle',
          lineHeight: '5mm',
          textAlign: 'center',
          fontWeight: 800,
        },
        '.dd-print .dd-initials': { display: 'block', lineHeight: 1 },
        '.dd-print tr.incomplete td': { borderBottomStyle: 'dashed' },
        // Listen (übrige Abschnitte, Hefeteig, Nachträge): Zeile = Menge |
        // Name | Kästchen; ab TWO_COLUMN_LINES Zeilen zwei Spalten unter
        // derselben Überschrift.
        '.dd-print .dd-list.two': { columnCount: 2, columnGap: '6mm' },
        '.dd-print .dd-row': {
          display: 'flex',
          alignItems: 'center',
          gap: '2mm',
          minHeight: 'var(--dd-row)',
          borderBottom: '0.5pt solid #777',
          breakInside: 'avoid',
        },
        '.dd-print .dd-row .qty': { flex: '0 0 18mm' },
        '.dd-print .dd-row .dd-name': { flex: '1 1 auto', minWidth: 0 },
        '.dd-print .dd-row .tick': { flex: '0 0 7mm', textAlign: 'center' },
        '.dd-print .dd-hefe-item': { breakInside: 'avoid' },
        '.dd-print .dd-hefe-name': {
          fontWeight: 800,
          margin: '1mm 0 0',
          borderBottom: '0.5pt solid #777',
        },
        '.dd-print .dd-hefe-item .dd-row.variant .dd-name': {
          paddingLeft: '2mm',
        },
        '.dd-print .dd-foot': { margin: '1mm 0' },
        '.dd-print .dd-note-line': {
          borderBottom: '0.5pt solid #000',
          height: `${NOTE_LINE_MM}mm`,
        },
      },
    }}
  />
)

/** Liter im Druck: unbekannt ist „–“, ohne Rundung die genauen Liter. */
export function printLiters(liters: DoughLiters | null | undefined): {
  text: string
  hint: string | null
} {
  if (!liters || liters.exact === null) {
    return {
      text: '–',
      hint:
        liters?.reason === 'kg_per_liter_unknown'
          ? 'Liter unbekannt (kg je Liter offen)'
          : liters?.reason === 'dough_incomplete'
          ? 'Liter unbekannt (Teig unvollständig)'
          : 'Liter unbekannt',
    }
  }
  if (liters.rounded === null) {
    return { text: `${formatNumber(liters.exact)} L`, hint: 'Rundung offen' }
  }
  return { text: `${formatNumber(liters.rounded)} L`, hint: null }
}

/** kg im Druck: „12,4 kg“, „≥ 12,4 kg“ oder „– kg“. */
export function printKg(d: Parameters<typeof kgText>[0]): string {
  const text = kgText(d)
  return text === 'unbekannt' ? '– kg' : text
}

/** Chargen im Druck: „2 Chargen“, „1 Charge“ oder „–“. */
function batchesText(box: MachineBox): string {
  if (box.batches === null || box.batches === undefined) return '–'
  return `${formatNumber(box.batches)} ${
    box.batches === 1 ? 'Charge' : 'Chargen'
  }`
}

function Tick({ lines }: { lines: (BackzettelLine | undefined)[] }) {
  const relevant = lines.filter((l): l is BackzettelLine => !!l)
  const done = relevant.length > 0 && relevant.every((l) => !!l.doneAt)
  if (!done) return <span className="box" />
  const by = relevant.find((l) => l.doneBy)?.doneBy
  // Kürzel unter dem Kästchen, nicht darin.
  return (
    <span data-testid="dd-done">
      <span className="box">✓</span>
      {by ? (
        <span className="small dd-initials">{initials(by.displayName)}</span>
      ) : null}
    </span>
  )
}

/** Hinweis des Postens („Zukauf – auflegen · mit Käse bestreuen“), fett. */
function Hint({ line }: { line: BackzettelLine | undefined }) {
  if (!line?.hint) return null
  return (
    <strong className="dd-sub dd-hint" data-testid={`dd-hint-${line.key}`}>
      {line.hint}
    </strong>
  )
}

// ---------------------------------------------------------------- Kopf

function FirstHeader({
  day,
  sheetCount,
}: {
  day: BackzettelDay
  sheetCount: number
}) {
  const confirmed = day.status === 'confirmed'
  return (
    <>
      <div className="dd-head">
        <h1 className="dd-title" data-testid="dd-title">
          <span className="dd-weekday">
            {WEEKDAY_NAMES[isoWeekday(day.date)]}
          </span>
          <span className="dd-date">{formatDate(day.date)}</span>
        </h1>
        <div
          className={confirmed ? 'dd-stamp' : 'dd-stamp draft'}
          data-testid="dd-stamp"
        >
          {confirmed ? 'FREIGEGEBEN' : 'ENTWURF – noch nicht freigegeben'}
        </div>
      </div>
      <div className="dd-daytype" data-testid="dd-daytype">
        {/* U9: Tagestyp aus dem Kalender, fett vor dem Teig-Hinweis */}
        {dayKindLine(day.dayKind) && (
          <strong className="dd-sub" data-testid="dd-day-kind">
            {dayKindLine(day.dayKind)}
          </strong>
        )}
        {sheetDayTypeText(day)}
      </div>
      <p className="dd-meta" data-testid="dd-meta">
        Backzettel
        {confirmed
          ? ` · freigegeben${
              day.confirmedBy ? ` von ${day.confirmedBy.displayName}` : ''
            }${
              day.confirmedAt ? ` am ${formatTimestamp(day.confirmedAt)}` : ''
            }`
          : ''}
        {` · Saisonfaktor ${formatFactor(day.seasonFactor)}`}
        {sheetCount > 1 ? ` · Blatt 1 von ${sheetCount}` : ''}
      </p>
    </>
  )
}

function NextHeader({
  day,
  index,
  sheetCount,
}: {
  day: BackzettelDay
  index: number
  sheetCount: number
}) {
  const confirmed = day.status === 'confirmed'
  return (
    <div className="dd-head-next">
      <span>
        {formatDateLong(day.date)} – Blatt {index + 1} von {sheetCount}
      </span>
      {!confirmed && <span className="dd-stamp draft small">ENTWURF</span>}
    </div>
  )
}

// ---------------------------------------------------------------- Teige

/** „Teige heute“: Liter zuerst, groß - die Reihenfolge ist die der Blöcke. */
function DoughsPrint({
  day,
  boxes,
}: {
  day: BackzettelDay
  boxes: MachineBox[]
}) {
  return (
    <div className="dd-block" data-testid="dd-machine">
      <h2 className="dd-block-head">
        <span>Teige heute</span>
        <span className="dd-block-fig small">angesetzt ✓</span>
      </h2>
      <table>
        <colgroup>
          <col />
          <col className="c-liters" />
          <col className="c-kg" />
          <col className="c-batches" />
          <col className="c-days" />
          <col className="c-tick" />
        </colgroup>
        <thead>
          <tr>
            <th>Teig</th>
            <th className="num">Liter</th>
            <th className="num">kg</th>
            <th className="num">Chargen</th>
            <th>für</th>
            <th className="tick">✓</th>
          </tr>
        </thead>
        <tbody>
          {boxes.map((box) => {
            const id = box.id ?? 'offen'
            const liters = printLiters(box.liters)
            return (
              <tr
                key={id}
                className={box.complete ? undefined : 'incomplete'}
                data-testid={`dd-machine-${id}`}
              >
                <td>
                  <strong>{box.name}</strong>
                  {box.addons.map((addon) => {
                    const a = addonText(addon)
                    return (
                      <span key={addon.id} className="dd-sub">
                        + {a.text.replace(': unbekannt', ' –')}
                        {a.hint ? ` (${a.hint})` : ''}
                      </span>
                    )
                  })}
                </td>
                <td className="num">
                  {litersLabel(box) !== 'Liter' && (
                    <span className="small">{litersLabel(box)} </span>
                  )}
                  <span className="big" data-testid={`dd-liters-${id}`}>
                    {liters.text}
                  </span>
                  {liters.hint && <span className="dd-sub">{liters.hint}</span>}
                </td>
                <td className="num">{printKg(box)}</td>
                <td className="num">{batchesText(box)}</td>
                <td className="small">{boxBakeDaysText(day, box)}</td>
                <td className="tick">
                  <span className="box" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Alte Posten ohne Größen (Spezialbrot nach Liter oder Charge): immer mit
 * Einheit („16 Stück“, „1,12 Charge“); Grundmenge offen „≥ 4 Stück“ bzw.
 * „offen“ (`minQtyText`).
 */
function singleQty(cell: BreadCell & { unit: BackzettelUnit }): string {
  const text = minQtyText(cell, cell.unit)
  if (text === 'offen') return text
  return formatQty(cell.total, cell.unit) === formatNumber(cell.total)
    ? `${text} ${cell.unit || 'Stück'}`
    : text
}

/** Kleine Angaben einer Brot-Zeile: offen, Hinweis, Korrekturen. */
function breadDetails(
  row: BreadRow,
  sizes: { id: string; label: string }[],
  lineByKey: Map<string, BackzettelLine>
): string[] {
  const out: string[] = []
  if (row.single?.baseUnset) out.push('Grundmenge offen')
  const open = sizes.filter((sz) => row.cells[sz.id]?.baseUnset)
  if (open.length > 0) {
    out.push(`Grundmenge offen: ${open.map((sz) => sz.label).join(', ')}`)
  }
  if (row.note) out.push(row.note)
  // Korrektur mit Grund je Zelle - wie am Bildschirm (BreadTable).
  const cells: { label: string | null; key: string }[] = []
  if (row.single) cells.push({ label: null, key: row.single.key })
  for (const sz of sizes) {
    const cell = row.cells[sz.id]
    if (cell) cells.push({ label: sz.label, key: cell.key })
  }
  for (const c of cells) {
    const line = lineByKey.get(c.key)
    if (!line || !line.correction) continue
    out.push(
      `${c.label ? `${c.label}: ` : ''}Korr. ${formatSignedQty(
        line.correction,
        line.unit
      )}${line.correctionReason ? ` (${line.correctionReason})` : ''}`
    )
  }
  return out
}

function BreadTable({
  day,
  rows,
  lineByKey,
}: {
  day: BackzettelDay
  rows: BreadRow[]
  lineByKey: Map<string, BackzettelLine>
}) {
  // Nur die Größen, die in diesem Block vorkommen.
  const sizes = (day.bread?.sizes ?? []).filter((sz) =>
    rows.some((r) => r.cells[sz.id])
  )
  const withSingle = rows.some((r) => r.single)
  const withKg = rows.some((r) => !(r.complete && r.kg === null))
  const cellLines = (row: BreadRow) =>
    [row.single, ...sizes.map((sz) => row.cells[sz.id] ?? null)]
      .filter((c): c is NonNullable<typeof c> => !!c)
      .filter((c) => c.total > 0)
      .map((c) => lineByKey.get(c.key))
  return (
    <table data-testid="dd-bread">
      <colgroup>
        <col />
        {withSingle && <col className="c-qty" />}
        {sizes.map((sz) => (
          <col key={sz.id} className="c-size" />
        ))}
        {withKg && <col className="c-kg" />}
        <col className="c-tick" />
      </colgroup>
      <thead>
        <tr>
          <th>Brot</th>
          {withSingle && <th className="num">Menge</th>}
          {sizes.map((sz) => (
            <th key={sz.id} className="num">
              {sz.label}
            </th>
          ))}
          {withKg && <th className="num">Teig</th>}
          <th className="tick">✓</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const details = breadDetails(row, sizes, lineByKey)
          const hintLine = [row.single, ...Object.values(row.cells)]
            .filter((c): c is NonNullable<typeof c> => !!c)
            .map((c) => lineByKey.get(c.key))
            .find((l) => l?.hint)
          return (
            <tr
              key={`${row.itemId}|${row.bakeDate}`}
              data-testid={`dd-bread-row-${row.itemId}|${row.bakeDate}`}
            >
              <td>
                <strong>{row.name}</strong>
                {row.bakeDate !== day.date && (
                  <span className="small">
                    {' '}
                    · {bakeDayLabel(row.bakeDate, day.date)}
                  </span>
                )}
                <Hint line={hintLine} />
                {details.length > 0 && (
                  <span
                    className="dd-sub"
                    data-testid={`dd-bread-detail-${row.itemId}|${row.bakeDate}`}
                  >
                    {details.join(' · ')}
                  </span>
                )}
              </td>
              {withSingle && (
                <td
                  className="qty"
                  data-testid={
                    row.single ? `dd-bread-${row.single.key}` : undefined
                  }
                >
                  {row.single ? singleQty(row.single) : ''}
                </td>
              )}
              {sizes.map((sz) => {
                const cell = row.cells[sz.id]
                return (
                  <td
                    key={sz.id}
                    className="qty"
                    data-testid={cell ? `dd-bread-${cell.key}` : undefined}
                  >
                    {!cell ? '' : minQtyText(cell)}
                  </td>
                )
              })}
              {withKg && (
                <td className="num small">
                  {row.complete && row.kg === null ? '' : printKg(row)}
                </td>
              )}
              <td className="tick">
                <Tick lines={cellLines(row)} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Brötchen eines Teigs für einen Backtag: Brüche × Gewicht, Aufteilung. */
function RollsTable({
  rolls,
  sheetDate,
  blockKey,
  lineByKey,
}: {
  rolls: RollsForDay
  sheetDate: string
  blockKey: string
  lineByKey: Map<string, BackzettelLine>
}) {
  return (
    <div data-testid={`dd-rolls-${blockKey}-${rolls.bakeDate}`}>
      <h3 className="dd-day">{bakeDayLabel(rolls.bakeDate, sheetDate)}</h3>
      <table>
        <colgroup>
          <col className="c-qty" />
          <col className="c-g" />
          <col />
          <col className="c-tick" />
        </colgroup>
        <tbody>
          {rolls.groups.map((g) => {
            const split = `${bruchSplitText(g, lineByKey)}${
              g.spare !== null && g.spare > 0 ? bruchSpareText(g) : ''
            }`
            const hints = Array.from(
              new Set(
                g.split
                  .map((s) => lineByKey.get(s.key)?.hint)
                  .filter((h): h is string => !!h)
              )
            )
            return (
              <tr
                key={g.key}
                className={g.complete ? undefined : 'incomplete'}
                data-testid={`dd-bruch-${g.key}`}
              >
                <td className="qty">{bruchCountText(g)}</td>
                <td className="num">
                  × {g.g === null ? '– g' : `${formatNumber(g.g)} g`}
                </td>
                <td>
                  <strong>{g.name}</strong>
                  {bruchAddonsText(g) && (
                    <strong
                      className="dd-sub dd-hint"
                      data-testid="dd-bruch-addons"
                    >
                      {bruchAddonsText(g)}
                    </strong>
                  )}
                  <span className="dd-sub">{split}</span>
                  {hints.map((h) => (
                    <strong key={h} className="dd-sub dd-hint">
                      {h}
                    </strong>
                  ))}
                </td>
                <td className="tick">
                  <Tick lines={g.split.map((s) => lineByKey.get(s.key))} />
                </td>
              </tr>
            )
          })}
          {rolls.singles.map((s) => {
            const line = lineByKey.get(s.key)
            const detail = [
              s.pieces === null ? 'Teigstücke offen' : null,
              s.baseUnset ? 'Grundmenge offen' : null,
            ].filter(Boolean)
            return (
              <tr key={s.key} data-testid={`dd-single-${s.key}`}>
                <td className="qty">{minQtyText(s)}</td>
                <td className="num">
                  {s.piece_g === null
                    ? 'g offen'
                    : `je ${formatNumber(s.piece_g)} g`}
                </td>
                <td>
                  <strong>{s.name}</strong>
                  <Hint line={line} />
                  {detail.length > 0 && (
                    <span className="dd-sub">{detail.join(' · ')}</span>
                  )}
                </td>
                <td className="tick">
                  <Tick lines={[line]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function hefeVariantName(
  l: BackzettelLine,
  config: BackzettelConfigData | null
): string {
  if (!l.variant) return 'ohne Füllung'
  return (
    l.variantLabel || variantLabel(l.variant, config, l.itemId) || l.variant
  )
}

/** Hefeteig-Posten: gefüllte mit einer Zeile je Sorte, alle mit Kästchen. */
function HefeteigList({
  rows,
  config,
}: {
  rows: HefeteigPrintRow[]
  config: BackzettelConfigData | null
}) {
  return (
    <div className="dd-list two" data-testid="dd-hefeteig">
      {rows.map((row) => {
        const variants = row.lines.length > 1 || !!row.lines[0]?.variant
        return (
          <div
            key={row.itemId}
            className="dd-hefe-item"
            data-testid={`dd-hefe-${row.itemId}`}
          >
            {variants && <div className="dd-hefe-name">{row.name}</div>}
            {row.lines.map((l) => (
              <div
                key={l.key}
                className={variants ? 'dd-row variant' : 'dd-row'}
                data-testid={`dd-line-${l.key}`}
              >
                {/* Grundmenge offen: „≥ 3“ bzw. „offen“ - nie die nackte Vorbestellzahl */}
                <span className="qty">{minQtyText(l, l.unit)}</span>
                <span className="dd-name">
                  {variants ? (
                    hefeVariantName(l, config)
                  ) : (
                    <strong>{l.name}</strong>
                  )}
                  <Hint line={l} />
                  {lineDetail(l) && (
                    <span className="dd-sub">{lineDetail(l)}</span>
                  )}
                </span>
                <span className="tick">
                  <Tick lines={l.total > 0 ? [l] : []} />
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** Ein Teig: Kopf mit Litern, darunter alles, was aus ihm entsteht. */
function DoughBlockPrint({
  day,
  block,
  config,
  lineByKey,
}: {
  day: BackzettelDay
  block: DoughPrintBlock
  config: BackzettelConfigData | null
  lineByKey: Map<string, BackzettelLine>
}) {
  const box = block.box
  const liters = box ? printLiters(box.liters) : null
  const hefeDoughs =
    block.hefeteig.length > 0
      ? (day.hefeteig?.doughs ?? []).filter(
          (d) => !box || box.doughIds.includes(d.id)
        )
      : []
  return (
    <div className="dd-block" data-testid={`dd-dough-${block.key}`}>
      <h2 className="dd-block-head">
        <span>{block.title}</span>
        {box && liters && (
          <span
            className="dd-block-fig"
            data-testid={`dd-dough-fig-${block.key}`}
          >
            {/* Liter unbekannt: nur kg - der Grund steht oben bei „Teige heute“ */}
            {liters.text === '–'
              ? printKg(box)
              : `${litersLabel(box) !== 'Liter' ? `${litersLabel(box)} ` : ''}${
                  liters.text
                } · ${printKg(box)}`}
          </span>
        )}
      </h2>
      {hefeDoughs.length > 0 && (
        <p className="dd-block-sub small">
          {hefeDoughs
            .map(
              (d) =>
                `${d.name}: ${hefeteigPiecesText(d)} Teigstücke · ${
                  d.kg !== undefined
                    ? printKg({ kg: d.kg, kgKnown: d.kgKnown })
                    : formatKnownGrams(d.dough_g)
                }`
            )
            .join(' · ')}
        </p>
      )}
      {block.bread.length > 0 && (
        <BreadTable day={day} rows={block.bread} lineByKey={lineByKey} />
      )}
      {block.rolls.map((r) => (
        <RollsTable
          key={r.bakeDate}
          rolls={r}
          sheetDate={day.date}
          blockKey={block.key}
          lineByKey={lineByKey}
        />
      ))}
      {block.hefeteig.length > 0 && (
        <HefeteigList rows={block.hefeteig} config={config} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Abschnitte

function lineDetail(line: BackzettelLine): string {
  return [
    line.baseUnset ? 'Grundmenge offen' : null,
    line.preorders > 0
      ? `inkl. ${formatNumber(line.preorders)} vorbestellt`
      : null,
    line.cap > 0 ? `inkl. ${formatNumber(line.cap)} CAP` : null,
    line.tray,
    line.correctionReason ? `Korrektur: ${line.correctionReason}` : null,
    previouslyDoneText(line),
    line.delta && line.delta.count > 0
      ? printLineDeltaNote(line.delta, line.unit)
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Übriger Abschnitt: Menge groß links, Name, Hinweis fett, Kästchen. */
function SectionPrint({
  block,
  config,
}: {
  block: Extract<SheetBlock, { kind: 'section' }>
  config: BackzettelConfigData | null
}) {
  const { section, lines, continued } = block
  return (
    <div
      className="dd-block"
      data-testid={`dd-section-${section.id}${continued ? '-forts' : ''}`}
    >
      <h2 className="dd-block-head">
        <span>{continued ? `${section.label} (Forts.)` : section.label}</span>
      </h2>
      <div
        className={lines.length >= TWO_COLUMN_LINES ? 'dd-list two' : 'dd-list'}
      >
        {lines.map((line) => {
          const detail = lineDetail(line)
          return (
            <div
              key={line.key}
              className="dd-row"
              data-testid={`dd-line-${line.key}`}
            >
              <span className="qty">{minQtyText(line, line.unit)}</span>
              <span className="dd-name">
                <strong>{lineLabel(line, config)}</strong>
                <Hint line={line} />
                {detail && <span className="dd-sub">{detail}</span>}
              </span>
              <span className="tick">
                <Tick lines={[line]} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeltasPrint({
  day,
  config,
}: {
  day: BackzettelDay
  config: BackzettelConfigData | null
}) {
  const deltas = day.deltas ?? []
  if (deltas.length === 0) return null
  const groups = groupDeltasForPrint(deltas, deltaTotalsByKey(day))
  return (
    <div className="dd-block" data-testid="print-deltas">
      <h2 className="dd-block-head">
        <span>Nachträge seit der Freigabe</span>
        <span className="dd-block-fig small">nicht in den Mengen oben</span>
      </h2>
      <div className="dd-list two">
        {groups.map((g) => {
          const { shown, done, seen } = printDeltaFigure(g)
          return (
            <div
              key={g.key}
              className="dd-row"
              data-testid={`print-delta-${g.key}`}
            >
              <span className="qty">
                {shown === 0 ? '±0' : formatSignedQty(shown, g.first.unit)}
              </span>
              <span className="dd-name">
                <strong>
                  {lineLabel(
                    {
                      name: g.first.name,
                      variant: g.first.variant,
                      itemId: g.first.itemId,
                      bakeDate: g.first.bakeDate,
                      doughDate: day.date,
                    },
                    config
                  )}
                </strong>
                {(seen !== null || g.open === 0) && (
                  <span className="dd-sub">
                    {seen !== null
                      ? `noch offen, ${formatQty(
                          Math.abs(seen),
                          g.first.unit
                        )} schon gesehen`
                      : 'quittiert'}
                  </span>
                )}
              </span>
              <span className="tick">
                {done ? (
                  <span
                    className="box"
                    data-testid={`print-delta-done-${g.key}`}
                  >
                    ✓
                  </span>
                ) : (
                  <span className="box" />
                )}
              </span>
            </div>
          )
        })}
      </div>
      {deltaDoughLines(day).length > 0 && (
        <p className="small dd-foot" data-testid="print-delta-dough">
          <strong>Für Teig und Teilmaschine:</strong>{' '}
          {deltaDoughLines(day).join('; ')}.
        </p>
      )}
    </div>
  )
}

function Footnotes({ parts }: { parts: DayPrintParts }) {
  return (
    <div className="dd-block">
      {parts.hints.length > 0 && (
        <p className="dd-foot" data-testid="dd-hints">
          <strong>Hinweise:</strong> {parts.hints.join('; ')}.
        </p>
      )}
      {parts.open.length > 0 && (
        <p className="dd-foot small" data-testid="dd-open">
          <strong>Offen:</strong> {parts.open.join('; ')}.
        </p>
      )}
    </div>
  )
}

export interface DoughDayPrintProps {
  day: BackzettelDay
  config: BackzettelConfigData | null
  /** Abwiegeliste, Rezepte und Vorbereitung auf weiteren Blättern (O8). */
  withExtras?: boolean
}

/**
 * Druckbild eines Teigtag-Zettels (Z10, überarbeitet in U8/Z13), A4 hoch,
 * schwarz auf weiß, für die Backstube:
 *
 *   Kopf      Wochentag + Datum groß, Tagestyp gerahmt, Stempel
 *             ENTWURF/FREIGEGEBEN
 *   Teige     „Teige heute“: Liter zuerst (groß), kg, Chargen, Zugaben,
 *             für welche Backtage, Kästchen „angesetzt“
 *   je Teig   in Arbeitsreihenfolge (`doughs:` der YAML): Brot nach Größe,
 *             Brötchen je Backtag (Brüche × g, Aufteilung, „+n frei“),
 *             Hefeteig-Posten je Sorte - jede Zeile mit Kästchen
 *   übrige    Kaffeestückchen, Kuchen, Laugen …: Menge groß, Hinweis fett
 *   Schluss   Nachträge (nie in den Mengen), Hinweise, „Offen: …“, Notizen
 *
 * Kein Block wird über ein Blatt geteilt; reicht ein Blatt nicht (voller
 * Samstag), folgen weitere mit kurzem Kopf („Blatt 2 von 3“). Alle Zahlen
 * kommen vom Server; `dayPrintLayout` ordnet nur zu und schätzt die Höhe.
 */
export function DoughDayPrint({
  day,
  config,
  withExtras = false,
}: DoughDayPrintProps) {
  const layout = dayPrintLayout(day)
  const parts = dayPrintParts(day)
  const lineByKey = linesByKey(day.sections)
  const style = {
    '--dd-font': `${layout.fontPt}pt`,
    '--dd-row': `${layout.rowMm}mm`,
    '--dd-qty': `${layout.qtyPt}pt`,
    '--dd-big': `${layout.bigPt}pt`,
  } as React.CSSProperties
  const count = layout.sheets.length

  const renderBlock = (block: SheetBlock) => {
    switch (block.kind) {
      case 'doughs':
        return <DoughsPrint key={block.key} day={day} boxes={block.boxes} />
      case 'dough':
        return (
          <DoughBlockPrint
            key={block.key}
            day={day}
            block={block.block}
            config={config}
            lineByKey={lineByKey}
          />
        )
      case 'section':
        return <SectionPrint key={block.key} block={block} config={config} />
      case 'empty':
        return (
          <p key={block.key} className="dd-block" data-testid="dd-empty">
            Heute wird kein Teig gemacht – was gebacken wird, steht auf der
            Backliste.
          </p>
        )
      case 'deltas':
        return <DeltasPrint key={block.key} day={day} config={config} />
      case 'footnotes':
        return <Footnotes key={block.key} parts={parts} />
    }
  }

  return (
    <div
      className="bz-print dd-print"
      data-testid="bz-print"
      data-print-step={layout.step}
      data-print-sheets={count}
      aria-hidden="true"
      style={style}
    >
      {doughDayPrintStyles}
      {layout.sheets.map((sheet, i) => (
        <section
          key={i}
          className={i === 0 ? 'bz-page dd-sheet' : 'bz-page dd-sheet bz-break'}
          data-testid={i === 0 ? 'print-page-1' : `dd-sheet-${i + 1}`}
          data-print-estimate={sheet.estimatedMm}
        >
          {i === 0 ? (
            <FirstHeader day={day} sheetCount={count} />
          ) : (
            <NextHeader day={day} index={i} sheetCount={count} />
          )}
          {sheet.blocks.map(renderBlock)}
          {i === count - 1 && layout.noteLines > 0 && (
            <div className="dd-block" data-testid="dd-notes">
              <strong>Notizen</strong>
              {Array.from({ length: layout.noteLines }, (_, n) => (
                <div key={n} className="dd-note-line" />
              ))}
            </div>
          )}
        </section>
      ))}

      {withExtras && <BackzettelPrintExtras day={day} />}
    </div>
  )
}

export default DoughDayPrint
