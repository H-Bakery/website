/**
 * Liefertouren auf der echten API (B8): Depot, Fahrer, Touren, Stopps.
 *
 * Gerechnet wird ausschließlich in `delivery-tours.core.js` (Reihenfolge,
 * Schätzformeln, Ankunftszeiten, Statusfolge, Eingabeprüfung). Adresssuche und Straßenrouting kommen aus
 * `delivery-geo.core.js` (Nominatim, OSRM), beide **optional**: fällt ein
 * Dienst aus, bleibt die Tour bei den Schätzwerten (`isEstimate: true`).
 * Die Sammelstelle (`pickupPointId`) holt ihre Übergabeliste aus den
 * Vorbestellungen (B7, `PreordersService.legacyList`) - in der Mock-Form,
 * damit die Fahrer-App unverändert bleibt (D3).
 *
 * Nebenläufigkeit: jeder Schreibzugriff läuft in **einer** serialisierten
 * Transaktion (`getSequelize().transaction`, BEGIN IMMEDIATE, FIFO), die die
 * Tour erst *in* der Transaktion liest. Netzaufrufe (Nominatim bis 8 s, OSRM)
 * laufen nie in einer Transaktion - sonst stünde jeder andere Schreibzugriff
 * der API so lange. Gefundene Koordinaten schreibt eine eigene kleine
 * Transaktion, und nur, wenn die Adresse des Stopps noch dieselbe ist;
 * "Route berechnen" rechnet außerhalb und übernimmt das Ergebnis nur, wenn
 * sich die Tour derweil nicht geändert hat (sonst neu, zuletzt ohne Netz).
 * So überschreibt kein Handler, der auf einen fremden Server wartet, ein
 * Abhaken von eben - die Falle, in die der Mock früher gelaufen ist.
 */
import type { Request } from 'express'
import { Op, Transaction, WhereOptions } from 'sequelize'

import { audit } from '../auth/audit'
import {
  DeliveryDepot,
  DeliveryDriver,
  DeliveryGeocache,
  DeliveryStop,
  DeliveryTour,
  PickupPoint,
  User,
  getSequelize,
} from '../models'
import { DEPOT_ID } from '../models/DeliveryDepot'
import type { LastPosition } from '../models/DeliveryTour'
import type { StopItem } from '../models/DeliveryStop'
import {
  Failure,
  PickupPointDto,
  PreordersService,
  Result,
  isFailure,
} from './preorders.service'

/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('./delivery-tours.core')
const geoCore = require('./delivery-geo.core')
const preordersCore = require('./delivery-preorders.core')
const controlChars = require('./control-chars.core')
/* eslint-enable @typescript-eslint/no-var-requires */

// ---------------------------------------------------------------- types

export interface GeoHit {
  lat: number
  lon: number
  displayName?: string | null
  precision?: string | null
  at?: string
}

export interface RoutedTour {
  order: number[]
  distance: number
  duration: number
  geometry: Array<[number, number]> | null
}

/** Nominatim + OSRM; tests pass an offline stub. */
export interface GeoServices {
  geocodeAddress(address: string): Promise<GeoHit | null>
  routeTour(
    depot: PlainDepot,
    stops: PlainStop[],
    options: { optimize: boolean; vehicleType: string }
  ): Promise<RoutedTour | null>
}

export interface DeliveryToursOptions {
  preorders: PreordersService
  geo?: GeoServices
  /** How long a read waits for the address search (default 2.5 s). */
  hydrateBudgetMs?: number
  /** How long a failed address search is not repeated (default 5 min). */
  geocodeRetryMs?: number
  log?: { warn: (...args: unknown[]) => void }
  /**
   * The clock for ETAs, time windows, the default tour date and the
   * `startedAt`/`finishedAt`/`completedAt`/`routedAt`/position stamps
   * (default: wall clock). Tests pin it to a fixed moment (B12: the contract
   * suite replays answers recorded on one day).
   */
  now?: () => Date
}

export interface PlainDepot {
  name: string
  street: string
  zip: string
  city: string
  phone: string | null
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  geocodePrecision: string | null
}

export interface PlainDriver {
  id: number
  name: string
  phone: string | null
  vehicle: string
  active: boolean
  /** B8: login of the `fahrer` this driver is (not in the mock). */
  userId: number | null
}

export interface PlainStop {
  id: number
  customer: string
  street: string
  zip: string
  city: string
  phone: string | null
  timeWindow: string | null
  notes: string | null
  items: StopItem[]
  status: string
  completedAt: string | null
  failureReason: string | null
  goodsDisposition: string | null
  lat: number | null
  lon: number | null
  geocodeSource: string | null
  geocodePrecision: string | null
  /** Only on Sammelstellen-Stopps (mock: the key is absent otherwise). */
  pickupPointId?: string
}

export interface PlainTour {
  id: number
  date: string
  driverId: number | null
  name: string
  status: string
  vehicleType: string
  plannedStart: string
  startedAt: string | null
  finishedAt: string | null
  distance: number | null
  duration: number | null
  isEstimate: boolean
  geometry: Array<[number, number]> | null
  routedAt: string | null
  lastPosition: LastPosition | null
  stops: PlainStop[]
}

export type DecoratedTour = Record<string, unknown>

/**
 * Nur Touren dieser Fahrer (ein `fahrer` = seine eigenen). `null` /
 * fehlend = alle Touren (inhaber). Geprüft wird **in** der Transaktion.
 */
export interface TourAccess {
  driverIds: number[] | null
}

// ------------------------------------------------------------ constants

export const HYDRATE_BUDGET_MS = 2500
export const GEOCODE_RETRY_MS = 5 * 60 * 1000
const VEHICLES = ['bike', 'car', 'van']
const PLANNED_START_MESSAGE =
  'Die geplante Abfahrt muss eine Uhrzeit im Format HH:MM sein (00:00 bis 23:59).'

/**
 * Grenzen der Freitextfelder (der Mock hat keine; wie bei Partnern und
 * Vorbestellungen, W4). Zeichen, nach dem Trimmen.
 */
export const DELIVERY_LIMITS = {
  customer: 200,
  street: 200,
  zip: 16,
  city: 120,
  timeWindow: 64,
  notes: 2000,
  items: 100,
  itemName: 200,
  itemUnit: 32,
  itemQty: 10000,
  driverName: 120,
  tourName: 120,
  depotName: 120,
  /** Nach `normalizePhone` (nur Ziffern und `+`); Spalte `STRING(40)`. */
  phone: 40,
}

/**
 * Telefonnummer von Stopp, Fahrer oder Depot: `normalizePhone` des Cores,
 * dann höchstens `DELIVERY_LIMITS.phone` Zeichen (sonst 400 `Text too long`).
 */
export function checkPhone(
  value: unknown
): { phone: string | null } | { error: string; message: string } {
  const phone = core.normalizePhone(value) as string | null
  if (phone && phone.length > DELIVERY_LIMITS.phone) {
    return tooLong('Die Telefonnummer', DELIVERY_LIMITS.phone)
  }
  return { phone }
}

/** Name einer Tour: Länge und Steuerzeichen wie bei Stopps und Fahrern. */
function checkTourName(
  name: string
): { error: string; message: string } | null {
  if (name.length > DELIVERY_LIMITS.tourName) {
    return tooLong('Der Name der Tour', DELIVERY_LIMITS.tourName)
  }
  if (controlChars.hasNameControlChars(name)) {
    return {
      error: 'Invalid text',
      message: 'Der Name der Tour enthält unzulässige Steuerzeichen.',
    }
  }
  return null
}

/** Felder, die ein Fahrer an einem Stopp setzen darf: abhaken. */
export const FAHRER_STOP_FIELDS = [
  'status',
  'failureReason',
  'goodsDisposition',
  'completedAt',
]

// --------------------------------------------------------------- helpers

function fail<T>(
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
): Result<T> {
  return { ok: false, status, error, message, extra }
}

function ok<T>(data: T, status = 200): Result<T> {
  return { ok: true, status, data }
}

/** Expected abort inside a transaction: rolls back, answered with its code. */
export class DeliveryRouteError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
  toResult<T>(): Result<T> {
    return fail(this.status, this.code, this.message)
  }
}

function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * `driverId` aus dem Body: leer/`null`/`0` = ohne Fahrer, sonst eine positive
 * ganze Zahl (auch als Text `"7"`). `"1abc"` war vorher still „ohne Fahrer“.
 */
function parseDriverId(value: unknown): { id: number | null } | null {
  if (value === undefined || value === null || value === '' || value === 0) {
    return { id: null }
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? { id: value } : null
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const id = Number(value.trim())
    if (id === 0) return { id: null }
    return Number.isSafeInteger(id) ? { id } : null
  }
  return null
}

const INVALID_DRIVER_MESSAGE =
  'Der Fahrer muss als Nummer angegeben werden (oder leer für „ohne Fahrer“).'

/** Frühester Tourtag; spätestens ein Jahr voraus (`TOUR_DAYS_AHEAD`). */
const TOUR_DATE_MIN = '2020-01-01'
const TOUR_DAYS_AHEAD = 366

/**
 * Ein ausdrücklicher `completedAt` (Fahrer-App: Zeitpunkt des Antippens, auch
 * aus der Offline-Warteschlange, die erst Tage später nachsenden kann) muss
 * zum Tourtag passen: vom Vortag bis zwei Tage danach (Zeitzonen-Spielraum
 * eingerechnet). Vorher ging jedes Datum (9999-12-31, 1970-01-01) durch.
 */
const COMPLETED_AT_DAYS_BEFORE = 1
const COMPLETED_AT_DAYS_AFTER = 3

/** `:id` / `:stopId` - positive whole numbers, else not found. */
export function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

export function toPlainDepot(row: DeliveryDepot): PlainDepot {
  return {
    name: row.name,
    street: row.street,
    zip: row.zip ?? '',
    city: row.city,
    phone: row.phone ?? null,
    lat: num(row.lat),
    lon: num(row.lon),
    geocodeSource: row.geocodeSource ?? null,
    geocodePrecision: row.geocodePrecision ?? null,
  }
}

export function toPlainDriver(row: DeliveryDriver): PlainDriver {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    vehicle: row.vehicle,
    active: !!row.active,
    userId: row.userId ?? null,
  }
}

export function toPlainStop(row: DeliveryStop): PlainStop {
  const stop: PlainStop = {
    id: row.id,
    customer: row.customer,
    street: row.street ?? '',
    zip: row.zip ?? '',
    city: row.city ?? '',
    phone: row.phone ?? null,
    timeWindow: row.timeWindow ?? null,
    notes: row.notes ?? null,
    items: Array.isArray(row.items) ? row.items : [],
    status: row.status,
    completedAt: iso(row.completedAt),
    failureReason: row.failureReason ?? null,
    goodsDisposition: row.goodsDisposition ?? null,
    lat: num(row.lat),
    lon: num(row.lon),
    geocodeSource: row.geocodeSource ?? null,
    geocodePrecision: row.geocodePrecision ?? null,
  }
  if (row.pickupPointId) stop.pickupPointId = row.pickupPointId
  return stop
}

export function toPlainTour(
  row: DeliveryTour,
  stops: DeliveryStop[]
): PlainTour {
  return {
    id: row.id,
    date: row.date,
    driverId: row.driverId ?? null,
    name: row.name,
    status: row.status,
    vehicleType: row.vehicleType,
    plannedStart: row.plannedStart,
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    distance: num(row.distance),
    duration: num(row.duration),
    isEstimate: !!row.isEstimate,
    geometry: row.geometry ?? null,
    routedAt: iso(row.routedAt),
    lastPosition: row.lastPosition ?? null,
    stops: [...stops]
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map(toPlainStop),
  }
}

function stopColumns(stop: PlainStop) {
  return {
    customer: stop.customer,
    street: stop.street ?? '',
    zip: stop.zip ?? '',
    city: stop.city ?? '',
    phone: stop.phone ?? null,
    timeWindow: stop.timeWindow ?? null,
    notes: stop.notes ?? null,
    items: Array.isArray(stop.items) ? stop.items : [],
    pickupPointId: stop.pickupPointId ?? null,
    status: stop.status,
    completedAt: toDate(stop.completedAt),
    failureReason: stop.failureReason ?? null,
    goodsDisposition: stop.goodsDisposition ?? null,
    lat: stop.lat ?? null,
    lon: stop.lon ?? null,
    geocodeSource: stop.geocodeSource ?? null,
    geocodePrecision: stop.geocodePrecision ?? null,
  }
}

function tourColumns(tour: PlainTour) {
  return {
    date: tour.date,
    driverId: tour.driverId ?? null,
    name: tour.name,
    status: tour.status,
    vehicleType: tour.vehicleType,
    plannedStart: tour.plannedStart,
    startedAt: toDate(tour.startedAt),
    finishedAt: toDate(tour.finishedAt),
    distance: tour.distance ?? null,
    duration: tour.duration ?? null,
    isEstimate: !!tour.isEstimate,
    geometry: tour.geometry ?? null,
    routedAt: toDate(tour.routedAt),
    lastPosition: tour.lastPosition ?? null,
  }
}

/** Order, status and coordinates of every stop - what a route depends on. */
function routeFingerprint(tour: PlainTour): string {
  return JSON.stringify(tour.stops.map((s) => [s.id, s.status, s.lat, s.lon]))
}

function tooLong(
  label: string,
  max: number
): { error: string; message: string } {
  return {
    error: 'Text too long',
    message: `${label} darf höchstens ${max} Zeichen lang sein.`,
  }
}

/**
 * Längen und Steuerzeichen eines (vom Core normalisierten) Stopps. Der Mock
 * prüft beides nicht - bewusste Abweichung, wie bei Partnern (W4).
 */
export function checkStopText(
  stop: PlainStop
): { error: string; message: string } | null {
  const L = DELIVERY_LIMITS
  const lines: Array<[string, string, number]> = [
    ['Der Name', stop.customer, L.customer],
    ['Die Straße', stop.street, L.street],
    ['Die Postleitzahl', stop.zip, L.zip],
    ['Der Ort', stop.city, L.city],
    ['Das Zeitfenster', stop.timeWindow ?? '', L.timeWindow],
  ]
  for (const [label, value, max] of lines) {
    if (String(value ?? '').length > max) return tooLong(label, max)
    if (controlChars.hasNameControlChars(String(value ?? ''))) {
      return {
        error: 'Invalid text',
        message: `${label} enthält unzulässige Steuerzeichen.`,
      }
    }
  }
  if (String(stop.phone ?? '').length > L.phone) {
    return tooLong('Die Telefonnummer', L.phone)
  }
  const notes = stop.notes ?? ''
  if (notes.length > L.notes) return tooLong('Der Hinweis', L.notes)
  if (controlChars.hasTextControlChars(notes)) {
    return {
      error: 'Invalid text',
      message: 'Der Hinweis enthält unzulässige Steuerzeichen.',
    }
  }
  // Grund bei „Nicht angetroffen“ (Fahrer, auch aus der Warteschlange):
  // dieselbe Regel wie der Hinweis - sonst dreht ein Bidi-Zeichen den Text
  // auf der Stoppkarte um.
  if (controlChars.hasTextControlChars(stop.failureReason ?? '')) {
    return {
      error: 'Invalid text',
      message: 'Der Grund enthält unzulässige Steuerzeichen.',
    }
  }
  if (stop.items.length > L.items) {
    return {
      error: 'Too many items',
      message: `Ein Stopp hat höchstens ${L.items} Positionen.`,
    }
  }
  for (const item of stop.items) {
    if (item.name.length > L.itemName) {
      return tooLong('Ein Positionsname', L.itemName)
    }
    if (item.unit.length > L.itemUnit) return tooLong('Die Einheit', L.itemUnit)
    if (
      controlChars.hasNameControlChars(item.name) ||
      controlChars.hasNameControlChars(item.unit)
    ) {
      return {
        error: 'Invalid text',
        message: 'Eine Position enthält unzulässige Steuerzeichen.',
      }
    }
    if (item.qty > L.itemQty) {
      return {
        error: 'Invalid quantity',
        message: `Eine Menge darf höchstens ${L.itemQty} sein.`,
      }
    }
  }
  return null
}

function defaultGeo(): GeoServices {
  return {
    geocodeAddress: (address) => geoCore.geocodeAddress(address),
    routeTour: (depot, stops, options) =>
      geoCore.routeTour(depot, stops, options),
  }
}

/** Geo services that never answer - the estimate path, without network. */
const OFFLINE_GEO: GeoServices = {
  geocodeAddress: async () => null,
  routeTour: async () => null,
}

// --------------------------------------------------------------- service

export class DeliveryToursService {
  readonly preorders: PreordersService
  private readonly geo: GeoServices
  private readonly budgetMs: number
  private readonly retryMs: number
  private readonly log: { warn: (...args: unknown[]) => void }
  private readonly now: () => Date
  /** Address key → time of the failed search (5-min negative cache). */
  private readonly misses = new Map<string, number>()
  /** Address key → running search (concurrent requests share one). */
  private readonly inFlight = new Map<string, Promise<GeoHit | null>>()
  /** Background work started by reads (tests wait for it). */
  private readonly background = new Set<Promise<unknown>>()

  constructor(options: DeliveryToursOptions) {
    this.preorders = options.preorders
    this.geo = options.geo ?? defaultGeo()
    this.budgetMs = options.hydrateBudgetMs ?? HYDRATE_BUDGET_MS
    this.retryMs = options.geocodeRetryMs ?? GEOCODE_RETRY_MS
    this.log = options.log ?? { warn: (...a) => console.warn(...a) }
    this.now = options.now ?? (() => new Date())
  }

  private nowIso(): string {
    return this.now().toISOString()
  }

  /** Resolves once the address searches still running in the background are done. */
  async idle(): Promise<void> {
    while (this.background.size > 0) {
      await Promise.allSettled([...this.background])
    }
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.background.add(work)
    work.then(
      () => this.background.delete(work),
      () => this.background.delete(work)
    )
    return work
  }

  // ------------------------------------------------------------ reading

  async depot(transaction?: Transaction): Promise<PlainDepot> {
    const row = await DeliveryDepot.findByPk(DEPOT_ID, { transaction })
    if (!row) {
      // The B8 migration seeds the row; without it nothing can be routed.
      throw new Error('delivery_depot row 1 is missing (B8 migration)')
    }
    return toPlainDepot(row)
  }

  async drivers(active?: boolean): Promise<PlainDriver[]> {
    const where: WhereOptions = active === undefined ? {} : { active }
    const rows = await DeliveryDriver.findAll({
      where,
      order: [['id', 'ASC']],
    })
    return rows.map(toPlainDriver)
  }

  /** Driver ids of the `fahrer` session (0 or 1: `user_id` is unique). */
  async ownDriverIds(userId: number): Promise<number[]> {
    const rows = await DeliveryDriver.findAll({ where: { userId } })
    return rows.map((r) => r.id)
  }

  async loadTours(
    where: WhereOptions,
    transaction?: Transaction
  ): Promise<PlainTour[]> {
    const rows = await DeliveryTour.findAll({
      where,
      order: [
        ['date', 'ASC'],
        ['id', 'ASC'],
      ],
      transaction,
    })
    if (rows.length === 0) return []
    const stops = await DeliveryStop.findAll({
      where: { tourId: { [Op.in]: rows.map((r) => r.id) } },
      transaction,
    })
    const byTour = new Map<number, DeliveryStop[]>()
    for (const stop of stops) {
      const list = byTour.get(stop.tourId) ?? []
      list.push(stop)
      byTour.set(stop.tourId, list)
    }
    return rows.map((row) => toPlainTour(row, byTour.get(row.id) ?? []))
  }

  async loadTour(
    id: number,
    transaction?: Transaction
  ): Promise<PlainTour | null> {
    const [tour] = await this.loadTours({ id }, transaction)
    return tour ?? null
  }

  /**
   * Hängt die berechneten Felder an - wie `decorateTour()` im Mock, nie
   * gespeichert: Depot, Fahrer, Fortschritt, nächster Stopp, Ankunftszeiten
   * mit Zeitfenstern und an Sammelstellen die Übergabeliste des Tourtags.
   */
  async decorate(
    tours: PlainTour[],
    depotArg?: PlainDepot
  ): Promise<DecoratedTour[]> {
    if (tours.length === 0) return []
    const depot = depotArg ?? (await this.depot())
    const drivers = new Map(
      (await this.drivers()).map((d) => [d.id, d] as const)
    )
    const points = await this.preorders.pickupPoints()
    const handover = new Map<string, Record<string, unknown>[]>()
    for (const tour of tours) {
      for (const stop of tour.stops) {
        if (!stop.pickupPointId) continue
        const key = `${stop.pickupPointId}|${tour.date}`
        if (handover.has(key)) continue
        // Stornierte stehen nicht auf der Übergabeliste (wie im Mock) -
        // außer, es ist noch Geld zurückzugeben: dann sieht der Fahrer sie
        // als „Storniert - X zurückgeben“ (wie die Abholliste), statt dass
        // vorab Bezahltes in keiner Liste vor Ort steht.
        const list = await this.preorders.legacyList({
          date: tour.date,
          pickupPointId: stop.pickupPointId,
        })
        handover.set(
          key,
          list.filter(
            (p) =>
              p['status'] !== 'cancelled' || Number(p['paymentBalance']) < 0
          )
        )
      }
    }
    return tours.map((tour) =>
      decorateTour(tour, depot, drivers, points, handover, this.now().getTime())
    )
  }

  // ------------------------------------------------------- geocoding

  private async withBudget<T>(work: Promise<T>): Promise<void> {
    let timer: NodeJS.Timeout | undefined
    const budget = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.budgetMs)
    })
    const guarded = this.track(
      work
        .catch((err: Error) =>
          this.log.warn(
            `[deliveries] Adresssuche fehlgeschlagen: ${err?.message}`
          )
        )
        .finally(() => clearTimeout(timer))
    )
    await Promise.race([guarded, budget])
  }

  /**
   * Cache (Tabelle `delivery_geocache`), sonst Nominatim. Fehlversuche
   * werden 5 Minuten lang nicht wiederholt, außer mit `force`
   * (ausdrückliche Aktion: Stopp anlegen, Adresse ändern, Depot ändern,
   * POST /geocode).
   */
  async lookupAddress(
    address: string,
    force: boolean
  ): Promise<{ hit: GeoHit; source: 'cache' | 'nominatim' } | null> {
    const key = String(core.normalizeAddress(address)).slice(0, 300)
    const cached = await DeliveryGeocache.findByPk(key)
    if (cached && core.hasCoordinates(cached)) {
      return {
        hit: {
          lat: Number(cached.lat),
          lon: Number(cached.lon),
          displayName: cached.displayName ?? null,
          precision: cached.precision ?? null,
          at: iso(cached.updatedAt) ?? undefined,
        },
        source: 'cache',
      }
    }
    const missedAt = this.misses.get(key)
    if (!force && missedAt && Date.now() - missedAt < this.retryMs) return null

    if (!this.inFlight.has(key)) {
      const search = this.geo
        .geocodeAddress(address)
        .then(async (hit) => {
          if (hit && core.hasCoordinates(hit)) {
            this.misses.delete(key)
            await getSequelize().transaction(async (transaction) => {
              await DeliveryGeocache.upsert(
                {
                  key,
                  lat: Number(hit.lat),
                  lon: Number(hit.lon),
                  displayName: hit.displayName ?? null,
                  precision: hit.precision ?? null,
                },
                { transaction }
              )
            })
            return hit
          }
          this.misses.set(key, Date.now())
          return null
        })
        .catch((err: Error) => {
          this.log.warn(`[deliveries] Adresssuche: ${err?.message}`)
          this.misses.set(key, Date.now())
          return null
        })
        .finally(() => this.inFlight.delete(key))
      this.inFlight.set(key, search)
    }
    const hit = await this.inFlight.get(key)
    return hit ? { hit, source: 'nominatim' } : null
  }

  /**
   * Koordinaten für einen Punkt ohne welche - ohne Straße wird nicht gesucht
   * (Nominatim fände die Ortsmitte, als `street`-Treffer).
   */
  async locate(
    point: {
      street?: string | null
      zip?: string | null
      city?: string | null
      lat?: number | null
      lon?: number | null
    },
    force: boolean
  ): Promise<Pick<
    PlainStop,
    'lat' | 'lon' | 'geocodeSource' | 'geocodePrecision'
  > | null> {
    if (core.hasCoordinates(point)) return null
    if (!String(point.street ?? '').trim()) return null
    const address = core.formatAddress(point)
    if (!address) return null
    const found = await this.lookupAddress(address, force)
    if (!found) return null
    return {
      lat: Number(found.hit.lat),
      lon: Number(found.hit.lon),
      geocodeSource: found.source,
      // Cache-Einträge ohne Genauigkeit bleiben `null` (unbekannt).
      geocodePrecision: found.hit.precision ?? null,
    }
  }

  /** Stores found coordinates - only if the stop still has that address and none. */
  private async storeStopCoordinates(
    stopId: number,
    address: string,
    coords: Pick<
      PlainStop,
      'lat' | 'lon' | 'geocodeSource' | 'geocodePrecision'
    >
  ): Promise<boolean> {
    return getSequelize().transaction(async (transaction) => {
      const row = await DeliveryStop.findByPk(stopId, { transaction })
      if (!row || core.hasCoordinates(row)) return false
      if (core.formatAddress(row) !== address) return false
      await row.update(coords, { transaction })
      return true
    })
  }

  private async storeDepotCoordinates(
    address: string,
    coords: Pick<
      PlainStop,
      'lat' | 'lon' | 'geocodeSource' | 'geocodePrecision'
    >
  ): Promise<boolean> {
    return getSequelize().transaction(async (transaction) => {
      const row = await DeliveryDepot.findByPk(DEPOT_ID, { transaction })
      if (!row || core.hasCoordinates(row)) return false
      if (core.formatAddress(row) !== address) return false
      await row.update(coords, { transaction })
      return true
    })
  }

  /**
   * Sucht fehlende Koordinaten von Depot und Stopps nach und wartet darauf
   * höchstens `hydrateBudgetMs` (2,5 s). Dauert es länger, geht die Antwort
   * ohne sie raus; die Suche läuft weiter, speichert ihr Ergebnis, und der
   * nächste Aufruf sieht es.
   */
  async hydrate(tours: PlainTour[], depot: PlainDepot): Promise<void> {
    const needs =
      !core.hasCoordinates(depot) ||
      tours.some((t) =>
        t.stops.some(
          (s) => !core.hasCoordinates(s) && String(s.street || '').trim()
        )
      )
    if (!needs) return
    const work = (async () => {
      if (!core.hasCoordinates(depot)) {
        const address = core.formatAddress(depot)
        const found = await this.locate(depot, false)
        if (found && (await this.storeDepotCoordinates(address, found))) {
          Object.assign(depot, found)
        }
      }
      for (const tour of tours) {
        for (const stop of tour.stops) {
          if (core.hasCoordinates(stop)) continue
          const address = core.formatAddress(stop)
          const found = await this.locate(stop, false)
          if (
            found &&
            (await this.storeStopCoordinates(stop.id, address, found))
          ) {
            Object.assign(stop, found)
          }
        }
      }
    })()
    await this.withBudget(work)
  }

  /** Address search for one stop with the time budget (create, address change). */
  private async locateStop(stop: PlainStop, force: boolean): Promise<void> {
    if (core.hasCoordinates(stop)) return
    const address = core.formatAddress(stop)
    const work = this.locate(stop, force).then(async (found) => {
      if (found && (await this.storeStopCoordinates(stop.id, address, found))) {
        Object.assign(stop, found)
      }
    })
    await this.withBudget(work)
  }

  // ------------------------------------------------------------- writes

  private async saveTour(
    tour: PlainTour,
    req: Request | null,
    transaction: Transaction
  ): Promise<void> {
    await DeliveryTour.update(
      { ...tourColumns(tour), updatedBy: req?.user?.id ?? null },
      { where: { id: tour.id }, transaction }
    )
    for (let position = 0; position < tour.stops.length; position++) {
      const stop = tour.stops[position]
      await DeliveryStop.update(
        { ...stopColumns(stop), position },
        { where: { id: stop.id, tourId: tour.id }, transaction }
      )
    }
  }

  /**
   * Liest die Tour in der Transaktion, lässt `work` sie ändern, speichert
   * und protokolliert. `work` gibt die Audit-Daten zurück (oder `null` =
   * nichts zu protokollieren) bzw. wirft einen `DeliveryRouteError`.
   */
  async mutateTour(
    id: number,
    req: Request | null,
    work: (
      tour: PlainTour,
      transaction: Transaction
    ) => Promise<{ action: string; data: Record<string, unknown> } | null>,
    access?: TourAccess
  ): Promise<Result<PlainTour>> {
    try {
      const tour = await getSequelize().transaction(async (transaction) => {
        const current = await this.loadTour(id, transaction)
        if (!current) throw tourNotFound()
        if (!mayAccess(current, access)) throw notOwnTour()
        const entry = await work(current, transaction)
        await this.saveTour(current, req, transaction)
        if (entry) {
          await audit(req, entry.action, 'delivery_tour', id, entry.data, {
            transaction,
          })
        }
        return current
      })
      return ok(tour)
    } catch (error) {
      if (error instanceof DeliveryRouteError) return error.toResult()
      throw error
    }
  }

  // ---- depot

  /**
   * Depot ändern. Nur die Felder, die der Request nennt, ändern sich; der
   * Rest kommt aus der Zeile, die **in** der Transaktion gelesen wird -
   * zwei überlappende Änderungen nehmen einander so nichts zurück. Die
   * Adresssuche läuft vorher, außerhalb der Transaktion; hat sich die
   * Adresse derweil geändert, gilt ihr Treffer nicht (409, neu laden).
   */
  async updateDepot(body: unknown, req: Request): Promise<Result<PlainDepot>> {
    const input = (body ?? {}) as Record<string, unknown>
    const given = (key: string) =>
      input[key] !== undefined && input[key] !== null && input[key] !== ''
    // Wie im Mock: ein leerer Name/Straße/Ort lässt den alten Wert stehen,
    // eine leere PLZ oder Telefonnummer löscht sie.
    const patch: Partial<PlainDepot> = {}
    if (given('name')) patch.name = String(input['name']).trim()
    if (given('street')) patch.street = String(input['street']).trim()
    if (input['zip'] !== undefined) {
      patch.zip = String(input['zip'] ?? '').trim()
    }
    if (given('city')) patch.city = String(input['city']).trim()
    if (input['phone'] !== undefined) {
      const phone = checkPhone(input['phone'])
      if ('error' in phone) return fail(400, phone.error, phone.message)
      patch.phone = phone.phone
    }
    for (const [label, value, max] of [
      ['Der Name', patch.name, DELIVERY_LIMITS.depotName],
      ['Die Straße', patch.street, DELIVERY_LIMITS.street],
      ['Die Postleitzahl', patch.zip, DELIVERY_LIMITS.zip],
      ['Der Ort', patch.city, DELIVERY_LIMITS.city],
    ] as Array<[string, string | undefined, number]>) {
      if (value === undefined) continue
      if (value.length > max) {
        const e = tooLong(label, max)
        return fail(400, e.error, e.message)
      }
      if (controlChars.hasNameControlChars(value)) {
        return fail(
          400,
          'Invalid text',
          `${label} enthält unzulässige Steuerzeichen.`
        )
      }
    }

    let coordinates: Partial<PlainDepot> | null = null
    let searchedAddress: string | null = null
    if (input['lat'] !== undefined || input['lon'] !== undefined) {
      const coords = core.validateCoordinates(input['lat'], input['lon'])
      if (coords.error) return fail(400, coords.error, coords.message)
      coordinates = {
        lat: coords.lat,
        lon: coords.lon,
        geocodeSource: 'manual',
        geocodePrecision: null,
      }
    } else {
      const current = await this.depot()
      const target = { ...current, ...patch }
      if (core.formatAddress(target) !== core.formatAddress(current)) {
        // Ohne Koordinaten gibt es kein Depot - jede Tour begänne im Atlantik.
        const found = await this.locate(
          { ...target, lat: null, lon: null },
          true
        )
        if (!found) {
          return fail(
            422,
            'Address not found',
            'Die neue Adresse der Backstube wurde nicht gefunden; die alte bleibt bestehen. Koordinaten können auch direkt als lat/lon angegeben werden.'
          )
        }
        coordinates = { ...found }
        searchedAddress = core.formatAddress(target)
      }
    }

    try {
      return await getSequelize().transaction(async (transaction) => {
        const row = await DeliveryDepot.findByPk(DEPOT_ID, { transaction })
        if (!row) throw new Error('delivery_depot row 1 is missing')
        const before = toPlainDepot(row)
        const depot: PlainDepot = { ...before, ...patch }
        const addressChanged =
          core.formatAddress(depot) !== core.formatAddress(before)
        if (coordinates && searchedAddress === null) {
          Object.assign(depot, coordinates) // lat/lon aus dem Request
        } else if (addressChanged) {
          if (searchedAddress !== core.formatAddress(depot)) {
            throw new DeliveryRouteError(
              409,
              'Depot changed',
              'Die Backstube wurde inzwischen geändert. Bitte neu laden und noch einmal speichern.'
            )
          }
          Object.assign(depot, coordinates)
        }
        await row.update(
          { ...depot, updatedBy: req.user?.id ?? null },
          { transaction }
        )
        const after = toPlainDepot(row)
        const changed = (Object.keys(after) as Array<keyof PlainDepot>).filter(
          (k) => after[k] !== before[k]
        )
        if (changed.length > 0) {
          await audit(
            req,
            'update',
            'delivery_depot',
            DEPOT_ID,
            { changed },
            {
              transaction,
            }
          )
        }
        return ok(after)
      })
    } catch (error) {
      if (error instanceof DeliveryRouteError) return error.toResult()
      throw error
    }
  }

  // ---- drivers

  private async checkDriverUser(
    value: unknown,
    selfId: number | null,
    transaction: Transaction
  ): Promise<Failure | { userId: number | null }> {
    if (value === null || value === '') return { userId: null }
    const userId = typeof value === 'number' ? value : Number(value)
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      String(userId) !== String(value).trim()
    ) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid userId',
        message:
          'Das Konto muss als Benutzer-ID (ganze Zahl) angegeben werden.',
      }
    }
    const user = await User.findByPk(userId, { transaction })
    if (!user) {
      return {
        ok: false,
        status: 400,
        error: 'User not found',
        message: 'Dieses Benutzerkonto existiert nicht.',
      }
    }
    // Nur ein `fahrer` wird über die Zuordnung auf seine Touren beschränkt;
    // ein anderes Konto zuzuordnen hätte keine Wirkung (Inhaber sieht alles,
    // Verkauf liest alles) - das soll niemand still für erledigt halten.
    if (user.role !== 'fahrer') {
      return {
        ok: false,
        status: 400,
        error: 'Driver user not fahrer',
        message:
          'Einem Fahrer kann nur ein Konto mit der Rolle „Fahrer“ zugeordnet werden.',
      }
    }
    const taken = await DeliveryDriver.findOne({
      where: { userId },
      transaction,
    })
    if (taken && taken.id !== selfId) {
      return {
        ok: false,
        status: 409,
        error: 'Driver user taken',
        message: `Dieses Konto ist schon dem Fahrer „${taken.name}“ zugeordnet.`,
      }
    }
    return { userId }
  }

  private driverName(value: unknown): Failure | { name: string } {
    const name = String(value ?? '').trim()
    if (!name) {
      return {
        ok: false,
        status: 400,
        error: 'Name is required',
        message: 'Der Name des Fahrers ist erforderlich.',
      }
    }
    if (name.length > DELIVERY_LIMITS.driverName) {
      return {
        ok: false,
        status: 400,
        ...tooLong('Der Name', DELIVERY_LIMITS.driverName),
      }
    }
    if (controlChars.hasNameControlChars(name)) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid text',
        message: 'Der Name enthält unzulässige Steuerzeichen.',
      }
    }
    return { name }
  }

  async createDriver(
    body: unknown,
    req: Request
  ): Promise<Result<PlainDriver>> {
    const input = (body ?? {}) as Record<string, unknown>
    const named = this.driverName(input['name'])
    if ('ok' in named) return named
    const phone = checkPhone(input['phone'])
    if ('error' in phone) return fail(400, phone.error, phone.message)
    return getSequelize().transaction(async (transaction) => {
      let userId: number | null = null
      if (input['userId'] !== undefined) {
        const checked = await this.checkDriverUser(
          input['userId'],
          null,
          transaction
        )
        if ('ok' in checked) return checked
        userId = checked.userId
      }
      const row = await DeliveryDriver.create(
        {
          name: named.name,
          phone: phone.phone,
          vehicle: VEHICLES.includes(input['vehicle'] as string)
            ? (input['vehicle'] as string)
            : 'car',
          active:
            input['active'] === undefined ? true : Boolean(input['active']),
          userId,
        },
        { transaction }
      )
      await audit(
        req,
        'create',
        'delivery_driver',
        row.id,
        { linkedUser: userId },
        { transaction }
      )
      return ok(toPlainDriver(row), 201)
    })
  }

  async updateDriver(
    idParam: unknown,
    body: unknown,
    req: Request
  ): Promise<Result<PlainDriver>> {
    const id = parseId(idParam)
    const input = (body ?? {}) as Record<string, unknown>
    return getSequelize().transaction(async (transaction) => {
      const row = id ? await DeliveryDriver.findByPk(id, { transaction }) : null
      if (!row) {
        return fail<PlainDriver>(
          404,
          'Driver not found',
          'Dieser Fahrer existiert nicht.'
        )
      }
      const before = toPlainDriver(row)
      const patch: Partial<PlainDriver> = {}
      if (input['name'] !== undefined) {
        const named = this.driverName(input['name'])
        if ('ok' in named) return named
        patch.name = named.name
      }
      if (input['phone'] !== undefined) {
        const phone = checkPhone(input['phone'])
        if ('error' in phone) return fail(400, phone.error, phone.message)
        patch.phone = phone.phone
      }
      if (VEHICLES.includes(input['vehicle'] as string)) {
        patch.vehicle = input['vehicle'] as string
      }
      if (input['active'] !== undefined) patch.active = Boolean(input['active'])
      if (input['userId'] !== undefined) {
        const checked = await this.checkDriverUser(
          input['userId'],
          row.id,
          transaction
        )
        if ('ok' in checked) return checked
        patch.userId = checked.userId
      }
      await row.update(patch, { transaction })
      const after = toPlainDriver(row)
      const changed = (Object.keys(after) as Array<keyof PlainDriver>).filter(
        (k) => after[k] !== before[k]
      )
      if (changed.length > 0) {
        await audit(
          req,
          'update',
          'delivery_driver',
          row.id,
          { changed },
          {
            transaction,
          }
        )
      }
      return ok(after)
    })
  }

  // ---- tours

  async createTour(body: unknown, req: Request): Promise<Result<PlainTour>> {
    const input = (body ?? {}) as Record<string, unknown>
    const date = (input['date'] as string) || core.nextWeekday(this.now(), 6)
    if (!core.isBusinessDate(date)) {
      return fail(
        400,
        'Invalid date',
        'Das Datum muss im Format JJJJ-MM-TT angegeben werden.'
      )
    }
    const plannedStartGiven =
      input['plannedStart'] !== undefined &&
      input['plannedStart'] !== null &&
      input['plannedStart'] !== ''
    if (plannedStartGiven && !core.isClockTime(input['plannedStart'])) {
      return fail(400, 'Invalid plannedStart', PLANNED_START_MESSAGE)
    }
    const latest = core.toBusinessDate(
      new Date(this.now().getTime() + TOUR_DAYS_AHEAD * 86_400_000)
    )
    if (date < TOUR_DATE_MIN || date > latest) {
      return fail(
        400,
        'Invalid date',
        `Der Tourtag muss zwischen dem 01.01.2020 und höchstens ${TOUR_DAYS_AHEAD} Tage voraus liegen.`
      )
    }
    const name = String(input['name'] || 'Tour').trim() || 'Tour'
    const nameProblem = checkTourName(name)
    if (nameProblem) return fail(400, nameProblem.error, nameProblem.message)
    const parsedDriver = parseDriverId(input['driverId'])
    if (!parsedDriver) {
      return fail(400, 'Invalid driverId', INVALID_DRIVER_MESSAGE)
    }
    const driverId = parsedDriver.id ?? 0

    try {
      const id = await getSequelize().transaction(async (transaction) => {
        if (
          driverId &&
          !(await DeliveryDriver.findByPk(driverId, { transaction }))
        ) {
          throw new DeliveryRouteError(
            400,
            'Driver not found',
            'Dieser Fahrer existiert nicht.'
          )
        }
        const row = await DeliveryTour.create(
          {
            date,
            driverId: driverId || null,
            name,
            status: 'planned',
            plannedStart: plannedStartGiven
              ? (input['plannedStart'] as string)
              : '06:30',
            vehicleType: VEHICLES.includes(input['vehicleType'] as string)
              ? (input['vehicleType'] as string)
              : 'car',
            isEstimate: true,
            createdBy: req.user?.id ?? null,
            updatedBy: req.user?.id ?? null,
          },
          { transaction }
        )
        // Fällt der Tag auf den Liefertag einer aktiven Sammelstelle, kommt
        // ihr Stopp gleich mit - aber nur an die erste Tour des Tages, sonst
        // hätten zwei Samstagsfahrer dieselbe Übergabeliste. Geprüft in der
        // serialisierten Transaktion: zwei gleichzeitige Touren bekommen den
        // Stopp nicht beide.
        const points = [
          ...(await this.preorders.pickupPoints(transaction)).values(),
        ]
        const sameDay = await this.loadTours({ date }, transaction)
        const attached: string[] = []
        let position = 0
        for (const point of preordersCore.pickupPointsForDate(points, date)) {
          if (preordersCore.hasPickupStop(sameDay, point.id, date)) continue
          const stop = preordersCore.buildPickupStop(point)
          await DeliveryStop.create(
            {
              ...stopColumns({ ...stop, id: 0 }),
              tourId: row.id,
              position: position++,
            },
            { transaction }
          )
          attached.push(point.id)
        }
        await audit(
          req,
          'create',
          'delivery_tour',
          row.id,
          { date, driverId: driverId || null, pickupStops: attached },
          { transaction }
        )
        return row.id
      })
      const tour = await this.loadTour(id)
      return ok(tour as PlainTour, 201)
    } catch (error) {
      if (error instanceof DeliveryRouteError) return error.toResult()
      throw error
    }
  }

  async updateTour(
    id: number,
    body: unknown,
    req: Request
  ): Promise<Result<PlainTour>> {
    const input = (body ?? {}) as Record<string, unknown>
    if (
      input['status'] !== undefined &&
      !core.TOUR_STATUS.includes(input['status'])
    ) {
      return fail(
        400,
        'Invalid status',
        'Status muss "planned", "active" oder "done" sein.'
      )
    }
    if (
      input['plannedStart'] !== undefined &&
      !core.isClockTime(input['plannedStart'])
    ) {
      return fail(400, 'Invalid plannedStart', PLANNED_START_MESSAGE)
    }
    if (input['name'] !== undefined) {
      const nameProblem = checkTourName(String(input['name']).trim())
      if (nameProblem) return fail(400, nameProblem.error, nameProblem.message)
    }
    return this.mutateTour(id, req, async (tour, transaction) => {
      const changed: string[] = []
      const nowIso = this.nowIso()
      if (input['status'] !== undefined) {
        const status = input['status'] as string
        if (status === 'active' && !tour.startedAt) tour.startedAt = nowIso
        if (status === 'done' && !tour.finishedAt) tour.finishedAt = nowIso
        if (status === 'planned') {
          tour.startedAt = null
          tour.finishedAt = null
        }
        if (tour.status !== status) changed.push('status')
        tour.status = status
      }
      if (input['driverId'] !== undefined) {
        const parsedDriver = parseDriverId(input['driverId'])
        if (!parsedDriver) {
          throw new DeliveryRouteError(
            400,
            'Invalid driverId',
            INVALID_DRIVER_MESSAGE
          )
        }
        const driverId = parsedDriver.id ?? 0
        if (
          driverId &&
          !(await DeliveryDriver.findByPk(driverId, { transaction }))
        ) {
          throw new DeliveryRouteError(
            400,
            'Driver not found',
            'Dieser Fahrer existiert nicht.'
          )
        }
        if ((tour.driverId ?? null) !== (driverId || null)) {
          changed.push('driverId')
        }
        tour.driverId = driverId || null
      }
      if (input['name'] !== undefined) {
        const name = String(input['name']).trim() || tour.name
        if (name !== tour.name) changed.push('name')
        tour.name = name
      }
      if (input['plannedStart'] !== undefined) {
        if (tour.plannedStart !== input['plannedStart']) {
          changed.push('plannedStart')
        }
        tour.plannedStart = input['plannedStart'] as string
      }
      if (VEHICLES.includes(input['vehicleType'] as string)) {
        if (tour.vehicleType !== input['vehicleType']) {
          changed.push('vehicleType')
        }
        tour.vehicleType = input['vehicleType'] as string
      }
      if (Array.isArray(input['stopOrder'])) {
        const before = tour.stops.map((s) => s.id).join(',')
        applyStopOrder(tour, (input['stopOrder'] as unknown[]).map(Number))
        if (tour.stops.map((s) => s.id).join(',') !== before) {
          changed.push('stopOrder')
        }
      }
      return changed.length > 0
        ? {
            action: 'update',
            data: { changed, driverId: tour.driverId, status: tour.status },
          }
        : null
    })
  }

  async deleteTour(id: number, req: Request): Promise<Result<true>> {
    try {
      await getSequelize().transaction(async (transaction) => {
        const tour = await this.loadTour(id, transaction)
        if (!tour) throw tourNotFound()
        await DeliveryStop.destroy({ where: { tourId: id }, transaction })
        await DeliveryTour.destroy({ where: { id }, transaction })
        // Ohne Namen und Adressen (personenbezogen); was weg ist, steht hier.
        await audit(
          req,
          'delete',
          'delivery_tour',
          id,
          {
            date: tour.date,
            driverId: tour.driverId,
            status: tour.status,
            stops: tour.stops.map((s) => ({
              id: s.id,
              status: s.status,
              pickupPointId: s.pickupPointId ?? null,
            })),
          },
          { transaction }
        )
      })
      return ok(true as const)
    } catch (error) {
      if (error instanceof DeliveryRouteError) return error.toResult()
      throw error
    }
  }

  // ---- stops

  async addStop(
    tourId: number,
    body: unknown,
    req: Request
  ): Promise<Result<PlainTour>> {
    const exists = await DeliveryTour.findByPk(tourId)
    if (!exists) return tourNotFound().toResult()
    const result = core.normalizeStopInput(body, null, this.nowIso())
    if (result.error) return fail(400, result.error, result.message)
    const draft: PlainStop = {
      id: 0,
      lat: null,
      lon: null,
      geocodeSource: null,
      geocodePrecision: null,
      completedAt: null,
      failureReason: null,
      goodsDisposition: null,
      ...result.stop,
    }
    const problem = checkStopText(draft)
    if (problem) return fail(400, problem.error, problem.message)
    const pointProblem = await this.checkPickupPoint(draft.pickupPointId)
    if (pointProblem) return pointProblem

    // Erst suchen (mit Budget), dann anlegen - wie im Mock. Kommt der
    // Treffer zu spät, speichert ihn die Suche nachträglich am neuen Stopp.
    const address = core.formatAddress(draft)
    const search = this.locate(draft, true)
    let early: Awaited<typeof search> = null
    await this.withBudget(
      search.then((found) => {
        early = found
      })
    )
    if (early) Object.assign(draft, early)

    let createdId = 0
    const outcome = await this.mutateTour(
      tourId,
      req,
      async (tour, transaction) => {
        const row = await DeliveryStop.create(
          {
            ...stopColumns(draft),
            tourId,
            position: tour.stops.length,
          },
          { transaction }
        )
        createdId = row.id
        tour.stops.push(toPlainStop(row))
        // Ein nachgeschobener Stopp macht eine abgeschlossene Tour wieder auf.
        core.syncTourStatus(tour, this.nowIso())
        return {
          action: 'add_stop',
          data: { stopId: row.id, pickupPointId: draft.pickupPointId ?? null },
        }
      }
    )
    if (outcome.ok && !core.hasCoordinates(draft) && createdId) {
      this.track(
        search.then(async (found) => {
          if (found) await this.storeStopCoordinates(createdId, address, found)
        })
      )
    }
    return outcome
  }

  private async checkPickupPoint(
    id: string | undefined
  ): Promise<Failure | null> {
    if (!id) return null
    const point = await PickupPoint.findByPk(id)
    return point
      ? null
      : {
          ok: false,
          status: 400,
          error: 'Pickup point not found',
          message: 'Diese Lieferstelle existiert nicht.',
        }
  }

  /**
   * Stopp ändern. Ein Fahrer (`fahrerOnly`) darf nur abhaken; das prüft die
   * Route vorher an den Feldern des Bodys.
   */
  async updateStop(
    tourId: number,
    stopIdParam: unknown,
    body: unknown,
    req: Request,
    access?: TourAccess
  ): Promise<Result<PlainTour>> {
    const stopId = parseId(stopIdParam)
    const input = (body ?? {}) as Record<string, unknown>
    if (
      input['completedAt'] !== undefined &&
      input['completedAt'] !== null &&
      toDate(String(input['completedAt'])) === null
    ) {
      return fail(
        400,
        'Invalid completedAt',
        'Der Zeitpunkt muss ein gültiges Datum sein.'
      )
    }
    if (input['pickupPointId']) {
      const pointProblem = await this.checkPickupPoint(
        String(input['pickupPointId'])
      )
      if (pointProblem) return pointProblem
    }
    let relocate: { stop: PlainStop; force: boolean } | null = null
    const outcome = await this.mutateTour(
      tourId,
      req,
      async (tour) => {
        const stop = tour.stops.find((s) => s.id === stopId)
        if (!stop) throw stopNotFound()
        if (
          input['completedAt'] !== undefined &&
          input['completedAt'] !== null
        ) {
          const at = (toDate(String(input['completedAt'])) as Date).getTime()
          const day = Date.parse(`${tour.date}T00:00:00Z`)
          const earliest = day - COMPLETED_AT_DAYS_BEFORE * 86_400_000
          const latest = day + COMPLETED_AT_DAYS_AFTER * 86_400_000
          if (at < earliest || at >= latest) {
            throw new DeliveryRouteError(
              400,
              'Invalid completedAt',
              'Der Zeitpunkt muss zum Tourtag passen.'
            )
          }
        }
        const result = core.normalizeStopInput(input, stop, this.nowIso())
        if (result.error) {
          throw new DeliveryRouteError(400, result.error, result.message)
        }
        const problem = checkStopText(result.stop)
        if (problem) {
          throw new DeliveryRouteError(400, problem.error, problem.message)
        }
        const before = { ...stop }
        const addressChanged =
          core.formatAddress(result.stop) !== core.formatAddress(stop)
        Object.assign(stop, result.stop)
        if (addressChanged && result.stop.geocodeSource !== 'manual') {
          stop.lat = null
          stop.lon = null
          stop.geocodeSource = null
          stop.geocodePrecision = null
        }
        // Erster abgehakter Stopp startet die Tour, der letzte schließt sie,
        // ein zurückgesetzter macht sie wieder auf.
        core.syncTourStatus(tour, this.nowIso())
        if (!core.hasCoordinates(stop)) {
          relocate = { stop, force: addressChanged }
        }
        const changed = (Object.keys(stop) as Array<keyof PlainStop>).filter(
          (k) => JSON.stringify(stop[k]) !== JSON.stringify(before[k])
        )
        return changed.length > 0
          ? {
              action: 'update_stop',
              data: {
                stopId: stop.id,
                changed,
                status: stop.status,
                tourStatus: tour.status,
              },
            }
          : null
      },
      access
    )
    if (outcome.ok && relocate) {
      const { stop, force } = relocate as { stop: PlainStop; force: boolean }
      await this.locateStop(stop, force)
    }
    return outcome
  }

  async removeStop(
    tourId: number,
    stopIdParam: unknown,
    req: Request
  ): Promise<Result<PlainTour>> {
    const stopId = parseId(stopIdParam)
    return this.mutateTour(tourId, req, async (tour, transaction) => {
      const stop = tour.stops.find((s) => s.id === stopId)
      if (!stop) throw stopNotFound()
      tour.stops = tour.stops.filter((s) => s.id !== stop.id)
      await DeliveryStop.destroy({ where: { id: stop.id }, transaction })
      // War das der letzte offene Stopp, ist die Tour jetzt fertig.
      core.syncTourStatus(tour, this.nowIso())
      return {
        action: 'remove_stop',
        data: {
          stopId: stop.id,
          status: stop.status,
          pickupPointId: stop.pickupPointId ?? null,
        },
      }
    })
  }

  /**
   * "Route berechnen": rechnet außerhalb jeder Transaktion (OSRM kann
   * Sekunden brauchen) und übernimmt das Ergebnis nur, wenn sich die Tour
   * derweil nicht geändert hat. Sonst ein zweiter Versuch, danach ohne Netz
   * (Schätzung) in der Transaktion.
   */
  async optimize(
    tourId: number,
    body: unknown,
    req: Request,
    access?: TourAccess
  ): Promise<Result<PlainTour>> {
    const input = (body ?? {}) as Record<string, unknown>
    const optimize = input['optimize'] !== false
    const first = await this.loadTour(tourId)
    if (!first) return tourNotFound().toResult()
    const depot = await this.depot()
    // Fehlende Koordinaten noch einmal probieren - ohne `force`.
    await this.hydrate([first], depot)

    for (let attempt = 0; attempt < 3; attempt++) {
      const offline = attempt === 2
      const snapshot = await this.loadTour(tourId)
      if (!snapshot) return tourNotFound().toResult()
      const computed = offline
        ? null
        : await recalculateTour(snapshot, depot, optimize, this.geo, this.now())
      const outcome = await this.mutateTour(
        tourId,
        req,
        async (tour) => {
          let next = computed
          if (!next || routeFingerprint(tour) !== routeFingerprint(snapshot)) {
            if (!offline) throw new RetryRoute()
            next = await recalculateTour(
              tour,
              depot,
              optimize,
              OFFLINE_GEO,
              this.now()
            )
          }
          const byId = new Map(tour.stops.map((s) => [s.id, s]))
          tour.stops = next.stops.map((s) => byId.get(s.id) as PlainStop)
          tour.distance = next.distance
          tour.duration = next.duration
          tour.geometry = next.geometry
          tour.isEstimate = next.isEstimate
          tour.routedAt = next.routedAt
          return {
            action: 'optimize',
            data: {
              optimize,
              isEstimate: tour.isEstimate,
              order: tour.stops.map((s) => s.id),
            },
          }
        },
        access
      ).catch((error) => {
        if (error instanceof RetryRoute) return null
        throw error
      })
      if (outcome) return outcome
    }
    return fail(
      500,
      'Internal error',
      'Die Route konnte nicht berechnet werden.'
    )
  }

  async reportPosition(
    tourId: number,
    body: unknown,
    access?: TourAccess
  ): Promise<Result<LastPosition>> {
    const input = (body ?? {}) as Record<string, unknown>
    // `validateCoordinates`, nicht `Number.isFinite(Number(x))`: `null` wäre
    // sonst eine Position auf dem Nullmeridian.
    const coords = core.validateCoordinates(input['lat'], input['lon'])
    if (coords.error) return fail(400, coords.error, coords.message)
    const position: LastPosition = {
      lat: coords.lat,
      lon: coords.lon,
      accuracy: core.isNumber(input['accuracy'])
        ? Number(input['accuracy'])
        : null,
      speed: core.isNumber(input['speed']) ? Number(input['speed']) : null,
      at: this.nowIso(),
    }
    // Telemetrie alle 30 s je Fahrer: nicht im audit_log (s. docs/api/deliveries.md).
    try {
      await getSequelize().transaction(async (transaction) => {
        const row = await DeliveryTour.findByPk(tourId, { transaction })
        if (!row) throw tourNotFound()
        if (!mayAccess({ driverId: row.driverId ?? null }, access)) {
          throw notOwnTour()
        }
        await row.update({ lastPosition: position }, { transaction })
      })
    } catch (error) {
      if (error instanceof DeliveryRouteError) return error.toResult()
      throw error
    }
    return ok(position)
  }

  async geocode(body: unknown): Promise<Result<GeoHit>> {
    const input = (body ?? {}) as Record<string, unknown>
    const address = core.formatAddress(input) || String(input['address'] ?? '')
    if (!address.trim()) {
      return fail(400, 'Address is required', 'Es fehlt eine Adresse.')
    }
    if (address.length > 400) {
      const e = tooLong('Die Adresse', 400)
      return fail(400, e.error, e.message)
    }
    const found = await this.lookupAddress(address, true)
    if (!found) {
      return fail(
        404,
        'Address not found',
        'Zu dieser Adresse wurde kein Ort gefunden.'
      )
    }
    return ok(found.hit)
  }

  /**
   * B8-Haken an `PreordersService.updatePickupPoint`: eine geänderte Adresse
   * der Sammelstelle wandert in ihre Stopps (wie `applyPickupPointToStops`
   * im Mock); die Koordinaten werden gelöscht und beim nächsten Lesen neu
   * gesucht.
   */
  async pickupPointChanged(
    before: PickupPointDto,
    after: PickupPointDto,
    transaction: Transaction
  ): Promise<void> {
    if (core.formatAddress(before) === core.formatAddress(after)) return
    await DeliveryStop.update(
      {
        street: after.street,
        zip: after.zip,
        city: after.city,
        lat: null,
        lon: null,
        geocodeSource: null,
        geocodePrecision: null,
      },
      { where: { pickupPointId: after.id }, transaction }
    )
  }
}

class RetryRoute extends Error {}

/** Darf diese Sitzung die Tour anfassen? (`fahrer`: nur eigene.) */
export function mayAccess(
  tour: { driverId: number | null },
  access?: TourAccess
): boolean {
  if (!access || access.driverIds === null) return true
  return tour.driverId !== null && access.driverIds.includes(tour.driverId)
}

export function notOwnTour(): DeliveryRouteError {
  return new DeliveryRouteError(
    403,
    'not_own_tour',
    'Diese Tour ist einem anderen Fahrer zugeteilt.'
  )
}

function tourNotFound(): DeliveryRouteError {
  return new DeliveryRouteError(
    404,
    'Tour not found',
    'Diese Tour existiert nicht.'
  )
}

function stopNotFound(): DeliveryRouteError {
  return new DeliveryRouteError(
    404,
    'Stop not found',
    'Dieser Stopp existiert nicht.'
  )
}

/** Sortiert `tour.stops` nach einer ID-Liste; nicht genannte bleiben hinten (Mock). */
function applyStopOrder(tour: PlainTour, order: number[]): void {
  const rank = new Map(order.map((id, index) => [Number(id), index]))
  tour.stops.sort((a, b) => {
    const ra = rank.has(a.id)
      ? (rank.get(a.id) as number)
      : Number.MAX_SAFE_INTEGER
    const rb = rank.has(b.id)
      ? (rank.get(b.id) as number)
      : Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

/**
 * `recalculateTour()` des Mocks auf einer Kopie: optional die Reihenfolge der
 * offenen Stopps, immer Strecke und Dauer. Mit Zeitfenstern sortiert der Core
 * (OSRMs Trip kennt keine), OSRM misst nur; ohne OSRM Schätzformeln.
 */
export async function recalculateTour(
  source: PlainTour,
  depot: PlainDepot,
  optimize: boolean,
  geo: GeoServices,
  now: Date = new Date()
): Promise<PlainTour> {
  const tour: PlainTour = JSON.parse(JSON.stringify(source))
  const open = tour.stops.filter((s) => s.status === 'open')
  const reorder = optimize && open.length > 0
  const windowed =
    reorder && open.some((s) => core.parseTimeWindow(s.timeWindow) !== null)
  if (windowed) {
    const baseline = core.arrivalBaseline(depot, tour, now.getTime())
    const ordered = core.orderStopsNearestNeighbour(baseline.origin, open, {
      startedAt: baseline.startedAt,
      vehicleType: tour.vehicleType,
      date: tour.date,
    })
    tour.stops = core.applyOpenStopOrder(
      tour.stops,
      ordered.map((s: PlainStop) => s.id)
    )
  }
  const openNow = tour.stops.filter((s) => s.status === 'open')
  const routable = openNow.length > 0 ? openNow : tour.stops

  let routed: RoutedTour | null = null
  try {
    routed = await geo.routeTour(depot, routable, {
      optimize: reorder && !windowed,
      vehicleType: tour.vehicleType,
    })
  } catch {
    routed = null
  }

  if (routed) {
    if (reorder && !windowed && routed.order.length > 0) {
      tour.stops = core.applyOpenStopOrder(tour.stops, routed.order)
    }
    tour.distance = routed.distance
    tour.duration = routed.duration
    tour.geometry = routed.geometry
    tour.isEstimate = false
  } else {
    if (reorder && !windowed) {
      const baseline = core.arrivalBaseline(depot, tour, now.getTime())
      const ordered = core.orderStopsNearestNeighbour(baseline.origin, open, {
        startedAt: baseline.startedAt,
        vehicleType: tour.vehicleType,
        date: tour.date,
      })
      tour.stops = core.applyOpenStopOrder(
        tour.stops,
        ordered.map((s: PlainStop) => s.id)
      )
    }
    const estimate = core.estimateTour(
      depot,
      tour.stops.filter((s) => s.status === 'open'),
      tour.vehicleType
    )
    tour.distance = estimate.distance
    tour.duration = estimate.duration
    tour.geometry = null
    tour.isEstimate = true
  }
  tour.routedAt = now.toISOString()
  return tour
}

/** `decorateTour()` des Mocks. */
function decorateTour(
  tour: PlainTour,
  depot: PlainDepot,
  drivers: Map<number, PlainDriver>,
  points: Map<string, PickupPointDto>,
  handover: Map<string, Record<string, unknown>[]>,
  now: number
): DecoratedTour {
  const progress = core.tourProgress(tour)
  const next = core.nextOpenStop(tour)
  const baseline = core.arrivalBaseline(depot, tour, now)
  const arrivals = core.estimateArrivalDetails(
    baseline.origin,
    tour.stops.filter((s) => s.status === 'open'),
    baseline.startedAt,
    tour.vehicleType,
    tour.date
  )
  return {
    ...tour,
    depot: mockDepot(depot),
    driver: tour.driverId ? drivers.get(tour.driverId) ?? null : null,
    progress,
    nextStopId: next ? next.id : null,
    stops: tour.stops.map((stop) => {
      const arrival = arrivals[stop.id] || null
      const extra: Record<string, unknown> = {}
      if (stop.pickupPointId) {
        const list = handover.get(`${stop.pickupPointId}|${tour.date}`) ?? []
        extra['pickupPoint'] = points.get(stop.pickupPointId) ?? null
        extra['preorders'] = list
        extra['preorderSummary'] = preordersCore.summarizePreorders(list)
      }
      return {
        ...stop,
        address: core.formatAddress(stop),
        estimatedArrival: arrival ? arrival.arrival : null,
        waitSeconds: arrival ? arrival.waitSeconds : null,
        missesTimeWindow: arrival ? arrival.missesTimeWindow : false,
        ...extra,
      }
    }),
  }
}

/**
 * Depot in der Mock-Form: `geocodeSource`/`geocodePrecision` nur, wenn
 * gesetzt (der Seed des Mocks hat sie nicht).
 */
export function mockDepot(depot: PlainDepot): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: depot.name,
    street: depot.street,
    zip: depot.zip,
    city: depot.city,
    phone: depot.phone,
    lat: depot.lat,
    lon: depot.lon,
  }
  if (depot.geocodeSource) out['geocodeSource'] = depot.geocodeSource
  if (depot.geocodePrecision) out['geocodePrecision'] = depot.geocodePrecision
  return out
}

export { isFailure }
