// Seeds one bakery-dev instance through the real API and writes <instance>/world.json.
//   node seed.mjs <instanceDir> <mgmtUrl> <apiPort> <ghPort> <secondUrl> <secondKind> <mode>
// All names, phones and numbers are invented.
import fs from 'node:fs'
import { seedNext } from './seed-next.mjs'

const [I, WEB_URL, API_PORT, GH_PORT, SECOND_URL, SECOND_KIND, MODE] =
  process.argv.slice(2)
const API = `http://127.0.0.1:${API_PORT}`
const WEB = WEB_URL
const WEB_PORT = new URL(WEB_URL).port

async function call(method, path, { token, station, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(station ? { 'x-station-token': station } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}
async function must(method, path, opts, expect = [200, 201]) {
  const r = await call(method, path, opts)
  if (!expect.includes(r.status)) {
    throw new Error(
      `${method} ${path} -> ${r.status} ${JSON.stringify(r.json)}`
    )
  }
  return r.json
}

// ---------------------------------------------------------------- dates (Berlin)
const berlin = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isoWd = (date) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}
const today = berlin()
const PRODUCTION_WEEKDAYS = [2, 3, 4, 5, 6, 7] // backzettel.yaml `days`
const productionDays = []
for (let d = today; productionDays.length < 7; d = addDays(d, 1)) {
  if (PRODUCTION_WEEKDAYS.includes(isoWd(d))) productionDays.push(d)
}
const saturday = productionDays.find((d) => isoWd(d) === 6)
const d0 = productionDays[0]
const others = productionDays.filter((d) => d !== d0 && d !== saturday)

// ---------------------------------------------------------------- users
const USERS = {
  inhaber: {
    username: 'verify.inhaber',
    password: 'Verify-Inhaber-2026',
    pin: '1357',
    displayName: 'Ines Inhaber',
    role: 'inhaber',
  },
  verkauf: {
    username: 'verify.verkauf',
    password: 'Verify-Verkauf-2026',
    pin: '2468',
    displayName: 'Vera Verkauf',
    role: 'verkauf',
  },
  backstube: {
    username: 'verify.backstube',
    password: 'Verify-Backstube-2026',
    pin: '0420',
    displayName: 'Bernd Backstube',
    role: 'backstube',
  },
  fahrer: {
    username: 'verify.fahrer',
    password: 'Verify-Fahrer-2026',
    pin: '9753',
    displayName: 'Fritz Fahrer',
    role: 'fahrer',
  },
  verkauf2: {
    username: 'verify.verkauf2',
    password: 'Verify-Verkauf2-2026',
    pin: '8642',
    displayName: 'Valentin Verkauf',
    role: 'verkauf',
  },
  // second driver (linked to driver 2) and a fahrer account with no driver row
  fahrer2: {
    username: 'verify.fahrer2',
    password: 'Verify-Fahrer2-2026',
    pin: '8531',
    displayName: 'Frieda Fahrerin',
    role: 'fahrer',
  },
  fahrer3: {
    username: 'verify.fahrer3',
    password: 'Verify-Fahrer3-2026',
    pin: '7319',
    displayName: 'Fabian ohne Tour',
    role: 'fahrer',
  },
}
const login = async (u) =>
  (
    await must('POST', '/api/auth/login', {
      body: { username: u.username, password: u.password },
    })
  ).data.token

const owner = await login(USERS.inhaber)
USERS.inhaber.id = (await must('GET', '/api/auth/me', { token: owner })).data.id
for (const key of [
  'verkauf',
  'backstube',
  'fahrer',
  'verkauf2',
  'fahrer2',
  'fahrer3',
]) {
  const u = USERS[key]
  const r = await must('POST', '/api/users', {
    token: owner,
    body: {
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      password: u.password,
      pin: u.pin,
    },
  })
  u.id = r.data.id
  console.log('user', u.username, u.id)
}

// ---------------------------------------------------------------- station
const stations = []
for (const name of ['Laden-Tablet (Test)', 'Backstube-Tablet (Test)']) {
  const st = await must('POST', '/api/auth/stations', {
    token: owner,
    body: { name },
  })
  stations.push({
    id: st.data.station.id,
    name: st.data.station.name,
    token: st.data.token,
  })
}
const station = stations[0]
const stationUsers = await must('GET', '/api/auth/station/users', {
  station: station.token,
})
console.log(
  'stations',
  stations.map((s) => s.id).join(','),
  'users with PIN:',
  stationUsers.data.length
)

// ---------------------------------------------------------------- pickup points
const sale = await login(USERS.verkauf)
const points = (
  await must('GET', '/api/preorders/pickup-points', { token: sale })
).data
const moersbach = points.find((p) => p.id === 'kindergarten-moersbach')
if (!moersbach) throw new Error('Mörsbach pickup point not seeded')
const oberdorf = points.find((p) => p.id === 'gemeindehaus-oberdorf')
const altdorf = points.find((p) => p.id === 'turnhalle-altdorf')
if (!oberdorf || !altdorf)
  throw new Error(
    'extra pickup points not imported (start.sh import-preorders step)'
  )
const pointSummary = (p) => ({
  id: p.id,
  name: p.name,
  weekday: p.weekday,
  window: p.window,
  active: p.active,
  orderDeadline: p.orderDeadline ?? null,
})

// ---------------------------------------------------------------- partner (seeded CAP) + template + 2 visits
const partners = await must('GET', '/api/partners', { token: owner })
const partnerList = Array.isArray(partners) ? partners : partners.data
const partner = partnerList[0]
const templateItems = [
  { productSlug: 'musterweck', quantity: 20 },
  { productSlug: 'kornbrot-500g', quantity: 4 },
  { productSlug: 'mustercroissant', quantity: 6 },
  { productSlug: 'musterbrezel', quantity: 10 },
]
const templateWeekdays =
  partner.deliveryDays && partner.deliveryDays.length
    ? partner.deliveryDays
    : [2, 3, 4, 5, 6]
for (const wd of templateWeekdays) {
  await must('PUT', `/api/partners/${partner.id}/templates/${wd}`, {
    token: owner,
    body: {
      items:
        wd === 6
          ? templateItems.map((i) => ({ ...i, quantity: i.quantity * 2 }))
          : templateItems,
    },
  })
}
// last delivery day before today -> a complete day (initial + pickup)
let visitDay = addDays(today, -1)
while (!templateWeekdays.includes(isoWd(visitDay)))
  visitDay = addDays(visitDay, -1)
const driver = await login(USERS.fahrer)
const v1 = await must('POST', `/api/partners/${partner.id}/visits`, {
  token: driver,
  body: {
    businessDate: visitDay,
    visitAt: `${visitDay}T05:30:00.000Z`,
    visitType: 'initial',
    items: templateItems.map((i) => ({
      productSlug: i.productSlug,
      deliveredQty: i.quantity,
    })),
  },
})
const v2 = await must('POST', `/api/partners/${partner.id}/visits`, {
  token: driver,
  body: {
    businessDate: visitDay,
    visitAt: `${visitDay}T17:45:00.000Z`,
    visitType: 'pickup',
    note: 'Abholung (synthetisch)',
    items: [
      { productSlug: 'musterweck', countedQty: 3 },
      { productSlug: 'kornbrot-500g', countedQty: 1 },
      { productSlug: 'mustercroissant', countedQty: 0 },
      { productSlug: 'musterbrezel', countedQty: 2 },
    ],
  },
})
const visitData = (v) => v.data ?? v
console.log('partner', partner.id, 'visits', visitData(v1).id, visitData(v2).id)
// r6 (W4-verify r5 fix: sell-through only over days with a pickup, open days as openQty):
// a second complete day one week earlier (weekday means) and an OPEN day (initial only)
// on the latest delivery day after visitDay up to today - or, if none, a week before the
// complete one. Geliefert = Verkauft + Retoure + Offen must add up.
const visitDay2 = addDays(visitDay, -7)
const v3 = await must('POST', `/api/partners/${partner.id}/visits`, {
  token: driver,
  body: {
    businessDate: visitDay2,
    visitAt: `${visitDay2}T05:30:00.000Z`,
    visitType: 'initial',
    items: templateItems.map((i) => ({
      productSlug: i.productSlug,
      deliveredQty: i.quantity,
    })),
  },
})
const v4 = await must('POST', `/api/partners/${partner.id}/visits`, {
  token: driver,
  body: {
    businessDate: visitDay2,
    visitAt: `${visitDay2}T17:40:00.000Z`,
    visitType: 'pickup',
    items: [
      { productSlug: 'musterweck', countedQty: 5 },
      { productSlug: 'kornbrot-500g', countedQty: 0 },
      { productSlug: 'mustercroissant', countedQty: 1 },
      { productSlug: 'musterbrezel', countedQty: 4 },
    ],
  },
})
let openDay =
  templateWeekdays.includes(isoWd(today)) && today !== visitDay
    ? today
    : addDays(visitDay2, -7)
const v5 = await must('POST', `/api/partners/${partner.id}/visits`, {
  token: driver,
  body: {
    businessDate: openDay,
    visitAt: `${openDay}T05:30:00.000Z`,
    visitType: 'initial',
    items: templateItems.map((i) => ({
      productSlug: i.productSlug,
      deliveredQty: i.quantity,
    })),
  },
})
const partnerStats = await call('GET', `/api/partners/${partner.id}/stats`, {
  token: owner,
})
console.log(
  'partner extra visits',
  visitData(v3).id,
  visitData(v4).id,
  'open day',
  openDay,
  visitData(v5).id
)

// ---------------------------------------------------------------- preorders (verkauf)
const it = (productId, quantity, variant) => ({
  productId,
  quantity,
  ...(variant ? { variant } : {}),
})
const SPECS = [
  // today
  {
    tag: 'heute-abgeholt-bezahlt',
    date: d0,
    channel: 'laden',
    pickupTime: '08:00',
    customerName: 'Testkundin Ahorn',
    customerPhone: '0170 0000001',
    items: [it('mustercroissant', 6), it('musterweck', 10)],
  },
  {
    tag: 'heute-bereit',
    date: d0,
    channel: 'telefon',
    pickupTime: '10:30',
    customerName: 'Testkunde Birke',
    customerPhone: '0170 0000002',
    items: [it('kornbrot-1000g', 1), it('musterbrezel', 4)],
  },
  {
    tag: 'heute-nicht-abgeholt',
    date: d0,
    channel: 'whatsapp',
    pickupTime: '11:00',
    customerName: 'Testkundin Erle',
    customerPhone: '0170 0000003',
    items: [it('musterkuchen-marmor-1-stueck', 4)],
  },
  {
    tag: 'heute-offen-shop',
    date: d0,
    channel: 'shop',
    pickupTime: '09:15',
    customerName: 'Testkunde Esche',
    items: [it('musterbrot-hell-500g', 2)],
    note: 'Bitte geschnitten (Test)',
  },
  // Saturday (variants)
  {
    tag: 'sa-varianten-telefon',
    date: saturday,
    channel: 'telefon',
    pickupTime: '08:30',
    customerName: 'Testkundin Fichte',
    customerPhone: '0170 0000005',
    items: [
      it('mustertorte-nuss', 1, 'nuss'),
      it('probekuchen-streusel', 1, 'mohn'),
    ],
  },
  {
    tag: 'sa-varianten-laden-bereit',
    date: saturday,
    channel: 'laden',
    pickupTime: '09:00',
    customerName: 'Testkunde Hasel',
    customerPhone: '0170 0000006',
    items: [
      it('probekuchen-streusel', 2, 'nuss'),
      it('probekuchen-nuss-1-stueck', 2, 'mohn'),
      it('musterweck', 12),
    ],
  },
  {
    tag: 'sa-varianten-whatsapp',
    date: saturday,
    channel: 'whatsapp',
    pickupTime: '10:00',
    customerName: 'Testkundin Kiefer',
    customerPhone: '0170 0000007',
    items: [
      it('mustertorte-nuss', 1, 'mohn'),
      it('probekuchen-zwetschge-1-stueck', 4),
    ],
  },
  {
    tag: 'sa-moersbach-1',
    date: saturday,
    channel: 'sammelstelle',
    pickupPointId: moersbach.id,
    customerName: 'Testfamilie Linde',
    customerPhone: '0170 0000008',
    items: [it('mustertorte-nuss', 1, 'nuss'), it('musterbrezel', 6)],
  },
  {
    tag: 'sa-moersbach-2',
    date: saturday,
    channel: 'sammelstelle',
    pickupPointId: moersbach.id,
    customerName: 'Testfamilie Pappel',
    items: [it('probekuchen-streusel', 1, 'apfel'), it('mustercroissant', 4)],
  },
  {
    tag: 'sa-storniert-shop',
    date: saturday,
    channel: 'shop',
    pickupTime: '11:30',
    customerName: 'Testkunde Ulme',
    items: [it('probekuchen-nuss-1-stueck', 4, 'nuss')],
  },
  // the other production days
  {
    tag: 'tag3-telefon',
    date: others[0],
    channel: 'telefon',
    pickupTime: '08:00',
    customerName: 'Testkundin Weide',
    customerPhone: '0170 0000011',
    items: [it('musterweck', 20), it('mustercroissant', 6)],
  },
  {
    tag: 'tag4-laden',
    date: others[1],
    channel: 'laden',
    pickupTime: '07:30',
    customerName: 'Testkunde Zeder',
    items: [it('kornbrot-500g', 2), it('testbroetchen-laugen', 6)],
  },
  {
    tag: 'tag5-whatsapp',
    date: others[2],
    channel: 'whatsapp',
    customerName: 'Testkundin Eibe',
    customerPhone: '0170 0000013',
    items: [it('musterkuchen-apfel', 1)],
    note: 'Geburtstag (Test)',
  },
  {
    tag: 'tag6-telefon',
    date: others[3],
    channel: 'telefon',
    pickupTime: '09:45',
    customerName: 'Testkunde Lärche',
    customerPhone: '0170 0000014',
    items: [it('mustersemmel', 15), it('musterlaib-vollkorn-1000g', 1)],
  },
  {
    tag: 'tag7-laden',
    date: others[4],
    channel: 'laden',
    pickupTime: '12:00',
    customerName: 'Testkundin Robinie',
    items: [it('musterkuchen-marmor', 1), it('musterberliner', 6)],
  },
  // payments (r4): paid in advance, top-up, refund, cancelled+paid, handed over unpaid, refunded
  {
    tag: 'heute-bezahlt-offen',
    date: d0,
    channel: 'laden',
    pickupTime: '09:30',
    customerName: 'Testkunde Buche',
    customerPhone: '0170 0000021',
    paid: true,
    items: [it('musterkuchen-apfel', 1), it('musterweck', 6)],
  },
  {
    tag: 'heute-nachzahlung',
    date: d0,
    channel: 'telefon',
    pickupTime: '10:00',
    customerName: 'Testkundin Douglasie',
    customerPhone: '0170 0000022',
    paid: true,
    items: [it('mustercroissant', 4)],
    patchItems: [it('mustercroissant', 4), it('musterkuchen-marmor', 1)],
  },
  {
    tag: 'heute-erstattung',
    date: d0,
    channel: 'whatsapp',
    pickupTime: '11:30',
    customerName: 'Testkunde Holunder',
    customerPhone: '0170 0000023',
    paid: true,
    items: [it('musterkuchen-apfel', 2), it('musterbrezel', 10)],
    patchItems: [it('musterkuchen-apfel', 1), it('musterbrezel', 10)],
  },
  {
    tag: 'heute-storniert-bezahlt',
    date: d0,
    channel: 'laden',
    pickupTime: '12:00',
    customerName: 'Testkundin Mispel',
    customerPhone: '0170 0000024',
    paid: true,
    items: [it('probetorte-schoko', 1)],
    cancel: true,
  },
  {
    tag: 'heute-ohne-zahlung-uebergeben',
    date: d0,
    channel: 'laden',
    pickupTime: '08:30',
    customerName: 'Testkunde Wacholder',
    items: [it('kornbrot-500g', 2), it('musterweck', 8)],
    handOverUnpaid: true,
  },
  {
    tag: 'sa-storniert-erstattet',
    date: saturday,
    channel: 'telefon',
    pickupTime: '10:30',
    customerName: 'Testkundin Schlehe',
    customerPhone: '0170 0000026',
    paid: true,
    items: [it('mustertorte-nuss', 1, 'mohn')],
    cancel: true,
    refundAfterCancel: true,
  },
  {
    tag: 'sa-oberdorf-bezahlt',
    date: saturday,
    channel: 'sammelstelle',
    pickupPointId: 'gemeindehaus-oberdorf',
    customerName: 'Testfamilie Vogelbeere',
    customerPhone: '0170 0000027',
    paid: true,
    items: [it('probekuchen-streusel', 1, 'apfel'), it('musterbrezel', 6)],
  },
  // r6: on the day that gets confirmed (others[0]); changed AFTER the confirm -> Nachtrag kinds removed / moved / cancelled
  {
    tag: 'tag3-entfernt',
    date: others[0],
    channel: 'telefon',
    pickupTime: '09:00',
    customerName: 'Testkundin Entfernt',
    customerPhone: '0170 0000061',
    items: [it('musterbrezel', 6), it('musterberliner', 4)],
    afterConfirm: 'remove-line',
  },
  {
    tag: 'tag3-verschoben',
    date: others[0],
    channel: 'laden',
    pickupTime: '10:00',
    customerName: 'Testkunde Verschoben',
    customerPhone: '0170 0000062',
    items: [it('mustersemmel', 10)],
    afterConfirm: 'move',
  },
  {
    tag: 'tag3-storniert',
    date: others[0],
    channel: 'whatsapp',
    pickupTime: '11:00',
    customerName: 'Testkundin Storniert',
    customerPhone: '0170 0000063',
    paid: true,
    items: [it('musterkuchen-apfel', 1)],
    afterConfirm: 'cancel',
  },
]
const created = {}
for (const s of SPECS) {
  const body = {
    channel: s.channel,
    customerName: s.customerName,
    ...(s.customerPhone ? { customerPhone: s.customerPhone } : {}),
    pickupDate: s.date,
    ...(s.pickupPointId
      ? { pickupPointId: s.pickupPointId }
      : { pickupTime: s.pickupTime ?? null }),
    ...(s.note ? { note: s.note } : {}),
    ...(s.paid ? { paid: true } : {}),
    items: s.items,
  }
  const r = await must('POST', '/api/preorders', { token: sale, body })
  created[s.tag] = r.data
  console.log('preorder', s.tag, r.data.id, r.data.code)
}
// payment follow-ups (r4)
for (const s of SPECS) {
  const pid = created[s.tag].id
  if (s.patchItems)
    await must('PATCH', `/api/preorders/${pid}`, {
      token: sale,
      body: { items: s.patchItems },
    })
  if (s.cancel)
    await must('POST', `/api/preorders/${pid}/cancel`, {
      token: sale,
      body: {},
    })
  if (s.refundAfterCancel)
    await must('POST', `/api/preorders/${pid}/status`, {
      token: sale,
      body: { paid: false },
    })
  if (s.handOverUnpaid)
    await must('POST', `/api/preorders/${pid}/status`, {
      token: sale,
      body: { status: 'abgeholt', paid: false },
    })
}
const id = (tag) => created[tag].id

// statuses: bulk "bereit" (W4), then single changes
const bulk = await must('POST', '/api/preorders/bulk-status', {
  token: sale,
  body: {
    ids: [
      'heute-abgeholt-bezahlt',
      'heute-bereit',
      'heute-nicht-abgeholt',
      'sa-varianten-laden-bereit',
    ].map(id),
    status: 'bereit',
  },
})
console.log('bulk bereit', JSON.stringify(bulk.data.counts))
await must('POST', `/api/preorders/${id('heute-abgeholt-bezahlt')}/status`, {
  token: sale,
  body: { status: 'abgeholt', paid: true },
})
await must('POST', `/api/preorders/${id('heute-nicht-abgeholt')}/status`, {
  token: sale,
  body: { notCollected: true },
})
await must('POST', `/api/preorders/${id('sa-storniert-shop')}/cancel`, {
  token: sale,
  body: {},
})

// ---------------------------------------------------------------- heavy Saturday (r4: concurrency/print personas)
// Deterministic: 48 more Saturday preorders, every product×variant combo of the
// config at least 6 times, all channels, Laden + both active pickup points,
// long names/notes for print layout. Written by both sellers alternately.
let prng = 20261107
const rnd = () => (prng = (prng * 1103515245 + 12345) % 2147483648) / 2147483648
const pick = (a) => a[Math.floor(rnd() * a.length)]
// r5: every product × Sorte the API demands (GET /variants from backzettel.yaml), not a hand list
const variantsRes = await must('GET', '/api/preorders/variants', {
  token: sale,
})
if (!variantsRes.configured)
  throw new Error(
    '/api/preorders/variants: configured=false (backzettel.yaml not loaded)'
  )
const variantsMap = variantsRes.data
const VARIANT_LINES = Object.keys(variantsMap)
  .sort()
  .flatMap((p) => variantsMap[p].map((v) => [p, v]))
if (VARIANT_LINES.length < 2)
  throw new Error(`too few variant combos: ${JSON.stringify(variantsMap)}`)
const PLAIN = [
  'musterweck',
  'mustersemmel',
  'musterbrezel',
  'testbroetchen-laugen',
  'mustercroissant',
  'musterberliner',
  'kornbrot-500g',
  'kornbrot-1000g',
  'musterbrot-hell-500g',
  'musterkuchen-marmor',
  'musterkuchen-marmor-1-stueck',
  'musterkuchen-apfel',
  'musterkuchen-apfel-1-stueck',
  'probekuchen-zwetschge-1-stueck',
  'schwarzwaelder-kirsch-torte',
  'mustersemmel-mohn',
  'probeplunder-vanille',
  'musterschnecke-nuss',
  'testtasche-quark',
]
const FIRST = ['Testkundin', 'Testkunde', 'Testfamilie']
const LAST = [
  'Akazie',
  'Bergahorn',
  'Böhm-Testerin',
  'Christdorn',
  'Dürrwurz',
  'Eberesche',
  'Faulbaum',
  'Gänsefingerkraut',
  'Hainbuche',
  'Ilex',
  'Jasmin',
  'Kastanie',
  'Lärchenzweig',
  'Maulbeere',
  'Nussbaum',
  'Öhrchen',
  'Pfaffenhütchen',
  'Quitte',
  'Rosskastanie',
  'Sanddorn',
  'Tulpenbaum',
  'Ulmenblatt',
  'Vogelkirsche',
  'Weißdorn',
  'Zürgelbaum',
  'Übermut',
]
const sale2 = await login(USERS.verkauf2)
const heavy = []
const HEAVY_N = 48
for (let i = 0; i < HEAVY_N; i++) {
  const kind = [
    'laden',
    'laden',
    'laden',
    'telefon',
    'whatsapp',
    'shop',
    'moersbach',
    'oberdorf',
  ][i % 8]
  const [vp, vv] = VARIANT_LINES[i % VARIANT_LINES.length]
  const items = [it(vp, 1 + Math.floor(rnd() * 3), vv)]
  if (i % 3 === 0) {
    const [vp2, vv2] = VARIANT_LINES[(i + 3) % VARIANT_LINES.length]
    if (vp2 !== vp || vv2 !== vv)
      items.push(it(vp2, 1 + Math.floor(rnd() * 2), vv2))
  }
  const plainCount = 1 + Math.floor(rnd() * 3)
  const used = new Set()
  for (let k = 0; k < plainCount; k++) {
    const p = pick(PLAIN)
    if (used.has(p)) continue
    used.add(p)
    items.push(
      it(
        p,
        /torte|^musterkuchen-(marmor|apfel)$/.test(p)
          ? 1 + Math.floor(rnd() * 2)
          : 1 + Math.floor(rnd() * 12)
      )
    )
  }
  const customerName =
    i === 0
      ? 'Testfamilie Pfaffenhütchen-Gänsefingerkraut von und zu Rosskastanienbaumschule (sehr langer Name, Druckprobe)'
      : `${FIRST[i % 3]} ${LAST[i % LAST.length]}${
          i >= LAST.length ? ' ' + String.fromCharCode(65 + (i % 26)) + '.' : ''
        }`
  const point =
    kind === 'moersbach'
      ? moersbach.id
      : kind === 'oberdorf'
      ? oberdorf.id
      : null
  const body = {
    channel: point ? 'sammelstelle' : kind,
    customerName,
    ...(i % 4 !== 1
      ? { customerPhone: `0171 ${String(1000000 + i * 7919).slice(0, 7)}` }
      : {}),
    pickupDate: saturday,
    ...(point
      ? { pickupPointId: point }
      : {
          pickupTime: `${String(7 + (i % 6)).padStart(2, '0')}:${
            ['00', '15', '30', '45'][i % 4]
          }`,
        }),
    ...(i % 7 === 2
      ? {
          note:
            i === 2
              ? 'Bitte den Kranz in zwei Hälften schneiden, Nussfüllung ohne Rosinen; ruft vorher an, falls es später wird. Abholung ggf. durch Nachbarin (Druckprobe für lange Anmerkungen).'
              : 'Anmerkung (Test)',
        }
      : {}),
    ...(i % 6 === 0 ? { paid: true } : {}),
    items,
  }
  const token = i % 2 === 0 ? sale : sale2
  const r = await must('POST', '/api/preorders', { token, body })
  heavy.push({
    i,
    kind,
    id: r.data.id,
    writer: i % 2 === 0 ? 'verkauf' : 'verkauf2',
  })
}
// some ready, some cancelled (one of them paid -> refund due)
const heavyReady = heavy.filter((h) => h.i % 5 === 0).map((h) => h.id)
await must('POST', '/api/preorders/bulk-status', {
  token: sale,
  body: { ids: heavyReady, status: 'bereit' },
})
for (const h of heavy.filter((h) => h.i % 11 === 6)) {
  await must('POST', `/api/preorders/${h.id}/cancel`, { token: sale, body: {} })
}
console.log(
  'heavy saturday',
  heavy.length,
  'preorders; bereit',
  heavyReady.length
)

// ---------------------------------------------------------------- r5: idempotent create (requestId, W4-verify r4 fix)
const REQUEST_ID = 'w5-seed-retry-0001'
const idemBody = {
  channel: 'telefon',
  customerName: 'Testkundin Wiederholung',
  customerPhone: '0170 0000031',
  pickupDate: saturday,
  pickupTime: '09:45',
  requestId: REQUEST_ID,
  items: [it(VARIANT_LINES[0][0], 1, VARIANT_LINES[0][1]), it('musterweck', 6)],
}
const idem1 = await call('POST', '/api/preorders', {
  token: sale,
  body: idemBody,
})
const idem2 = await call('POST', '/api/preorders', {
  token: sale,
  body: idemBody,
})
if (
  idem1.status !== 201 ||
  idem2.status !== 200 ||
  idem1.json.data.id !== idem2.json.data.id
) {
  throw new Error(
    `requestId retry: ${idem1.status}/${idem2.status} ids ${idem1.json?.data?.id}/${idem2.json?.data?.id}`
  )
}
console.log('requestId retry OK', idem1.json.data.id, idem1.json.data.code)
// r6 (W4-verify r5 fix): same requestId, edited form -> 409 request_id_changed, nothing saved
const idemChangedBody = {
  ...idemBody,
  items: [...idemBody.items, it('musterbrezel', 2)],
}
const idem3 = await call('POST', '/api/preorders', {
  token: sale,
  body: idemChangedBody,
})
if (idem3.status !== 409 || idem3.json?.error !== 'request_id_changed') {
  throw new Error(
    `requestId changed retry: ${idem3.status} ${JSON.stringify(idem3.json)}`
  )
}
const idemAfter = (
  await must('GET', `/api/preorders/${idem1.json.data.id}`, { token: sale })
).data
if (idemAfter.items.some((i) => i.productId === 'musterbrezel'))
  throw new Error('request_id_changed retry still saved its items')
console.log('requestId changed retry -> 409 request_id_changed')

// ---------------------------------------------------------------- r5: pickup point with bookings, then deactivated
const pfarrheimOrders = []
for (const [n, name] of [
  [0, 'Testfamilie Schlehdorn'],
  [1, 'Testkunde Wegwarte'],
]) {
  const r = await must('POST', '/api/preorders', {
    token: sale,
    body: {
      channel: 'sammelstelle',
      customerName: name,
      ...(n === 0 ? { customerPhone: '0170 0000041', paid: true } : {}),
      pickupDate: saturday,
      pickupPointId: 'pfarrheim-test',
      items: [
        it(VARIANT_LINES[n + 1][0], 1, VARIANT_LINES[n + 1][1]),
        it('musterbrezel', 4),
      ],
    },
  })
  pfarrheimOrders.push({
    id: r.data.id,
    code: r.data.code,
    customerName: name,
    paid: n === 0,
  })
}
const pfPoints = (
  await must('GET', '/api/preorders/pickup-points', { token: owner })
).data
const pfBefore = pfPoints.find((p) => p.id === 'pfarrheim-test')
if (!pfBefore)
  throw new Error(
    'pfarrheim-test not imported (start.sh import-preorders step)'
  )
const pfAfter = (
  await must('PUT', '/api/preorders/pickup-points/pfarrheim-test', {
    token: owner,
    body: { active: false, expectedUpdatedAt: pfBefore.updatedAt },
  })
).data
if (pfAfter.active !== false)
  throw new Error('pfarrheim-test still active after PUT')
console.log('pfarrheim-test: 2 Saturday orders, then deactivated')

// ---------------------------------------------------------------- r5: one confirmed Backzettel day with open Nachträge + a tick
// others[0] = next production day after today that is not Saturday; today and Saturday stay drafts.
const bake = await login(USERS.backstube)
const confDay = others[0]
const confirmed = (
  await must('POST', `/api/backzettel/${confDay}/confirm`, {
    token: bake,
    body: {},
  })
).data
if (confirmed.status !== 'confirmed')
  throw new Error(`confirm ${confDay}: status ${confirmed.status}`)
// after the confirm: one new order and one changed order -> deltas
const late = await must('POST', '/api/preorders', {
  token: sale,
  body: {
    channel: 'laden',
    customerName: 'Testkunde Nachzügler',
    customerPhone: '0170 0000051',
    pickupDate: confDay,
    pickupTime: '08:30',
    items: [it('musterweck', 10), it('mustercroissant', 4)],
  },
})
await must('PATCH', `/api/preorders/${id('tag3-telefon')}`, {
  token: sale,
  body: { items: [it('musterweck', 26), it('mustercroissant', 6)] },
})
// r6: one Nachtrag of each new kind (W4-verify r5: removed / moved / cancelled)
await must('PATCH', `/api/preorders/${id('tag3-entfernt')}`, {
  token: sale,
  body: { items: [it('musterbrezel', 6)] },
})
const movedTo = others[1]
await must('PATCH', `/api/preorders/${id('tag3-verschoben')}`, {
  token: sale,
  body: { pickupDate: movedTo },
})
await must('POST', `/api/preorders/${id('tag3-storniert')}/cancel`, {
  token: sale,
  body: {},
})
let confView = (
  await must('GET', `/api/backzettel/${confDay}`, { token: bake })
).data
// tick the first line without an open delta, with the total the tablet showed
const allLines = confView.sections.flatMap((s) => s.lines)
const tickLine = allLines.find(
  (l) => l.id && !(l.delta && l.delta.open) && l.total > 0
)
if (tickLine) {
  await must('POST', `/api/backzettel/${confDay}/lines/${tickLine.id}/done`, {
    token: bake,
    body: { expectedTotal: tickLine.total },
  })
  confView = (await must('GET', `/api/backzettel/${confDay}`, { token: bake }))
    .data
}
const openDeltas = confView.deltas.filter((d) => !d.acknowledgedAt)
if (openDeltas.length === 0)
  throw new Error(`no deltas recorded on confirmed day ${confDay}`)
const deltaKinds = [...new Set(confView.deltas.map((d) => d.kind))].sort()
for (const k of ['added', 'cancelled', 'changed', 'moved', 'removed']) {
  if (!deltaKinds.includes(k))
    throw new Error(
      `confirmed day ${confDay}: no Nachtrag of kind ${k} (have ${deltaKinds.join(
        ','
      )})`
    )
}
const movedDelta = confView.deltas.find((d) => d.kind === 'moved')
if (movedDelta.preorderMovedTo !== movedTo)
  throw new Error(
    `moved delta: preorderMovedTo ${movedDelta.preorderMovedTo} != ${movedTo}`
  )
console.log(
  'backzettel',
  confDay,
  'confirmed; open deltas',
  openDeltas.length,
  'ticked line',
  tickLine?.id ?? '-'
)

const finalList = (
  await must(
    'GET',
    `/api/preorders?from=${productionDays[0]}&to=${productionDays[6]}`,
    { token: sale }
  )
).data
const balanceOf = (p) => {
  if (!p.paid) return 0
  const paid = p.paidAmount == null ? p.total : p.paidAmount
  return (
    Math.round(((p.status === 'storniert' ? 0 : p.total) - paid) * 100) / 100
  )
}
const preorders = SPECS.map((s) => {
  const p = finalList.find((x) => x.id === created[s.tag].id)
  return {
    tag: s.tag,
    id: p.id,
    code: p.code,
    pickupDate: p.pickupDate,
    weekday: isoWd(p.pickupDate),
    channel: p.channel,
    pickupPointId: p.pickupPointId,
    pickupTime: p.pickupTime,
    status: p.status,
    notCollected: p.notCollected,
    paid: p.paid,
    paidAmount: p.paidAmount,
    balance: balanceOf(p), // > 0 still to collect, < 0 to refund (core paymentBalance)
    customerName: p.customerName,
    total: p.total,
    items: p.items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      quantity: i.quantity,
    })),
  }
})
const heavyPreorders = heavy.map((h) => {
  const p = finalList.find((x) => x.id === h.id)
  return {
    id: p.id,
    code: p.code,
    channel: p.channel,
    pickupPointId: p.pickupPointId,
    pickupTime: p.pickupTime,
    status: p.status,
    paid: p.paid,
    total: p.total,
    balance: balanceOf(p),
    customerName: p.customerName,
    hasNote: !!p.note,
    writer: h.writer,
    items: p.items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      quantity: i.quantity,
    })),
  }
})
const satDay = (
  await must('GET', `/api/preorders/day?date=${saturday}`, { token: sale })
).data
const satSums = (
  await must('GET', `/api/preorders/sums?date=${saturday}`, { token: sale })
).data
const d0Day = (
  await must('GET', `/api/preorders/day?date=${d0}`, { token: sale })
).data
const combos = {}
for (const p of finalList.filter(
  (x) => x.pickupDate === saturday && x.status !== 'storniert'
)) {
  for (const i of p.items)
    if (i.variant)
      combos[`${i.productId}:${i.variant}`] =
        (combos[`${i.productId}:${i.variant}`] ?? 0) + i.quantity
}
const missingCombos = VARIANT_LINES.map(([p, v]) => `${p}:${v}`).filter(
  (k) => !combos[k]
)
if (missingCombos.length)
  throw new Error(
    `heavy Saturday misses variant combos: ${missingCombos.join(', ')}`
  )

// ---------------------------------------------------------------- next: B8 tours + M4 Rest am Abend
// only on branches that have them (next): pilot has neither the tours API nor Rest am Abend
const hasNext =
  (await call('GET', '/api/deliveries/depot', { token: owner })).status === 200
const nextWorld = hasNext
  ? await seedNext({
      call,
      must,
      login,
      USERS,
      owner,
      sale,
      bake,
      station,
      today,
      addDays,
      isoWd,
      saturday,
      it,
      log: (...a) => console.log(...a),
    })
  : {}
if (!hasNext)
  console.log(
    'no /api/deliveries/depot: skipping tours + Rest am Abend (pilot branch)'
  )

// ---------------------------------------------------------------- sanity reads
const bzSat = await call('GET', `/api/backzettel/${saturday}`, { token: owner })
const bzConfig = await call('GET', '/api/backzettel/config', { token: owner })
const sync = await call('GET', '/api/hq-sync/status', { token: owner })
const reportsInfo = JSON.parse(fs.readFileSync(`${I}/hq-info.json`, 'utf8'))

const world = {
  name: I.split('/').pop(),
  createdAt: new Date().toISOString(),
  today,
  mode: MODE,
  web: {
    url: WEB,
    port: Number(WEB_PORT),
    login: `${WEB}/admin/login`,
    station: `${WEB}/station`,
    rest: `${WEB}/admin/rest`,
    restAuswertung: `${WEB}/admin/rest/auswertung`,
    pilotMode: MODE === 'pilot',
  },
  second: {
    kind: SECOND_KIND,
    url: SECOND_KIND === 'none' ? null : SECOND_URL,
    port: Number(new URL(SECOND_URL).port),
  },
  api: { url: API, port: Number(API_PORT), health: `${API}/health` },
  fakeGithub: {
    url: `http://127.0.0.1:${GH_PORT}`,
    repo: 'Test-Org/hq',
    pullsFile: `${I}/fake-github-pulls.json`,
  },
  dirs: {
    root: I,
    db: `${I}/db/bakery.db`,
    hqRead: `${I}/hq`,
    hqWrite: `${I}/hq-write`,
    hqSnapshot: `${I}/hq-write-main`,
    origin: `${I}/origin.git`,
    seed: `${I}/seed`,
    logs: `${I}/logs`,
    envFile: `${I}/env.sh`,
  },
  users: USERS,
  stations: stations.map((s) => ({
    ...s,
    localStorageValue: JSON.stringify({
      token: s.token,
      name: s.name,
      id: s.id,
    }),
  })),
  station: {
    ...station,
    localStorageKey: 'bakery-management-station',
    localStorageValue: JSON.stringify({
      token: station.token,
      name: station.name,
      id: station.id,
    }),
    usersWithPin: stationUsers.data.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role,
    })),
  },
  pickupPoints: {
    moersbach: pointSummary(moersbach),
    oberdorf: pointSummary(oberdorf),
    altdorfInactive: pointSummary(altdorf),
    pfarrheimDeactivated: pointSummary(pfAfter),
  },
  productionDays,
  saturday,
  preorders,
  heavySaturday: {
    date: saturday,
    count: heavyPreorders.length,
    totalOnDay: satDay.preorders.length,
    summary: satDay.summary,
    pickupPoints: satDay.pickupPoints.map((p) => ({
      id: p.id,
      name: p.name,
      preorderCount: p.preorderCount,
    })),
    variantQuantities: combos,
    sums: satSums.items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      quantity: i.quantity,
      preorders: i.preorders,
    })),
    preorders: heavyPreorders,
  },
  todaySummary: { date: d0, summary: d0Day.summary },
  variantsMap,
  idempotentCreate: {
    requestId: REQUEST_ID,
    body: idemBody,
    id: idem1.json.data.id,
    code: idem1.json.data.code,
    statuses: [idem1.status, idem2.status],
    changedRetry: {
      body: idemChangedBody,
      status: idem3.status,
      error: idem3.json?.error ?? null,
    },
  },
  deactivatedPickupPoint: {
    ...pointSummary(pfAfter),
    date: saturday,
    preorders: pfarrheimOrders,
  },
  confirmedBackzettel: {
    date: confDay,
    weekday: isoWd(confDay),
    confirmedBy: 'backstube',
    lateOrder: { id: late.data.id, code: late.data.code },
    changedOrderTag: 'tag3-telefon',
    openDeltas: openDeltas.map((d) => ({
      id: d.id,
      itemId: d.itemId,
      variant: d.variant,
      qty: d.qty,
      kind: d.kind,
      preorderId: d.preorderId,
      preorderCode: d.preorderCode,
      preorderMovedTo: d.preorderMovedTo ?? null,
    })),
    deltaKinds,
    afterConfirm: {
      removedLineTag: 'tag3-entfernt',
      movedTag: 'tag3-verschoben',
      movedTo,
      cancelledPaidTag: 'tag3-storniert',
    },
    tickedLine: tickLine
      ? {
          id: tickLine.id,
          itemId: tickLine.itemId,
          variant: tickLine.variant,
          total: tickLine.total,
        }
      : null,
    lineCount: allLines.length,
  },
  deliveries: nextWorld.deliveries,
  restAmAbend: nextWorld.restAmAbend,
  dienstplan: nextWorld.dienstplan ?? null,
  partner: {
    id: partner.id,
    slug: partner.slug,
    name: partner.name,
    templateWeekdays,
    templateItems,
    visits: [
      { id: visitData(v1).id, type: 'initial', businessDate: visitDay },
      { id: visitData(v2).id, type: 'pickup', businessDate: visitDay },
      { id: visitData(v3).id, type: 'initial', businessDate: visitDay2 },
      { id: visitData(v4).id, type: 'pickup', businessDate: visitDay2 },
      { id: visitData(v5).id, type: 'initial', businessDate: openDay },
    ],
    completeDays: [visitDay2, visitDay],
    openDay,
    stats: partnerStats.json
      ? {
          totals: partnerStats.json.totals,
          isProvisional: partnerStats.json.isProvisional,
          openDates: partnerStats.json.openDates,
          incompleteDates: partnerStats.json.incompleteDates,
        }
      : null,
  },
  hq: {
    ...reportsInfo,
    backzettelConfig: `${I}/hq/config/backzettel.yaml`,
    backzettelConfigStatus: bzConfig.json?.data?.status ?? bzConfig.status,
    saturdayBackzettel: {
      status: bzSat.json?.data?.status ?? bzSat.status,
      sections: (bzSat.json?.data?.sections ?? []).map((s) => s.id),
      hefeteigPieces: bzSat.json?.data?.hefeteig?.pieces ?? null,
      warnings: (bzSat.json?.data?.warnings ?? []).map((w) => w.code),
    },
    syncEnabled: sync.json?.data?.enabled ?? null,
    snapshotsEnabled: sync.json?.data?.snapshots?.enabled ?? null,
  },
  notes: [
    'All data synthetic. Backzettel: only confirmedBackzettel.date is confirmed; today and Saturday stay drafts.',
    'Station: put station.localStorageValue under localStorage[station.localStorageKey] on the web origin, then open /station.',
    'Login rate limit counts failures per IP (all clients are 127.0.0.1): 5 per IP+user, 30 per IP per 5 min.',
    'Round-2 limits (W4-verify r1 fixes): Backzettel season/correction/confirm only today-7..today+90 (400 date_out_of_range); new preorder pickup day today-30..today+366, shop/laden not Monday (400 ruhetag); phone needs >=5 digits; control chars in name/note are 400.',
    'Round-3 (W4-verify r2 fixes): preorders carry paidAmount (null when unpaid; paid with items changed later -> balance due / refund in /day and Abholliste); fahrer cannot undo a payment (409 paid_undo_forbidden); Backzettel correction larger than the row is 400, never capped; overcount at the Backschrank is a deviation, price change shows as a range; control chars in displayName and partner data are 400; prep tasks show variantLabel (synthetic config: gross -> groß, misch -> Mischsauerteig); API answers carry Cache-Control: no-store; no Google Fonts requests.',
    'Round-4 (W4-verify r3 fixes): second seller verkauf2 (same role, for concurrent edits), two stations (stations[0] Laden, stations[1] Backstube; station = stations[0]), pickup points Mörsbach + Oberdorf (both Saturday) + Altdorf (inactive), payment cases (tags heute-bezahlt-offen, heute-nachzahlung, heute-erstattung, heute-storniert-bezahlt, heute-ohne-zahlung-uebergeben, sa-storniert-erstattet, sa-oberdorf-bezahlt; balance > 0 collect, < 0 refund), heavySaturday = 48 extra preorders with every variant combo. Fahrer cannot take back a handover (403 handover_undo_forbidden); search is case-insensitive incl. umlauts.',
    'Round-5 (W4-verify r4 fixes): heavySaturday variant lines come from GET /api/preorders/variants (all combos asserted present); idempotentCreate = one Saturday preorder posted twice with the same requestId (201 then 200, same id); deactivatedPickupPoint = Pfarrheim (Saturday) with 2 bookings, deactivated afterwards (Abholliste must still offer it as "(inaktiv)"); confirmedBackzettel = others[0] confirmed by backstube, then a late Laden order + tag3-telefon changed -> open Nachträge, one line ticked with expectedTotal. Today and Saturday stay drafts. Backzettel writes take expectedFactor / expected {correction, reason} / expectedTotal (409 season_changed / correction_changed / line_changed); POST /api/backzettel/:date/deltas/ack {ids}. Refresh: a lost refresh answer is reissued within 15 min (audit refresh_reissued).',
    'Round-6 (W4-verify r5 fixes): confirmedBackzettel has Nachträge of every kind (added, changed, removed = line dropped from tag3-entfernt, moved = tag3-verschoben moved to afterConfirm.movedTo and carries preorderMovedTo, cancelled = tag3-storniert, paid -> refund); idempotentCreate.changedRetry = same requestId with an edited body -> 409 request_id_changed, nothing saved; partner has two complete days (completeDays) and one open day (openDay, initial only) -> sell-through over complete days only, rest as openQty „Offen“; a lost-refresh reissue revokes the unused successor without replacedBy (presenting it later = reuse, session ends).',
    'Branch next only: B8 tours on the real API - deliveries.tours on world.saturday, tour 1 (verify.fahrer) carries the Mörsbach + Oberdorf pickup stops, tour 2 (verify.fahrer2) is started (first stop done); verify.fahrer3 has no driver row (app shows the bitte-im-Büro-melden hint); a third driver has no account. Fahrer-App = second.url when second.kind is delivery: username + password login (no PIN). Nominatim/OSRM are dead -> estimates.',
    'Branch next only: restAmAbend.days = production days in today-7..yesterday: confirmed Backzettel except the one marked draft; count full|partial|exceeds|none (counted by verify.verkauf via PIN at stations[0], one correction by verify.verkauf2); one acknowledged and one open Nachtrag. /admin/rest exists only in mode full (pilot mode: Im Pilotbetrieb nicht verfügbar).',
    'Dienstplan (TASK-042, only where /api/dienstplan exists): dienstplan.employees = 8 invented people (verkauf/backstube/fahrer/buero, four linked to verify.* logins), templates Früh/Spät, Verkauf shifts this and next ISO week on open days, absences around today (Valentin urlaub genehmigt next week, Bernd urlaub geplant, Paul urlaub last week, Fritz frei, Erika abwesend halber Tag); Paul has no entitlement (balance no-config), Mia entered 60 days ago (pro-rata). Owner with a personal session only; /admin/dienstplan is visible in pilot mode for the owner (decision 2026-11-08).',
    'CLI: source dirs.envFile, then (cd dirs.root && node <repo>/dist/apps/bakery-api/bundle/cli.js <cmd>).',
  ],
}
fs.writeFileSync(`${I}/world.json`, JSON.stringify(world, null, 2) + '\n')
console.log(
  'world.json written:',
  preorders.length,
  'preorders; saturday',
  saturday,
  'backzettel',
  world.hq.saturdayBackzettel.status
)
