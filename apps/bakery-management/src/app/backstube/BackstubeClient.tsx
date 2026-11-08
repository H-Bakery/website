'use client'

import React from 'react'
import Link from 'next/link'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { Theme } from '@mui/material/styles'
import {
  DELTAS_PENDING_MAX_RELOADS,
  DELTAS_PENDING_RELOAD_MS,
  acknowledgeDelta,
  acknowledgeDeltas,
  fetchBackzettelConfig,
  fetchBackzettelDay,
  fetchBakeList,
  fetchPrep,
  deltaTotalsByKey,
  isBackzettelDay,
  isDoughDaySheet,
  setLineDone,
  type BackzettelConfigData,
  type BackzettelDay,
  type BackzettelDayResult,
  type BackzettelDeltaEntry,
  type BackzettelLine,
  type BackzettelNoConfig,
  type BackzettelSection,
  type BakeList,
  type PrepView,
} from '../../lib/backzettelApi'
import {
  allLines,
  bakeDayLabel,
  bruchGroupText,
  doughsTodayText,
  formatDateLong,
  formatDateShort,
  formatTimestamp,
} from '../../lib/backzettelFormat'
import {
  BACKSTUBE_REFRESH_MS,
  backstubeDates,
  dateForChoice,
  nextLabel,
  type BackstubeChoice,
} from '../../lib/backstubeDay'
import { describeBackstubeError } from '../../lib/backstubeErrors'
import {
  defaultBackstubeTab,
  type BackstubeTabId,
} from '../../lib/backstubeTab'
import { useSession } from '../../lib/session'
import { isPathAllowedForRole } from '../../lib/roles'
import LogoutButton from '../../components/auth/LogoutButton'
import { BackstubeLine } from '../../components/backstube/BackstubeLine'
import { BackstubeHefeteig } from '../../components/backstube/BackstubeHefeteig'
import { BackstubeDeltas } from '../../components/backstube/BackstubeDeltas'
import { BackstubePrep } from '../../components/backstube/BackstubePrep'
import { BackstubeBakeList } from '../../components/backstube/BackstubeBakeList'
import { useBackstubeColors } from '../../components/backstube/backstubeColors'
import { MachineStrip } from '../../components/backzettel/MachineStrip'

type TabId = BackstubeTabId

type PrepResult =
  | PrepView
  | BackzettelNoConfig
  | { date: string; status: 'ruhetag'; message: string }

const STALE_CODES = new Set([
  'confirmed',
  'not_confirmed',
  'no_config',
  'ruhetag',
  // W4-verify r4: die Zeile hat auf dem Server inzwischen eine größere Menge
  'line_changed',
])

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

/** Hat das Neuladen den Zustand erreicht, auf den ein 409 verwies? */
export function staleResolved(
  code: string | null,
  res: BackzettelDayResult
): boolean {
  if (!code) return false
  const day = isBackzettelDay(res) ? res : null
  switch (code) {
    case 'not_confirmed':
      return day?.status === 'confirmed'
    case 'confirmed':
      return day?.status === 'draft'
    case 'no_config':
    case 'ruhetag':
      return !!day
    default:
      return false
  }
}

/**
 * Netz weg oder 5xx (kein 409): nach dem nächsten erfolgreichen Laden ist die
 * Verbindung wieder da - dann nennt die Meldung den nächsten Schritt statt
 * weiter einen Serverfehler (W4-Verifikation Runde 3).
 */
const TRANSIENT_TICK = 'transient:tick'
const TRANSIENT_ACK = 'transient:ack'

function isTransient(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return (
    describeBackstubeError(error, '').offline ||
    (typeof status === 'number' && status >= 500)
  )
}

/** Meldung nach dem erfolgreichen Neuladen, oder `undefined` = stehen lassen. */
export function afterReloadMessage(code: string | null): string | undefined {
  if (code === TRANSIENT_TICK) {
    return 'Die Verbindung ist wieder da. Der letzte Haken wurde nicht gespeichert - bitte noch einmal abhaken.'
  }
  if (code === TRANSIENT_ACK) {
    return 'Die Verbindung ist wieder da. Der Nachtrag wurde nicht quittiert - bitte noch einmal „Gesehen“ tippen.'
  }
  return undefined
}

function messageOf(error: unknown, fallback: string): string {
  return describeBackstubeError(error, fallback).text
}

function isStale(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null
  if (!e) return false
  // W4-verify r4: Zeile oder Nachtrag gibt es nach einer erneuten Freigabe
  // nicht mehr - neu laden statt den alten Stand mit Knöpfen stehen lassen.
  if (e.status === 404 && e.code === 'not_found') return true
  return e.status === 409 && !!e.code && STALE_CODES.has(e.code)
}

function patchLines(
  day: BackzettelDay,
  match: (line: BackzettelLine) => boolean,
  patch: (line: BackzettelLine) => Partial<BackzettelLine>
): BackzettelDay {
  return {
    ...day,
    sections: day.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => (match(l) ? { ...l, ...patch(l) } : l)),
    })),
  }
}

/**
 * Z10: die Abschnitte eines Teigtag-Zettels je Backtag - erst der Tag selbst,
 * dann „für Sonntag“, „für Dienstag“. Zeilen ohne `bakeDate` gehören dem
 * Zettel-Tag. Reihenfolge der Backtage wie `bakeDates` vom Server.
 */
export function sectionsByBakeDay(
  day: Pick<BackzettelDay, 'date' | 'sections' | 'bakeDates'>
): { bakeDate: string; sections: BackzettelSection[] }[] {
  const order = [
    day.date,
    ...(day.bakeDates ?? []).map((b) => b.date).filter((d) => d !== day.date),
  ]
  for (const s of day.sections) {
    for (const l of s.lines) {
      const d = l.bakeDate ?? day.date
      if (!order.includes(d)) order.push(d)
    }
  }
  return order
    .map((bakeDate) => ({
      bakeDate,
      sections: day.sections
        .map((s) => ({
          ...s,
          lines: s.lines.filter((l) => (l.bakeDate ?? day.date) === bakeDate),
        }))
        .filter((s) => s.lines.length > 0),
    }))
    .filter((g) => g.sections.length > 0)
}

function timeOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
}

export interface BackstubeClientProps {
  /** Uhr (Specs). */
  clock?: () => Date
}

/**
 * Backstube-Tablet (Z6, roadmap §5.5 Nr. 3): der Backzettel des aktuellen
 * bzw. nächsten Backtags in sehr großer Schrift, ein Haken je Zeile,
 * Nachträge mit „Gesehen“, am Samstag zuerst Hefeteig & Füllungen, dazu der
 * Reiter „Vorbereitung heute“. Läuft an der PIN-Station (Startseite der
 * Rolle Backstube) ohne Admin-Layout - deshalb mit eigenem „Abmelden“.
 *
 * Gerechnet wird nichts: alle Zahlen kommen von `/api/backzettel`. Neu
 * geladen wird alle 60 s und sobald das Tablet wieder in den Vordergrund
 * kommt; ein Haken wird sofort gezeigt und bei einem Fehler zurückgenommen.
 */
export default function BackstubeClient({
  clock = () => new Date(),
}: BackstubeClientProps) {
  const session = useSession()
  const colors = useBackstubeColors()
  const role = session.user?.role ?? null
  const canWork = role === 'inhaber' || role === 'backstube'

  const clockRef = React.useRef(clock)
  clockRef.current = clock
  const [now, setNow] = React.useState<Date>(() => clock())
  const [config, setConfig] = React.useState<BackzettelConfigData | null>(null)
  const [configTried, setConfigTried] = React.useState(false)
  /** Die Wahl gilt nur für die Regel-Lage, in der sie getroffen wurde. */
  const [choice, setChoice] = React.useState<{
    value: BackstubeChoice
    rule: string
  } | null>(null)
  /**
   * Gewählter Reiter. „Zettel“/„Backen“ gelten nur für den Tag, an dem sie
   * gewählt wurden (Z10: der nächste Tag startet wieder mit seiner Vorgabe);
   * „Vorbereitung heute“ bleibt.
   */
  const [tabChoice, setTabChoice] = React.useState<{
    tab: TabId
    date: string
  } | null>(null)

  const [result, setResult] = React.useState<BackzettelDayResult | null>(null)
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null)
  const [loadError, setLoadError] = React.useState<{
    text: string
    offline: boolean
  } | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  // W4-verify r2: der 409-Code eines „veralteten“ Fehlers. Zeigt ein späteres
  // Neuladen den Stand, auf den der Fehler wartete (z. B. wieder
  // freigegeben), verschwindet die Meldung - sonst widersprach sie dem Zettel.
  const staleCodeRef = React.useRef<string | null>(null)
  const showActionError = React.useCallback(
    (text: string | null, staleCode: string | null = null) => {
      staleCodeRef.current = text ? staleCode : null
      setActionError(text)
    },
    []
  )
  const [pendingIds, setPendingIds] = React.useState<Set<number>>(new Set())
  const [ackingKey, setAckingKey] = React.useState<string | null>(null)

  const [prep, setPrep] = React.useState<PrepResult | null>(null)
  const [prepError, setPrepError] = React.useState<string | null>(null)

  const [bake, setBake] = React.useState<BakeList | null>(null)
  const [bakeError, setBakeError] = React.useState<{
    text: string
    offline: boolean
  } | null>(null)
  const [bakeLoadedAt, setBakeLoadedAt] = React.useState<Date | null>(null)

  const dates = React.useMemo(
    () => backstubeDates(now, config?.days),
    [now, config]
  )
  // Springt die Regel um (12 Uhr, Mitternacht), folgt das Tablet ihr wieder -
  // schon im selben Render, damit nicht erst der alte Tag geladen wird.
  const rule = `${dates.today}|${dates.auto}`
  const effective = choice && choice.rule === rule ? choice.value : dates.auto
  const date = dateForChoice(dates, effective)
  const prepDate = dates.next

  const dateRef = React.useRef(date)
  dateRef.current = date
  const prepDateRef = React.useRef(prepDate)
  prepDateRef.current = prepDate
  /** Zählt Schreibvorgänge: ein älterer Ladevorgang überschreibt sie nicht. */
  const mutationSeq = React.useRef(0)
  const pendingRef = React.useRef(0)
  const loadingRef = React.useRef(false)

  /**
   * Hat die API die Stammdaten schon einmal beantwortet? Scheitert der erste
   * Abruf (API weg beim Neuladen), holt jeder spätere Lauf von `refresh`
   * (60 s, Fokus, „Erneut versuchen“) sie nach - sonst blieben die
   * Füllungsnamen bis zum nächsten vollen Neuladen gekürzt.
   */
  const configLoadedRef = React.useRef(false)
  const configLoadingRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const loadConfig = React.useCallback(async () => {
    if (configLoadedRef.current || configLoadingRef.current) return
    configLoadingRef.current = true
    try {
      const res = await fetchBackzettelConfig()
      if (!mountedRef.current) return
      configLoadedRef.current = true
      setConfig(res?.config ?? null)
    } catch {
      // Nächster Lauf von refresh versucht es wieder.
    } finally {
      configLoadingRef.current = false
      if (mountedRef.current) setConfigTried(true)
    }
  }, [])

  React.useEffect(() => {
    mountedRef.current = true
    void loadConfig()
    return () => {
      mountedRef.current = false
    }
  }, [loadConfig])

  const loadDay = React.useCallback(async () => {
    const target = dateRef.current
    const seq = mutationSeq.current
    loadingRef.current = true
    setRefreshing(true)
    try {
      const res = await fetchBackzettelDay(target)
      if (dateRef.current !== target) return
      // Während ein Haken unterwegs ist (oder seit dem Start gesetzt wurde),
      // wäre diese Antwort älter als die Anzeige - der nächste Lauf holt sie.
      if (mutationSeq.current !== seq || pendingRef.current > 0) return
      setResult(res)
      setLoadedAt(clockRef.current())
      setLoadError(null)
      if (staleResolved(staleCodeRef.current, res)) showActionError(null)
      else {
        const next = afterReloadMessage(staleCodeRef.current)
        if (next !== undefined) showActionError(next)
      }
    } catch (error) {
      if (dateRef.current !== target) return
      setLoadError(
        describeBackstubeError(
          error,
          'Der Backzettel konnte nicht geladen werden.'
        )
      )
    } finally {
      loadingRef.current = false
      setRefreshing(false)
    }
  }, [showActionError])

  const loadPrep = React.useCallback(async () => {
    const target = prepDateRef.current
    try {
      const res = await fetchPrep(target)
      if (prepDateRef.current !== target) return
      setPrep(res)
      setPrepError(null)
    } catch (error) {
      if (prepDateRef.current !== target) return
      const e = error as { status?: number; code?: string } | null
      if (e && e.status === 409 && e.code === 'ruhetag') {
        setPrep({
          date: target,
          status: 'ruhetag',
          message: messageOf(error, 'An diesem Tag ist Ruhetag.'),
        })
        setPrepError(null)
        return
      }
      setPrepError(
        messageOf(error, 'Die Vorbereitung konnte nicht geladen werden.')
      )
    }
  }, [])

  const loadBake = React.useCallback(async () => {
    const target = dateRef.current
    try {
      const res = await fetchBakeList(target)
      if (dateRef.current !== target) return
      setBake(res)
      setBakeLoadedAt(clockRef.current())
      setBakeError(null)
    } catch (error) {
      if (dateRef.current !== target) return
      setBakeError(
        describeBackstubeError(
          error,
          'Die Backliste konnte nicht geladen werden.'
        )
      )
    }
  }, [])

  // Erster Lauf und Tageswechsel: erst die Stammdaten (Produktionstage),
  // damit nicht kurz ein falscher Tag geladen wird.
  React.useEffect(() => {
    if (!configTried) return
    void loadDay()
  }, [configTried, date, loadDay])

  const tabRef = React.useRef<TabId>('zettel')
  const refresh = React.useCallback(() => {
    setNow(clockRef.current())
    if (!configLoadedRef.current) void loadConfig()
    if (!loadingRef.current) void loadDay()
    if (tabRef.current === 'vorbereitung') void loadPrep()
    if (tabRef.current === 'backen') void loadBake()
  }, [loadBake, loadConfig, loadDay, loadPrep])

  // Alle 60 s und beim Zurückkommen ins Bild neu laden.
  React.useEffect(() => {
    const timer = window.setInterval(refresh, BACKSTUBE_REFRESH_MS)
    const onFocus = () => refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const shown = result && result.date === date ? result : null
  const tab: TabId =
    tabChoice && (tabChoice.tab === 'vorbereitung' || tabChoice.date === date)
      ? tabChoice.tab
      : defaultBackstubeTab(shown)
  tabRef.current = tab

  // Freigegebener Tag mit noch nicht erfassten Änderungen an Vorbestellungen:
  // die API trägt sie im Hintergrund nach - nach kurzer Zeit noch einmal
  // laden statt erst nach 60 s (begrenzt).
  const pendingReloads = React.useRef(0)
  const deltasPending =
    !!shown &&
    isBackzettelDay(shown) &&
    shown.status === 'confirmed' &&
    shown.deltasPending === true
  React.useEffect(() => {
    if (!deltasPending) {
      pendingReloads.current = 0
      return
    }
    if (pendingReloads.current >= DELTAS_PENDING_MAX_RELOADS) return
    const timer = window.setTimeout(() => {
      pendingReloads.current += 1
      if (!loadingRef.current) void loadDay()
    }, DELTAS_PENDING_RELOAD_MS)
    return () => window.clearTimeout(timer)
  }, [deltasPending, result, loadDay])
  React.useEffect(() => {
    if (!configTried || tab !== 'vorbereitung') return
    void loadPrep()
  }, [configTried, tab, prepDate, loadPrep])

  // Die Backliste nur laden, wenn sie gezeigt wird (auch beim Neuladen).
  React.useEffect(() => {
    if (!configTried || tab !== 'backen') return
    void loadBake()
  }, [configTried, tab, date, loadBake])
  const bakeShown = bake && bake.date === date ? bake : null

  const prepShown = prep && prep.date === prepDate ? prep : null
  const day = isBackzettelDay(shown) ? shown : null

  const updateDay = (
    target: string,
    fn: (day: BackzettelDay) => BackzettelDay
  ) => {
    setResult((current) =>
      current && current.date === target && isBackzettelDay(current)
        ? fn(current)
        : current
    )
  }

  const toggleLine = async (line: BackzettelLine) => {
    if (!day || day.status !== 'confirmed' || line.id === null) return
    const lineId = line.id
    const target = day.date
    const done = !line.doneAt
    const before = { doneAt: line.doneAt, doneBy: line.doneBy }
    mutationSeq.current += 1
    pendingRef.current += 1
    setPendingIds((ids) => new Set(ids).add(lineId))
    showActionError(null)
    updateDay(target, (d) =>
      patchLines(
        d,
        (l) => l.id === lineId,
        () =>
          done
            ? {
                doneAt: clockRef.current().toISOString(),
                doneBy: session.user
                  ? {
                      id: Number(session.user.id),
                      displayName: session.user.displayName,
                    }
                  : null,
              }
            : { doneAt: null, doneBy: null }
      )
    )
    let stale = false
    try {
      const res = await setLineDone(target, lineId, done, line.total)
      updateDay(target, (d) =>
        patchLines(
          d,
          (l) => l.id === lineId,
          () => ({ doneAt: res.doneAt, doneBy: res.doneBy })
        )
      )
    } catch (error) {
      // Zurücknehmen: der Haken steht nur, wenn der Server ihn hat.
      updateDay(target, (d) =>
        patchLines(
          d,
          (l) => l.id === lineId,
          () => before
        )
      )
      stale = isStale(error)
      const text = messageOf(
        error,
        'Der Haken konnte nicht gespeichert werden.'
      )
      showActionError(
        stale
          ? `${text} Der Backzettel wird neu geladen.`
          : `Nicht gespeichert: ${text}`,
        stale ? codeOf(error) : isTransient(error) ? TRANSIENT_TICK : null
      )
    } finally {
      pendingRef.current -= 1
      setPendingIds((ids) => {
        const next = new Set(ids)
        next.delete(lineId)
        return next
      })
    }
    if (stale) {
      mutationSeq.current += 1
      void loadDay()
    }
  }

  /** „Gesehen“ für eine Zeile (alle ihre offenen Nachträge) oder alle. */
  const ack = async (group: BackzettelDeltaEntry[], groupKey: string) => {
    if (!day || group.length === 0) return
    const target = day.date
    mutationSeq.current += 1
    setAckingKey(groupKey)
    showActionError(null)
    try {
      const results =
        group.length === 1
          ? [await acknowledgeDelta(target, group[0].id)]
          : await acknowledgeDeltas(
              target,
              group.map((x) => x.id)
            )
      const byId = new Map(
        (results ?? []).filter(Boolean).map((r) => [r.id, r])
      )
      const ids = new Set(group.map((x) => x.id))
      updateDay(target, (d) => {
        const closed = new Map<string, number>()
        for (const x of d.deltas) {
          if (ids.has(x.id) && !x.acknowledgedAt) {
            closed.set(x.key, (closed.get(x.key) ?? 0) + 1)
          }
        }
        const next = patchLines(
          d,
          (l) => closed.has(l.key) && !!l.delta,
          (l) => ({
            delta: l.delta
              ? {
                  ...l.delta,
                  open: Math.max(0, l.delta.open - (closed.get(l.key) ?? 0)),
                }
              : null,
          })
        )
        return {
          ...next,
          deltas: d.deltas.map((x) => {
            if (!ids.has(x.id) || x.acknowledgedAt) return x
            const res = byId.get(x.id)
            return {
              ...x,
              acknowledgedAt:
                res?.acknowledgedAt ?? clockRef.current().toISOString(),
              acknowledgedBy: res?.acknowledgedBy ?? null,
            }
          }),
        }
      })
    } catch (error) {
      const text = messageOf(
        error,
        'Der Nachtrag konnte nicht quittiert werden.'
      )
      showActionError(
        isStale(error) ? `${text} Der Backzettel wird neu geladen.` : text,
        isStale(error)
          ? codeOf(error)
          : isTransient(error)
          ? TRANSIENT_ACK
          : null
      )
      if (isStale(error)) {
        mutationSeq.current += 1
        void loadDay()
      }
    } finally {
      setAckingKey(null)
    }
  }

  /**
   * „Gesehen“ auf der Backliste (Z10): jeder Nachtrag gehört zum Zettel
   * seines Teigtags - je Teigtag quittieren, danach die Liste neu laden.
   */
  const ackBake = async (group: BackzettelDeltaEntry[], groupKey: string) => {
    if (!bakeShown || group.length === 0) return
    setAckingKey(groupKey)
    showActionError(null)
    const byDough = new Map<string, number[]>()
    for (const d of group) {
      const dough = d.doughDate ?? bakeShown.date
      byDough.set(dough, [...(byDough.get(dough) ?? []), d.id])
    }
    try {
      for (const [dough, ids] of Array.from(byDough)) {
        if (ids.length === 1) await acknowledgeDelta(dough, ids[0])
        else await acknowledgeDeltas(dough, ids)
      }
    } catch (error) {
      showActionError(
        messageOf(error, 'Der Nachtrag konnte nicht quittiert werden.')
      )
    } finally {
      setAckingKey(null)
    }
    await loadBake()
  }

  const planPath = `/admin/backzettel/${date}`
  const mayPlan =
    !!role && isPathAllowedForRole(planPath, role, session.sessionKind)
  // Wer mit Passwort aus der Verwaltung hierher kommt (Inhaber über die
  // Seitenleiste), braucht einen Weg zurück; das Tablet an der Station nicht.
  const mayAdmin =
    session.sessionKind === 'personal' &&
    !!role &&
    isPathAllowedForRole('/admin', role, session.sessionKind)

  const lines = day ? allLines(day) : []
  const doneCount = lines.filter((l) => l.doneAt).length
  const draft = day?.status === 'draft'
  const isSaturday = day?.weekday === 6

  const v2 = isDoughDaySheet(day)

  const renderSection = (
    section: BackzettelSection,
    id: string,
    stripBakeDate: boolean
  ) =>
    section.lines.length === 0 ? null : (
      <Box
        component="section"
        key={id}
        data-testid={`bs-section-${id}`}
        aria-labelledby={`bs-section-title-${id}`}
      >
        <Typography
          id={`bs-section-title-${id}`}
          component={stripBakeDate ? 'h3' : 'h2'}
          sx={{
            fontSize: { xs: '1.5rem', sm: '1.9rem' },
            fontWeight: 800,
            mt: 1,
            mb: 1,
          }}
        >
          {section.label}
        </Typography>
        <Stack spacing={1}>
          {section.lines.map((line) => (
            <BackstubeLine
              key={line.key}
              // Unter der Backtag-Überschrift kein „· für …“ am Namen.
              line={stripBakeDate ? { ...line, bakeDate: undefined } : line}
              config={config}
              draft={draft}
              canTick={canWork}
              pending={line.id !== null && pendingIds.has(line.id)}
              onToggle={toggleLine}
            />
          ))}
        </Stack>
      </Box>
    )

  const hefeteig = day ? (
    <BackstubeHefeteig
      hefeteig={day.hefeteig}
      fillings={day.fillings}
      draft={draft}
      deltaExtras={day.deltaExtras}
    />
  ) : null

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        pb: 6,
        // global.css blendet jedes <section> beim Einhängen 0,8 s ein. Auf
        // dem Tablet (Tag wechseln, Neuladen) stünde der Zettel dann blass da.
        '& section, & .MuiChip-root': { animation: 'none' },
        // Gedruckt wird über „Planung & Druck“ (Z7); Strg+P hier soll
        // wenigstens keine Bedienelemente und keinen dunklen Grund drucken.
        '@media print': {
          minHeight: 0,
          pb: 0,
          bgcolor: '#fff',
          color: '#000',
          '& [data-print="hide"]': { display: 'none !important' },
          '& header': { position: 'static' },
          // Dunkle Karten und farbige Banner würden mit schwarzer Schrift
          // unlesbar - im Druck alles schwarz auf weiß, Rahmen bleiben.
          '& *': {
            backgroundColor: 'transparent !important',
            color: '#000 !important',
            boxShadow: 'none !important',
            opacity: '1 !important',
            // W4-verify r2: Rahmen in `text.primary`/`divider` sind im
            // dunklen Modus weiß - auf Papier fehlten die leeren Kästchen.
            borderColor: '#888 !important',
          },
          '& [role="checkbox"]': { borderColor: '#000 !important' },
        },
      }}
    >
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          borderBottom: '2px solid',
          borderColor: 'divider',
          px: { xs: 1.5, sm: 3 },
          pt: 1.5,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          sx={{ gap: 1.5 }}
        >
          <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '1rem',
                color: 'text.secondary',
                lineHeight: 1.2,
              }}
            >
              Backstube
              {session.user ? ` · ${session.user.displayName}` : ''}
            </Typography>
            <Typography
              component="h1"
              data-testid="bs-date"
              sx={{
                fontSize: { xs: '1.6rem', sm: '2.1rem' },
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              {tab !== 'vorbereitung'
                ? formatDateLong(date)
                : `Heute, ${formatDateLong(dates.today)}`}
            </Typography>
          </Box>
          {/* Die Vorbereitung gilt immer dem nächsten Backtag - dort kein Umschalter. */}
          {tab !== 'vorbereitung' && (
            <ToggleButtonGroup
              data-print="hide"
              exclusive
              value={effective}
              onChange={(_, value: BackstubeChoice | null) => {
                if (value) setChoice({ value, rule })
              }}
              aria-label="Tag wählen"
              sx={{
                '& .MuiToggleButton-root': {
                  minHeight: 56,
                  minWidth: 112,
                  fontSize: '1.15rem',
                  fontWeight: 700,
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
              <ToggleButton value="heute" data-testid="bs-choice-heute">
                Heute
                <Box
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 500 }}
                >
                  {dates.todayIsProductionDay
                    ? formatDateShort(dates.today)
                    : 'Ruhetag'}
                </Box>
              </ToggleButton>
              <ToggleButton value="morgen" data-testid="bs-choice-morgen">
                {nextLabel(dates)}
                <Box
                  component="span"
                  sx={{ fontSize: '0.85rem', fontWeight: 500 }}
                >
                  {nextLabel(dates) === 'Morgen'
                    ? formatDateShort(dates.next)
                    : 'nächster Backtag'}
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            data-print="hide"
            sx={{ gap: 1 }}
          >
            {mayAdmin && (
              <Button
                component={Link}
                href="/admin"
                variant="outlined"
                color="inherit"
                size="large"
                sx={{
                  minHeight: 56,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                Zur Verwaltung
              </Button>
            )}
            <IconButton
              onClick={refresh}
              aria-label="Neu laden"
              sx={{
                width: 56,
                height: 56,
                border: '2px solid',
                borderColor: 'divider',
              }}
            >
              {refreshing ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                <RefreshIcon sx={{ fontSize: 30 }} />
              )}
            </IconButton>
            <LogoutButton
              variant="outlined"
              color="inherit"
              size="large"
              sx={{ minHeight: 56, fontSize: '1.1rem', fontWeight: 700 }}
            />
          </Stack>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, value: TabId) => {
            setTabChoice({ tab: value, date })
            showActionError(null)
          }}
          aria-label="Ansicht"
          data-print="hide"
          textColor="inherit"
          TabIndicatorProps={{ sx: { height: 4, bgcolor: 'text.primary' } }}
          sx={{
            mt: 1,
            '& .MuiTab-root': {
              minHeight: 56,
              fontSize: { xs: '1.05rem', sm: '1.25rem' },
              fontWeight: 700,
              textTransform: 'none',
            },
          }}
        >
          <Tab value="zettel" label="Zettel" />
          <Tab value="backen" label="Backen" />
          <Tab value="vorbereitung" label="Vorbereitung heute" />
        </Tabs>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 2, maxWidth: 1280, mx: 'auto' }}>
        {actionError && (
          <Alert
            severity="error"
            onClose={() => showActionError(null)}
            sx={{ mb: 2, fontSize: '1.15rem', alignItems: 'center' }}
          >
            {actionError}
          </Alert>
        )}

        {tab === 'backen' ? (
          <Stack spacing={2}>
            {bakeError && bakeShown && (
              <Alert severity="warning" sx={{ fontSize: '1.1rem' }}>
                {bakeError.offline
                  ? bakeError.text
                  : `Neu laden fehlgeschlagen: ${bakeError.text}`}{' '}
                Angezeigt wird der Stand von{' '}
                {bakeLoadedAt ? timeOf(bakeLoadedAt) : '–'}.
              </Alert>
            )}
            {!bakeShown && bakeError && (
              <Alert
                severity="error"
                sx={{ fontSize: '1.15rem', alignItems: 'center' }}
                action={
                  <Button
                    color="inherit"
                    onClick={refresh}
                    sx={{ minHeight: 48, fontSize: '1.05rem' }}
                  >
                    Erneut versuchen
                  </Button>
                }
              >
                {bakeError.text}
              </Alert>
            )}
            {!bakeShown && !bakeError && (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress aria-label="Backliste wird geladen" />
              </Box>
            )}
            {bakeShown?.status === 'ruhetag' && (
              <Box
                data-testid="bs-bake-ruhetag"
                sx={{ py: 6, textAlign: 'center' }}
              >
                <Typography sx={{ fontSize: '2.25rem', fontWeight: 800 }}>
                  Ruhetag
                </Typography>
                <Typography
                  sx={{ fontSize: '1.25rem', color: 'text.secondary' }}
                >
                  An diesem Tag wird nicht gebacken.
                </Typography>
              </Box>
            )}
            {bakeShown?.status === 'no-config' && (
              <Alert
                severity="warning"
                data-testid="bs-bake-no-config"
                sx={{ fontSize: '1.2rem' }}
              >
                Keine Backliste: Die Stammdaten (backzettel.yaml) fehlen oder
                sind ungültig. Bitte im Büro Bescheid geben.
              </Alert>
            )}
            {bakeShown?.status === 'ok' && (
              <BackstubeBakeList
                list={bakeShown}
                config={config}
                canAck={canWork}
                ackingKey={ackingKey}
                onAck={(group, key) => void ackBake(group, key)}
              />
            )}
            <Typography
              data-print="hide"
              sx={{ fontSize: '1rem', color: 'text.secondary', pt: 1 }}
            >
              {bakeLoadedAt
                ? `Stand ${timeOf(bakeLoadedAt)} · lädt jede Minute neu`
                : ''}
            </Typography>
          </Stack>
        ) : tab === 'zettel' ? (
          <Stack spacing={2}>
            {loadError && shown && (
              <Alert severity="warning" sx={{ fontSize: '1.1rem' }}>
                {loadError.offline
                  ? loadError.text
                  : `Neu laden fehlgeschlagen: ${loadError.text}`}{' '}
                Angezeigt wird der Stand von {loadedAt ? timeOf(loadedAt) : '–'}
                .
              </Alert>
            )}
            {!shown && loadError && (
              <Alert
                severity="error"
                sx={{ fontSize: '1.15rem', alignItems: 'center' }}
                action={
                  <Button
                    color="inherit"
                    onClick={refresh}
                    sx={{ minHeight: 48, fontSize: '1.05rem' }}
                  >
                    Erneut versuchen
                  </Button>
                }
              >
                {loadError.text}
              </Alert>
            )}
            {!shown && !loadError && (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress aria-label="Backzettel wird geladen" />
              </Box>
            )}

            {shown?.status === 'ruhetag' && (
              <Box data-testid="bs-ruhetag" sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '2.25rem', fontWeight: 800 }}>
                  Ruhetag
                </Typography>
                <Typography
                  sx={{ fontSize: '1.25rem', color: 'text.secondary' }}
                >
                  An diesem Tag wird nicht gebacken.
                </Typography>
              </Box>
            )}

            {shown?.status === 'no-config' && (
              <Alert
                severity="warning"
                data-testid="bs-no-config"
                sx={{ fontSize: '1.2rem' }}
              >
                Für diesen Tag gibt es keinen Backzettel: Die Stammdaten
                (backzettel.yaml) fehlen oder sind ungültig. Bitte im Büro
                Bescheid geben.
              </Alert>
            )}

            {day && (
              <>
                {draft ? (
                  <Box
                    role="status"
                    data-testid="bs-draft-banner"
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 2,
                      bgcolor: colors.draftBg,
                      color: colors.draftFg,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: { xs: '1.6rem', sm: '2rem' },
                        fontWeight: 800,
                        lineHeight: 1.15,
                      }}
                    >
                      Noch nicht freigegeben
                    </Typography>
                    <Typography sx={{ fontSize: '1.15rem', mt: 0.5 }}>
                      Die Mengen sind ein Entwurf und können sich noch ändern.
                      Abhaken geht erst nach der Freigabe.
                    </Typography>
                  </Box>
                ) : (
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    alignItems="baseline"
                    sx={{ columnGap: 2 }}
                  >
                    <Typography
                      data-testid="bs-progress"
                      sx={{
                        fontSize: { xs: '1.3rem', sm: '1.6rem' },
                        fontWeight: 800,
                      }}
                    >
                      {doneCount} von {lines.length} erledigt
                    </Typography>
                    <Typography
                      sx={{ fontSize: '1.05rem', color: 'text.secondary' }}
                    >
                      Freigegeben
                      {day.confirmedBy
                        ? ` von ${day.confirmedBy.displayName}`
                        : ''}
                      {day.confirmedAt
                        ? ` am ${formatTimestamp(day.confirmedAt)}`
                        : ''}
                    </Typography>
                  </Stack>
                )}

                {deltasPending && (
                  <Alert
                    severity="warning"
                    data-testid="bs-deltas-pending"
                    sx={{ fontSize: '1.05rem' }}
                  >
                    Vorbestellungen haben sich geändert. Die Nachträge werden
                    gerade übernommen und erscheinen gleich.
                  </Alert>
                )}
                {!draft && day.configStatus === 'no-config' && (
                  <Alert
                    severity="warning"
                    data-testid="bs-confirmed-no-config"
                    sx={{ fontSize: '1.05rem' }}
                  >
                    Die Backzettel-Stammdaten fehlen gerade. Spätere Änderungen
                    an Vorbestellungen können deshalb nicht als Nachtrag
                    erscheinen. Bitte dem Inhaber Bescheid geben.
                  </Alert>
                )}

                {day.configChangedSinceConfirm && (
                  <Alert severity="info" sx={{ fontSize: '1.05rem' }}>
                    Die Stammdaten haben sich seit der Freigabe geändert. Es
                    gilt der freigegebene Zettel.
                  </Alert>
                )}

                {v2 && (
                  <>
                    <Typography
                      data-testid="bs-doughs-today"
                      sx={{
                        fontSize: { xs: '1.15rem', sm: '1.35rem' },
                        fontWeight: 700,
                      }}
                    >
                      {day.isDoughDay === false
                        ? 'Heute kein Teig – was gebacken wird, steht unter „Backen“.'
                        : doughsTodayText(day)}
                    </Typography>
                    <MachineStrip
                      machine={day.machine ?? []}
                      doughs={day.doughs}
                      large
                      muted={draft}
                    />
                  </>
                )}

                <BackstubeDeltas
                  sheetDate={day.date}
                  deltas={day.deltas}
                  bakeByKey={Object.fromEntries(
                    Object.entries(deltaTotalsByKey(day)).map(([key, d]) => [
                      key,
                      d?.bakeOpen,
                    ])
                  )}
                  config={config}
                  canAck={canWork && !draft}
                  ackingKey={ackingKey}
                  onAck={ack}
                />

                {isSaturday && hefeteig}

                {v2
                  ? sectionsByBakeDay(day).map((group) => {
                      const rolls = (day.rolls ?? []).find(
                        (r) => r.bakeDate === group.bakeDate
                      )
                      return (
                        <Box
                          key={group.bakeDate}
                          data-testid={`bs-bakeday-${group.bakeDate}`}
                        >
                          <Typography
                            component="h2"
                            sx={{
                              fontSize: { xs: '1.6rem', sm: '2.1rem' },
                              fontWeight: 800,
                              mt: 1,
                              pb: 0.5,
                              borderBottom: '3px solid',
                              borderColor: 'text.primary',
                            }}
                          >
                            {group.bakeDate === day.date
                              ? 'Heute backen'
                              : `Teig ${bakeDayLabel(
                                  group.bakeDate,
                                  day.date
                                )}`}
                          </Typography>
                          {rolls && rolls.groups.length > 0 && (
                            <Box
                              component="ul"
                              data-testid={`bs-bruch-${group.bakeDate}`}
                              sx={{
                                m: 0,
                                mt: 1,
                                pl: 3,
                                fontSize: { xs: '1.15rem', sm: '1.35rem' },
                                fontWeight: 700,
                              }}
                            >
                              {rolls.groups.map((g) => (
                                <li key={g.key}>
                                  {g.name}: {bruchGroupText(g)}
                                </li>
                              ))}
                            </Box>
                          )}
                          {group.sections.map((section) =>
                            renderSection(
                              section,
                              `${group.bakeDate}-${section.id}`,
                              true
                            )
                          )}
                        </Box>
                      )
                    })
                  : day.sections.map((section) =>
                      renderSection(section, section.id, false)
                    )}

                {lines.length === 0 && (
                  <Typography sx={{ fontSize: '1.4rem', py: 4 }}>
                    Auf diesem Zettel steht nichts.
                  </Typography>
                )}

                {!isSaturday && hefeteig}

                {day.warnings.length > 0 && (
                  <Alert
                    severity="info"
                    data-testid="bs-warnings"
                    sx={{ fontSize: '1.05rem' }}
                  >
                    {day.warnings.map((w, i) => (
                      <div key={`${w.code}-${i}`}>{w.message}</div>
                    ))}
                  </Alert>
                )}
              </>
            )}

            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              data-print="hide"
              sx={{ gap: 2, pt: 1 }}
            >
              <Typography sx={{ fontSize: '1rem', color: 'text.secondary' }}>
                {loadedAt
                  ? `Stand ${timeOf(loadedAt)} · lädt jede Minute neu`
                  : ''}
              </Typography>
              {mayPlan && (
                <Button
                  component={Link}
                  href={planPath}
                  variant="outlined"
                  color="inherit"
                  sx={{ minHeight: 48 }}
                >
                  Planung &amp; Druck
                </Button>
              )}
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {prepError && (
              <Alert severity="error" sx={{ fontSize: '1.15rem' }}>
                {prepError}
              </Alert>
            )}
            {!prepShown && !prepError && (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <CircularProgress aria-label="Vorbereitung wird geladen" />
              </Box>
            )}
            {prepShown?.status === 'ruhetag' && (
              <Typography sx={{ fontSize: '1.5rem', py: 4 }}>
                {formatDateLong(prepShown.date)} ist Ruhetag – nichts
                vorzubereiten.
              </Typography>
            )}
            {prepShown?.status === 'no-config' && (
              <Alert severity="warning" sx={{ fontSize: '1.2rem' }}>
                Keine Vorbereitung: Die Stammdaten (backzettel.yaml) fehlen oder
                sind ungültig.
              </Alert>
            )}
            {prepShown &&
              (prepShown.status === 'draft' ||
                prepShown.status === 'confirmed') && (
                <BackstubePrep prep={prepShown} today={dates.today} />
              )}
          </Stack>
        )}
      </Box>
    </Box>
  )
}
