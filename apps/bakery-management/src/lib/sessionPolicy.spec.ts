import {
  SESSION_END_MESSAGES,
  STATION_MAX_SESSION_MS,
  idleLimitMs,
  nextClockTimeAfter,
  parseClockTime,
  sessionEndReason,
  stationLogoutAtMinutes,
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

describe('Tagesende an der Station (NEXT_PUBLIC_STATION_LOGOUT_AT)', () => {
  /** Lokale Zeit wie auf dem Tablet. */
  const at = (h: number, m = 0, day = 10) =>
    new Date(2026, 10, day, h, m, 0, 0).getTime()

  it('parseClockTime liest HH:MM, sonst null', () => {
    expect(parseClockTime('13:30')).toBe(13 * 60 + 30)
    expect(parseClockTime(' 7:05 ')).toBe(7 * 60 + 5)
    expect(parseClockTime('24:00')).toBeNull()
    expect(parseClockTime('13.30')).toBeNull()
    expect(parseClockTime('')).toBeNull()
    expect(parseClockTime(undefined)).toBeNull()
    expect(stationLogoutAtMinutes(undefined)).toBeNull()
    expect(stationLogoutAtMinutes('18:00')).toBe(18 * 60)
  })

  it('nextClockTimeAfter: heute, wenn noch nicht vorbei, sonst morgen', () => {
    expect(nextClockTimeAfter(at(7), 13 * 60 + 30)).toBe(at(13, 30))
    expect(nextClockTimeAfter(at(14), 13 * 60 + 30)).toBe(at(13, 30, 11))
  })

  it('beendet eine Stationssitzung ab der Uhrzeit, trotz Bedienung', () => {
    const s = {
      sessionKind: 'station' as const,
      startedAt: at(7),
      lastActivityAt: at(13, 29),
    }
    const cutoff = 13 * 60 + 30
    expect(sessionEndReason(s, at(13, 29), 10 * MIN, cutoff)).toBeNull()
    expect(sessionEndReason(s, at(13, 30), 10 * MIN, cutoff)).toBe('closing')
    expect(SESSION_END_MESSAGES.closing).toMatch(/Tagesende/)
  })

  it('wer nach der Uhrzeit die PIN eingibt, bleibt angemeldet (bis morgen)', () => {
    const s = {
      sessionKind: 'station' as const,
      startedAt: at(14),
      lastActivityAt: at(15),
    }
    expect(sessionEndReason(s, at(15, 5), 10 * MIN, 13 * 60 + 30)).toBeNull()
  })

  it('gilt nicht für persönliche Sitzungen und nicht ohne Wert', () => {
    const personal = {
      sessionKind: 'personal' as const,
      startedAt: at(7),
      lastActivityAt: at(13, 59),
    }
    expect(
      sessionEndReason(personal, at(14), 12 * HOUR, 13 * 60 + 30)
    ).toBeNull()
    const station = { ...personal, sessionKind: 'station' as const }
    expect(sessionEndReason(station, at(14), 10 * MIN, null)).toBeNull()
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
