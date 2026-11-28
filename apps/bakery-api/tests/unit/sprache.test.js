/* eslint-env jest */
const {
  parseCountUtterance,
  validateProposal,
  candidatesForDay,
  mergeModelProposal,
  reserveSttCost,
  whisperAudioContext,
} = require('../../src/services/sprache.core')

it.each([
  [1_000, undefined, 256],
  [8_001, 'auto', 465],
  [8_001, ' 0 ', 0],
  [8_000, '500', 500],
  [2_000, '200', 200],
  [12_000, '200', 664],
  [8_000, '1.5', 464],
  [8_000, '-1', 464],
  [8_000, '2000', 1500],
  [29_900, 'auto', 1500],
  [30_000, '256', 1500],
])(
  'berechnet den Whisper-Audiokontext für %i ms bei %s',
  (ms, setting, expected) => {
    expect(whisperAudioContext(ms, setting)).toBe(expected)
  }
)

function countRow(key, label, extra = {}) {
  return {
    key,
    label,
    lineKey: key,
    itemName: label,
    unit: 'Stück',
    itemUnit: 'Stück',
    integer: true,
    factor: 1,
    aliases: [],
    ...extra,
  }
}

const rows = [
  countRow('brot||brot', 'Bauernbrot'),
  countRow('weck||weck', 'Weck', { aliases: ['Semmelchen'] }),
  countRow('brezel||brezel', 'Laugenbrezel'),
  countRow('kuchen||kuchen', 'Käsekuchen', { itemUnit: 'Blech', factor: 0.25 }),
  countRow('saft||', 'Testsaft', {
    unit: 'Liter',
    itemUnit: 'Liter',
    integer: false,
  }),
  countRow('teig||', 'Testteig', {
    unit: 'kg',
    itemUnit: 'kg',
    integer: false,
  }),
]

function read(text, table = rows) {
  const parsed = parseCountUtterance(text, table)
  return {
    proposal: validateProposal(parsed.proposal, {
      rows: table,
      role: 'verkauf',
      editable: true,
    }),
    unmatched: parsed.unmatched,
  }
}

it('löst den Abnahmesatz vollständig und sicher', () => {
  const result = read(
    'Bauernbrot drei, Weck zwölf, Laugenbrezel keine, Käsekuchen zwei Stück'
  )
  expect(result.unmatched).toEqual([])
  expect(
    result.proposal.map(({ key, menge, unsicher }) => [key, menge, unsicher])
  ).toEqual(
    rows.slice(0, 4).map(({ key }, i) => [key, [3, 12, 0, 2][i], false])
  )
})

it.each([
  ['null', 0],
  ['kein', 0],
  ['keine', 0],
  ['nichts', 0],
  ['ein', 1],
  ['eine', 1],
  ['zwei', 2],
  ['zwo', 2],
  ['zwölf', 12],
  ['zwanzig', 20],
  ['einundzwanzig', 21],
  ['siebenunddreißig', 37],
  ['halb', 0.5],
  ['anderthalb', 1.5],
  ['2,5', 2.5],
])('erkennt %s als %s', (word, number) => {
  expect(read(`Testteig ${word} kg`).proposal).toEqual([
    expect.objectContaining({ menge: number, unsicher: false }),
  ])
})

it.each([
  ['Semmelchen zwei', rows[1].key],
  ['Laugen-Brezeln fünf', rows[2].key],
  ['Bauernprott drei', rows[0].key],
  ['Kaesekuchn zwei', rows[3].key],
])('ordnet Alias, Plural und ähnlich klingende Namen zu (%s)', (text, key) => {
  expect(read(text).proposal).toEqual([
    expect.objectContaining({ key, unsicher: false }),
  ])
})

it.each(['noch zwei Weck dazu', 'Weck zwei mehr', 'plus zwei Weck'])(
  'markiert relative Mengen (%s)',
  (text) => {
    expect(read(text).proposal).toEqual([
      expect.objectContaining({ menge: 2, unsicher: true, reason: 'dazu?' }),
    ])
  }
)

it('rechnet nur mit dem Faktor der Zählzeile um', () => {
  expect(read('Käsekuchen ein Blech').proposal[0]).toMatchObject({
    menge: 4,
    unsicher: false,
  })
  expect(read('Käsekuchen ein Liter').proposal[0]).toMatchObject({
    menge: null,
    unsicher: true,
  })
})

it.each([
  'Weck 2,5 Stück',
  'Weck -1',
  'Weck −1',
  'Weck minus eins',
  'Weck 10001',
  'Testteig dreiviertel kg',
])('markiert ungültige Werte (%s)', (text) => {
  expect(read(text).proposal[0]).toMatchObject({
    menge: null,
    unsicher: true,
    reason: expect.any(String),
  })
})

it('lässt unbekannte Namen offen und akzeptiert 0 und 10000', () => {
  expect(read('Krustis zwei').unmatched).toEqual([
    { heard: 'Krustis zwei', candidates: [] },
  ])
  expect(
    read('Weck 0, Käsekuchen 10000').proposal.map(({ menge }) => menge)
  ).toEqual([0, 10000])
})

it('markiert alle doppelten Schlüssel und prüft unbekannte Schlüssel, Rolle und Tag', () => {
  expect(read('Weck zwei, Weck drei').proposal).toEqual([
    expect.objectContaining({
      unsicher: true,
      reason: 'Zeile mehrfach gehört.',
    }),
    expect.objectContaining({
      unsicher: true,
      reason: 'Zeile mehrfach gehört.',
    }),
  ])
  const input = [{ key: rows[0].key, menge: 2 }]
  const opts = { rows, role: 'inhaber', editable: true }
  expect(validateProposal(input, opts)[0]).toMatchObject({
    menge: 2,
    unsicher: false,
  })
  for (const expected of [
    validateProposal([{ key: 'fremd', menge: 2 }], opts),
    validateProposal(input, { ...opts, editable: false }),
    validateProposal(input, { ...opts, role: 'backstube' }),
    validateProposal(input, { ...opts, screen: 'andere-seite' }),
  ]) {
    expect(expected[0]).toMatchObject({
      menge: null,
      unsicher: true,
      reason: expect.any(String),
    })
  }
})

it('setzt mit „Posten … nichts übrig“ die ganze passende Zeile auf 0 und lässt unklare Sorten offen', () => {
  const makeLine = (variant, variantLabel) => ({
    key: `brezeln|${variant}`,
    itemId: 'brezeln',
    name: 'Brezeln',
    variant,
    variantLabel,
    unit: 'Stück',
    rows: [
      {
        productId: 'test-laugenbrezel',
        label: 'Laugenbrezel',
        unit: 'Stück',
        factor: 1,
        integer: true,
      },
      {
        productId: 'test-salzbrezel',
        label: 'Salzbrezel',
        unit: 'Stück',
        factor: 1,
        integer: true,
      },
      { productId: 'test-alt', label: 'Alt', stale: true },
    ],
  })
  const table = candidatesForDay(
    { lines: [makeLine('klein', 'Klein'), makeLine('gross', 'Groß')] },
    { 'test-laugenbrezel': ['Testalias'] }
  )
  expect(table[0].aliases).toEqual(['Testalias'])
  expect(
    read('Posten Brezeln nichts übrig', table).unmatched[0].candidates
  ).toHaveLength(4)
  expect(
    read('Posten Brezeln Klein nichts übrig', table).proposal.map(
      ({ key, menge }) => [key, menge]
    )
  ).toEqual([
    ['brezeln|klein|test-laugenbrezel', 0],
    ['brezeln|klein|test-salzbrezel', 0],
  ])
})

it('erkennt Name und Menge auch ohne Satzzeichen zwischen sicheren Zeilen', () => {
  const result = read('Bauernbrot 3 Weck 12 Laugenbrezel 0 Käsekuchen 2 Stück')
  expect(result.unmatched).toEqual([])
  expect(result.proposal.map(({ menge }) => menge)).toEqual([3, 12, 0, 2])
})

it('prüft die Eingabeeinheit nach der Umrechnung und markiert Stück mit Komma', () => {
  expect(read('Käsekuchen dreiviertel Blech').proposal[0]).toMatchObject({
    menge: 3,
    unsicher: false,
  })
  expect(read('Testteig 500 Gramm').proposal[0]).toMatchObject({
    menge: 0.5,
    unsicher: false,
  })
  expect(read('Weck 2,0 Stück').proposal[0]).toMatchObject({
    menge: null,
    unsicher: true,
  })
})

function modelSuggestion(
  transcript,
  gehoert,
  menge,
  einheit = null,
  key = rows[1].key,
  table = rows
) {
  return mergeModelProposal(
    { proposal: [], unmatched: [{ heard: transcript }] },
    {
      zeilen: [{ key, gehoert, menge, einheit, unsicher: false }],
      nicht_zugeordnet: [],
    },
    transcript,
    { rows: table, editable: true, role: 'verkauf' }
  )
}

it.each([
  ['Vom Weck noch 1,0 Stück', 'Weck noch 1,0 Stück', 1, 'Stück', /ohne Komma/],
  ['Vom Weck noch 1.0 Stück', 'Weck noch 1.0 Stück', 1, null, /ohne Komma/],
  [
    'Vom Weck noch eins Komma null Stück',
    'Weck noch eins',
    1,
    null,
    /ohne Komma/,
  ],
  [
    'Vom Weck liegen zwei oder drei bereit',
    'Weck liegen zwei',
    2,
    null,
    /nicht eindeutig erkennbar/,
  ],
  ['Vom Weck noch zwei, dazu', 'Weck noch zwei', 2, null, /dazu\?/],
  ['Vom Weck noch zwei in Litern', 'Weck noch zwei', 2, null, /Einheit/],
  [
    'Vom Weck noch 1,0 Stück',
    'Weck noch 1',
    1,
    null,
    /kommt im Transkript nicht vor/,
  ],
  ['Vom Weck noch zwei Stück dazu', 'Weck noch zwei', 2, null, /dazu\?/],
  ['Vom Weck plus zwei Stück', 'Weck plus zwei', 2, 'Stück', /dazu\?/],
  ['Vom Weck zwei Stück mehr', 'Weck zwei', 2, null, /dazu\?/],
  ['Vom Weck noch zwei Liter', 'Weck noch zwei', 2, null, /Einheit/],
  ['Vom Weck noch zwei Stück', 'Weck noch zwei Stück', 2, 'Liter', /Einheit/],
  [
    'Vom Weck liegt etwas bereit',
    'Weck liegt etwas bereit',
    2,
    null,
    /nicht eindeutig erkennbar/,
  ],
  [
    'Vom Weck liegen zwei oder drei bereit',
    'Weck liegen zwei oder drei bereit',
    2,
    null,
    /nicht eindeutig erkennbar/,
  ],
  [
    'Vom Weck liegen zwei bereit',
    'Weck liegen zwei bereit',
    3,
    null,
    /weicht von der gesprochenen Menge ab/,
  ],
  [
    'Vom Weck liegen zwei bereit',
    'Weck liegen drei bereit',
    3,
    null,
    /kommt im Transkript nicht vor/,
  ],
])(
  'prüft den Modellvorschlag zu %s gegen das Zitat %s',
  (transcript, excerpt, qty, unit, reason) => {
    expect(
      modelSuggestion(transcript, excerpt, qty, unit).proposal[0]
    ).toMatchObject({
      unsicher: true,
      reason: expect.stringMatching(reason),
    })
  }
)

it('lässt eine belegte absolute Menge in einem freien Satz sicher', () => {
  const heard = 'Vom Weck liegen noch ZWO Stück bereit.'
  expect(
    modelSuggestion(heard, 'weck liegen noch zwo stück bereit.', 2).proposal[0]
  ).toMatchObject({
    menge: 2,
    unsicher: false,
    reason: null,
  })
})

it('lässt das offene Bruchstück stehen, wenn das Modell dessen Dezimalzeichen aus dem Zitat entfernt', () => {
  const heard = 'Vom Weck noch 1,0 Stück'
  expect(
    modelSuggestion(heard, 'Vom Weck noch 1 0 Stück', 1).unmatched
  ).toEqual([{ heard }])
})

it.each([
  [
    'Vom Fantasiegebäck noch zwei Stück',
    rows[1].key,
    /Von der KI zugeordnet – bitte prüfen/,
  ],
  [
    'Vom Weck liegen zwei Stück bereit',
    rows[0].key,
    /Zuordnung prüfen: gehört „Vom Weck/,
  ],
  [
    'Vom Bauernbrot und Weck liegen zwei Stück bereit',
    rows[1].key,
    /Zuordnung prüfen/,
  ],
])(
  'belässt eine unbelegte Modellzuordnung sichtbar (%s)',
  (heard, key, reason) => {
    const result = modelSuggestion(heard, heard, 2, 'Stück', key)
    expect(result.proposal).toEqual([
      expect.objectContaining({
        key,
        heard,
        menge: 2,
        unsicher: true,
        reason: expect.stringMatching(reason),
      }),
    ])
    expect(result.unmatched).toEqual([{ heard }])
  }
)

it('markiert einen Namen mit zwei passenden Zählzeilen als mehrdeutig', () => {
  const heard = 'Vom Weck liegen zwei Stück bereit'
  const table = [...rows, countRow('weck|klein|', 'Weck', { variant: 'Klein' })]
  const result = modelSuggestion(heard, heard, 2, 'Stück', rows[1].key, table)
  expect(result.proposal[0]).toMatchObject({
    unsicher: true,
    reason: expect.stringContaining('Zuordnung prüfen'),
  })
  expect(result.unmatched).toEqual([{ heard }])
})

it.each([
  ['Vom Semmelchen liegen zwei Stück bereit', rows[1].key],
  ['Vom Bauernprott liegen zwei Stück bereit', rows[0].key],
  ['Von Laugen-Brezeln liegen zwei Stück bereit', rows[2].key],
])(
  'verwendet bei Modellzitaten dieselbe Namensprüfung wie beim Parser (%s)',
  (heard, key) => {
    const result = modelSuggestion(heard, heard, 2, 'Stück', key)
    expect(result.proposal[0]).toMatchObject({ unsicher: false, reason: null })
    expect(result.unmatched).toEqual([])
  }
)

const juice = rows.find(({ key }) => key === 'saft||')
const dough = rows.find(({ key }) => key === 'teig||')

it.each([
  [juice, 'zwei Komma fünf', 2.5],
  [dough, '2,5', 2.5],
  [dough, 'anderthalb', 1.5],
  [juice, 'zwei tausend', 2000],
  [juice, 'zwei tausend fünf hundert', 2500],
  [juice, 'tausend und fünf', 1005],
  [juice, '2 000', 2000],
])('prüft die vollständige Mengenangabe %s %s', (row, expression, qty) => {
  const heard = `Vom ${row.label} sind noch ${expression} ${row.unit} übrig`
  expect(
    modelSuggestion(heard, heard, qty, row.unit, row.key).proposal[0]
  ).toMatchObject({
    menge: qty,
    unsicher: false,
    reason: null,
  })
})

it.each([
  [
    'Vom Testsaft sind noch zwei Komma fünf Liter übrig',
    'fünf Liter',
    5,
    /nur einen Teil.*weicht/,
  ],
  [
    'Vom Testsaft sind noch zwei Komma fünf Liter übrig',
    'fünf Liter',
    2.5,
    /nur einen Teil/,
  ],
  [
    'Vom Testsaft sind noch zwei tausend Liter übrig',
    'tausend Liter',
    1000,
    /nur einen Teil.*weicht/,
  ],
  [
    'Vom Testsaft sind noch zwei tausend Liter übrig',
    'Vom Testsaft sind noch zwei tausend Liter übrig',
    2,
    /weicht/,
  ],
])(
  'markiert abweichende und abgeschnittene Mengenbelege (%s, %s)',
  (heard, excerpt, qty, reason) => {
    const result = modelSuggestion(heard, excerpt, qty, 'Liter', juice.key)
    expect(result.proposal[0]).toMatchObject({
      unsicher: true,
      reason: expect.stringMatching(reason),
    })
  }
)

it('reserviert Dauerpuffer, Prompt, Audio und maximale Ausgabe vorab', () => {
  expect(reserveSttCost({ clipSeconds: 1, sttRate: 0.003 })).toBe(150)
  expect(reserveSttCost({ clipSeconds: 3.1, sttRate: 0.003 })).toBe(250)
  expect(
    reserveSttCost({
      clipSeconds: 1,
      sttRate: 0.006,
      promptBytes: 128,
      maxOutputTokens: 2000,
      tokenRate: { input: 1, output: 1 },
    })
  ).toBe(2342)
})
