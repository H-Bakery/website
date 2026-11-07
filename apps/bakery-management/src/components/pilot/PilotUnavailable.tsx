'use client'
import React from 'react'
import { Button } from '@mui/material'
import { Block as BlockIcon } from '@mui/icons-material'
import Link from 'next/link'
import { EmptyState, PageLayout } from '../layout'

/**
 * Ersatzseite für Routen, die im Pilotbetrieb gesperrt sind
 * (`NEXT_PUBLIC_PILOT_MODE=1`, siehe src/lib/pilotMode.ts). Wird von
 * admin/layout.tsx anstelle der eigentlichen Seite gezeigt.
 */
export default function PilotUnavailable() {
  return (
    <PageLayout title="Im Pilotbetrieb nicht verfügbar" width="narrow">
      <EmptyState
        icon={<BlockIcon />}
        title="Diese Seite ist während des Pilotbetriebs noch nicht freigegeben."
        action={
          <Button variant="contained" component={Link} href="/admin">
            Zum Dashboard
          </Button>
        }
      />
    </PageLayout>
  )
}
