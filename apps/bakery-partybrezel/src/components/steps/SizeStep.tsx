'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import type { PartybrezelConfig, SizeId } from '../../config/partybrezel.config'
import { formatEuro, formatGrams } from '../../lib/format'
import { countBySize, maxCountForSize } from '../../lib/orderState'
import type { PretzelDraft } from '../../lib/types'
import PretzelPreview from '../PretzelPreview'
import QuantityStepper from '../QuantityStepper'

export interface SizeStepProps {
  config: PartybrezelConfig
  pretzels: PretzelDraft[]
  onCountChange: (size: SizeId, count: number) => void
}

export default function SizeStep({
  config,
  pretzels,
  onCountChange,
}: SizeStepProps) {
  return (
    <Box>
      <Typography sx={{ mb: 2 }}>
        Wählen Sie Größe und Anzahl. Jede Partybrezel besteht aus{' '}
        {config.doughName} und wird in Teilen gebacken – den Belag wählen Sie im
        nächsten Schritt.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {config.sizes.map((size) => {
          const count = countBySize(pretzels, size.id)
          const headingId = `size-${size.id}-heading`
          return (
            <Card
              key={size.id}
              variant="outlined"
              component="section"
              aria-labelledby={headingId}
              data-testid={`size-card-${size.id}`}
              sx={{
                borderWidth: count > 0 ? 2 : 1,
                borderColor: count > 0 ? 'primary.main' : 'divider',
              }}
            >
              <CardContent>
                <Typography id={headingId} component="h3" variant="h3">
                  Partybrezel {size.label}
                </Typography>
                <Box
                  sx={{ display: 'flex', gap: 2, alignItems: 'center', my: 1 }}
                >
                  <PretzelPreview
                    parts={Array(size.partsPerPretzel).fill(undefined)}
                    label={`Partybrezel ${size.label}`}
                    size={96}
                    showLegend={false}
                    decorative
                  />
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    <li>
                      {size.partsPerPretzel} Teile ×{' '}
                      {formatGrams(size.gramsPerPart)} {config.doughName}
                    </li>
                    <li>ca. {size.persons} Personen (Platzhalter)</li>
                    <li>
                      Grundpreis {formatEuro(size.basePriceCents)} (Platzhalter)
                    </li>
                  </Box>
                </Box>
                <QuantityStepper
                  label={`Anzahl ${size.label}`}
                  value={count}
                  max={maxCountForSize(pretzels, size.id, config)}
                  onChange={(n) => onCountChange(size.id, n)}
                />
              </CardContent>
            </Card>
          )
        })}
      </Box>
      <Typography sx={{ mt: 2 }} color="text.secondary" aria-live="polite">
        {pretzels.length} von höchstens {config.maxPretzelsPerOrder} Brezeln
        gewählt.
      </Typography>
    </Box>
  )
}
