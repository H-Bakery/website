import { formatRatio } from './TargetStatusChip'

describe('formatRatio (W4-verify r4)', () => {
  const pct = (r: number) => formatRatio(r).replace(/\s/g, ' ')

  it('rundet auf ganze Prozent: 1,06495 ist 106 %, 0,8571 ist 86 %', () => {
    expect(pct(1.06495)).toBe('106 %')
    expect(pct(0.8571)).toBe('86 %')
  })

  it('zeigt 100 % erst, wenn das Ziel erreicht ist', () => {
    expect(pct(0.9996)).toBe('99 %')
    expect(pct(1)).toBe('100 %')
  })

  it('Schwellen bleiben ganze Prozent (kein 94 % aus 0,95)', () => {
    expect(pct(0.95)).toBe('95 %')
    expect(pct(0.85)).toBe('85 %')
    expect(pct(0.29)).toBe('29 %')
    expect(pct(0.57)).toBe('57 %')
  })

  it('ohne Verhältnis leer', () => {
    expect(formatRatio(null)).toBe('')
    expect(formatRatio(undefined)).toBe('')
  })
})
