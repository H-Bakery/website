import {
  API_BASE_URL,
  ApiError,
  describeError,
  flushQueue,
  pendingUpdates,
  queuePreorderUpdate,
  queueStopUpdate,
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

/**
 * Die Warteschlange traegt seit der Sammelstelle zwei Arten von Aenderungen.
 * Der Kindergarten liegt am Ortsrand - eine Uebergabe wird dort regelmaessig
 * ohne Netz abgehakt und muss trotzdem ankommen.
 */
describe('Warteschlange', () => {
  const preorderResponse = {
    id: 101,
    reference: 'MO-2026-09-12-01',
    status: 'handed_over',
  }

  /** So antwortet die API auf ein erfolgreiches PATCH. */
  const serverAnswers = (body: unknown, status = 200) =>
    jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    })

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  it('liest Einträge aus der Zeit vor den Vorbestellungen weiter', () => {
    // Damals hatte ein Eintrag kein `kind`. Da kann ein noch nicht gesendetes
    // Abhaken drinstehen - wegwerfen waere Datenverlust.
    window.localStorage.setItem(
      'bakery-delivery-queue',
      JSON.stringify([
        {
          id: '7-1-1757000000000',
          tourId: 7,
          stopId: 1,
          body: { status: 'done' },
          queuedAt: '2026-09-05T05:00:00.000Z',
        },
        { id: 'kaputt', body: { status: 'done' } },
      ])
    )

    expect(pendingUpdates()).toEqual([
      {
        id: '7-1-1757000000000',
        kind: 'stop',
        tourId: 7,
        stopId: 1,
        body: { status: 'done' },
        queuedAt: '2026-09-05T05:00:00.000Z',
      },
    ])
  })

  it('behält pro Ziel nur den letzten Stand', () => {
    queuePreorderUpdate(101, { status: 'handed_over' })
    queueStopUpdate(7, 1, { status: 'done' })
    const queue = queuePreorderUpdate(101, { status: 'not_collected' })

    expect(queue).toHaveLength(2)
    expect(queue.filter((entry) => entry.kind === 'preorder')).toEqual([
      expect.objectContaining({
        kind: 'preorder',
        preorderId: 101,
        body: { status: 'not_collected' },
      }),
    ])
    // Der Stopp bleibt davon unberuehrt - andere Art, anderes Ziel.
    expect(queue.some((entry) => entry.kind === 'stop')).toBe(true)
  })

  it('sendet eine im Funkloch gespeicherte Übergabe beim nächsten Lauf', async () => {
    const fetchMock = serverAnswers(preorderResponse)
    ;(global as { fetch?: unknown }).fetch = fetchMock

    queuePreorderUpdate(101, { status: 'handed_over' })
    const result = await flushQueue()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/api/deliveries/preorders/101`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ status: 'handed_over' })
    expect(result.preorders).toEqual([preorderResponse])
    expect(result.remaining).toEqual([])
    expect(result.offline).toBe(false)
    expect(pendingUpdates()).toEqual([])
  })

  it('lässt eine Übergabe bei einem Netzfehler stehen', async () => {
    ;(global as { fetch?: unknown }).fetch = jest
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))

    queuePreorderUpdate(101, { status: 'handed_over' })
    const result = await flushQueue()

    expect(result.offline).toBe(true)
    expect(result.remaining).toHaveLength(1)
    expect(pendingUpdates()).toHaveLength(1)
  })

  it('wirft eine fachlich abgelehnte Übergabe aus der Schlange', async () => {
    // Sonst blockierte sie alle folgenden Aenderungen fuer immer.
    ;(global as { fetch?: unknown }).fetch = serverAnswers(
      {
        error: 'Preorder not found',
        message: 'Diese Vorbestellung existiert nicht.',
      },
      404
    )

    queuePreorderUpdate(101, { status: 'handed_over' })
    const result = await flushQueue()

    expect(result.offline).toBe(false)
    expect(result.rejected).toHaveLength(1)
    expect(pendingUpdates()).toEqual([])
  })
})
