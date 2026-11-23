'use client'

import React from 'react'
import Link from 'next/link'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { formatEuro, formatReportDate } from '../../lib/reportFormat'
import {
  formatReceiptMoney,
  receiptHref,
  type ReceiptBooking,
  type ReceiptMatches,
  type ReceiptTarget,
} from '../../lib/receiptsApi'

const LABELS = {
  betrag: 'Passender Betrag',
  skonto: 'Skonto',
  teilzahlung: 'Teilzahlung',
  teilzahlungen: 'Mehrere Teilzahlungen',
  sammellastschrift: 'Sammellastschrift',
}

export function bookingLabel(booking: ReceiptBooking) {
  return [
    formatReportDate(booking.booking_date),
    booking.counterparty ?? booking.booking_text ?? 'Buchung',
    formatReceiptMoney(booking.amount, booking.currency),
    booking.status === 'vorgemerkt' ? 'vorgemerkt' : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function TargetLink({ target }: { target: ReceiptTarget }) {
  const label = target.kind === 'invoice' ? 'Rechnung' : 'Beleg'
  const href =
    target.kind === 'invoice'
      ? '/admin/rechnungen/' + target.target_id
      : receiptHref(target.target_id)
  return (
    <Link href={href}>
      {label} {target.invoice_number ?? target.target_id}
      {target.name ? ' · ' + target.name : ''}
    </Link>
  )
}

export function ReceiptMatchCards({
  matches,
  disabled,
  onConfirm,
  onReject,
  onReplace,
}: {
  matches: ReceiptMatches
  disabled?: boolean
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  onReplace: (
    link: ReceiptMatches['links'][number],
    booking: ReceiptBooking
  ) => void
}) {
  return (
    <Stack spacing={1.5}>
      {matches.links.map((link) => (
        <Paper
          key={link.id}
          variant="outlined"
          sx={{ p: 1.5, overflowWrap: 'anywhere' }}
        >
          <Typography fontWeight={600}>
            Verknüpft · {formatEuro(link.amount_cents / 100)}
          </Typography>
          {link.target ? (
            <TargetLink target={link.target} />
          ) : (
            <Typography>
              {link.kind === 'invoice' ? 'Rechnung' : 'Beleg'} {link.target_id}
            </Typography>
          )}
          {link.booking && (
            <Typography>
              <Link href={`/admin/finance/buchungen/${link.booking.id}`}>
                {bookingLabel(link.booking)}
              </Link>
            </Typography>
          )}
          {link.review_required && (
            <>
              <Alert severity="warning" sx={{ my: 1 }}>
                Bitte prüfen. Die Buchung vom{' '}
                {formatReportDate(link.booking_date)} ist unter der bisherigen
                ID nicht verfügbar.
              </Alert>
              {link.replacements.map((booking) => (
                <Box key={booking.id} sx={{ mb: 1 }}>
                  <Typography>{bookingLabel(booking)}</Typography>
                  <Button
                    size="small"
                    disabled={disabled}
                    onClick={() => onReplace(link, booking)}
                  >
                    Ersatzbuchung verknüpfen
                  </Button>
                </Box>
              ))}
            </>
          )}
        </Paper>
      ))}
      {matches.proposals.map((match) => (
        <Paper
          key={match.id}
          variant="outlined"
          sx={{ p: 1.5, overflowWrap: 'anywhere' }}
        >
          <Typography fontWeight={600}>
            Passt zu: {LABELS[match.type]}
          </Typography>
          {match.estimated_skonto_rate !== undefined && (
            <Typography variant="body2">
              ⚠ Bitte prüfen – {match.estimated_skonto_rate} % Skonto geschätzt.
            </Typography>
          )}
          {match.ambiguous && (
            <Typography variant="body2">
              ⚠ Bitte prüfen – es gibt ähnlich passende Vorschläge.
            </Typography>
          )}
          {match.parts.map((part) => (
            <Box
              key={`${part.booking.id}:${part.target.kind}:${part.target.target_id}`}
              sx={{ my: 1 }}
            >
              <Typography>{bookingLabel(part.booking)}</Typography>
              {part.booking.purpose && (
                <Typography variant="body2">{part.booking.purpose}</Typography>
              )}
              <Typography variant="body2">
                <TargetLink target={part.target} /> ·{' '}
                {formatEuro(part.amount_cents / 100)}
              </Typography>
            </Box>
          ))}
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Button
              variant="outlined"
              disabled={disabled}
              onClick={() => onConfirm(match.id)}
            >
              Ja, verknüpfen
            </Button>
            <Button disabled={disabled} onClick={() => onReject(match.id)}>
              Vorschlag ablehnen
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}
