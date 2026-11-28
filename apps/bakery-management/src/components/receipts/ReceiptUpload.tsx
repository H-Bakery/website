'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Alert, Box, Button, Stack } from '@mui/material'
import { CameraAltOutlined, UploadFileOutlined } from '@mui/icons-material'
import { ApiError } from '@bakery/shared/data-access'

import { ErrorState } from '../layout'
import { classifyFinanceError } from '../../lib/financeApi'
import { receiptHref, uploadReceipt } from '../../lib/receiptsApi'

export function ReceiptUpload({
  receiptId,
  bookingId,
  disabled,
  onSaved,
}: {
  receiptId?: number
  bookingId?: string
  disabled?: boolean
  onSaved?: (id: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [duplicate, setDuplicate] = useState<number | null>(null)
  const [error, setError] = useState('')
  const main = !receiptId && !bookingId

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    setSaved(null)
    setDuplicate(null)
    try {
      const result = await uploadReceipt(file, { receiptId, bookingId })
      setSaved(result.id)
      onSaved?.(result.id)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_receipt_file') {
        const existing = err.details?.['receipt_id']
        if (typeof existing === 'number') setDuplicate(existing)
      }
      setError(
        err instanceof ApiError && err.status === 413
          ? 'Die Datei darf höchstens 15 MB groß sein.'
          : classifyFinanceError(
              err,
              'Der Beleg konnte nicht gespeichert werden.'
            ).message
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
        }}
      >
        {main && (
          <Button
            component="label"
            variant="contained"
            startIcon={<CameraAltOutlined />}
            disabled={disabled || busy}
          >
            Beleg fotografieren
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Beleg fotografieren"
              disabled={disabled || busy}
              onChange={choose}
            />
          </Button>
        )}
        <Button
          component="label"
          variant={main ? 'outlined' : 'contained'}
          startIcon={<UploadFileOutlined />}
          disabled={disabled || busy}
        >
          {receiptId
            ? 'Seite hinzufügen'
            : bookingId
            ? 'Beleg hinzufügen'
            : 'Datei wählen'}
          <input
            hidden
            type="file"
            accept={
              main
                ? '.pdf,.xml,application/pdf,application/xml,text/xml'
                : 'image/*,.heic,.pdf,.xml,application/pdf,application/xml,text/xml'
            }
            aria-label={
              receiptId
                ? 'Seite hinzufügen'
                : bookingId
                ? 'Beleg hinzufügen'
                : 'Datei wählen'
            }
            disabled={disabled || busy}
            onChange={choose}
          />
        </Button>
      </Box>
      {busy && (
        <Alert severity="info" role="status">
          Wird gespeichert …
        </Alert>
      )}
      {saved !== null && (
        <Alert
          severity="success"
          role="status"
          action={
            receiptId ? undefined : (
              <Button
                component={Link}
                href={receiptHref(saved)}
                color="inherit"
              >
                Beleg prüfen
              </Button>
            )
          }
        >
          Gespeichert - wird erkannt
        </Alert>
      )}
      {error && <ErrorState message={error} />}
      {duplicate !== null && (
        <Button component={Link} href={receiptHref(duplicate)}>
          Vorhandenen Beleg öffnen
        </Button>
      )}
    </Stack>
  )
}
