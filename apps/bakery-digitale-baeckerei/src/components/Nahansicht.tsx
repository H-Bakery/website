'use client'
import React, { useEffect, useId, useRef, useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { ladeNahansicht } from './ladeNahansicht'
import { TOUCH_TARGET, WENIGER_BEWEGUNG, rand } from './theme'

export const ZURUECK_TEXT = 'Zurück'
export const NAHANSICHT_LADEN_TEXT = 'Das 3D-Modell wird geladen …'
export const NAHANSICHT_FEHLER_TEXT =
  'Das 3D-Modell konnte nicht geladen werden. Prüf deine Verbindung und versuch es noch einmal.'
export const NAHANSICHT_OHNE_WEBGL_TEXT =
  'Die 3D-Ansicht lässt sich auf diesem Gerät gerade nicht öffnen.'
export const NAHANSICHT_UNTERBROCHEN_TEXT =
  'Die 3D-Ansicht wurde unterbrochen. Du kannst sie neu laden.'
export const NAHANSICHT_NOCHMAL_TEXT = 'Noch einmal versuchen'
export const NAHANSICHT_BEDIENUNG_TOUCH =
  'Ziehen zum Drehen · Zwei Finger zum Zoomen'
export const NAHANSICHT_BEDIENUNG_MAUS =
  'Ziehen zum Drehen · Mausrad zum Zoomen'
/** Ein Gerät mit Maus: der Hinweis nennt das Mausrad statt der zwei Finger. */
const MIT_MAUS = '@media (hover: hover) and (pointer: fine)'

export const nahansichtLabel = (name: string) => `3D-Modell: ${name}`
export const nahansichtBereitAnsage = (name: string) =>
  `Das 3D-Modell von ${name} ist geladen. Mit den Pfeiltasten drehst du es, mit Plus und Minus zoomst du.`

/** Hintergrund der Bühne - derselbe Wert wie in createNahansicht.ts (BUEHNE). */
const BUEHNE_FARBE = '#efe9df'
/** Schrift auf der hellen Bühne, in beiden Farbschemata. */
const BUEHNE_TEXT = '#3b2b28'

/** Platz für einen Dialog neben dem Laden: Desktop. Sonst füllt er das Bild. */
const ALS_DIALOG = '@media (min-width: 900px) and (min-height: 501px)'

type Phase = 'laden' | 'bereit' | 'fehler' | 'kein-webgl' | 'unterbrochen'

export interface NahansichtProps {
  /** Name des Produkts: Überschrift und Beschriftung des Bildes. */
  name: string
  /** Adresse der GLB-Datei. */
  url: string
  /** Größe der Datei in Bytes, für den Fortschritt. */
  bytes?: number
  onClose: () => void
}

/**
 * Die Nahansicht eines Produkts: sein 3D-Modell zum Drehen und Zoomen. Auf
 * dem Handy füllt sie das Bild, auf dem Desktop ist sie ein Dialog. Der
 * 3D-Code und das Modell werden erst hier geladen; beim Schließen wird alles
 * freigegeben. Scheitert etwas, steht hier eine Meldung - die Produktkarte
 * dahinter bleibt, wie sie war.
 */
export default function Nahansicht({
  name,
  url,
  bytes,
  onClose,
}: NahansichtProps) {
  const titelId = useId()
  const [wenigBewegung] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(WENIGER_BEWEGUNG).matches
  )
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titelId}
      transitionDuration={wenigBewegung ? 0 : 200}
      data-testid="nahansicht"
      PaperProps={{
        sx: {
          m: 0,
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          [ALS_DIALOG]: {
            width: 'min(960px, calc(100vw - 64px))',
            height: 'min(720px, calc(100dvh - 64px))',
            borderRadius: 2,
          },
        },
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
          pt: rand('top', 6),
          pb: 0.75,
          pl: rand('left', 8),
          pr: rand('right', 16),
        }}
      >
        <Button
          onClick={onClose}
          startIcon={<ArrowBackIcon aria-hidden />}
          sx={{
            minHeight: TOUCH_TARGET,
            minWidth: TOUCH_TARGET,
            flexShrink: 0,
            color: 'text.primary',
          }}
        >
          {ZURUECK_TEXT}
        </Button>
        <Typography
          id={titelId}
          component="h2"
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: '1.1rem',
            fontWeight: 700,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Typography>
      </Box>
      <Buehne
        name={name}
        url={url}
        bytes={bytes}
        wenigBewegung={wenigBewegung}
      />
    </Dialog>
  )
}

function Buehne({
  name,
  url,
  bytes,
  wenigBewegung,
}: {
  name: string
  url: string
  bytes?: number
  wenigBewegung: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('laden')
  const [fortschritt, setFortschritt] = useState(0)
  /** Neuer Wert = noch einmal von vorn. */
  const [versuch, setVersuch] = useState(0)
  const label = nahansichtLabel(name)

  useEffect(() => {
    const knoten = container.current
    if (!knoten) return undefined
    let aktiv = true
    let abbauen: (() => void) | null = null
    let debug = false
    try {
      debug = new URLSearchParams(window.location.search).has('debug')
    } catch {
      /* ohne Messhaken */
    }
    ladeNahansicht()
      .then((baue) => {
        if (!aktiv) return
        const handle = baue(knoten, {
          url,
          bytes,
          label,
          reducedMotion: wenigBewegung,
          debug,
          onProgress: (f) => {
            if (aktiv) setFortschritt(f)
          },
          onReady: () => {
            if (aktiv) setPhase('bereit')
          },
          onError: () => {
            if (aktiv) setPhase('fehler')
          },
          onLost: () => {
            if (aktiv) setPhase('unterbrochen')
          },
        })
        if (!handle) {
          setPhase('kein-webgl')
          return
        }
        abbauen = handle.dispose
      })
      .catch(() => {
        if (aktiv) setPhase('fehler')
      })
    return () => {
      aktiv = false
      abbauen?.()
    }
  }, [url, bytes, label, wenigBewegung, versuch])

  const nochmal = () => {
    setFortschritt(0)
    setPhase('laden')
    setVersuch((n) => n + 1)
  }

  const meldung =
    phase === 'fehler'
      ? NAHANSICHT_FEHLER_TEXT
      : phase === 'kein-webgl'
      ? NAHANSICHT_OHNE_WEBGL_TEXT
      : phase === 'unterbrochen'
      ? NAHANSICHT_UNTERBROCHEN_TEXT
      : ''
  const zeigtBild = phase === 'laden' || phase === 'bereit'

  return (
    <Box
      data-testid="nahansicht-buehne"
      data-phase={phase}
      sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        // Die Bühne bleibt hell, auch im Dark Mode - wie die Szene des Ladens.
        backgroundColor: BUEHNE_FARBE,
        color: BUEHNE_TEXT,
      }}
    >
      {/* Der Rahmen des Canvas: bei jedem Versuch ein neuer, leerer Knoten. */}
      <Box
        key={versuch}
        ref={container}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          visibility: zeigtBild ? 'visible' : 'hidden',
          '& canvas': { outline: 'none', cursor: 'grab' },
          '& canvas:active': { cursor: 'grabbing' },
          '& canvas:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: '-3px',
          },
        }}
      />

      {phase === 'laden' && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            p: 3,
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ width: 'min(100%, 280px)', textAlign: 'center' }}>
            <Typography sx={{ mb: 1.5 }}>{NAHANSICHT_LADEN_TEXT}</Typography>
            <LinearProgress
              variant="determinate"
              value={Math.round(Math.min(1, Math.max(0, fortschritt)) * 100)}
              aria-label={NAHANSICHT_LADEN_TEXT}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        </Box>
      )}

      {meldung && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            p: 2,
          }}
        >
          <Paper
            role="alert"
            elevation={3}
            sx={{ width: 'min(100%, 360px)', p: 2.5, textAlign: 'center' }}
          >
            <Typography component="p" data-testid="nahansicht-meldung">
              {meldung}
            </Typography>
            {phase !== 'kein-webgl' && (
              <Button variant="contained" onClick={nochmal} sx={{ mt: 2 }}>
                {NAHANSICHT_NOCHMAL_TEXT}
              </Button>
            )}
          </Paper>
        </Box>
      )}

      {phase === 'bereit' && (
        <Typography
          variant="body2"
          aria-hidden
          sx={{
            flexShrink: 0,
            textAlign: 'center',
            px: 2,
            pt: 0.5,
            pb: rand('bottom', 8),
            opacity: 0.8,
          }}
        >
          <Box
            component="span"
            data-testid="nahansicht-hinweis-touch"
            sx={{ [MIT_MAUS]: { display: 'none' } }}
          >
            {NAHANSICHT_BEDIENUNG_TOUCH}
          </Box>
          <Box
            component="span"
            data-testid="nahansicht-hinweis-maus"
            sx={{ display: 'none', [MIT_MAUS]: { display: 'inline' } }}
          >
            {NAHANSICHT_BEDIENUNG_MAUS}
          </Box>
        </Typography>
      )}

      {/* Immer im DOM, damit Screenreader den später eingesetzten Text ansagen. */}
      <Box
        role="status"
        data-testid="nahansicht-status"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {phase === 'laden'
          ? NAHANSICHT_LADEN_TEXT
          : phase === 'bereit'
          ? nahansichtBereitAnsage(name)
          : ''}
      </Box>
    </Box>
  )
}
