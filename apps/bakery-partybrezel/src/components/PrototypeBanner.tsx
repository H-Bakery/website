'use client'
import React, { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import type { OpenQuestion } from '../config/partybrezel.config'

export const BANNER_TEXT =
  'Prototyp – Platzhalterpreise, keine echte Bestellung'

export default function PrototypeBanner({
  questions,
}: {
  questions: OpenQuestion[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Box
        role="note"
        aria-label="Hinweis zum Prototyp"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          px: 2,
          py: 0.5,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 1,
          textAlign: 'center',
          // feste Farben je Modus, damit der Hinweis überall ≥ 4,5:1 hat
          backgroundColor: '#fde7b0',
          '[data-mui-color-scheme="dark"] &': { backgroundColor: '#4a3510' },
        }}
      >
        <Typography
          component="p"
          sx={{
            fontWeight: 700,
            color: '#3d2600',
            '[data-mui-color-scheme="dark"] &': { color: '#ffe6b3' },
          }}
        >
          {BANNER_TEXT}
        </Typography>
        <Button
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          sx={{
            textDecoration: 'underline',
            color: '#3d2600',
            '[data-mui-color-scheme="dark"] &': { color: '#ffe6b3' },
          }}
        >
          Offene Fragen ansehen
        </Button>
      </Box>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="open-questions-title"
        scroll="paper"
      >
        <DialogTitle id="open-questions-title">Was noch offen ist</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 2 }}>
            Dieser Prototyp zeigt nur den Ablauf. Preise, Personenzahlen, Beläge
            und Abholtage sind Platzhalter, bis diese Fragen beantwortet sind.
            Es wird nichts bestellt und nichts gesendet.
          </Typography>
          <Box component="dl" sx={{ m: 0 }}>
            {questions.map((q) => (
              <Box key={q.id} sx={{ mb: 1.5 }}>
                <Typography component="dt" sx={{ fontWeight: 700 }}>
                  {`${q.id}: ${q.title}`}
                </Typography>
                <Typography component="dd" sx={{ m: 0 }}>
                  {q.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} variant="contained">
            Schließen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
