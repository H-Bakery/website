'use client'
/**
 * Diagramme für Jahresabschluss und Monatsanalyse - am Bildschirm und auf
 * Papier. Daten kommen fertig aus `lib/financeCharts.ts`; hier wird nur
 * gezeichnet.
 *
 * Farben (dataviz-Methode, geprüft mit dem Paletten-Validator in hell und
 * dunkel): Einnahmen blau, Ausgaben orange - dieselben wie auf
 * `/admin/finance`; das Ergebnis ist eine Linie in Schriftfarbe, damit es sich
 * von beiden Balken abhebt und schwarz druckt. Die Herkunft der Einnahmen
 * ist eine geordnete Blau-Treppe (größter Teil am kräftigsten). Geschätzte
 * Anteile sind schraffiert, offene Monate gestrichelt - Farbe trägt nie
 * allein eine Aussage, jede Zahl steht zusätzlich in den Tabellen darunter.
 *
 * Druck: `useIsPrinting()` rendert beim Drucken mit dem hellen Theme; die
 * Säulen- und Liniendiagramme bekommen dann eine feste Breite statt
 * `ResponsiveContainer` (der misst die Bildschirmbreite und schnitte auf A4
 * ab). Das SVG trägt eine `viewBox` und schrumpft per CSS, falls die Spalte
 * doch schmaler ist.
 */
import React from 'react'
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useIsPrinting } from '../../lib/printMode'
import { formatEuro } from '../../lib/reportFormat'
import type {
  CategoryBar,
  CumulativePoint,
  FlowPoint,
  IncomePart,
} from '../../lib/financeCharts'
import { formatShare } from './FinanceReportParts'

/** Breite der Diagramme auf A4 (182 mm Satzspiegel minus Kartenrand). */
export const PRINT_CHART_WIDTH = 640

const euroAxis = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** Achse: `12.000 €`, ab 100.000 `120 T€`. */
export function formatAxisEuro(value: number): string {
  if (Math.abs(value) >= 100000) return `${Math.round(value / 1000)} T€`
  return euroAxis.format(value)
}

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

const RAMP_LIGHT = ['#1c5cab', '#2a78d6', '#5598e7', '#86b6ef']
const RAMP_DARK = ['#9ec5f4', '#5598e7', '#2a78d6', '#184f95']

export function useFinanceChartColors() {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  return {
    dark,
    income: dark ? '#3987e5' : '#2a78d6',
    expense: dark ? '#d95926' : '#eb6834',
    ink: theme.palette.text.primary,
    muted: theme.palette.text.secondary,
    grid: theme.palette.divider,
    surface: theme.palette.background.paper,
    highlight: theme.palette.action.selected,
    ramp: dark ? RAMP_DARK : RAMP_LIGHT,
  }
}

/** Schrift auf einer Füllfarbe: schwarz oder weiß, je nachdem, was mehr Kontrast hat. */
export function inkOn(hex: string): '#ffffff' | '#0b0b0b' {
  const n = parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const l =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  const withWhite = 1.05 / (l + 0.05)
  const withBlack = (l + 0.05) / (0.0029 + 0.05)
  return withWhite >= withBlack ? '#ffffff' : '#0b0b0b'
}

// ---------------------------------------------------------------------------
// Rahmen
// ---------------------------------------------------------------------------

/**
 * Bildschirm: volle Breite über `ResponsiveContainer`. Druck: feste Breite
 * (`PRINT_CHART_WIDTH`) - erst dann steht das Diagramm sicher im A4-Satz.
 */
function ChartFrame({
  height,
  printHeight,
  children,
}: {
  height: number
  printHeight?: number
  children: React.ReactElement
}) {
  const printing = useIsPrinting()
  if (printing) {
    return (
      <Box className="fin-chart-print" sx={{ width: '100%' }}>
        {React.cloneElement(children, {
          width: PRINT_CHART_WIDTH,
          height: printHeight ?? height,
        } as Record<string, unknown>)}
      </Box>
    )
  }
  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </Box>
  )
}

/** Diagramm mit Legende oben und Bildunterschrift (Lesart in einem Satz). */
export function ChartFigure({
  label,
  legend,
  caption,
  children,
  'data-testid': testId,
}: {
  /** Zugänglicher Name, z. B. „Einnahmen und Ausgaben je Monat 2026“ */
  label: string
  legend?: React.ReactNode
  caption?: React.ReactNode
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <Box
      component="figure"
      aria-label={label}
      data-testid={testId}
      className="fin-chart"
      sx={{ m: 0, breakInside: 'avoid' }}
    >
      {legend}
      {children}
      {caption && (
        <Typography
          component="figcaption"
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          {caption}
        </Typography>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Legende
// ---------------------------------------------------------------------------

export type LegendKey =
  | 'income'
  | 'expense'
  | 'result'
  | 'open'
  | 'estimate'
  | 'average'
  | 'cumulative'
  | 'projection'

const LEGEND_TEXT: Record<LegendKey, string> = {
  income: 'Einnahmen',
  expense: 'Ausgaben',
  result: 'Ergebnis',
  open: 'Monat läuft noch',
  estimate: 'geschätzt (Hochrechnung)',
  average: 'Ø Vergleichsmonate',
  cumulative: 'Ergebnis aufgelaufen',
  projection: 'Hochrechnung',
}

function LegendSwatch({ kind }: { kind: LegendKey }) {
  const c = useFinanceChartColors()
  // Swatches sind Hintergründe - ohne „exact“ druckt Chrome sie nicht.
  const common = {
    flex: '0 0 auto',
    display: 'inline-block',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  } as const
  if (kind === 'income' || kind === 'expense') {
    return (
      <Box
        component="span"
        sx={{
          ...common,
          width: 12,
          height: 12,
          borderRadius: '3px',
          bgcolor: c[kind],
        }}
      />
    )
  }
  if (kind === 'estimate') {
    return (
      <Box
        component="span"
        sx={{
          ...common,
          width: 12,
          height: 12,
          borderRadius: '3px',
          backgroundImage: `repeating-linear-gradient(45deg, ${c.muted} 0 2px, transparent 2px 5px)`,
        }}
      />
    )
  }
  if (kind === 'average') {
    return (
      <Box
        component="span"
        sx={{ ...common, width: 3, height: 14, bgcolor: c.ink }}
      />
    )
  }
  const dashed = kind === 'open' || kind === 'projection'
  return (
    <Box
      component="svg"
      viewBox="0 0 22 12"
      sx={{ ...common, width: 22, height: 12 }}
      aria-hidden
    >
      <line
        x1="1"
        y1="6"
        x2="21"
        y2="6"
        stroke={c.ink}
        strokeWidth="2"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      <circle
        cx="11"
        cy="6"
        r="3.5"
        fill={dashed ? c.surface : c.ink}
        stroke={dashed ? c.ink : c.surface}
        strokeWidth="1.5"
      />
    </Box>
  )
}

export function ChartLegend({
  items,
  labels = {},
}: {
  items: LegendKey[]
  /** Andere Beschriftung je Eintrag, z. B. „Ø 12 Monate“ */
  labels?: Partial<Record<LegendKey, string>>
}) {
  return (
    <Box
      component="ul"
      aria-label="Legende"
      sx={{
        listStyle: 'none',
        m: 0,
        mb: 1.5,
        p: 0,
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 0.5,
      }}
    >
      {items.map((kind) => (
        <Box
          component="li"
          key={kind}
          data-legend={kind}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
        >
          <LegendSwatch kind={kind} />
          <Typography component="span" variant="body2" color="text.secondary">
            {labels[kind] ?? LEGEND_TEXT[kind]}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Säulen: Einnahmen nach oben, Ausgaben nach unten, Ergebnis als Linie
// ---------------------------------------------------------------------------

/** Rechteck mit 4-px-Rundung nur am äußeren Ende (zur Nulllinie hin eckig). */
function barPath(
  x: number,
  top: number,
  w: number,
  h: number,
  roundTop: boolean,
  roundBottom: boolean
): string {
  const r = Math.min(4, w / 2, h)
  const rt = roundTop ? r : 0
  const rb = roundBottom ? r : 0
  return [
    `M${x},${top + rt}`,
    `Q${x},${top} ${x + rt},${top}`,
    `L${x + w - rt},${top}`,
    `Q${x + w},${top} ${x + w},${top + rt}`,
    `L${x + w},${top + h - rb}`,
    `Q${x + w},${top + h} ${x + w - rb},${top + h}`,
    `L${x + rb},${top + h}`,
    `Q${x},${top + h} ${x},${top + h - rb}`,
    'Z',
  ].join(' ')
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: FlowPoint
}

/**
 * Ein Teil einer Säule. Ist und geschätzter Rest stapeln sich; zwischen
 * ihnen bleibt 2 px Fläche frei, gerundet wird nur das äußere Ende.
 */
function segmentShape(
  fill: string,
  up: boolean,
  part: 'actual' | 'estimate',
  muted: (p: FlowPoint) => boolean
) {
  const SegmentShape = (props: ShapeProps) => {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props
    let top = Math.min(y, y + height)
    let h = Math.abs(height)
    if (!payload || h < 0.5 || width <= 0) return <g />
    const estimate = up ? payload.estIncome : payload.estExpense
    const actual = up ? payload.income : payload.expense
    const stacked = part === 'actual' ? estimate !== 0 : Boolean(actual)
    // Fuge: 1 px an jedem Teil, zusammen 2 px.
    if (stacked && h > 2) {
      if ((part === 'actual') === up) top += 1
      h -= 1
    }
    const outer = part === 'estimate' || estimate === 0
    return (
      <path
        d={barPath(x, top, width, h, up && outer, !up && outer)}
        fill={fill}
        // fill-opacity, nicht opacity: die Druckstile setzen opacity auf 1.
        fillOpacity={muted(payload) ? 0.45 : 1}
      />
    )
  }
  return SegmentShape
}

function FlowTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload?: FlowPoint }[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        boxShadow: 3,
        minWidth: 200,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {point.title}
      </Typography>
      {point.tooltip.map((line) => (
        <Box key={line.label}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {line.label}
            </Typography>
            <Typography variant="body2">{line.value}</Typography>
          </Box>
          {line.hint && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'right' }}
            >
              {line.hint}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  )
}

function MonthTick(props: {
  x?: number
  y?: number
  payload?: { value: string }
  points: FlowPoint[] | CumulativePoint[]
  fill: string
  highlight?: string
  /** Handy: nur der Anfangsbuchstabe (J F M …), sonst stoßen die Kürzel aneinander */
  compact?: boolean
}) {
  const { x = 0, y = 0, payload, points, fill, highlight, compact } = props
  const point = (points as { key: string }[]).find(
    (p) => p.key === payload?.value
  ) as (FlowPoint & CumulativePoint) | undefined
  if (!point) return <g />
  const strong = highlight === point.key
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={12}
        textAnchor="middle"
        fill={fill}
        fontSize={11}
        fontWeight={strong ? 700 : 400}
      >
        {compact ? point.label.charAt(0) : point.label}
        {/* Sternchen nur am angebrochenen Monat, nicht an rein geschätzten */}
        {'open' in point && point.open && point.income !== null ? '*' : ''}
      </text>
      {'sublabel' in point && point.sublabel && (
        <text dy={25} textAnchor="middle" fill={fill} fontSize={10}>
          {point.sublabel}
        </text>
      )}
    </g>
  )
}

/**
 * Einnahmen (nach oben) und Ausgaben (nach unten) je Monat, Ergebnis als
 * Linie. Geschätzte Anteile schraffiert, offene Monate gestrichelt;
 * `highlight` hinterlegt einen Monat (Monatsanalyse).
 */
export function MonthlyFlowChart({
  points,
  highlight,
  onSelect,
}: {
  points: FlowPoint[]
  highlight?: string
  /**
   * Klick auf einen Monat (nur mit Maus - am Touchscreen zeigt ein Tipp die
   * Zahlen, eine Navigation stünde dem im Weg). Nur Monate mit Bankdaten.
   */
  onSelect?: (month: string) => void
}) {
  const c = useFinanceChartColors()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const mouse = useMediaQuery('(hover: hover) and (pointer: fine)')
  const selectable = Boolean(onSelect && mouse)
  const handleClick = (state: { activeLabel?: string | number } | null) => {
    const key =
      state?.activeLabel !== undefined ? String(state.activeLabel) : ''
    const point = points.find((p) => p.key === key)
    if (onSelect && point && point.income !== null) onSelect(point.key)
  }
  const id = React.useId().replace(/:/g, '')
  const hatchIncome = `fin-hatch-in-${id}`
  const hatchExpense = `fin-hatch-out-${id}`
  const dimOthers = (p: FlowPoint) => Boolean(highlight && p.key !== highlight)
  const noDim = () => false
  return (
    <ChartFrame height={phone ? 240 : 300} printHeight={250}>
      <ComposedChart
        data={points}
        stackOffset="sign"
        margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
        barCategoryGap="22%"
        onClick={selectable ? handleClick : undefined}
        style={selectable ? { cursor: 'pointer' } : undefined}
      >
        <defs>
          {[
            [hatchIncome, c.income],
            [hatchExpense, c.expense],
          ].map(([patternId, color]) => (
            <pattern
              key={patternId}
              id={patternId}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={6} height={6} fill={color} fillOpacity={0.18} />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={color}
                strokeWidth={3}
              />
            </pattern>
          ))}
        </defs>
        {highlight && (
          <ReferenceArea
            x1={highlight}
            x2={highlight}
            fill={c.highlight}
            fillOpacity={1}
            ifOverflow="extendDomain"
          />
        )}
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="key"
          interval={0}
          height={34}
          tickLine={false}
          axisLine={false}
          tick={(tick: {
            x?: number
            y?: number
            payload?: { value: string }
          }) => (
            <MonthTick
              {...tick}
              points={points}
              fill={c.muted}
              highlight={highlight}
              compact={phone}
            />
          )}
        />
        <YAxis
          width={phone ? 62 : 74}
          tickFormatter={formatAxisEuro}
          tick={{ fill: c.muted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke={c.muted} />
        <Tooltip
          content={<FlowTooltip />}
          cursor={{ fill: c.highlight, fillOpacity: 0.6 }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="income"
          stackId="flow"
          maxBarSize={24}
          isAnimationActive={false}
          shape={segmentShape(c.income, true, 'actual', dimOthers)}
        />
        <Bar
          dataKey="estIncome"
          stackId="flow"
          maxBarSize={24}
          isAnimationActive={false}
          shape={segmentShape(`url(#${hatchIncome})`, true, 'estimate', noDim)}
        />
        <Bar
          dataKey="expense"
          stackId="flow"
          maxBarSize={24}
          isAnimationActive={false}
          shape={segmentShape(c.expense, false, 'actual', dimOthers)}
        />
        <Bar
          dataKey="estExpense"
          stackId="flow"
          maxBarSize={24}
          isAnimationActive={false}
          shape={segmentShape(
            `url(#${hatchExpense})`,
            false,
            'estimate',
            noDim
          )}
        />
        <Line
          dataKey="result"
          stroke={c.ink}
          strokeWidth={2}
          dot={{ r: 4, fill: c.ink, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: c.ink, stroke: c.surface, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="openResult"
          stroke={c.ink}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={(dot: {
            cx?: number
            cy?: number
            index?: number
            payload?: FlowPoint
          }) =>
            dot.payload?.open &&
            dot.cx !== undefined &&
            dot.cy !== undefined ? (
              <circle
                key={`open-${dot.index}`}
                cx={dot.cx}
                cy={dot.cy}
                r={4}
                fill={c.surface}
                stroke={c.ink}
                strokeWidth={2}
              />
            ) : (
              <g key={`open-${dot.index}`} />
            )
          }
          activeDot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Aufgelaufenes Ergebnis
// ---------------------------------------------------------------------------

function CumulativeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload?: CumulativePoint }[]
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const rows: [string, number | null][] = [
    ['Ist seit Jahresbeginn', point.actual],
    ['Hochrechnung', point.actual === null ? point.projected : null],
  ]
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        boxShadow: 3,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {point.title}
      </Typography>
      {rows
        .filter(([, value]) => value !== null)
        .map(([label, value]) => (
          <Box
            key={label}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatEuro(value ?? 0)}
            </Typography>
          </Box>
        ))}
    </Box>
  )
}

/**
 * Ergebnis seit Jahresbeginn: Ist durchgezogen mit heller Fläche, die
 * Hochrechnung gestrichelt bis Dezember. Beschriftet wird nur das Ende
 * beider Linien.
 */
export function CumulativeResultChart({
  points,
}: {
  points: CumulativePoint[]
}) {
  const c = useFinanceChartColors()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const lastActual = points.reduce(
    (last, p, i) => (p.actual !== null ? i : last),
    -1
  )
  const lastProjected = points.reduce(
    (last, p, i) => (p.projected !== null ? i : last),
    -1
  )
  const endLabel = (lastIndex: number, prefix: string) => {
    const EndLabel = (props: {
      x?: number | string
      y?: number | string
      index?: number
      value?: number | string
    }) => {
      if (props.index !== lastIndex || props.value === undefined) return null
      const x = Number(props.x)
      const y = Number(props.y)
      return (
        <text
          x={x - 6}
          y={y - 10}
          textAnchor="end"
          fill={c.ink}
          fontSize={12}
          fontWeight={600}
        >
          {prefix}
          {formatEuro(Number(props.value))}
        </text>
      )
    }
    return EndLabel
  }
  return (
    <ChartFrame height={phone ? 200 : 230} printHeight={190}>
      <ComposedChart
        data={points}
        margin={{ top: 24, right: 16, bottom: 4, left: 0 }}
      >
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="key"
          interval={0}
          height={22}
          tickLine={false}
          axisLine={false}
          tick={(tick: {
            x?: number
            y?: number
            payload?: { value: string }
          }) => (
            <MonthTick
              {...tick}
              points={points}
              fill={c.muted}
              compact={phone}
            />
          )}
        />
        <YAxis
          width={phone ? 62 : 74}
          tickFormatter={formatAxisEuro}
          tick={{ fill: c.muted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke={c.muted} />
        <Tooltip
          content={<CumulativeTooltip />}
          cursor={{ stroke: c.muted, strokeWidth: 1 }}
          isAnimationActive={false}
        />
        <Area
          dataKey="actual"
          stroke={c.ink}
          strokeWidth={2}
          fill={c.ink}
          fillOpacity={0.08}
          dot={{ r: 4, fill: c.ink, stroke: c.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: c.ink, stroke: c.surface, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        >
          {lastProjected <= lastActual && (
            <LabelList dataKey="actual" content={endLabel(lastActual, '')} />
          )}
        </Area>
        <Line
          dataKey="projected"
          stroke={c.ink}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={(dot: { cx?: number; cy?: number; index?: number }) =>
            dot.index === lastProjected &&
            dot.cx !== undefined &&
            dot.cy !== undefined ? (
              <circle
                key={`p-${dot.index}`}
                cx={dot.cx}
                cy={dot.cy}
                r={4}
                fill={c.surface}
                stroke={c.ink}
                strokeWidth={2}
              />
            ) : (
              <g key={`p-${dot.index}`} />
            )
          }
          activeDot={false}
          connectNulls={false}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="projected"
            content={endLabel(lastProjected, 'Hochrechnung ')}
          />
        </Line>
      </ComposedChart>
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Woher das Geld kam: ein Balken, in Teile geteilt
// ---------------------------------------------------------------------------

/**
 * Einnahmen nach Herkunft als ein geteilter Balken (28 px). Der Anteil steht
 * im Teil, wenn er Platz hat (ab 12 %); die Legende darunter nennt die Teile
 * in derselben Reihenfolge, der Tooltip (`title`) Betrag und Anteil.
 */
export function IncomeSplitBar({
  parts,
  label,
}: {
  parts: IncomePart[]
  label: string
}) {
  const c = useFinanceChartColors()
  if (parts.length === 0) return null
  const describe = (part: IncomePart) =>
    `${part.label}: ${formatEuro(part.value)} (${formatShare(part.share)})`
  return (
    <Box
      className="fin-chart"
      data-testid="income-split"
      sx={{ breakInside: 'avoid' }}
    >
      <Box
        role="img"
        aria-label={`${label}: ${parts.map(describe).join(', ')}`}
        sx={{ display: 'flex', gap: '2px', height: 28 }}
      >
        {parts.map((part, index) => {
          const fill = c.ramp[Math.min(index, c.ramp.length - 1)]
          return (
            <Box
              key={part.key}
              title={describe(part)}
              data-part={part.key}
              data-ink={inkOn(fill) === '#ffffff' ? 'light' : 'dark'}
              sx={{
                flex: `${part.value} 0 0`,
                minWidth: part.value > 0 ? 3 : 0,
                bgcolor: fill,
                color: inkOn(fill),
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                px: 1,
                overflow: 'hidden',
                // Druck: die Füllfarbe ist ein Hintergrund - ohne „exact“
                // fiele sie bei abgeschalteten Hintergrundgrafiken weg. Die
                // Schriftfarbe im Druck setzt `data-ink` (Druckstile).
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            >
              {part.share >= 0.12 && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'inherit' }}
                >
                  {formatShare(part.share)}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          mt: 1,
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 2,
          rowGap: 0.5,
        }}
      >
        {parts.map((part, index) => (
          <Box
            component="li"
            key={part.key}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
          >
            <Box
              component="span"
              sx={{
                width: 12,
                height: 12,
                borderRadius: '3px',
                bgcolor: c.ramp[Math.min(index, c.ramp.length - 1)],
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            />
            <Typography component="span" variant="body2" color="text.secondary">
              {part.label}{' '}
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatEuro(part.value)}
              </Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Wohin das Geld ging: Rangliste
// ---------------------------------------------------------------------------

/**
 * Ausgabenposten als waagrechte Balken, größter oben, Betrag am Ende. Mit
 * `average` steht der Ø der Vergleichsmonate als Strich im Balken - was
 * darüber hinausgeht, sieht man ohne Zahlenvergleich.
 */
export function CategoryBars({
  bars,
  label,
  showAverage = false,
  averageLabel = 'Ø',
}: {
  bars: CategoryBar[]
  label: string
  showAverage?: boolean
  averageLabel?: string
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
      data-testid="expense-bars"
      // Bewusst ohne „fin-chart“: die Liste darf zwischen zwei Zeilen
      // umbrechen, sonst bliebe die Überschrift allein auf der Seite.
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', rowGap: 1.25 }}
    >
      {bars.map((bar) => {
        const avg = showAverage ? bar.average : null
        const title =
          `${bar.label}: ${formatEuro(bar.value)}` +
          (bar.refund ? ' (netto Erstattung)' : '') +
          (avg !== null ? ` · ${averageLabel} ${formatEuro(avg)}` : '') +
          (!showAverage ? ` · ${formatShare(bar.share)}` : '')
        return (
          <Box
            component="li"
            key={bar.key}
            data-bar={bar.key}
            title={title}
            sx={{
              display: 'grid',
              alignItems: 'center',
              columnGap: 1.5,
              gridTemplateColumns: {
                xs: '1fr auto',
                sm: 'minmax(120px, 30%) 1fr minmax(96px, auto)',
              },
              gridTemplateAreas: {
                xs: '"label value" "bar bar"',
                sm: '"label bar value"',
              },
              breakInside: 'avoid',
              '@media print': {
                gridTemplateColumns: '150px 1fr 150px',
                gridTemplateAreas: '"label bar value"',
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{ gridArea: 'label', minWidth: 0 }}
              noWrap
            >
              {bar.label}
            </Typography>
            <Box
              sx={{
                gridArea: 'bar',
                position: 'relative',
                height: 20,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  height: 12,
                  width: pct(bar.value),
                  minWidth: bar.value > 0 ? 2 : 0,
                  bgcolor: c.expense,
                  borderRadius: '0 4px 4px 0',
                  printColorAdjust: 'exact',
                  WebkitPrintColorAdjust: 'exact',
                }}
              />
              {avg !== null && avg > 0 && (
                <Box
                  data-average={avg}
                  sx={{
                    position: 'absolute',
                    left: pct(avg),
                    top: 0,
                    bottom: 0,
                    width: 3,
                    ml: '-1.5px',
                    bgcolor: c.ink,
                    borderRadius: '1px',
                    boxShadow: `0 0 0 1px ${c.surface}`,
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact',
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                gridArea: 'value',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {bar.refund ? 'Erstattung' : formatEuro(bar.value)}
              {!showAverage && (
                <Box
                  component="span"
                  sx={{ color: 'text.secondary', ml: 0.75 }}
                >
                  {formatShare(bar.share)}
                </Box>
              )}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
