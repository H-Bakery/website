'use client'
import React from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { BlickpunktKurz } from '../config/raeume'
import { type Karte, type ListenZeile, hatLangenText } from '../lib/karte'
import {
  DATENSCHUTZ_PFAD,
  DATENSCHUTZ_TEXT,
  IMPRESSUM_PFAD,
  IMPRESSUM_TEXT,
  NEUER_TAB,
  STARTSEITE_PFAD,
  STARTSEITE_TEXT,
} from '../lib/links'
import { MEHR_LESEN_TEXT, WEBSITE_LINK_TEXT } from './ProduktSheet'
import { KEINE_PRODUKTINFOS_TEXT, gruppiereEintraege } from './produktliste'
import { TOUCH_TARGET, rand } from './theme'

export const OHNE_WEBGL_TEXT =
  'Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar.'
export const OHNE_WEBGL_ZUSATZ = 'Hier findest du alles als Liste.'
export const OHNE_WEBGL_TITEL = 'Die Bäckerei als Liste'
export const BEREICH_LEER_TEXT = KEINE_PRODUKTINFOS_TEXT

/** Die Listen eines Raums: je Blickpunkt, was dort liegt oder steht. */
export interface RaumListen {
  id: string
  name: string
  blickpunkte: readonly BlickpunktKurz[]
  /** Plätze und Infopunkte je Blickpunkt-id; gleiche Produkte werden eine Zeile */
  eintraegeJe: Record<string, ListenZeile[]>
  /** Text eines leeren Abschnitts (sonst der für Produktinfos). */
  leerText?: string
}

export interface OhneWebGLProps {
  /**
   * Die Räume, die gelistet werden. Bei einem Raum bleibt sein Name weg (die
   * Abschnitte sind seine Blickpunkte); bei mehreren bekommt jeder Raum eine
   * eigene Überschrift.
   */
  raeume: readonly RaumListen[]
  /**
   * `ersatz` (Standard): die ganze Seite statt der 3D-Ansicht, mit Meldung.
   * `screenreader`: dieselbe Liste unsichtbar neben der laufenden 3D-Ansicht,
   * ohne die Meldung.
   */
  variante?: 'ersatz' | 'screenreader'
  /** Anderer Text der Meldung (Variante `ersatz`), z. B. nach einem Ladefehler. */
  meldung?: string
  /** Bedienelement unter der Meldung, z. B. „Noch einmal versuchen“. */
  aktion?: React.ReactNode
}

const UNSICHTBAR = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const

/**
 * Alles, was im Laden liegt, als Text: je Blickpunkt ein Abschnitt mit Name,
 * Einheit, Kurztext und - wenn es ihn gibt - dem langen Text. Ersatz, wenn das
 * Gerät kein 3D kann (dann mit „Mehr auf der Website“ und einem Fuß mit
 * Impressum und Datenschutz), und der Weg für Screenreader.
 */
export default function OhneWebGL({
  raeume,
  variante = 'ersatz',
  meldung = `${OHNE_WEBGL_TEXT} ${OHNE_WEBGL_ZUSATZ}`,
  aktion,
}: OhneWebGLProps) {
  const ersatz = variante === 'ersatz'
  const mehrere = raeume.length > 1

  return (
    <Box
      data-testid="ohne-webgl"
      sx={
        ersatz
          ? {
              position: 'absolute',
              inset: 0,
              overflowY: 'auto',
              bgcolor: 'background.default',
              color: 'text.primary',
              // oben Platz für die Titelkarte der App
              pt: 'calc(max(12px, env(safe-area-inset-top)) + 76px)',
              pb: rand('bottom', 24),
              pl: rand('left', 16),
              pr: rand('right', 16),
            }
          : UNSICHTBAR
      }
    >
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        {/* Neben der laufenden 3D-Ansicht gibt es nichts zu melden - dort
            sagt die Status-Region der App an, was geschieht. */}
        {ersatz && (
          <Paper
            role="status"
            variant="outlined"
            sx={{ px: 2, py: 1.5, mb: 2.5, bgcolor: 'action.hover' }}
          >
            <Typography component="p">{meldung}</Typography>
            {aktion && <Box sx={{ mt: 1.5 }}>{aktion}</Box>}
          </Paper>
        )}

        <Typography
          component="h2"
          sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2, mb: 2 }}
        >
          {OHNE_WEBGL_TITEL}
        </Typography>

        {raeume.map((raum) => (
          <Box
            key={raum.id}
            component={mehrere ? 'section' : 'div'}
            data-raum={raum.id}
            aria-labelledby={mehrere ? `ohne-webgl-raum-${raum.id}` : undefined}
          >
            {mehrere && (
              <Typography
                id={`ohne-webgl-raum-${raum.id}`}
                component="h3"
                sx={{ fontSize: '1.3rem', fontWeight: 700, mb: 1.5 }}
              >
                {raum.name}
              </Typography>
            )}
            {raum.blickpunkte.map((blickpunkt) => {
              const zeilen = gruppiereEintraege(
                raum.eintraegeJe[blickpunkt.id] ?? []
              )
              const titelId = `ohne-webgl-${raum.id}-${blickpunkt.id}`
              return (
                <Box
                  component="section"
                  key={blickpunkt.id}
                  aria-labelledby={titelId}
                  sx={{ mb: 3 }}
                >
                  <Typography
                    id={titelId}
                    component={mehrere ? 'h4' : 'h3'}
                    sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 1 }}
                  >
                    {blickpunkt.name}
                  </Typography>
                  {zeilen.length === 0 ? (
                    <Typography color="text.secondary">
                      {raum.leerText ?? BEREICH_LEER_TEXT}
                    </Typography>
                  ) : (
                    <Paper
                      component="ul"
                      variant="outlined"
                      sx={{ m: 0, p: 0, listStyle: 'none', overflow: 'hidden' }}
                    >
                      {zeilen.map(({ produkt }) => (
                        <Box
                          component="li"
                          key={produkt.id}
                          sx={{
                            px: 2,
                            py: 1.25,
                            '& + li': {
                              borderTop: '1px solid',
                              borderColor: 'divider',
                            },
                          }}
                        >
                          <Typography
                            component="span"
                            sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
                          >
                            {produkt.name}
                          </Typography>
                          {produkt.einheit && (
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                            >
                              {' · '}
                              {produkt.einheit}
                            </Typography>
                          )}
                          {produkt.kurztext && (
                            <Typography sx={{ mt: 0.25, lineHeight: 1.45 }}>
                              {produkt.kurztext}
                            </Typography>
                          )}
                          <Mehr produkt={produkt} ersatz={ersatz} />
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>
              )
            })}
          </Box>
        ))}

        {ersatz && <Fuss />}
      </Box>
    </Box>
  )
}

/** Leise Links im Fuß: 44 px hoch, unterstrichen. */
const FUSS_LINK = {
  minHeight: TOUCH_TARGET,
  px: 1,
  color: 'text.secondary',
  fontSize: '0.875rem',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  '&:hover': { textDecoration: 'underline' },
} as const

/**
 * Langer Text und „Mehr auf der Website“ unter dem Kurztext.
 *
 * Im Ersatz klappt der lange Text in einem `<details>` auf (geht ohne
 * JavaScript-Zustand und bleibt nach dem Aufklappen stehen). Neben der
 * laufenden 3D-Ansicht steht er offen da und ohne Link: Die Liste ist dort
 * unsichtbar - ein Link oder ein `<summary>` wäre ein Tab-Halt, den niemand
 * sieht.
 */
function Mehr({ produkt, ersatz }: { produkt: Karte; ersatz: boolean }) {
  const lang = hatLangenText(produkt) ? produkt.text.trim() : null
  if (!ersatz) {
    return lang ? (
      <Typography sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>{lang}</Typography>
    ) : null
  }
  if (!lang && !produkt.seite) return null
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        columnGap: 1,
        mt: 0.25,
        // Die Touch-Ziele (44 px) reichen in den Rand der Zeile hinein, der
        // Text darin steht bündig mit Name und Kurztext.
        mb: -1,
        ml: -1,
      }}
    >
      {lang && (
        <Box
          component="details"
          sx={{
            minWidth: 0,
            // Aufgeklappt bekommt der Text die ganze Breite; der Link
            // rutscht darunter.
            '&[open]': { flexBasis: '100%' },
            '&[open] > summary svg': { transform: 'rotate(180deg)' },
          }}
        >
          <Box
            component="summary"
            sx={{
              display: 'flex',
              width: 'fit-content',
              alignItems: 'center',
              gap: 0.25,
              minHeight: TOUCH_TARGET,
              px: 1,
              borderRadius: 1,
              cursor: 'pointer',
              listStyle: 'none',
              color: 'primary.main',
              fontSize: '0.875rem',
              fontWeight: 500,
              '&::-webkit-details-marker': { display: 'none' },
              '@media (hover: hover)': {
                '&:hover': { bgcolor: 'action.hover' },
              },
              '&:focus-visible': {
                outline: '3px solid',
                outlineOffset: 2,
              },
            }}
          >
            {MEHR_LESEN_TEXT}
            <ExpandMoreIcon aria-hidden sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            sx={{ px: 1, pb: 1.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}
          >
            {lang}
          </Typography>
        </Box>
      )}
      {produkt.seite && (
        <Button
          component="a"
          href={produkt.seite}
          endIcon={<OpenInNewIcon aria-hidden sx={{ fontSize: 18 }} />}
          {...NEUER_TAB}
        >
          {WEBSITE_LINK_TEXT}
        </Button>
      )}
    </Box>
  )
}

/**
 * Fuß des Ersatzes: Startseite, Impressum und Datenschutzerklärung der
 * Landingpage (gleicher Ursprung, darum wurzelrelativ und ein einfaches `<a>`).
 */
function Fuss() {
  return (
    <Box
      component="footer"
      sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, ml: -1 }}>
        {(
          [
            [STARTSEITE_PFAD, STARTSEITE_TEXT],
            [IMPRESSUM_PFAD, IMPRESSUM_TEXT],
            [DATENSCHUTZ_PFAD, DATENSCHUTZ_TEXT],
          ] as const
        ).map(([href, text]) => (
          <Button
            key={href}
            component="a"
            href={href}
            color="inherit"
            sx={FUSS_LINK}
            {...NEUER_TAB}
          >
            {text}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
