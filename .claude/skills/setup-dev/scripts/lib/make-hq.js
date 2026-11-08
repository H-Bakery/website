#!/usr/bin/env node
/**
 * Writes a synthetic hq working tree into <dir> (must exist, may be a git clone):
 *   products/            copy of tools/e2e/hq-products (56 synthetic products)
 *   config/backzettel.yaml  every section, Saturday Hefeteig with fillings + variants
 *   data/recipes/fillings/test.md
 *   data/reports/converted/  8 weeks up to yesterday (Berlin), Mondays closed, one gap
 *   data/finance/finance-summary.json + config/targets.json (last 3 full months)
 * Nothing here is real data.
 *
 *   node make-hq.js <dir> [today=YYYY-MM-DD]
 */
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = process.env.TREE || process.cwd() // start.sh runs this from the worktree
const dir = path.resolve(process.argv[2])
const today =
  process.argv[3] ||
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(
    new Date()
  )

function w(rel, content) {
  const f = path.join(dir, rel)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(
    f,
    typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2) + '\n'
  )
}
function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isoWd = (date) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

// ---------------------------------------------------------------- products
const productsSrc = path.join(ROOT, 'tools/e2e/hq-products')
fs.mkdirSync(path.join(dir, 'products'), { recursive: true })
const catalog = []
for (const f of fs.readdirSync(productsSrc)) {
  fs.copyFileSync(path.join(productsSrc, f), path.join(dir, 'products', f))
  const txt = fs.readFileSync(path.join(productsSrc, f), 'utf8')
  const get = (k) => (txt.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1]
  catalog.push({
    id: get('id'),
    numeric_id: Number(get('numeric_id')),
    name: get('name'),
    price: Number(get('price')),
  })
}
const byId = Object.fromEntries(catalog.map((p) => [p.id, p]))

// ---------------------------------------------------------------- backzettel
w(
  'config/backzettel.yaml',
  `# Synthetische Backzettel-Stammdaten (bakery-dev) auf dem E2E-Katalog.
# Kein Wert stammt aus dem echten hq. Montag (1) ist Ruhetag.
version: 1
days: [2, 3, 4, 5, 6, 7]
sections: [vorbereitung, brot, broetchen, laugen, kaffeestueckchen, kuchen, hefeteig]
items:
  # --- Vorbereitung
  - id: sauerteig-ansatz
    name: Sauerteig-Ansatz
    section: vorbereitung
    unit: Liter
    base: { 2: 3, 3: 3.5, 4: 3, 5: 3, 6: 4, 7: 2 }
  # --- Brot
  - id: kornbrot
    name: Kornbrot
    section: brot
    unit: Liter
    products: [{ id: kornbrot-500g, factor: 0.5 }, { id: kornbrot-1000g, factor: 1 }]
    plu: [1, 2]
    pieces_per_liter: 2
    base: { 2: 4, 3: 4.5, 4: 4, 5: 4, 6: 2.25, 7: 2 }
  - id: brot-hell
    name: Musterbrot hell
    section: brot
    products: [{ id: musterbrot-hell-500g, factor: 1 }]
    plu: [3]
    base: { 2: 10, 3: 8, 4: 10, 5: 12, 6: 16, 7: 6 }
  - id: vollkorn
    name: Vollkornlaib
    section: brot
    unit: Liter
    products: [{ id: musterlaib-vollkorn-1000g, factor: 1 }]
    plu: [8]
    base: { 3: 2, 5: 2.5 }
  # --- Brötchen
  - id: musterweck
    name: Musterweck
    section: broetchen
    products: [{ id: musterweck, factor: 1 }]
    plu: [13]
    base: { 2: 40, 3: 30, 4: 40, 5: 40, 6: 60, 7: 80 }
  - id: semmel
    name: Mustersemmel
    section: broetchen
    products: [{ id: mustersemmel, factor: 1 }]
    plu: [15]
    base: { 2: 20, 3: 16, 4: 20, 5: 20, 6: 30, 7: 40 }
  # --- Laugen
  - id: brezel
    name: Musterbrezel
    section: laugen
    products: [{ id: musterbrezel, factor: 1 }]
    plu: [33]
    base: { 2: 20, 3: 16, 4: 20, 5: 20, 6: 24, 7: null }
  - id: laugenbroetchen
    name: Laugenbrötchen
    section: laugen
    products: [{ id: testbroetchen-laugen, factor: 1 }]
    plu: [20]
    base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 14, 7: 10 }
  # --- Kaffeestückchen
  - id: croissant
    name: Mustercroissant
    section: kaffeestueckchen
    products: [{ id: mustercroissant, factor: 1 }]
    plu: [25]
    tray: { no: [1, 2], per_tray: 12 }
    base: { 2: 12, 3: 10, 4: 12, 5: 12, 6: 24, 7: 18 }
  - id: plunder
    name: Probeplunder Apfel
    section: kaffeestueckchen
    products: [{ id: probeplunder-apfel, factor: 1 }]
    plu: [28]
    tray: { no: [3], per_tray: 10 }
    base: { 2: 10, 3: 8, 4: 10, 5: 10, 6: 0 }
  - id: berliner
    name: Musterberliner
    section: kaffeestueckchen
    products: [{ id: musterberliner, factor: 1 }]
    plu: [32]
    tray: { no: 4 }
    base: { 5: 12, 6: 20, 7: 12 }
  # --- Kuchen
  - id: marmor
    name: Marmorkuchen
    section: kuchen
    products:
      - { id: musterkuchen-marmor, factor: 1 }
      - { id: musterkuchen-marmor-1-stueck, factor: 0.25 }
    plu: [45, 40]
    base: { 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 2 }
  - id: apfelkuchen
    name: Apfelkuchen
    section: kuchen
    unit: Blech
    products:
      - { id: musterkuchen-apfel, factor: 1 }
      - { id: musterkuchen-apfel-1-stueck, factor: 0.25 }
    plu: [46, 41]
    base: { 5: 1, 6: 2, 7: 1 }
  # --- Hefeteig (Samstag)
  - id: kranz-gefuellt
    name: Kranz gefüllt
    section: hefeteig
    products:
      - { id: mustertorte-nuss, factor: 1 }
      - { id: probekuchen-nuss-1-stueck, factor: 0.25 }
    plu: [52, 44]
    variants: [nuss, mohn]
    dough: { id: hefeteig-test, piece_g: 600, pieces: 2 }
    filling_g: { nuss: 1000, mohn: 800 }
    base: { 6: { nuss: 3, mohn: 1 } }
  - id: zopf-gefuellt
    name: Zopf gefüllt
    section: hefeteig
    products: [{ id: probekuchen-streusel, factor: 1 }]
    plu: [47]
    variants: [nuss, mohn, apfel]
    dough: { id: hefeteig-test, piece_g: 500, pieces: 1 }
    filling_g: 400
    base: { 6: { nuss: 4, mohn: 2, apfel: null } }
  - id: hefezopf
    name: Hefezopf
    section: hefeteig
    products: [{ id: probekuchen-zwetschge-1-stueck, factor: 1 }]
    plu: [43]
    dough: { id: hefeteig-test, piece_g: 300, pieces: 3 }
    base: { 6: 3, 7: 2 }
doughs:
  - { id: hefeteig-test, name: Hefeteig (Test), batch_max_kg: 10 }
fillings:
  - { id: nuss, name: Nussfüllung, recipe: data/recipes/fillings/test.md, section: Nussfüllung }
  - { id: mohn, name: Mohnfüllung, recipe: data/recipes/fillings/test.md, section: Mohnfüllung }
  - { id: apfel, name: Apfelfüllung, recipe: data/recipes/fillings/test.md, section: Apfelfüllung }
prep:
  - { id: sauerteig, name: Sauerteig, by_weekday: { 3: buttermilch, 6: false, default: misch }, variant_labels: { misch: Mischsauerteig } }
  - { id: bruehstueck, name: Brühstück Vollkorn, when_item: vollkorn }
  - { id: wagen, name: Kaffeestückchen-Wagen, days: [2, 3, 4, 5] }
  - { id: hefeteig-ansetzen, name: Hefeteig ansetzen, by_weekday: { 6: gross }, variant_labels: { gross: groß } }
`
)

w(
  'data/recipes/fillings/test.md',
  `# Testfüllungen (synthetisch)

### Nussfüllung
| Zutat            | Menge    |
|------------------|----------|
| Nüsse (gemahlen) | 1.000 g  |
| Zucker           | 400 g    |
| Wasser           | 600 ml   |

---

### Mohnfüllung
| Zutat        | Menge               |
|--------------|---------------------|
| Mohn         | 1,5 kg              |
| Zucker       | 400 g (nach Bedarf) |
| Grieß        | 100 g               |

---

### Apfelfüllung
| Zutat      | Menge             |
|------------|-------------------|
| Äpfel      | 1 Dose (ca. 2 kg) |
| Zitrone    | 2–4 g             |
| Zucker     | 200 g             |
`
)

// ---------------------------------------------------------------- reports
// Deterministic PRNG so every instance gets the same numbers for the same day.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const SOLD = [
  // [product id, weight]
  ['kornbrot-500g', 3],
  ['kornbrot-1000g', 2],
  ['musterbrot-hell-500g', 3],
  ['musterlaib-vollkorn-1000g', 1],
  ['musterweck', 10],
  ['mustersemmel', 6],
  ['musterbrezel', 6],
  ['testbroetchen-laugen', 3],
  ['mustercroissant', 4],
  ['probeplunder-apfel', 2],
  ['musterberliner', 2],
  ['musterkuchen-marmor-1-stueck', 2],
  ['musterkuchen-apfel-1-stueck', 2],
  ['probekuchen-zwetschge-1-stueck', 1],
  ['probekuchen-nuss-1-stueck', 1],
  ['musterbaguette-klein', 2],
  ['probestange-pizza', 1],
  ['kaesekuchen-1-stueck', 1],
]
const totalWeight = SOLD.reduce((s, [, wgt]) => s + wgt, 0)
const DAY_TARGET = { 2: 200, 3: 160, 4: 215, 5: 260, 6: 390, 7: 170 }
const round2 = (x) => Math.round(x * 100) / 100

function pick(r) {
  let x = r() * totalWeight
  for (const [id, wgt] of SOLD) {
    if ((x -= wgt) < 0) return byId[id]
  }
  return byId[SOLD[0][0]]
}
function line(p, q) {
  return {
    product: p.name,
    product_id: String(p.numeric_id),
    quantity: q,
    price: p.price,
    total: round2(p.price * q),
  }
}
function bonsFor(date) {
  const r = rng(Number(date.replace(/-/g, '')))
  const target = DAY_TARGET[isoWd(date)] * (0.75 + r() * 0.5)
  const bons = []
  let revenue = 0
  let n = 0
  while (revenue < target) {
    n++
    const items = []
    const lines = 1 + Math.floor(r() * 3)
    for (let i = 0; i < lines; i++) {
      const p = pick(r)
      const q = p.price < 1 ? 2 + Math.floor(r() * 6) : 1 + Math.floor(r() * 2)
      items.push(line(p, q))
    }
    const roll = r()
    const payment = roll < 0.55 ? 'Bar' : roll < 0.95 ? 'Unbar' : 'Keine'
    const total = round2(items.reduce((s, i) => s + i.total, 0))
    const hh = String(6 + (Math.floor((n * 7) / 10) % 7)).padStart(2, '0')
    const mm = String((n * 13) % 60).padStart(2, '0')
    bons.push({
      id: `T-${date}-${n}`,
      timestamp: `${date}T${hh}:${mm}:00+01:00`,
      type: 'sale',
      user: 'Kasse',
      payment,
      total,
      items,
    })
    revenue += total
  }
  // one cancelled receipt (not counted) and, every few days, a storno pair
  const p = byId['musterweck']
  bons.push({
    id: `T-${date}-x`,
    timestamp: `${date}T09:59:00+01:00`,
    type: 'cancelled',
    user: 'Kasse',
    payment: 'Bar',
    total: round2(p.price * 4),
    items: [line(p, 4)],
  })
  if (r() < 0.3) {
    const s = byId['mustercroissant']
    bons.push({
      id: `T-${date}-s1`,
      timestamp: `${date}T10:01:00+01:00`,
      type: 'sale',
      user: 'Kasse',
      payment: 'Bar',
      total: s.price,
      items: [line(s, 1)],
    })
    bons.push({
      id: `T-${date}-s2`,
      timestamp: `${date}T10:02:00+01:00`,
      type: 'storno',
      user: 'Kasse',
      payment: 'Bar',
      total: -s.price,
      items: [{ ...line(s, -1), total: -s.price }],
    })
  }
  return bons
}

const firstDay = addDays(today, -56)
const yesterday = addDays(today, -1)
// one trading day without an export (a gap, not 0 €): the Thursday 3 weeks ago
let missingDay = addDays(today, -21)
while (isoWd(missingDay) !== 4) missingDay = addDays(missingDay, -1)
const reportDates = []
for (let d = firstDay; d <= yesterday; d = addDays(d, 1)) {
  if (isoWd(d) === 1 || d === missingDay) continue
  reportDates.push(d)
  w(`data/reports/converted/${d}_4711.json`, {
    date: d,
    register_id: '4711',
    report_number: 1,
    company: 'Testbäckerei',
    transactions: bonsFor(d),
  })
  if (isoWd(d) === 6) {
    const k = byId['musterkuchen-marmor']
    w(`data/reports/converted/${d}_4711_2.json`, {
      date: d,
      register_id: '4711',
      report_number: 2,
      company: 'Testbäckerei',
      transactions: [
        {
          id: `T-${d}-z`,
          timestamp: `${d}T12:30:00+01:00`,
          type: 'sale',
          user: 'Kasse',
          payment: 'Unbar',
          total: k.price,
          items: [line(k, 1)],
        },
      ],
    })
  }
}

// ---------------------------------------------------------------- finance
const { buildSyntheticSummary } = require(path.join(
  ROOT,
  'apps/bakery-api/tests/fixtures/finance-summary.synthetic.js'
))
const summary = buildSyntheticSummary()
// shift the three fixture months (2026-01..03) onto the last three full months
const m0 = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
const months = [3, 2, 1].map((back) => {
  const d = new Date(m0)
  d.setUTCMonth(d.getUTCMonth() - back)
  return d.toISOString().slice(0, 7)
})
const map = { '2026-01': months[0], '2026-02': months[1], '2026-03': months[2] }
summary.months.forEach((m) => (m.month = map[m.month]))
summary.uncategorized.transactions.forEach(
  (t) => (t.date = map[t.date.slice(0, 7)] + t.date.slice(7))
)
const lastOfMonth = (ym) => {
  const d = new Date(`${ym}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}
summary.period = { from: `${months[0]}-01`, to: lastOfMonth(months[2]) }
summary.generated_at = `${today.slice(0, 7)}-01T08:00:00+01:00`
w('data/finance/finance-summary.json', summary)
w('data/finance/config/targets.json', {
  schema_version: 1,
  updated: `${today.slice(0, 7)}-01`,
  mode: 'derived',
  cost_window_months: 3,
  variable_categories: ['wareneinsatz'],
  non_pos_revenue_monthly: null,
  private_draw_monthly: null,
  business_days_per_month: 24,
  weekday_window_months: 2,
  thresholds: { green: 1.0, amber: 0.9 },
  closed_weekdays: [1],
})
w(
  'README.md',
  '# Synthetisches hq (bakery-dev)\n\nErfundene Daten für die Browser-Verifikation. Nichts davon ist echt.\n'
)

console.log(
  JSON.stringify({
    today,
    reports: {
      from: reportDates[0],
      to: reportDates[reportDates.length - 1],
      days: reportDates.length,
      missingDay,
    },
    financeMonths: months,
  })
)
