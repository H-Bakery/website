import React from 'react'
import { Typography, type TypographyProps } from '@mui/material'
import {
  paymentRowText,
  paymentState,
  type Preorder,
} from '../../lib/preordersTypes'

/**
 * „bezahlt" unter dem Betrag einer Listenzeile - bei einem Rest oder einer
 * Erstattung mit Betrag und hervorgehoben (W4-Verifikation Runde 3: eine
 * teilbezahlte Bestellung las sich sonst wie voll bezahlt). Unbezahlt: nichts.
 */
export default function PaymentNote({
  preorder,
  inline = false,
  ...props
}: {
  preorder: Pick<Preorder, 'paid' | 'paymentBalance' | 'total' | 'status'>
  /** In einer Zeile hinter dem Betrag (`45,00 € · bezahlt`). */
  inline?: boolean
} & Omit<TypographyProps, 'children'>) {
  const text = paymentRowText(preorder)
  if (!text) return null
  const kind = paymentState(preorder).kind
  const open = kind === 'rest' || kind === 'refund'
  return (
    <Typography
      component="span"
      variant="body2"
      color={open ? 'warning.main' : 'text.secondary'}
      data-payment={kind}
      sx={{
        display: inline ? 'inline' : 'block',
        fontWeight: open ? 700 : undefined,
        whiteSpace: 'normal',
      }}
      {...props}
    >
      {inline ? ` · ${text}` : text}
    </Typography>
  )
}
