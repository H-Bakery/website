import { ApiError } from '@bakery/shared/data-access'
import { errorText } from './errorText'

const OFFLINE = 'Keine Verbindung zum Server – bitte WLAN prüfen.'

describe('errorText', () => {
  it('zeigt bei toter API keinen englischen Browsertext', () => {
    expect(errorText(new TypeError('Failed to fetch'), 'x')).toBe(OFFLINE)
    expect(errorText(new TypeError('Load failed'), 'x')).toBe(OFFLINE)
    expect(errorText(new Error('Request timeout'), 'x')).toBe(OFFLINE)
    expect(errorText(new ApiError('HTTP 502: Bad Gateway', 502), 'x')).toBe(
      OFFLINE
    )
  })

  it('übernimmt die deutsche Meldung der API', () => {
    expect(
      errorText(new ApiError('Partner nicht gefunden.', 404, 'not_found'), 'x')
    ).toBe('Partner nicht gefunden.')
    expect(errorText(new Error('Vorlage ungültig.'), 'x')).toBe(
      'Vorlage ungültig.'
    )
  })

  it('ersetzt nackte Statustexte und Programmfehler durch den Rückfalltext', () => {
    expect(
      errorText(
        new ApiError('HTTP 500: Internal Server Error', 500),
        'Laden fehlgeschlagen.'
      )
    ).toBe('Laden fehlgeschlagen. (Fehler 500)')
    expect(
      errorText(
        new TypeError('Cannot read properties of undefined'),
        'Laden fehlgeschlagen.'
      )
    ).toBe('Laden fehlgeschlagen.')
    expect(errorText('kaputt', 'Laden fehlgeschlagen.')).toBe(
      'Laden fehlgeschlagen.'
    )
  })
})
