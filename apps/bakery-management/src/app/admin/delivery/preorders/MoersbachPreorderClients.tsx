'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import PreorderForm from '../../preorders/PreorderForm'
import PreorderDetailClient from '../../preorders/[id]/PreorderDetailClient'
import {
  fetchPickupPoints,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import { isBusinessDate, type Preorder } from '../../../../lib/preordersTypes'

/** Liste der Sammelstelle (Mörsbach). */
export const MOERSBACH_LIST_HREF = '/admin/delivery/preorders'

/** Zurück auf den Liefertag der Liste - nicht auf heute. */
export function moersbachListHref(date?: string | null, saved = false): string {
  const params = new URLSearchParams()
  if (date && isBusinessDate(date)) params.set('date', date)
  if (saved) params.set('saved', '1')
  const query = params.toString()
  return query ? `${MOERSBACH_LIST_HREF}?${query}` : MOERSBACH_LIST_HREF
}

export interface MoersbachNewPreorderClientProps {
  initialDate?: string
  initialPickupPointId?: string
}

/**
 * Vorbestellung für die Sammelstelle erfassen (P2): die allgemeine Maske
 * (P1, mit Sorten) mit vorbelegter Sammelstelle. Danach zurück auf den
 * Liefertag der Mörsbach-Liste mit „gespeichert" - wie früher.
 */
export function MoersbachNewPreorderClient({
  initialDate,
  initialPickupPointId,
}: MoersbachNewPreorderClientProps) {
  const router = useRouter()
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  const [error, setError] = useState<string | null>(null)

  // Ohne Sammelstelle in der URL die erste aktive - sonst stünde die Maske
  // auf „Laden".
  useEffect(() => {
    if (initialPickupPointId) return
    let active = true
    fetchPickupPoints()
      .then((points) => {
        if (!active) return
        const first = points.find((p) => p.active !== false) ?? points[0]
        if (first) setPointId(first.id)
        else setError('Es ist keine Sammelstelle angelegt.')
      })
      .catch((err) => {
        if (active) {
          setError(
            preorderErrorMessage(
              err,
              'Die Sammelstellen konnten nicht geladen werden.'
            )
          )
        }
      })
    return () => {
      active = false
    }
  }, [initialPickupPointId])

  const back = () => router.push(moersbachListHref(initialDate))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton
          aria-label="Zurück zur Liste"
          onClick={back}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h5"
          component="h1"
          sx={{ fontSize: { xs: '1.35rem', md: '1.75rem' } }}
        >
          Vorbestellung erfassen
        </Typography>
      </Box>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : !pointId ? (
        <Box
          sx={{ display: 'flex', justifyContent: 'center', p: 6 }}
          role="status"
          aria-label="Sammelstelle wird geladen"
        >
          <CircularProgress />
        </Box>
      ) : (
        <PreorderForm
          initialDate={initialDate}
          initialPickupPointId={pointId}
          onCancel={back}
          onSaved={(saved: Preorder) => {
            // `saving` bleibt in der Maske stehen, bis die Seite wechselt -
            // eine zweite Bestellung kann so nicht entstehen.
            router.push(moersbachListHref(saved.pickupDate, true))
            router.refresh()
          }}
        />
      )}
    </Box>
  )
}

/**
 * Eine Vorbestellung der Sammelstelle (P2): die Ansicht aus P3 (Bearbeiten,
 * Status, Stornieren mit Rückfrage), zurück geht es auf den Liefertag der
 * Mörsbach-Liste.
 */
export function MoersbachPreorderDetailClient({ id }: { id: number }) {
  return (
    <PreorderDetailClient
      id={id}
      backHref={(preorder) => moersbachListHref(preorder?.pickupDate)}
      backLabel="Zurück zur Sammelstelle"
    />
  )
}
