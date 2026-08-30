/**
 * Verkaufspartner-Routen (TASK-037) - Backschrank beim CAP-Markt.
 *
 * Erfasst werden *Besuche* am Regal, nicht Lieferungen: jeder Besuch hält
 * fest, was noch dalag (`countedQty`) und was neu eingeräumt wurde
 * (`deliveredQty`). Verkauf und Umsatz werden daraus abgeleitet - sie werden
 * nie erfasst. Gerechnet wird ausschließlich im `partner-stats.service`
 * (der wiederum an `partner-stats.core.js` delegiert), damit die echte API,
 * der Mock-Server und die Tests dieselben Formeln benutzen.
 *
 * Fehlerantworten setzen immer `error` (Code) **und** `message` (deutscher
 * Text): der `ApiClient` im Frontend wirft `new Error(data.message)`, ohne
 * `message` ginge der deutsche Text verloren.
 */

import { Router, Request, Response } from 'express'
import { Op } from 'sequelize'
import {
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
  getSequelize,
} from '../models'
import * as partnerStats from '../services/partner-stats.service'
import { PlainVisit, StatsRange } from '../services/partner-stats.service'
import { logger } from '../utils/logger'

const router = Router()

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
}

interface TemplateItemInput {
  productId: number
  productSlug: string
  quantity: number
}

interface VisitItemInput {
  productId: number
  productSlug: string
  productName: string
  unitPrice: number
  countedQty: number | null
  deliveredQty: number
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

/** Fehlerantwort mit maschinenlesbarem Code *und* deutschem Text. */
function fail(
  res: Response,
  status: number,
  error: string,
  message: string
): Response {
  return res.status(status).json({ success: false, error, message })
}

/** `:id`/`:visitId` müssen positive Ganzzahlen sein - sonst 404. */
function parseNumericId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** `2026-08-30` → `30.08.2026` für Meldungen an das Team. */
function formatDe(businessDate: string): string {
  const [year, month, day] = businessDate.split('-')
  return `${day}.${month}.${year}`
}

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUT_MAP[char] || char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** ISO-Wochentage, dedupliziert und sortiert - alles andere fliegt raus. */
function normalizeWeekdays(value: unknown): number[] {
  let raw: any = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw)) return []
  const days = raw
    .map((day: unknown) => Number(day))
    .filter((day: number) => Number.isInteger(day) && day >= 1 && day <= 7)
  return Array.from(new Set<number>(days)).sort((a, b) => a - b)
}

function normalizeTemplateItems(value: unknown): TemplateItemInput[] {
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

/**
 * Positionen eines Besuchs prüfen und normalisieren.
 * `null` = ungültige Eingabe (der Aufrufer antwortet dann mit 400).
 * `countedQty` bleibt `null`, wenn nicht gezählt wurde - das ist etwas
 * anderes als "0 Stück vorgefunden" und darf nicht zusammenfallen.
 */
function normalizeVisitItems(value: unknown): VisitItemInput[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const items: VisitItemInput[] = []
  for (const raw of value as any[]) {
    const productSlug = String(raw?.productSlug || '').trim()
    if (productSlug === '') return null
    const counted = raw?.countedQty
    const notCounted =
      counted === null || counted === undefined || counted === ''
    items.push({
      productId: toInt(raw?.productId, 0),
      productSlug,
      productName: String(raw?.productName || productSlug),
      unitPrice: Math.max(0, toNumber(raw?.unitPrice, 0)),
      countedQty: notCounted ? null : Math.max(0, toInt(counted, 0)),
      deliveredQty: Math.max(0, toInt(raw?.deliveredQty, 0)),
    })
  }
  return items
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
    items: normalizeTemplateItems(template.items),
    active: template.active !== false,
  }
}

/** Partner laden oder mit deutschem 404 antworten. */
async function loadPartner(
  req: Request,
  res: Response
): Promise<Partner | null> {
  const id = parseNumericId(req.params.id)
  if (id === null) {
    fail(
      res,
      404,
      'PARTNER_NOT_FOUND',
      'Verkaufspartner nicht gefunden - die Kennung muss eine Zahl sein.'
    )
    return null
  }
  const partner = await Partner.findByPk(id)
  if (!partner) {
    fail(
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
  const visitId = parseNumericId(req.params.visitId)
  if (visitId === null) {
    fail(
      res,
      404,
      'VISIT_NOT_FOUND',
      'Besuch nicht gefunden - die Kennung muss eine Zahl sein.'
    )
    return null
  }
  const visit = await PartnerVisit.findOne({
    where: { id: visitId, partnerId },
  })
  if (!visit) {
    fail(
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
  const from = typeof req.query.from === 'string' ? req.query.from : ''
  const to = typeof req.query.to === 'string' ? req.query.to : ''
  if (from && !isBusinessDate(from)) {
    fail(
      res,
      400,
      'INVALID_RANGE',
      'Ungültiges Startdatum - erwartet wird das Format JJJJ-MM-TT.'
    )
    return null
  }
  if (to && !isBusinessDate(to)) {
    fail(
      res,
      400,
      'INVALID_RANGE',
      'Ungültiges Enddatum - erwartet wird das Format JJJJ-MM-TT.'
    )
    return null
  }
  if (from && to && from > to) {
    fail(
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

/** Angemeldete Person, falls die Route hinter dem Auth-Middleware hängt. */
function currentUserId(req: Request): number | null {
  const id = Number((req as any).user?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

// ============================================================================
// PARTNER
// ============================================================================

// Alle Verkaufspartner
router.get('/', async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.findAll({ order: [['name', 'ASC']] })
    return res.json(partners.map(serializePartner))
  } catch (error) {
    logger.error('Failed to load sales partners', error)
    return fail(
      res,
      500,
      'PARTNERS_LOAD_FAILED',
      'Die Verkaufspartner konnten nicht geladen werden.'
    )
  }
})

// Verkaufspartner anlegen
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as any
    const name = String(body.name || '').trim()
    if (!name) {
      return fail(
        res,
        400,
        'INVALID_NAME',
        'Der Name des Verkaufspartners fehlt.'
      )
    }

    const slug = slugify(body.slug ? String(body.slug) : name)
    if (!slug) {
      return fail(
        res,
        400,
        'INVALID_SLUG',
        'Aus dem Namen ließ sich kein Kürzel bilden - bitte ein Kürzel angeben.'
      )
    }

    const existing = await Partner.findOne({ where: { slug } })
    if (existing) {
      return fail(
        res,
        409,
        'PARTNER_SLUG_TAKEN',
        `Es gibt bereits einen Verkaufspartner mit dem Kürzel "${slug}".`
      )
    }

    const partner = await Partner.create({
      name,
      slug,
      street: String(body.street || ''),
      zip: String(body.zip || ''),
      city: String(body.city || ''),
      contactName: optionalString(body.contactName),
      phone: optionalString(body.phone),
      email: optionalString(body.email),
      deliveryDays: normalizeWeekdays(body.deliveryDays),
      settlementModel:
        body.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission',
      active: body.active === undefined ? true : Boolean(body.active),
      notes: optionalString(body.notes),
    })

    logger.info(`Sales partner created: ${partner.slug}`)
    return res.status(201).json(serializePartner(partner))
  } catch (error) {
    logger.error('Failed to create sales partner', error)
    return fail(
      res,
      500,
      'PARTNER_CREATE_FAILED',
      'Der Verkaufspartner konnte nicht angelegt werden.'
    )
  }
})

// Ein Verkaufspartner
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return
    return res.json(serializePartner(partner))
  } catch (error) {
    logger.error('Failed to load sales partner', error)
    return fail(
      res,
      500,
      'PARTNER_LOAD_FAILED',
      'Der Verkaufspartner konnte nicht geladen werden.'
    )
  }
})

// Verkaufspartner bearbeiten
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const body = (req.body || {}) as any
    const updates: any = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) {
        return fail(
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
        return fail(
          res,
          400,
          'INVALID_SLUG',
          'Das Kürzel darf nicht leer sein.'
        )
      }
      if (slug !== partner.slug) {
        const taken = await Partner.findOne({
          where: { slug, id: { [Op.ne]: partner.id } },
        })
        if (taken) {
          return fail(
            res,
            409,
            'PARTNER_SLUG_TAKEN',
            `Es gibt bereits einen Verkaufspartner mit dem Kürzel "${slug}".`
          )
        }
      }
      updates.slug = slug
    }

    if (body.street !== undefined) updates.street = String(body.street || '')
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
        return fail(
          res,
          400,
          'INVALID_SETTLEMENT_MODEL',
          'Unbekanntes Abrechnungsmodell - erlaubt sind "commission" (Kommission) und "firm_sale" (Festkauf).'
        )
      }
      updates.settlementModel = body.settlementModel
    }
    if (body.active !== undefined) updates.active = Boolean(body.active)
    if (body.notes !== undefined) updates.notes = optionalString(body.notes)

    await partner.update(updates)
    logger.info(`Sales partner updated: ${partner.slug}`)
    return res.json(serializePartner(partner))
  } catch (error) {
    logger.error('Failed to update sales partner', error)
    return fail(
      res,
      500,
      'PARTNER_UPDATE_FAILED',
      'Der Verkaufspartner konnte nicht gespeichert werden.'
    )
  }
})

// ============================================================================
// STANDARD-BESTÜCKUNG (Vorlagen je Wochentag)
// ============================================================================

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
    logger.error('Failed to load partner delivery templates', error)
    return fail(
      res,
      500,
      'TEMPLATES_LOAD_FAILED',
      'Die Standard-Bestückung konnte nicht geladen werden.'
    )
  }
})

router.put('/:id/templates/:weekday', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const weekday = Number(req.params.weekday)
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      return fail(
        res,
        400,
        'INVALID_WEEKDAY',
        'Ungültiger Wochentag - erlaubt sind 1 (Montag) bis 7 (Sonntag).'
      )
    }

    const body = (req.body || {}) as any
    if (body.items !== undefined && !Array.isArray(body.items)) {
      return fail(
        res,
        400,
        'INVALID_ITEMS',
        'Die Vorlage braucht eine Liste von Positionen (items).'
      )
    }

    const items = normalizeTemplateItems(body.items)
    const active = body.active === undefined ? true : Boolean(body.active)

    const existing = await PartnerDeliveryTemplate.findOne({
      where: { partnerId: partner.id, weekday },
    })

    if (existing) {
      await existing.update({ items, active })
      logger.info(
        `Partner template updated: partner=${partner.id} weekday=${weekday}`
      )
      return res.json(serializeTemplate(existing))
    }

    const created = await PartnerDeliveryTemplate.create({
      partnerId: partner.id,
      weekday,
      items,
      active,
    })
    logger.info(
      `Partner template created: partner=${partner.id} weekday=${weekday}`
    )
    return res.status(201).json(serializeTemplate(created))
  } catch (error) {
    logger.error('Failed to save partner delivery template', error)
    return fail(
      res,
      500,
      'TEMPLATE_SAVE_FAILED',
      'Die Standard-Bestückung konnte nicht gespeichert werden.'
    )
  }
})

// ============================================================================
// BESUCHE
// ============================================================================

// Besuche im Zeitraum
router.get('/:id/visits', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const range = parseRange(req, res)
    if (!range) return

    const visits = await loadVisits(partner.id, range)
    return res.json(visits)
  } catch (error) {
    logger.error('Failed to load partner visits', error)
    return fail(
      res,
      500,
      'VISITS_LOAD_FAILED',
      'Die Besuche konnten nicht geladen werden.'
    )
  }
})

// Tagesansicht: Timeline, Kennzahlen und die Rohdaten des Geschäftstags
router.get('/:id/visits/today', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const requested = typeof req.query.date === 'string' ? req.query.date : ''
    if (requested && !isBusinessDate(requested)) {
      return fail(
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
    logger.error('Failed to load partner day detail', error)
    return fail(
      res,
      500,
      'DAY_LOAD_FAILED',
      'Der Geschäftstag konnte nicht geladen werden.'
    )
  }
})

// Besuch erfassen
router.post('/:id/visits', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const body = (req.body || {}) as any

    if (!partnerStats.isVisitType(body.visitType)) {
      return fail(
        res,
        400,
        'INVALID_VISIT_TYPE',
        'Unbekannter Besuchstyp - erlaubt sind "initial" (Erstbestückung), "refill" (Nachlieferung) und "pickup" (Abholung).'
      )
    }
    const visitType = body.visitType

    const visitAt = body.visitAt ? new Date(body.visitAt) : new Date()
    if (Number.isNaN(visitAt.getTime())) {
      return fail(
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
      return fail(
        res,
        400,
        'INVALID_BUSINESS_DATE',
        'Ungültiger Geschäftstag - erwartet wird das Format JJJJ-MM-TT.'
      )
    }

    const items = normalizeVisitItems(body.items)
    if (items === null) {
      return fail(
        res,
        400,
        'INVALID_ITEMS',
        'Ungültige Positionen - jede Zeile braucht ein Produkt (productSlug).'
      )
    }

    // Pro Geschäftstag gibt es genau eine Erstbestückung.
    if (visitType === 'initial') {
      const duplicates = await PartnerVisit.count({
        where: {
          partnerId: partner.id,
          businessDate,
          visitType: 'initial',
        },
      })
      if (duplicates > 0) {
        return fail(
          res,
          409,
          'DUPLICATE_INITIAL_VISIT',
          `Für den ${formatDe(
            businessDate
          )} ist bereits eine Erstbestückung erfasst. Bitte den bestehenden Besuch korrigieren oder eine Nachlieferung erfassen.`
        )
      }
    }

    const sequelize = getSequelize()
    const visitId = await sequelize.transaction(async (transaction) => {
      // Die laufende Nummer vergibt der Server - sie zählt innerhalb des
      // Geschäftstags und darf nicht vom Client kommen.
      const maxSequence = await PartnerVisit.max('sequence', {
        where: { partnerId: partner.id, businessDate },
        transaction,
      })
      const sequence = Math.max(0, toInt(maxSequence, 0)) + 1

      const visit = await PartnerVisit.create(
        {
          partnerId: partner.id,
          businessDate,
          visitAt,
          visitType,
          sequence,
          staffId: currentUserId(req),
          staffName: optionalString(body.staffName),
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

      return visit.id
    })

    logger.info(
      `Partner visit recorded: partner=${partner.id} date=${businessDate} type=${visitType}`
    )
    return res.status(201).json(await loadVisitWithItems(visitId))
  } catch (error) {
    logger.error('Failed to record partner visit', error)
    return fail(
      res,
      500,
      'VISIT_CREATE_FAILED',
      'Der Besuch konnte nicht gespeichert werden.'
    )
  }
})

// Besuch korrigieren
router.patch('/:id/visits/:visitId', async (req: Request, res: Response) => {
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
        return fail(
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
        return fail(
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
    if (body.businessDate !== undefined) {
      if (!isBusinessDate(body.businessDate)) {
        return fail(
          res,
          400,
          'INVALID_BUSINESS_DATE',
          'Ungültiger Geschäftstag - erwartet wird das Format JJJJ-MM-TT.'
        )
      }
      updates.businessDate = body.businessDate
    }

    if (body.note !== undefined) updates.note = optionalString(body.note)
    if (body.staffName !== undefined) {
      updates.staffName = optionalString(body.staffName)
    }

    const targetType = updates.visitType || visit.visitType
    const targetDate =
      updates.businessDate || String(visit.businessDate).slice(0, 10)
    if (targetType === 'initial') {
      const duplicates = await PartnerVisit.count({
        where: {
          partnerId: partner.id,
          businessDate: targetDate,
          visitType: 'initial',
          id: { [Op.ne]: visit.id },
        },
      })
      if (duplicates > 0) {
        return fail(
          res,
          409,
          'DUPLICATE_INITIAL_VISIT',
          `Für den ${formatDe(
            targetDate
          )} ist bereits eine Erstbestückung erfasst. Es kann nur eine je Geschäftstag geben.`
        )
      }
    }

    let items: VisitItemInput[] | null = null
    if (body.items !== undefined) {
      items = normalizeVisitItems(body.items)
      if (items === null) {
        return fail(
          res,
          400,
          'INVALID_ITEMS',
          'Ungültige Positionen - jede Zeile braucht ein Produkt (productSlug).'
        )
      }
    }

    const sequelize = getSequelize()
    await sequelize.transaction(async (transaction) => {
      if (Object.keys(updates).length > 0) {
        await visit.update(updates, { transaction })
      }
      if (items) {
        // Positionen werden komplett ersetzt - Teil-Updates einzelner Zeilen
        // wären beim Nachzählen im Markt die fehleranfälligere Variante.
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
    })

    logger.info(
      `Partner visit updated: partner=${partner.id} visit=${visit.id}`
    )
    return res.json(await loadVisitWithItems(visit.id))
  } catch (error) {
    logger.error('Failed to update partner visit', error)
    return fail(
      res,
      500,
      'VISIT_UPDATE_FAILED',
      'Der Besuch konnte nicht gespeichert werden.'
    )
  }
})

// Besuch löschen (Fehleingabe)
router.delete('/:id/visits/:visitId', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const visit = await loadVisit(partner.id, req, res)
    if (!visit) return

    const sequelize = getSequelize()
    await sequelize.transaction(async (transaction) => {
      await PartnerVisitItem.destroy({
        where: { visitId: visit.id },
        transaction,
      })
      await visit.destroy({ transaction })
    })

    logger.info(
      `Partner visit deleted: partner=${partner.id} visit=${visit.id}`
    )
    return res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete partner visit', error)
    return fail(
      res,
      500,
      'VISIT_DELETE_FAILED',
      'Der Besuch konnte nicht gelöscht werden.'
    )
  }
})

// ============================================================================
// KENNZAHLEN UND REPORT
// ============================================================================

router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const partner = await loadPartner(req, res)
    if (!partner) return

    const range = parseRange(req, res)
    if (!range) return

    const visits = await loadVisits(partner.id, range)
    return res.json(partnerStats.getStats(visits, range))
  } catch (error) {
    logger.error('Failed to compute partner stats', error)
    return fail(
      res,
      500,
      'STATS_FAILED',
      'Die Kennzahlen konnten nicht berechnet werden.'
    )
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
    return res.send(`\uFEFF${csv}`)
  } catch (error) {
    logger.error('Failed to export partner report as CSV', error)
    return fail(
      res,
      500,
      'REPORT_CSV_FAILED',
      'Der CSV-Export konnte nicht erzeugt werden.'
    )
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
    logger.error('Failed to build partner report', error)
    return fail(
      res,
      500,
      'REPORT_FAILED',
      'Der Partner-Report konnte nicht erzeugt werden.'
    )
  }
})

export default router
