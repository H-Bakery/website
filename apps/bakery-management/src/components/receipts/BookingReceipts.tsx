'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Typography } from '@mui/material'
import { ReceiptUpload } from './ReceiptUpload'
import { ReceiptMatchCards } from './ReceiptMatchCards'
import { ErrorState, LoadingState, PageSection } from '../layout'
import { classifyFinanceError } from '../../lib/financeApi'
import {
  fetchReceiptMatches,
  linkReceipt,
  rejectReceiptMatch,
  type ReceiptMatches,
} from '../../lib/receiptsApi'

export function BookingReceipts({ bookingId }: { bookingId: string }) {
  const [matches, setMatches] = useState<ReceiptMatches | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(
    () => fetchReceiptMatches({ buchung: bookingId }),
    [bookingId]
  )

  useEffect(() => {
    let active = true
    load()
      .then((result) => {
        if (active) setMatches(result)
      })
      .catch((error) => {
        if (active)
          setError(
            classifyFinanceError(
              error,
              'Die Belegverknüpfungen konnten nicht geladen werden.'
            ).message
          )
      })
    return () => {
      active = false
    }
  }, [load])

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setMatches(await load())
    } catch (err) {
      setError(
        classifyFinanceError(
          err,
          'Die Belegverknüpfungen konnten nicht aktualisiert werden.'
        ).message
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageSection title="Belege und Rechnungen">
      <ReceiptUpload bookingId={bookingId} disabled={busy} />
      {error && (
        <ErrorState
          message={error}
          onRetry={() => void act(async () => undefined)}
        />
      )}
      {!matches && !error && (
        <LoadingState label="Verknüpfungen werden geladen" dense />
      )}
      {matches &&
        (matches.links.length || matches.proposals.length ? (
          <ReceiptMatchCards
            matches={matches}
            disabled={busy}
            onConfirm={(proposal_id) =>
              void act(() => linkReceipt({ proposal_id }))
            }
            onReject={(id) => void act(() => rejectReceiptMatch(id))}
            onReplace={(link, booking) =>
              void act(() =>
                linkReceipt({
                  transaction_id: booking.id,
                  kind: link.kind,
                  target_id: link.target_id,
                  replace_link_id: link.id,
                })
              )
            }
          />
        ) : (
          <Typography sx={{ mt: 1 }} color="text.secondary">
            Keine Verknüpfung vorhanden.
          </Typography>
        ))}
    </PageSection>
  )
}
