'use client'
import React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { PartybrezelConfig } from '../../config/partybrezel.config'
import { RUHETAG, WEEKDAY_NAMES, type PickupDate } from '../../lib/dates'
import { pluralize } from '../../lib/format'
import type { TextField as OrderTextField } from '../../lib/orderState'
import type { OrderDraft } from '../../lib/types'
import type { FieldErrors } from '../../lib/validation'
import ToggleChips from '../ToggleChips'

export interface PickupStepProps {
  config: PartybrezelConfig
  draft: OrderDraft
  /** `null`, solange "heute" im Browser noch nicht bestimmt ist. */
  dates: PickupDate[] | null
  errors: FieldErrors
  /** Fehler sichtbar machen (nach "Weiter" oder Verlassen des Feldes). */
  showError: (field: keyof FieldErrors) => boolean
  onBlur: (field: keyof FieldErrors) => void
  onDate: (date: string) => void
  onField: (field: OrderTextField, value: string) => void
}

export default function PickupStep({
  config,
  draft,
  dates,
  errors,
  showError,
  onBlur,
  onDate,
  onField,
}: PickupStepProps) {
  const days = config.availableWeekdays
    .filter((d) => d !== RUHETAG)
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAMES[d - 1])
    .join(', ')
  const err = (field: keyof FieldErrors) =>
    showError(field) ? errors[field] : undefined
  const noteLength = draft.note.trim().length
  const selected = dates?.find((d) => d.date === draft.pickupDate)

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        {dates === null ? (
          <Typography role="status">Abholtage werden geladen …</Typography>
        ) : dates.length === 0 ? (
          <Alert severity="warning">Zurzeit ist kein Abholtag wählbar.</Alert>
        ) : (
          <ToggleChips
            legend="Abholtag"
            options={dates.map((d) => ({
              value: d.date,
              label: d.shortLabel,
              // beginnt mit dem sichtbaren Text (WCAG 2.5.3, Sprachsteuerung)
              ariaLabel: `${d.shortLabel} (${d.longLabel})`,
            }))}
            selected={draft.pickupDate}
            onSelect={onDate}
          />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Frühestens {pluralize(config.leadTimeDays, 'Tag', 'Tage')} im Voraus,
          abholbar {days} (Platzhalter). Montag ist Ruhetag. Der Teig wird am
          Vortag angesetzt, abgeholt wird am Backtag.
        </Typography>
        {selected?.doughOnRuhetag && (
          <Alert severity="info" sx={{ mt: 1 }} data-testid="dough-ruhetag">
            Der Vortag ({WEEKDAY_NAMES[RUHETAG - 1]}) ist Ruhetag. Ob es am{' '}
            {WEEKDAY_NAMES[selected.weekday - 1]} Partybrezeln gibt und wann der
            Teig dafür angesetzt wird, ist noch offen (Fragen Q-P4 und Q-P7).
          </Alert>
        )}
        {err('pickupDate') && (
          <Typography color="error" role="alert" sx={{ mt: 1 }}>
            {errors.pickupDate}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <TextField
          label="Name"
          required
          value={draft.name}
          onChange={(e) => onField('name', e.target.value)}
          onBlur={() => onBlur('name')}
          error={Boolean(err('name'))}
          helperText={err('name') ?? ' '}
          autoComplete="name"
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          label="Telefon (optional)"
          type="tel"
          value={draft.phone}
          onChange={(e) => onField('phone', e.target.value)}
          onBlur={() => onBlur('phone')}
          error={Boolean(err('phone'))}
          helperText={err('phone') ?? 'Für Rückfragen zur Bestellung.'}
          autoComplete="tel"
          inputProps={{ inputMode: 'tel' }}
        />
        <TextField
          label="Wunschzeit (optional)"
          type="time"
          value={draft.pickupTime}
          onChange={(e) => onField('pickupTime', e.target.value)}
          onBlur={() => onBlur('pickupTime')}
          error={Boolean(err('pickupTime'))}
          helperText={err('pickupTime') ?? 'Uhrzeit der Abholung, z. B. 10:30.'}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <TextField
        label="Anmerkung (optional)"
        multiline
        minRows={2}
        value={draft.note}
        onChange={(e) => onField('note', e.target.value)}
        onBlur={() => onBlur('note')}
        error={Boolean(err('note'))}
        helperText={
          err('note') ??
          `${noteLength} von ${config.maxCustomerNoteLength} Zeichen`
        }
      />
    </Box>
  )
}
