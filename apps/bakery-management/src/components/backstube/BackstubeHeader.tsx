'use client'

import React from 'react'
import Link from 'next/link'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ListAltIcon from '@mui/icons-material/ListAlt'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import ScheduleIcon from '@mui/icons-material/Schedule'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ViewListIcon from '@mui/icons-material/ViewList'
import type { Theme } from '@mui/material/styles'
import LogoutButton from '../auth/LogoutButton'
import { BS_TITLE_SX } from './backstubeType'
import { useBackstubeColors } from './backstubeColors'
import type { BackstubeChoice } from '../../lib/backstubeDay'
import type { BackstubeTabId } from '../../lib/backstubeTab'

/** Breite von Kopf und Inhalt: zwei Spalten auf dem Desktop, nie breiter. */
export const BS_PAGE_MAX_WIDTH = 1440

export interface BackstubeDayChoice {
  value: BackstubeChoice
  onChange: (value: BackstubeChoice) => void
  today: { label: string; sub: string }
  next: { label: string; sub: string }
}

export interface BackstubeHeaderProps {
  /** „Bernd Backstube“ - wer angemeldet ist. */
  userName: string | null
  /** Große Überschrift (Datum). */
  title: string
  tab: BackstubeTabId
  onTab: (tab: BackstubeTabId) => void
  /** Heute/Morgen - fehlt im Reiter Vorbereitung (gilt immer dem nächsten Backtag). */
  dayChoice: BackstubeDayChoice | null
  refreshing: boolean
  onRefresh: () => void
  /** „Stand 03:00“ des gezeigten Reiters; `null` = noch nichts geladen. */
  loadedAt: string | null
  /** Letztes Neuladen gescheitert: der Stand ist alt. */
  stale: boolean
  /** Fortschritt des Reiters (Zettel: erledigt, Backen: gebacken). */
  progress: { done: number; total: number; verb: string } | null
  /** Link „Planung & Druck“ (Rolle darf planen). */
  planHref: string | null
  /** „Zur Verwaltung“ (nur persönliche Sitzung). */
  adminHref: string | null
  /** Für die Höhe des festen Kopfes (Sprungziele, Seitenspalte). */
  headerRef?: React.Ref<HTMLElement>
  /**
   * Bäcker-Ansicht (UI-Runde 2): Knopf zum Wechseln zwischen ganzer Liste
   * und einem Abschnitt; `null` = nicht im Reiter (Vorbereitung, nichts
   * geladen).
   */
  focus?: { active: boolean; onToggle: () => void } | null
}

const ACTION_SX = {
  minHeight: 56,
  minWidth: 56,
  px: { xs: 1.5, sm: 2 },
  fontSize: { xs: '1rem', sm: '1.05rem' },
  fontWeight: 700,
  textTransform: 'none',
  whiteSpace: 'nowrap',
  borderWidth: 2,
  '&:hover': { borderWidth: 2 },
} as const

const ACTION_LABEL_SX = {
  display: { xs: 'none', lg: 'inline' },
  ml: 1,
} as const

/**
 * Kopf des Backstube-Tablets: welcher Tag (groß, mit Heute/Morgen daneben),
 * die drei Reiter, Stand + Neu laden und Abmelden. Unten eine Leiste mit dem
 * Fortschritt des Reiters - auch beim Scrollen sichtbar (der Kopf bleibt
 * oben stehen). Alle Knöpfe mindestens 56 px hoch (Mehl an den Fingern).
 */
export function BackstubeHeader({
  userName,
  title,
  tab,
  onTab,
  dayChoice,
  refreshing,
  onRefresh,
  loadedAt,
  stale,
  progress,
  planHref,
  adminHref,
  headerRef,
  focus = null,
}: BackstubeHeaderProps) {
  const colors = useBackstubeColors()
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0
  return (
    <Box
      component="header"
      ref={headerRef}
      sx={{
        // Am Handy wäre der feste Kopf (vier Reihen) ein Drittel des
        // Bildschirms - dort läuft er mit; zurück geht es mit „Überblick“.
        position: { xs: 'static', sm: 'sticky' },
        top: 0,
        zIndex: 3,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          maxWidth: BS_PAGE_MAX_WIDTH,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          pt: { xs: 1.25, sm: 1.5 },
          display: 'grid',
          alignItems: 'center',
          columnGap: { xs: 1, sm: 2 },
          rowGap: { xs: 1, sm: 1.25 },
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gridTemplateAreas: {
            xs: '"title title" "actions actions" "toggle toggle" "tabs tabs"',
            sm: '"title actions" "tabs toggle"',
          },
        }}
      >
        <Box sx={{ gridArea: 'title', minWidth: 0 }}>
          <Typography
            component="div"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 0.75,
              fontSize: { xs: '0.95rem', sm: '1rem' },
              color: 'text.secondary',
              lineHeight: 1.25,
              fontWeight: 600,
            }}
          >
            <span>Backstube{userName ? ` · ${userName}` : ''}</span>
            {loadedAt && (
              <Box
                component="span"
                data-testid="bs-loaded-at"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  ...(stale
                    ? {
                        px: 0.75,
                        borderRadius: 1,
                        bgcolor: colors.deltaBg,
                        color: colors.deltaFg,
                        fontWeight: 800,
                      }
                    : {}),
                }}
              >
                {stale ? (
                  <CloudOffIcon sx={{ fontSize: 18 }} />
                ) : (
                  <span aria-hidden>·</span>
                )}
                Stand {loadedAt}
              </Box>
            )}
          </Typography>
          <Typography
            variant="h1"
            component="h1"
            data-testid="bs-date"
            // UI-Runde 2: eine Zeile, auch „Heute, Samstag, …“ - sonst
            // sprang der Kopf beim Reiterwechsel um eine Zeile.
            noWrap
            sx={BS_TITLE_SX}
          >
            {title}
          </Typography>
        </Box>

        <Box
          data-print="hide"
          sx={{
            gridArea: 'actions',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.5 },
          }}
        >
          {focus && (
            <Button
              onClick={focus.onToggle}
              variant={focus.active ? 'outlined' : 'contained'}
              color="inherit"
              disableElevation
              data-testid="bs-focus-open"
              aria-pressed={focus.active}
              aria-label={focus.active ? 'Ganze Liste' : 'Bäcker-Ansicht'}
              title={
                focus.active
                  ? 'Zurück zur ganzen Liste'
                  : 'Bäcker-Ansicht: ein Abschnitt, groß, zum Blättern'
              }
              sx={{
                ...ACTION_SX,
                // Nur quer (= BS_WIDE, zwei Spalten): hochkant und am Handy
                // steht der Knopf im Überblick bzw. in der Bäcker-Ansicht -
                // im Kopf drückte er sonst die Reiter zusammen.
                display: 'none',
                '@media (min-width: 1080px)': { display: 'inline-flex' },
                ...(focus.active
                  ? {}
                  : {
                      bgcolor: 'text.primary',
                      color: 'background.paper',
                      borderColor: 'text.primary',
                      '@media (hover: hover)': {
                        '&:hover': { bgcolor: 'text.secondary' },
                      },
                    }),
              }}
            >
              {focus.active ? (
                <ViewListIcon sx={{ fontSize: 26 }} />
              ) : (
                <CenterFocusStrongIcon sx={{ fontSize: 26 }} />
              )}
              <Box component="span" sx={{ ml: 1 }}>
                {focus.active ? 'Ganze Liste' : 'Bäcker-Ansicht'}
              </Box>
            </Button>
          )}
          <IconButton
            onClick={onRefresh}
            aria-label="Neu laden"
            title="Neu laden"
            sx={{
              width: 56,
              height: 56,
              border: '2px solid',
              borderColor: stale ? colors.deltaEdge : 'divider',
            }}
          >
            {refreshing ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <RefreshIcon sx={{ fontSize: 30 }} />
            )}
          </IconButton>
          {planHref && (
            <Button
              component={Link}
              href={planHref}
              variant="outlined"
              color="inherit"
              aria-label="Planung & Druck"
              title="Planung & Druck"
              sx={ACTION_SX}
            >
              <PrintOutlinedIcon sx={{ fontSize: 26 }} />
              {/* Auf dem Tablet nur das Zeichen - der Kopf bleibt eine Zeile. */}
              <Box component="span" sx={ACTION_LABEL_SX}>
                Planung &amp; Druck
              </Box>
            </Button>
          )}
          {adminHref && (
            <Button
              component={Link}
              href={adminHref}
              variant="outlined"
              color="inherit"
              aria-label="Zur Verwaltung"
              title="Zur Verwaltung"
              sx={ACTION_SX}
            >
              <DashboardOutlinedIcon sx={{ fontSize: 26 }} />
              <Box component="span" sx={ACTION_LABEL_SX}>
                Zur Verwaltung
              </Box>
            </Button>
          )}
          <LogoutButton
            variant="outlined"
            color="inherit"
            size="large"
            sx={ACTION_SX}
          />
        </Box>

        <Tabs
          value={tab}
          onChange={(_, value: BackstubeTabId) => onTab(value)}
          aria-label="Ansicht"
          data-print="hide"
          textColor="inherit"
          variant="scrollable"
          scrollButtons={false}
          TabIndicatorProps={{ sx: { height: 4, bgcolor: 'text.primary' } }}
          sx={{
            gridArea: 'tabs',
            alignSelf: 'end',
            minWidth: 0,
            minHeight: 56,
            '& .MuiTab-root': {
              minHeight: 56,
              px: { xs: 1.25, md: 2.25 },
              minWidth: 0,
              fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.2rem' },
              fontWeight: 700,
              textTransform: 'none',
              color: 'text.secondary',
              opacity: 1,
            },
            '& .MuiTab-root.Mui-selected': { color: 'text.primary' },
            '& .MuiTab-iconWrapper': { fontSize: 26 },
          }}
        >
          <Tab
            value="zettel"
            label="Zettel"
            icon={<ListAltIcon />}
            iconPosition="start"
          />
          <Tab
            value="backen"
            label="Backen"
            icon={<LocalFireDepartmentIcon />}
            iconPosition="start"
          />
          <Tab
            value="vorbereitung"
            label="Vorbereitung"
            icon={<ScheduleIcon />}
            iconPosition="start"
          />
        </Tabs>

        {/* UI-Runde 2: im Reiter Vorbereitung bleibt der Platz des
            Umschalters (unsichtbar) - sonst sprang der Kopf beim
            Reiterwechsel, am Handy um eine ganze Reihe. */}
        <ToggleButtonGroup
          data-print="hide"
          data-testid="bs-day-choice"
          exclusive
          value={dayChoice?.value ?? null}
          onChange={(_, value: BackstubeChoice | null) => {
            if (value && dayChoice) dayChoice.onChange(value)
          }}
          aria-label="Tag wählen"
          aria-hidden={dayChoice ? undefined : true}
          disabled={!dayChoice}
          sx={{
            visibility: dayChoice ? 'visible' : 'hidden',
            gridArea: 'toggle',
            justifySelf: { xs: 'stretch', sm: 'end' },
            alignSelf: 'center',
            mb: { sm: 0.75 },
            '& .MuiToggleButton-root': {
              flex: { xs: 1, sm: 'none' },
              minHeight: 56,
              minWidth: { xs: 0, sm: 120 },
              px: { xs: 0.75, sm: 1.75 },
              fontSize: { xs: '1.05rem', sm: '1.1rem' },
              fontWeight: 800,
              textTransform: 'none',
              lineHeight: 1.1,
              flexDirection: 'column',
              color: 'text.primary',
              borderWidth: 2,
            },
            // Ausgewählt: invertiert (heller Knopf im dunklen Modus und
            // umgekehrt) - das MUI-Grau läge unter 2:1.
            '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover':
              {
                backgroundColor: (t: Theme) => t.palette.text.primary,
                color: (t: Theme) => t.palette.background.paper,
              },
          }}
        >
          <ToggleButton
            value="heute"
            data-testid={dayChoice ? 'bs-choice-heute' : undefined}
          >
            {dayChoice?.today.label ?? 'Heute'}
            <Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {dayChoice?.today.sub ?? '–'}
            </Box>
          </ToggleButton>
          <ToggleButton
            value="morgen"
            data-testid={dayChoice ? 'bs-choice-morgen' : undefined}
          >
            {dayChoice?.next.label ?? 'Morgen'}
            <Box component="span" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {dayChoice?.next.sub ?? '–'}
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {/* Fortschritt des Reiters über die ganze Breite - beim Scrollen
          sichtbar, ohne Platz zu kosten. */}
      <LinearProgress
        data-print="hide"
        data-testid="bs-header-progress"
        variant="determinate"
        value={percent}
        aria-label={
          progress
            ? `${progress.done} von ${progress.total} ${progress.verb}`
            : 'Kein Fortschritt'
        }
        sx={{
          height: 6,
          bgcolor: 'action.hover',
          visibility: progress && progress.total > 0 ? 'visible' : 'hidden',
          '& .MuiLinearProgress-bar': { bgcolor: colors.doneBg },
        }}
      />
    </Box>
  )
}

export default BackstubeHeader
