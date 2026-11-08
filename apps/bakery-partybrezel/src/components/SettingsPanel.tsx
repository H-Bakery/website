'use client'
import React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type {
  PartybrezelConfig,
  ToppingMode,
} from '../config/partybrezel.config'
import { RUHETAG, WEEKDAY_SHORT } from '../lib/dates'
import { formatEuro, pluralize } from '../lib/format'

export const MODE_LABELS: Record<ToppingMode, string> = {
  'per-part': 'Belag je Teil (gemischt möglich)',
  'per-pretzel': 'Ein Belag je Brezel',
}

export interface SettingsPanelProps {
  config: PartybrezelConfig
  mode: ToppingMode
  onModeChange: (mode: ToppingMode) => void
  onReset: () => void
}

/** Für die Vorführung beim Inhaber: Varianten umschalten, ohne die Config zu ändern. */
export default function SettingsPanel({
  config,
  mode,
  onModeChange,
  onReset,
}: SettingsPanelProps) {
  return (
    <Accordion disableGutters variant="outlined">
      {/* Überschrift UM den Knopf: Inhalte eines Knopfs sind für
          Screenreader rein darstellend, eine h2 darin fände niemand. */}
      <Typography component="h2" variant="h3" sx={{ m: 0 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="prototype-settings-content"
          id="prototype-settings-header"
        >
          Prototyp-Einstellungen
        </AccordionSummary>
      </Typography>
      <AccordionDetails id="prototype-settings-content">
        <FormControl>
          <FormLabel id="topping-mode-label">
            Belag wählen (Frage Q-P3)
          </FormLabel>
          <RadioGroup
            aria-labelledby="topping-mode-label"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as ToppingMode)}
          >
            {(Object.keys(MODE_LABELS) as ToppingMode[]).map((m) => (
              <FormControlLabel
                key={m}
                value={m}
                control={<Radio />}
                label={`${MODE_LABELS[m]}${
                  m === config.defaultToppingMode ? ' (Vorgabe)' : ''
                }`}
              />
            ))}
          </RadioGroup>
        </FormControl>
        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
          Aus der Config (Platzhalter): Vorlauf{' '}
          {pluralize(config.leadTimeDays, 'Tag', 'Tage')} · Abholtage{' '}
          {config.availableWeekdays
            .filter((d) => d !== RUHETAG)
            .map((d) => WEEKDAY_SHORT[d - 1])
            .join(', ')}{' '}
          · höchstens {config.maxPretzelsPerOrder} Brezeln · Grundpreise{' '}
          {config.sizes
            .map((s) => `${s.label} ${formatEuro(s.basePriceCents)}`)
            .join(', ')}
          .
        </Typography>
        <Button sx={{ mt: 2 }} variant="outlined" onClick={onReset}>
          Zusammenstellung verwerfen
        </Button>
      </AccordionDetails>
    </Accordion>
  )
}
