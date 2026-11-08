'use client'
import React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import type {
  PartybrezelConfig,
  ToppingMode,
} from '../../config/partybrezel.config'
import { findTopping, getSize } from '../../lib/configLookup'
import { formatEuro, formatGrams } from '../../lib/format'
import { pretzelPrice } from '../../lib/pricing'
import type { PretzelDraft } from '../../lib/types'
import PretzelPreview from '../PretzelPreview'
import ToggleChips, { type ToggleChipOption } from '../ToggleChips'

export interface ToppingStepProps {
  config: PartybrezelConfig
  pretzels: PretzelDraft[]
  mode: ToppingMode
  onPartTopping: (pretzelId: string, part: number, toppingId: string) => void
  onPretzelTopping: (pretzelId: string, toppingId: string) => void
  onCopyToAll: (pretzelId: string) => void
}

export default function ToppingStep({
  config,
  pretzels,
  mode,
  onPartTopping,
  onPretzelTopping,
  onCopyToAll,
}: ToppingStepProps) {
  const options: ToggleChipOption[] = config.toppings.map((t) => ({
    value: t.id,
    label:
      t.surchargePerPartCents > 0
        ? `${t.label} +${formatEuro(t.surchargePerPartCents)}`
        : t.label,
  }))
  const surchargeHint =
    mode === 'per-part'
      ? 'Aufpreise gelten je belegtem Teil (Platzhalter).'
      : 'Aufpreise gelten je Teil, also für die ganze Brezel mal Anzahl der Teile (Platzhalter).'

  if (pretzels.length === 0) {
    return (
      <Alert severity="info">
        Bitte wählen Sie zuerst im Schritt „Größe & Anzahl“ mindestens eine
        Brezel.
      </Alert>
    )
  }

  return (
    <Box>
      <Typography sx={{ mb: 2 }}>
        {mode === 'per-part'
          ? 'Wählen Sie für jedes Teil einen Belag - gemischt ist möglich.'
          : 'Wählen Sie für jede Brezel eine Sorte; sie gilt für alle Teile.'}{' '}
        {surchargeHint}
      </Typography>
      <Box sx={{ display: 'grid', gap: 2 }}>
        {pretzels.map((pretzel, i) => {
          const size = getSize(config, pretzel.size)
          const label = `Brezel ${i + 1} (${size.label})`
          const parts = Array.from({ length: size.partsPerPretzel }, (_, p) =>
            findTopping(config, pretzel.toppings[p])
          )
          const known = parts.every(Boolean)
          const uniform = known && new Set(parts.map((t) => t?.id)).size === 1
          const price = pretzelPrice(pretzel, i + 1, config)
          const headingId = `pretzel-${pretzel.id}-heading`
          return (
            <Card
              key={pretzel.id}
              variant="outlined"
              component="section"
              aria-labelledby={headingId}
              data-testid={`pretzel-card-${i + 1}`}
            >
              <CardContent
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: '200px minmax(0, 1fr)',
                  },
                  alignItems: 'start',
                }}
              >
                <Box>
                  <Typography id={headingId} component="h3" variant="h3">
                    {label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {size.partsPerPretzel} × {formatGrams(size.gramsPerPart)} ·{' '}
                    {formatEuro(price.totalCents)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <PretzelPreview parts={parts} label={label} />
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gap: 2 }}>
                  {mode === 'per-part' ? (
                    parts.map((topping, part) => (
                      <ToggleChips
                        key={part}
                        legend={`Teil ${part + 1}`}
                        options={options.map((o) => ({
                          ...o,
                          ariaLabel: `${o.label} für ${label}, Teil ${
                            part + 1
                          }`,
                        }))}
                        selected={topping?.id ?? null}
                        onSelect={(id) => onPartTopping(pretzel.id, part, id)}
                      />
                    ))
                  ) : (
                    <>
                      {known && !uniform && (
                        <Alert severity="warning">
                          Die Teile sind unterschiedlich belegt. Bitte wählen
                          Sie eine Sorte für die ganze Brezel.
                        </Alert>
                      )}
                      <ToggleChips
                        legend="Sorte für die ganze Brezel"
                        options={options.map((o) => ({
                          ...o,
                          ariaLabel: `${o.label} für ${label}`,
                        }))}
                        selected={uniform ? parts[0]?.id ?? null : null}
                        onSelect={(id) => onPretzelTopping(pretzel.id, id)}
                      />
                    </>
                  )}
                  {pretzels.length > 1 && (
                    <Box>
                      <Button
                        variant="outlined"
                        onClick={() => onCopyToAll(pretzel.id)}
                        aria-label={`Belag von ${label} für alle Brezeln übernehmen`}
                      >
                        Für alle übernehmen
                      </Button>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
