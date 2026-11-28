/**
 * Synthetische Monatsdateien `transactions/JJJJ-MM.json` für Tests. Alle
 * Namen, Beträge, Kontonummern und Referenzen sind erfunden - kein einziger
 * Wert aus dem privaten `hq`-Repo.
 */

'use strict'

const FAKE_COUNTERPARTY_IBAN = 'DE00000000000000004711'
const FAKE_OWN_IBAN = 'DE00000000000000000001'
const FAKE_MANDATE = 'MANDAT-BEISPIEL-001'
const FAKE_CREDITOR_ID = 'DE00ZZZ00000000001'
const FAKE_E2E = 'E2E-BEISPIEL-42'

function tx(spec) {
  return {
    account: FAKE_OWN_IBAN,
    booking_date: spec.date,
    value_date: spec.date,
    booking_text: spec.text || 'GUTSCHRIFT',
    purpose: spec.purpose || '',
    counterparty: spec.counterparty || '',
    counterparty_iban:
      spec.iban === undefined ? FAKE_COUNTERPARTY_IBAN : spec.iban,
    counterparty_bic: 'BEISPIELXXX',
    creditor_id: spec.mandate ? FAKE_CREDITOR_ID : '',
    mandate_reference: spec.mandate ? FAKE_MANDATE : '',
    end_to_end_reference: FAKE_E2E,
    amount: spec.amount,
    currency: 'EUR',
    status: spec.status || 'gebucht',
    source: 'beispiel/umsatz.CSV',
    id: spec.id,
    classification: {
      category: spec.category,
      subcategory: spec.subcategory || null,
      flow: 'betrieblich',
      rule: 1,
      note: spec.note || null,
    },
  }
}

function monthFile(month, transactions) {
  return {
    month,
    schema_version: 1,
    generated_at: '2026-01-31T12:00:00',
    transaction_count: transactions.length,
    net_change:
      Math.round(transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100,
    transactions,
  }
}

/** Zwei Monate, eine Gegenseite kommt in beiden vor. */
function buildSyntheticTransactionMonths() {
  return {
    '2026-01': monthFile('2026-01', [
      tx({
        id: 'aaaa000000000001',
        date: '2026-01-05',
        amount: -120.5,
        counterparty: 'Beispiel-Großhandel GmbH',
        purpose: 'RE-0001 Mehl und Hefe',
        text: 'FOLGELASTSCHRIFT',
        category: 'wareneinsatz',
        subcategory: 'backmittel_grosshandel',
        mandate: true,
      }),
      tx({
        id: 'aaaa000000000002',
        date: '2026-01-07',
        amount: 800,
        counterparty: 'Erika Beispielfrau',
        purpose: 'Bareinzahlung Filiale',
        text: 'BAREINZAHLUNG',
        category: 'umsatz_laden',
        subcategory: 'bar',
      }),
    ]),
    '2026-02': monthFile('2026-02', [
      tx({
        id: 'bbbb000000000001',
        date: '2026-02-03',
        amount: -99.99,
        counterparty: 'Beispiel-Großhandel GmbH',
        purpose: 'RE-0002 Zucker',
        text: 'FOLGELASTSCHRIFT',
        category: 'wareneinsatz',
        subcategory: 'backmittel_grosshandel',
        mandate: true,
      }),
      tx({
        id: 'bbbb000000000002',
        date: '2026-02-10',
        amount: 1250,
        counterparty: 'Max Beispielmann',
        purpose: 'Kartenumsätze Januar',
        category: 'umsatz_laden',
        subcategory: 'karte',
      }),
      tx({
        id: 'bbbb000000000003',
        date: '2026-02-10',
        amount: -12.5,
        counterparty: 'Unbekannte Beispiel AG',
        purpose: 'Rechnung 77',
        text: 'UEBERWEISUNG',
        category: 'unkategorisiert',
        iban: null,
      }),
      // Kaputte Zeile: ohne ID - darf nie erscheinen.
      { booking_date: '2026-02-11', amount: 5, counterparty: 'Ohne ID' },
    ]),
  }
}

/** Passende Bezeichnungen wie in `finance-summary.json`. */
const SYNTHETIC_LABELS = {
  category_labels: {
    wareneinsatz: 'Wareneinsatz',
    umsatz_laden: 'Ladenumsatz',
    unkategorisiert: 'Nicht zugeordnet',
  },
  category_kinds: {
    wareneinsatz: 'ausgabe',
    umsatz_laden: 'einnahme',
    unkategorisiert: 'offen',
  },
  subcategory_labels: {
    backmittel_grosshandel: 'Backmittel (Großhandel)',
    bar: 'Bar',
    karte: 'Karte',
  },
}

module.exports = {
  FAKE_COUNTERPARTY_IBAN,
  FAKE_OWN_IBAN,
  FAKE_MANDATE,
  FAKE_CREDITOR_ID,
  FAKE_E2E,
  SYNTHETIC_LABELS,
  buildSyntheticTransactionMonths,
}
