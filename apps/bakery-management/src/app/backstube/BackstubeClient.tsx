'use client'

import React from 'react'
import { Alert, Box, Fab } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import {
  DELTAS_PENDING_MAX_RELOADS,
  DELTAS_PENDING_RELOAD_MS,
  acknowledgeDelta,
  acknowledgeDeltas,
  fetchBackzettelConfig,
  fetchBackzettelDay,
  fetchBakeList,
  fetchPrep,
  isBackzettelDay,
  setDeltasBaked,
  setLineBaked,
  setLineDone,
  type BackzettelConfigData,
  type BackzettelDay,
  type BackzettelDayResult,
  type BackzettelDeltaEntry,
  type BackzettelLine,
  type BackzettelNoConfig,
  type BakeList,
  type PrepView,
} from '../../lib/backzettelApi'
import { formatDateLong, formatDateShort } from '../../lib/backzettelFormat'
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
import {
  bakeProgress,
  focusStartIndex,
  isReopened,
  openDeltaCount,
  sectionsByBakeDay,
  sheetProgress,
  type BackstubeTocEntry,
} from '../../lib/backstubeProgress'
import { useSession } from '../../lib/session'
import { hasBackstubeRights, isPathAllowedForRole } from '../../lib/roles'
import { BackstubePrep } from '../../components/backstube/BackstubePrep'
import {
  BakeListAside,
  BakeListMain,
  bakeDeltaTickKey,
  bakeLineTickKey,
} from '../../components/backstube/BackstubeBakeList'
import type { BakeDeltaGroup } from '../../lib/backstubeBake'
import { BackstubeHeader } from '../../components/backstube/BackstubeHeader'
import {
  BackstubeLayout,
  BS_HEADER_VAR,
  BS_WIDE,
} from '../../components/backstube/BackstubeLayout'
import { BackstubeSheet } from '../../components/backstube/BackstubeSheet'
import {
  BackstubeClosedDay,
  BackstubeDeltaBanner,
  BackstubeLoadFailed,
  BackstubeLoading,
  BackstubeStaleNotice,
} from '../../components/backstube/BackstubeStates'
import { BackstubeFocus } from '../../components/backstube/BackstubeFocus'
import { BackstubeViewProvider } from '../../components/backstube/BackstubeView'
import { jumpTo } from '../../components/backstube/BackstubeOverview'
import { DELTAS_ANCHOR } from '../../components/backstube/BackstubeDeltas'

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
    return 'Die Verbindung ist wieder da. Der Nachtrag wurde nicht als gesehen gespeichert – bitte noch einmal „Gesehen“ tippen.'
  }
  return undefined
}

function messageOf(error: unknown, fallback: string): string {
  return describeBackstubeError(error, fallback).text
}

/** Z10 O5: wie `isStale`, dazu eine Zeile, die inzwischen an einem anderen Tag gebacken wird. */
function isBakeStale(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null
  return isStale(error) || (e?.status === 404 && e.code === 'not_on_bake_list')
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
// Z10: seit dem Umbau in lib/backstubeProgress.ts (der Überblick braucht sie auch).
export { sectionsByBakeDay }

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
 * Aufbau (UI-Umbau 2026-11): fester Kopf (`BackstubeHeader`: Tag, Reiter,
 * Stand, Fortschrittsleiste), darunter ab 1080 px zwei Spalten
 * (`BackstubeLayout`): links Überblick mit Sprung zu jedem Abschnitt,
 * Nachträge und Hinweise, rechts die Zeilen. Hier stehen nur Laden,
 * Abhaken und Quittieren; was gezeigt wird, steht in `BackstubeSheet`
 * (Zettel), `BakeListAside`/`BakeListMain` (Backen) und `BackstubePrep`.
 *
 * Gerechnet wird nichts: alle Zahlen kommen von `/api/backzettel`. Neu
 * geladen wird alle 60 s und sobald das Tablet wieder in den Vordergrund
 * kommt; ein Haken wird sofort gezeigt und bei einem Fehler zurückgenommen.
 */
export default function BackstubeClient({
  clock = () => new Date(),
}: BackstubeClientProps) {
  const session = useSession()
  const role = session.user?.role ?? null
  const canWork = hasBackstubeRights(role)

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

  /**
   * Bäcker-Ansicht (UI-Runde 2): je Reiter, mit dem gezeigten Abschnitt
   * (`null` = beim ersten offenen beginnen). Kein eigener Abruf - die
   * Abschnitte sind die des Überblicks.
   */
  const [focusChoice, setFocusChoice] = React.useState<{
    tab: TabId
    anchor: string | null
  } | null>(null)
  /** Nach dem Verlassen der Bäcker-Ansicht dorthin springen (z. B. Nachträge). */
  const pendingJump = React.useRef<string | null>(null)

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
  /** Z10 O5: laufende gebacken-Haken (`bakeLineTickKey` / `bakeDeltaTickKey`). */
  const [bakePending, setBakePending] = React.useState<Set<string>>(new Set())
  /** Wie `mutationSeq`/`pendingRef`, für die Backliste. */
  const bakeSeq = React.useRef(0)
  const bakePendingRef = React.useRef(0)
  /**
   * Ein Neuladen der Backliste wurde wegen eines laufenden gebacken-Hakens
   * verworfen (oder ist nach einem Fehler fällig): es wird nachgeholt,
   * sobald kein Haken mehr unterwegs ist - sonst fehlte z. B. das „Gesehen“
   * eines gleichzeitig quittierten Nachtrags bis zum nächsten Abruf.
   */
  const bakeReloadDue = React.useRef(false)
  const loadBakeRef = React.useRef<() => Promise<void>>(async () => undefined)
  const reloadBakeWhenSettled = React.useCallback(() => {
    if (bakePendingRef.current > 0 || !bakeReloadDue.current) return
    bakeReloadDue.current = false
    void loadBakeRef.current()
  }, [])

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
      if (
        e &&
        e.status === 409 &&
        (e.code === 'ruhetag' || e.code === 'geschlossen')
      ) {
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
    const seq = bakeSeq.current
    try {
      const res = await fetchBakeList(target)
      if (dateRef.current !== target) return
      // Ein gebacken-Haken unterwegs (oder seit dem Start gesetzt): diese
      // Antwort ist älter als die Anzeige. Nicht wegwerfen, sondern neu
      // laden, sobald kein Haken mehr unterwegs ist.
      if (bakeSeq.current !== seq || bakePendingRef.current > 0) {
        bakeReloadDue.current = true
        reloadBakeWhenSettled()
        return
      }
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
  }, [reloadBakeWhenSettled])
  React.useEffect(() => {
    loadBakeRef.current = loadBake
  }, [loadBake])

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
    // UI-Runde 1: Kam nach dem Haken ein Nachtrag, ist die Zeile wieder
    // offen. Ein Tipp heißt dann „Zusatzmenge gebacken“ - der Haken wird neu
    // gesetzt (undone + done), damit sein Zeitpunkt nach dem Nachtrag liegt.
    const retick = isReopened(line, day.deltas)
    const done = retick || !line.doneAt
    const before = { doneAt: line.doneAt, doneBy: line.doneBy }
    let undoneOk = false
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
      if (retick) {
        await setLineDone(target, lineId, false)
        undoneOk = true
      }
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
          () => (undoneOk ? { doneAt: null, doneBy: null } : before)
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
        'Der Nachtrag konnte nicht als gesehen gespeichert werden.'
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

  const updateBake = (target: string, fn: (list: BakeList) => BakeList) => {
    setBake((current) =>
      current && current.date === target && current.status === 'ok'
        ? fn(current)
        : current
    )
  }

  const markBakePending = (key: string, on: boolean) =>
    setBakePending((keys) => {
      const next = new Set(keys)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const me = () =>
    session.user
      ? { id: Number(session.user.id), displayName: session.user.displayName }
      : null

  /**
   * Z10 O5: „gebacken“ für eine Zeile der Backliste - sofort gezeigt, bei
   * einem Fehler zurückgenommen (wie der Haken auf dem Zettel).
   */
  const toggleBakeLine = async (line: BackzettelLine) => {
    if (!bakeShown || line.id === null || line.sheetStatus === 'draft') return
    const lineId = line.id
    const target = bakeShown.date
    const baked = !line.bakedAt
    const before = {
      bakedAt: line.bakedAt ?? null,
      bakedBy: line.bakedBy ?? null,
    }
    const key = bakeLineTickKey(line)
    const patch = (fields: Partial<BackzettelLine>) =>
      updateBake(target, (list) => ({
        ...list,
        sections: list.sections.map((s) => ({
          ...s,
          lines: s.lines.map((l) =>
            l.id === lineId ? { ...l, ...fields } : l
          ),
        })),
      }))
    bakeSeq.current += 1
    bakePendingRef.current += 1
    markBakePending(key, true)
    showActionError(null)
    patch(
      baked
        ? { bakedAt: clockRef.current().toISOString(), bakedBy: me() }
        : { bakedAt: null, bakedBy: null }
    )
    let stale = false
    try {
      const res = await setLineBaked(target, lineId, baked, line.total)
      patch({ bakedAt: res.bakedAt, bakedBy: res.bakedBy })
    } catch (error) {
      // Zurücknehmen: der Haken steht nur, wenn der Server ihn hat.
      patch(before)
      stale = isBakeStale(error)
      const text = messageOf(
        error,
        'Der Haken konnte nicht gespeichert werden.'
      )
      showActionError(
        stale
          ? `${text} Die Backliste wird neu geladen.`
          : `Nicht gespeichert: ${text}`,
        !stale && isTransient(error) ? TRANSIENT_TICK : null
      )
    } finally {
      bakePendingRef.current -= 1
      markBakePending(key, false)
    }
    if (stale) {
      bakeSeq.current += 1
      bakeReloadDue.current = true
    }
    reloadBakeWhenSettled()
  }

  /**
   * Z10 O5: „gebacken“ für die Nachträge einer Zeile (jeder Nachtrag hat
   * seinen eigenen Haken; ein Tippen setzt die noch offenen bzw. nimmt alle
   * zurück). Gebacken quittiert offene Nachträge mit.
   */
  const toggleBakeDeltas = async (group: BakeDeltaGroup) => {
    if (!bakeShown || group.toggleIds.length === 0) return
    const target = bakeShown.date
    const ids = new Set(group.toggleIds)
    const baked = group.toggleTo
    const before = new Map(
      bakeShown.deltas
        .filter((d) => ids.has(d.id))
        .map((d) => [
          d.id,
          {
            bakedAt: d.bakedAt ?? null,
            bakedBy: d.bakedBy ?? null,
            acknowledgedAt: d.acknowledgedAt,
            acknowledgedBy: d.acknowledgedBy,
          },
        ])
    )
    const patch = (
      fields: (d: BackzettelDeltaEntry) => Partial<BackzettelDeltaEntry>
    ) =>
      updateBake(target, (list) => ({
        ...list,
        deltas: list.deltas.map((d) =>
          ids.has(d.id) ? { ...d, ...fields(d) } : d
        ),
      }))
    const key = bakeDeltaTickKey(group)
    bakeSeq.current += 1
    bakePendingRef.current += 1
    markBakePending(key, true)
    showActionError(null)
    const now = clockRef.current().toISOString()
    const by = me()
    patch((d) =>
      baked
        ? {
            bakedAt: now,
            bakedBy: by,
            acknowledgedAt: d.acknowledgedAt ?? now,
            acknowledgedBy: d.acknowledgedAt ? d.acknowledgedBy : by,
          }
        : { bakedAt: null, bakedBy: null }
    )
    let ok = false
    let stale = false
    try {
      const res = await setDeltasBaked(target, Array.from(ids), baked)
      const byId = new Map((res ?? []).map((r) => [r.id, r]))
      patch((d) => {
        const r = byId.get(d.id)
        return r
          ? {
              bakedAt: r.bakedAt ?? null,
              bakedBy: r.bakedBy ?? null,
              acknowledgedAt: r.acknowledgedAt,
              acknowledgedBy: r.acknowledgedBy,
            }
          : {}
      })
      ok = true
    } catch (error) {
      patch((d) => before.get(d.id) ?? {})
      stale = isBakeStale(error)
      const text = messageOf(
        error,
        'Der Haken konnte nicht gespeichert werden.'
      )
      showActionError(
        stale
          ? `${text} Die Backliste wird neu geladen.`
          : `Nicht gespeichert: ${text}`,
        !stale && isTransient(error) ? TRANSIENT_TICK : null
      )
    } finally {
      bakePendingRef.current -= 1
      markBakePending(key, false)
    }
    // Danach neu laden: „gesehen“ an der Zeile und die offene Zahl kommen
    // vom Server.
    if (ok || stale) {
      bakeSeq.current += 1
      bakeReloadDue.current = true
    }
    reloadBakeWhenSettled()
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

  // Höhe des festen Kopfes als CSS-Variable: Sprungziele und die
  // mitlaufende Seitenspalte bleiben darunter frei.
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const headerRef = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    const header = headerRef.current
    const root = rootRef.current
    if (!header || !root || typeof ResizeObserver === 'undefined') return
    const set = () =>
      root.style.setProperty(
        BS_HEADER_VAR,
        `${Math.round(header.getBoundingClientRect().height)}px`
      )
    set()
    const observer = new ResizeObserver(set)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  // „Zum Überblick“ erst, wenn der Überblick aus dem Bild ist.
  const [scrolledDown, setScrolledDown] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 900)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const sheetDone = day ? sheetProgress(day) : null
  const bakeDone = bakeShown?.status === 'ok' ? bakeProgress(bakeShown) : null
  const headerProgress =
    tab === 'zettel' && day && day.status === 'confirmed' && sheetDone
      ? { done: sheetDone.done, total: sheetDone.total, verb: 'erledigt' }
      : tab === 'backen' && bakeDone
      ? { done: bakeDone.done, total: bakeDone.total, verb: 'gebacken' }
      : null
  const headerLoadedAt =
    tab === 'zettel' ? loadedAt : tab === 'backen' ? bakeLoadedAt : null

  // Bäcker-Ansicht: Abschnitte des Reiters, welcher gerade gezeigt wird.
  const focusEntries: BackstubeTocEntry[] =
    tab === 'zettel' && day
      ? sheetDone?.entries ?? []
      : tab === 'backen' && bakeDone
      ? bakeDone.entries
      : []
  const focusIndex = (() => {
    if (!focusChoice || focusChoice.tab !== tab || focusEntries.length === 0) {
      return -1
    }
    const at = focusChoice.anchor
      ? focusEntries.findIndex((e) => e.anchor === focusChoice.anchor)
      : -1
    return at >= 0 ? at : focusStartIndex(focusEntries)
  })()
  const focusEntry = focusIndex >= 0 ? focusEntries[focusIndex] : null
  const focusAnchor = focusEntry?.anchor ?? null
  const closeFocus = (jump: string | null = null) => {
    pendingJump.current = jump
    setFocusChoice(null)
  }
  React.useEffect(() => {
    if (focusAnchor || !pendingJump.current) return
    const target = pendingJump.current
    pendingJump.current = null
    jumpTo(target)
  })
  const focusFrame = (verb: string, content: React.ReactNode) => (
    <BackstubeFocus
      entries={focusEntries}
      index={focusIndex}
      onIndex={(i) => setFocusChoice({ tab, anchor: focusEntries[i].anchor })}
      onClose={() => closeFocus(focusAnchor)}
      verb={verb}
    >
      {content}
    </BackstubeFocus>
  )
  const headerStale =
    (tab === 'zettel' && !!loadError) || (tab === 'backen' && !!bakeError)

  const zettel = (() => {
    if (!shown) {
      return (
        <BackstubeLayout narrow>
          {loadError ? (
            <BackstubeLoadFailed text={loadError.text} onRetry={refresh} />
          ) : (
            <BackstubeLoading label="Backzettel wird geladen" />
          )}
        </BackstubeLayout>
      )
    }
    const stale =
      loadError && shown ? (
        <BackstubeStaleNotice
          error={loadError}
          loadedAt={loadedAt ? timeOf(loadedAt) : null}
        />
      ) : null
    if (shown.status === 'ruhetag') {
      return (
        <BackstubeLayout narrow>
          {stale}
          <BackstubeClosedDay
            testId="bs-ruhetag"
            title={shown.closed ? 'Geschlossen' : 'Ruhetag'}
            text={
              shown.closed && shown.message
                ? shown.message
                : 'An diesem Tag wird nicht gebacken.'
            }
          />
        </BackstubeLayout>
      )
    }
    if (shown.status === 'no-config' || !day) {
      return (
        <BackstubeLayout narrow>
          {stale}
          <Alert
            severity="warning"
            data-testid="bs-no-config"
            sx={{ fontSize: '1.2rem' }}
          >
            Für diesen Tag gibt es keinen Backzettel: Die Stammdaten
            (backzettel.yaml) fehlen oder sind ungültig. Bitte im Büro Bescheid
            geben.
          </Alert>
        </BackstubeLayout>
      )
    }
    const sheet = (
      <BackstubeSheet
        day={day}
        config={config}
        canWork={canWork}
        pendingIds={pendingIds}
        onToggle={(line) => void toggleLine(line)}
        ackingKey={ackingKey}
        onAck={(group, key) => void ack(group, key)}
        deltasPending={deltasPending}
        notice={stale}
        only={focusAnchor ?? undefined}
      />
    )
    if (!focusAnchor) return sheet
    // Neue Nachträge verlangen ein „Gesehen“ - auch in der Bäcker-Ansicht
    // sichtbar, ein Tipp führt zur Liste mit ihnen.
    const unseen = day.status === 'confirmed' ? openDeltaCount(day.deltas) : 0
    return focusFrame(
      'erledigt',
      <Box sx={{ display: 'grid', gap: 2 }}>
        {unseen > 0 && (
          <BackstubeDeltaBanner
            count={unseen}
            testId="bs-focus-deltas"
            onOpen={() => closeFocus(DELTAS_ANCHOR)}
          />
        )}
        {sheet}
      </Box>
    )
  })()

  const backen = (() => {
    if (!bakeShown) {
      return (
        <BackstubeLayout narrow>
          {bakeError ? (
            <BackstubeLoadFailed text={bakeError.text} onRetry={refresh} />
          ) : (
            <BackstubeLoading label="Backliste wird geladen" />
          )}
        </BackstubeLayout>
      )
    }
    const stale = bakeError ? (
      <BackstubeStaleNotice
        error={bakeError}
        loadedAt={bakeLoadedAt ? timeOf(bakeLoadedAt) : null}
      />
    ) : null
    if (bakeShown.status === 'ruhetag' || bakeShown.status === 'geschlossen') {
      return (
        <BackstubeLayout narrow>
          {stale}
          <BackstubeClosedDay
            testId="bs-bake-ruhetag"
            title={
              bakeShown.status === 'geschlossen' ? 'Geschlossen' : 'Ruhetag'
            }
            text={
              bakeShown.status === 'geschlossen' && bakeShown.message
                ? bakeShown.message
                : 'An diesem Tag wird nicht gebacken.'
            }
          />
        </BackstubeLayout>
      )
    }
    if (bakeShown.status !== 'ok') {
      return (
        <BackstubeLayout narrow>
          {stale}
          <Alert
            severity="warning"
            data-testid="bs-bake-no-config"
            sx={{ fontSize: '1.2rem' }}
          >
            Keine Backliste: Die Stammdaten (backzettel.yaml) fehlen oder sind
            ungültig. Bitte im Büro Bescheid geben.
          </Alert>
        </BackstubeLayout>
      )
    }
    const main = (
      <BakeListMain
        list={bakeShown}
        config={config}
        canTick={canWork}
        pendingKeys={bakePending}
        onToggleLine={(line) => void toggleBakeLine(line)}
        onToggleDeltas={(group) => void toggleBakeDeltas(group)}
        canAck={canWork}
        ackingKey={ackingKey}
        onAck={(group, key) => void ackBake(group, key)}
        only={focusAnchor ?? undefined}
      />
    )
    if (focusAnchor) {
      return (
        <Box data-testid="bs-bake-list">
          {focusFrame(
            'gebacken',
            <Box sx={{ display: 'grid', gap: 2 }}>
              {stale}
              {main}
            </Box>
          )}
        </Box>
      )
    }
    return (
      <Box data-testid="bs-bake-list">
        <BackstubeLayout aside={<BakeListAside list={bakeShown} />}>
          {stale}
          {main}
        </BackstubeLayout>
      </Box>
    )
  })()

  const vorbereitung = (
    <BackstubeLayout narrow>
      {prepError && (
        <Alert severity="error" sx={{ fontSize: '1.15rem' }}>
          {prepError}
        </Alert>
      )}
      {!prepShown && !prepError && (
        <BackstubeLoading label="Vorbereitung wird geladen" />
      )}
      {prepShown?.status === 'ruhetag' && (
        <BackstubeClosedDay
          testId="bs-prep-ruhetag"
          title="Ruhetag"
          text={`${formatDateLong(
            prepShown.date
          )} ist Ruhetag – nichts vorzubereiten.`}
        />
      )}
      {prepShown?.status === 'no-config' && (
        <Alert severity="warning" sx={{ fontSize: '1.2rem' }}>
          Keine Vorbereitung: Die Stammdaten (backzettel.yaml) fehlen oder sind
          ungültig.
        </Alert>
      )}
      {prepShown &&
        (prepShown.status === 'draft' || prepShown.status === 'confirmed') && (
          <BackstubePrep prep={prepShown} today={dates.today} />
        )}
    </BackstubeLayout>
  )

  return (
    <BackstubeViewProvider
      startFocus={
        focusEntries.length > 0 && !focusAnchor
          ? () => setFocusChoice({ tab, anchor: null })
          : null
      }
    >
      <Box
        ref={rootRef}
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          pb: 8,
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
              backgroundImage: 'none !important',
              color: '#000 !important',
              boxShadow: 'none !important',
              opacity: '1 !important',
              // W4-verify r2: Rahmen in `text.primary`/`divider` sind im
              // dunklen Modus weiß - auf Papier fehlten die leeren Kästchen.
              borderColor: '#888 !important',
            },
            // global.css blendet `.MuiPaper-root` mit `transition:
            // background-color 0.3s !important` um. Beim Wechsel ins Druckbild
            // lief die Überblendung noch, und Hefeteig & Füllungen kam aus dem
            // Dunkelmodus fast schwarz aufs Papier. Zwei Klassen schlagen die
            // eine globale.
            '& .MuiPaper-root, & *': { transition: 'none !important' },
            '& [role="checkbox"]': { borderColor: '#000 !important' },
            // UI-Runde 1: Zeilen- und Füllungskarten nicht über zwei Seiten
            // zerschneiden.
            '& [data-testid^="bs-line-"], & [data-testid^="bs-filling-"], & [data-testid^="bs-weigh-"]':
              { breakInside: 'avoid' },
            // Zwei Spalten gibt es auf Papier nicht.
            '& [data-testid="bs-main"], & [data-testid="bs-aside"]': {
              gridColumn: '1 / -1',
            },
          },
        }}
      >
        <BackstubeHeader
          headerRef={headerRef}
          userName={session.user?.displayName ?? null}
          title={
            tab !== 'vorbereitung'
              ? formatDateLong(date)
              : `Heute, ${formatDateLong(dates.today)}`
          }
          tab={tab}
          onTab={(value) => {
            setTabChoice({ tab: value, date })
            showActionError(null)
          }}
          // Die Vorbereitung gilt immer dem nächsten Backtag - dort kein Umschalter.
          dayChoice={
            tab === 'vorbereitung'
              ? null
              : {
                  value: effective,
                  onChange: (value) => setChoice({ value, rule }),
                  today: {
                    label: 'Heute',
                    sub: dates.todayIsProductionDay
                      ? formatDateShort(dates.today)
                      : 'Ruhetag',
                  },
                  next: {
                    label: nextLabel(dates),
                    sub:
                      nextLabel(dates) === 'Morgen'
                        ? formatDateShort(dates.next)
                        : 'nächster Backtag',
                  },
                }
          }
          refreshing={refreshing}
          onRefresh={refresh}
          loadedAt={headerLoadedAt ? timeOf(headerLoadedAt) : null}
          stale={headerStale}
          progress={headerProgress}
          planHref={tab !== 'vorbereitung' && mayPlan ? planPath : null}
          adminHref={mayAdmin ? '/admin' : null}
          focus={
            focusEntries.length > 0
              ? {
                  active: !!focusAnchor,
                  onToggle: () =>
                    focusAnchor
                      ? closeFocus(focusAnchor)
                      : setFocusChoice({ tab, anchor: null }),
                }
              : null
          }
        />

        {tab === 'zettel' ? zettel : tab === 'backen' ? backen : vorbereitung}

        {/* Hochkant steht der Überblick über den Zeilen - weit unten führt
          ein Knopf zurück (quer bleibt er links stehen). */}
        {scrolledDown && tab !== 'vorbereitung' && !focusAnchor && (
          <Fab
            variant="extended"
            data-print="hide"
            aria-label="Zum Überblick"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{
              position: 'fixed',
              right: { xs: 16, sm: 24 },
              bottom: actionError ? { xs: 96, sm: 112 } : { xs: 16, sm: 24 },
              zIndex: 3,
              minHeight: 56,
              height: 56,
              px: 2.5,
              fontSize: '1.05rem',
              fontWeight: 800,
              textTransform: 'none',
              bgcolor: 'text.primary',
              color: 'background.paper',
              '&:hover': { bgcolor: 'text.secondary' },
              [BS_WIDE]: { display: 'none' },
            }}
          >
            <KeyboardArrowUpIcon sx={{ mr: 0.5, fontSize: 28 }} />
            Überblick
          </Fab>
        )}

        {/* Fehler eines Hakens unten fest im Bild - auch wenn die Zeile weit
          unten lag; bleibt stehen, bis sie geschlossen oder gelöst ist. */}
        {actionError && (
          <Box
            data-print="hide"
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              // Bäcker-Ansicht: über der Blätter-Leiste.
              bottom: focusAnchor ? { xs: 112, sm: 120 } : { xs: 12, sm: 24 },
              zIndex: 4,
              px: { xs: 1.5, sm: 3 },
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Alert
              severity="error"
              variant="filled"
              onClose={() => showActionError(null)}
              sx={{
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: 760,
                fontSize: '1.15rem',
                alignItems: 'center',
                boxShadow: 6,
                '& .MuiAlert-action': { pt: 0 },
                '& .MuiAlert-action .MuiIconButton-root': {
                  width: 48,
                  height: 48,
                },
              }}
            >
              {actionError}
            </Alert>
          </Box>
        )}
      </Box>
    </BackstubeViewProvider>
  )
}
