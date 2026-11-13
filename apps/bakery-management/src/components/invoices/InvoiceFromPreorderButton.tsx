'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button } from '@mui/material'
import { ReceiptLong as InvoiceIcon } from '@mui/icons-material'
import {
  createInvoice,
  existingInvoiceId,
  invoiceErrorMessage,
} from '../../lib/invoicesApi'

/**
 * „Rechnung erstellen“ auf der Seite einer Vorbestellung (nur Inhaber): legt
 * einen Entwurf mit den Positionen der Vorbestellung an und öffnet ihn. Gibt
 * es für die Vorbestellung schon eine Rechnung (409 `invoice_exists`), wird
 * die geöffnet.
 */
export default function InvoiceFromPreorderButton({
  preorderId,
}: {
  preorderId: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const invoice = await createInvoice({ preorderId })
      router.push(`/admin/rechnungen/${invoice.id}`)
    } catch (err) {
      const existing = existingInvoiceId(err)
      if (existing !== null) {
        router.push(`/admin/rechnungen/${existing}`)
        return
      }
      setError(
        invoiceErrorMessage(err, 'Die Rechnung konnte nicht angelegt werden.')
      )
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        alignItems: 'flex-start',
        '@media print': { display: 'none' },
      }}
    >
      <Button
        variant="outlined"
        startIcon={<InvoiceIcon />}
        onClick={create}
        disabled={busy}
      >
        Rechnung erstellen
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
