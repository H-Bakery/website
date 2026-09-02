import { API_BASE_URL, ApiError, describeError } from './delivery-api'

describe('describeError', () => {
  const fallback = 'Stopp konnte nicht angelegt werden.'

  it('übersetzt den Netzfehler des Browsers ("Failed to fetch") ins Deutsche', () => {
    const text = describeError(new TypeError('Failed to fetch'), fallback)
    expect(text).toMatch(/^Keine Verbindung zur Bäckerei-API/)
    expect(text).toContain(API_BASE_URL)
    expect(text).not.toContain('Failed to fetch')
  })

  it('erklärt einen Timeout als nicht antwortende API', () => {
    const timeout = new Error('signal timed out')
    timeout.name = 'TimeoutError'
    expect(describeError(timeout, fallback)).toBe(
      'Die Bäckerei-API antwortet nicht. Bitte gleich noch einmal versuchen.'
    )
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(describeError(abort, fallback)).toMatch(/antwortet nicht/)
  })

  it('gibt die Meldung der API unverändert weiter', () => {
    expect(describeError(new ApiError('Kunde fehlt', 400), fallback)).toBe(
      'Kunde fehlt'
    )
  })

  it('fällt bei Unbekanntem auf den Ersatztext zurück', () => {
    expect(describeError('kaputt', fallback)).toBe(fallback)
    expect(describeError(new Error('Sonstiges'), fallback)).toBe('Sonstiges')
  })
})
