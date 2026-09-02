import {
  API_BASE_URL,
  ApiError,
  describeError,
  rememberDrivers,
  rememberedDrivers,
  rememberedTours,
  rememberTours,
  type Driver,
  type Tour,
} from './delivery-api'

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

describe('Offline-Kopie', () => {
  const tour = {
    id: 7,
    date: '2026-09-05',
    driverId: 1,
    stops: [],
  } as unknown as Tour

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('gibt die gemerkte Tourliste nur für denselben Tag und Fahrer zurück', () => {
    rememberTours('2026-09-05', 1, [tour])

    const copy = rememberedTours('2026-09-05', 1)
    expect(copy?.tours).toEqual([tour])
    expect(Number.isNaN(new Date(copy?.at ?? '').getTime())).toBe(false)

    // Anderer Fahrer, anderer Tag, „Alle": das wäre eine andere Liste.
    expect(rememberedTours('2026-09-05', 2)).toBeNull()
    expect(rememberedTours('2026-09-12', 1)).toBeNull()
    expect(rememberedTours('2026-09-05', null)).toBeNull()
  })

  it('unterscheidet „Alle" von einem Fahrer', () => {
    rememberTours('2026-09-05', null, [tour])
    expect(rememberedTours('2026-09-05', null)?.tours).toEqual([tour])
    expect(rememberedTours('2026-09-05', 1)).toBeNull()
  })

  it('behält nur die zuletzt geladene Liste', () => {
    rememberTours('2026-09-05', 1, [tour])
    rememberTours('2026-09-12', 1, [])
    expect(rememberedTours('2026-09-05', 1)).toBeNull()
    expect(rememberedTours('2026-09-12', 1)?.tours).toEqual([])
  })

  it('ignoriert kaputte oder fremde Einträge im localStorage', () => {
    window.localStorage.setItem('bakery-delivery-tours', '{nicht json')
    expect(rememberedTours('2026-09-05', 1)).toBeNull()

    window.localStorage.setItem(
      'bakery-delivery-tours',
      JSON.stringify({ date: '2026-09-05', driverId: 1, tours: 'keine Liste' })
    )
    expect(rememberedTours('2026-09-05', 1)).toBeNull()

    window.localStorage.setItem('bakery-delivery-drivers', '"Fahrer 1"')
    expect(rememberedDrivers()).toBeNull()
  })

  it('merkt sich die Fahrerliste', () => {
    expect(rememberedDrivers()).toBeNull()
    const drivers: Driver[] = [
      { id: 1, name: 'Fahrer 1', phone: null, vehicle: 'van', active: true },
    ]
    rememberDrivers(drivers)
    expect(rememberedDrivers()).toEqual(drivers)
  })
})
