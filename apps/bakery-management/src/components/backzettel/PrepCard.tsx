'use client'

import React from 'react'
import { Alert, List, ListItem, ListItemText, Typography } from '@mui/material'
import { PageSection } from '../layout'
import type { PrepTask } from '../../lib/backzettelApi'
import { formatDateLong } from '../../lib/backzettelFormat'

export interface PrepCardProps {
  prep: PrepTask[] | null
  prepDate: string
  prepDateProvisional: boolean | null
}

/** Text einer Vorbereitung: „Sauerteig (Buttermilch)“. */
export function prepTaskLabel(task: PrepTask): string {
  // Die Ausprägung kommt als YAML-ID („misch“); groß geschrieben liest sie
  // sich wie der Rest der Seite („Sauerteig (Misch)“).
  // W4-verify r2: Umlaute kann die ID nicht („gross“); dafür gibt es in der
  // YAML `variant_labels` - steht dort ein Name, gilt er.
  if (!task.variant) return task.name
  if (task.variantLabel) return `${task.name} (${task.variantLabel})`
  const v = task.variant.charAt(0).toUpperCase() + task.variant.slice(1)
  return `${task.name} (${v})`
}

/** Vorbereitungen für den Tag - erledigt am Vortag um 14 Uhr. */
export function PrepCard({
  prep,
  prepDate,
  prepDateProvisional,
}: PrepCardProps) {
  const tasks = prep ?? []
  // „Vorbereitung am Vortag“, nicht nur „Vorbereitung“: der Zettel hat oft
  // selbst einen Abschnitt „Vorbereitung“ (Sauerteig-Ansatz) - zwei gleiche
  // Überschriften auf einer Seite lasen sich wie ein Fehler.
  return (
    <PageSection
      title="Vorbereitung am Vortag"
      description={`${formatDateLong(prepDate)}, ab 14 Uhr`}
      data-testid="prep-card"
    >
      {prepDateProvisional && (
        <Alert severity="info" sx={{ mb: 1 }} data-testid="prep-provisional">
          Der Vortag ist Ruhetag. Wann und von wem diese Vorbereitung erledigt
          wird, ist noch nicht festgelegt.
        </Alert>
      )}
      {tasks.length === 0 ? (
        <Typography variant="body2">Keine Vorbereitung eingetragen.</Typography>
      ) : (
        <List dense disablePadding>
          {tasks.map((t) => (
            <ListItem key={t.id} disableGutters>
              <ListItemText
                primary={prepTaskLabel(t)}
                secondary={t.note || undefined}
              />
            </ListItem>
          ))}
        </List>
      )}
    </PageSection>
  )
}

export default PrepCard
