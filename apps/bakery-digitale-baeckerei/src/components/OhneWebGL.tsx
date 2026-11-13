'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { BlickpunktKurz } from '../config/raeume'
import type { ListenZeile } from '../lib/karte'
import { KEINE_PRODUKTINFOS_TEXT, gruppiereEintraege } from './produktliste'
import { rand } from './theme'

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
 * Einheit und Kurztext. Ersatz, wenn das Gerät kein 3D kann, und der Weg für
 * Screenreader.
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
                        </Box>
                      ))}
                    </Paper>
                  )}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
