'use client'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
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
  ueberDerLeiste,
} from './theme'
import type { Karte } from '../lib/karte'

export const MEHR_LESEN_TEXT = 'Mehr lesen'
export const WENIGER_TEXT = 'Weniger'
export const WEBSITE_LINK_TEXT = 'Mehr auf der Website'
export const NAHANSICHT_TEXT = 'In 3D ansehen'

/** So weit muss man das Sheet nach unten ziehen, damit es zugeht (px). */
export const ZIEH_SCHWELLE = 64

/**
 * Ein Wisch auf dem Text ist entschieden, sobald er sich so weit bewegt hat
 * (px): nach unten am Anfang des Textes zieht er die Karte, sonst scrollt er.
 */
export const WISCH_ENTSCHEIDUNG = 6

/** Hochkant steht die Karte so weit über der Leiste (px). */
const UEBER_LEISTE = ueberDerLeiste(6)

export interface ProduktSheetProps {
  /** Inhalt der Karte - ein Produkt oder ein Infopunkt; `null` = geschlossen */
  produkt: Karte | null
  onClose: () => void
  /**
   * Eine unsichtbare Fläche über der Szene schließt das Sheet beim Tippen
   * daneben (Standard). Mit `false` bleibt die Szene bedienbar, während das
   * Sheet offen ist - dann schließt die Szene es selbst über `onClose`.
   */
  hintergrundSchliesst?: boolean
  /**
   * Den Fokus ins Sheet holen (Standard) - richtig, wenn es über Tastatur
   * oder Liste geöffnet wurde. Mit `false` bleibt der Fokus, wo er ist: nach
   * einem Tipp ins Bild sollen Pfeiltasten und +/- weiter der Szene gelten.
   */
  fokus?: boolean
  /** Eine kurze Zeile unter dem Namen, z. B. dass das Produkt gerade nicht im Bild ist. */
  hinweis?: string
  /**
   * Öffnet die Nahansicht des Produkts. Nur gesetzt, wenn es für dieses
   * Produkt ein 3D-Modell gibt - sonst gibt es den Knopf nicht.
   */
  onNahansicht?: () => void
}

const vonUnten = keyframes({
  from: { transform: 'translateY(24px)', opacity: 0 },
  to: { transform: 'none', opacity: 1 },
})

/**
 * Infos zum angetippten Produkt: hochkant als Sheet direkt über der
 * Blickpunkt-Leiste (die bedienbar bleibt; zugeklappt nehmen Karte und
 * Leiste zusammen höchstens die halbe Höhe ein, damit das Produkt sichtbar
 * bleibt), auf dem Desktop und im Querformat als Karte am rechten Rand, die
 * über der Leiste endet. Zu geht sie auch mit einem Wisch nach unten - am
 * Griff oder auf dem Text, wenn er ganz oben steht. Ohne Angaben zu Kosten
 * oder Inhaltsstoffen (DB8).
 */
export default function ProduktSheet({
  produkt,
  onClose,
  hintergrundSchliesst = true,
  fokus = true,
  hinweis,
  onNahansicht,
}: ProduktSheetProps) {
  if (!produkt) return null
  return (
    <OffenesSheet
      produkt={produkt}
      onClose={onClose}
      hintergrundSchliesst={hintergrundSchliesst}
      fokus={fokus}
      hinweis={hinweis}
      onNahansicht={onNahansicht}
    />
  )
}

function OffenesSheet({
  produkt,
  onClose,
  hintergrundSchliesst,
  fokus,
  hinweis,
  onNahansicht,
}: {
  produkt: Karte
  onClose: () => void
  hintergrundSchliesst: boolean
  fokus: boolean
  hinweis?: string
  onNahansicht?: () => void
}) {
  const titelId = useId()
  const textId = useId()
  const sheet = useRef<HTMLDivElement>(null)
  const inhalt = useRef<HTMLDivElement>(null)
  /** Startpunkt des laufenden Ziehens (Griff oder Text); `null` = es zieht nichts. */
  const zugStart = useRef<number | null>(null)
  /** Ein Wisch auf dem Text, über den noch nicht entschieden ist: sein Startpunkt. */
  const wischStart = useRef<number | null>(null)
  /** Der Zeiger (`pointerId`), der zieht oder wischt: Andere Finger ändern nichts. */
  const zeigerId = useRef<number | null>(null)
  const [zug, setZug] = useState(0)
  /** id des Produkts, dessen langer Text offen ist - ein neues Produkt startet zugeklappt. */
  const [mehrFuer, setMehrFuer] = useState<string | null>(null)
  const mehr = mehrFuer === produkt.id

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Fokus ins Sheet (nur wenn verlangt), beim Schließen zurück dorthin, wo
  // er vorher war - aber nur, wenn er noch im Sheet steht: Wer inzwischen
  // woandershin getabbt hat, bleibt dort.
  const vorher = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!fokus) return
    const knoten = sheet.current
    if (!knoten || knoten.contains(document.activeElement)) return
    vorher.current = document.activeElement as HTMLElement | null
    knoten.focus({ preventScroll: true })
  }, [fokus, produkt.id])
  useEffect(() => {
    const knoten = sheet.current
    return () => {
      const ziel = vorher.current
      const aktiv = document.activeElement
      const imSheet =
        !aktiv || aktiv === document.body || !!knoten?.contains(aktiv)
      if (ziel && imSheet && ziel.isConnected) {
        ziel.focus({ preventScroll: true })
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

  /** Hebt die Zeiger-Ereignisse am Fenster wieder auf, solange gezogen wird. */
  const loesen = useRef<(() => void) | null>(null)
  useEffect(() => () => loesen.current?.(), [])

  const zugEnde = useCallback((schliessen: boolean) => {
    loesen.current?.()
    zugStart.current = null
    wischStart.current = null
    setZug(0)
    if (schliessen) onCloseRef.current()
  }, [])

  /**
   * Beginnt das Ziehen bei `start`. Bewegen und Loslassen liest das Fenster:
   * So zählt auch ein Loslassen neben der Karte, und sie bleibt nie halb
   * gezogen hängen.
   */
  const beginneZug = useCallback(
    (start: number, zeiger: number) => {
      zugStart.current = start
      zeigerId.current = zeiger
      if (loesen.current) return
      // Nur der ziehende Zeiger zählt - ein zweiter Finger (etwa in der
      // Szene) verschiebt die Karte nicht und beendet das Ziehen nicht.
      const vomZiehenden = (event: PointerEvent) =>
        zugStart.current !== null && event.pointerId === zeigerId.current
      const bewege = (event: PointerEvent) => {
        if (!vomZiehenden(event)) return
        setZug(Math.max(0, event.clientY - (zugStart.current ?? 0)))
      }
      const lasseLos = (event: PointerEvent) => {
        if (!vomZiehenden(event)) return
        zugEnde(event.clientY - (zugStart.current ?? 0) > ZIEH_SCHWELLE)
      }
      const brichAb = (event: PointerEvent) => {
        if (vomZiehenden(event)) zugEnde(false)
      }
      window.addEventListener('pointermove', bewege)
      window.addEventListener('pointerup', lasseLos)
      window.addEventListener('pointercancel', brichAb)
      loesen.current = () => {
        window.removeEventListener('pointermove', bewege)
        window.removeEventListener('pointerup', lasseLos)
        window.removeEventListener('pointercancel', brichAb)
        loesen.current = null
      }
    },
    [zugEnde]
  )

  /**
   * Zieht dieser Wisch auf dem Text die Karte? Entschieden wird beim ersten
   * deutlichen Schritt: nach unten, solange der Text ganz oben steht, zieht
   * er sie - sonst scrollt er den Text wie gewohnt.
   */
  const ziehtVomText = useCallback(
    (y: number, zeiger?: number): boolean => {
      if (zugStart.current !== null) return true
      const start = wischStart.current
      if (start === null) return false
      // Ein anderer Finger entscheidet nicht über diesen Wisch.
      if (zeiger !== undefined && zeiger !== zeigerId.current) return false
      const weg = y - start
      if (Math.abs(weg) < WISCH_ENTSCHEIDUNG) return false
      wischStart.current = null
      if (weg < 0 || (inhalt.current?.scrollTop ?? 0) > 0) return false
      beginneZug(start, zeigerId.current ?? 0)
      setZug(weg)
      return true
    },
    [beginneZug]
  )

  // Solange die Karte gezogen wird, scrollt der Text nicht mit. Das geht nur
  // mit einem eigenen, nicht passiven touchmove (React meldet ihn passiv an);
  // sonst übernähme der Browser den Wisch und bräche das Ziehen ab.
  useEffect(() => {
    const knoten = inhalt.current
    if (!knoten) return undefined
    const onTouchMove = (event: TouchEvent) => {
      const finger = event.touches[0]
      if (finger && ziehtVomText(finger.clientY) && event.cancelable) {
        event.preventDefault()
      }
    }
    knoten.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => knoten.removeEventListener('touchmove', onTouchMove)
  }, [ziehtVomText])

  /** Den Zeiger an das Element binden: Losgelassen wird auch daneben. */
  const fange = (event: React.PointerEvent<HTMLElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ohne Capture (jsdom, Zeiger schon fort) liest das Fenster trotzdem
      // das Loslassen (beginneZug).
    }
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
          left: rand('left', 8),
          right: rand('right', 8),
          // Über der Leiste: Chips, „Alles hier“ und „Quellen“ bleiben frei.
          bottom: UEBER_LEISTE,
          display: 'flex',
          flexDirection: 'column',
          // Zugeklappt nehmen Karte und Leiste höchstens die halbe Höhe ein.
          maxHeight: `calc(${mehr ? 80 : 50}dvh - ${UEBER_LEISTE})`,
          // Auf niedrigen Handys bliebe aufgeklappt sonst kaum Bild übrig.
          '@media (max-height: 699px)': {
            maxHeight: `calc(${mehr ? 60 : 50}dvh - ${UEBER_LEISTE})`,
          },
          borderRadius: '16px',
          outline: 'none',
          [BEWEGUNG_OK]: { animation: `${vonUnten} 200ms ease-out` },
          [SEITLICH]: {
            left: 'auto',
            bottom: 'auto',
            top: rand('top'),
            right: rand('right'),
            width: 'min(380px, 44vw)',
            // Endet über der Leiste, auch aufgeklappt.
            maxHeight: `calc(100dvh - ${rand('top')} - ${UEBER_LEISTE})`,
            borderRadius: 2,
          },
        }}
      >
        {/* Kopf = Griff zum Herunterziehen */}
        <Box
          data-testid="sheet-griff"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            if ((event.target as HTMLElement).closest('button, a')) return
            if (window.matchMedia(SEITLICH_ABFRAGE).matches) return
            fange(event)
            beginneZug(event.clientY, event.pointerId)
          }}
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            pl: 2.5,
            pr: 1,
            pt: 1.5,
            touchAction: 'none',
            // Ziehen mit der Maus markiert keinen Text.
            userSelect: 'none',
            WebkitUserSelect: 'none',
            [SEITLICH]: {
              pt: 1.25,
              pb: 0.5,
              touchAction: 'auto',
              userSelect: 'auto',
              WebkitUserSelect: 'auto',
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 6,
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
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              // So hoch wie der Knopf daneben: kurze Titel stehen mittig.
              minHeight: TOUCH_TARGET,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              [SEITLICH]: { py: 0.75 },
            }}
          >
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
            {hinweis && (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid="sheet-hinweis"
                sx={{ mt: 0.25 }}
              >
                {hinweis}
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

        {/* Wisch nach unten auf dem Text (Touch, Stift) zieht die Karte mit. */}
        <Box
          ref={inhalt}
          data-testid="sheet-inhalt"
          onPointerDown={(event) => {
            wischStart.current = null
            if (event.pointerType === 'mouse' || !event.isPrimary) return
            if (window.matchMedia(SEITLICH_ABFRAGE).matches) return
            // Zieht schon ein anderer Zeiger, bleibt es bei ihm.
            if (zugStart.current !== null) return
            wischStart.current = event.clientY
            zeigerId.current = event.pointerId
          }}
          // Ist entschieden, liest das Fenster weiter (beginneZug).
          onPointerMove={(event) =>
            ziehtVomText(event.clientY, event.pointerId)
          }
          onPointerUp={() => {
            wischStart.current = null
          }}
          onPointerCancel={() => {
            wischStart.current = null
          }}
          sx={{
            px: 2.5,
            // Knapp: Auf kleinen Handys (360 × 640) passen so Titel, Kurztext
            // und Knöpfe in die halbe Höhe, auch über der dreizeiligen Leiste.
            pb: 0.5,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y',
            [SEITLICH]: { pb: 2 },
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
          {onNahansicht && (
            <Button
              variant="outlined"
              onClick={onNahansicht}
              startIcon={<ViewInArIcon aria-hidden />}
              sx={{ mt: 1, mb: 0.5, minHeight: TOUCH_TARGET }}
            >
              {NAHANSICHT_TEXT}
            </Button>
          )}
          {(hatLangenText || produkt.seite) && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 1,
                // Die Textknöpfe bringen ihren Abstand selbst mit (44 px hoch).
                ml: -1,
                [SEITLICH]: { mt: 1 },
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
