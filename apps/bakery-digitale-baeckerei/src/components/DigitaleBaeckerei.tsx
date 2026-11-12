'use client'
import React, { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import lock from '../../model.lock.json'
import {
  START_BLICKPUNKT_ID,
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
} from '../config/raeume'
import { modelUrl } from '../lib/basePath'
import Ladeanzeige from './Ladeanzeige'
import { SCENE_BACKDROP } from './theme'

/** three.js und die Szene erst im Browser nachladen - nie im ersten Bundle. */
const Viewer3D = dynamic(() => import('./Viewer3D'), {
  ssr: false,
  loading: () => null,
})

export const TITEL = 'Digitale Bäckerei'
export const KEIN_WEBGL_TEXT =
  'Dein Gerät oder Browser kann die 3D-Ansicht leider nicht zeigen. Probier es mit einem aktuellen Browser noch einmal.'
export const FEHLER_TEXT =
  'Der Laden konnte nicht geladen werden. Prüf deine Verbindung und versuch es noch einmal.'
export const UNTERBROCHEN_TEXT =
  'Die 3D-Ansicht wurde unterbrochen. Du kannst sie neu laden.'
export const BEREIT_TEXT = 'Der Laden ist geladen. Du stehst an der Theke.'

type Zustand = 'laden' | 'bereit' | 'kein-webgl' | 'fehler' | 'unterbrochen'

const modelBytes = (file: string): number | undefined =>
  (lock.files as Record<string, { bytes: number } | undefined>)[file]?.bytes

export default function DigitaleBaeckerei() {
  const raum = findeRaum(START_RAUM_ID)
  const blickpunkt = raum && findeBlickpunkt(raum, START_BLICKPUNKT_ID)

  const [zustand, setZustand] = useState<Zustand>('laden')
  const [fortschritt, setFortschritt] = useState(0)
  /** Neuer Wert = Szene neu aufbauen („Noch einmal versuchen“). */
  const [versuch, setVersuch] = useState(0)

  const onProgress = useCallback((f: number) => setFortschritt(f), [])
  const onReady = useCallback(() => setZustand('bereit'), [])
  const onUnavailable = useCallback(() => setZustand('kein-webgl'), [])
  const onError = useCallback(() => setZustand('fehler'), [])
  const onLost = useCallback(() => setZustand('unterbrochen'), [])

  const nochmal = () => {
    setFortschritt(0)
    setZustand('laden')
    setVersuch((n) => n + 1)
  }

  if (!raum || !blickpunkt) return null

  const zeigtSzene = zustand === 'laden' || zustand === 'bereit'
  const hinweis =
    zustand === 'kein-webgl'
      ? KEIN_WEBGL_TEXT
      : zustand === 'fehler'
      ? FEHLER_TEXT
      : zustand === 'unterbrochen'
      ? UNTERBROCHEN_TEXT
      : ''

  return (
    <Box
      component="main"
      data-zustand={zustand}
      sx={{
        position: 'fixed',
        inset: 0,
        // dvh: auf dem Handy ohne die ein- und ausfahrende Adressleiste
        height: '100dvh',
        overflow: 'hidden',
        // Die Szene bleibt hell, auch im Dark Mode.
        backgroundColor: SCENE_BACKDROP,
      }}
    >
      {zeigtSzene && (
        <Viewer3D
          key={versuch}
          modelUrl={modelUrl(raum.modell)}
          modelBytes={modelBytes(raum.modell)}
          blickpunkt={blickpunkt}
          fuellung={raum.fuellung}
          label={`3D-Ansicht der Bäckerei, Blickpunkt ${blickpunkt.name}`}
          onProgress={onProgress}
          onReady={onReady}
          onUnavailable={onUnavailable}
          onError={onError}
          onLost={onLost}
        />
      )}

      <Paper
        component="header"
        elevation={2}
        sx={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
          px: 1.5,
          py: 1,
          maxWidth: 'calc(100% - 24px)',
        }}
      >
        <Typography variant="h1">{TITEL}</Typography>
        <Typography variant="body2" color="text.secondary">
          Blickpunkt: {blickpunkt.name}
        </Typography>
      </Paper>

      {zustand === 'laden' && <Ladeanzeige fortschritt={fortschritt} />}

      {/* Die Status-Region steht immer im DOM, damit Screenreader den später
          eingesetzten Text auch ansagen. */}
      <Box
        role="status"
        data-testid="status"
        sx={
          hinweis
            ? {
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                p: 2,
              }
            : {
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }
        }
      >
        {hinweis ? (
          <Paper
            elevation={3}
            sx={{ width: 'min(100%, 360px)', p: 2.5, textAlign: 'center' }}
          >
            <Typography component="p">{hinweis}</Typography>
            {zustand !== 'kein-webgl' && (
              <Button variant="contained" onClick={nochmal} sx={{ mt: 2 }}>
                {zustand === 'fehler' ? 'Noch einmal versuchen' : 'Neu laden'}
              </Button>
            )}
          </Paper>
        ) : zustand === 'bereit' ? (
          BEREIT_TEXT
        ) : (
          ''
        )}
      </Box>
    </Box>
  )
}
