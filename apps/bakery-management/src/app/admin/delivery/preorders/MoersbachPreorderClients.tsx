'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorState,
  LoadingState,
  PageLayout,
} from '../../../../components/layout'
import PreorderForm from '../../preorders/PreorderForm'
import PreorderDetailClient from '../../preorders/[id]/PreorderDetailClient'
import {
  fetchPickupPoints,
  preorderErrorMessage,
} from '../../../../lib/preordersApi'
import { type Preorder } from '../../../../lib/preordersTypes'
import { moersbachListHref } from './preorderTypes'

export { MOERSBACH_LIST_HREF, moersbachListHref } from './preorderTypes'

export interface MoersbachNewPreorderClientProps {
  initialDate?: string
  initialPickupPointId?: string
}

/**
 * Vorbestellung für die Sammelstelle erfassen (P2): die allgemeine Maske
 * (P1, mit Sorten) mit vorbelegter Sammelstelle. Danach zurück auf den
 * Liefertag der Mörsbach-Liste mit „gespeichert“ - wie früher.
 */
export function MoersbachNewPreorderClient({
  initialDate,
  initialPickupPointId,
}: MoersbachNewPreorderClientProps) {
  const router = useRouter()
  const [pointId, setPointId] = useState(initialPickupPointId ?? '')
  const [pointName, setPointName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Ohne Sammelstelle in der URL die erste aktive - sonst stünde die Maske
  // auf „Laden“. Der Name steht im Untertitel.
  useEffect(() => {
    let active = true
    fetchPickupPoints()
      .then((points) => {
        if (!active) return
        if (initialPickupPointId) {
          const chosen = points.find((p) => p.id === initialPickupPointId)
          if (chosen) setPointName(chosen.name)
          return
        }
        const first = points.find((p) => p.active !== false) ?? points[0]
        if (first) {
          setPointId(first.id)
          setPointName(first.name)
        } else setError('Es ist keine Sammelstelle angelegt.')
      })
      .catch((err) => {
        // Mit Sammelstelle aus der URL geht es auch ohne Namen weiter.
        if (active && !initialPickupPointId) {
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

  const back = () => router.push(moersbachListHref(initialDate, false, pointId))

  return (
    <PageLayout
      title="Neue Vorbestellung"
      subtitle={pointName ? `Abholung: ${pointName}` : undefined}
      back={{
        href: moersbachListHref(initialDate, false, pointId),
        label: 'Zurück zur Sammelstelle',
      }}
    >
      {error ? (
        <ErrorState message={error} />
      ) : !pointId ? (
        <LoadingState label="Sammelstelle wird geladen …" />
      ) : (
        <PreorderForm
          initialDate={initialDate}
          initialPickupPointId={pointId}
          onCancel={back}
          onSaved={(saved: Preorder) => {
            // `saving` bleibt in der Maske stehen, bis die Seite wechselt -
            // eine zweite Bestellung kann so nicht entstehen.
            router.push(
              moersbachListHref(saved.pickupDate, true, saved.pickupPointId)
            )
            router.refresh()
          }}
        />
      )}
    </PageLayout>
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
      backHref={(preorder) =>
        moersbachListHref(preorder?.pickupDate, false, preorder?.pickupPointId)
      }
      backLabel="Zurück zur Sammelstelle"
    />
  )
}
