'use client'

import React, { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack } from '@mui/material'
import { ErrorState } from '../layout'
import { classifyFinanceError } from '../../lib/financeApi'
import { downloadReceiptFile, type ReceiptFile } from '../../lib/receiptsApi'

export function ReceiptFilePreview({
  receiptId,
  file,
}: {
  receiptId: number
  file: ReceiptFile
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [load, setLoad] = useState(
    file.page === 1 && file.mime.startsWith('image/')
  )
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const image = file.mime.startsWith('image/')
  const pdf = file.mime === 'application/pdf'
  useEffect(() => {
    if (!load) return
    let active = true
    let objectUrl: string | undefined
    setLoading(true)
    setError('')
    downloadReceiptFile(receiptId, file.id)
      .then(({ blob }) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => {
        if (active) {
          setLoading(false)
          setLoad(false)
          setError(
            classifyFinanceError(
              err,
              'Die Belegdatei konnte nicht geladen werden.'
            ).message
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id, load, receiptId])

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      {error && <ErrorState message={error} />}
      {image && url && !unavailable && (
        <Box
          component="a"
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Seite ${file.page} vergrößern`}
        >
          <Box
            component="img"
            src={url}
            alt={`Belegseite ${file.page}`}
            onError={() => setUnavailable(true)}
            sx={{
              maxWidth: '100%',
              maxHeight: 560,
              display: 'block',
              objectFit: 'contain',
            }}
          />
        </Box>
      )}
      {unavailable && (
        <Alert severity="info">
          Die Vorschau ist auf diesem Gerät nicht verfügbar.
        </Alert>
      )}
      {url ? (
        <Button
          component="a"
          href={url}
          target={pdf ? '_blank' : undefined}
          rel={pdf ? 'noreferrer' : undefined}
          download={
            pdf
              ? undefined
              : `Beleg-${receiptId}-${file.page}.${
                  file.mime === 'image/jpeg' ? 'jpg' : file.mime.split('/')[1]
                }`
          }
        >
          {pdf
            ? `PDF öffnen · Seite ${file.page}`
            : `Datei herunterladen · Seite ${file.page}`}
        </Button>
      ) : (
        <Button onClick={() => setLoad(true)} disabled={loading}>
          {loading
            ? `Seite ${file.page} wird geladen …`
            : `${pdf ? 'PDF' : 'Seite'} ${file.page} laden`}
        </Button>
      )}
    </Stack>
  )
}
