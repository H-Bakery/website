'use client'

import React, { useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import {
  Alert,
  Button,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import {
  AddCircleOutline as NewIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material'
import PreorderForm from '../PreorderForm'
import ItemsSummary from '../../../../components/preorders/ItemsSummary'
import { PageLayout } from '../../../../components/layout'
import {
  formatCurrency,
  formatDateWithWeekday,
  formatPickupPlace,
  type Preorder,
} from '../../../../lib/preordersTypes'

export interface PreorderEntryClientProps {
  initialDate?: string
  initialPickupPointId?: string
}

/**
 * P1: Vorbestellung erfassen. Nach dem Speichern steht der Code groß da (für
 * den Abholzettel oder zum Durchsagen am Telefon), dazu ein Hinweis unten und
 * „Nächste Bestellung“ - Enter genügt, der Knopf hat den Fokus.
 */
export default function PreorderEntryClient({
  initialDate,
  initialPickupPointId,
}: PreorderEntryClientProps) {
  const [saved, setSaved] = useState<Preorder | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  // Neuer Schlüssel = frische Maske (alle Felder leer, Fokus auf Name).
  const [formKey, setFormKey] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (saved) nextRef.current?.focus()
  }, [saved])

  const next = () => {
    setSaved(null)
    setToastOpen(false)
    setFormKey((k) => k + 1)
  }

  return (
    <PageLayout
      title="Neue Vorbestellung"
      back={{ href: '/admin/preorders', label: 'Alle Vorbestellungen' }}
    >
      {saved ? (
        <Paper
          sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}
          data-testid="preorder-saved"
        >
          <DoneIcon color="success" sx={{ fontSize: 56 }} />
          <Typography variant="h2" sx={{ mt: 1 }}>
            Gespeichert
          </Typography>
          <Typography
            component="p"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2.25rem' },
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: 1,
              my: 1,
              wordBreak: 'break-all',
            }}
            aria-label={`Code ${saved.code}`}
          >
            {saved.code}
          </Typography>
          <Typography>
            {saved.customerName} · {formatDateWithWeekday(saved.pickupDate)} ·{' '}
            {formatPickupPlace(saved)}
          </Typography>
          <Typography
            color="text.secondary"
            component="div"
            sx={{ mt: 0.5, display: 'inline-block', textAlign: 'left' }}
          >
            <ItemsSummary items={saved.items} max={4} />
          </Typography>
          <Typography sx={{ mt: 0.5, fontWeight: 600 }}>
            {formatCurrency(saved.total)} ·{' '}
            {saved.paid ? 'bezahlt' : 'noch nicht bezahlt'}
          </Typography>
          {saved.afterDeadline && (
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              Nach dem Bestellschluss der Sammelstelle erfasst - bitte mit der
              Backstube abstimmen.
            </Alert>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="center"
            sx={{ mt: 3 }}
          >
            <Button
              ref={nextRef}
              variant="contained"
              size="large"
              startIcon={<NewIcon />}
              onClick={next}
              sx={{ minHeight: 52, px: 3 }}
            >
              Nächste Bestellung
            </Button>
            <Button
              component={NextLink}
              href={`/admin/preorders/${saved.id}`}
              variant="outlined"
              size="large"
              sx={{ minHeight: 52 }}
            >
              Bestellung öffnen
            </Button>
          </Stack>
        </Paper>
      ) : (
        <PreorderForm
          key={formKey}
          initialDate={formKey === 0 ? initialDate : undefined}
          initialPickupPointId={
            formKey === 0 ? initialPickupPointId : undefined
          }
          onSaved={(preorder) => {
            setSaved(preorder)
            setToastOpen(true)
          }}
        />
      )}

      <Snackbar
        open={toastOpen}
        autoHideDuration={8000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setToastOpen(false)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setToastOpen(false)}
          action={
            <Button color="inherit" size="small" onClick={next}>
              Nächste Bestellung
            </Button>
          }
          sx={{ alignItems: 'center' }}
        >
          Vorbestellung {saved?.code} gespeichert
        </Alert>
      </Snackbar>
    </PageLayout>
  )
}
