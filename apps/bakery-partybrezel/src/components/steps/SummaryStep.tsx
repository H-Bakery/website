'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { PartybrezelConfig } from '../../config/partybrezel.config'
import {
  RUHETAG,
  WEEKDAY_NAMES,
  doughDate,
  doughDateIsRuhetag,
  formatDateLong,
} from '../../lib/dates'
import { formatEuro, formatGrams, pluralize } from '../../lib/format'
import type { PayloadMapping } from '../../lib/payload'
import { priceBreakdown } from '../../lib/pricing'
import { doughSummary, toppingCounts } from '../../lib/summary'
import type { OrderDraft } from '../../lib/types'
import PayloadPreview from '../PayloadPreview'

export interface SummaryStepProps {
  config: PartybrezelConfig
  draft: OrderDraft
  mapping: PayloadMapping
  onMappingChange: (mapping: PayloadMapping) => void
  /** Ein früherer Schritt ist offen - die Vorschau ist nicht gültig. */
  incomplete?: boolean
}

export default function SummaryStep({
  config,
  draft,
  mapping,
  onMappingChange,
  incomplete = false,
}: SummaryStepProps) {
  const prices = priceBreakdown(draft.pretzels, config)
  const dough = doughSummary(draft.pretzels, config)
  const toppings = toppingCounts(draft.pretzels, config)

  return (
    <Box>
      <Box component="section" aria-labelledby="price-heading">
        <Typography
          id="price-heading"
          component="h3"
          variant="h3"
          sx={{ mb: 1 }}
        >
          Preis (Platzhalter)
        </Typography>
        <Table
          size="small"
          aria-labelledby="price-heading"
          data-testid="price-table"
        >
          <TableBody>
            {prices.lines.map((line) => (
              <React.Fragment key={line.pretzelId}>
                <TableRow>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 700 }}
                  >
                    Brezel {line.index} ({line.sizeLabel}) – Grundpreis
                  </TableCell>
                  <TableCell align="right">
                    {formatEuro(line.baseCents)}
                  </TableCell>
                </TableRow>
                {line.surcharges.map((s) => (
                  <TableRow key={s.toppingId}>
                    <TableCell sx={{ pl: 4 }}>
                      {s.label} · {pluralize(s.parts, 'Teil', 'Teile')}
                      {s.centsPerPart > 0
                        ? ` × ${formatEuro(s.centsPerPart)}`
                        : ' (ohne Aufpreis)'}
                    </TableCell>
                    <TableCell align="right">{formatEuro(s.cents)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ pl: 4 }}>
                    Zwischensumme Brezel {line.index}
                  </TableCell>
                  <TableCell align="right">
                    {formatEuro(line.totalCents)}
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            <TableRow>
              <TableCell
                component="th"
                scope="row"
                sx={{ fontWeight: 700, fontSize: '1.05rem' }}
              >
                Summe (Platzhalterpreise)
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontWeight: 700, fontSize: '1.05rem' }}
                data-testid="total-price"
              >
                {formatEuro(prices.totalCents)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <Box component="section" aria-labelledby="pickup-heading" sx={{ mt: 3 }}>
        <Typography
          id="pickup-heading"
          component="h3"
          variant="h3"
          sx={{ mb: 1 }}
        >
          Abholung und Kontakt
        </Typography>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            columnGap: 2,
            rowGap: 0.5,
            // lange Namen/Nummern ohne Leerzeichen brechen um statt die
            // Seite bei 320 px seitlich scrollen zu lassen
            '& dd': { margin: 0, overflowWrap: 'anywhere' },
          }}
        >
          <dt>Abholtag</dt>
          <dd>{draft.pickupDate ? formatDateLong(draft.pickupDate) : '–'}</dd>
          <dt>Wunschzeit</dt>
          <dd>{draft.pickupTime || 'keine Angabe'}</dd>
          <dt>Name</dt>
          <dd>{draft.name.trim()}</dd>
          <dt>Telefon</dt>
          <dd>{draft.phone.trim() || 'keine Angabe'}</dd>
          <dt>Anmerkung</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>
            {draft.note.trim() || 'keine'}
          </dd>
        </Box>
      </Box>

      <Box component="section" aria-labelledby="bakery-heading" sx={{ mt: 3 }}>
        <Typography
          id="bakery-heading"
          component="h3"
          variant="h3"
          sx={{ mb: 1 }}
        >
          Für die Backstube
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }} data-testid="dough-summary">
          {dough.bySize.map((row) => (
            <li key={row.sizeId}>
              {row.label}: {pluralize(row.pretzels, 'Brezel', 'Brezeln')} ={' '}
              {row.parts} Teile × {formatGrams(row.gramsPerPart)} ={' '}
              {formatGrams(row.grams)} {config.doughName}
            </li>
          ))}
          <li>
            Zusammen {dough.totalParts} Teile, {formatGrams(dough.totalGrams)}{' '}
            {config.doughName}
            {draft.pickupDate && !doughDateIsRuhetag(draft.pickupDate)
              ? `, Teig am ${formatDateLong(
                  doughDate(draft.pickupDate)
                )} ansetzen`
              : ''}
          </li>
          {draft.pickupDate && doughDateIsRuhetag(draft.pickupDate) && (
            <li data-testid="dough-ruhetag">
              Teig am Vortag – der Vortag ({WEEKDAY_NAMES[RUHETAG - 1]}) ist
              Ruhetag; wann der Teig angesetzt wird, ist offen (Q-P4/Q-P7).
            </li>
          )}
          {toppings.length > 0 && (
            <li>
              Beläge:{' '}
              {toppings
                .map((t) => `${t.label} ${pluralize(t.parts, 'Teil', 'Teile')}`)
                .join(', ')}
            </li>
          )}
        </Box>
      </Box>

      <PayloadPreview
        config={config}
        draft={draft}
        mapping={mapping}
        onMappingChange={onMappingChange}
        incomplete={incomplete}
      />
    </Box>
  )
}
