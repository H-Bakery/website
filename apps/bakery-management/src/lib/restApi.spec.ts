import {
  draftChanges,
  formatRate,
  isIsoDate,
  loadDraft,
  parsePadInput,
  pruneDraft,
  restCsvFileName,
  rowKey,
  stepQty,
  storeDraft,
  type RestDay,
} from './restApi'
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
    expect(draftChanges(day, { [weck]: 3, [kranz]: 0 })).toEqual([
      { itemId: 'kranz', variant: 'nuss', qty: 0, expected: null },
    ])
    expect(draftChanges(day, { [weck]: null })).toEqual([
      { itemId: 'weck', productId: 'test-weck', qty: null, expected: 3 },
    ])
  })

  it('drops draft entries the server already has or no longer knows', () => {
    expect(
      pruneDraft(day, { 'weck||test-weck': 3, 'kranz|nuss|': 1, 'alt||x': 2 })
    ).toEqual({ 'kranz|nuss|': 1 })
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

  it('formats German and checks dates', () => {
    expect(formatRate(0.15)).toBe('15,0 %')
    expect(formatRate(null)).toBe('–')
    expect(isIsoDate('2026-12-01')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(restCsvFileName({ from: '2026-11-01', to: '2026-11-28' })).toBe(
      'rest-am-abend-2026-11-01-bis-2026-11-28.csv'
    )
  })

  it('keeps the draft per day in localStorage and survives a broken store', () => {
    useMemoryStorage()
    storeDraft('2026-12-01', { 'weck||test-weck': 4 })
    expect(loadDraft('2026-12-01')).toEqual({ 'weck||test-weck': 4 })
    expect(loadDraft('2026-12-02')).toEqual({})
    storeDraft('2026-12-01', {})
    expect(loadDraft('2026-12-01')).toEqual({})
    window.localStorage.setItem('bakery-rest-draft:2026-12-03', '{kaputt')
    expect(loadDraft('2026-12-03')).toEqual({})
    ;(window.localStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('gesperrt')
    })
    expect(loadDraft('2026-12-01')).toEqual({})
  })
})
