'use client'
/**
 * Druckfassung von Jahresabschluss und Monatsanalyse - ein eigenes,
 * schlichtes Dokument statt der Bildschirmkarten (wie Backzettel und
 * Abholliste). Seite 1 ist die Übersicht (Kopf, Kennzahlen, Diagramme),
 * danach folgen die Tabellen. Gerendert wird sie nur, solange gedruckt wird
 * (`useIsPrinting`); die Bildschirmfassung blendet sich dann im Druck aus.
 * Bleibt `beforeprint` aus, druckt der Browser wie bisher die
 * Bildschirmfassung - nie ein leeres Blatt.
 *
 * Gerechnet wird hier nichts: jede Zahl kommt vom Server, Balkenlängen
 * sind nur Maßstab.
 */
import React from 'react'
import { Box } from '@mui/material'
import { formatEuro } from '../../lib/reportFormat'
import type {
  FinanceReportNote,
  FinanceReportRow,
} from '../../lib/financeTypes'
import type { CategoryBar, IncomePart } from '../../lib/financeCharts'
import { inkOn, useFinanceChartColors } from './FinanceCharts'
import { describeDiff, formatShare } from './FinanceReportParts'

/** Breite einer der beiden Spalten auf Seite 1. */
export const PRINT_HALF_WIDTH = 330

const SECONDARY = '#4a4a4a'
const HAIRLINE = '#cfcfcf'

const EXACT = {
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
} as const

const DOC_SX = {
  color: '#111',
  bgcolor: '#fff',
  fontSize: '9.5pt',
  lineHeight: 1.4,
  '& *': { boxSizing: 'border-box' },
  // ---- Kopf ----
  '& .fp-head': {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '24px',
    pb: '8px',
    mb: '12px',
    borderBottom: '2pt solid #111',
  },
  '& .fp-kicker': {
    fontSize: '8pt',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: SECONDARY,
  },
  '& .fp-title': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    m: '2px 0 2px',
    fontSize: '20pt',
    fontWeight: 700,
    lineHeight: 1.15,
  },
  '& .fp-stamp': {
    fontSize: '8pt',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    border: '1pt solid #111',
    borderRadius: '3px',
    px: '6px',
    py: '1px',
  },
  '& .fp-subtitle': { fontSize: '9pt', color: SECONDARY },
  '& .fp-meta': {
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    columnGap: '10px',
    rowGap: '1px',
    m: 0,
    fontSize: '8pt',
    whiteSpace: 'nowrap',
    '& dt': { color: SECONDARY, textAlign: 'right' },
    '& dd': { m: 0, fontWeight: 600 },
  },
  // ---- Kennzahlen ----
  '& .fp-kpis': {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: '1fr',
    m: '0 0 14px',
    border: `0.75pt solid ${HAIRLINE}`,
    borderRadius: '4px',
    breakInside: 'avoid',
  },
  '& .fp-kpi': {
    px: '10px',
    py: '7px',
    '& + .fp-kpi': { borderLeft: `0.75pt solid ${HAIRLINE}` },
    '& dt': {
      fontSize: '8pt',
      fontWeight: 600,
      color: SECONDARY,
      whiteSpace: 'nowrap',
    },
    '& dd': { m: 0 },
  },
  '& .fp-kpi-value': {
    fontSize: '14pt',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  '& .fp-kpi-hint': { fontSize: '7.5pt', color: SECONDARY },
  // ---- Abschnitte ----
  '& .fp-section': { mt: '14px' },
  '& .fp-kpis + .fp-section': { mt: 0 },
  '& .fp-h2': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    m: '0 0 2px',
    fontSize: '11pt',
    fontWeight: 700,
    breakAfter: 'avoid',
  },
  '& .fp-num': { color: SECONDARY, fontVariantNumeric: 'tabular-nums' },
  '& .fp-intro': {
    m: '0 0 6px',
    fontSize: '8.5pt',
    color: SECONDARY,
    breakAfter: 'avoid',
  },
  '& .fp-keep': { breakInside: 'avoid' },
  '& .fp-page-break': { breakBefore: 'page' },
  '& .fp-columns': {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '24px',
    breakInside: 'avoid',
    '& > .fp-section': { mt: 0 },
  },
  '& .fp-caption': { mt: '4px', fontSize: '8pt', color: SECONDARY },
  // Legende der Diagramme: kleiner als am Bildschirm.
  '& .fp-chart ul[aria-label="Legende"]': {
    mb: '4px',
    columnGap: '14px',
    '& span': { fontSize: '8pt' },
  },
  '& .fp-chart .recharts-tooltip-wrapper': { display: 'none' },
  // ---- Tabellen ----
  '& .fp-table': {
    // 100 % mit border-collapse schneidet rechts die Linie ab (Abholliste).
    width: 'calc(100% - 1pt)',
    borderCollapse: 'collapse',
    fontSize: '8.75pt',
    fontVariantNumeric: 'tabular-nums',
  },
  '& .fp-table th, & .fp-table td': {
    p: '2.5px 6px',
    textAlign: 'right',
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
    borderBottom: `0.5pt solid ${HAIRLINE}`,
  },
  '& .fp-table .fp-label': {
    textAlign: 'left',
    whiteSpace: 'normal',
    width: '100%',
  },
  '& .fp-table thead': { display: 'table-header-group' },
  '& .fp-table thead th': {
    fontSize: '7.5pt',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: SECONDARY,
    borderBottom: '1pt solid #111',
    verticalAlign: 'bottom',
  },
  '& .fp-table tr': { breakInside: 'avoid' },
  '& .fp-table .fp-group td': {
    textAlign: 'left',
    pt: '9px',
    fontSize: '7.5pt',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: '0.75pt solid #111',
  },
  '& .fp-table .fp-cat td': { fontWeight: 600 },
  '& .fp-table .fp-sub td': {
    fontSize: '8pt',
    color: SECONDARY,
    borderBottomColor: '#ececec',
  },
  '& .fp-table .fp-sub .fp-label': { pl: '20px' },
  '& .fp-table .fp-sum td': {
    fontWeight: 700,
    borderTop: '0.75pt solid #111',
  },
  '& .fp-table .fp-total td': {
    fontWeight: 700,
    borderTop: '0.75pt solid #111',
    borderBottom: '2.5pt double #111',
  },
  '& .fp-table .fp-muted': { color: SECONDARY, fontStyle: 'italic' },
  '& .fp-table .fp-note': {
    fontSize: '7.5pt',
    color: SECONDARY,
    fontWeight: 400,
    ml: '6px',
  },
  // Zahl mit Mini-Balken in einer Zelle
  '& .fp-cellbar': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'flex-end',
  },
  // ---- Anmerkungen ----
  '& .fp-notes': {
    m: 0,
    pl: '18px',
    fontSize: '8pt',
    color: '#222',
    '& li': { mb: '3px', breakInside: 'avoid', pl: '2px' },
    '& li::marker': { color: SECONDARY, fontVariantNumeric: 'tabular-nums' },
  },
} as const

/** Eine Zeichenkette als CSS-String (für `content:`). */
export function cssString(text: string): string {
  return `"${text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')}"`
}

/**
 * Fußzeile jeder Seite über `@page`-Randfelder (Chrome ab 131; Safari zeigt
 * sie nicht und druckt sonst gleich). Als rohes CSS, weil Emotion
 * verschachtelte At-Regeln in `@page` nicht sicher weitergibt.
 */
export function pageFooterCss(left: string): string {
  const font =
    'font: 7.5pt -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #4a4a4a;'
  return [
    '@page {',
    '  size: A4;',
    '  margin: 14mm 14mm 16mm 14mm;',
    `  @bottom-left { content: ${cssString(left)}; ${font} }`,
    `  @bottom-right { content: "Seite " counter(page) " von " counter(pages); ${font} }`,
    '}',
  ].join('\n')
}

/** Heute als `08.11.2026` (Datum des Ausdrucks). */
export function printDate(now: Date = new Date()): string {
  return now.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Rahmen
// ---------------------------------------------------------------------------

export function PrintDocument({
  footer,
  children,
  'data-testid': testId,
}: {
  /** Links in der Fußzeile, z. B. „Bäckerei Heusser · Jahresabschluss 2026“ */
  footer: string
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <Box className="fin-print-doc" data-testid={testId} sx={DOC_SX}>
      <style
        // Nur dieser String, keine Eingaben von außen außer dem Titel
        // (escaped über cssString).
        dangerouslySetInnerHTML={{ __html: pageFooterCss(footer) }}
      />
      {children}
    </Box>
  )
}

export function PrintHeader({
  title,
  stamp,
  subtitle,
  meta,
}: {
  title: string
  /** z. B. „Vorläufig“ - als Stempel neben dem Titel */
  stamp?: string
  subtitle: string
  meta: [string, string][]
}) {
  return (
    <Box component="header" className="fp-head">
      <div>
        <div className="fp-kicker">Bäckerei Heusser</div>
        <h1 className="fp-title">
          {title}
          {stamp && <span className="fp-stamp">{stamp}</span>}
        </h1>
        <div className="fp-subtitle">{subtitle}</div>
      </div>
      <dl className="fp-meta">
        {meta.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Box>
  )
}

export interface PrintKpi {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
}

export function PrintKpis({ items }: { items: PrintKpi[] }) {
  return (
    <dl className="fp-kpis" data-testid="print-kpis">
      {items.map((item, index) => (
        <div className="fp-kpi" key={index}>
          <dt>{item.label}</dt>
          <dd className="fp-kpi-value">{item.value}</dd>
          {item.hint && <dd className="fp-kpi-hint">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function PrintSection({
  number,
  title,
  intro,
  keep = false,
  pageBreak = false,
  children,
  'data-testid': testId,
}: {
  number?: number
  title: string
  intro?: React.ReactNode
  /** Abschnitt nicht über eine Seite teilen (Diagramme, kurze Tabellen) */
  keep?: boolean
  /** Abschnitt beginnt auf einer neuen Seite */
  pageBreak?: boolean
  children: React.ReactNode
  'data-testid'?: string
}) {
  const classes = ['fp-section']
  if (keep) classes.push('fp-keep')
  if (pageBreak) classes.push('fp-page-break')
  return (
    <section className={classes.join(' ')} data-testid={testId}>
      <h2 className="fp-h2">
        {number !== undefined && <span className="fp-num">{number}</span>}
        {title}
      </h2>
      {intro && <p className="fp-intro">{intro}</p>}
      {children}
    </section>
  )
}

/** Diagramm mit Legende und Unterschrift, für den Druck verdichtet. */
export function PrintChart({
  label,
  legend,
  caption,
  children,
}: {
  label: string
  legend?: React.ReactNode
  caption?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <figure
      className="fp-chart fp-keep"
      aria-label={label}
      style={{ margin: 0 }}
    >
      {legend}
      {children}
      {caption && <figcaption className="fp-caption">{caption}</figcaption>}
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Diagramme für schmale Spalten
// ---------------------------------------------------------------------------

/**
 * Ausgaben als Rangbalken: Posten | Balken | Betrag | Anteil (oder Ø-Strich).
 * Schmaler als `CategoryBars`, passt in eine halbe Seite.
 */
export function PrintBars({
  bars,
  showAverage = false,
  averageLabel = 'Ø',
  label,
}: {
  bars: CategoryBar[]
  showAverage?: boolean
  averageLabel?: string
  label: string
}) {
  const c = useFinanceChartColors()
  if (bars.length === 0) return null
  const max = Math.max(
    1,
    ...bars.map((bar) =>
      Math.max(bar.value, showAverage ? bar.average ?? 0 : 0)
    )
  )
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  return (
    <Box
      component="ul"
      aria-label={label}
      data-testid="print-bars"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: showAverage
          ? 'minmax(0, 1.25fr) minmax(0, 1fr) auto'
          : 'minmax(0, 1.25fr) minmax(0, 1fr) auto auto',
        columnGap: '8px',
        rowGap: '5px',
        alignItems: 'center',
        fontSize: '8.5pt',
        fontVariantNumeric: 'tabular-nums',
        breakInside: 'avoid',
      }}
    >
      {bars.map((bar) => {
        const avg = showAverage ? bar.average : null
        return (
          <Box
            component="li"
            key={bar.key}
            data-bar={bar.key}
            title={
              avg !== null
                ? `${bar.label}: ${formatEuro(
                    bar.value
                  )} · ${averageLabel} ${formatEuro(avg)}`
                : undefined
            }
            sx={{ display: 'contents' }}
          >
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {bar.label}
            </Box>
            <Box
              component="span"
              sx={{
                position: 'relative',
                height: 12,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Box
                component="span"
                sx={{
                  ...EXACT,
                  display: 'block',
                  height: 9,
                  width: pct(bar.value),
                  minWidth: bar.value > 0 ? 2 : 0,
                  bgcolor: c.expense,
                  borderRadius: '0 3px 3px 0',
                }}
              />
              {avg !== null && avg > 0 && (
                <Box
                  component="span"
                  data-average={avg}
                  sx={{
                    ...EXACT,
                    position: 'absolute',
                    left: pct(avg),
                    top: 0,
                    bottom: 0,
                    width: 2,
                    ml: '-1px',
                    bgcolor: '#111',
                    boxShadow: '0 0 0 1px #fff',
                  }}
                />
              )}
            </Box>
            <Box
              component="span"
              sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}
            >
              {bar.refund ? 'Erstattung' : formatEuro(bar.value)}
            </Box>
            {!showAverage && (
              <Box
                component="span"
                sx={{ textAlign: 'right', color: SECONDARY, minWidth: '34px' }}
              >
                {formatShare(bar.share)}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * Einnahmen nach Herkunft: ein geteilter Balken, darunter eine kleine
 * Tabelle mit Farbfeld, Betrag und Anteil (die Zahlen stehen nie nur im
 * Balken).
 */
export function PrintSplit({
  parts,
  label,
}: {
  parts: IncomePart[]
  label: string
}) {
  const c = useFinanceChartColors()
  if (parts.length === 0) return null
  const color = (index: number) => c.ramp[Math.min(index, c.ramp.length - 1)]
  return (
    <Box data-testid="print-split" sx={{ breakInside: 'avoid' }}>
      <Box
        role="img"
        aria-label={`${label}: ${parts
          .map((p) => `${p.label} ${formatShare(p.share)}`)
          .join(', ')}`}
        sx={{ display: 'flex', gap: '2px', height: 18, mb: '6px' }}
      >
        {parts.map((part, index) => (
          <Box
            key={part.key}
            data-part={part.key}
            sx={{
              ...EXACT,
              flex: `${part.value} 0 0`,
              minWidth: part.value > 0 ? 3 : 0,
              bgcolor: color(index),
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              px: '5px',
              overflow: 'hidden',
              fontSize: '7.5pt',
              fontWeight: 700,
              color: inkOn(color(index)),
            }}
          >
            {part.share >= 0.15 ? formatShare(part.share) : ''}
          </Box>
        ))}
      </Box>
      <table className="fp-table">
        <tbody>
          {parts.map((part, index) => (
            <tr key={part.key}>
              <td className="fp-label">
                <Box
                  component="span"
                  sx={{
                    ...EXACT,
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '2px',
                    bgcolor: color(index),
                    mr: '6px',
                    verticalAlign: '-1px',
                  }}
                />
                {part.label}
              </td>
              <td>{formatEuro(part.value)}</td>
              <td style={{ color: SECONDARY }}>{formatShare(part.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  )
}

/** MUI liest Zahlen bis 1 in `width`/`left` als Prozent - darum Pixel als Text. */
const px = (value: number) => `${Math.round(value * 10) / 10}px`

/** Kleiner waagrechter Balken in einer Tabellenzelle (Anteil, Ergebnis). */
export function CellBar({
  value,
  max,
  color,
  width = 44,
  diverging = false,
}: {
  value: number
  max: number
  color: string
  width?: number
  /** Ergebnis: links negativ, rechts positiv, Nulllinie in der Mitte */
  diverging?: boolean
}) {
  const scale = max > 0 ? Math.min(1, Math.abs(value) / max) : 0
  if (!diverging) {
    return (
      <Box
        component="span"
        aria-hidden
        sx={{
          display: 'inline-block',
          width: px(width),
          height: '7px',
          verticalAlign: 'middle',
        }}
      >
        <Box
          component="span"
          sx={{
            ...EXACT,
            display: 'block',
            height: '100%',
            width: `${scale * 100}%`,
            minWidth: value > 0 ? '1px' : 0,
            bgcolor: color,
            borderRadius: '0 2px 2px 0',
          }}
        />
      </Box>
    )
  }
  const half = width / 2
  const length = scale * half
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'relative',
        display: 'inline-block',
        width: px(width),
        height: '9px',
        verticalAlign: 'middle',
      }}
    >
      <Box
        component="span"
        sx={{
          ...EXACT,
          position: 'absolute',
          left: px(half),
          top: 0,
          bottom: 0,
          width: '1px',
          bgcolor: '#777',
        }}
      />
      <Box
        component="span"
        sx={{
          ...EXACT,
          position: 'absolute',
          top: '1px',
          bottom: '1px',
          left: px(value < 0 ? half - length : half + 1),
          width: px(Math.max(length - 1, value === 0 ? 0 : 1)),
          bgcolor: color,
          borderRadius: value < 0 ? '2px 0 0 2px' : '0 2px 2px 0',
        }}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Tabellenzeilen
// ---------------------------------------------------------------------------

/** Unterkategorie ohne Namen (`-`) heißt auf Papier „ohne Angabe“. */
export function subLabel(label: string): string {
  const trimmed = label.trim()
  return trimmed === '' || trimmed === '-' ? 'ohne Angabe' : trimmed
}

/**
 * Eine Kategorie mit allen Unterkategorien (eingerückt, kleiner) - Papier
 * kann nicht aufklappen. `columns` sind die Zellen hinter dem Betrag.
 */
export function PrintCategoryRows({
  row,
  extra,
  extraCount,
  testPrefix = 'print',
}: {
  row: FinanceReportRow
  /** Zellen der Kategorie-Zeile hinter dem Betrag */
  extra: React.ReactNode
  /** Anzahl dieser Zellen - die Unterzeilen bleiben dort leer */
  extraCount: number
  testPrefix?: string
}) {
  const subs = row.subcategories ?? []
  // Eine einzige Unterkategorie mit demselben Betrag sagt nichts Neues.
  const showSubs = !(
    subs.length === 1 &&
    Math.abs(subs[0].amount - row.amount) < 0.005 &&
    subLabel(subs[0].label) === 'ohne Angabe'
  )
  return (
    <>
      <tr className="fp-cat" data-testid={`${testPrefix}-row-${row.category}`}>
        <td className="fp-label">{row.label}</td>
        <td>{formatEuro(row.amount)}</td>
        {extra}
      </tr>
      {showSubs &&
        subs.map((sub) => (
          <tr
            key={sub.key}
            className="fp-sub"
            data-testid={`${testPrefix}-sub-${row.category}-${sub.key}`}
          >
            <td className="fp-label">{subLabel(sub.label)}</td>
            <td>{formatEuro(sub.amount)}</td>
            {Array.from({ length: extraCount }, (_, i) => (
              <td key={i} />
            ))}
          </tr>
        ))}
    </>
  )
}

/** Ø und Abweichung als Zellen (Monatsanalyse). */
export function ComparisonCells({
  row,
  section,
}: {
  row: FinanceReportRow
  section: 'income' | 'expense'
}) {
  return (
    <>
      <td>
        {row.average === null || row.average === undefined
          ? '–'
          : formatEuro(row.average)}
      </td>
      <td>
        {row.diff === null || row.diff === undefined
          ? '–'
          : describeDiff(row.diff, section)}
      </td>
    </>
  )
}

// ---------------------------------------------------------------------------
// Anmerkungen
// ---------------------------------------------------------------------------

export function PrintNotes({
  notes,
  extra = [],
}: {
  notes: FinanceReportNote[]
  /** Weitere Sätze vor den Hinweisen des Servers (z. B. Rechenweg) */
  extra?: React.ReactNode[]
}) {
  if (notes.length === 0 && extra.length === 0) return null
  return (
    <ol className="fp-notes" data-testid="print-notes">
      {extra.map((item, index) => (
        <li key={`extra-${index}`}>{item}</li>
      ))}
      {notes.map((note) => (
        <li key={note.key} data-severity={note.severity}>
          {note.severity === 'warning' && <strong>Bitte beachten: </strong>}
          {note.text}
        </li>
      ))}
    </ol>
  )
}
