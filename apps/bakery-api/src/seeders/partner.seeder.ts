import { Partner } from '../models'
// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

/** Fester Slug des ersten Verkaufspartners - auch von Tests referenziert. */
export const CAP_MARKT_SLUG = 'cap-markt-homburg-kirrberg'

/** Erwartete Id des CAP-Markts; nur auf einer leeren Tabelle erzwungen. */
export const CAP_MARKT_ID = 1

/**
 * Legt den CAP-Markt Homburg-Kirrberg als ersten Verkaufspartner an.
 *
 * Idempotent: gesucht wird über den Slug, ein vorhandener Datensatz wird nicht
 * überschrieben - Adress- und Kontaktdaten pflegt das Team in der App.
 * Es werden bewusst **keine** Wochentags-Vorlagen angelegt: die Standard-
 * Bestückung je Wochentag kennt nur die Backstube selbst.
 */
export async function runPartnerSeeder(): Promise<void> {
  try {
    // Check if Partner model exists before trying to use it
    if (!Partner) {
      logger.error('Partner model not found. Skipping partner seeding.')
      return
    }

    logger.info('Starting partner seeder...')

    // Auf einer leeren Tabelle bekommt der CAP-Markt die feste Id 1, damit
    // Links und Testdaten stabil bleiben. Sonst vergibt die DB die Id.
    const partnerCount = await Partner.count()
    const idDefault = partnerCount === 0 ? { id: CAP_MARKT_ID } : {}

    const [partner, created] = await Partner.findOrCreate({
      where: { slug: CAP_MARKT_SLUG },
      defaults: {
        ...idDefault,
        name: 'CAP-Markt Homburg-Kirrberg',
        slug: CAP_MARKT_SLUG,
        // Adresse und Ansprechpartner trägt das Team nach - hier wird nichts
        // erfunden, sonst landen Fantasiedaten im Partner-Report.
        street: '',
        zip: '',
        city: '',
        contactName: null,
        phone: null,
        email: null,
        // ISO-Wochentage: Dienstag bis Samstag.
        deliveryDays: [2, 3, 4, 5, 6],
        settlementModel: 'commission',
        active: true,
        notes:
          'Backschrank im Markt: Brot, Brötchen und Kaffeestückchen. Belieferung Di-Sa morgens, Nachlieferungen nach Bedarf. Abrechnung in Kommission zu HQ-Preisen.',
      },
    })

    if (created) {
      logger.info(
        `Created sales partner "${partner.name}" (id ${partner.id}, slug ${partner.slug})`
      )
    } else {
      logger.info(
        `Sales partner "${partner.name}" already exists (id ${partner.id}), skipping seed`
      )
    }
  } catch (error) {
    logger.error('Error seeding partners:', error)
    if (error instanceof Error) {
      logger.error(error.stack)
    }
  }
}
