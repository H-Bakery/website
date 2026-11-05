/**
 * Import des Mock-Stores `apps/bakery-api/data/partner-store.json` in die
 * echte API (B6) - die Regeln, ohne Datenbank. Dependency-freies CommonJS
 * wie `partner-stats.core.js`; die Schreibseite steht in
 * `partner-import.service.ts`, der Aufruf in `cli.ts` (`import-partners`).
 *
 *   const plan = planImport(JSON.parse(text))
 *   plan.partners / plan.templates / plan.visits  - normalisiert
 *   plan.problems                                 - was nicht übernommen wird
 *
 * Grundsätze:
 *  - Partner werden über den **Slug** wiedererkannt, nicht über die Id des
 *    Stores (die Datenbank vergibt eigene). Vorlagen über Partner + Wochentag.
 *  - Ein Besuch wird über seinen **natürlichen Schlüssel** wiedererkannt:
 *    Partner-Slug, Geschäftstag, Besuchstyp, Zeitpunkt (ms). Ein zweiter Lauf
 *    findet ihn und legt nichts doppelt an - der Import ist idempotent.
 *  - Positionen behalten ihren **Snapshot** (Name, Preis) aus dem Store. Es
 *    wird nicht im hq-Katalog nachgeschlagen: eine spätere Preisänderung in
 *    hq darf alte Abrechnungen nicht verändern. Geprüft wird mit denselben
 *    Regeln wie bei der Erfassung (`validateVisitItems` ohne Katalog).
 *  - Was nicht passt, wird **nicht still verworfen**, sondern als Problem
 *    gemeldet (deutscher Text), der Rest wird trotzdem übernommen.
 */

const partnerStats = require('./partner-stats.core')

const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

/** Slug wie bei den Partnern der API und des Mocks (umlaut-sicher). */
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] || char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** ISO-Wochentage 1..7, dedupliziert und sortiert; alles andere fällt weg. */
function normalizeWeekdays(value) {
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      raw = []
    }
  }
  if (!Array.isArray(raw)) return []
  const days = raw
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

function optionalString(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text === '' ? null : text
}

function plainString(value) {
  return value === null || value === undefined ? '' : String(value)
}

function positiveInt(value) {
  const n =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

/** Stammdaten eines Partners in der Form der Partner-Tabelle. */
function partnerAttributes(raw, slug) {
  return {
    name: String(raw.name).trim(),
    slug,
    street: plainString(raw.street),
    zip: plainString(raw.zip),
    city: plainString(raw.city),
    contactName: optionalString(raw.contactName),
    phone: optionalString(raw.phone),
    email: optionalString(raw.email),
    deliveryDays: normalizeWeekdays(raw.deliveryDays),
    settlementModel:
      raw.settlementModel === 'firm_sale' ? 'firm_sale' : 'commission',
    active: raw.active !== false,
    notes: optionalString(raw.notes),
  }
}

/** Vorlagen-Positionen: Produkt (Slug) und Menge > 0, wie beim Speichern. */
function templateItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const id = Number(item.productId)
      const quantity = Number(item.quantity)
      return {
        productId: Number.isFinite(id) ? Math.trunc(id) : 0,
        productSlug:
          typeof item.productSlug === 'string' ? item.productSlug.trim() : '',
        quantity: Number.isFinite(quantity)
          ? Math.max(0, Math.trunc(quantity))
          : 0,
      }
    })
    .filter((item) => item.productSlug !== '' && item.quantity > 0)
}

/**
 * Natürlicher Schlüssel eines Besuchs - gleich für Store und Datenbank.
 * @param {{ partnerSlug: string, businessDate: string, visitType: string, visitAt: string|Date }} visit
 */
function visitKey(visit) {
  const at = new Date(visit.visitAt).getTime()
  return [visit.partnerSlug, visit.businessDate, visit.visitType, at].join('|')
}

/**
 * Store prüfen und in einen Importplan übersetzen.
 *
 * @param {unknown} store  Inhalt von `partner-store.json` (geparst)
 * @returns {{
 *   ok: boolean,
 *   message?: string,
 *   partners: Array<{ sourceId: number, slug: string, attributes: object }>,
 *   templates: Array<{ sourceId: number|null, partnerSlug: string, weekday: number, items: Array, active: boolean }>,
 *   visits: Array<{ sourceId: number|null, key: string, partnerSlug: string, businessDate: string, visitAt: string, visitType: string, sequence: number|null, staffName: string|null, note: string|null, items: Array }>,
 *   problems: Array<{ entity: string, sourceId: number|null, message: string }>
 * }}
 */
function planImport(store) {
  const plan = {
    ok: true,
    partners: [],
    templates: [],
    visits: [],
    problems: [],
  }
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return {
      ...plan,
      ok: false,
      message:
        'Die Datei ist kein Partner-Store - erwartet wird ein Objekt mit "partners", "templates" und "visits".',
    }
  }
  for (const section of ['partners', 'templates', 'visits']) {
    if (store[section] !== undefined && !Array.isArray(store[section])) {
      return {
        ...plan,
        ok: false,
        message: `Die Datei ist kein Partner-Store - "${section}" muss eine Liste sein.`,
      }
    }
  }
  if (!Array.isArray(store.partners)) {
    return {
      ...plan,
      ok: false,
      message: 'Die Datei ist kein Partner-Store - "partners" fehlt.',
    }
  }

  const problem = (entity, raw, message) =>
    plan.problems.push({
      entity,
      sourceId: raw && typeof raw === 'object' ? positiveInt(raw.id) : null,
      message,
    })

  // ---------------------------------------------------------------- partner
  const slugBySourceId = new Map()
  const seenSlugs = new Set()
  for (const raw of store.partners) {
    if (!raw || typeof raw !== 'object') {
      problem('partner', null, 'Ein Partner-Eintrag ist kein Objekt.')
      continue
    }
    const sourceId = positiveInt(raw.id)
    if (sourceId === null) {
      problem('partner', raw, 'Partner ohne gültige Kennung (id).')
      continue
    }
    if (typeof raw.name !== 'string' || raw.name.trim() === '') {
      problem('partner', raw, `Partner ${sourceId} hat keinen Namen.`)
      continue
    }
    const slug = slugify(raw.slug || raw.name)
    if (!slug) {
      problem('partner', raw, `Partner ${sourceId}: kein Kürzel ableitbar.`)
      continue
    }
    if (slugBySourceId.has(sourceId)) {
      problem('partner', raw, `Partner-Kennung ${sourceId} kommt doppelt vor.`)
      continue
    }
    if (seenSlugs.has(slug)) {
      problem('partner', raw, `Kürzel "${slug}" kommt doppelt vor.`)
      continue
    }
    seenSlugs.add(slug)
    slugBySourceId.set(sourceId, slug)
    plan.partners.push({
      sourceId,
      slug,
      attributes: partnerAttributes(raw, slug),
    })
  }

  // -------------------------------------------------------------- templates
  const seenTemplates = new Set()
  for (const raw of store.templates || []) {
    if (!raw || typeof raw !== 'object') {
      problem('template', null, 'Ein Vorlagen-Eintrag ist kein Objekt.')
      continue
    }
    const partnerSlug = slugBySourceId.get(positiveInt(raw.partnerId))
    if (!partnerSlug) {
      problem(
        'template',
        raw,
        `Vorlage für unbekannten Partner ${String(raw.partnerId)}.`
      )
      continue
    }
    const weekday = Number(raw.weekday)
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      problem(
        'template',
        raw,
        `Vorlage mit ungültigem Wochentag ${String(raw.weekday)} (erlaubt 1-7).`
      )
      continue
    }
    const key = `${partnerSlug}|${weekday}`
    if (seenTemplates.has(key)) {
      problem(
        'template',
        raw,
        `Vorlage für ${partnerSlug}, Wochentag ${weekday} kommt doppelt vor.`
      )
      continue
    }
    seenTemplates.add(key)
    plan.templates.push({
      sourceId: positiveInt(raw.id),
      partnerSlug,
      weekday,
      items: templateItems(raw.items),
      active: raw.active !== false,
    })
  }

  // ----------------------------------------------------------------- visits
  const seenVisits = new Set()
  const initialDays = new Set()
  const sorted = partnerStats.sortVisits(
    (store.visits || []).filter((v) => v && typeof v === 'object')
  )
  if (sorted.length !== (store.visits || []).length) {
    problem('visit', null, 'Ein Besuchs-Eintrag ist kein Objekt.')
  }
  for (const raw of sorted) {
    const label = `Besuch ${positiveInt(raw.id) ?? '?'}`
    const partnerSlug = slugBySourceId.get(positiveInt(raw.partnerId))
    if (!partnerSlug) {
      problem(
        'visit',
        raw,
        `${label}: unbekannter Partner ${String(raw.partnerId)}.`
      )
      continue
    }
    if (!partnerStats.VISIT_TYPES.includes(raw.visitType)) {
      problem(
        'visit',
        raw,
        `${label}: unbekannter Besuchstyp "${String(raw.visitType)}".`
      )
      continue
    }
    if (!partnerStats.isBusinessDate(raw.businessDate)) {
      problem(
        'visit',
        raw,
        `${label}: ungültiger Geschäftstag "${String(raw.businessDate)}".`
      )
      continue
    }
    const visitAt = new Date(raw.visitAt)
    if (
      raw.visitAt === undefined ||
      raw.visitAt === null ||
      Number.isNaN(visitAt.getTime())
    ) {
      problem('visit', raw, `${label}: ungültiger Zeitpunkt (visitAt).`)
      continue
    }
    const items = partnerStats.validateVisitItems(raw.items)
    if (!items.ok) {
      problem('visit', raw, `${label} (${raw.businessDate}): ${items.message}`)
      continue
    }
    const visit = {
      sourceId: positiveInt(raw.id),
      partnerSlug,
      businessDate: raw.businessDate,
      visitAt: visitAt.toISOString(),
      visitType: raw.visitType,
      sequence: positiveInt(raw.sequence),
      staffName: optionalString(raw.staffName),
      note: optionalString(raw.note),
      items: items.items,
    }
    visit.key = visitKey(visit)
    if (seenVisits.has(visit.key)) {
      problem(
        'visit',
        raw,
        `${label}: derselbe Besuch (Tag, Typ, Zeitpunkt) steht doppelt in der Datei.`
      )
      continue
    }
    const dayKey = `${partnerSlug}|${visit.businessDate}`
    if (visit.visitType === 'initial') {
      if (initialDays.has(dayKey)) {
        problem(
          'visit',
          raw,
          `${label}: zweite Erstbestückung am ${visit.businessDate} - es gibt nur eine je Tag.`
        )
        continue
      }
      initialDays.add(dayKey)
    }
    seenVisits.add(visit.key)
    plan.visits.push(visit)
  }

  return plan
}

/** Stammdaten gleich? (für `--update-partners`: nur echte Änderungen zählen) */
function sameAttributes(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

module.exports = {
  slugify,
  normalizeWeekdays,
  partnerAttributes,
  templateItems,
  visitKey,
  planImport,
  sameAttributes,
}
