import {
  dayKindText,
  draftChanges,
  draftConflicts,
  formatQtyUnit,
  formatRate,
  isIsoDate,
  loadDraft,
  parsePadInput,
  pruneDraft,
  rebaseDraft,
  restCsvFileName,
  rowKey,
  setDraftEntry,
  stepQty,
  storeDraft,
  type RestDay,
} from './restApi'
import { formatQty } from './backzettelFormat'
import { useMemoryStorage } from './testing/memoryStorage'

const day: Pick<RestDay, 'lines'> = {
  lines: [
    {
      key: 'weck|',
      itemId: 'weck',
      variant: null,
      variantLabel: null,
      name: 'Weck',
      section: 'broetchen',
      sectionLabel: 'Brötchen',
      unit: 'Stück',
      planned: 40,
      baked: 40,
      cap: 0,
      onBackzettel: true,
      counted: true,
      rest: 3,
      restSoFar: 3,
      rows: [
        {
          productId: 'test-weck',
          label: 'Weck',
          unit: 'Stück',
          factor: 1,
          integer: true,
          step: 1,
          qty: 3,
          countedAt: null,
          countedBy: null,
          revision: 1,
          stale: false,
        },
      ],
    },
    {
      key: 'kranz|nuss',
      itemId: 'kranz',
      variant: 'nuss',
      variantLabel: 'Nuss',
      name: 'Kranz',
      section: 'hefeteig',
      sectionLabel: 'Hefeteig',
      unit: 'Stück',
      planned: 2,
      baked: 2,
      cap: 0,
      onBackzettel: true,
      counted: false,
      rest: null,
      restSoFar: null,
      rows: [
        {
          productId: '',
          label: 'Kranz',
          unit: 'Stück',
          factor: 1,
          integer: true,
          step: 1,
          qty: null,
          countedAt: null,
          countedBy: null,
          revision: 0,
          stale: false,
        },
      ],
    },
  ],
}

describe('restApi helpers', () => {
  it('builds the save batch only from real changes, with what the screen knew', () => {
    const weck = rowKey(day.lines[0], day.lines[0].rows[0])
    const kranz = rowKey(day.lines[1], day.lines[1].rows[0])
    expect(weck).toBe('weck||test-weck')
    expect(kranz).toBe('kranz|nuss|')
    expect(
      draftChanges(day, {
        [weck]: { qty: 3, base: 3 },
        [kranz]: { qty: 0, base: null },
      })
    ).toEqual([{ itemId: 'kranz', variant: 'nuss', qty: 0, expected: null }])
    expect(draftChanges(day, { [weck]: { qty: null, base: 3 } })).toEqual([
      { itemId: 'weck', productId: 'test-weck', qty: null, expected: 3 },
    ])
  })

  it('sends the value the input was based on, not the freshly loaded one', () => {
    // Entered 5 when the row was uncounted; another tablet saved 3 since.
    const weck = 'weck||test-weck'
    const draft = { [weck]: { qty: 5, base: null } }
    expect(draftChanges(day, draft)).toEqual([
      { itemId: 'weck', productId: 'test-weck', qty: 5, expected: null },
    ])
    expect(draftConflicts(day, draft)).toEqual([
      expect.objectContaining({
        itemId: 'weck',
        productId: 'test-weck',
        name: 'Weck',
        qty: 3,
      }),
    ])
    const rebased = rebaseDraft(day, draft)
    expect(rebased[weck]).toEqual({ qty: 5, base: 3 })
    expect(draftConflicts(day, rebased)).toEqual([])
    expect(draftChanges(day, rebased)[0].expected).toBe(3)
  })

  it('keeps the base of the first tap and drops entries equal to the server', () => {
    const key = 'weck||test-weck'
    let draft = setDraftEntry({}, key, 3, 4)
    expect(draft).toEqual({ [key]: { qty: 4, base: 3 } })
    draft = setDraftEntry(draft, key, 7, 5)
    expect(draft).toEqual({ [key]: { qty: 5, base: 3 } })
    expect(setDraftEntry(draft, key, 5, 5)).toEqual({})
  })

  it('drops draft entries the server already has or no longer knows', () => {
    expect(
      pruneDraft(day, {
        'weck||test-weck': { qty: 3, base: null },
        'kranz|nuss|': { qty: 1, base: null },
        'alt||x': { qty: 2, base: null },
      })
    ).toEqual({ 'kranz|nuss|': { qty: 1, base: null } })
  })

  it('steps never below 0; „−“ on an uncounted row means 0', () => {
    expect(stepQty(null, 1, 1)).toBe(1)
    expect(stepQty(null, 1, -1)).toBe(0)
    expect(stepQty(0, 1, -1)).toBe(0)
    expect(stepQty(1, 0.5, 1)).toBe(1.5)
    expect(stepQty(10000, 1, 1)).toBe(10000)
  })

  it('reads the number pad: integers for pieces, comma for litres', () => {
    expect(parsePadInput('', true)).toBeNull()
    expect(parsePadInput('12', true)).toBe(12)
    expect(parsePadInput('1,5', true)).toBeNaN()
    expect(parsePadInput('1,5', false)).toBe(1.5)
    expect(parsePadInput('1,555', false)).toBeNaN()
    expect(parsePadInput('20000', true)).toBeNaN()
  })

  it('writes litres like the Backzettel („4,5 L“)', () => {
    expect(formatQtyUnit(4.5, 'Liter')).toBe('4,5 L')
    expect(formatQtyUnit(4.5, 'Liter')).toBe(formatQty(4.5, 'Liter'))
    expect(formatQtyUnit(3, 'Stück')).toBe('3 St.')
    expect(formatQtyUnit(null, 'Liter')).toBe('–')
  })

  it('formats German and checks dates', () => {
    expect(formatRate(0.15)).toBe('15,0 %')
    expect(formatRate(null)).toBe('–')
    expect(isIsoDate('2026-12-01')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(restCsvFileName({ from: '2026-11-01', to: '2026-11-28' })).toBe(
      'rest-am-abend-2026-11-01-bis-2026-11-28.csv'
    )
  })

  it('keeps the draft per user and day in localStorage and survives a broken store', () => {
    useMemoryStorage()
    const entry = { 'weck||test-weck': { qty: 4, base: null } }
    storeDraft(1, '2026-12-01', entry)
    expect(loadDraft(1, '2026-12-01')).toEqual(entry)
    expect(loadDraft(1, '2026-12-02')).toEqual({})
    expect(loadDraft(2, '2026-12-01')).toEqual({})
    storeDraft(1, '2026-12-01', {})
    expect(loadDraft(1, '2026-12-01')).toEqual({})
    window.localStorage.setItem('bakery-rest-draft:1:2026-12-03', '{kaputt')
    expect(loadDraft(1, '2026-12-03')).toEqual({})
    // Old format (plain numbers, no base) is not trusted.
    window.localStorage.setItem(
      'bakery-rest-draft:1:2026-12-04',
      JSON.stringify({
        'weck||test-weck': 4,
        'kranz|nuss|': { qty: -1, base: 0 },
      })
    )
    expect(loadDraft(1, '2026-12-04')).toEqual({})
    ;(window.localStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('gesperrt')
    })
    expect(loadDraft(1, '2026-12-01')).toEqual({})
  })
})

describe('dayKindText (Kalender, Z14)', () => {
  const kind = {
    kind: 'sonderoeffnung' as const,
    label: 'Sonderöffnung (wie Samstag)',
    detail: 'Testmarkt',
    note: 'Testmarkt',
    holidayName: null,
    baseWeekday: 6,
    openUntil: null,
  }

  it('Text mit Notiz, ohne Notiz, nichts am normalen Tag oder ohne Kalender', () => {
    expect(dayKindText(kind)).toBe('Sonderöffnung (wie Samstag) · Testmarkt')
    expect(dayKindText({ ...kind, detail: null })).toBe(
      'Sonderöffnung (wie Samstag)'
    )
    expect(
      dayKindText({ ...kind, kind: 'normal', label: null, detail: null })
    ).toBeNull()
    expect(dayKindText(undefined)).toBeNull()
  })
})
