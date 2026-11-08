import { describeAuthError } from './authErrors'
import { OFFLINE_TEXT } from '../../lib/backstubeErrors'

class FakeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
  }
}

describe('describeAuthError (Anmeldung, Station)', () => {
  it('ohne Antwort: deutscher WLAN-Hinweis statt „Failed to fetch“', () => {
    expect(describeAuthError(new TypeError('Failed to fetch'), 'x')).toBe(
      OFFLINE_TEXT
    )
    expect(describeAuthError(new Error('Load failed'), 'x')).toBe(OFFLINE_TEXT)
  })

  it('Caddy 502 ohne JSON-Kennung zählt als nicht erreichbar', () => {
    expect(
      describeAuthError(new FakeApiError('HTTP 502: Bad Gateway', 502), 'x')
    ).toBe(OFFLINE_TEXT)
  })

  it('deutsche API-Meldung bleibt', () => {
    expect(
      describeAuthError(
        new FakeApiError('PIN falsch.', 401, 'invalid_pin'),
        'Anmeldung fehlgeschlagen.'
      )
    ).toBe('PIN falsch.')
    expect(describeAuthError(new Error('Benutzername falsch.'), 'x')).toBe(
      'Benutzername falsch.'
    )
  })

  it('ohne Text: Rückfall', () => {
    expect(describeAuthError(null, 'Anmeldung fehlgeschlagen.')).toBe(
      'Anmeldung fehlgeschlagen.'
    )
  })
})
