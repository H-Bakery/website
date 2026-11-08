import { ApiError } from '@bakery/shared/data-access'
import { OFFLINE_TEXT, describeBackstubeError } from './backstubeErrors'

const FALLBACK = 'Der Backzettel konnte nicht geladen werden.'

describe('describeBackstubeError', () => {
  it('Netzfehler und Zeitüberschreitung: deutscher WLAN-Hinweis', () => {
    expect(
      describeBackstubeError(new TypeError('Failed to fetch'), FALLBACK)
    ).toEqual({ text: OFFLINE_TEXT, offline: true })
    expect(
      describeBackstubeError(new Error('Request timeout'), FALLBACK)
    ).toEqual({ text: OFFLINE_TEXT, offline: true })
    expect(describeBackstubeError(null, FALLBACK).offline).toBe(true)
  })

  it('502-504 vom Proxy ohne Kennung: nicht erreichbar', () => {
    for (const status of [502, 503, 504]) {
      expect(
        describeBackstubeError(
          new ApiError(`HTTP ${status}: Bad Gateway`, status),
          FALLBACK
        )
      ).toEqual({ text: OFFLINE_TEXT, offline: true })
    }
  })

  it('4xx mit deutscher Meldung der API: die Meldung', () => {
    expect(
      describeBackstubeError(
        new ApiError('Erst nach der Freigabe abhaken.', 409, 'not_confirmed'),
        FALLBACK
      )
    ).toEqual({ text: 'Erst nach der Freigabe abhaken.', offline: false })
  })

  it('kein englischer HTTP-Text, auch nicht bei 4xx ohne Meldung oder 5xx', () => {
    const forbidden = describeBackstubeError(
      new ApiError('HTTP 403: Forbidden', 403),
      FALLBACK
    )
    expect(forbidden.offline).toBe(false)
    expect(forbidden.text).toBe(`${FALLBACK} (Fehler 403)`)

    const server = describeBackstubeError(
      new ApiError('Internal error', 500, 'internal_error'),
      FALLBACK
    )
    expect(server.offline).toBe(false)
    expect(server.text).toContain('Fehler auf dem Server (500)')
    expect(server.text).not.toContain('Internal')

    const hq = describeBackstubeError(
      new ApiError('hq nicht verfügbar', 503, 'hq_unavailable'),
      FALLBACK
    )
    expect(hq.offline).toBe(false)
  })
})
