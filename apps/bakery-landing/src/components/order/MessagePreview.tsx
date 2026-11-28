'use client'

import { useState, type MouseEvent } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { QRCodeSVG } from 'qrcode.react'

export function MessagePreview({
  message,
  url,
  onSend,
  onFollowUp,
}: {
  message: string
  url: string | null
  onSend: (event: MouseEvent<HTMLAnchorElement>) => void
  onFollowUp: () => void
}) {
  const [copyStatus, setCopyStatus] = useState('')

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopyStatus('Text kopiert.')
    } catch {
      setCopyStatus(
        'Kopieren fehlgeschlagen. Markieren und kopieren Sie den Text in der Vorschau.'
      )
    }
  }

  return (
    <Stack spacing={1.5}>
      <Typography component="h3" variant="subtitle1" fontWeight={700}>
        Ihre Nachricht
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          bgcolor: '#ecf4e9',
          color: 'text.primary',
          borderRadius: '16px 16px 16px 4px',
          font: 'inherit',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          userSelect: 'text',
        }}
      >
        {message}
      </Box>
      {url ? (
        <Button
          variant="contained"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSend}
          startIcon={<WhatsAppIcon />}
          sx={{ minHeight: 44 }}
        >
          Per WhatsApp senden
        </Button>
      ) : (
        <Typography fontWeight={700} role="status">
          Für große Bestellungen bitte anrufen.
        </Typography>
      )}
      <Button variant="outlined" onClick={copyMessage} sx={{ minHeight: 44 }}>
        Text kopieren
      </Button>
      <Typography variant="body2" role="status">
        {copyStatus}
      </Typography>
      {url && (
        <Stack
          spacing={1}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' } }}
        >
          <Typography variant="body2">
            Scannen Sie den QR-Code mit Ihrem Handy.
          </Typography>
          <QRCodeSVG
            value={url}
            size={280}
            includeMargin
            aria-label="QR-Code für Ihre WhatsApp-Nachricht"
            role="img"
          />
          <Button onClick={onFollowUp} sx={{ minHeight: 44 }}>
            Nachricht abgeschickt?
          </Button>
        </Stack>
      )}
    </Stack>
  )
}
