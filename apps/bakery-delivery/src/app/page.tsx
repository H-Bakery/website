'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  buildMultiStopNavigationUrl,
  calculateHaversineDistance,
  formatDuration,
  formatRouteDistance,
  hasCoordinates,
} from '@bakery/delivery/routing'
import {
  clearLocationWatch,
  getCurrentLocation,
  Location,
  watchLocation,
} from '@bakery/delivery/tracking'
import {
  ApiError,
  deliveryApi,
  describeError,
  flushQueue,
  pendingUpdates,
  queueStopUpdate,
  rememberDrivers,
  rememberedDrivers,
  rememberedTours,
  rememberTours,
  type Driver,
  type QueuedUpdate,
  type Stop,
  type Tour,
} from '../lib/delivery-api'
import {
  formatDate,
  formatTime,
  nextSaturdayIso,
  todayIso,
  TOUR_STATUS_LABEL,
} from '../lib/format'
import { AddStopForm, type NewStopInput } from '../components/AddStopForm'
import { StopCard } from '../components/StopCard'
import styles from './page.module.css'

const Map = dynamic(() => import('../components/Map').then((mod) => mod.Map), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Karte wird geladen …</div>,
})

const DRIVER_KEY = 'bakery-delivery-driver'
/** Position alle 30 s melden - haeufiger belastet nur den Akku. */
const POSITION_INTERVAL_MS = 30_000
/**
 * Warteschlange alle 30 s erneut versuchen, solange etwas wartet. Der Browser
 * meldet `online`, sobald Funk da ist - ob der Server antwortet, weiss er
 * nicht. Ohne diesen Takt bliebe ein Abhaken bis zum Neuladen liegen.
 */
const RETRY_INTERVAL_MS = 30_000

export default function DeliveryDashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driverId, setDriverId] = useState<number | null>(null)
  const [date, setDate] = useState(() => nextSaturdayIso())
  const [tours, setTours] = useState<Tour[]>([])
  const [tourId, setTourId] = useState<number | null>(null)

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [pending, setPending] = useState<QueuedUpdate[]>([])
  const [isOnline, setIsOnline] = useState(true)
  /** Wann die angezeigte Tourliste vom Server kam - gesetzt, solange sie nur die Offline-Kopie ist. */
  const [copiedAt, setCopiedAt] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Eigenes Flag statt `error`: das teilen sich auch Anlegen, Abhaken und
  // Routing. Nur ein gescheitertes *Laden* darf "nichts geplant" ersetzen -
  // sonst nähme ein abgelehntes "Tour anlegen" den Knopf gleich mit.
  const [loadFailed, setLoadFailed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const lastReportRef = useRef(0)
  // Die Standort-Verfolgung haelt ihren Callback lange fest; ueber die Ref
  // meldet sie an die Tour, die *jetzt* gewaehlt ist, nicht an die von damals.
  const tourIdRef = useRef<number | null>(null)
  tourIdRef.current = tourId
  // Beim Start laufen zwei Ladevorgaenge kurz hintereinander (erst ohne, dann
  // mit gemerktem Fahrer). Nur der juengste darf den Bildschirm setzen.
  const loadSeqRef = useRef(0)

  const tour = useMemo(
    () => tours.find((t) => t.id === tourId) ?? null,
    [tours, tourId]
  )

  // --- Laden ---

  const loadTours = useCallback(
    async (targetDate: string, targetDriver: number | null) => {
      const seq = ++loadSeqRef.current
      setError(null)

      const show = (list: Tour[]) => {
        setTours(list)
        setTourId((current) =>
          list.some((t) => t.id === current) ? current : list[0]?.id ?? null
        )
      }

      // Die Offline-Kopie sofort zeigen, statt im Funkloch 15 s auf den
      // Timeout zu warten. Antwortet der Server, ersetzt er sie gleich.
      // Eine *leere* Kopie zaehlt nicht: sie hilft dem Fahrer nicht weiter,
      // und "zuletzt war nichts geplant" ist ohne Server genauso wenig
      // pruefbar wie "keine Antwort" - da darf kein "Tour anlegen" stehen.
      const remembered = rememberedTours(targetDate, targetDriver)
      const copy = remembered && remembered.tours.length > 0 ? remembered : null
      if (copy) show(withPendingUpdates(copy.tours, pendingUpdates()))

      try {
        const list = await deliveryApi.tours({
          date: targetDate,
          driverId: targetDriver ?? undefined,
        })
        if (seq !== loadSeqRef.current) return
        show(list)
        rememberTours(targetDate, targetDriver, list)
        setCopiedAt(null)
        setLoadFailed(false)
        setIsOnline(true)
      } catch (err) {
        if (seq !== loadSeqRef.current) return
        if (copy) {
          // Kein Netz, aber die Liste von vorhin: damit faehrt der Fahrer
          // weiter, das Abhaken landet in der Warteschlange.
          setCopiedAt(copy.at)
          setLoadFailed(false)
          setIsOnline(false)
        } else {
          // Keine Antwort heisst nicht "keine Tour": die Liste bleibt leer,
          // aber die Oberflaeche darf daraus kein "nichts geplant" machen.
          setTours([])
          setLoadFailed(true)
          setError(describeError(err, 'Touren konnten nicht geladen werden.'))
        }
      } finally {
        if (seq === loadSeqRef.current) setLoading(false)
      }
    },
    []
  )

  /**
   * Holt die Fahrerliste und waehlt den gemerkten, sonst den ersten Fahrer.
   * Liefert die gewaehlte id - oder `undefined`, wenn die API nicht antwortet
   * und auch keine gemerkte Fahrerliste da ist.
   */
  const loadDrivers = useCallback(async (): Promise<
    number | null | undefined
  > => {
    const apply = (list: Driver[]) => {
      setDrivers(list)
      const stored = readStoredDriver()
      const known = list.find((d) => d.id === stored)
      const chosen = known ? known.id : list[0]?.id ?? null
      setDriverId(chosen)
      return chosen
    }
    // Die gemerkte Fahrerliste zuerst: sie waehlt den Fahrer sofort, und damit
    // findet `loadTours` die Offline-Kopie, statt im Funkloch erst 15 s auf
    // den Timeout von GET /drivers zu warten. Sonst bliebe die Auswahl bis
    // dahin auf „Alle" stehen, und die Kopie passte nicht dazu.
    const remembered = rememberedDrivers()
    const fallback = remembered ? apply(remembered) : undefined
    try {
      const list = await deliveryApi.drivers()
      rememberDrivers(list)
      return apply(list)
    } catch (err) {
      if (remembered) return fallback
      setError(describeError(err, 'Fahrer konnten nicht geladen werden.'))
      return undefined
    }
  }, [])

  useEffect(() => {
    loadDrivers()
  }, [loadDrivers])

  useEffect(() => {
    setLoading(true)
    loadTours(date, driverId)
  }, [date, driverId, loadTours])

  // Die Offline-Kopie wird ersetzt, sobald der Server wieder antwortet - beim
  // `online`-Event und sonst alle 30 s. Solange etwas in der Warteschlange
  // liegt, hat deren Nachsenden Vorrang; die Antwort darauf ist ohnehin die
  // aktuelle Tour.
  useEffect(() => {
    if (copiedAt === null) return
    const reload = () => {
      if (navigator.onLine && pendingUpdates().length === 0) {
        loadTours(date, driverId)
      }
    }
    window.addEventListener('online', reload)
    const retry = window.setInterval(reload, RETRY_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', reload)
      window.clearInterval(retry)
    }
  }, [copiedAt, date, driverId, loadTours])

  // Ist die Warteschlange gerade durchgegangen, hat der Server geantwortet:
  // dann die Kopie sofort ersetzen, statt bis zum naechsten 30-s-Takt den
  // Balken „wird aktualisiert, sobald der Server antwortet" stehen zu lassen.
  // Ueber die Ref, weil der Funkloch-Effekt unten nur einmal haengt.
  const afterFlushRef = useRef<() => void>(() => undefined)
  afterFlushRef.current = () => {
    if (copiedAt !== null) loadTours(date, driverId)
  }

  // --- Standort ---

  useEffect(() => {
    getCurrentLocation()
      .then(setCurrentLocation)
      .catch(() =>
        setHint(
          'Standort nicht verfügbar. Die Tour funktioniert trotzdem, nur ohne Entfernungen.'
        )
      )

    return () => {
      if (watchIdRef.current !== null) {
        clearLocationWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  const startTracking = () => {
    setHint(null)
    try {
      watchIdRef.current = watchLocation(
        (location) => {
          setCurrentLocation(location)
          reportPosition(location)
        },
        (err) => {
          setHint(`Standort-Verfolgung gestoppt: ${err.message}`)
          setIsTracking(false)
        }
      )
      setIsTracking(true)
    } catch {
      setHint('Dieses Gerät liefert keinen Standort.')
    }
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      clearLocationWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
  }

  /** Meldet die Position an die Backstube - gedrosselt und ohne Fehleranzeige. */
  const reportPosition = (location: Location) => {
    const targetTour = tourIdRef.current
    if (!targetTour) return
    const now = Date.now()
    if (now - lastReportRef.current < POSITION_INTERVAL_MS) return
    lastReportRef.current = now

    deliveryApi
      .reportPosition(targetTour, {
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
      })
      .catch(() => undefined)
  }

  // --- Funkloecher ---

  useEffect(() => {
    setPending(pendingUpdates())
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)

    const flush = async () => {
      if (pendingUpdates().length === 0) {
        setIsOnline(true)
        return
      }
      const { tour: updated, remaining, rejected, offline } = await flushQueue()
      setPending(remaining)
      // Erst wenn der Server wirklich geantwortet hat, ist "online" wahr -
      // sonst verschwand der Hinweis, waehrend die Aenderungen noch lagen.
      setIsOnline(!offline)
      if (updated) {
        setTours((list) => list.map((t) => (t.id === updated.id ? updated : t)))
      }
      if (!offline && remaining.length === 0) afterFlushRef.current()
      if (rejected.length > 0) {
        setHint(
          `${rejected.length} Änderung(en) hat der Server abgelehnt und wurden verworfen.`
        )
      }
    }

    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', flush)
    window.addEventListener('offline', goOffline)
    if (navigator.onLine) flush()
    const retry = window.setInterval(() => {
      if (navigator.onLine && pendingUpdates().length > 0) flush()
    }, RETRY_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', flush)
      window.removeEventListener('offline', goOffline)
      window.clearInterval(retry)
    }
  }, [])

  // --- Aktionen ---

  const changeStopStatus = async (stopId: number, status: Stop['status']) => {
    if (!tour) return
    setBusy(true)
    setError(null)

    // Erst lokal umschalten: der Fahrer soll nicht auf das Netz warten.
    const optimistic = applyStopStatus(tour, stopId, status)
    setTours((list) => list.map((t) => (t.id === tour.id ? optimistic : t)))

    try {
      const updated = await deliveryApi.updateStop(tour.id, stopId, { status })
      setTours((list) => list.map((t) => (t.id === updated.id ? updated : t)))
      setPending(pendingUpdates())
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        setError(err.message)
        await loadTours(date, driverId)
      } else {
        // Kein Netz: gemerkt, geht spaeter automatisch raus.
        setPending(queueStopUpdate(tour.id, stopId, { status }))
        setIsOnline(false)
      }
    } finally {
      setBusy(false)
    }
  }

  const runOptimize = async () => {
    if (!tour) return
    setBusy(true)
    setError(null)
    try {
      const updated = await deliveryApi.optimize(tour.id)
      setTours((list) => list.map((t) => (t.id === updated.id ? updated : t)))
      setHint(
        updated.isEstimate
          ? 'Reihenfolge sortiert. Kilometer sind geschätzt – der Routendienst war nicht erreichbar.'
          : null
      )
    } catch (err) {
      setError(describeError(err, 'Route konnte nicht berechnet werden.'))
    } finally {
      setBusy(false)
    }
  }

  const addStop = async (input: NewStopInput) => {
    if (!tour) return
    setBusy(true)
    try {
      const updated = await deliveryApi.addStop(tour.id, input)
      setTours((list) => list.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      // Das Formular zeigt die Meldung an - aber auf Deutsch, nicht als
      // rohes "Failed to fetch" des Browsers.
      throw new Error(describeError(err, 'Stopp konnte nicht angelegt werden.'))
    } finally {
      setBusy(false)
    }
  }

  const removeStop = async (stopId: number) => {
    if (!tour) return
    setBusy(true)
    setError(null)
    try {
      const updated = await deliveryApi.removeStop(tour.id, stopId)
      setTours((list) => list.map((t) => (t.id === updated.id ? updated : t)))
    } catch (err) {
      setError(describeError(err, 'Stopp konnte nicht entfernt werden.'))
    } finally {
      setBusy(false)
    }
  }

  const reloadTours = async () => {
    setLoading(true)
    if (drivers.length === 0) {
      // Ohne API fehlten beim ersten Versuch meist auch die Fahrer - die
      // Auswahl kommt mit demselben Knopf zurueck. Wechselt dadurch der
      // Fahrer, laedt der Effekt oben die Touren bereits selbst.
      const chosen = await loadDrivers()
      if (chosen !== undefined && chosen !== driverId) return
    }
    loadTours(date, driverId)
  }

  const createTour = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await deliveryApi.createTour({
        date,
        driverId,
        name: 'Samstagstour',
      })
      setTours((list) => [...list, created])
      setTourId(created.id)
      setPlanning(true)
    } catch (err) {
      setError(describeError(err, 'Tour konnte nicht angelegt werden.'))
    } finally {
      setBusy(false)
    }
  }

  const chooseDriver = (value: number | null) => {
    setDriverId(value)
    try {
      if (value === null) window.localStorage.removeItem(DRIVER_KEY)
      else window.localStorage.setItem(DRIVER_KEY, String(value))
    } catch {
      // Privater Modus - dann eben ohne Merken.
    }
  }

  // --- Abgeleitetes ---

  const nextStop =
    tour?.stops.find((stop) => stop.id === tour.nextStopId) ?? null

  const distanceTo = (stop: Stop): number | null => {
    if (!currentLocation || !hasCoordinates(stop)) return null
    return calculateHaversineDistance(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      },
      { latitude: stop.lat, longitude: stop.lon }
    )
  }

  const navigateAllUrl = useMemo(() => {
    const open = (tour?.stops ?? []).filter(
      (stop) => stop.status === 'open' && hasCoordinates(stop)
    )
    if (open.length === 0) return null
    return buildMultiStopNavigationUrl(
      open.map((stop) => ({
        latitude: stop.lat as number,
        longitude: stop.lon as number,
        address: stop.address,
      })),
      currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }
        : undefined
    )
  }, [tour, currentLocation])

  const offlineNotice = [
    !isOnline
      ? `Kein Netz. Änderungen werden gespeichert und automatisch nachgesendet${
          pending.length > 0 ? ` (${pending.length} offen)` : ''
        }.`
      : pending.length > 0
      ? `${pending.length} Änderung(en) warten noch auf den Server und werden automatisch nachgesendet.`
      : null,
    copiedAt
      ? `Gespeicherter Stand von ${formatTime(
          copiedAt
        )} Uhr – wird aktualisiert, sobald der Server antwortet.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Liefertour</h1>
        <p className={styles.subtitle}>Bäckerei Heusser – Fahrer-App</p>
      </header>

      {offlineNotice && (
        <div className={styles.offline} role="status">
          {offlineNotice}
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.selectRow}>
          <div className={styles.field}>
            <label htmlFor="driver-select">Fahrer</label>
            <select
              id="driver-select"
              value={driverId ?? ''}
              onChange={(event) =>
                chooseDriver(
                  event.target.value ? Number(event.target.value) : null
                )
              }
            >
              <option value="">Alle</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="tour-date">Tag</label>
            <input
              id="tour-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={styles.buttonGhost}
            onClick={() => setDate(todayIso())}
          >
            Heute
          </button>
          <button
            type="button"
            className={styles.buttonGhost}
            onClick={() => setDate(nextSaturdayIso())}
          >
            Nächster Samstag
          </button>
        </div>

        {tours.length > 1 && (
          <div className={styles.field}>
            <label htmlFor="tour-select">Tour</label>
            <select
              id="tour-select"
              value={tourId ?? ''}
              onChange={(event) => setTourId(Number(event.target.value))}
            >
              {tours.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} – {entry.driver?.name ?? 'ohne Fahrer'}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {loading && <p className={styles.placeholder}>Tour wird geladen …</p>}

      {!loading && !tour && loadFailed && (
        <section className={styles.card}>
          <h2>Tour konnte nicht geladen werden</h2>
          <p className={styles.placeholder}>
            Ob für {formatDate(date)} eine Tour geplant ist, lässt sich gerade
            nicht prüfen.
          </p>
          <button type="button" className={styles.button} onClick={reloadTours}>
            Erneut laden
          </button>
        </section>
      )}

      {!loading && !tour && !loadFailed && (
        <section className={styles.card}>
          <h2>Keine Tour für {formatDate(date)}</h2>
          <p className={styles.placeholder}>
            Für diesen Tag ist noch nichts geplant.
          </p>
          <button
            type="button"
            className={styles.button}
            onClick={createTour}
            disabled={busy}
          >
            Tour anlegen
          </button>
        </section>
      )}

      {tour && (
        <>
          <section className={styles.card}>
            <div className={styles.tourHead}>
              <div>
                <h2>{tour.name}</h2>
                <p className={styles.subtitle}>
                  {formatDate(tour.date)} · {tour.driver?.name ?? 'ohne Fahrer'}
                </p>
              </div>
              <span
                className={`${styles.badge} ${styles[`badge_${tour.status}`]}`}
              >
                {TOUR_STATUS_LABEL[tour.status]}
              </span>
            </div>

            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={tour.progress.total}
              aria-valuenow={tour.progress.done + tour.progress.failed}
            >
              <span
                className={styles.progressFill}
                style={{
                  width: `${
                    tour.progress.total === 0
                      ? 0
                      : ((tour.progress.done + tour.progress.failed) /
                          tour.progress.total) *
                        100
                  }%`,
                }}
              />
            </div>
            <p className={styles.progressLabel}>
              {tour.progress.done} von {tour.progress.total} geliefert
              {tour.progress.failed > 0 &&
                `, ${tour.progress.failed} nicht angetroffen`}
            </p>

            <dl className={styles.stopFacts}>
              <div>
                <dt>Strecke</dt>
                <dd>
                  {tour.distance === null
                    ? '–'
                    : formatRouteDistance(tour.distance)}
                  {tour.isEstimate && tour.distance !== null && ' (geschätzt)'}
                </dd>
              </div>
              <div>
                <dt>Dauer</dt>
                <dd>
                  {tour.duration === null ? '–' : formatDuration(tour.duration)}
                </dd>
              </div>
              <div>
                <dt>{tour.startedAt ? 'Start' : 'Abfahrt geplant'}</dt>
                <dd>
                  {tour.startedAt
                    ? formatTime(tour.startedAt)
                    : tour.plannedStart}
                </dd>
              </div>
            </dl>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.button}
                onClick={runOptimize}
                disabled={busy || tour.stops.length === 0}
              >
                Route berechnen
              </button>
              {navigateAllUrl && (
                <a
                  className={styles.buttonLink}
                  href={navigateAllUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ganze Tour navigieren
                </a>
              )}
              <button
                type="button"
                className={styles.buttonGhost}
                onClick={() => setPlanning((value) => !value)}
              >
                {planning ? 'Planung schließen' : 'Tour planen'}
              </button>
            </div>
          </section>

          {nextStop && (
            <section className={`${styles.card} ${styles.nextCard}`}>
              <h2>Nächster Stopp</h2>
              <ul className={styles.stopList}>
                <StopCard
                  stop={nextStop}
                  position={tour.stops.indexOf(nextStop) + 1}
                  isNext
                  distance={distanceTo(nextStop)}
                  busy={busy}
                  onStatusChange={changeStopStatus}
                />
              </ul>
            </section>
          )}

          <section className={styles.card}>
            <h2>Karte</h2>
            <div className={styles.mapContainer}>
              <Map
                currentLocation={currentLocation ?? undefined}
                depot={tour.depot}
                stops={tour.stops}
                geometry={tour.geometry}
                activeStopId={tour.nextStopId}
              />
            </div>

            <div className={styles.buttonGroup}>
              {!isTracking ? (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  onClick={startTracking}
                >
                  Standort verfolgen
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.buttonGhost}
                  onClick={stopTracking}
                >
                  Verfolgung stoppen
                </button>
              )}
            </div>

            {currentLocation && (
              <p className={styles.coords}>
                {currentLocation.latitude.toFixed(5)},{' '}
                {currentLocation.longitude.toFixed(5)}
                {/* `!= null`, nicht Truthiness: sonst rendert React bei 0 eine nackte 0. */}
                {currentLocation.accuracy != null &&
                  ` · ±${Math.round(currentLocation.accuracy)} m`}
                {currentLocation.speed != null &&
                  ` · ${Math.round(currentLocation.speed * 3.6)} km/h`}
              </p>
            )}
          </section>

          <section className={styles.card}>
            <h2>Alle Stopps ({tour.stops.length})</h2>
            {tour.stops.length === 0 ? (
              <p className={styles.placeholder}>
                Noch keine Stopps. Über „Tour planen“ hinzufügen.
              </p>
            ) : (
              <ul className={styles.stopList}>
                {tour.stops.map((stop, index) => (
                  <StopCard
                    key={stop.id}
                    stop={stop}
                    position={index + 1}
                    isNext={stop.id === tour.nextStopId}
                    distance={distanceTo(stop)}
                    busy={busy}
                    onStatusChange={changeStopStatus}
                    onRemove={planning ? removeStop : undefined}
                  />
                ))}
              </ul>
            )}
          </section>

          {planning && (
            <section className={styles.card}>
              <h2>Stopp hinzufügen</h2>
              <p className={styles.placeholder}>
                Die Adresse wird gesucht und gespeichert, sobald der Stopp
                angelegt ist.
              </p>
              <AddStopForm busy={busy} onSubmit={addStop} />
            </section>
          )}
        </>
      )}

      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}
      {hint && !error && (
        <div className={styles.hint} role="status">
          <p>{hint}</p>
        </div>
      )}
    </main>
  )
}

/** Lokale Vorschau eines Statuswechsels, damit die Liste sofort reagiert. */
function applyStopStatus(
  tour: Tour,
  stopId: number,
  status: Stop['status']
): Tour {
  const stops = tour.stops.map((stop) =>
    stop.id === stopId
      ? {
          ...stop,
          status,
          completedAt: status === 'open' ? null : new Date().toISOString(),
        }
      : stop
  )
  const done = stops.filter((s) => s.status === 'done').length
  const failed = stops.filter((s) => s.status === 'failed').length

  return {
    ...tour,
    stops,
    progress: {
      total: stops.length,
      done,
      failed,
      open: stops.length - done - failed,
      isComplete: stops.length > 0 && done + failed === stops.length,
    },
    nextStopId: stops.find((s) => s.status === 'open')?.id ?? null,
  }
}

/**
 * Spielt die Warteschlange auf die Offline-Kopie: ein Abhaken kurz vor dem
 * Neuladen soll nicht wieder als „Offen" dastehen.
 */
function withPendingUpdates(tours: Tour[], queue: QueuedUpdate[]): Tour[] {
  return queue.reduce((list, entry) => {
    const status = entry.body.status
    if (!status) return list
    return list.map((t) =>
      t.id === entry.tourId ? applyStopStatus(t, entry.stopId, status) : t
    )
  }, tours)
}

function readStoredDriver(): number | null {
  try {
    const raw = window.localStorage.getItem(DRIVER_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}
