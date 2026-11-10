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
  type RollsBlock,
} from '../../lib/backzettelApi'
import {
  addonText,
  bakeDayLabel,
  bruchCountText,
  bruchSpareText,
  bruchSplitText,
  doughsTodayText,
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
  deltaDoughLines,
} from '../../lib/backzettelFormat'
import {
  NOTE_LINE_MM,
  PAGE_MARGIN_MM,
  dayPrintLayout,
  dayPrintParts,
  printColumns,
  type HefeteigPrintRow,
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
 * blenden App-Hülle und `.bz-screen` aus und `.bz-print` ein); Schrift und
 * Zeilenhöhe kommen als CSS-Variablen aus `dayPrintLayout`.
 */
const doughDayPrintStyles = (
  <GlobalStyles
    styles={{
      '@media print': {
        // Etwas schmaler als der alte Tagesdruck (12 mm): ein Blatt.
        '@page': { size: 'A4', margin: `${PAGE_MARGIN_MM}mm` },
        '.dd-print': {
          fontSize: 'var(--dd-font) !important',
          lineHeight: '1.2 !important',
        },
        '.dd-print h1': { fontSize: 'calc(var(--dd-font) * 1.5)', margin: 0 },
        '.dd-print h2': {
          fontSize: 'calc(var(--dd-font) * 1.1)',
          margin: '1.8mm 0 0.6mm',
          borderBottom: '1.2pt solid #000',
          breakAfter: 'avoid',
        },
        '.dd-print h3': {
          fontSize: 'var(--dd-font)',
          margin: '0 0 0.5mm',
          fontWeight: 700,
        },
        '.dd-print .dd-head': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '4mm',
        },
        '.dd-print .dd-stamp': {
          border: '2pt solid #000',
          padding: '1mm 3mm',
          fontWeight: 700,
          fontSize: 'calc(var(--dd-font) * 1.2)',
          whiteSpace: 'nowrap',
        },
        '.dd-print .dd-stamp.draft': { borderStyle: 'dashed' },
        '.dd-print .meta': { margin: '0.5mm 0' },
        '.dd-print .small': { fontSize: 'calc(var(--dd-font) * 0.85)' },
        '.dd-print .muted': { fontStyle: 'italic' },
        '.dd-print table': {
          width: 'calc(100% - 1pt)',
          borderCollapse: 'collapse',
        },
        '.dd-print th, .dd-print td': {
          borderBottom: '0.5pt solid #777',
          padding: '0 1.2mm',
          height: 'var(--dd-row)',
          textAlign: 'left',
          verticalAlign: 'middle',
        },
        '.dd-print th': { fontSize: 'calc(var(--dd-font) * 0.85)' },
        '.dd-print .num': { textAlign: 'right', whiteSpace: 'nowrap' },
        '.dd-print .total': {
          fontSize: 'calc(var(--dd-font) * 1.25)',
          fontWeight: 700,
        },
        '.dd-print td.tick, .dd-print th.tick': {
          width: '7mm',
          textAlign: 'center',
        },
        '.dd-print .box': {
          display: 'inline-block',
          width: '4mm',
          height: '4mm',
          border: '1pt solid #000',
          verticalAlign: 'middle',
          lineHeight: '4mm',
          textAlign: 'center',
          fontWeight: 700,
        },
        // Maschine: ein Kasten je Teig, die Literzahl groß.
        '.dd-print .dd-machine': {
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '2mm',
          margin: '1.5mm 0',
        },
        '.dd-print .dd-box': {
          border: '1.5pt solid #000',
          padding: '1mm 1.5mm',
          breakInside: 'avoid',
        },
        '.dd-print .dd-box.incomplete': { borderStyle: 'dashed' },
        '.dd-print .dd-big': {
          fontSize: 'var(--dd-big)',
          fontWeight: 800,
          lineHeight: 1.1,
        },
        // Brötchen: je Backtag eine Spalte.
        '.dd-print .dd-rolls': {
          display: 'grid',
          gridTemplateColumns: 'repeat(var(--dd-roll-cols), minmax(0, 1fr))',
          gap: '3mm',
        },
        '.dd-print .dd-roll-col.today': {
          fontSize: 'calc(var(--dd-font) * 0.85)',
        },
        '.dd-print .dd-group': { borderBottom: '0.5pt solid #777' },
        '.dd-print .dd-group-row': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5mm',
          minHeight: 'var(--dd-row)',
        },
        // Hefeteig und Nachträge (ein Abschnitt): zwei CSS-Spalten.
        '.dd-print .dd-two': {
          columnCount: 2,
          columnGap: '5mm',
        },
        // Übrige Abschnitte: zwei feste Spalten, aufgeteilt von
        // `printColumns` - ein umbrechender Abschnitt bekommt rechts
        // „… (Forts.)“ statt Zeilen ohne Überschrift.
        '.dd-print .dd-others': {
          marginTop: '1.8mm',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: '5mm',
          alignItems: 'start',
        },
        '.dd-print .dd-section-head': {
          margin: '1mm 0 0',
          borderBottom: '1.2pt solid #000',
          breakAfter: 'avoid',
        },
        '.dd-print .dd-col > div:first-child > .dd-section-head': {
          marginTop: 0,
        },
        // Hinweis auf Blatt 2: gerahmt, damit ihn niemand übersieht.
        '.dd-print .dd-next': {
          border: '1.5pt solid #000',
          padding: '1mm 2mm',
          margin: '1.8mm 0',
          fontSize: 'calc(var(--dd-font) * 1.1)',
        },
        '.dd-print .dd-row': {
          display: 'flex',
          alignItems: 'center',
          gap: '1.5mm',
          minHeight: 'var(--dd-row)',
          borderBottom: '0.5pt solid #777',
          breakInside: 'avoid',
        },
        '.dd-print .dd-name': { flex: '1 1 auto', minWidth: 0 },
        '.dd-print .dd-detail': { marginLeft: '1.5mm' },
        '.dd-print .dd-initials': { display: 'block', lineHeight: 1 },
        '.dd-print .dd-counts': { fontWeight: 700, textAlign: 'right' },
        '.dd-print .dd-delta-qty': {
          flex: '0 0 auto',
          minWidth: '12mm',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        },
        '.dd-print .dd-row .tick': {
          flex: '0 0 6mm',
          textAlign: 'center',
        },
        '.dd-print .dd-note-line': {
          borderBottom: '0.5pt solid #000',
          height: `${NOTE_LINE_MM}mm`,
        },
        '.dd-print .bz-break': { breakBefore: 'page' },
        // Blatt 2 hat seine eigene Dichte (`layout.secondSheet`): die
        // Variablen stehen am Blatt, die Schrift muss sie dort neu lesen.
        '.dd-print .dd-sheet2': { fontSize: 'var(--dd-font) !important' },
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

function Tick({ lines }: { lines: (BackzettelLine | undefined)[] }) {
  const relevant = lines.filter((l): l is BackzettelLine => !!l)
  const done = relevant.length > 0 && relevant.every((l) => !!l.doneAt)
  if (!done) return <span className="box" />
  const by = relevant.find((l) => l.doneBy)?.doneBy
  // Kürzel unter dem Kästchen, nicht darin (4 mm).
  return (
    <span data-testid="dd-done">
      <span className="box">✓</span>
      {by ? (
        <span className="small dd-initials">{initials(by.displayName)}</span>
      ) : null}
    </span>
  )
}

function MachineBoxPrint({ box }: { box: MachineBox }) {
  const liters = printLiters(box.liters)
  const batches =
    box.batches === null || box.batches === undefined
      ? 'Chargen –'
      : `${formatNumber(box.batches)} ${
          box.batches === 1 ? 'Charge' : 'Chargen'
        }`
  return (
    <div
      className={box.complete ? 'dd-box' : 'dd-box incomplete'}
      data-testid={`dd-machine-${box.id ?? 'offen'}`}
    >
      <h3>{box.name}</h3>
      <div>
        <span className="small">{litersLabel(box)} </span>
        <span className="dd-big" data-testid={`dd-liters-${box.id ?? 'offen'}`}>
          {liters.text}
        </span>
      </div>
      <div>
        {printKg(box)} · {batches}
      </div>
      {box.addons.map((addon) => {
        const a = addonText(addon)
        return (
          <div key={addon.id}>
            {a.text.replace(': unbekannt', ' –')}
            {a.hint ? <span className="small"> ({a.hint})</span> : null}
          </div>
        )
      })}
      {liters.hint && <div className="small">{liters.hint}</div>}
    </div>
  )
}

/**
 * Alte Posten ohne Größen in der Brot-Tabelle: immer mit Einheit („16
 * Stück“); Grundmenge offen „≥ 4 Stück“ bzw. „offen“ (`minQtyText`).
 */
function singleQty(cell: BreadCell & { unit: BackzettelUnit }): string {
  const text = minQtyText(cell, cell.unit)
  if (text === 'offen') return text
  return formatQty(cell.total, cell.unit) === formatNumber(cell.total)
    ? `${text} ${cell.unit || 'Stück'}`
    : text
}

/** „Grundmenge offen“ bzw. „Grundmenge offen: 750 g, Kasten“ einer Brot-Zeile. */
function breadOpenText(row: BreadRow, sizes: { id: string; label: string }[]) {
  if (row.single) return row.single.baseUnset ? 'Grundmenge offen' : ''
  const open = sizes.filter((sz) => row.cells[sz.id]?.baseUnset)
  return open.length > 0
    ? `Grundmenge offen: ${open.map((sz) => sz.label).join(', ')}`
    : ''
}

function BreadPrint({
  day,
  lineByKey,
}: {
  day: BackzettelDay
  lineByKey: Map<string, BackzettelLine>
}) {
  const bread = day.bread
  if (!bread || bread.rows.length === 0) return null
  const sizes = bread.sizes
  const cellLines = (row: BreadRow) =>
    [row.single, ...sizes.map((sz) => row.cells[sz.id] ?? null)]
      .filter((c): c is NonNullable<typeof c> => !!c)
      .filter((c) => c.total > 0)
      .map((c) => lineByKey.get(c.key))
  // Korrektur mit Grund je Zelle - wie am Bildschirm (BreadTable), damit die
  // Backstube auf Papier sieht, warum eine Zahl von der Grundmenge abweicht.
  const corrections = (row: BreadRow) => {
    const cells: { label: string | null; key: string }[] = []
    if (row.single) cells.push({ label: null, key: row.single.key })
    for (const sz of sizes) {
      const cell = row.cells[sz.id]
      if (cell) cells.push({ label: sz.label, key: cell.key })
    }
    const texts: string[] = []
    for (const c of cells) {
      const line = lineByKey.get(c.key)
      if (!line || !line.correction) continue
      texts.push(
        `${c.label ? `${c.label}: ` : ''}Korr. ${formatSignedQty(
          line.correction,
          line.unit
        )}${line.correctionReason ? ` (${line.correctionReason})` : ''}`
      )
    }
    return texts.join(' · ')
  }
  return (
    <div data-testid="dd-bread">
      <h2>Brot</h2>
      <table>
        <thead>
          <tr>
            <th>Brot</th>
            {sizes.map((sz) => (
              <th key={sz.id} className="num">
                {sz.label}
              </th>
            ))}
            <th className="num">Teig</th>
            <th className="tick">✓</th>
          </tr>
        </thead>
        <tbody>
          {bread.rows.map((row) => (
            <tr key={`${row.itemId}|${row.bakeDate}`}>
              <td>
                <strong>{row.name}</strong>
                {row.single && (
                  // Menge ohne Größe gehört zum Namen, nicht unter eine
                  // Größenspalte (dort läse sie sich wie Laibe dieser Größe)
                  <strong
                    className="total dd-detail"
                    data-testid={`dd-bread-${row.single.key}`}
                  >
                    {singleQty(row.single)}
                  </strong>
                )}
                {breadOpenText(row, sizes) && (
                  <span className="small dd-detail">
                    {breadOpenText(row, sizes)}
                  </span>
                )}
                {row.note && (
                  <span className="small dd-detail">{row.note}</span>
                )}
                {corrections(row) && (
                  <span
                    className="small dd-detail"
                    data-testid={`dd-bread-corr-${row.itemId}|${row.bakeDate}`}
                  >
                    {corrections(row)}
                  </span>
                )}
              </td>
              {row.single ? (
                <td colSpan={Math.max(1, sizes.length)} />
              ) : (
                sizes.map((sz) => {
                  const cell = row.cells[sz.id]
                  return (
                    <td
                      key={sz.id}
                      className="num total"
                      data-testid={cell ? `dd-bread-${cell.key}` : undefined}
                    >
                      {!cell ? '' : minQtyText(cell)}
                    </td>
                  )
                })
              )}
              {!row.single && sizes.length === 0 ? <td /> : null}
              <td className="num">
                {row.complete && row.kg === null ? '' : printKg(row)}
              </td>
              <td className="tick">
                <Tick lines={cellLines(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RollsPrint({
  rolls,
  sheetDate,
  lineByKey,
}: {
  rolls: RollsBlock[]
  sheetDate: string
  lineByKey: Map<string, BackzettelLine>
}) {
  if (rolls.length === 0) return null
  // Später gebackene zuerst, „heute backen“ klein am Ende.
  const ordered = [
    ...rolls.filter((b) => b.bakeDate !== sheetDate),
    ...rolls.filter((b) => b.bakeDate === sheetDate),
  ]
  const cols = Math.min(3, ordered.length)
  return (
    <div data-testid="dd-rolls">
      <h2>Brötchen</h2>
      <div
        className="dd-rolls"
        style={{ ['--dd-roll-cols' as string]: String(cols) }}
      >
        {ordered.map((block) => (
          <div
            key={block.bakeDate}
            className={
              block.bakeDate === sheetDate ? 'dd-roll-col today' : 'dd-roll-col'
            }
            data-testid={`dd-rolls-${block.bakeDate}`}
          >
            <h3>{bakeDayLabel(block.bakeDate, sheetDate)}</h3>
            {block.groups.map((g) => (
              <div
                key={g.key}
                className="dd-group dd-group-row"
                data-testid={`dd-bruch-${g.key}`}
              >
                <span>
                  <strong className="total">{bruchCountText(g)}</strong> ×{' '}
                  {g.g === null ? '– g' : `${formatNumber(g.g)} g`}
                  <span className="small">
                    {' – '}
                    {bruchSplitText(g, lineByKey)}
                    {g.spare !== null && g.spare > 0 ? bruchSpareText(g) : ''}
                  </span>
                </span>
                <Tick lines={g.split.map((s) => lineByKey.get(s.key))} />
              </div>
            ))}
            {block.singles.map((s) => (
              <div key={s.key} className="dd-group dd-group-row">
                <span>
                  <strong className="total">{minQtyText(s)}</strong> {s.name}
                  <span className="small">
                    {s.piece_g === null
                      ? ' (g offen)'
                      : ` (je ${formatNumber(s.piece_g)} g)`}
                    {s.pieces === null ? ' · Teigstücke offen' : ''}
                    {s.baseUnset ? ' · Grundmenge offen' : ''}
                  </span>
                </span>
                <Tick lines={[lineByKey.get(s.key)]} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function hefeteigCounts(
  row: HefeteigPrintRow,
  config: BackzettelConfigData | null
): string {
  // Grundmenge offen: „≥ 3“ bzw. „offen“ - nie die nackte Vorbestellzahl
  const qty = (l: BackzettelLine) => minQtyText(l, l.unit)
  if (row.lines.length === 1 && !row.lines[0].variant) {
    return qty(row.lines[0])
  }
  return row.lines
    .map(
      (l) =>
        `${
          l.variant
            ? l.variantLabel || variantLabel(l.variant, config, l.itemId)
            : 'ohne Füllung'
        } ${qty(l)}`
    )
    .join(' · ')
}

function HefeteigPrint({
  day,
  rows,
  config,
}: {
  day: BackzettelDay
  rows: HefeteigPrintRow[]
  config: BackzettelConfigData | null
}) {
  if (rows.length === 0) return null
  const doughs = day.hefeteig?.doughs ?? []
  return (
    <div data-testid="dd-hefeteig">
      <h2>
        Hefeteig
        {doughs.length > 0 && (
          <span className="small dd-detail" style={{ fontWeight: 400 }}>
            {doughs
              .map(
                (d) =>
                  `${d.name}: ${hefeteigPiecesText(d)} Teigstücke · ${
                    d.kg !== undefined
                      ? printKg({ kg: d.kg, kgKnown: d.kgKnown })
                      : formatKnownGrams(d.dough_g)
                  }`
              )
              .join(' · ')}
          </span>
        )}
      </h2>
      <div className="dd-two">
        {rows.map((row) => (
          <div
            key={row.itemId}
            className="dd-row"
            data-testid={`dd-hefe-${row.itemId}`}
          >
            <span className="dd-name">
              <strong>{row.name}</strong>
            </span>
            <span className="dd-counts">{hefeteigCounts(row, config)}</span>
            <span className="tick">
              <Tick lines={row.lines.filter((l) => l.total > 0)} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

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

/**
 * Übrige Abschnitte in zwei festen Spalten (`printColumns`): kurze Abschnitte
 * bleiben ganz, ein langer kann umbrechen und steht rechts unter
 * „Abschnitt (Forts.)“.
 */
function SectionsPrint({
  sections,
  config,
}: {
  sections: BackzettelDay['sections']
  config: BackzettelConfigData | null
}) {
  const columns = printColumns(sections)
  return (
    <div className="dd-others" data-testid="dd-others">
      {columns.map((chunks, col) => (
        <div key={col} className="dd-col" data-testid={`dd-col-${col + 1}`}>
          {chunks.map(({ section, lines, continued }) => (
            <div
              key={`${section.id}${continued ? '-forts' : ''}`}
              data-testid={`dd-section-${section.id}${
                continued ? '-forts' : ''
              }`}
            >
              <h3 className="dd-section-head">
                {continued ? `${section.label} (Forts.)` : section.label}
              </h3>
              {lines.map((line) => {
                const detail = lineDetail(line)
                return (
                  <div
                    key={line.key}
                    className="dd-row"
                    data-testid={`dd-line-${line.key}`}
                  >
                    <span className="dd-name">
                      {lineLabel(line, config)}
                      {line.hint && (
                        <strong
                          className="small dd-detail"
                          data-testid={`dd-hint-${line.key}`}
                        >
                          {line.hint}
                        </strong>
                      )}
                      {detail && (
                        <span className="small dd-detail">{detail}</span>
                      )}
                    </span>
                    <span className="num total">
                      {minQtyText(line, line.unit)}
                    </span>
                    <span className="tick">
                      <Tick lines={[line]} />
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
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
    <div data-testid="print-deltas">
      <h2>Nachträge seit der Freigabe (nicht in den Mengen oben)</h2>
      <div className="dd-two">
        {groups.map((g) => {
          const { shown, done, seen } = printDeltaFigure(g)
          return (
            <div
              key={g.key}
              className="dd-row"
              data-testid={`print-delta-${g.key}`}
            >
              <span className="total dd-delta-qty">
                {shown === 0 ? '±0' : formatSignedQty(shown, g.first.unit)}
              </span>
              <span className="dd-name">
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
                <span className="small">
                  {seen !== null
                    ? ` · noch offen, ${formatQty(
                        Math.abs(seen),
                        g.first.unit
                      )} schon gesehen`
                    : ''}
                  {g.open === 0 ? ' · quittiert' : ''}
                </span>
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
        <p className="small" data-testid="print-delta-dough">
          <strong>Für Teig und Teilmaschine:</strong>{' '}
          {deltaDoughLines(day).join('; ')}.
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
 * Druckbild eines Teigtag-Zettels (Z10, docs/backzettel-v2.md §7.5): EINE
 * A4-Seite hoch, schwarz auf weiß. Kopf mit Stempel Entwurf/Freigegeben,
 * Maschinen-Leiste (Liter groß, „–“ für unbekannt), Brot (Größen als
 * Spalten), Brötchen je Backtag (Brüche × Gewicht, Aufteilung, „+n frei“),
 * Hefeteig in zwei Spalten, übrige Abschnitte knapp in zwei Spalten,
 * Nachträge, Hinweise, „Offen: …“ und Notizzeilen. Alle Zahlen kommen vom
 * Server; `dayPrintLayout` wählt nur die Dichte. Passt es selbst knapp
 * gesetzt nicht, stehen die übrigen Abschnitte auf Blatt 2 - nie weggelassen.
 */
export function DoughDayPrint({
  day,
  config,
  withExtras = false,
}: DoughDayPrintProps) {
  const layout = dayPrintLayout(day)
  const parts = dayPrintParts(day)
  const lineByKey = linesByKey(day.sections)
  const confirmed = day.status === 'confirmed'
  const doughs = doughsTodayText(day)
  const others = parts.others.length > 0 && (
    <SectionsPrint sections={parts.others} config={config} />
  )
  const style = {
    '--dd-font': `${layout.fontPt}pt`,
    '--dd-row': `${layout.rowMm}mm`,
    '--dd-big': `${layout.bigPt}pt`,
  } as React.CSSProperties

  return (
    <div
      className="bz-print dd-print"
      data-testid="bz-print"
      data-print-step={layout.step}
      data-print-estimate={layout.estimatedMm}
      aria-hidden="true"
      style={style}
    >
      {doughDayPrintStyles}
      <section className="bz-page" data-testid="print-page-1">
        <div className="dd-head">
          <div>
            <h1>Backzettel {formatDateLong(day.date)}</h1>
            {/* U9: Tagestyp aus dem Kalender, fett unter dem Datum */}
            {dayKindLine(day.dayKind) && (
              <p className="meta" data-testid="dd-day-kind">
                <strong>{dayKindLine(day.dayKind)}</strong>
              </p>
            )}
            {doughs && <p className="meta">{doughs}</p>}
            <p className="meta small">
              {confirmed
                ? `Freigegeben${
                    day.confirmedBy ? ` von ${day.confirmedBy.displayName}` : ''
                  }${
                    day.confirmedAt
                      ? ` am ${formatTimestamp(day.confirmedAt)}`
                      : ''
                  } · `
                : ''}
              Saisonfaktor {formatFactor(day.seasonFactor)}
            </p>
          </div>
          <div
            className={confirmed ? 'dd-stamp' : 'dd-stamp draft'}
            data-testid="dd-stamp"
          >
            {confirmed ? 'FREIGEGEBEN' : 'ENTWURF – noch nicht freigegeben'}
          </div>
        </div>

        {(day.machine ?? []).length > 0 && (
          <div className="dd-machine" data-testid="dd-machine">
            {(day.machine ?? []).map((box) => (
              <MachineBoxPrint key={box.id ?? 'offen'} box={box} />
            ))}
          </div>
        )}

        <BreadPrint day={day} lineByKey={lineByKey} />
        <RollsPrint
          rolls={day.rolls ?? []}
          sheetDate={day.date}
          lineByKey={lineByKey}
        />
        <HefeteigPrint day={day} rows={parts.hefeteig} config={config} />

        {layout.othersOnSecondSheet ? (
          <p className="dd-next" data-testid="dd-others-next">
            <strong>Weitere Abschnitte auf Blatt 2:</strong>{' '}
            {parts.others.map((s) => s.label).join(', ')}
          </p>
        ) : (
          others
        )}

        {day.sections.length === 0 && (
          <p data-testid="dd-empty">
            Heute wird kein Teig gemacht – was gebacken wird, steht auf der
            Backliste.
          </p>
        )}

        <DeltasPrint day={day} config={config} />

        {parts.hints.length > 0 && (
          <p className="small" data-testid="dd-hints">
            <strong>Hinweise:</strong> {parts.hints.join('; ')}.
          </p>
        )}
        {parts.open.length > 0 && (
          <p className="small" data-testid="dd-open">
            <strong>Offen:</strong> {parts.open.join('; ')}.
          </p>
        )}

        {layout.noteLines > 0 && (
          <div data-testid="dd-notes">
            <h3>Notizen</h3>
            {Array.from({ length: layout.noteLines }, (_, i) => (
              <div key={i} className="dd-note-line" />
            ))}
          </div>
        )}
      </section>

      {layout.othersOnSecondSheet && others && (
        <section
          className="bz-page bz-break dd-sheet2"
          data-testid="print-dd-others"
          data-print-step={layout.secondSheet?.step}
          data-print-estimate={layout.secondSheet?.estimatedMm}
          style={
            layout.secondSheet
              ? ({
                  '--dd-font': `${layout.secondSheet.fontPt}pt`,
                  '--dd-row': `${layout.secondSheet.rowMm}mm`,
                  '--dd-big': `${layout.secondSheet.bigPt}pt`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <h1>Backzettel {formatDateLong(day.date)} – Blatt 2</h1>
          {!confirmed && (
            <p className="banner">ENTWURF – noch nicht freigegeben</p>
          )}
          {others}
        </section>
      )}

      {withExtras && <BackzettelPrintExtras day={day} />}
    </div>
  )
}

export default DoughDayPrint
