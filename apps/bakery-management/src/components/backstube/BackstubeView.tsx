'use client'

import React from 'react'
import { flushSync } from 'react-dom'
import { Box, ButtonBase, Stack } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import { BS_WIDE } from './BackstubeLayout'
import { splitDone } from '../../lib/backstubeProgress'
import { useBackstubeColors } from './backstubeColors'

/**
 * UI-Runde 2: „Erledigte ausblenden“ gilt je Gerät (Tablet in der Backstube
 * vs. Rechner im Büro) und bleibt über das Neuladen - in `localStorage`.
 * Privates Fenster oder gesperrter Speicher: dann gilt die Vorgabe
 * (ausblenden), nie ein Fehler.
 */
export const HIDE_DONE_KEY = 'bakery-backstube-hide-done'

export function readHideDone(): boolean {
  try {
    if (typeof window === 'undefined') return true
    const value = window.localStorage.getItem(HIDE_DONE_KEY)
    // Nur ein gespeichertes „0“ schaltet ab; alles andere ist die Vorgabe.
    return value !== '0'
  } catch {
    return true
  }
}

export function writeHideDone(value: boolean): void {
  try {
    window.localStorage.setItem(HIDE_DONE_KEY, value ? '1' : '0')
  } catch {
    // Speicher gesperrt: die Wahl gilt bis zum Neuladen.
  }
}

export interface BackstubeView {
  /** Erledigte Zeilen je Abschnitt zu einer Zeile „n erledigt“ zuklappen. */
  hideDone: boolean
  setHideDone: (value: boolean) => void
  /** Ohne Anbieter: kein Umschalter (es gibt nichts zu merken). */
  available: boolean
  /** Bäcker-Ansicht starten (`null` = gerade nicht möglich). */
  startFocus: (() => void) | null
}

/**
 * Ohne Anbieter (Bausteine einzeln, Specs) steht alles offen da - wie vor
 * UI-Runde 2. Die Seite (`BackstubeClient`) setzt `BackstubeViewProvider`.
 */
const BackstubeViewContext = React.createContext<BackstubeView>({
  hideDone: false,
  setHideDone: () => undefined,
  available: false,
  startFocus: null,
})

export function BackstubeViewProvider({
  children,
  startFocus = null,
}: {
  children: React.ReactNode
  startFocus?: (() => void) | null
}) {
  const [hideDone, setHide] = React.useState<boolean>(readHideDone)
  // Drucken (Strg+P) zeigt immer alle Zeilen: zugeklappte stünden sonst
  // nicht auf dem Papier. Synchron in `beforeprint`, sonst käme das
  // Drucklayout vor dem Aufklappen (wie im Abrechnungs-Druck).
  const [printing, setPrinting] = React.useState(false)
  React.useEffect(() => {
    const start = () => flushSync(() => setPrinting(true))
    const end = () => setPrinting(false)
    window.addEventListener('beforeprint', start)
    window.addEventListener('afterprint', end)
    return () => {
      window.removeEventListener('beforeprint', start)
      window.removeEventListener('afterprint', end)
    }
  }, [])
  const value = React.useMemo(
    () => ({
      hideDone: hideDone && !printing,
      setHideDone: (next: boolean) => {
        setHide(next)
        writeHideDone(next)
      },
      available: true,
      startFocus,
    }),
    [hideDone, printing, startFocus]
  )
  return (
    <BackstubeViewContext.Provider value={value}>
      {children}
    </BackstubeViewContext.Provider>
  )
}

export function useBackstubeView(): BackstubeView {
  return React.useContext(BackstubeViewContext)
}

/** So lange bleibt eine gerade abgehakte Zeile stehen (zurücknehmen geht). */
export const KEEP_JUST_DONE_MS = 5000

export interface BackstubeLinesProps<T> {
  lines: T[]
  lineKey: (line: T) => string
  isDone: (line: T) => boolean
  renderLine: (line: T) => React.ReactNode
  /** Für Test-ID und `aria-controls` (`bs-done-<id>`). */
  sectionId: string
  /** „erledigt“ (Zettel) bzw. „gebacken“ (Backen). */
  verb: string
}

/**
 * Die Zeilen eines Abschnitts. Mit „Erledigte ausblenden“ stehen oben nur
 * die offenen Zeilen, die erledigten als eine Zeile „✓ 3 erledigt“ darunter;
 * ein Tipp klappt sie auf (zum Nachsehen oder Zurücknehmen). Eine Zeile, die
 * gerade abgehakt wurde, bleibt ein paar Sekunden stehen - ein Fehltipp lässt
 * sich so sofort zurücknehmen, ohne dass die Zeile unter dem Finger
 * verschwindet.
 */
export function BackstubeLines<T>({
  lines,
  lineKey,
  isDone,
  renderLine,
  sectionId,
  verb,
}: BackstubeLinesProps<T>) {
  const { hideDone } = useBackstubeView()
  const colors = useBackstubeColors()
  const [expanded, setExpanded] = React.useState(false)

  // Gerade erledigt = jetzt erledigt, beim letzten Zeichnen noch nicht.
  const prevDone = React.useRef<Set<string> | null>(null)
  const [recent, setRecent] = React.useState<ReadonlySet<string>>(new Set())
  const timers = React.useRef<number[]>([])
  const doneKeys = lines.filter(isDone).map(lineKey)
  const prev = prevDone.current
  const fresh = prev ? doneKeys.filter((k) => !prev.has(k)) : []
  const freshKey = fresh.join('\n')
  // Nach jedem Zeichnen den Stand merken (kein setState, daher ohne Liste).
  React.useEffect(() => {
    prevDone.current = new Set(doneKeys)
  })
  React.useEffect(() => {
    if (!freshKey) return
    const keys = freshKey.split('\n')
    setRecent((r) => new Set([...Array.from(r), ...keys]))
    timers.current.push(
      window.setTimeout(() => {
        setRecent((r) => {
          const next = new Set(r)
          keys.forEach((k) => next.delete(k))
          return next
        })
      }, KEEP_JUST_DONE_MS)
    )
  }, [freshKey])
  React.useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    []
  )

  if (!hideDone) {
    return <Stack spacing={1}>{lines.map(renderLine)}</Stack>
  }
  const keep = (l: T) => {
    const k = lineKey(l)
    return recent.has(k) || fresh.includes(k)
  }
  const { shown, hidden } = splitDone(lines, isDone, keep)
  const doneCount = expanded ? doneKeys.length : hidden.length
  return (
    <Stack spacing={1}>
      {(expanded ? lines : shown).map(renderLine)}
      {doneCount > 0 && (
        <ButtonBase
          data-testid={`bs-done-${sectionId}`}
          data-print="hide"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          sx={{
            minHeight: 56,
            px: 2,
            borderRadius: 2,
            border: '2px dashed',
            borderColor: colors.doneBg,
            bgcolor: colors.doneRow,
            justifyContent: 'flex-start',
            gap: 1.25,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: 800,
            color: 'text.primary',
            '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: colors.doneBg,
              color: colors.doneFg,
              flexShrink: 0,
            }}
          >
            <CheckIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
            {shown.length === 0 && !expanded && doneCount > 1
              ? `Alle ${doneCount} ${verb}`
              : `${doneCount} ${verb}`}
          </Box>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            {expanded ? 'einklappen' : 'zeigen'}
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
        </ButtonBase>
      )}
    </Stack>
  )
}

/**
 * „Bäcker-Ansicht“ im Überblick - hochkant und am Handy, wo der Knopf im
 * Kopf fehlt bzw. weit weg ist. Quer steht er im Kopf.
 */
export function FocusStartButton() {
  const { startFocus } = useBackstubeView()
  if (!startFocus) return null
  return (
    <ButtonBase
      data-testid="bs-focus-start"
      data-print="hide"
      onClick={startFocus}
      sx={{
        minHeight: 56,
        px: 2,
        gap: 1,
        borderRadius: 2,
        bgcolor: 'text.primary',
        color: 'background.paper',
        fontSize: '1.1rem',
        fontWeight: 800,
        [BS_WIDE]: { display: 'none' },
        '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
      }}
    >
      <CenterFocusStrongIcon sx={{ fontSize: 26 }} />
      Bäcker-Ansicht
    </ButtonBase>
  )
}

/**
 * Umschalter „Erledigte ausblenden“ - gilt für Zettel und Backen, gemerkt
 * je Gerät. Groß genug für den Daumen (56 px), ein Zustand, den man sieht
 * (Kästchen mit Haken), statt eines kleinen Schalters.
 */
export function HideDoneToggle({ verb }: { verb: string }) {
  const { hideDone, setHideDone, available } = useBackstubeView()
  const colors = useBackstubeColors()
  if (!available) return null
  return (
    <ButtonBase
      data-testid="bs-hide-done"
      data-print="hide"
      role="switch"
      aria-checked={hideDone}
      onClick={() => setHideDone(!hideDone)}
      sx={{
        minHeight: 56,
        px: 1.5,
        gap: 1.25,
        borderRadius: 2,
        border: '2px solid',
        borderColor: 'divider',
        justifyContent: 'flex-start',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'text.primary',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '3px solid', outlineOffset: 2 },
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 1,
          border: '3px solid',
          borderColor: hideDone ? colors.doneBg : 'text.primary',
          bgcolor: hideDone ? colors.doneBg : 'transparent',
          color: colors.doneFg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hideDone && <CheckIcon sx={{ fontSize: 22 }} />}
      </Box>
      {verb === 'gebacken' ? 'Gebackene ausblenden' : 'Erledigte ausblenden'}
    </ButtonBase>
  )
}
