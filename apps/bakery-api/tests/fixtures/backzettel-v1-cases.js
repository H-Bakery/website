/**
 * v1-Konfigurationen (Z1-Schema ohne die Z10-Schlüssel) für den
 * Regressionstest des Validators: Fehler und Warnungen dieser Fälle sind in
 * `backzettel-v1-validation.recorded.json` mit dem Validator **vor** Z10
 * aufgezeichnet. Z10 darf daran nichts ändern (docs/backzettel-v2.md §10 S1).
 *
 * Nur erfundene Werte (Basis: `config()` aus `backzettel.synthetic.js`).
 * Neue Fälle hier nur zusammen mit einer neuen Aufnahme des alten Validators
 * ergänzen - sonst nimmt die Aufnahme das neue Verhalten auf.
 */
const { config } = require('./backzettel.synthetic')

function withItem(index, patch) {
  const cfg = config()
  cfg.items[index] = { ...cfg.items[index], ...patch }
  return cfg
}

const V1_CASES = {
  gueltig: () => config(),
  'version-2': () => config({ version: 2 }),
  'days-leer': () => config({ days: [] }),
  'days-doppelt-und-ausserhalb': () => config({ days: [0, 2, 2, 3, 8] }),
  'abschnitt-unbekannt': () =>
    config({ sections: ['brot', 'torten', 'brot', 'hefeteig'] }),
  'unbekannte-schluessel': () => {
    const cfg = config({ extra: 1 })
    cfg.items[0].bsae = { 2: 1 }
    cfg.prep[0].wann = 'immer'
    return cfg
  },
  'teig-ohne-chargengroesse-fehlt': () => {
    const cfg = config()
    delete cfg.doughs[0].batch_max_kg
    return cfg
  },
  'teig-chargengroesse-ungueltig': () => {
    const cfg = config()
    cfg.doughs[0].batch_max_kg = -2
    return cfg
  },
  'produkt-unbekannt-und-doppelt': () => {
    const cfg = config()
    cfg.items[0].products = [{ id: 'gibt-es-nicht', factor: 0 }]
    cfg.items[2].products = [{ id: 'test-plunder', factor: 1 }]
    return cfg
  },
  'produkt-nicht-verfuegbar': () =>
    withItem(0, { products: [{ id: 'test-alt', factor: 1 }] }),
  'varianten-kaputt': () => withItem(5, { variants: ['nuss', 'nuss', 'Mohn'] }),
  'grundmengen-kaputt': () =>
    withItem(2, { base: { 1: 4, 2: 10.5, 3: -1, 4: '10', montag: 3 } }),
  'grundmenge-je-variante-ohne-varianten': () =>
    withItem(2, { base: { 2: { nuss: 1 } } }),
  'gefuellt-ohne-variante-je-tag': () => withItem(5, { base: { 6: 5 } }),
  'gefuellt-grundmenge-null': () => withItem(5, { base: { 6: null } }),
  'variante-unbekannt': () =>
    withItem(5, { base: { 6: { nuss: 1, marzipan: 2.5 } } }),
  'teig-kaputt': () =>
    withItem(5, { dough: { id: 'unbekannt', piece_g: 0, pieces: 1.5 } }),
  'teig-kein-objekt': () => withItem(5, { dough: 'hefeteig-test' }),
  'fuellung-kaputt': () => withItem(5, { filling_g: { nuss: 0, schoko: 100 } }),
  'fuellung-ohne-varianten': () => withItem(2, { filling_g: 300 }),
  'fuellung-variante-null': () => withItem(5, { filling_g: { nuss: null } }),
  'fuellung-ohne-rezept': () => {
    const cfg = config()
    cfg.fillings = cfg.fillings.filter((f) => f.id !== 'mohn')
    return cfg
  },
  'blech-kaputt-und-doppelt': () => {
    const cfg = withItem(3, { tray: { no: [1, 1], per_tray: 0 } })
    cfg.items[4].tray = { no: 8 }
    return cfg
  },
  'blech-doppelt-vergeben': () => withItem(4, { tray: { no: 8 } }),
  'plu-kaputt-und-doppelt': () => {
    const cfg = withItem(3, { plu: ['906', 906] })
    cfg.items[2].plu = [906]
    return cfg
  },
  'stueck-je-liter': () => withItem(2, { pieces_per_liter: 3 }),
  'stueck-je-liter-ungueltig': () => withItem(0, { pieces_per_liter: 0 }),
  'posten-ohne-alles': () => withItem(4, { base: undefined }),
  'rezeptpfad-ausserhalb': () => {
    const cfg = config()
    cfg.fillings[0].recipe = '../../../etc/passwd'
    cfg.fillings[1].recipe = 7
    return cfg
  },
  'vorbereitung-kaputt': () => {
    const cfg = config()
    cfg.prep.push({ id: 'sauerteig' })
    cfg.prep.push({ id: 'x', when_item: 'gibt-es-nicht' })
    cfg.prep.push({ id: 'y', by_weekday: { 1: 'misch', sonntag: 'x' } })
    cfg.prep.push({ id: 'z', days: [1] })
    cfg.prep.push({ id: 'l1', variant_labels: ['groß'] })
    cfg.prep.push({ id: 'l2', variant_labels: { gross: '  ' } })
    return cfg
  },
}

module.exports = { V1_CASES }
