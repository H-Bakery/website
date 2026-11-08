import {
  cellReference,
  cellValue,
  displayValue,
  fetchBackzettelConfig,
  fetchReference,
  groupBySection,
  inputProblem,
  isPerVariant,
  labelledMessage,
  parseInput,
  referenceFor,
  saveGrundmenge,
  variantLabel,
} from './grundmengenApi'
import {
  syntheticConfig,
  syntheticReference,
  syntheticReferenceV2,
  syntheticView,
} from './grundmengenFixtures'

jest.mock('@bakery/shared/data-access', () => ({
  apiClient: { get: jest.fn(), put: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('@bakery/shared/data-access') as {
  apiClient: { get: jest.Mock; put: jest.Mock }
}

beforeEach(() => {
  apiClient.get.mockReset()
  apiClient.put.mockReset()
})

describe('Endpunkte', () => {
  it('GET /api/backzettel/config', async () => {
    const view = syntheticView()
    apiClient.get.mockResolvedValue({ success: true, data: view })
    await expect(fetchBackzettelConfig()).resolves.toEqual(view)
    expect(apiClient.get).toHaveBeenCalledWith('/api/backzettel/config')
  })

  it('PUT /api/backzettel/config/base mit genau der Änderung', async () => {
    apiClient.put.mockResolvedValue({
      success: true,
      data: { ...syntheticView(), pending: true, changed: true },
    })
    const edit = { itemId: 'testzopf', weekday: 6, variants: { mohn: 2 } }
    const res = await saveGrundmenge(edit)
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/backzettel/config/base',
      edit
    )
    expect(res.pending).toBe(true)
  })

  it('GET /api/backzettel/reference?weeks=6', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: syntheticReference(),
    })
    await fetchReference()
    expect(apiClient.get).toHaveBeenCalledWith('/api/backzettel/reference', {
      weeks: 6,
    })
  })

  it('leere Antwort ist ein Fehler', async () => {
    apiClient.get.mockResolvedValue({ success: true })
    await expect(fetchBackzettelConfig()).rejects.toThrow('Leere Antwort')
  })
})

describe('Zellen lesen', () => {
  const config = syntheticConfig()
  const brot = config.items[0]
  const zopf = config.items[2]

  it('kein Eintrag = undefined (zählt 0), null = offen', () => {
    expect(cellValue(brot, 2, null)).toBe(4)
    expect(cellValue(brot, 4, null)).toBeUndefined()
    expect(cellValue(brot, 6, null)).toBeNull()
  })

  it('Sorten: Wert je Sorte; Postenzeile hat dann keinen eigenen Wert', () => {
    expect(isPerVariant(zopf, 6)).toBe(true)
    expect(cellValue(zopf, 6, 'nuss')).toBe(4)
    expect(cellValue(zopf, 6, 'mohn')).toBeNull()
    expect(cellValue(zopf, 6, null)).toBeUndefined()
    expect(cellValue(zopf, 2, 'nuss')).toBeUndefined()
    expect(cellValue({ base: { 6: null } }, 6, 'nuss')).toBeNull()
  })

  it('Anzeige und Eingabe', () => {
    expect(displayValue(undefined)).toBe('0')
    expect(displayValue(null)).toBe('')
    expect(displayValue(1.24)).toBe('1,24')
    expect(parseInput('')).toBeNull()
    expect(parseInput(' 1,5 ')).toBe(1.5)
    expect(parseInput('12')).toBe(12)
    expect(parseInput('-1')).toBeNaN()
    expect(parseInput('viel')).toBeNaN()
  })

  it('Meldung: negativ ist keine erlaubte Menge, Feldname nicht doppelt (W4-verify r3)', () => {
    expect(inputProblem('-5')).toMatch(/^Keine negativen Mengen/)
    expect(inputProblem('viel')).toMatch(/^Bitte eine Zahl eingeben/)
    expect(
      labelledMessage(
        'Kornbrot, Freitag',
        'Kornbrot, Freitag: 99999 ist unplausibel groß (höchstens 10000).'
      )
    ).toBe('Kornbrot, Freitag: 99999 ist unplausibel groß (höchstens 10000).')
    expect(labelledMessage('Kornbrot, Freitag', 'Keine Verbindung.')).toBe(
      'Kornbrot, Freitag: Keine Verbindung.'
    )
  })

  it('Abschnitte in der Reihenfolge der Config, Sortenname aus fillings', () => {
    expect(groupBySection(config).map((s) => [s.id, s.label])).toEqual([
      ['brot', 'Brot'],
      ['broetchen', 'Brötchen'],
      ['hefeteig', 'Hefeteig'],
    ])
    expect(variantLabel(config, 'nuss')).toBe('Nussfüllung')
    expect(variantLabel(config, 'apfel')).toBe('apfel')
  })

  it('Referenz je Wochentag und Posten', () => {
    const ref = syntheticReference()
    expect(referenceFor(ref, 6, 'testweck')?.median).toBe(58)
    expect(referenceFor(ref, 4, 'testweck')?.status).toBe('no_data')
    expect(referenceFor(null, 6, 'testweck')).toBeNull()
  })

  it('Referenz je Zeile: Posten, Laibgröße (Z10), Füllung nie', () => {
    const ref = syntheticReferenceV2()
    const korn = { id: 'testkorn', variantKind: 'size' as const }
    expect(cellReference(ref, 6, korn, null)?.median).toBe(9)
    expect(cellReference(ref, 6, korn, 'g500')).toMatchObject({
      itemId: 'testkorn',
      sizeId: 'g500',
      median: 6,
      plu: [981],
    })
    expect(cellReference(ref, 6, korn, 'g1000')?.status).toBe('unknown')
    expect(cellReference(ref, 6, korn, 'g750')).toBeNull()
    expect(
      cellReference(ref, 6, { id: 'testkorn', variantKind: 'filling' }, 'g500')
    ).toBeNull()
    // älterer Server ohne sizes: keine Referenz an der Größe
    delete ref.weekdays[0].items[0].sizes
    expect(cellReference(ref, 6, korn, 'g500')).toBeNull()
  })
})
