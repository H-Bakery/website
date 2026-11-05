import {
  STATION_MAX_SESSION_MS,
  idleLimitMs,
  sessionEndReason,
} from './sessionPolicy'
import { PILOT_UNAVAILABLE_PATH, pilotRewriteTarget } from './pilotRewrite'

const MIN = 60 * 1000
const HOUR = 60 * MIN

describe('idleLimitMs', () => {
  it('Vorgaben: Station 10 min, persönlich 12 h', () => {
    expect(idleLimitMs('station', {})).toBe(10 * MIN)
    expect(idleLimitMs('personal', {})).toBe(12 * HOUR)
  })

  it('liest die Umgebung und ignoriert Unsinn', () => {
    expect(idleLimitMs('station', { stationMinutes: '3' })).toBe(3 * MIN)
    expect(idleLimitMs('personal', { personalHours: '0.5' })).toBe(30 * MIN)
    expect(idleLimitMs('station', { stationMinutes: 'abc' })).toBe(10 * MIN)
    expect(idleLimitMs('station', { stationMinutes: '-1' })).toBe(10 * MIN)
  })
})

describe('sessionEndReason', () => {
  const start = 1_000_000

  it('Station: Leerlauf nach der Grenze, gerechnet ab der letzten Bedienung', () => {
    const s = { sessionKind: 'station' as const, startedAt: start }
    expect(sessionEndReason(s, start + 9 * MIN, 10 * MIN)).toBeNull()
    expect(sessionEndReason(s, start + 10 * MIN, 10 * MIN)).toBe('idle')
    expect(
      sessionEndReason(
        { ...s, lastActivityAt: start + 8 * MIN },
        start + 15 * MIN,
        10 * MIN
      )
    ).toBeNull()
  })

  it('Station: spätestens 12 h nach der PIN, auch bei Bedienung', () => {
    const now = start + STATION_MAX_SESSION_MS
    expect(
      sessionEndReason(
        { sessionKind: 'station', startedAt: start, lastActivityAt: now - 1 },
        now,
        10 * MIN
      )
    ).toBe('max_age')
  })

  it('persönlich: keine 12-h-Obergrenze, nur Leerlauf', () => {
    const now = start + 13 * HOUR
    expect(
      sessionEndReason(
        {
          sessionKind: 'personal',
          startedAt: start,
          lastActivityAt: now - MIN,
        },
        now,
        12 * HOUR
      )
    ).toBeNull()
    expect(
      sessionEndReason(
        { sessionKind: 'personal', startedAt: start, lastActivityAt: null },
        now,
        12 * HOUR
      )
    ).toBe('idle')
  })
})

describe('pilotRewriteTarget (Proxy im Pilotbetrieb)', () => {
  it('lässt ohne Pilotbetrieb alles durch', () => {
    expect(pilotRewriteTarget('/admin/cash', false)).toBeNull()
  })

  it('schreibt gesperrte Routen um, erlaubte nicht', () => {
    expect(pilotRewriteTarget('/admin/cash', true)).toBe(PILOT_UNAVAILABLE_PATH)
    expect(pilotRewriteTarget('/admin/delivery', true)).toBe(
      PILOT_UNAVAILABLE_PATH
    )
    expect(pilotRewriteTarget('/admin/delivery/preorders', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/users', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/login', true)).toBeNull()
  })

  it('schreibt die Ersatzseite nicht noch einmal um', () => {
    expect(pilotRewriteTarget(PILOT_UNAVAILABLE_PATH, true)).toBeNull()
  })
})
