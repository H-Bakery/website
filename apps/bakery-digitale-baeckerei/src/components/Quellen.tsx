'use client'
import React, { useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Link from '@mui/material/Link'
import ReplayIcon from '@mui/icons-material/Replay'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { TOUCH_TARGET, WENIGER_BEWEGUNG } from './theme'

export const QUELLEN_TITEL = 'Quellen'
export const INTRO_NOCHMAL_TEXT = 'Flug von der Straße noch einmal ansehen'

export interface QuellenProps {
  /** Zeigt den Flug zum Start noch einmal. Ohne diese Funktion fehlt der Knopf. */
  onIntroNochmal?: () => void
}

const extern = { target: '_blank', rel: 'noopener noreferrer' } as const

/**
 * Kleiner Eintrag „Quellen“, der die Herkunft von Modell und Außenraum in
 * einem Dialog nennt (Plan, Abschnitt „Rechte und Datenschutz“).
 */
export default function Quellen({ onIntroNochmal }: QuellenProps = {}) {
  const [offen, setOffen] = useState(false)
  const titelId = useId()
  const wenigerBewegung = useMediaQuery(WENIGER_BEWEGUNG)

  return (
    <>
      <Button
        color="inherit"
        size="small"
        onClick={() => setOffen(true)}
        aria-haspopup="dialog"
        sx={{
          minHeight: TOUCH_TARGET,
          minWidth: TOUCH_TARGET,
          px: 1.5,
          color: 'text.secondary',
          fontSize: '0.8125rem',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {QUELLEN_TITEL}
      </Button>
      <Dialog
        open={offen}
        onClose={() => setOffen(false)}
        aria-labelledby={titelId}
        transitionDuration={wenigerBewegung ? 0 : undefined}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id={titelId} component="h2">
          {QUELLEN_TITEL}
        </DialogTitle>
        <DialogContent>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li + li': { mt: 1.25 } }}>
            <Typography component="li" variant="body2">
              Gelände und Gebäude außen (verändert): © GeoBasis-DE/LVGL-SL
              (2026),{' '}
              <Link
                href="https://www.govdata.de/dl-de/by-2-0"
                sx={{ whiteSpace: 'nowrap' }}
                {...extern}
              >
                dl-de/by-2-0
              </Link>
            </Typography>
            <Typography component="li" variant="body2">
              Straßen: ©{' '}
              <Link
                href="https://www.openstreetmap.org/copyright"
                sx={{ whiteSpace: 'nowrap' }}
                {...extern}
              >
                OpenStreetMap-Mitwirkende
              </Link>
              , ODbL
            </Typography>
            <Typography component="li" variant="body2">
              3D-Modell: aus dem{' '}
              <Link
                href="https://github.com/Open-Kirrberg/saar-lidar-explorer"
                {...extern}
              >
                Saar LiDAR Explorer
              </Link>{' '}
              (Code unter MIT-Lizenz)
            </Typography>
            <Typography component="li" variant="body2">
              Software: three.js, MUI und React (jeweils MIT-Lizenz)
            </Typography>
            <Typography component="li" variant="body2">
              Name, Schriftzug und Texte gehören der Bäckerei Heusser.
            </Typography>
          </Box>
          {onIntroNochmal && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={<ReplayIcon aria-hidden />}
              onClick={() => {
                setOffen(false)
                onIntroNochmal()
              }}
              sx={{ mt: 2.5, borderRadius: 999 }}
            >
              {INTRO_NOCHMAL_TEXT}
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOffen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
