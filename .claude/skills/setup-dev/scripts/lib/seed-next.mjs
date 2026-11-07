// Additions to seed.mjs for branch `next` (skipped on pilot): B8 delivery tours + driver accounts,
// M4 "Rest am Abend" on the past week. Everything synthetic (names, addresses, coordinates).
// Called by seed.mjs after the pilot seed; returns the world.json fragments.

export async function seedNext(ctx) {
  const { call, must, login, USERS, owner, sale, bake, station, today, addDays, isoWd, saturday, it, log } = ctx

  // ------------------------------------------------------------ B8: drivers (2 linked, 1 without account)
  const DRIVERS = [
    { key: 'fahrer', name: 'Fritz Fahrer (Test)', phone: '0170 2000001', vehicle: 'van' },
    { key: 'fahrer2', name: 'Frieda Fahrerin (Test)', phone: '0170 2000002', vehicle: 'car' },
    { key: null, name: 'Aushilfe ohne Konto (Test)', phone: '', vehicle: 'bike' },
  ]
  const drivers = []
  for (const d of DRIVERS) {
    const body = { name: d.name, vehicle: d.vehicle, ...(d.phone ? { phone: d.phone } : {}), ...(d.key ? { userId: USERS[d.key].id } : {}) }
    const r = await must('POST', '/api/deliveries/drivers', { token: owner, body })
    drivers.push({ id: r.id, name: r.name, vehicle: r.vehicle, userId: r.userId ?? null, username: d.key ? USERS[d.key].username : null })
    if (d.key) USERS[d.key].driverId = r.id
    log('driver', r.id, d.name)
  }
  const depot = await must('GET', '/api/deliveries/depot', { token: owner })

  // ------------------------------------------------------------ B8: Saturday with two tours
  // Tour 1 is created first -> the active Saturday pickup points (Mörsbach, Oberdorf) attach to it.
  const S = (customer, street, zip, city, lat, lon, timeWindow, items, extra = {}) => ({
    customer, street, zip, city, ...(lat === null ? {} : { lat, lon }), timeWindow,
    items: items.map(([name, qty, unit]) => ({ name, qty, unit: unit || 'Stück' })), ...extra,
  })
  const TOURS = [
    {
      key: 'tour1', driverKey: 'fahrer', name: 'Samstagstour Nord (Test)', plannedStart: '06:30',
      stops: [
        S('Testkundin Amsel', 'Teststraße 1', '66482', 'Zweibrücken', 49.249, 7.362, '07:30-08:00', [['Musterweck', 6], ['Kornbrot 500 g', 1]], { phone: '0170 1000001', notes: 'Klingel defekt, bitte klopfen (Test)' }),
        S('Testkunde Buchfink', 'Probeweg 12a', '66482', 'Zweibrücken', 49.2551, 7.3702, 'ab 08:00', [['Mustercroissant', 4]], { phone: '0170 1000002' }),
        S('Testpraxis Drossel', 'Musterallee 5', '66424', 'Homburg', 49.326, 7.338, 'bis 09:30', [['Musterbrezel', 12], ['Musterberliner', 6]], { notes: 'Lieferung an den Empfang (Test)' }),
        S('Testkundin Elster', 'Beispielgasse 3', '66482', 'Zweibrücken-Ixheim', null, null, '09:00-09:30', [['Musterbrot hell', 1]], { phone: '0170 1000004', notes: 'Ohne Koordinaten: Adresssuche ist tot -> Schätzung' }),
        S('Testfamilie Fink', 'Probeweg 40', '66482', 'Zweibrücken', 49.26, 7.38, 'nach Absprache', [['Marmorkuchen', 1]]),
      ],
    },
    {
      key: 'tour2', driverKey: 'fahrer2', name: 'Samstagstour Süd (Test)', plannedStart: '07:00',
      stops: [
        S('Testkunde Gimpel', 'Teststraße 77', '66482', 'Zweibrücken', 49.243, 7.351, '08:00-08:30', [['Musterweck', 10]], { phone: '0170 1000011' }),
        S('Testcafé Häher', 'Musterplatz 2', '66440', 'Blieskastel', 49.237, 7.256, 'ab 09:00', [['Mustercroissant', 20], ['Musterkuchen Apfel', 1, 'Blech']], { phone: '0170 1000012', notes: 'Hintereingang (Test)' }),
        S('Testkundin Ibis', 'Probeweg 2', '66482', 'Zweibrücken', 49.2585, 7.3655, 'spätestens 10:00', [['Mustersemmel', 8]]),
        S('Testkunde Kiebitz', 'Beispielstraße 9', '66500', 'Hornbach', 49.188, 7.369, '10:00-10:30', [['Kornbrot 1000 g', 2]], { phone: '0170 1000014' }),
      ],
    },
  ]
  const tours = []
  for (const t of TOURS) {
    let tour = await must('POST', '/api/deliveries/tours', {
      token: owner, body: { date: saturday, driverId: USERS[t.driverKey].driverId, name: t.name, plannedStart: t.plannedStart },
    })
    for (const s of t.stops) tour = await must('POST', `/api/deliveries/tours/${tour.id}/stops`, { token: owner, body: s })
    tours.push({ key: t.key, id: tour.id })
    log('tour', t.key, tour.id, 'stops', tour.stops.length)
  }
  // Frieda starts tour 2: first own stop done (fahrer may only send status etc.)
  const fahrer2 = await login(USERS.fahrer2)
  const t2 = await must('GET', `/api/deliveries/tours/${tours[1].id}`, { token: fahrer2 })
  const firstStop = t2.stops.find((s) => !s.pickupPointId)
  await must('PATCH', `/api/deliveries/tours/${tours[1].id}/stops/${firstStop.id}`, { token: fahrer2, body: { status: 'done' } })
  // cross checks: fahrer sees only own tours, foreign tour is 403, backstube 403
  const fahrer1 = await login(USERS.fahrer)
  const own1 = await must('GET', `/api/deliveries/tours?date=${saturday}`, { token: fahrer1 })
  if (own1.length !== 1 || own1[0].id !== tours[0].id) throw new Error(`fahrer sees ${own1.map((t) => t.id)} instead of only tour ${tours[0].id}`)
  const foreign = await call('GET', `/api/deliveries/tours/${tours[1].id}`, { token: fahrer1 })
  if (foreign.status !== 403) throw new Error(`fahrer reading a foreign tour: ${foreign.status}`)
  const fahrer3 = await login(USERS.fahrer3)
  const none3 = await must('GET', `/api/deliveries/tours?date=${saturday}`, { token: fahrer3 })
  if (none3.length !== 0) throw new Error('unlinked fahrer3 sees tours')
  const bzDeny = await call('GET', `/api/deliveries/tours?date=${saturday}`, { token: bake })
  if (bzDeny.status !== 403) throw new Error(`backstube on tours: ${bzDeny.status}`)

  const allTours = await must('GET', `/api/deliveries/tours?date=${saturday}`, { token: owner })
  const tourWorld = allTours.map((t) => ({
    id: t.id, name: t.name, date: t.date, status: t.status, driverId: t.driverId,
    driverUsername: drivers.find((d) => d.id === t.driverId)?.username ?? null,
    plannedStart: t.plannedStart ?? null,
    stops: t.stops.map((s) => ({
      id: s.id, customer: s.customer, pickupPointId: s.pickupPointId ?? null, status: s.status,
      timeWindow: s.timeWindow ?? null, hasCoordinates: s.lat != null && s.lon != null,
      preorders: Array.isArray(s.preorders) ? s.preorders.length : null,
    })),
  }))
  const pickupStops = tourWorld.flatMap((t) => t.stops.filter((s) => s.pickupPointId).map((s) => `${t.id}:${s.pickupPointId}`))
  if (!pickupStops.some((x) => x === `${tours[0].id}:kindergarten-moersbach`)) throw new Error(`Mörsbach stop not on tour 1 (${pickupStops})`)
  if (tourWorld[1].stops.some((s) => s.pickupPointId)) throw new Error('second tour got a pickup-point stop')
  log('tours ok; pickup stops', pickupStops.join(','))

  // ------------------------------------------------------------ M4: Rest am Abend on the past week
  const PRODUCTION = [2, 3, 4, 5, 6, 7]
  const pastDays = []
  for (let d = addDays(today, -7); d < today; d = addDays(d, 1)) if (PRODUCTION.includes(isoWd(d))) pastDays.push(d)
  const n = pastDays.length
  const plan = Object.fromEntries(pastDays.map((d) => [d, { date: d, weekday: isoWd(d), backzettel: 'confirmed', count: 'none' }]))
  const set = (i, patch) => { if (i >= 0 && i < n) Object.assign(plan[pastDays[i]], patch) }
  set(0, { count: 'full', correction: true })
  set(1, { count: 'full' })
  set(n - 3, { backzettel: 'draft', count: 'full' }) // counted without a confirmed Backzettel
  set(n - 2, { count: 'exceeds', openDelta: true }) // one row above baked - cap; one unacknowledged Nachtrag
  set(n - 1, { count: 'partial', ackedDelta: true }) // only the first section counted; one acknowledged Nachtrag

  // a past preorder before the confirm (column "Vorbestellt" on yesterday)
  const pastOrders = []
  const yesterday = pastDays[n - 1]
  const po = await must('POST', '/api/preorders', { token: sale, body: { channel: 'laden', customerName: 'Testkundin Gestern', customerPhone: '0170 3000001', pickupDate: yesterday, pickupTime: '09:00', items: [it('musterweck', 12), it('mustercroissant', 6)] } })
  await must('POST', `/api/preorders/${po.data.id}/status`, { token: sale, body: { status: 'abgeholt', paid: true } })
  pastOrders.push({ id: po.data.id, code: po.data.code, date: yesterday, when: 'before-confirm' })

  for (const d of pastDays) {
    if (plan[d].backzettel !== 'confirmed') continue
    const c = (await must('POST', `/api/backzettel/${d}/confirm`, { token: bake, body: {} })).data
    if (c.status !== 'confirmed') throw new Error(`confirm ${d}: ${c.status}`)
  }
  // Nachträge after the confirm
  for (const d of pastDays) {
    const p = plan[d]
    if (!p.openDelta && !p.ackedDelta) continue
    const r = await must('POST', '/api/preorders', { token: sale, body: { channel: 'telefon', customerName: p.ackedDelta ? 'Testkunde Nachtrag gesehen' : 'Testkundin Nachtrag offen', customerPhone: '0170 3000002', pickupDate: d, pickupTime: '10:00', items: [it('musterbrezel', 8)] } })
    pastOrders.push({ id: r.data.id, code: r.data.code, date: d, when: 'after-confirm' })
    const view = (await must('GET', `/api/backzettel/${d}`, { token: bake })).data
    const open = (view.deltas || []).filter((x) => !x.acknowledgedAt)
    if (open.length === 0) throw new Error(`no Nachtrag recorded on past day ${d}`)
    if (p.ackedDelta) await must('POST', `/api/backzettel/${d}/deltas/ack`, { token: bake, body: { ids: open.map((x) => x.id) } })
    p.deltas = open.map((x) => ({ id: x.id, itemId: x.itemId, qty: x.qty, kind: x.kind, acknowledged: !!p.ackedDelta }))
  }

  // counting: Verkauf at the shop station (PIN session), correction by verkauf2 with a password session
  const pin = await must('POST', '/api/auth/pin', { station: station.token, body: { userId: USERS.verkauf.id, pin: USERS.verkauf.pin } })
  const verkaufPin = pin.data.token
  const qtyFor = (line, row, mode, first) => {
    const base = Math.max(0, (line.baked ?? line.planned ?? 0) - (line.cap || 0))
    if (!first) return 0
    let q = (base * (mode === 'exceeds' && line === exceedsLine ? 3 : 0.12)) / (row.factor || 1)
    q = row.integer ? Math.floor(q) : Math.round(q * 2) / 2
    if (mode === 'exceeds' && line === exceedsLine) q = Math.max(q, row.integer ? Math.ceil((base + 1) / (row.factor || 1)) : base + 1)
    return q
  }
  let exceedsLine = null
  for (const d of pastDays) {
    const p = plan[d]
    if (p.count === 'none') continue
    const view = (await must('GET', `/api/rest?date=${d}`, { token: verkaufPin })).data ?? (await must('GET', `/api/rest?date=${d}`, { token: verkaufPin }))
    if (!view.editable) throw new Error(`rest ${d} not editable: ${view.editIssue}`)
    const lines = p.count === 'partial' ? view.lines.filter((l) => l.section === view.lines[0].section) : view.lines
    exceedsLine = p.count === 'exceeds' ? lines.find((l) => (l.baked ?? 0) > 0) : null
    const items = lines.flatMap((l) => l.rows.map((r, i) => ({ itemId: l.itemId, ...(l.variant ? { variant: l.variant } : {}), productId: r.productId, qty: qtyFor(l, r, p.count, i === 0), expected: r.qty })))
    const saved = await must('PUT', `/api/rest/${d}`, { token: verkaufPin, body: { items } })
    const sv = saved.data ?? saved
    p.lines = view.lines.length
    p.countedLines = sv.summary.countedLines
    p.rows = sv.summary.rows
    p.countedRows = sv.summary.countedRows
    p.exceedsKey = exceedsLine ? exceedsLine.key : undefined
    if (p.correction) {
      const l = sv.lines.find((x) => x.counted && x.rows[0].qty > 0)
      const r0 = l.rows[0]
      const sale2 = await login(USERS.verkauf2)
      await must('PUT', `/api/rest/${d}`, { token: sale2, body: { items: [{ itemId: l.itemId, ...(l.variant ? { variant: l.variant } : {}), productId: r0.productId, qty: r0.qty + 1, expected: r0.qty }] } })
      p.correctedLine = { key: l.key, productId: r0.productId, from: r0.qty, to: r0.qty + 1, by: USERS.verkauf2.username }
    }
    log('rest', d, p.count, `${p.countedRows}/${p.rows} rows`)
  }
  const from = pastDays[0]
  const summary = await must('GET', `/api/rest/summary?from=${from}&to=${today}`, { token: owner })
  const sm = summary.data ?? summary
  const averages = await call('GET', '/api/rest/averages?weeks=6', { token: bake })
  const todayView = await must('GET', `/api/rest?date=${today}`, { token: sale })

  return {
    deliveries: {
      depot: { name: depot.name ?? null, street: depot.street ?? null, city: depot.city ?? null, hasCoordinates: depot.lat != null },
      drivers,
      saturday,
      tours: tourWorld,
      startedTour: { tourId: tours[1].id, doneStopId: firstStop.id, by: USERS.fahrer2.username },
      unlinkedFahrer: USERS.fahrer3.username,
      geo: 'NOMINATIM_URL/OSRM_URL point at a closed port -> every route/ETA is an estimate (isEstimate), Elster and Oberdorf have no coordinates',
    },
    restAmAbend: {
      today,
      window: (todayView.data ?? todayView).window,
      days: pastDays.map((d) => plan[d]),
      pastPreorders: pastOrders,
      countedVia: { pinSession: `${USERS.verkauf.username} at ${station.name}`, correction: USERS.verkauf2.username },
      summary: { counts: sm.counts ?? null, days: (sm.days || []).map((x) => ({ date: x.date, status: x.status })) },
      averagesStatus: averages.status,
      todayStatus: { backzettelStatus: (todayView.data ?? todayView).backzettelStatus, editable: (todayView.data ?? todayView).editable },
    },
  }
}
