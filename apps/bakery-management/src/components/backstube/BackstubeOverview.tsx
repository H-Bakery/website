'use client'

import React from 'react'
import { Box, ButtonBase, Paper, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import type { BackstubeTocEntry } from '../../lib/backstubeProgress'
import { useBackstubeColors } from './backstubeColors'
import { FocusStartButton, HideDoneToggle } from './BackstubeView'

export interface BackstubeOverviewProps {
  /** „4 von 15 erledigt“; `null` = kein Zähler (Entwurf). */
  progress: { done: number; total: number; verb: string } | null
  /** Test-ID der Fortschrittszahl (`bs-progress` auf dem Zettel). */
  progressTestId: string
  /** Zeile unter der Zahl („Freigegeben von … am …“). */
  status?: React.ReactNode
  /** Statt der Zahl (Entwurf): das Banner. */
  banner?: React.ReactNode
  /** Abschnitte zum Springen, mit „erledigt von“ je Abschnitt. */
  entries: BackstubeTocEntry[]
  /** Entwurf: je Abschnitt nur die Zahl der Zeilen (abhaken geht noch nicht). */
  countOnly?: boolean
}

/** Springt zum Abschnitt; der feste Kopf bleibt frei (`scroll-margin-top`). */
export function jumpTo(anchor: string) {
  const el = document.getElementById(anchor)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Für Tastatur und Vorlesen: der Fokus folgt dem Sprung.
  const heading = el.querySelector<HTMLElement>('h2, h3')
  heading?.focus({ preventScroll: true })
}

function groupsOf(entries: BackstubeTocEntry[]) {
  const groups: { group: string | null; entries: BackstubeTocEntry[] }[] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last && last.group === e.group) last.entries.push(e)
    else groups.push({ group: e.group, entries: [e] })
  }
  return groups
}

/**
 * „Überblick“ des Tablets: wie weit der Tag ist (große Zahl) und je
 * Abschnitt ein Sprungknopf mit „3/7“ - auf dem Desktop links neben den
 * Zeilen, auf dem Tablet hochkant über ihnen. Gezählt wird nur, was der
 * Server an den Zeilen trägt (`backstubeProgress.ts`).
 */
export function BackstubeOverview({
  progress,
  progressTestId,
  status,
  banner,
  entries,
  countOnly = false,
}: BackstubeOverviewProps) {
  const colors = useBackstubeColors()
  const allDone =
    !!progress && progress.total > 0 && progress.done === progress.total
  return (
    <Paper
      component="nav"
      aria-label="Überblick"
      data-testid="bs-overview"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 2.5 }, borderWidth: 2, borderRadius: 3 }}
    >
      {banner}
      {progress && (
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              columnGap: 1,
            }}
          >
            <Typography
              data-testid={progressTestId}
              sx={{
                fontSize: { xs: '1.5rem', sm: '1.9rem' },
                fontWeight: 800,
                lineHeight: 1.15,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {progress.done} von {progress.total} {progress.verb}
            </Typography>
            {allDone && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  borderRadius: 1,
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  bgcolor: colors.doneBg,
                  color: colors.doneFg,
                }}
              >
                <CheckIcon sx={{ fontSize: 20 }} /> fertig
              </Box>
            )}
          </Box>
          {status && (
            <Typography
              component="div"
              sx={{ fontSize: '1.05rem', color: 'text.secondary', mt: 0.25 }}
            >
              {status}
            </Typography>
          )}
        </Box>
      )}
      {(progress || banner) && (
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            '&:empty': { display: 'none' },
          }}
        >
          <FocusStartButton />
          {progress && !countOnly && <HideDoneToggle verb={progress.verb} />}
        </Box>
      )}
      {entries.length > 0 && (
        <Box sx={{ mt: progress || banner ? 2 : 0 }}>
          {groupsOf(entries).map((g, gi) => (
            <Box key={`${g.group ?? ''}-${gi}`} sx={{ mt: gi > 0 ? 1.5 : 0 }}>
              {g.group && (
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    mb: 0.75,
                  }}
                >
                  {g.group}
                </Typography>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  // Seitenspalte: eine Spalte; hochkant drei nebeneinander.
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                }}
              >
                {g.entries.map((e) => {
                  const done = !countOnly && e.total > 0 && e.done === e.total
                  return (
                    <ButtonBase
                      key={e.anchor}
                      data-testid={`bs-toc-${e.anchor}`}
                      onClick={() => jumpTo(e.anchor)}
                      aria-label={
                        e.total === 0
                          ? e.label
                          : countOnly
                          ? `${e.label}: ${e.total} ${
                              e.total === 1 ? 'Zeile' : 'Zeilen'
                            }`
                          : `${e.label}: ${e.done} von ${e.total}`
                      }
                      sx={{
                        minHeight: 52,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: done ? colors.doneBg : 'divider',
                        bgcolor: done ? colors.doneRow : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        textAlign: 'left',
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:focus-visible': {
                          outline: '3px solid',
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography
                          component="span"
                          sx={{
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            minWidth: 0,
                            overflowWrap: 'break-word',
                            hyphens: 'auto',
                          }}
                        >
                          {e.label}
                        </Typography>
                        {e.total > 0 && (
                          <Typography
                            component="span"
                            sx={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: done ? 'text.primary' : 'text.secondary',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                            }}
                          >
                            {done && <CheckIcon sx={{ fontSize: 18 }} />}
                            {countOnly ? e.total : `${e.done}/${e.total}`}
                          </Typography>
                        )}
                      </Box>
                      {e.total > 0 && !countOnly && (
                        <Box
                          aria-hidden
                          sx={{
                            mt: 0.75,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: 'action.selected',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${Math.round((e.done / e.total) * 100)}%`,
                              bgcolor: colors.doneBg,
                            }}
                          />
                        </Box>
                      )}
                    </ButtonBase>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}

export default BackstubeOverview
