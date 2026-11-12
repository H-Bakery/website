'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { gruppiereEintraege } from './produktliste'
import { rand } from './theme'
import type { BlickpunktKurz, ListenEintrag } from './typen'

export const OHNE_WEBGL_TEXT =
  'Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar.'
export const OHNE_WEBGL_TITEL = 'Die Bäckerei als Liste'
export const BEREICH_LEER_TEXT = 'Hier liegt gerade nichts.'

export interface OhneWebGLProps {
  blickpunkte: BlickpunktKurz[]
  /** Plätze je Blickpunkt-id; gleiche Produkte werden eine Zeile */
  eintraegeJe: Record<string, ListenEintrag[]>
  /**
   * `ersatz` (Standard): die ganze Seite statt der 3D-Ansicht, mit Meldung.
   * `screenreader`: dieselbe Liste unsichtbar neben der laufenden 3D-Ansicht,
   * ohne die Meldung.
   */
  variante?: 'ersatz' | 'screenreader'
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
  blickpunkte,
  eintraegeJe,
  variante = 'ersatz',
}: OhneWebGLProps) {
  const ersatz = variante === 'ersatz'

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
        {/* Die Status-Region steht immer im DOM, nur ihr Text hängt von der Variante ab. */}
        <Paper
          role="status"
          variant="outlined"
          sx={
            ersatz
              ? { px: 2, py: 1.5, mb: 2.5, bgcolor: 'action.hover' }
              : UNSICHTBAR
          }
        >
          {ersatz ? `${OHNE_WEBGL_TEXT} Hier findest du alles als Liste.` : ''}
        </Paper>

        <Typography
          component="h2"
          sx={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2, mb: 2 }}
        >
          {OHNE_WEBGL_TITEL}
        </Typography>

        {blickpunkte.map((blickpunkt) => {
          const zeilen = gruppiereEintraege(eintraegeJe[blickpunkt.id] ?? [])
          const titelId = `ohne-webgl-${blickpunkt.id}`
          return (
            <Box
              component="section"
              key={blickpunkt.id}
              aria-labelledby={titelId}
              sx={{ mb: 3 }}
            >
              <Typography
                id={titelId}
                component="h3"
                sx={{ fontSize: '1.15rem', fontWeight: 700, mb: 1 }}
              >
                {blickpunkt.name}
              </Typography>
              {zeilen.length === 0 ? (
                <Typography color="text.secondary">
                  {BEREICH_LEER_TEXT}
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
                        <Typography variant="body2" sx={{ mt: 0.25 }}>
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
    </Box>
  )
}
