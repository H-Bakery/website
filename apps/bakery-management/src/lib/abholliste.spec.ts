import {
  ABHOLLISTE_BACK_LABEL,
  CANCELLED_GROUP,
  abholActions,
  owesRest,
  abhollisteBackFromQuery,
  abhollisteHref,
  abhollisteParamsFromQuery,
  codeTargets,
  parsePreorderCode,
  preorderHrefFromAbholliste,
  remoteSearchRange,
  searchHitLabel,
  statusWord,
  targetLabel,
  wantsRemoteSearch,
  bulkRequestFailedMessage,
  changeAlreadyApplied,
  singleRequestFailedMessage,
  defaultPickupDate,
  defaultPickupPlace,
  MOERSBACH_POINT_ID,
  nameSortKey,
  preferredPickupPoint,
  describeBulkResults,
  groupPreorders,
  isDayEndAllowed,
  isPickupPlace,
  isWaiting,
  matchesSearch,
  placeLabel,
  staleListMessage,
  stepPickupDay,
  wrongWeekdayNotice,
} from './abholliste'
import { POINT, preorder } from './testing/preorderFixtures'

const list = [
  preorder({
    id: 1,
    code: 'LA-2026-11-14-01',
    customerName: 'Zora Zett',
    pickupTime: '09:00',
  }),
  preorder({
    id: 2,
    code: 'LA-2026-11-14-02',
    customerName: 'Anna Ahorn',
    pickupTime: '08:30',
  }),
  preorder({
    id: 3,
    code: 'LA-2026-11-14-03',
    customerName: 'Ömer Öz',
    pickupTime: null,
  }),
  preorder({
    id: 4,
    code: 'LA-2026-11-14-04',
    customerName: 'Bernd Birke',
    pickupTime: '08:30',
  }),
  preorder({
    id: 5,
    code: 'LA-2026-11-14-05',
    customerName: 'Carla Storno',
    status: 'storniert',
  }),
]

describe('groupPreorders', () => {
  it('nach Uhrzeit: Zeiten aufsteigend, ohne Uhrzeit danach, Storniert am Ende', () => {
    const groups = groupPreorders(list, 'zeit')
    expect(groups.map((g) => g.label)).toEqual([
      '08:30 Uhr',
      '09:00 Uhr',
      'Ohne Uhrzeit',
      'Storniert',
    ])
    expect(groups[0].preorders.map((p) => p.customerName)).toEqual([
      'Anna Ahorn',
      'Bernd Birke',
    ])
    expect(groups[3].key).toBe(CANCELLED_GROUP)
  })

  it('an einer Sammelstelle heißt die Gruppe nach dem Übergabefenster', () => {
    const groups = groupPreorders(
      [preorder({ pickupTime: null, pickupPointId: POINT.id })],
      'zeit',
      { window: '09:00-09:30' }
    )
    expect(groups[0].label).toBe('Übergabe 09:00-09:30 Uhr')
  })

  it('nach Name: Anfangsbuchstaben, Umlaute wie ihr Grundbuchstabe', () => {
    const groups = groupPreorders(list, 'name')
    expect(groups.map((g) => g.label)).toEqual([
      'A',
      'B',
      'O',
      'Z',
      'Storniert',
    ])
  })
})

describe('matchesSearch', () => {
  const p = preorder({
    code: 'LA-2026-11-14-03',
    customerName: 'Jürgen Weiß',
    customerPhone: '0170 000 0001',
  })
  it.each([
    ['jurgen', true],
    ['WEISS', true],
    ['weiß', true],
    ['3', true],
    ['03', true],
    ['4', false],
    ['LA-2026-11-14-03', true],
    // Ganzer Code ohne führende Null (vom Zettel abgetippt, auch klein).
    ['la-2026-11-14-3', true],
    ['LA-2026-11-14-4', false],
    ['11-14', true],
    ['0170000', true],
    ['000 0001', true],
    ['Erika', false],
    ['', true],
  ])('%s → %s', (query, expected) => {
    expect(matchesSearch(p, query)).toBe(expected)
  })
})

describe('abholActions', () => {
  // Abholtag der Fixture ist der 13.11.2026.
  const TODAY = '2026-11-13'

  it('Verkauf: offen → übergeben, bereit, nicht abgeholt, bezahlt', () => {
    expect(abholActions(preorder(), 'verkauf', TODAY)).toEqual({
      handover: true,
      ready: true,
      notCollected: true,
      clearNotCollected: false,
      markPaid: true,
      markRefunded: false,
      markUnpaid: false,
      undoHandover: false,
    })
  })

  it('zu viel bezahlt: „Erstattet“ für Verkauf und Fahrer, storniert nur Verkauf (W4-verify r3)', () => {
    const cheaper = preorder({
      paid: true,
      paidAmount: 9,
      total: 3.6,
      paymentBalance: -5.4,
    })
    expect(abholActions(cheaper, 'fahrer', TODAY)).toMatchObject({
      handover: true,
      markPaid: false,
      markRefunded: true,
    })
    expect(abholActions(cheaper, 'verkauf', TODAY).markRefunded).toBe(true)
    const cancelled = preorder({
      status: 'storniert',
      paid: true,
      paymentBalance: -9,
    })
    // Storniert + bezahlt → `paid: false`; das darf der Fahrer nicht (API).
    expect(abholActions(cancelled, 'verkauf')).toMatchObject({
      handover: false,
      markRefunded: true,
    })
    expect(abholActions(cancelled, 'fahrer').markRefunded).toBe(false)
    // Betrag stimmt: kein „Erstattet“.
    expect(
      abholActions(
        preorder({ paid: true, paymentBalance: 0 }),
        'verkauf',
        TODAY
      ).markRefunded
    ).toBe(false)
  })

  it('Fahrer: nur übergeben, nicht abgeholt und bezahlt (wie die API)', () => {
    expect(abholActions(preorder(), 'fahrer', TODAY)).toMatchObject({
      handover: true,
      ready: false,
      notCollected: true,
      markPaid: true,
    })
    const done = preorder({ status: 'abgeholt', paid: true })
    expect(abholActions(done, 'fahrer')).toMatchObject({
      handover: false,
      undoHandover: false,
      markUnpaid: false,
    })
    expect(abholActions(done, 'verkauf')).toMatchObject({
      undoHandover: true,
      markUnpaid: true,
    })
  })

  it('„nicht abgeholt“ lässt die Übergabe zu und lässt sich zurücknehmen', () => {
    const late = preorder({ status: 'bereit', notCollected: true })
    expect(abholActions(late, 'verkauf', TODAY)).toMatchObject({
      handover: true,
      notCollected: false,
      clearNotCollected: true,
    })
    expect(isWaiting(late)).toBe(false)
    expect(isWaiting(preorder({ status: 'bereit' }))).toBe(true)
  })

  it('„nicht abgeholt“ erst ab dem Abholtag (wie die API, W4)', () => {
    const p = preorder({ status: 'bereit' })
    expect(abholActions(p, 'verkauf', '2026-11-12').notCollected).toBe(false)
    expect(abholActions(p, 'fahrer', '2026-11-12').notCollected).toBe(false)
    expect(abholActions(p, 'verkauf', TODAY).notCollected).toBe(true)
    expect(abholActions(p, 'verkauf', '2026-11-20').notCollected).toBe(true)
    // Tag noch unbekannt (erster Render): lieber nicht anbieten.
    expect(abholActions(p, 'verkauf').notCollected).toBe(false)
    expect(abholActions(p, 'verkauf', '').notCollected).toBe(false)
    // Übergeben geht trotzdem schon vorher.
    expect(abholActions(p, 'verkauf', '2026-11-12').handover).toBe(true)
  })

  it('nichts für Stornierte, Anonymisierte, Backstube und ohne Rolle', () => {
    const none = Object.values(
      abholActions(preorder({ status: 'storniert' }), 'inhaber')
    )
    expect(none.every((v) => v === false)).toBe(true)
    expect(
      Object.values(
        abholActions(preorder({ anonymizedAt: '2026-01-01' }), 'inhaber')
      ).some(Boolean)
    ).toBe(false)
    expect(
      Object.values(abholActions(preorder(), 'backstube')).some(Boolean)
    ).toBe(false)
    expect(Object.values(abholActions(preorder(), null)).some(Boolean)).toBe(
      false
    )
  })
})

describe('Tage und Orte', () => {
  it('Laden: Produktionstage (Montag übersprungen)', () => {
    // Sa 14.11. → So 15.11. → Di 17.11.
    expect(stepPickupDay('2026-11-15', 1, null)).toBe('2026-11-17')
    expect(stepPickupDay('2026-11-17', -1, null)).toBe('2026-11-15')
  })

  it('Sammelstelle: von Liefertag zu Liefertag', () => {
    expect(stepPickupDay('2026-11-14', 1, POINT)).toBe('2026-11-21')
    expect(stepPickupDay('2026-11-14', -1, POINT)).toBe('2026-11-07')
    expect(stepPickupDay('2026-11-12', 1, POINT)).toBe('2026-11-14')
  })

  it('Vorgabetag: heute im Laden (Mo → Di), Sammelstelle ab heute', () => {
    expect(defaultPickupDate('2026-11-12', null)).toBe('2026-11-12')
    expect(defaultPickupDate('2026-11-16', null)).toBe('2026-11-17')
    expect(defaultPickupDate('2026-11-12', POINT)).toBe('2026-11-14')
    expect(defaultPickupDate('2026-11-14', POINT)).toBe('2026-11-14')
  })

  it('Vorgabeort: Fahrer an der Sammelstelle, alle anderen im Laden', () => {
    const other = { ...POINT, id: 'anderswo', weekday: 3 }
    expect(defaultPickupPlace('verkauf', [POINT])).toBe('laden')
    expect(defaultPickupPlace('fahrer', [other, POINT], '2026-11-14')).toBe(
      POINT.id
    )
    expect(defaultPickupPlace('fahrer', [other, POINT], '2026-11-12')).toBe(
      'anderswo'
    )
    expect(defaultPickupPlace('fahrer', [])).toBe('laden')
    expect(
      defaultPickupPlace('fahrer', [{ ...POINT, active: false }], '2026-11-14')
    ).toBe('laden')
  })

  it('Nach Name: Anreden zählen nicht (UI-Runde 1)', () => {
    expect(nameSortKey('Frau Müller')).toBe('Müller')
    expect(nameSortKey('Familie Schmidt')).toBe('Schmidt')
    expect(nameSortKey('Hr. Dr. Weber')).toBe('Weber')
    expect(nameSortKey('Herrmann Kurz')).toBe('Herrmann Kurz')
    expect(nameSortKey('Frau')).toBe('Frau')
    const groups = groupPreorders(
      [
        preorder({ id: 11, code: 'LA-1', customerName: 'Frau Zander' }),
        preorder({ id: 12, code: 'LA-2', customerName: 'Familie Albers' }),
        preorder({ id: 13, code: 'LA-3', customerName: 'Anna Ahorn' }),
      ],
      'name'
    )
    expect(groups.map((g) => g.key)).toEqual(['A', 'Z'])
    expect(groups[0].preorders.map((p) => p.customerName)).toEqual([
      'Familie Albers',
      'Anna Ahorn',
    ])
  })

  it('Vorgabeort: früheste Übergabe des Tages, nicht die alphabetisch erste (UI-Runde 1)', () => {
    // Die API liefert alphabetisch: „Gemeindehaus …“ (10:00) vor „Kita …“ (09:00).
    const later = {
      ...POINT,
      id: 'gemeindehaus-test',
      name: 'Gemeindehaus Test',
      window: '10:00-10:30',
    }
    expect(defaultPickupPlace('fahrer', [later, POINT], '2026-11-14')).toBe(
      POINT.id
    )
    expect(preferredPickupPoint([later, POINT])?.id).toBe(POINT.id)
    // Ohne Fenster nach hinten, bei Gleichstand nach Namen.
    expect(preferredPickupPoint([{ ...POINT, window: null }, later])?.id).toBe(
      later.id
    )
    // Der Menüpunkt „Sammelstelle Mörsbach“ öffnet Mörsbach, auch wenn eine
    // andere Stelle früher übergibt.
    const moersbach = {
      ...later,
      id: MOERSBACH_POINT_ID,
      name: 'Kindergarten Mörsbach',
    }
    expect(
      preferredPickupPoint([POINT, moersbach], { preferId: MOERSBACH_POINT_ID })
        ?.id
    ).toBe(MOERSBACH_POINT_ID)
    // … aber nur, wenn sie aktiv ist und an dem Tag beliefert wird.
    expect(
      preferredPickupPoint([POINT, { ...moersbach, active: false }], {
        preferId: MOERSBACH_POINT_ID,
      })?.id
    ).toBe(POINT.id)
    expect(
      preferredPickupPoint([POINT, { ...moersbach, weekday: 3 }], {
        date: '2026-11-14',
        preferId: MOERSBACH_POINT_ID,
      })?.id
    ).toBe(POINT.id)
    expect(preferredPickupPoint([])).toBeNull()
  })

  it('prüft Orte aus der URL und benennt sie', () => {
    expect(isPickupPlace('laden', [])).toBe(true)
    expect(isPickupPlace(POINT.id, [POINT])).toBe(true)
    expect(isPickupPlace('nirgendwo', [POINT])).toBe(false)
    expect(isPickupPlace(undefined, [POINT])).toBe(false)
    expect(placeLabel('laden', [POINT])).toBe('Laden')
    expect(placeLabel(POINT.id, [POINT])).toBe('Kita Teststraße')
  })

  it('Tagesabschluss erst am Abholtag', () => {
    expect(isDayEndAllowed('2026-11-12', '2026-11-12')).toBe(true)
    expect(isDayEndAllowed('2026-11-10', '2026-11-12')).toBe(true)
    expect(isDayEndAllowed('2026-11-13', '2026-11-12')).toBe(false)
    expect(isDayEndAllowed('2026-11-13', '')).toBe(false)
  })

  it('warnt, wenn die Sammelstelle an dem Tag nicht beliefert wird', () => {
    expect(wrongWeekdayNotice('2026-11-14', POINT)).toBeNull()
    expect(wrongWeekdayNotice('2026-11-13', POINT)).toBe(
      'Kita Teststraße wird nur Samstags beliefert.'
    )
    expect(wrongWeekdayNotice('2026-11-13', null)).toBeNull()
  })

  it('baut die Seiten-URL', () => {
    expect(abhollisteHref('2026-11-14', 'laden')).toBe(
      '/admin/preorders/abholliste?date=2026-11-14&point=laden'
    )
    expect(abhollisteHref()).toBe('/admin/preorders/abholliste')
  })
})

/** Query einer URL so, wie Next sie der Seite gibt (`searchParams`). */
function queryOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, 'http://box.local').searchParams)
}

describe('Suche in der URL und Rückweg aus einer Bestellung', () => {
  it('abhollisteHref nimmt die Suche mit, die Seite liest sie wieder', () => {
    const href = abhollisteHref('2026-11-17', 'laden', '  Erika B. ')
    expect(href).toBe(
      '/admin/preorders/abholliste?date=2026-11-17&point=laden&q=Erika+B.'
    )
    expect(abhollisteParamsFromQuery(queryOf(href))).toEqual({
      date: '2026-11-17',
      place: 'laden',
      q: 'Erika B.',
    })
    // Leere Suche fällt weg.
    expect(abhollisteHref('2026-11-17', 'laden', '   ')).toBe(
      '/admin/preorders/abholliste?date=2026-11-17&point=laden'
    )
  })

  it('verwirft ungültige Parameter einzeln', () => {
    expect(
      abhollisteParamsFromQuery({
        date: '2026-02-30',
        point: 'Kita Test!',
        q: ['  Max ', 'Moritz'],
      })
    ).toEqual({ q: 'Max' })
    expect(abhollisteParamsFromQuery({ q: 'x'.repeat(250) }).q).toHaveLength(
      100
    )
  })

  it('„Bestellung öffnen“ trägt die Herkunft, die Ansicht baut daraus den Rückweg', () => {
    const href = preorderHrefFromAbholliste(7, {
      date: '2026-11-17',
      place: 'kita-test',
      q: 'Erika',
    })
    expect(href).toBe(
      '/admin/preorders/7?von=abholliste&date=2026-11-17&point=kita-test&q=Erika'
    )
    expect(abhollisteBackFromQuery(queryOf(href))).toEqual({
      href: '/admin/preorders/abholliste?date=2026-11-17&point=kita-test&q=Erika',
      label: ABHOLLISTE_BACK_LABEL,
    })
    expect(
      preorderHrefFromAbholliste(7, { date: '2026-11-17', place: 'laden' })
    ).toBe('/admin/preorders/7?von=abholliste&date=2026-11-17&point=laden')
  })

  it('ohne gültige Herkunft kein Rückweg zur Abholliste', () => {
    const ok = { von: 'abholliste', date: '2026-11-17', point: 'laden' }
    expect(abhollisteBackFromQuery(ok)?.href).toBe(
      '/admin/preorders/abholliste?date=2026-11-17&point=laden'
    )
    expect(abhollisteBackFromQuery({})).toBeNull()
    expect(abhollisteBackFromQuery({ ...ok, von: 'tag' })).toBeNull()
    expect(abhollisteBackFromQuery({ ...ok, date: '2026-13-01' })).toBeNull()
    expect(abhollisteBackFromQuery({ ...ok, date: undefined })).toBeNull()
    expect(
      abhollisteBackFromQuery({ ...ok, point: '../../admin/users' })
    ).toBeNull()
  })
})

describe('Suche über den Tag hinaus', () => {
  it('liest einen Code vom Zettel, auch klein getippt', () => {
    expect(parsePreorderCode('LA-2026-11-17-03')).toEqual({
      prefix: 'LA',
      date: '2026-11-17',
      number: 3,
    })
    expect(parsePreorderCode('  la-2026-11-17-3 ')).toEqual({
      prefix: 'LA',
      date: '2026-11-17',
      number: 3,
    })
    expect(parsePreorderCode('te-2026-11-21-12')?.prefix).toBe('TE')
  })

  it('ein Code mit einem Tag, den es nicht gibt, ist kein Code', () => {
    expect(parsePreorderCode('LA-2026-02-30-01')).toBeNull()
    expect(parsePreorderCode('LA-2026-11-17')).toBeNull()
    expect(parsePreorderCode('Erika')).toBeNull()
    expect(parsePreorderCode('LAX-2026-11-17-01')).toBeNull()
  })

  it('ordnet den Code seiner Liste zu, wie die API ihn vergibt', () => {
    const other = { ...POINT, id: 'halle-oberdorf', weekday: 3 }
    // `LA` ist der Laden.
    expect(codeTargets('LA-2026-11-17-03', [POINT, other])).toEqual([
      { date: '2026-11-17', place: 'laden' },
    ])
    // Kürzel aus dem letzten Teil der Kennung: `kita-test` → `TE`.
    expect(codeTargets('te-2026-11-21-02', [POINT, other])).toEqual([
      { date: '2026-11-21', place: 'kita-test' },
    ])
    // Unbekanntes Kürzel: keine Liste; kein Code: `null`.
    expect(codeTargets('XY-2026-11-21-02', [POINT, other])).toEqual([])
    expect(codeTargets('Erika', [POINT])).toBeNull()
  })

  it('teilen sich zwei Sammelstellen ein Kürzel, gewinnt die an dem Tag belieferte', () => {
    const saturday = { ...POINT, id: 'kita-test', weekday: 6 }
    const wednesday = { ...POINT, id: 'turnhalle-test', weekday: 3 }
    expect(codeTargets('TE-2026-11-18-01', [saturday, wednesday])).toEqual([
      { date: '2026-11-18', place: 'turnhalle-test' },
    ])
    // Liefert keine an dem Tag: beide anbieten.
    expect(
      codeTargets('TE-2026-11-17-01', [saturday, wednesday]).map((t) => t.place)
    ).toEqual(['kita-test', 'turnhalle-test'])
  })

  it('sucht zwei Wochen zurück und 30 Tage voraus', () => {
    expect(remoteSearchRange('2026-11-17')).toEqual({
      from: '2026-11-03',
      to: '2026-12-17',
    })
  })

  it('fragt die API nicht nach einer laufenden Nummer oder einem Buchstaben', () => {
    expect(wantsRemoteSearch('3')).toBe(false)
    expect(wantsRemoteSearch('03')).toBe(false)
    expect(wantsRemoteSearch(' e ')).toBe(false)
    expect(wantsRemoteSearch('Er')).toBe(true)
    expect(wantsRemoteSearch('0170')).toBe(true)
  })

  it('beschreibt einen Treffer mit Tag, Ort, Name und Status', () => {
    const hit = preorder({
      pickupDate: '2026-11-17',
      customerName: 'Erika Beispiel',
      status: 'bereit',
      notCollected: true,
    })
    expect(searchHitLabel(hit, [POINT])).toBe(
      'Di 17.11. · Laden · Erika Beispiel (nicht abgeholt)'
    )
    expect(
      searchHitLabel(
        {
          ...hit,
          pickupDate: '2026-11-21',
          pickupPointId: POINT.id,
          pickupPoint: null,
          customerName: null,
          code: 'TE-2026-11-21-01',
          status: 'storniert',
          notCollected: false,
        },
        [POINT]
      )
    ).toBe('Sa 21.11. · Kita Teststraße · TE-2026-11-21-01 (storniert)')
    expect(statusWord({ status: 'offen', notCollected: false })).toBe('offen')
    expect(targetLabel({ date: '2026-11-17', place: 'laden' }, [POINT])).toBe(
      'Di 17.11. · Laden'
    )
  })
})

describe('Sammelaktionen: Meldungen (W4)', () => {
  it('trennt Konflikt, anonymisiert, fehlt und abgelehnt', () => {
    const report = describeBulkResults(
      'dayEnd',
      [
        { id: 1, result: 'ok' },
        { id: 2, result: 'ok' },
        { id: 3, result: 'conflict' },
        { id: 4, result: 'anonymized' },
        { id: 5, result: 'anonymized' },
        { id: 6, result: 'not_found' },
        { id: 7, result: 'refused', message: 'Nicht erlaubt.' },
      ],
      new Map([[7, 'LA-2026-11-14-07']])
    )
    expect(report.done).toBe('2 Bestellungen als nicht abgeholt markiert.')
    expect(report.problems).toEqual([
      '1 Bestellung wurde inzwischen an anderer Stelle geändert und nicht angefasst.',
      '2 Bestellungen sind schon anonymisiert (Datenschutz) und lassen sich nicht mehr ändern.',
      '1 Bestellung gibt es nicht mehr.',
      'LA-2026-11-14-07: Nicht erlaubt.',
    ])
  })

  it('nichts geändert: keine Erfolgsmeldung', () => {
    const report = describeBulkResults('ready', [
      { id: 1, result: 'conflict' },
      { id: 2, result: 'conflict' },
    ])
    expect(report.done).toBeNull()
    expect(report.problems).toEqual([
      '2 Bestellungen wurden inzwischen an anderer Stelle geändert und nicht angefasst.',
    ])
    expect(describeBulkResults('ready', [{ id: 1, result: 'ok' }]).done).toBe(
      '1 Bestellung als bereit markiert.'
    )
  })

  it('Request gescheitert und veraltete Liste: eigene Sätze je Ursache', () => {
    expect(bulkRequestFailedMessage('offline')).toMatch(/^Keine Verbindung/)
    expect(bulkRequestFailedMessage('server')).toMatch(/nichts gespeichert/)
    expect(bulkRequestFailedMessage('refused', 'Nein.')).toBe('Nein.')
    expect(staleListMessage('offline', '09:14')).toBe(
      'Keine Verbindung zum Server - die Liste konnte nicht neu geladen werden. Angezeigt wird der Stand von 09:14.'
    )
    expect(staleListMessage('server', '')).toBe(
      'Der Server hat beim Neuladen einen Fehler gemeldet.'
    )
  })
})

describe('verlorene Antworten (W4-Verifikation)', () => {
  const base = preorder({ id: 1, status: 'offen', paid: false })

  it('changeAlreadyApplied vergleicht nur die angefragten Felder', () => {
    expect(
      changeAlreadyApplied(
        { ...base, status: 'abgeholt', paid: true },
        { status: 'abgeholt', paid: true }
      )
    ).toBe(true)
    expect(
      changeAlreadyApplied(
        { ...base, status: 'abgeholt', paid: false },
        { status: 'abgeholt', paid: true }
      )
    ).toBe(false)
    expect(changeAlreadyApplied(base, { status: 'abgeholt' })).toBe(false)
    // „Erstattet“/„Rest kassiert“ (paid: true auf Bezahltem) ist erst
    // erledigt, wenn kein Betrag mehr offen ist (W4-verify r3).
    expect(
      changeAlreadyApplied(
        { ...base, status: 'abgeholt', paid: true, paymentBalance: -3.6 },
        { status: 'abgeholt', paid: true }
      )
    ).toBe(false)
    expect(
      changeAlreadyApplied(
        { ...base, status: 'abgeholt', paid: true, paymentBalance: 0 },
        { status: 'abgeholt', paid: true }
      )
    ).toBe(true)
    expect(
      changeAlreadyApplied(
        { ...base, status: 'bereit', notCollected: true },
        { notCollected: true }
      )
    ).toBe(true)
  })

  it('singleRequestFailedMessage: ohne frische Liste „unklar“, mit frischer Liste „nichts gespeichert“', () => {
    expect(singleRequestFailedMessage('offline', false)).toMatch(/unklar/)
    expect(singleRequestFailedMessage('server', false)).toMatch(/unklar/)
    expect(singleRequestFailedMessage('offline', true)).toMatch(
      /nichts gespeichert/
    )
  })
})

describe('bezahlt, aber teurer geworden (W4-verify r2)', () => {
  it('bietet „Bezahlt“ für den Rest an, auch dem Fahrer', () => {
    const p = preorder({
      paid: true,
      paidAmount: 10,
      total: 10.9,
      paymentBalance: 0.9,
    })
    expect(owesRest(p)).toBe(true)
    expect(abholActions(p, 'fahrer').markPaid).toBe(true)
    expect(abholActions(p, 'fahrer').markUnpaid).toBe(false)
    const full = preorder({ paid: true, paymentBalance: 0 })
    expect(owesRest(full)).toBe(false)
    expect(abholActions(full, 'verkauf').markPaid).toBe(false)
  })
})
