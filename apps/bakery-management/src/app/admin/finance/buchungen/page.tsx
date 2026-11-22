import React from 'react'
import BuchungenClient, { type BuchungenQuery } from './BuchungenClient'

/**
 * Buchungsliste des Geschäftskontos (nur Inhaber mit Passwort-Sitzung).
 *
 * Query-Parameter:
 *   `?monat=JJJJ-MM`      - Monat (Vorgabe: jüngster mit Bankdaten)
 *   `?kategorie=<schlüssel>` - eine Kategorie aus hq `config/categories.json`
 *   `?richtung=ein|aus`   - nur Eingänge / nur Ausgänge
 *   `?suche=…`            - Name, Verwendungszweck oder Betrag
 */
export default async function BuchungenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const one = (key: string) => {
    const value = params[key]
    const text = Array.isArray(value) ? value[0] : value
    return text ? text : undefined
  }
  const richtung = one('richtung')
  const query: BuchungenQuery = {
    monat: one('monat'),
    kategorie: one('kategorie'),
    richtung: richtung === 'ein' || richtung === 'aus' ? richtung : undefined,
    suche: one('suche'),
  }
  return <BuchungenClient query={query} />
}
