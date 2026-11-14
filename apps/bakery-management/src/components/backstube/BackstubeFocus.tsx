'use client'

import React from 'react'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ViewListIcon from '@mui/icons-material/ViewList'
import CheckIcon from '@mui/icons-material/Check'
import {
  nextOpenIndex,
  type BackstubeTocEntry,
} from '../../lib/backstubeProgress'
import { useBackstubeColors } from './backstubeColors'
import { BS_WIDE } from './BackstubeLayout'

/** Ab so viel Pixel waagerecht (und deutlich mehr als senkrecht) blättert ein Wischen. */
export const SWIPE_MIN_PX = 80

export interface BackstubeFocusProps {
  /** Abschnitte in der Reihenfolge der Seite (`sheetProgress`/`bakeProgress`). */
  entries: BackstubeTocEntry[]
  index: number
  onIndex: (index: number) => void
  /** Zurück zur ganzen Liste. */
  onClose: () => void
  /** „erledigt“ bzw. „gebacken“. */
  verb: string
  /** Der eine Abschnitt (Zeilen mit Haken). */
  children: React.ReactNode
}

function countText(e: BackstubeTocEntry, verb: string) {
  return e.total > 0 ? `${e.done} von ${e.total} ${verb}` : 'zum Nachsehen'
}

/**
 * Bäcker-Ansicht (UI-Runde 2): nur ein Abschnitt, groß, mit Blättern über
 * zwei breite Knöpfe unten (oder Wischen, am Rechner Pfeiltasten) - für das
 * Tablet in der Backstube, aus 1-2 m und mit Mehl an den Fingern. Sie beginnt
 * beim ersten Abschnitt mit offenen Zeilen. Braucht keine eigenen Daten: die
 * Abschnitte sind die des Überblicks, die Zeilen dieselben Bausteine wie in
 * der Liste. Ein Tipp auf „Ganze Liste“ führt zurück.
 */
export function BackstubeFocus({
  entries,
  index,
  onIndex,
  onClose,
  verb,
  children,
}: BackstubeFocusProps) {
  const colors = useBackstubeColors()
  const entry = entries[index]
  const prev = index > 0 ? entries[index - 1] : null
  const next = index < entries.length - 1 ? entries[index + 1] : null
  // Am Ende: weiter zum nächsten Abschnitt, in dem noch etwas offen ist.
  const openIdx = next ? -1 : nextOpenIndex(entries, index)
  const openAfter = openIdx >= 0 ? entries[openIdx] : null

  const goNext = React.useCallback(() => {
    if (next) onIndex(index + 1)
    else if (openIdx >= 0) onIndex(openIdx)
    else onClose()
  }, [next, index, openIdx, onIndex, onClose])
  const goPrev = React.useCallback(() => {
    if (prev) onIndex(index - 1)
  }, [prev, index, onIndex])

  // Neuer Abschnitt: oben anfangen.
  React.useEffect(() => {
    if (window.scrollY > 0) {
      try {
        window.scrollTo({ top: 0 })
      } catch {
        // ältere Browser ohne Optionen
      }
    }
  }, [index])

  // Rechner: Pfeiltasten blättern, Esc führt zur Liste.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  const touch = React.useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return
    if (dx < 0) goNext()
    else goPrev()
  }

  if (!entry) return null
  const sectionDone = entry.total > 0 && entry.done === entry.total
  const percent =
    entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0

  const navSx = {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    px: { xs: 1.5, sm: 2.5 },
    gap: 1.25,
    borderRadius: 2,
    border: '3px solid',
    fontSize: { xs: '1.1rem', sm: '1.35rem' },
    fontWeight: 800,
    textAlign: 'left',
    '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
    '&.Mui-disabled': { opacity: 0.35 },
  } as const

  return (
    <Box
      data-testid="bs-focus"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      sx={{
        maxWidth: 1000,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        pt: { xs: 2, sm: 2.5 },
        // Platz für die feste Blätter-Leiste unten.
        pb: 14,
        display: 'grid',
        gap: 2,
      }}
    >
      <Paper
        variant="outlined"
        data-print="hide"
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderWidth: 2,
          borderRadius: 3,
          display: 'grid',
          gap: { xs: 1.25, sm: 2 },
          alignItems: 'center',
          // Handy: Stelle und „Liste“ oben, Fortschritt darunter.
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gridTemplateAreas: '"where close" "count count"',
          '@media (min-width: 600px)': {
            gridTemplateColumns: 'auto minmax(0, 1fr) minmax(200px, 300px)',
            gridTemplateAreas: '"close where count"',
          },
          // Quer führt der Knopf im festen Kopf zurück - hier nicht noch
          // einmal; hochkant und am Handy fehlt er dort, dann steht er hier.
          [BS_WIDE]: {
            gridTemplateColumns: 'minmax(0, 1fr) minmax(200px, 300px)',
            gridTemplateAreas: '"where count"',
          },
        }}
      >
        <ButtonBase
          onClick={onClose}
          data-testid="bs-focus-close"
          aria-label="Zur ganzen Liste"
          sx={{
            gridArea: 'close',
            [BS_WIDE]: { display: 'none' },
            minHeight: 56,
            px: 2,
            gap: 1,
            borderRadius: 2,
            border: '2px solid',
            borderColor: 'divider',
            fontSize: '1.1rem',
            fontWeight: 800,
            '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
          }}
        >
          <ViewListIcon sx={{ fontSize: 28 }} />
          <Box
            component="span"
            sx={{
              display: 'none',
              '@media (min-width: 600px)': { display: 'inline' },
            }}
          >
            Ganze Liste
          </Box>
        </ButtonBase>
        <Box sx={{ gridArea: 'where', minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1.3,
            }}
          >
            {entry.group && (
              <Box component="span" sx={{ display: 'block' }}>
                {entry.group}
              </Box>
            )}
            Abschnitt {index + 1} von {entries.length}
          </Typography>
          <Box
            aria-hidden
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}
          >
            {entries.map((e, i) => {
              const done = e.total > 0 && e.done === e.total
              return (
                <Box
                  key={e.anchor}
                  sx={{
                    width: i === index ? 28 : 12,
                    height: 12,
                    borderRadius: 6,
                    bgcolor: done
                      ? colors.doneBg
                      : i === index
                      ? 'text.primary'
                      : 'action.selected',
                  }}
                />
              )
            })}
          </Box>
        </Box>
        <Box sx={{ gridArea: 'count', minWidth: 0 }}>
          <Typography
            data-testid="bs-focus-count"
            sx={{
              fontSize: { xs: '1.2rem', sm: '1.35rem' },
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {sectionDone && <CheckIcon sx={{ color: 'inherit' }} />}
            {countText(entry, verb)}
          </Typography>
          {entry.total > 0 && (
            <Box
              aria-hidden
              sx={{
                mt: 0.75,
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.selected',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${percent}%`,
                  bgcolor: colors.doneBg,
                }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      <Box>{children}</Box>

      <Box
        component="nav"
        aria-label="Abschnitte blättern"
        data-print="hide"
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: { xs: 1.5, sm: 3 },
          py: 1.5,
        }}
      >
        <Box sx={{ maxWidth: 1000, mx: 'auto', display: 'flex', gap: 1.5 }}>
          <ButtonBase
            onClick={goPrev}
            disabled={!prev}
            data-testid="bs-focus-prev"
            aria-label={prev ? `Zurück: ${prev.label}` : 'Zurück'}
            sx={{
              ...navSx,
              borderColor: 'divider',
              justifyContent: 'flex-start',
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 34, flexShrink: 0 }} />
            <Box
              component="span"
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {prev ? prev.label : 'Anfang'}
            </Box>
          </ButtonBase>
          <ButtonBase
            onClick={goNext}
            data-testid="bs-focus-next"
            aria-label={
              next
                ? `Weiter: ${next.label}`
                : openAfter
                ? `Noch offen: ${openAfter.label}`
                : 'Fertig – zur ganzen Liste'
            }
            sx={{
              ...navSx,
              justifyContent: 'flex-end',
              borderColor: 'text.primary',
              bgcolor: 'text.primary',
              color: 'background.paper',
              // Nur mit Maus: auf dem Tablet bliebe der Hover-Ton nach dem
              // Tippen stehen und der Knopf sähe gesperrt aus.
              '@media (hover: hover)': {
                '&:hover': { bgcolor: 'text.secondary' },
              },
            }}
          >
            <Box
              component="span"
              sx={{ minWidth: 0, textAlign: 'right', overflow: 'hidden' }}
            >
              <Box
                component="span"
                sx={{
                  display: 'block',
                  fontSize: '0.75em',
                  fontWeight: 700,
                  opacity: 0.85,
                }}
              >
                {next ? 'Weiter' : openAfter ? 'Noch offen' : 'Fertig'}
              </Box>
              <Box
                component="span"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {(next ?? openAfter)?.label ?? 'Zur ganzen Liste'}
              </Box>
            </Box>
            <ArrowForwardIcon sx={{ fontSize: 34, flexShrink: 0 }} />
          </ButtonBase>
        </Box>
      </Box>
    </Box>
  )
}

export default BackstubeFocus
