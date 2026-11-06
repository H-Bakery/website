/**
 * Erfundene Daten für die Grundmengen (Z4): eine von Hand geschriebene
 * `backzettel.yaml` im Stil der echten Datei (Kommentare, Prettier-Flow
 * `{ 2: 6 }`, `null` = offen) und ein Baukasten für Kassenberichte im
 * Format von `hq/data/reports/converted/`.
 *
 * Nichts davon stammt aus dem privaten hq: Produkte sind die synthetischen
 * E2E-Produkte (`tools/e2e/hq-products`), Kassennummern 9xx, Mengen rund.
 */

/** Produktdateien aus `tools/e2e/hq-products`, auf die die YAML verweist. */
const PRODUCT_FILES = [
  '1-kornbrot-500g.md',
  '2-kornbrot-1000g.md',
  '13-musterweck.md',
  '15-mustersemmel.md',
  '21-musterbaguette-klein.md',
]

const CONFIG_YAML = `# Backzettel - Stammdaten (synthetisch, Tests Z4)
#
# Grundmenge null = „noch nicht festgelegt“, 0 = „wird nicht gebacken“.

version: 1

days: [2, 3, 4, 5, 6, 7]

sections: [brot, broetchen, kaffeestueckchen, hefeteig]

items:
  # ---------------------------------------------------------------------------
  # Brot - in Liter
  # ---------------------------------------------------------------------------
  - id: kornbrot
    name: Kornbrot
    section: brot
    unit: Liter
    products: [{ id: kornbrot-500g, factor: 0.5 }, { id: kornbrot-1000g, factor: 1 }]
    plu: [901, 902]
    base: { 2: 4, 3: 4, 4: 4, 5: 4, 6: null } # OFFEN: Samstag

  # Brötchen
  - id: musterweck
    name: Musterweck
    section: broetchen
    products: [{ id: musterweck, factor: 1 }]
    plu: [903]
    base:
      2: 40
      3: 30 # Mittwoch schwächer
      4: 40
      6: 60

  - id: mustersemmel
    name: Mustersemmel
    section: broetchen
    products: [{ id: mustersemmel, factor: 1 }]
    plu: [904]
    # noch keine Grundmengen

  - id: plunder
    name: Plunder
    section: kaffeestueckchen
    tray: { no: [7, 8], per_tray: 10 }
    base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 0 }

  # Hefeteig - Samstag
  - id: zopf-gefuellt
    name: Zopf gefüllt
    section: hefeteig
    plu: [905]
    variants: [nuss, mohn]
    dough: { id: hefeteig-test, piece_g: 500, pieces: 1 }
    filling_g: 400
    base: { 6: { nuss: 4, mohn: null } }

doughs: [{ id: hefeteig-test, name: Hefeteig (Test), batch_max_kg: 10 }]

fillings:
  - { id: nuss, name: Nussfüllung }
  - { id: mohn, name: Mohnfüllung }
`

/**
 * Ein Tagesfile wie `converted/YYYY-MM-DD_<Kasse>.json`.
 * `transactions`: `[{ type?, items: [[plu, qty], …] }]`.
 */
function convertedReport(date, transactions, register = '90000001') {
  let id = 1000
  return {
    date,
    register_id: register,
    report_number: 1,
    company: 'Testbäckerei',
    transactions: transactions.map((tx) => {
      id += 1
      const items = tx.items.map(([plu, qty]) => ({
        product: `Testprodukt ${plu}`,
        product_id: String(plu),
        quantity: qty,
        price: 1,
        total: qty,
      }))
      return {
        id: String(id),
        timestamp: `${date}T08:00:00+01:00`,
        type: tx.type || 'sale',
        user: 'Test',
        items,
        total: items.reduce((s, i) => s + i.total, 0),
        payment: 'Bar',
      }
    }),
    daily_summary: {},
  }
}

module.exports = { PRODUCT_FILES, CONFIG_YAML, convertedReport }
