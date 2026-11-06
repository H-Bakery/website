'use client'

import React from 'react'
import {
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import type { PrepTask } from '../../lib/backzettelApi'
import { formatDateLong } from '../../lib/backzettelFormat'

export interface PrepCardProps {
  prep: PrepTask[] | null
  prepDate: string
  prepDateProvisional: boolean | null
}

/** Text einer Vorbereitung: „Sauerteig (Buttermilch)". */
export function prepTaskLabel(task: PrepTask): string {
  return task.variant ? `${task.name} (${task.variant})` : task.name
}

/** Vorbereitungen für den Tag - erledigt am Vortag um 14 Uhr. */
export function PrepCard({
  prep,
  prepDate,
  prepDateProvisional,
}: PrepCardProps) {
  const tasks = prep ?? []
  return (
    <Card variant="outlined" sx={{ mb: 2 }} data-testid="prep-card">
      <CardContent>
        <Typography variant="h6" component="h2">
          Vorbereitung
        </Typography>
        <Typography variant="body2" color="text.secondary">
          am Vortag, {formatDateLong(prepDate)}, ab 14 Uhr
        </Typography>
        {prepDateProvisional && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Der Vortag ist Ruhetag. Wann und von wem diese Vorbereitung erledigt
            wird, ist noch nicht festgelegt.
          </Alert>
        )}
        {tasks.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Keine Vorbereitung eingetragen.
          </Typography>
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
      </CardContent>
    </Card>
  )
}

export default PrepCard
