/**
 * Absenderdaten der Bäckerei für Dokumente aus der Verwaltung (Preisliste).
 *
 * Die Angaben stehen genau einmal: in `LEGAL` (`@bakery/shared/utils`,
 * `lib/legal.ts`), aus dem auch das Impressum der Landing Page gebaut wird.
 * Hier wird nichts abgetippt, nur ausgewählt - ändert sich die Telefonnummer
 * dort, stimmt sie hier mit.
 */
import { LEGAL } from '@bakery/shared/utils'

export interface Seller {
  name: string
  street: string
  postalCode: string
  city: string
  phone: string
  email: string
}

export const SELLER: Seller = {
  name: LEGAL.companyName,
  street: LEGAL.address.street,
  postalCode: LEGAL.address.postalCode,
  city: LEGAL.address.city,
  phone: LEGAL.phone,
  email: LEGAL.email,
}
