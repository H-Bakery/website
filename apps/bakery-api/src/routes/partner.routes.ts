/**
 * Verkaufspartner-Routen (TASK-037, B6) - Backschrank beim CAP-Markt.
 *
 * Erfasst werden *Besuche* am Regal, nicht Lieferungen: jeder Besuch hält
 * fest, was noch dalag (`countedQty`) und was neu eingeräumt wurde
 * (`deliveredQty`). Verkauf und Umsatz werden daraus abgeleitet - sie werden
 * nie erfasst. Gerechnet wird ausschließlich im `partner-stats.service`
 * (der wiederum an `partner-stats.core.js` delegiert), damit API, Import
 * und Tests dieselben Formeln benutzen.
 *
 * Rollen (B6, D5) - die Sitzung selbst prüft der globale Guard in `app.ts`:
 *   lesen (GET)                          jede Sitzung
 *   Besuche erfassen/korrigieren/löschen inhaber, verkauf, fahrer
 *   Partner-Stammdaten, Standard-Bestückung  inhaber
 *
 * Produkte der Besuche kommen aus dem hq-Katalog (B5, `hq-catalogue.ts`,
 * freigegebener Stand): Name, Kennungen und - wenn der Request keinen
 * schickt - der Preis werden als Snapshot gespeichert, ein Produkt außerhalb
 * des Katalogs wird abgelehnt (wie im Mock). Beim Korrigieren gilt der
 * Snapshot des gespeicherten Besuchs zusätzlich als bekannt.
 *
 * Jeder Schreibzugriff landet mit dem Benutzer im `audit_log` (D5).
 * Fehlerantworten über `sendError`: `error` (Code) **und** `message`.
 */

import { Request, Response, Router } from 'express'
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { requireRole } from '../auth/middleware'
import {
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
  getSequelize,
} from '../models'
import {
  HqCatalogue,
  HqProduct,
  catalogueFor,
  defaultProductsDir,
} from '../services/hq-catalogue'
import * as partnerStats from '../services/partner-stats.service'
import { PlainVisit, StatsRange } from '../services/partner-stats.service'
import { sendError } from '../utils/http-error'
import { logger } from '../utils/logger'

// Der Core ist absichtlich CommonJS ohne Typen - deshalb per require geladen.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const partnerRules = require('../services/partner-import.core')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const controlChars = require('../services/control-chars.core')

// ============================================================================
// OPTIONEN UND ROLLEN
// ============================================================================

export interface PartnerRouterOptions {
  /**
   * Lese-Klon der hq-Produkte (Default `HQ_PRODUCTS_DIR`, s. `hq-catalogue`).
   * `createApp()` reicht das Verzeichnis der hq-Produkte durch, damit
   * Produkte und Partner denselben Katalog sehen.
   */
  productsDir?: string
}

/** Besuche erfassen, korrigieren, löschen. `inhaber` darf immer. */
export const VISIT_WRITE_ROLES = ['verkauf', 'fahrer'] as const
/** Stammdaten und Vorlagen: nur `inhaber`. */
const MASTER_DATA_ROLES = ['inhaber'] as const

const canWriteVisits = requireRole(...VISIT_WRITE_ROLES)
const canWriteMasterData = requireRole(...MASTER_DATA_ROLES)

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

/** Liefertage eines neuen Partners ohne Angabe - wie im Mock: Di-Sa. */
const DEFAULT_DELIVERY_DAYS = [2, 3, 4, 5, 6]

interface TemplateItemInput {
  productId: number
  productSlug: string
  quantity: number
}

type VisitItemInput = partnerStats.PlainVisitItem

/**
 * Erwarteter Abbruch innerhalb einer Transaktion (z. B. doppelte
 * Erstbestückung): rollt zurück und wird mit `status`/`code` beantwortet.
 */
class RouteError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

/** `:id`/`:visitId` müssen positive Ganzzahlen sein - sonst 404. */
function parseNumericId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Kalendarisch gültig - die Prüfung steht im Core (`partner-stats.core.js`). */
const isBusinessDate = partnerStats.isBusinessDate

/**
 * `active` nur aus einem echten Boolean - `Boolean('false')` wäre `true`.
 * @returns `null`, wenn der Wert unbrauchbar ist
 */
function parseActive(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** Nicht-leerer Name aus einem String (wie im Mock), sonst `null`. */
function partnerName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name === '' ? null : name
}

/**
 * Längengrenzen der Freitextfelder (W4-Verifikation: vorher nahm die API
 * 100.000 Zeichen als Name an). Wie bei Vorbestellungen und Benutzern.
 */
const PARTNER_TEXT_LIMITS: ReadonlyArray<[string, string, number]> = [
  ['name', 'Der Name', 120],
  ['slug', 'Das Kürzel', 80],
  ['street', 'Die Straße', 120],
  ['zip', 'Die Postleitzahl', 16],
  ['city', 'Der Ort', 120],
  ['contactName', 'Der Ansprechpartner', 120],
  ['phone', 'Die Telefonnummer', 40],
  ['email', 'Die E-Mail-Adresse', 200],
  ['notes', 'Die Notiz', 2000],
]
const VISIT_TEXT_LIMITS: ReadonlyArray<[string, string, number]> = [
  ['staffName', 'Der Name der erfassenden Person', 120],
  ['note', 'Die Notiz', 2000],
]

/** Erstes zu langes Feld als deutsche Meldung, sonst `null`. */
function textTooLong(
  body: Record<string, unknown>,
  limits: ReadonlyArray<[string, string, number]>
): string | null {
  for (const [field, label, max] of limits) {
    const value = body[field]
    if (value === undefined || value === null) continue
    if (String(value).trim().length > max) {
      return `${label} ist zu lang - höchstens ${max} Zeichen.`
    }
  }
  return null
}

/** Freitextfelder: Zeilenumbruch und Tab erlaubt, sonst wie ein Name. */
const MULTILINE_FIELDS = new Set(['notes', 'note'])

/**
 * Steuerzeichen (NUL, Bidi-Umkehr …) in Stammdaten und Besuchen - dieselbe
 * Regel wie bei Vorbestellungen, Produkten und Benutzern (W4-verify r2).
 */
function textHasControlChars(
  body: Record<string, unknown>,
  limits: ReadonlyArray<[string, string, number]>
): string | null {
  for (const [field, label] of limits) {
    const value = body[field]
    if (typeof value !== 'string') continue
    const bad = MULTILINE_FIELDS.has(field)
      ? controlChars.hasTextControlChars(value)
      : controlChars.hasNameControlChars(value)
    if (bad) return `${label} enthält unzulässige Steuerzeichen.`
  }
  return null
}

/** Frühester und spätester Geschäftstag eines Besuchs (relativ zu heute). */
const EARLIEST_VISIT_DATE = '2020-01-01'
const MAX_VISIT_DAYS_AHEAD = 7

/**
 * Ein Besuch liegt in der Vergangenheit oder ganz nahe Zukunft - 9999-12-31
 * ist ein Tippfehler, keine Erstbestückung (W4-Verifikation).
 */
function visitDateOutOfRange(businessDate: string): string | null {
  const today = partnerStats.businessDateOf(new Date()) || ''
  const latest = shiftDate(today, MAX_VISIT_DAYS_AHEAD)
  if (businessDate < EARLIEST_VISIT_DATE || businessDate > latest) {
    return `Der Geschäftstag ${formatDe(
      businessDate
    )} liegt außerhalb des erlaubten Zeitraums (${formatDe(
      EARLIEST_VISIT_DATE
    )} bis ${formatDe(latest)}).`
  }
  return null
}

/** Wie weit der Zeitpunkt vom Geschäftstag abweichen darf (Tage). */
const MAX_VISIT_AT_DRIFT_DAYS = 1

/**
 * W4-verify r2: `visitAt` 9999-12-31 auf dem Geschäftstag 11.11.2026 machte
 * den Besuch für den Bestands-Automaten zum letzten des Tages. Der Zeitpunkt
 * muss deshalb auf dem Geschäftstag liegen - einen Tag Spielraum für
 * Nachträge um Mitternacht.
 */
function visitAtOffBusinessDate(
  visitAt: Date,
  businessDate: string
): string | null {
  const day = partnerStats.businessDateOf(visitAt) || ''
  if (
    day < shiftDate(businessDate, -MAX_VISIT_AT_DRIFT_DAYS) ||
    day > shiftDate(businessDate, MAX_VISIT_AT_DRIFT_DAYS)
  ) {
    return `Der Zeitpunkt (${
      day ? formatDe(day) : 'ungültig'
    }) passt nicht zum Geschäftstag ${formatDe(
      businessDate
    )} - bitte Datum und Uhrzeit des Besuchs prüfen.`
  }
  return null
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

/** `2026-08-30` → `30.08.2026` für Meldungen an das Team. */
function formatDe(businessDate: string): string {
  const [year, month, day] = businessDate.split('-')
  return `${day}.${month}.${year}`
}

/** Slug und Wochentage: dieselben Regeln wie der Import (`partner-import.core.js`). */
const slugify: (value: string) => string = partnerRules.slugify
const normalizeWeekdays: (value: unknown) => number[] =
  partnerRules.normalizeWeekdays

/** Gespeicherte Vorlagen-Positionen lesen (JSON-Spalte, evtl. als Text). */
function storedTemplateItems(value: unknown): TemplateItemInput[] {
  let raw: any = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: any) => ({
      productId: toInt(item?.productId, 0),
      productSlug: String(item?.productSlug || '').trim(),
      quantity: Math.max(0, toInt(item?.quantity, 0)),
    }))
    .filter((item: TemplateItemInput) => item.productSlug !== '')
}

/** Produkt aus dem hq-Katalog: erst per Slug, dann per `numeric_id` (wie der Mock). */
function findCatalogueProduct(
  catalogue: HqCatalogue,
  item: Record<string, unknown> | null | undefined
): Readonly<HqProduct> | null {
  if (!item || typeof item !== 'object') return null
  const slug =
    typeof item['productSlug'] === 'string' ? item['productSlug'].trim() : ''
  if (slug) {
    const bySlug = catalogue.list().find((p) => p.id === slug)
    if (bySlug) return bySlug
  }
  const rawId = item['productId']
  const numericId =
    typeof rawId === 'number' || (typeof rawId === 'string' && rawId !== '')
      ? Number(rawId)
      : NaN
  if (Number.isInteger(numericId) && numericId > 0) {
    return catalogue.get(numericId)
  }
  return null
}

type TemplateItemsResult =
  | { ok: true; items: TemplateItemInput[] }
  | { ok: false; status: number; error: string; message: string }

/**
 * Positionen der Standard-Bestückung - Kennungen aus dem hq-Katalog,
 * Positionen ohne Produkt oder mit Menge 0 entfallen (Regeln des Mocks).
 * Seit der W4-Verifikation zusätzlich wie bei Besuchen geprüft
 * (`validateTemplateItems` im Core): Menge ganzzahlig 0…10000, Produkt im
 * Katalog - oder schon in der gespeicherten Vorlage, damit ein aus hq
 * verschwundenes Produkt das Speichern nicht blockiert. Fehlt hq ganz: 503.
 */
function normalizeTemplateInput(
  items: unknown,
  catalogue: HqCatalogue,
  existingItems: TemplateItemInput[]
): TemplateItemsResult {
  const fromExisting = partnerStats.snapshotLookup(existingItems)
  let unresolved = false
  const result = partnerStats.validateTemplateItems(items, (item) => {
    const product =
      findCatalogueProduct(catalogue, item) ?? fromExisting(item) ?? null
    if (!product) unresolved = true
    return product
  })
  if (result.ok === false) {
    if (unresolved && !catalogue.available()) {
      return {
        ok: false,
        status: 503,
        error: 'hq_unavailable',
        message:
          'Der Produktkatalog aus hq ist gerade nicht erreichbar - die Vorlage kann nicht gespeichert werden. Bitte später erneut versuchen.',
      }
    }
    return {
      ok: false,
      status: 400,
      error: result.error,
      message: result.message,
    }
  }
  return { ok: true, items: result.items }
}

type ItemsResult =
  | { ok: true; items: VisitItemInput[] }
  | { ok: false; status: number; error: string; message: string }

/**
 * Positionen eines Besuchs prüfen und normalisieren - die Regeln stehen im
 * Core (`validateVisitItems`): Rest `null` bleibt "nicht gezählt" und ist
 * etwas anderes als `0`, Mengen sind ganzzahlig und begrenzt, negative Preise
 * fliegen raus, Produkte außerhalb des hq-Katalogs auch. Name und Kennungen
 * kommen aus dem Katalog, der Preis auch, wenn der Request keinen schickt.
 *
 * Beim Korrigieren gilt der Snapshot des gespeicherten Besuchs zusätzlich als
 * bekannt - ein inzwischen aus hq verschwundenes Produkt bleibt korrigierbar.
 *
 * Fehlt das hq-Verzeichnis ganz, ist ein "unbekanntes Produkt" kein
 * Eingabefehler, sondern ein Betriebsproblem: 503 `hq_unavailable`.
 */
function normalizeVisitItems(
  value: unknown,
  catalogue: HqCatalogue,
  existingItems?: ReadonlyArray<Partial<VisitItemInput>>
): ItemsResult {
  const fromSnapshot = partnerStats.snapshotLookup(existingItems)
  let unresolved = false
  const result = partnerStats.validateVisitItems(value, (item) => {
    const product =
      findCatalogueProduct(catalogue, item) ?? fromSnapshot(item) ?? null
    if (!product) unresolved = true
    return product
  })
  if (result.ok === false) {
    if (unresolved && !catalogue.available()) {
      return {
        ok: false,
        status: 503,
        error: 'hq_unavailable',
        message:
          'Der Produktkatalog aus hq ist gerade nicht erreichbar - der Besuch kann nicht gespeichert werden. Bitte später erneut versuchen.',
      }
    }
    return {
      ok: false,
      status: 400,
      error: 'INVALID_ITEMS',
      message: result.message,
    }
  }
  return { ok: true, items: result.items }
}

function serializePartner(row: any): Record<string, any> {
  const partner = typeof row?.toJSON === 'function' ? row.toJSON() : row || {}
  return {
    id: partner.id,
    name: partner.name || '',
    slug: partner.slug || '',
    street: partner.street || '',
    zip: partner.zip || '',
    city: partner.city || '',
    contactName: partner.contactName ?? null,
    phone: partner.phone ?? null,
    email: partner.email ?? null,
    deliveryDays: normalizeWeekdays(partner.deliveryDays),
    settlementModel:
      partner.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission',
    active: partner.active !== false,
    notes: partner.notes ?? null,
  }
}

function serializeTemplate(row: any): Record<string, any> {
  const template = typeof row?.toJSON === 'function' ? row.toJSON() : row || {}
  return {
    id: template.id,
    partnerId: template.partnerId,
    weekday: toInt(template.weekday, 0),
    items: storedTemplateItems(template.items),
    active: template.active !== false,
  }
}

/** Partner laden oder mit deutschem 404 antworten. */
async function loadPartner(
  req: Request,
  res: Response
): Promise<Partner | null> {
  const id = parseNumericId(req.params['id'])
  if (id === null) {
    sendError(
      res,
      404,
      'PARTNER_NOT_FOUND',
      'Verkaufspartner nicht gefunden - die Kennung muss eine Zahl sein.'
    )
    return null
  }
  const partner = await Partner.findByPk(id)
  if (!partner) {
    sendError(
      res,
      404,
      'PARTNER_NOT_FOUND',
      `Verkaufspartner mit der Kennung ${id} wurde nicht gefunden.`
    )
    return null
  }
  return partner
}

/** Besuch eines Partners laden oder mit deutschem 404 antworten. */
async function loadVisit(
  partnerId: number,
  req: Request,
  res: Response
): Promise<PartnerVisit | null> {
  const visitId = parseNumericId(req.params['visitId'])
  if (visitId === null) {
    sendError(
      res,
      404,
      'VISIT_NOT_FOUND',
      'Besuch nicht gefunden - die Kennung muss eine Zahl sein.'
    )
    return null
  }
  const visit = await PartnerVisit.findOne({
    where: { id: visitId, partnerId },
    include: [{ model: PartnerVisitItem, as: 'items' }],
  })
  if (!visit) {
    sendError(
      res,
      404,
      'VISIT_NOT_FOUND',
      `Besuch mit der Kennung ${visitId} wurde für diesen Verkaufspartner nicht gefunden.`
    )
    return null
  }
  return visit
}

/** `?from=`/`?to=` prüfen; `null` = es wurde bereits mit 400 geantwortet. */
function parseRange(req: Request, res: Response): StatsRange | null {
  const from = typeof req.query['from'] === 'string' ? req.query['from'] : ''
  const to = typeof req.query['to'] === 'string' ? req.query['to'] : ''
  if (from && !isBusinessDate(from)) {
    sendError(
      res,
      400,
      'INVALID_RANGE',
      'Ungültiges Startdatum - erwartet wird das Format JJJJ-MM-TT.'
    )
    return null
  }
  if (to && !isBusinessDate(to)) {
    sendError(
      res,
      400,
      'INVALID_RANGE',
      'Ungültiges Enddatum - erwartet wird das Format JJJJ-MM-TT.'
    )
    return null
  }
  if (from && to && from > to) {
    sendError(
      res,
      400,
      'INVALID_RANGE',
      'Das Startdatum liegt nach dem Enddatum - bitte den Zeitraum prüfen.'
    )
    return null
  }
  return { from: from || null, to: to || null }
}

/** Besuche eines Partners im Zeitraum, chronologisch, samt Positionen. */
async function loadVisits(
  partnerId: number,
  range: StatsRange
): Promise<PlainVisit[]> {
  const where: any = { partnerId }
  if (range.from && range.to) {
    where.businessDate = { [Op.between]: [range.from, range.to] }
  } else if (range.from) {
    where.businessDate = { [Op.gte]: range.from }
  } else if (range.to) {
    where.businessDate = { [Op.lte]: range.to }
  }

  const rows = await PartnerVisit.findAll({
    where,
    include: [{ model: PartnerVisitItem, as: 'items' }],
    order: [
      ['businessDate', 'ASC'],
      ['sequence', 'ASC'],
      ['visitAt', 'ASC'],
    ],
  })
  return partnerStats.toPlainVisits(rows)
}

async function loadVisitWithItems(visitId: number): Promise<PlainVisit> {
  const row = await PartnerVisit.findByPk(visitId, {
    include: [{ model: PartnerVisitItem, as: 'items' }],
  })
  return partnerStats.toPlainVisit(row)
}

/** Angemeldete Person (globaler Guard) - jeder Besuch wird ihr zugeordnet. */
function currentUserId(req: Request): number | null {
  const id = Number(req.user?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Pro Geschäftstag und Partner genau eine Erstbestückung. Läuft **in** der
 * (serialisierten) Schreib-Transaktion - zwei gleichzeitige Erfassungen
 * können so nicht beide durch die Prüfung kommen.
 */
async function assertNoOtherInitial(
  partnerId: number,
  businessDate: string,
  exceptVisitId: number | null,
  transaction: Transaction,
  hint: string
): Promise<void> {
  const where: any = { partnerId, businessDate, visitType: 'initial' }
  if (exceptVisitId !== null) where.id = { [Op.ne]: exceptVisitId }
  const duplicates = await PartnerVisit.count({ where, transaction })
  if (duplicates > 0) {
    throw new RouteError(
      409,
      'DUPLICATE_INITIAL_VISIT',
      `Für den ${formatDe(
        businessDate
      )} ist bereits eine Erstbestückung erfasst. ${hint}`
    )
  }
}

/** Nächste laufende Nummer im Geschäftstag (ohne den Besuch selbst). */
async function nextSequence(
  partnerId: number,
  businessDate: string,
  exceptVisitId: number | null,
  transaction: Transaction
): Promise<number> {
  const where: any = { partnerId, businessDate }
  if (exceptVisitId !== null) where.id = { [Op.ne]: exceptVisitId }
  const maxSequence = await PartnerVisit.max('sequence', { where, transaction })
  return Math.max(0, toInt(maxSequence, 0)) + 1
}

/** Slug darf kein anderer Partner haben - Prüfung in der Transaktion. */
async function assertSlugFree(
  slug: string,
  exceptId: number | null,
  transaction: Transaction
): Promise<void> {
  const where: any = { slug }
  if (exceptId !== null) where.id = { [Op.ne]: exceptId }
  const taken = await Partner.findOne({ where, transaction })
  if (taken) {
    throw new RouteError(
      409,
      'PARTNER_SLUG_TAKEN',
      `Es gibt bereits einen Verkaufspartner mit dem Kürzel "${slug}".`
    )
  }
}

/** Fehler aus einem Handler beantworten: erwartete mit Code, sonst 500. */
function answerError(
  res: Response,
  error: unknown,
  fallback: { code: string; message: string; log: string }
): Response {
  if (error instanceof RouteError) {
    return sendError(res, error.status, error.code, error.message)
  }
  logger.error(fallback.log, error)
  return sendError(res, 500, fallback.code, fallback.message)
}

/** Byte-Order-Mark vor dem CSV (als Escape, nie als unsichtbares Zeichen). */
const BOM = String.fromCharCode(0xfeff)

const INVALID_ACTIVE_MESSAGE =
  'Das Feld "active" muss true oder false sein (kein Text).'

// ============================================================================
// ROUTER
// ============================================================================

export function createPartnerRouter(
  options: PartnerRouterOptions = {}
): Router {
  const router = Router()
  const catalogue = (): HqCatalogue =>
    catalogueFor(options.productsDir ?? defaultProductsDir())

  // ==========================================================================
  // PARTNER
  // ==========================================================================

  // Alle Verkaufspartner, optional `?active=true|false` (wie der Mock)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const where: any = {}
      const active = req.query['active']
      if (active !== undefined) where.active = active === 'true'
      const partners = await Partner.findAll({
        where,
        order: [['name', 'ASC']],
      })
      return res.json(partners.map(serializePartner))
    } catch (error) {
      return answerError(res, error, {
        code: 'PARTNERS_LOAD_FAILED',
        message: 'Die Verkaufspartner konnten nicht geladen werden.',
        log: 'Failed to load sales partners',
      })
    }
  })

  // Verkaufspartner anlegen (inhaber)
  router.post('/', canWriteMasterData, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as any
      const name = partnerName(body.name)
      if (!name) {
        return sendError(
          res,
          400,
          'INVALID_NAME',
          'Der Name des Verkaufspartners fehlt.'
        )
      }
      const tooLong = textTooLong(body, PARTNER_TEXT_LIMITS)
      if (tooLong) return sendError(res, 400, 'TEXT_TOO_LONG', tooLong)
      const control = textHasControlChars(body, PARTNER_TEXT_LIMITS)
      if (control) return sendError(res, 400, 'INVALID_TEXT', control)

      const slug = slugify(body.slug ? String(body.slug) : name)
      if (!slug) {
        return sendError(
          res,
          400,
          'INVALID_SLUG',
          'Aus dem Namen ließ sich kein Kürzel bilden - bitte ein Kürzel angeben.'
        )
      }

      const active = body.active === undefined ? true : parseActive(body.active)
      if (active === null) {
        return sendError(res, 400, 'INVALID_ACTIVE', INVALID_ACTIVE_MESSAGE)
      }

      const partner = await getSequelize().transaction(async (transaction) => {
        await assertSlugFree(slug, null, transaction)
        const created = await Partner.create(
          {
            name,
            slug,
            street: String(body.street || ''),
            zip: String(body.zip || ''),
            city: String(body.city || ''),
            contactName: optionalString(body.contactName),
            phone: optionalString(body.phone),
            email: optionalString(body.email),
            deliveryDays:
              body.deliveryDays === undefined
                ? [...DEFAULT_DELIVERY_DAYS]
                : normalizeWeekdays(body.deliveryDays),
            settlementModel:
              body.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission',
            active,
            notes: optionalString(body.notes),
          },
          { transaction }
        )
        await audit(
          req,
          'create',
          'partner',
          created.id,
          { slug },
          { transaction }
        )
        return created
      })

      logger.info(`Sales partner created: ${partner.slug}`)
      return res.status(201).json(serializePartner(partner))
    } catch (error) {
      return answerError(res, error, {
        code: 'PARTNER_CREATE_FAILED',
        message: 'Der Verkaufspartner konnte nicht angelegt werden.',
        log: 'Failed to create sales partner',
      })
    }
  })

  // Ein Verkaufspartner
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return
      return res.json(serializePartner(partner))
    } catch (error) {
      return answerError(res, error, {
        code: 'PARTNER_LOAD_FAILED',
        message: 'Der Verkaufspartner konnte nicht geladen werden.',
        log: 'Failed to load sales partner',
      })
    }
  })

  // Verkaufspartner bearbeiten (inhaber)
  router.put(
    '/:id',
    canWriteMasterData,
    async (req: Request, res: Response) => {
      try {
        const partner = await loadPartner(req, res)
        if (!partner) return

        const body = (req.body || {}) as any
        const updates: any = {}
        const tooLong = textTooLong(body, PARTNER_TEXT_LIMITS)
        if (tooLong) return sendError(res, 400, 'TEXT_TOO_LONG', tooLong)
        const control = textHasControlChars(body, PARTNER_TEXT_LIMITS)
        if (control) return sendError(res, 400, 'INVALID_TEXT', control)

        if (body.name !== undefined) {
          const name = partnerName(body.name)
          if (!name) {
            return sendError(
              res,
              400,
              'INVALID_NAME',
              'Der Name des Verkaufspartners darf nicht leer sein.'
            )
          }
          updates.name = name
        }

        if (body.slug !== undefined) {
          const slug = slugify(String(body.slug))
          if (!slug) {
            return sendError(
              res,
              400,
              'INVALID_SLUG',
              'Das Kürzel darf nicht leer sein.'
            )
          }
          updates.slug = slug
        }

        if (body.street !== undefined)
          updates.street = String(body.street || '')
        if (body.zip !== undefined) updates.zip = String(body.zip || '')
        if (body.city !== undefined) updates.city = String(body.city || '')
        if (body.contactName !== undefined) {
          updates.contactName = optionalString(body.contactName)
        }
        if (body.phone !== undefined) updates.phone = optionalString(body.phone)
        if (body.email !== undefined) updates.email = optionalString(body.email)
        if (body.deliveryDays !== undefined) {
          updates.deliveryDays = normalizeWeekdays(body.deliveryDays)
        }
        if (body.settlementModel !== undefined) {
          if (
            body.settlementModel !== 'commission' &&
            body.settlementModel !== 'firm_sale'
          ) {
            return sendError(
              res,
              400,
              'INVALID_SETTLEMENT_MODEL',
              'Unbekanntes Abrechnungsmodell - erlaubt sind "commission" (Kommission) und "firm_sale" (Festkauf).'
            )
          }
          updates.settlementModel = body.settlementModel
        }
        if (body.active !== undefined) {
          const active = parseActive(body.active)
          if (active === null) {
            return sendError(res, 400, 'INVALID_ACTIVE', INVALID_ACTIVE_MESSAGE)
          }
          updates.active = active
        }
        if (body.notes !== undefined) updates.notes = optionalString(body.notes)

        await getSequelize().transaction(async (transaction) => {
          if (updates.slug !== undefined && updates.slug !== partner.slug) {
            await assertSlugFree(updates.slug, partner.id, transaction)
          }
          await partner.update(updates, { transaction })
          await audit(
            req,
            'update',
            'partner',
            partner.id,
            // Nur die Feldnamen - Kontaktdaten gehören nicht ins Protokoll.
            { fields: Object.keys(updates).sort() },
            { transaction }
          )
        })
        logger.info(`Sales partner updated: ${partner.slug}`)
        return res.json(serializePartner(partner))
      } catch (error) {
        return answerError(res, error, {
          code: 'PARTNER_UPDATE_FAILED',
          message: 'Der Verkaufspartner konnte nicht gespeichert werden.',
          log: 'Failed to update sales partner',
        })
      }
    }
  )

  // ==========================================================================
  // STANDARD-BESTÜCKUNG (Vorlagen je Wochentag)
  // ==========================================================================

  router.get('/:id/templates', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const templates = await PartnerDeliveryTemplate.findAll({
        where: { partnerId: partner.id },
        order: [['weekday', 'ASC']],
      })
      return res.json(templates.map(serializeTemplate))
    } catch (error) {
      return answerError(res, error, {
        code: 'TEMPLATES_LOAD_FAILED',
        message: 'Die Standard-Bestückung konnte nicht geladen werden.',
        log: 'Failed to load partner delivery templates',
      })
    }
  })

  // Vorlage eines Wochentags speichern (inhaber). 200 auch beim Anlegen (Mock).
  router.put(
    '/:id/templates/:weekday',
    canWriteMasterData,
    async (req: Request, res: Response) => {
      try {
        const partner = await loadPartner(req, res)
        if (!partner) return

        const weekday = Number(req.params['weekday'])
        if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
          return sendError(
            res,
            400,
            'INVALID_WEEKDAY',
            'Ungültiger Wochentag - erlaubt sind 1 (Montag) bis 7 (Sonntag).'
          )
        }

        const body = (req.body || {}) as any
        if (body.items !== undefined && !Array.isArray(body.items)) {
          return sendError(
            res,
            400,
            'INVALID_ITEMS',
            'Die Vorlage braucht eine Liste von Positionen (items).'
          )
        }
        let active: boolean | null | undefined
        if (body.active !== undefined) {
          active = parseActive(body.active)
          if (active === null) {
            return sendError(res, 400, 'INVALID_ACTIVE', INVALID_ACTIVE_MESSAGE)
          }
        }

        const stored = await PartnerDeliveryTemplate.findOne({
          where: { partnerId: partner.id, weekday },
        })
        // Teil-Update: nur ein gesendetes `items` ersetzt die Posten; ohne
        // `items` (z. B. nur `{ active: false }`) bleiben sie stehen.
        const keepItems = body.items === undefined && stored !== null
        let items: TemplateItemInput[]
        if (keepItems) {
          items = storedTemplateItems(stored.items)
        } else {
          const checked = normalizeTemplateInput(
            body.items || [],
            catalogue(),
            stored ? storedTemplateItems(stored.items) : []
          )
          if (checked.ok === false) {
            return sendError(
              res,
              checked.status,
              checked.error,
              checked.message
            )
          }
          items = checked.items
        }

        const template = await getSequelize().transaction(
          async (transaction) => {
            const existing = await PartnerDeliveryTemplate.findOne({
              where: { partnerId: partner.id, weekday },
              transaction,
            })
            let saved: PartnerDeliveryTemplate
            if (existing) {
              // `active` bleibt stehen, wenn der Request es nicht nennt.
              const updates: any = keepItems ? {} : { items }
              if (active !== undefined) updates.active = active
              saved = await existing.update(updates, { transaction })
            } else {
              saved = await PartnerDeliveryTemplate.create(
                {
                  partnerId: partner.id,
                  weekday,
                  items,
                  active: active ?? true,
                },
                { transaction }
              )
            }
            await audit(
              req,
              existing ? 'update' : 'create',
              'partner_template',
              saved.id,
              { partnerId: partner.id, weekday, itemCount: items.length },
              { transaction }
            )
            return saved
          }
        )
        logger.info(
          `Partner template saved: partner=${partner.id} weekday=${weekday}`
        )
        return res.json(serializeTemplate(template))
      } catch (error) {
        return answerError(res, error, {
          code: 'TEMPLATE_SAVE_FAILED',
          message: 'Die Standard-Bestückung konnte nicht gespeichert werden.',
          log: 'Failed to save partner delivery template',
        })
      }
    }
  )

  // ==========================================================================
  // BESUCHE
  // ==========================================================================

  // Besuche im Zeitraum
  router.get('/:id/visits', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const range = parseRange(req, res)
      if (!range) return

      return res.json(await loadVisits(partner.id, range))
    } catch (error) {
      return answerError(res, error, {
        code: 'VISITS_LOAD_FAILED',
        message: 'Die Besuche konnten nicht geladen werden.',
        log: 'Failed to load partner visits',
      })
    }
  })

  // Tagesansicht: Timeline, Kennzahlen und die Rohdaten des Geschäftstags
  router.get('/:id/visits/today', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const requested =
        typeof req.query['date'] === 'string' ? req.query['date'] : ''
      if (requested && !isBusinessDate(requested)) {
        return sendError(
          res,
          400,
          'INVALID_BUSINESS_DATE',
          'Ungültiger Geschäftstag - erwartet wird das Format JJJJ-MM-TT.'
        )
      }
      const businessDate =
        requested || partnerStats.businessDateOf(new Date()) || ''

      const visits = await loadVisits(partner.id, {
        from: businessDate,
        to: businessDate,
      })
      const detail = partnerStats.getDayDetail(visits)

      return res.json({
        ...detail,
        // Ohne Besuche kennt der Core den Tag nicht - der angefragte gilt.
        businessDate: detail.businessDate || businessDate,
        visits,
      })
    } catch (error) {
      return answerError(res, error, {
        code: 'DAY_LOAD_FAILED',
        message: 'Der Geschäftstag konnte nicht geladen werden.',
        log: 'Failed to load partner day detail',
      })
    }
  })

  // Besuch erfassen (inhaber, verkauf, fahrer)
  router.post(
    '/:id/visits',
    canWriteVisits,
    async (req: Request, res: Response) => {
      try {
        const partner = await loadPartner(req, res)
        if (!partner) return

        const body = (req.body || {}) as any

        if (!partnerStats.isVisitType(body.visitType)) {
          return sendError(
            res,
            400,
            'INVALID_VISIT_TYPE',
            'Unbekannter Besuchstyp - erlaubt sind "initial" (Erstbestückung), "refill" (Nachlieferung) und "pickup" (Abholung).'
          )
        }
        const visitType = body.visitType

        const visitAt = body.visitAt ? new Date(body.visitAt) : new Date()
        if (Number.isNaN(visitAt.getTime())) {
          return sendError(
            res,
            400,
            'INVALID_VISIT_AT',
            'Ungültiger Zeitpunkt - bitte Datum und Uhrzeit des Besuchs prüfen.'
          )
        }

        // Der Geschäftstag wird aus dem Zeitpunkt abgeleitet, wenn er fehlt.
        const businessDate =
          body.businessDate === undefined || body.businessDate === null
            ? partnerStats.businessDateOf(visitAt)
            : body.businessDate
        if (!isBusinessDate(businessDate)) {
          return sendError(
            res,
            400,
            'INVALID_BUSINESS_DATE',
            'Ungültiger Geschäftstag - erwartet wird das Format JJJJ-MM-TT.'
          )
        }
        const outOfRange = visitDateOutOfRange(businessDate)
        if (outOfRange) {
          return sendError(res, 400, 'INVALID_BUSINESS_DATE', outOfRange)
        }
        // Ohne visitAt gilt „jetzt" - eine Nacherfassung für einen früheren
        // Tag bleibt erlaubt; geprüft wird nur ein ausdrücklicher Zeitpunkt.
        if (body.visitAt) {
          const offDay = visitAtOffBusinessDate(visitAt, businessDate)
          if (offDay) return sendError(res, 400, 'INVALID_VISIT_AT', offDay)
        }
        const tooLong = textTooLong(body, VISIT_TEXT_LIMITS)
        if (tooLong) return sendError(res, 400, 'TEXT_TOO_LONG', tooLong)
        const control = textHasControlChars(body, VISIT_TEXT_LIMITS)
        if (control) return sendError(res, 400, 'INVALID_TEXT', control)

        const parsedItems = normalizeVisitItems(body.items, catalogue())
        if (parsedItems.ok === false) {
          return sendError(
            res,
            parsedItems.status,
            parsedItems.error,
            parsedItems.message
          )
        }
        const items = parsedItems.items

        const visitId = await getSequelize().transaction(
          async (transaction) => {
            if (visitType === 'initial') {
              await assertNoOtherInitial(
                partner.id,
                businessDate,
                null,
                transaction,
                'Bitte den bestehenden Besuch korrigieren oder eine Nachlieferung erfassen.'
              )
            }
            // Die laufende Nummer vergibt der Server - sie zählt innerhalb
            // des Geschäftstags und darf nicht vom Client kommen.
            const sequence = await nextSequence(
              partner.id,
              businessDate,
              null,
              transaction
            )

            const visit = await PartnerVisit.create(
              {
                partnerId: partner.id,
                businessDate,
                visitAt,
                visitType,
                sequence,
                staffId: currentUserId(req),
                // Ohne Angabe: wer angemeldet ist (D5).
                staffName:
                  optionalString(body.staffName) ??
                  optionalString(req.user?.displayName),
                note: optionalString(body.note),
              },
              { transaction }
            )

            if (items.length > 0) {
              await PartnerVisitItem.bulkCreate(
                items.map((item) => ({ ...item, visitId: visit.id })),
                { transaction, validate: true }
              )
            }
            await audit(
              req,
              'create',
              'partner_visit',
              visit.id,
              {
                partnerId: partner.id,
                businessDate,
                visitType,
                itemCount: items.length,
              },
              { transaction }
            )
            return visit.id
          }
        )

        logger.info(
          `Partner visit recorded: partner=${partner.id} date=${businessDate} type=${visitType}`
        )
        return res.status(201).json(await loadVisitWithItems(visitId))
      } catch (error) {
        return answerError(res, error, {
          code: 'VISIT_CREATE_FAILED',
          message: 'Der Besuch konnte nicht gespeichert werden.',
          log: 'Failed to record partner visit',
        })
      }
    }
  )

  // Besuch korrigieren (inhaber, verkauf, fahrer)
  router.patch(
    '/:id/visits/:visitId',
    canWriteVisits,
    async (req: Request, res: Response) => {
      try {
        const partner = await loadPartner(req, res)
        if (!partner) return

        const visit = await loadVisit(partner.id, req, res)
        if (!visit) return

        const body = (req.body || {}) as any
        const updates: any = {}

        if (body.visitAt !== undefined) {
          const visitAt = new Date(body.visitAt)
          if (Number.isNaN(visitAt.getTime())) {
            return sendError(
              res,
              400,
              'INVALID_VISIT_AT',
              'Ungültiger Zeitpunkt - bitte Datum und Uhrzeit des Besuchs prüfen.'
            )
          }
          updates.visitAt = visitAt
        }

        if (body.visitType !== undefined) {
          if (!partnerStats.isVisitType(body.visitType)) {
            return sendError(
              res,
              400,
              'INVALID_VISIT_TYPE',
              'Unbekannter Besuchstyp - erlaubt sind "initial" (Erstbestückung), "refill" (Nachlieferung) und "pickup" (Abholung).'
            )
          }
          updates.visitType = body.visitType
        }

        // Der Geschäftstag bleibt bei einer Uhrzeit-Korrektur bewusst stehen -
        // sonst würde eine Nacherfassung den Tag unter der Hand verschieben.
        // (Bewusste Abweichung vom Mock; die Erfassungsmaske schickt den
        // Geschäftstag ohnehin immer mit.)
        if (body.businessDate !== undefined) {
          if (!isBusinessDate(body.businessDate)) {
            return sendError(
              res,
              400,
              'INVALID_BUSINESS_DATE',
              'Ungültiger Geschäftstag - erwartet wird das Format JJJJ-MM-TT.'
            )
          }
          const outOfRange = visitDateOutOfRange(body.businessDate)
          if (outOfRange) {
            return sendError(res, 400, 'INVALID_BUSINESS_DATE', outOfRange)
          }
          updates.businessDate = body.businessDate
        }
        if (updates.visitAt) {
          const offDay = visitAtOffBusinessDate(
            updates.visitAt ?? new Date(visit.visitAt),
            updates.businessDate ?? String(visit.businessDate).slice(0, 10)
          )
          if (offDay) return sendError(res, 400, 'INVALID_VISIT_AT', offDay)
        }

        const tooLong = textTooLong(body, VISIT_TEXT_LIMITS)
        if (tooLong) return sendError(res, 400, 'TEXT_TOO_LONG', tooLong)
        const control = textHasControlChars(body, VISIT_TEXT_LIMITS)
        if (control) return sendError(res, 400, 'INVALID_TEXT', control)
        if (body.note !== undefined) updates.note = optionalString(body.note)
        if (body.staffName !== undefined) {
          updates.staffName = optionalString(body.staffName)
        }

        let items: VisitItemInput[] | null = null
        if (body.items !== undefined) {
          const existingItems = partnerStats.toPlainVisit(visit).items
          const parsedItems = normalizeVisitItems(
            body.items,
            catalogue(),
            existingItems
          )
          if (parsedItems.ok === false) {
            return sendError(
              res,
              parsedItems.status,
              parsedItems.error,
              parsedItems.message
            )
          }
          items = parsedItems.items
        }

        const currentDate = String(visit.businessDate).slice(0, 10)
        const targetType = updates.visitType || visit.visitType
        const targetDate = updates.businessDate || currentDate

        await getSequelize().transaction(async (transaction) => {
          if (targetType === 'initial') {
            await assertNoOtherInitial(
              partner.id,
              targetDate,
              visit.id,
              transaction,
              'Es kann nur eine je Geschäftstag geben.'
            )
          }
          // Wandert der Besuch auf einen anderen Tag, reiht er sich dort
          // hinten ein - sonst gäbe es dieselbe laufende Nummer doppelt.
          if (targetDate !== currentDate) {
            updates.sequence = await nextSequence(
              partner.id,
              targetDate,
              visit.id,
              transaction
            )
          }
          if (Object.keys(updates).length > 0) {
            await visit.update(updates, { transaction })
          }
          if (items) {
            // Positionen werden komplett ersetzt - Teil-Updates einzelner
            // Zeilen wären beim Nachzählen im Markt fehleranfälliger.
            await PartnerVisitItem.destroy({
              where: { visitId: visit.id },
              transaction,
            })
            if (items.length > 0) {
              await PartnerVisitItem.bulkCreate(
                items.map((item) => ({ ...item, visitId: visit.id })),
                { transaction, validate: true }
              )
            }
          }
          await audit(
            req,
            'update',
            'partner_visit',
            visit.id,
            {
              partnerId: partner.id,
              businessDate: targetDate,
              visitType: targetType,
              fields: [
                ...Object.keys(updates),
                ...(items ? ['items'] : []),
              ].sort(),
            },
            { transaction }
          )
        })

        logger.info(
          `Partner visit updated: partner=${partner.id} visit=${visit.id}`
        )
        return res.json(await loadVisitWithItems(visit.id))
      } catch (error) {
        return answerError(res, error, {
          code: 'VISIT_UPDATE_FAILED',
          message: 'Der Besuch konnte nicht gespeichert werden.',
          log: 'Failed to update partner visit',
        })
      }
    }
  )

  // Besuch löschen (Fehleingabe; inhaber, verkauf, fahrer)
  router.delete(
    '/:id/visits/:visitId',
    canWriteVisits,
    async (req: Request, res: Response) => {
      try {
        const partner = await loadPartner(req, res)
        if (!partner) return

        const visit = await loadVisit(partner.id, req, res)
        if (!visit) return

        const plain = partnerStats.toPlainVisit(visit)
        await getSequelize().transaction(async (transaction) => {
          await PartnerVisitItem.destroy({
            where: { visitId: visit.id },
            transaction,
          })
          await visit.destroy({ transaction })
          // Der gelöschte Besuch steht vollständig im Protokoll - eine
          // versehentliche Löschung lässt sich so nachvollziehen.
          await audit(
            req,
            'delete',
            'partner_visit',
            plain.id,
            {
              partnerId: partner.id,
              businessDate: plain.businessDate,
              visitType: plain.visitType,
              visitAt: plain.visitAt,
              sequence: plain.sequence,
              items: plain.items.map((item) => ({
                productSlug: item.productSlug,
                productId: item.productId,
                unitPrice: item.unitPrice,
                countedQty: item.countedQty,
                deliveredQty: item.deliveredQty,
              })),
            },
            { transaction }
          )
        })

        logger.info(
          `Partner visit deleted: partner=${partner.id} visit=${visit.id}`
        )
        // Antwort wie im Mock (D3).
        return res.json({
          id: plain.id,
          deleted: true,
          message: 'Besuch gelöscht.',
        })
      } catch (error) {
        return answerError(res, error, {
          code: 'VISIT_DELETE_FAILED',
          message: 'Der Besuch konnte nicht gelöscht werden.',
          log: 'Failed to delete partner visit',
        })
      }
    }
  )

  // ==========================================================================
  // KENNZAHLEN UND REPORT
  // ==========================================================================

  router.get('/:id/stats', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const range = parseRange(req, res)
      if (!range) return

      const visits = await loadVisits(partner.id, range)
      return res.json(partnerStats.getStats(visits, range))
    } catch (error) {
      return answerError(res, error, {
        code: 'STATS_FAILED',
        message: 'Die Kennzahlen konnten nicht berechnet werden.',
        log: 'Failed to compute partner stats',
      })
    }
  })

  // CSV-Export - vor der JSON-Variante registriert, damit die Reihenfolge klar ist
  router.get('/:id/report.csv', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const range = parseRange(req, res)
      if (!range) return

      const visits = await loadVisits(partner.id, range)
      const stats = partnerStats.getStats(visits, range)
      const csv = partnerStats.toCsv(stats, {
        name: partner.name,
        settlementModel: partner.settlementModel,
      })

      const filename = `partner-report-${partner.slug || partner.id}-${
        range.from || 'gesamt'
      }-bis-${range.to || 'gesamt'}.csv`

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      // BOM voran, sonst zeigt Excel die Umlaute als Buchstabensalat.
      return res.send(BOM + csv)
    } catch (error) {
      return answerError(res, error, {
        code: 'REPORT_CSV_FAILED',
        message: 'Der CSV-Export konnte nicht erzeugt werden.',
        log: 'Failed to export partner report as CSV',
      })
    }
  })

  router.get('/:id/report', async (req: Request, res: Response) => {
    try {
      const partner = await loadPartner(req, res)
      if (!partner) return

      const range = parseRange(req, res)
      if (!range) return

      const visits = await loadVisits(partner.id, range)
      const stats = partnerStats.getStats(visits, range)

      return res.json({
        partner: serializePartner(partner),
        generatedAt: new Date().toISOString(),
        stats,
      })
    } catch (error) {
      return answerError(res, error, {
        code: 'REPORT_FAILED',
        message: 'Der Partner-Report konnte nicht erzeugt werden.',
        log: 'Failed to build partner report',
      })
    }
  })

  return router
}
