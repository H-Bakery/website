'use client'
import React from 'react'
import { Box, Paper, Typography } from '@mui/material'

/**
 * Kennzahlen-Reihe (Layout-Kit, README.md): Bezeichnung, Wert, optional ein
 * Hinweis in einer Zeile. Höchstens vier je Reihe - wer mehr zeigen will,
 * entscheidet, welche vier zählen, und legt den Rest in „Details“.
 *
 * `tone` färbt nur den Wert und ist nie der einzige Träger einer Aussage:
 * „vorläufig“, „geschätzt“, „offen“ stehen als Text im `hint` oder `badge`.
 */
export type KeyFigureTone = 'default' | 'success' | 'warning' | 'error' | 'info'

export interface KeyFigure {
  label: React.ReactNode
  value: React.ReactNode
  /** Eine Zeile `text.secondary` unter dem Wert. */
  hint?: React.ReactNode
  /** Kleines Element neben der Bezeichnung (z. B. Chip „vorläufig“). */
  badge?: React.ReactNode
  tone?: KeyFigureTone
  'data-testid'?: string
}

export interface KeyFiguresProps {
  items: KeyFigure[]
  /** Spalten ab `md`; Standard = Anzahl der Werte, höchstens 4. */
  columns?: 1 | 2 | 3 | 4
  /**
   * `card` (Standard): jede Kennzahl auf eigener Fläche. `plain`: ohne
   * Fläche, mit Trennlinie - für Kennzahlen innerhalb einer
   * `PageSection variant="card"` (sonst Fläche in Fläche).
   */
  variant?: 'card' | 'plain'
  /** Kleinere Werte für dichte Seiten (Tagesübersicht, Tabellenköpfe). */
  dense?: boolean
  /** Beschriftung der Gruppe für Screenreader. */
  'aria-label'?: string
  'data-testid'?: string
}

export const MAX_KEY_FIGURES = 4

function toneColor(tone: KeyFigureTone | undefined): string | undefined {
  if (!tone || tone === 'default') return undefined
  // *.main als Schrift auf `paper`: hell durch das Theme (muiTheme.ts) und
  // dunkel durch MUIs helle Töne >= 4,5:1; der Wert ist zudem große Schrift.
  return `${tone}.main`
}

export function KeyFigures({
  items,
  columns,
  variant = 'card',
  dense = false,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: KeyFiguresProps) {
  const cols = columns ?? Math.min(Math.max(items.length, 1), MAX_KEY_FIGURES)
  return (
    <Box
      component="dl"
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{
        m: 0,
        display: 'grid',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: {
          xs: items.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          md: `repeat(${cols}, minmax(0, 1fr))`,
        },
      }}
    >
      {items.map((item, index) => (
        <Paper
          key={index}
          data-testid={item['data-testid']}
          elevation={variant === 'plain' ? 0 : undefined}
          sx={
            variant === 'plain'
              ? {
                  p: 0,
                  pl: 1.5,
                  minWidth: 0,
                  bgcolor: 'transparent',
                  backgroundImage: 'none',
                  borderLeft: 2,
                  borderColor: 'divider',
                  borderRadius: 0,
                }
              : { p: { xs: 1.5, md: 2 }, minWidth: 0 }
          }
        >
          {/* Eine Kennzahl = eine Fläche (`div`) mit genau einem <dt> und
              ihren <dd>. Der Badge („vorläufig“) steht IM <dt>: ein <dl>
              erlaubt nur dt/dd direkt in seinem einen div - ein Zwischen-
              Box um <dt> + Badge brach die Begriff-Wert-Paare für
              Screenreader (axe: definition-list, dlitem; Review r2). */}
          <Box
            component="dt"
            sx={{
              m: 0,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: 0 }}
            >
              {item.label}
            </Typography>
            {item.badge}
          </Box>
          <Typography
            component="dd"
            variant="h5"
            sx={{
              m: 0,
              mt: 0.5,
              fontWeight: 600,
              fontSize: dense
                ? { xs: '1.0625rem', md: '1.125rem' }
                : { xs: '1.25rem', md: '1.5rem' },
              lineHeight: 1.25,
              overflowWrap: 'anywhere',
              fontVariantNumeric: 'tabular-nums',
              color: toneColor(item.tone),
            }}
          >
            {item.value}
          </Typography>
          {item.hint && (
            <Typography
              component="dd"
              variant="caption"
              color="text.secondary"
              sx={{ m: 0, mt: 0.5, display: 'block' }}
            >
              {item.hint}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  )
}

export default KeyFigures
