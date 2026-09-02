import { isBusinessDate, toBusinessDate } from './partnerTypes'

describe('isBusinessDate', () => {
  it('accepts real calendar days in YYYY-MM-DD', () => {
    expect(isBusinessDate('2026-08-26')).toBe(true)
    expect(isBusinessDate('2024-02-29')).toBe(true)
    expect(isBusinessDate(toBusinessDate())).toBe(true)
  })

  it('rejects everything that only looks like a date', () => {
    // `new Date(2026, 12, 45)` würde stillschweigend zum 14.02.2027
    expect(isBusinessDate('2026-13-45')).toBe(false)
    expect(isBusinessDate('2026-02-30')).toBe(false)
    expect(isBusinessDate('2023-02-29')).toBe(false)
    expect(isBusinessDate('2026-00-10')).toBe(false)
  })

  it('rejects other shapes and non-strings', () => {
    expect(isBusinessDate('foo')).toBe(false)
    expect(isBusinessDate('26.08.2026')).toBe(false)
    expect(isBusinessDate('2026-8-26')).toBe(false)
    expect(isBusinessDate('2026-08-26T08:00')).toBe(false)
    expect(isBusinessDate('')).toBe(false)
    expect(isBusinessDate(undefined)).toBe(false)
    expect(isBusinessDate(['2026-08-26'])).toBe(false)
  })
})
