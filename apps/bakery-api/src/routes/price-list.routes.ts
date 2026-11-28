/**
 * Preisliste - Export der Produktseite (docs/domains/produkte.md):
 *
 *   GET /api/price-list             das Dokument für die Druckansicht (JSON)
 *   GET /api/price-list/export.csv  dieselbe Liste als CSV für Excel (DE)
 *
 * Query (beide Routen gleich):
 *   audience=laden|partner     Vorgabe `laden`
 *   partnerId=<Zahl>           Pflicht bei `audience=partner`
 *   categories=brot,kuchen     nur diese Kategorien; ohne = ganzes Sortiment
 *   validFrom=YYYY-MM-DD       „gültig ab“ im Kopf, optional
 *   includeUnavailable=1       auch nicht verfügbare Produkte (gekennzeichnet)
 *   allergens=1                mit Allergen-Angaben
 *
 * Rollen: Ladenliste `inhaber` und `verkauf`, Partnerliste nur `inhaber`.
 *
 * Quelle ist der **freigegebene** Katalog (`hq-catalogue.ts`, wie
 * `/api/products`) - eine Liste, die das Haus verlässt, zeigt keine
 * Änderung, die noch auf Freigabe wartet. Gebaut wird sie in
 * `services/price-list.core.js`.
 *
 * Partnerliste: es gibt in den Daten **keinen** Partnerpreis, Rabatt oder
 * Provisionssatz - der Backschrank wird zu den hq-Preisen abgerechnet
 * (Preis-Snapshot je Besuch). Die Partnerliste zeigt deshalb dieselben
 * Preise, aber nur das Sortiment des Partners: die Produkte seiner aktiven
 * Standard-Bestückung, ersatzweise das, was in den letzten
 * `VISIT_LOOKBACK_DAYS` Tagen geliefert wurde. Ohne beides: 409
 * `no_assortment` statt des ganzen Sortiments.
 */
import { Request, Response, Router } from 'express'
import { Op } from 'sequelize'

// Die eine Stelle für Allergen-Bezeichnungen und ihre Reihenfolge. Nicht
// über den Index von `@bakery/shared/utils`: der zieht React nach.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { formatAllergens } from '../../../../libs/shared/utils/src/lib/allergens'
import { asyncHandler } from '../auth/middleware'
import {
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
} from '../models'
import {
  catalogueFor,
  defaultProductsDir,
  HqCatalogue,
} from '../services/hq-catalogue'
import { sendError } from '../utils/http-error'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('../services/price-list.core')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const refCore = require('../services/backzettel-reference.core')

export interface PriceListRouterOptions {
  /** hq-Produktverzeichnis (Lese-Klon); Vorgabe wie `/api/products`. */
  productsDir?: string
  /** Für Tests: „heute“ als `YYYY-MM-DD`. */
  today?: () => string
}

/** So weit zurück zählen gelieferte Produkte als Sortiment eines Partners. */
export const VISIT_LOOKBACK_DAYS = 56

/** Byte-Order-Mark vor dem CSV (als Escape, nie als unsichtbares Zeichen). */
const BOM = String.fromCharCode(0xfeff)

const MAX_CATEGORIES = 30

interface Assortment {
  slugs: string[]
  numericIds: number[]
  source: 'templates' | 'visits'
}

function flag(value: unknown): boolean {
  return value === '1' || value === 'true'
}

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Sortiment eines Partners: Standard-Bestückung, sonst jüngste Lieferungen. */
async function loadAssortment(
  partnerId: number,
  today: string
): Promise<Assortment | null> {
  const templates = await PartnerDeliveryTemplate.findAll({
    where: { partnerId, active: true },
  })
  const fromTemplates = templates.flatMap((t) =>
    Array.isArray(t.items) ? t.items : []
  )
  if (fromTemplates.length > 0) {
    return {
      slugs: fromTemplates
        .map((i) => String(i.productSlug ?? ''))
        .filter(Boolean),
      numericIds: fromTemplates
        .map((i) => Number(i.productId))
        .filter(Number.isFinite),
      source: 'templates',
    }
  }

  const visits = await PartnerVisit.findAll({
    where: {
      partnerId,
      businessDate: { [Op.gte]: shiftDays(today, -VISIT_LOOKBACK_DAYS) },
    },
    include: [{ model: PartnerVisitItem, as: 'items' }],
  })
  const delivered = visits
    .flatMap((v) => (Array.isArray(v.items) ? v.items : []))
    .filter((i: PartnerVisitItem) => Number(i.deliveredQty) > 0)
  if (delivered.length > 0) {
    return {
      slugs: delivered
        .map((i: PartnerVisitItem) => String(i.productSlug ?? ''))
        .filter(Boolean),
      numericIds: delivered
        .map((i: PartnerVisitItem) => Number(i.productId))
        .filter(Number.isFinite),
      source: 'visits',
    }
  }
  return null
}

export function createPriceListRouter(
  options: PriceListRouterOptions = {}
): Router {
  const router = Router()
  const catalogue = (): HqCatalogue =>
    catalogueFor(options.productsDir ?? defaultProductsDir())
  const today = (): string =>
    options.today ? options.today() : refCore.berlinToday(new Date())

  /** Baut das Dokument oder antwortet mit dem Fehler (dann `null`). */
  async function build(req: Request, res: Response) {
    const audienceRaw = req.query['audience']
    const audience = audienceRaw === undefined ? 'laden' : audienceRaw
    if (typeof audience !== 'string' || !core.AUDIENCES.includes(audience)) {
      sendError(
        res,
        400,
        'invalid_audience',
        'Unbekannte Zielgruppe - möglich sind "laden" und "partner".'
      )
      return null
    }

    // Die Partnerliste trägt Konditionen eines Geschäftspartners: nur Inhaber.
    const allowed = audience === 'partner' ? [] : ['verkauf']
    if (!authCrypto.roleAllows(req.user?.role, allowed)) {
      sendError(
        res,
        403,
        'forbidden',
        audience === 'partner'
          ? 'Die Preisliste für Partner darf nur der Inhaber erstellen.'
          : 'Für die Preisliste fehlt die Berechtigung.'
      )
      return null
    }

    const validFromRaw = req.query['validFrom']
    let validFrom: string | null = null
    if (validFromRaw !== undefined && validFromRaw !== '') {
      if (!core.isIsoDate(validFromRaw)) {
        sendError(
          res,
          400,
          'invalid_date',
          '„Gültig ab“ ist kein gültiges Datum (erwartet: JJJJ-MM-TT).'
        )
        return null
      }
      validFrom = validFromRaw as string
    }

    const categoriesRaw = req.query['categories']
    let categories: string[] | null = null
    if (categoriesRaw !== undefined && categoriesRaw !== '') {
      if (typeof categoriesRaw !== 'string') {
        sendError(
          res,
          400,
          'invalid_categories',
          'Die Kategorien müssen als kommagetrennte Liste kommen.'
        )
        return null
      }
      categories = categoriesRaw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      if (categories.length > MAX_CATEGORIES) {
        sendError(res, 400, 'invalid_categories', 'Zu viele Kategorien.')
        return null
      }
    }

    const hq = catalogue()
    if (!hq.available()) {
      sendError(
        res,
        503,
        'hq_unavailable',
        'Der Produktkatalog aus hq ist gerade nicht erreichbar - die Preisliste kann nicht erstellt werden.'
      )
      return null
    }

    const day = today()
    let partner: Record<string, unknown> | null = null
    let assortment: Assortment | null = null
    if (audience === 'partner') {
      const id = Number(req.query['partnerId'])
      if (!Number.isInteger(id) || id <= 0) {
        sendError(
          res,
          400,
          'partner_required',
          'Für die Partnerliste muss ein Verkaufspartner gewählt sein.'
        )
        return null
      }
      const row = await Partner.findByPk(id)
      if (!row) {
        sendError(
          res,
          404,
          'PARTNER_NOT_FOUND',
          `Verkaufspartner mit der Kennung ${id} wurde nicht gefunden.`
        )
        return null
      }
      assortment = await loadAssortment(id, day)
      if (!assortment) {
        sendError(
          res,
          409,
          'no_assortment',
          `Für ${row.name} ist kein Sortiment bekannt: es gibt keine aktive Standard-Bestückung und keine Lieferung in den letzten ${VISIT_LOOKBACK_DAYS} Tagen. Bitte zuerst die Standard-Bestückung pflegen.`
        )
        return null
      }
      partner = {
        id: row.id,
        name: row.name,
        street: row.street,
        zip: row.zip,
        city: row.city,
        settlementModel: row.settlementModel,
        assortmentSource: assortment.source,
      }
    }

    return core.buildPriceList(hq.list(), {
      audience,
      categories,
      validFrom,
      today: day,
      includeUnavailable: flag(req.query['includeUnavailable']),
      withAllergens: flag(req.query['allergens']),
      allergenText: formatAllergens,
      assortment,
      partner,
    })
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const doc = await build(req, res)
      if (!doc) return
      res.json({ success: true, data: doc })
    })
  )

  router.get(
    '/export.csv',
    asyncHandler(async (req, res) => {
      const doc = await build(req, res)
      if (!doc) return
      if (doc.status !== 'ok') {
        sendError(
          res,
          404,
          'no_data',
          'Zu dieser Auswahl gibt es kein Produkt mit Preis - es gibt nichts zu exportieren.'
        )
        return
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${core.priceListFileName(doc)}.csv"`
      )
      // BOM voran, sonst zeigt Excel die Umlaute als Buchstabensalat.
      res.send(BOM + core.priceListToCsv(doc))
    })
  )

  return router
}
