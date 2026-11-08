'use client'
import React, { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import type {
  PartybrezelConfig,
  SizeConfig,
  ToppingMode,
} from '../../config/partybrezel.config'
import { findTopping, getSize } from '../../lib/configLookup'
import { formatEuro, formatGrams } from '../../lib/format'
import { pretzelPrice } from '../../lib/pricing'
import type { PretzelDraft } from '../../lib/types'
import PretzelView, { PreviewModeToggle } from '../PretzelView'
import { usePreviewMode } from '../usePreviewMode'
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
  const preview = usePreviewMode()
  // Die 3D-Ansicht zeigt eine Brezel: die erste, bis „In 3D ansehen“ eine
  // andere wählt. Ein WebGL-Kontext für alle Karten statt einer je Brezel.
  // Ein Belag-Klick verschiebt sie bewusst nicht - sonst springen die Chips
  // der Karte unter dem Zeiger weg und WebGL startet neu.
  const [activeId, setActiveId] = useState<string | null>(null)
  // Nur für das eine Mounten nach „In 3D ansehen“ (der Knopf verschwindet).
  const [focus3D, setFocus3D] = useState(false)
  const show3D = (id: string) => {
    setActiveId(id)
    setFocus3D(true)
  }
  const active3D = pretzels.some((p) => p.id === activeId)
    ? activeId
    : pretzels[0]?.id ?? null
  // Der Aufpreis am Chip ist der, den ein Klick auslöst: je Teil bzw. für
  // die ganze Brezel (Aufpreis je Teil × Teile).
  const optionsFor = (size: SizeConfig): ToggleChipOption[] =>
    config.toppings.map((t) => {
      if (t.surchargePerPartCents <= 0) return { value: t.id, label: t.label }
      return {
        value: t.id,
        label:
          mode === 'per-part'
            ? `${t.label} +${formatEuro(t.surchargePerPartCents)} je Teil`
            : `${t.label} +${formatEuro(
                t.surchargePerPartCents * size.partsPerPretzel
              )} je Brezel`,
      }
    })
  const surchargeHint =
    mode === 'per-part'
      ? 'Aufpreise gelten je belegtem Teil (Platzhalter).'
      : 'Der Aufpreis am Belag gilt für die ganze Brezel, also für alle Teile zusammen (Platzhalter).'

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
          ? 'Wählen Sie für jedes Teil einen Belag – gemischt ist möglich.'
          : 'Wählen Sie für jede Brezel einen Belag; er gilt für alle Teile.'}{' '}
        {surchargeHint}
      </Typography>
      <PreviewModeToggle preview={preview} />
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
          const options = optionsFor(size)
          const headingId = `pretzel-${pretzel.id}-heading`
          const in3D = preview.mode === '3d' && pretzel.id === active3D
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
                  // Gleiche Spalte für alle Karten, solange 3D gewählt ist:
                  // die Chips stehen in jeder Karte an derselben Stelle.
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: `${preview.mode === '3d' ? 380 : 200}px minmax(0, 1fr)`,
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
                    <PretzelView
                      parts={parts}
                      label={label}
                      size={size}
                      config={config}
                      mode={in3D ? '3d' : '2d'}
                      onUnavailable={preview.markUnavailable}
                      onInterrupted={preview.markInterrupted}
                      focus3D={focus3D}
                      onFocused={() => setFocus3D(false)}
                      onShow3D={
                        preview.mode === '3d' && !in3D
                          ? () => show3D(pretzel.id)
                          : undefined
                      }
                    />
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
                          Sie einen Belag für die ganze Brezel.
                        </Alert>
                      )}
                      <ToggleChips
                        legend="Ein Belag für die ganze Brezel"
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
