import {
  SESSION_END_MESSAGES,
  STATION_MAX_SESSION_MS,
  idleLimitMs,
  isBackstubePath,
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

describe('Backstube-Tablet (Z6): eigene Leerlauf-Grenze', () => {
  const backstube = { role: 'backstube', path: '/backstube' }

  it('isBackstubePath: /backstube und darunter, sonst nicht', () => {
    expect(isBackstubePath('/backstube')).toBe(true)
    expect(isBackstubePath('/backstube/x')).toBe(true)
    expect(isBackstubePath('/backstubeX')).toBe(false)
    expect(isBackstubePath('/admin/backzettel')).toBe(false)
    expect(isBackstubePath(null)).toBe(false)
  })

  it('Station + Rolle backstube + /backstube: Vorgabe 12 h statt 10 min', () => {
    expect(idleLimitMs('station', {}, backstube)).toBe(12 * HOUR)
    expect(idleLimitMs('station', { backstubeMinutes: '90' }, backstube)).toBe(
      90 * MIN
    )
    expect(idleLimitMs('station', { backstubeMinutes: '0' }, backstube)).toBe(
      12 * HOUR
    )
  })

  it('/backstube an der Station: lange Grenze für jede Rolle (W4)', () => {
    for (const role of ['inhaber', 'backstube', 'verkauf', 'fahrer', null]) {
      expect(idleLimitMs('station', {}, { role, path: '/backstube' })).toBe(
        12 * HOUR
      )
      expect(
        idleLimitMs('station', {}, { role, path: '/backstube/2026-11-14' })
      ).toBe(12 * HOUR)
    }
    expect(
      idleLimitMs(
        'station',
        { backstubeMinutes: '90' },
        { role: 'inhaber', path: '/backstube' }
      )
    ).toBe(90 * MIN)
  })

  it('andere Seite oder persönliche Sitzung: unverändert', () => {
    expect(
      idleLimitMs('station', {}, { role: 'backstube', path: '/admin' })
    ).toBe(10 * MIN)
    expect(
      idleLimitMs('station', {}, { role: 'inhaber', path: '/admin/backzettel' })
    ).toBe(10 * MIN)
    // Kein Präfix-Treffer auf ähnlich benannte Pfade
    expect(
      idleLimitMs('station', {}, { role: 'inhaber', path: '/backstubex' })
    ).toBe(10 * MIN)
    expect(idleLimitMs('personal', {}, backstube)).toBe(12 * HOUR)
  })

  it('12-h-Grenze nach der PIN gilt auch für den Inhaber an /backstube', () => {
    const start = new Date(2026, 10, 6, 1, 30).getTime()
    const limit = idleLimitMs(
      'station',
      {},
      { role: 'inhaber', path: '/backstube' }
    )
    const s = { sessionKind: 'station' as const, startedAt: start }
    expect(sessionEndReason(s, start + 11 * HOUR, limit, null)).toBeNull()
    expect(
      sessionEndReason(s, start + STATION_MAX_SESSION_MS, limit, null)
    ).toBe('max_age')
  })

  it('die 12-h-Grenze nach der PIN und das Tagesende gelten weiter', () => {
    const start = new Date(2026, 10, 6, 1, 30).getTime()
    const limit = idleLimitMs('station', {}, backstube)
    const s = { sessionKind: 'station' as const, startedAt: start }
    expect(sessionEndReason(s, start + 3 * HOUR, limit, null)).toBeNull()
    expect(
      sessionEndReason(s, start + STATION_MAX_SESSION_MS, limit, null)
    ).toBe('max_age')
    expect(
      sessionEndReason(s, start + 11 * HOUR, limit, parseClockTime('11:00'))
    ).toBe('closing')
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

  it('schreibt vorhandene gesperrte Seiten um, erlaubte nicht', () => {
    expect(pilotRewriteTarget('/admin/sitzung-pruefen', true)).toBe(
      PILOT_UNAVAILABLE_PATH
    )
    // Rest am Abend: im Pilot freigegeben (Entscheidung 2026-11-08)
    expect(pilotRewriteTarget('/admin/rest', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/rest/auswertung', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/delivery/preorders', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/users', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/login', true)).toBeNull()
  })

  it('lässt gelöschte Seiten (B12) zur deutschen 404 durch', () => {
    // Keine Seite mehr dahinter - „arbeitet noch mit Beispieldaten“ stimmte
    // nicht mehr, und die Brotkrume zeigte den rohen Slug.
    expect(pilotRewriteTarget('/admin/cash', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/inventory', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/chat', true)).toBeNull()
    expect(pilotRewriteTarget('/admin/orders/5', true)).toBeNull()
  })

  it('schreibt die Ersatzseite nicht noch einmal um', () => {
    expect(pilotRewriteTarget(PILOT_UNAVAILABLE_PATH, true)).toBeNull()
  })
})
