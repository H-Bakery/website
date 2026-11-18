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
import {
  DATENSCHUTZ_PFAD,
  DATENSCHUTZ_TEXT,
  IMPRESSUM_PFAD,
  IMPRESSUM_TEXT,
  NEUER_TAB,
} from '../lib/links'
import { TOUCH_TARGET, WENIGER_BEWEGUNG } from './theme'

export const QUELLEN_TITEL = 'Quellen'
export const INTRO_NOCHMAL_TEXT = 'Flug von der Straße noch einmal ansehen'
export const RECHTLICHES_TITEL = 'Rechtliches'

export interface QuellenProps {
  /** Zeigt den Flug zum Start noch einmal. Ohne diese Funktion fehlt der Knopf. */
  onIntroNochmal?: () => void
}

/** „Quellen“ und „Impressum“ in der Leiste: klein, leise, aber 44 px hoch. */
const LEISE = {
  minHeight: TOUCH_TARGET,
  minWidth: TOUCH_TARGET,
  px: 1.5,
  color: 'text.secondary',
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  '&:hover': { textDecoration: 'underline' },
} as const

/** Ein Link im Dialog, der allein steht: als Touch-Ziel 44 px hoch. */
const RECHTS_LINK = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: TOUCH_TARGET,
} as const

/**
 * Kleiner Eintrag „Quellen“, der die Herkunft von Modell und Außenraum in
 * einem Dialog nennt (Plan, Abschnitt „Rechte und Datenschutz“), daneben der
 * Link auf das Impressum der Landingpage. Der Dialog nennt Impressum und
 * Datenschutzerklärung noch einmal.
 */
export default function Quellen({ onIntroNochmal }: QuellenProps = {}) {
  const [offen, setOffen] = useState(false)
  const titelId = useId()
  const rechtlichesId = useId()
  const wenigerBewegung = useMediaQuery(WENIGER_BEWEGUNG)

  return (
    <>
      {/* Wird es eng (unter 320 px oder mit großer Schrift), rutscht
          „Impressum“ unter „Quellen“, statt „Alles hier“ daneben so
          zusammenzudrücken, dass die Beschriftung aus dem Knopf läuft. */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <Button
          color="inherit"
          size="small"
          onClick={() => setOffen(true)}
          aria-haspopup="dialog"
          sx={LEISE}
        >
          {QUELLEN_TITEL}
        </Button>
        {/* Ein einfaches <a>, kein next/link: Das hängte den Unterpfad davor. */}
        <Button
          component="a"
          href={IMPRESSUM_PFAD}
          color="inherit"
          size="small"
          sx={LEISE}
          {...NEUER_TAB}
        >
          {IMPRESSUM_TEXT}
        </Button>
      </Box>
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
                {...NEUER_TAB}
              >
                dl-de/by-2-0
              </Link>
            </Typography>
            <Typography component="li" variant="body2">
              Straßen: ©{' '}
              <Link
                href="https://www.openstreetmap.org/copyright"
                sx={{ whiteSpace: 'nowrap' }}
                {...NEUER_TAB}
              >
                OpenStreetMap-Mitwirkende
              </Link>
              , ODbL
            </Typography>
            <Typography component="li" variant="body2">
              3D-Modell: aus dem{' '}
              <Link
                href="https://github.com/Open-Kirrberg/saar-lidar-explorer"
                {...NEUER_TAB}
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
          <Box
            component="section"
            aria-labelledby={rechtlichesId}
            sx={{ mt: 2 }}
          >
            <Typography
              id={rechtlichesId}
              component="h3"
              variant="subtitle2"
              sx={{ fontWeight: 700 }}
            >
              {RECHTLICHES_TITEL}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3 }}>
              <Link href={IMPRESSUM_PFAD} sx={RECHTS_LINK} {...NEUER_TAB}>
                {IMPRESSUM_TEXT}
              </Link>
              <Link href={DATENSCHUTZ_PFAD} sx={RECHTS_LINK} {...NEUER_TAB}>
                {DATENSCHUTZ_TEXT}
              </Link>
            </Box>
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
