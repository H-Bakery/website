/**
 * Verkäuferangaben für Rechnungen.
 *
 * Name, Anschrift, USt-IdNr., Telefon und E-Mail kommen aus der einen Stelle,
 * die auch das Impressum der Website und die Preisliste speist (`LEGAL` in
 * `libs/shared/utils/src/lib/legal.ts`, hier einzeln eingebunden als
 * `@bakery/shared/legal`, weil das Barrel `@bakery/shared/utils` React
 * mitbringt) - nicht abgetippt.
 *
 * Die Bankverbindung ist nicht öffentlich und steht deshalb nicht im Repo: sie
 * kommt aus der Umgebung der Box (`/etc/bakery/bakery.env`, docs/runbook.md):
 *
 *   INVOICE_IBAN, INVOICE_BIC, INVOICE_ACCOUNT_HOLDER   Pflicht zum Ausstellen
 *   INVOICE_BANK_NAME                                   optional (nur Druck)
 *
 * Fehlt etwas davon, bleiben die Felder leer; `invoice.core.js` `bankErrors()`
 * verweigert dann das Ausstellen mit einer deutschen Meldung. Es gibt keinen
 * Platzhalter.
 */
import { LEGAL } from '@bakery/shared/legal'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require('./invoice.core')

export interface InvoiceSeller {
  /** Vollständiger Name des leistenden Unternehmers (§ 14 Abs. 4 Nr. 1 UStG). */
  name: string
  street: string
  postcode: string
  city: string
  /** ISO 3166-1 alpha-2 */
  countryCode: string
  vatId: string
  phone: string
  email: string
  iban: string
  bic: string
  accountHolder: string
  bankName: string
}

type Env = Record<string, string | undefined>

function value(env: Env, key: string): string {
  return (env[key] ?? '').trim()
}

/** Der Verkäufer, wie er jetzt eingerichtet ist (wird je Aufruf neu gelesen). */
export function currentSeller(env: Env = process.env): InvoiceSeller {
  return {
    name: `${LEGAL.companyName}, Inh. ${LEGAL.owner}`,
    street: LEGAL.address.street,
    postcode: LEGAL.address.postalCode,
    city: LEGAL.address.city,
    countryCode: LEGAL.address.countryCode,
    vatId: LEGAL.vatId,
    phone: LEGAL.phone,
    email: LEGAL.email,
    iban: core.normalizeIban(value(env, 'INVOICE_IBAN')),
    bic: value(env, 'INVOICE_BIC').toUpperCase(),
    accountHolder: value(env, 'INVOICE_ACCOUNT_HOLDER'),
    bankName: value(env, 'INVOICE_BANK_NAME'),
  }
}
