'use client'
import React, { useEffect, useId, useRef, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import {
  BEWEGUNG_OK,
  EBENE,
  SEITLICH,
  SEITLICH_ABFRAGE,
  TOUCH_TARGET,
  rand,
} from './theme'
import type { ProduktInfo } from '../lib/produkte/types'

export const MEHR_LESEN_TEXT = 'Mehr lesen'
export const WENIGER_TEXT = 'Weniger'
export const WEBSITE_LINK_TEXT = 'Mehr auf der Website'

/** So weit muss man das Sheet nach unten ziehen, damit es zugeht (px). */
export const ZIEH_SCHWELLE = 64

export interface ProduktSheetProps {
  /** `null` = geschlossen */
  produkt: ProduktInfo | null
  onClose: () => void
  /**
   * Eine unsichtbare Fläche über der Szene schließt das Sheet beim Tippen
   * daneben (Standard). Mit `false` bleibt die Szene bedienbar, während das
   * Sheet offen ist - dann schließt die Szene es selbst über `onClose`.
   */
  hintergrundSchliesst?: boolean
}

const vonUnten = keyframes({
  from: { transform: 'translateY(24px)', opacity: 0 },
  to: { transform: 'none', opacity: 1 },
})

/**
 * Infos zum angetippten Produkt: unten als Sheet (zugeklappt höchstens 45 %
 * der Höhe, damit das Produkt sichtbar bleibt), auf dem Desktop und im
 * Querformat als Karte am rechten Rand. Ohne Angaben zu Kosten oder
 * Inhaltsstoffen (DB8).
 */
export default function ProduktSheet({
  produkt,
  onClose,
  hintergrundSchliesst = true,
}: ProduktSheetProps) {
  if (!produkt) return null
  return (
    <OffenesSheet
      produkt={produkt}
      onClose={onClose}
      hintergrundSchliesst={hintergrundSchliesst}
    />
  )
}

function OffenesSheet({
  produkt,
  onClose,
  hintergrundSchliesst,
}: {
  produkt: ProduktInfo
  onClose: () => void
  hintergrundSchliesst: boolean
}) {
  const titelId = useId()
  const textId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const zugStart = useRef<number | null>(null)
  const [zug, setZug] = useState(0)
  /** id des Produkts, dessen langer Text offen ist - ein neues Produkt startet zugeklappt. */
  const [mehrFuer, setMehrFuer] = useState<string | null>(null)
  const mehr = mehrFuer === produkt.id

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Fokus ins Sheet, beim Schließen zurück dorthin, wo er vorher war.
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null
    sheet.current?.focus({ preventScroll: true })
    return () => {
      if (vorher && vorher.isConnected && typeof vorher.focus === 'function') {
        vorher.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const langerText = produkt.text.trim()
  const hatLangenText =
    langerText !== '' && langerText !== produkt.kurztext.trim()

  const zugEnde = (schliessen: boolean) => {
    zugStart.current = null
    setZug(0)
    if (schliessen) onClose()
  }

  return (
    <>
      {hintergrundSchliesst && (
        <Box
          data-testid="sheet-hintergrund"
          aria-hidden
          onClick={onClose}
          sx={{ position: 'fixed', inset: 0, zIndex: EBENE.sheet }}
        />
      )}
      <Paper
        ref={sheet}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titelId}
        tabIndex={-1}
        elevation={8}
        data-testid="produkt-sheet"
        data-aufgeklappt={mehr}
        style={zug > 0 ? { transform: `translateY(${zug}px)` } : undefined}
        sx={{
          position: 'fixed',
          zIndex: EBENE.sheet,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          // Zugeklappt bleibt mehr als die Hälfte des Bildes frei.
          maxHeight: mehr ? '80dvh' : '45dvh',
          borderRadius: '16px 16px 0 0',
          pb: 'env(safe-area-inset-bottom)',
          outline: 'none',
          [BEWEGUNG_OK]: { animation: `${vonUnten} 200ms ease-out` },
          [SEITLICH]: {
            left: 'auto',
            bottom: 'auto',
            top: rand('top'),
            right: rand('right'),
            width: 'min(380px, 44vw)',
            maxHeight: 'calc(100dvh - 24px)',
            borderRadius: 2,
            pb: 0,
          },
        }}
      >
        {/* Kopf = Griff zum Herunterziehen */}
        <Box
          data-testid="sheet-griff"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button, a')) return
            if (window.matchMedia(SEITLICH_ABFRAGE).matches) return
            zugStart.current = event.clientY
          }}
          onPointerMove={(event) => {
            if (zugStart.current === null) return
            setZug(Math.max(0, event.clientY - zugStart.current))
          }}
          onPointerUp={(event) => {
            if (zugStart.current === null) return
            zugEnde(event.clientY - zugStart.current > ZIEH_SCHWELLE)
          }}
          onPointerCancel={() => zugEnde(false)}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            pl: 2.5,
            pr: 1,
            pt: 2.25,
            pb: 0.5,
            touchAction: 'none',
            [SEITLICH]: { pt: 1.25, touchAction: 'auto' },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 8,
              left: '50%',
              width: 40,
              height: 4,
              ml: '-20px',
              borderRadius: 2,
              bgcolor: 'text.secondary',
              opacity: 0.5,
              [SEITLICH]: { display: 'none' },
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0, py: 0.75 }}>
            <Typography
              id={titelId}
              component="h2"
              sx={{
                fontSize: '1.2rem',
                fontWeight: 700,
                lineHeight: 1.25,
                overflowWrap: 'anywhere',
              }}
            >
              {produkt.name}
            </Typography>
            {produkt.einheit && (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid="sheet-einheit"
              >
                {produkt.einheit}
              </Typography>
            )}
          </Box>
          <IconButton
            aria-label="Schließen"
            onClick={onClose}
            sx={{
              width: TOUCH_TARGET,
              height: TOUCH_TARGET,
              flexShrink: 0,
              color: 'text.primary',
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            px: 2.5,
            pb: 2,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {produkt.kurztext && (
            <Typography sx={{ lineHeight: 1.5 }}>{produkt.kurztext}</Typography>
          )}
          {hatLangenText && mehr && (
            <Typography
              id={textId}
              sx={{ mt: 1.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}
            >
              {langerText}
            </Typography>
          )}
          {(hatLangenText || produkt.seite) && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 1,
                mt: 1,
                ml: -1,
              }}
            >
              {hatLangenText && (
                <Button
                  onClick={() => setMehrFuer(mehr ? null : produkt.id)}
                  aria-expanded={mehr}
                  aria-controls={mehr ? textId : undefined}
                >
                  {mehr ? WENIGER_TEXT : MEHR_LESEN_TEXT}
                </Button>
              )}
              {produkt.seite && (
                <Button
                  component="a"
                  href={produkt.seite}
                  target="_blank"
                  rel="noopener"
                  endIcon={<OpenInNewIcon aria-hidden sx={{ fontSize: 18 }} />}
                >
                  {WEBSITE_LINK_TEXT}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Paper>
    </>
  )
}
