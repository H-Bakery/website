'use client'

import React from 'react'
import { Box, Button, MenuItem, Stack, TextField } from '@mui/material'

import type { ReceiptDetail } from '../../../../../lib/receiptsApi'

export type Draft = Record<string, string>
export type VatDraft = { rate: string; net: string; vat: string }[]

const TEXT_FIELDS = [
  { key: 'supplier_name', label: 'Lieferant' },
  { key: 'invoice_number', label: 'Rechnungsnummer' },
  { key: 'invoice_date', label: 'Rechnungsdatum', type: 'date' },
  { key: 'due_date', label: 'Fälligkeit', type: 'date' },
  { key: 'gross_cents', label: 'Brutto', decimal: true },
  { key: 'currency', label: 'Währung' },
] as const

export function centText(value: number | null) {
  return value == null ? '' : (value / 100).toFixed(2).replace('.', ',')
}

export function parseCents(input: string) {
  const text = input.trim().replace(',', '.')
  if (!text) return null
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      'Bitte Beträge mit höchstens zwei Nachkommastellen eingeben.'
    )
  const cents = Math.round(Number(text) * 100)
  if (!Number.isSafeInteger(cents)) throw new Error('Der Betrag ist zu groß.')
  return cents
}

const selectFields = [
  {
    key: 'kind',
    label: 'Belegart',
    options: {
      eingangsrechnung: 'Eingangsrechnung',
      kassenbeleg: 'Kassenbeleg',
      gutschrift: 'Gutschrift',
    },
  },
  {
    key: 'payment',
    label: 'Zahlungsart',
    options: {
      offen: 'Offen',
      ueberweisung: 'Überweisung',
      lastschrift: 'Lastschrift',
      bar: 'Bar',
      karte: 'Karte',
    },
  },
] as const

function note(reason?: string) {
  return reason ? '⚠ bitte prüfen – ' + reason : undefined
}

export default function ReceiptFieldsForm({
  fields,
  draft,
  vat,
  setField,
  setVat,
  disabled,
}: {
  fields: ReceiptDetail
  draft: Draft
  vat: VatDraft
  setField: (key: string, value: string) => void
  setVat: (value: VatDraft) => void
  disabled: boolean
}) {
  const text = (key: keyof ReceiptDetail) =>
    draft[key] ??
    (key === 'gross_cents'
      ? centText(fields.gross_cents)
      : String(
          key === 'currency' && fields.currency === 'XXX'
            ? ''
            : fields[key] ?? ''
        ))

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {TEXT_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            value={text(field.key)}
            type={'type' in field ? field.type : 'text'}
            InputLabelProps={'type' in field ? { shrink: true } : undefined}
            inputProps={
              'decimal' in field ? { inputMode: 'decimal' } : undefined
            }
            helperText={note(fields.field_flags[field.key])}
            disabled={disabled}
            onChange={(event) => setField(field.key, event.target.value)}
          />
        ))}
        {selectFields.map((field) => (
          <TextField
            key={field.key}
            select
            label={field.label}
            value={text(field.key)}
            disabled={disabled}
            onChange={(event) => setField(field.key, event.target.value)}
          >
            {Object.entries(field.options).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        ))}
        <TextField
          label="Skonto (%)"
          value={text('skonto_rate')}
          inputProps={{ inputMode: 'decimal' }}
          helperText={note(fields.field_flags['skonto_rate'])}
          disabled={disabled}
          onChange={(event) => setField('skonto_rate', event.target.value)}
        />
        <TextField
          label="Skontofrist"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={text('skonto_due_date')}
          disabled={disabled}
          helperText={note(fields.field_flags['skonto_due_date'])}
          onChange={(event) => setField('skonto_due_date', event.target.value)}
        />
        <TextField
          label="IBAN eintragen oder ersetzen"
          value={draft['supplier_iban'] ?? ''}
          disabled={disabled}
          helperText={
            note(fields.field_flags['supplier_iban']) ||
            fields.supplier_iban_masked ||
            undefined
          }
          onChange={(event) => setField('supplier_iban', event.target.value)}
        />
        <TextField
          label="USt-IdNr. eintragen oder ersetzen"
          value={draft['supplier_vat_id'] ?? ''}
          disabled={disabled}
          helperText={note(fields.field_flags['supplier_vat_id'])}
          onChange={(event) => setField('supplier_vat_id', event.target.value)}
        />
      </Box>
      <Box
        component="fieldset"
        sx={{
          m: 0,
          minWidth: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <legend>USt-Aufteilung</legend>
        {fields.field_flags['vat_lines'] && (
          <Box component="p" sx={{ mt: 0 }}>
            {note(fields.field_flags['vat_lines'])}
          </Box>
        )}
        <Stack spacing={1}>
          {vat.map((row, index) => (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              key={index}
            >
              {(
                [
                  ['rate', 'USt (%)'],
                  ['net', 'Netto'],
                  ['vat', 'Umsatzsteuer'],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  size="small"
                  value={row[key]}
                  disabled={disabled}
                  inputProps={{
                    inputMode: 'decimal',
                    'aria-label': `${label} Zeile ${index + 1}`,
                  }}
                  onChange={(event) =>
                    setVat(
                      vat.map((item, pos) =>
                        pos === index
                          ? { ...item, [key]: event.target.value }
                          : item
                      )
                    )
                  }
                />
              ))}
              <Button
                disabled={disabled}
                onClick={() => setVat(vat.filter((_, pos) => pos !== index))}
              >
                Zeile entfernen
              </Button>
            </Stack>
          ))}
          <Button
            sx={{ alignSelf: 'flex-start' }}
            disabled={disabled}
            onClick={() => setVat([...vat, { rate: '', net: '', vat: '' }])}
          >
            USt-Zeile hinzufügen
          </Button>
        </Stack>
      </Box>
    </Stack>
  )
}
