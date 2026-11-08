'use client'
import React, { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { ProductAnalyticsPerformance } from '@bakery/shared/types'
import { ResponsiveList, type ResponsiveColumn } from '../layout'
import { formatEuro } from '../../lib/reportFormat'

/**
 * Produkt-Rangliste der Analysen: Tabelle am PC, Karten am Handy
 * (`ResponsiveList`). Ersetzt das DataGrid, das am Handy nur drei Spalten
 * zeigte und jede Zeile mit einem grünen „Trend“-Chip schmückte, der nichts
 * bedeutete. Sortiert nach Umsatz, wie die API liefert; Rang = Position.
 */
export interface ProductRankingProps {
  products: ProductAnalyticsPerformance[]
  'aria-label': string
  /** Zunächst so viele Zeilen, dann „Alle … anzeigen“. */
  initialRows?: number
  /** Suchfeld über der Liste. */
  searchable?: boolean
  /** Ø Preis als Spalte (nur sinnvoll am PC). */
  showAvgPrice?: boolean
  /** Rang-Spalte (nicht bei „wenig verkauft“ - Rang 1 wäre das Schlusslicht). */
  showRank?: boolean
}

type Row = ProductAnalyticsPerformance & { position: number }

const qty = (value: number) => value.toLocaleString('de-DE')

export default function ProductRanking({
  products,
  'aria-label': ariaLabel,
  initialRows,
  searchable = false,
  showAvgPrice = true,
  showRank = true,
}: ProductRankingProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const needle = query.trim().toLocaleLowerCase('de-DE')
  const ranked: Row[] = products.map((p, i) => ({
    ...p,
    position: p.rank ?? i + 1,
  }))
  const filtered = needle
    ? ranked.filter((p) =>
        p.productName.toLocaleLowerCase('de-DE').includes(needle)
      )
    : ranked
  const limit = initialRows && !expanded && !needle ? initialRows : undefined
  const rows = limit ? filtered.slice(0, limit) : filtered

  const rankColumn: ResponsiveColumn<Row>[] = [
    {
      key: 'rank',
      header: '#',
      cell: (p) => (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {p.position}
        </Typography>
      ),
      hideInCard: true,
    },
  ]
  const columns: ResponsiveColumn<Row>[] = [
    ...(showRank ? rankColumn : []),
    {
      key: 'name',
      header: 'Produkt',
      primary: true,
      cell: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {p.productName}
        </Typography>
      ),
    },
    {
      key: 'qty',
      header: 'Menge',
      align: 'right',
      cell: (p) => qty(p.quantitySold),
    },
    {
      key: 'revenue',
      header: 'Umsatz',
      align: 'right',
      cell: (p) => formatEuro(p.revenue),
    },
    ...(showAvgPrice
      ? [
          {
            key: 'avg',
            header: 'Ø Preis',
            align: 'right' as const,
            hideInCard: true,
            cell: (p: Row) =>
              p.quantitySold ? formatEuro(p.revenue / p.quantitySold) : '–',
          },
        ]
      : []),
  ]

  return (
    <Box>
      {searchable && (
        <Box sx={{ px: { xs: 2, md: 3 }, pb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Produkt suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputProps={{ 'aria-label': 'Produkt suchen' }}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        </Box>
      )}
      {phone ? (
        <CompactList
          rows={rows}
          aria-label={ariaLabel}
          showRank={showRank}
          empty={
            needle
              ? 'Kein Produkt passt zur Suche.'
              : 'Keine Verkäufe im gewählten Zeitraum.'
          }
        />
      ) : (
        <ResponsiveList
          rows={rows}
          columns={columns}
          rowKey={(p) => p.productId}
          aria-label={ariaLabel}
          empty={
            needle
              ? 'Kein Produkt passt zur Suche.'
              : 'Keine Verkäufe im gewählten Zeitraum.'
          }
        />
      )}
      {limit && filtered.length > limit && (
        <Box sx={{ px: { xs: 1, md: 2 }, py: 1 }}>
          <Button onClick={() => setExpanded(true)}>
            {`Alle ${filtered.length} anzeigen`}
          </Button>
        </Box>
      )}
    </Box>
  )
}

/**
 * Am Handy eine Zeile je Produkt: Name und Menge links, Umsatz rechts -
 * die Karten der `ResponsiveList` brauchten drei Zeilen je Produkt.
 */
function CompactList({
  rows,
  showRank,
  empty,
  'aria-label': ariaLabel,
}: {
  rows: Row[]
  showRank: boolean
  empty: string
  'aria-label': string
}) {
  if (rows.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>
        {empty}
      </Typography>
    )
  }
  return (
    <Box
      component="ol"
      aria-label={ariaLabel}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {rows.map((p) => (
        <Box
          component="li"
          key={p.productId}
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            px: 2,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {showRank && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: '1.5em', fontVariantNumeric: 'tabular-nums' }}
            >
              {p.position}
            </Typography>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {p.productName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {`${qty(p.quantitySold)} verkauft`}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
            {formatEuro(p.revenue)}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
