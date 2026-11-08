import React from 'react'
import { Alert, AlertTitle } from '@mui/material'

/** Text des Hinweises (F4) - auch in Specs verwendet. */
export const OWNER_ONLY_TITLE = 'Nur für Inhaber'

/**
 * Hinweis für 403 auf `/api/reports/*` und `/api/analytics/*`: Berichte und
 * Analysen sind im Pilot nur für den Inhaber (B4). Kein Fehler - die API ist
 * erreichbar, nur nicht für diese Rolle.
 */
export default function OwnerOnlyNotice({
  what = 'Analysen',
}: {
  what?: string
}) {
  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      <AlertTitle>{OWNER_ONLY_TITLE}</AlertTitle>
      {what} sieht im Pilotbetrieb nur der Inhaber.
    </Alert>
  )
}
