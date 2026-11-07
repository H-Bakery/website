'use client'
import React from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Granularity, RevenueData } from '@bakery/shared/types'
import { formatEuro } from '../../lib/reportFormat'
import { isoWeek } from './dateRange'

/**
 * Umsatz je Tag/Woche/Monat als Balken - eine Reihe, eine Achse.
 *
 * Vorher (feature-analytics `RevenueTrendChart`): zwei Linien mit zwei
 * y-Achsen (Umsatz und Bons), die sich am Handy überlagerten und kaum zu
 * lesen waren, und Wochen hießen „KW 1“ bis „KW 5“ (Woche im Monat statt
 * Kalenderwoche). Die Bonzahl steht jetzt im Tooltip.
 */
export interface RevenuePoint extends RevenueData {
  /** Tage mit Bericht in der Woche/im Monat (API, nur bei weekly/monthly). */
  dayCount?: number
}

const axisEuro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** Beschriftung eines Punkts: `06.11.`, `KW 45`, `Nov. 26`. */
export function revenueLabel(date: string, granularity: Granularity): string {
  if (granularity === 'weekly') return `KW ${isoWeek(date)}`
  if (granularity === 'monthly') {
    const [y, m] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('de-DE', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    })
  }
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`
}

export function useChartInk() {
  const theme = useTheme()
  return {
    bar: theme.palette.primary.main,
    grid: theme.palette.divider,
    axis: theme.palette.text.secondary,
    text: theme.palette.text.primary,
    paper: theme.palette.background.paper,
  }
}

export default function RevenueChart({
  data,
  granularity = 'daily',
  height,
}: {
  data: RevenuePoint[]
  granularity?: Granularity
  height?: number
}) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const ink = useChartInk()
  const points = data.map((d) => ({
    ...d,
    label: revenueLabel(d.date, granularity),
  }))
  return (
    <Box
      sx={{ width: '100%', height: height ?? (phone ? 220 : 300) }}
      data-testid="revenue-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, left: 0, right: 8 }}>
          <CartesianGrid stroke={ink.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: ink.axis, fontSize: 12 }}
            stroke={ink.grid}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            width={phone ? 56 : 72}
            tickFormatter={(v: number) => axisEuro.format(v)}
            tick={{ fill: ink.axis, fontSize: 12 }}
            stroke={ink.grid}
          />
          <Tooltip
            cursor={{ fill: theme.palette.action.hover }}
            formatter={(value: number | string) => [
              formatEuro(Number(value)),
              'Umsatz',
            ]}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as
                | (RevenuePoint & { label: string })
                | undefined
              if (!p) return ''
              const days =
                p.dayCount !== undefined
                  ? ` · ${p.dayCount} ${p.dayCount === 1 ? 'Tag' : 'Tage'}`
                  : ''
              return `${p.label} · ${p.transactionCount} Bons${days}`
            }}
            contentStyle={{
              backgroundColor: ink.paper,
              color: ink.text,
              borderColor: ink.grid,
              borderRadius: 8,
            }}
            itemStyle={{ color: ink.text }}
            labelStyle={{ color: ink.text }}
          />
          <Bar
            dataKey="revenue"
            name="Umsatz"
            fill={ink.bar}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}
