'use client'
import React from 'react'
import { Button } from '@mui/material'
import { Lock as LockIcon } from '@mui/icons-material'
import Link from 'next/link'
import { EmptyState, PageLayout } from '../layout'

/**
 * Ersatz für eine Seite, die die Rolle des angemeldeten Benutzers nicht
 * öffnen darf (`ROLE_ACCESS` in src/lib/roles.ts). Die API würde die Daten
 * ohnehin mit 403 verweigern - so steht wenigstens da, warum.
 */
export default function NoAccess({
  roleLabel,
  startPath,
  reason,
}: {
  roleLabel: string
  startPath: string
  /** Eigene Begründung statt „für die Rolle … nicht freigegeben“. */
  reason?: string
}) {
  return (
    <PageLayout title="Kein Zugriff" width="narrow">
      <EmptyState
        icon={<LockIcon />}
        title={
          reason ??
          `Diese Seite ist für die Rolle „${roleLabel}“ nicht freigegeben.`
        }
        action={
          <Button variant="contained" component={Link} href={startPath}>
            Zur Startseite
          </Button>
        }
      />
    </PageLayout>
  )
}
