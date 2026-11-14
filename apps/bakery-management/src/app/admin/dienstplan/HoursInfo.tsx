'use client'
import React from 'react'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Popover,
  Typography,
} from '@mui/material'
import {
  ExpandLess as LessIcon,
  ExpandMore as MoreIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material'
import {
  HOURS_INFO_ORDER,
  hoursInfo,
  type HoursInfoContext,
  type HoursInfoKey,
} from '../../../lib/dienstplanInfo'
import { TOUCH_MEDIA } from '../../../lib/muiTheme'

/**
 * Kleiner (i)-Knopf neben einer Bezeichnung: antippen oder klicken öffnet
 * die Erklärung der Regel (`dienstplanInfo.ts`) als Popover - kein Tooltip,
 * weil Touch kein Hover kennt. Escape oder ein Tipp daneben schließt.
 */
export function InfoButton({
  info,
  context,
}: {
  info: HoursInfoKey
  context?: HoursInfoContext
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const text = hoursInfo(info, context)
  const id = React.useId()
  return (
    <>
      <IconButton
        size="small"
        aria-label={`Erklärung: ${text.title}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-controls={anchor ? id : undefined}
        data-testid={`info-${info}`}
        onClick={(e) => {
          // nicht die Zeile/Karte darunter auslösen
          e.stopPropagation()
          setAnchor(e.currentTarget)
        }}
        sx={{
          p: 0.25,
          ml: 0.25,
          // die Zeile nicht höher machen als der Text
          my: '-4px',
          verticalAlign: 'middle',
          color: 'text.secondary',
          // Touch: 44 px Trefferfläche, ohne die Bezeichnung umzubrechen -
          // die Fläche wächst unsichtbar über den kleinen Knopf hinaus.
          [TOUCH_MEDIA]: {
            '&::after': { content: '""', position: 'absolute', inset: -12 },
          },
        }}
      >
        <InfoIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Popover
        id={id}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': text.title,
            sx: { p: 2, maxWidth: 340 },
          } as object,
        }}
      >
        <Box data-testid={`info-popover-${info}`}>
          <InfoContent info={info} context={context} />
        </Box>
      </Popover>
    </>
  )
}

function InfoContent({
  info,
  context,
  headingComponent = 'h2',
}: {
  info: HoursInfoKey
  context?: HoursInfoContext
  headingComponent?: 'h2' | 'h4'
}) {
  const text = hoursInfo(info, context)
  return (
    <>
      <Typography
        variant="subtitle2"
        component={headingComponent}
        sx={{ mb: 0.5 }}
      >
        {text.title}
      </Typography>
      {text.paragraphs.map((p) => (
        <Typography
          key={p}
          variant="body2"
          color="text.secondary"
          sx={{ mb: 0.75, '&:last-of-type': { mb: 0 } }}
        >
          {p}
        </Typography>
      ))}
    </>
  )
}

/**
 * „So rechnet die App“: alle Regeln der Stunden auf einen Blick,
 * eingeklappt - dieselben Texte wie die (i)-Knöpfe.
 */
export function HowItWorks({ context }: { context: HoursInfoContext }) {
  const [open, setOpen] = React.useState(false)
  const id = React.useId()
  return (
    <Box data-testid="hours-how-it-works">
      <Button
        size="small"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        startIcon={<InfoIcon />}
        endIcon={open ? <LessIcon /> : <MoreIcon />}
        sx={{ [TOUCH_MEDIA]: { minHeight: 44 } }}
      >
        So rechnet die App
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box
          id={id}
          sx={{
            mt: 1,
            p: { xs: 1.5, md: 2 },
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {HOURS_INFO_ORDER.map((key) => (
            <Box key={key}>
              <InfoContent info={key} context={context} headingComponent="h4" />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
