import {
  API_BASE_URL,
  ApiError,
  SessionExpiredError,
  clearDeviceData,
  deliveryApi,
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
import {
  currentSession,
  resetSessionCache,
  saveSession,
  type DeliverySession,
} from './session'

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

  it('verliert kein Abhaken, das während des Nachsendens dazukommt', async () => {
    // Wackliges Netz: A wird nachgesendet und hängt; währenddessen tippt der
    // Fahrer B, dessen Request scheitert - B landet in der Schlange. Früher
    // schrieb flushQueue nach As Antwort seine alte Kopie zurück ([]).
    let answerA: (value: unknown) => void = () => undefined
    ;(global as { fetch?: unknown }).fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          answerA = resolve
        })
    )
    queueStopUpdate(7, 1, { status: 'done' })
    const flushing = flushQueue()
    queueStopUpdate(7, 2, { status: 'done' })
    expect(pendingUpdates()).toHaveLength(2)
    answerA({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 7, stops: [] }),
    })
    const result = await flushing

    expect(pendingUpdates()).toEqual([
      expect.objectContaining({ kind: 'stop', tourId: 7, stopId: 2 }),
    ])
    expect(result.remaining).toEqual(pendingUpdates())
  })

  it('schickt einen inzwischen ersetzten Stand nicht mehr', async () => {
    const fetchMock = serverAnswers(preorderResponse)
    ;(global as { fetch?: unknown }).fetch = fetchMock
    queuePreorderUpdate(101, { status: 'handed_over' })
    queueStopUpdate(7, 1, { status: 'done' })
    // Während die Übergabe unterwegs ist, tippt der Fahrer um auf „nicht
    // abgeholt" (gleiche Millisekunde). Die Antwort auf den alten Stand darf
    // den neuen Eintrag nicht mit aus der Schlange nehmen.
    fetchMock.mockImplementationOnce(async () => {
      queuePreorderUpdate(101, { status: 'not_collected' })
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(preorderResponse),
      }
    })
    await flushQueue()
    expect(pendingUpdates()).toEqual([
      expect.objectContaining({
        kind: 'preorder',
        body: { status: 'not_collected' },
      }),
    ])
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

describe('Anmeldung in request() (B8)', () => {
  const session: DeliverySession = {
    token: 'at_1',
    refreshToken: 'rt_1',
    user: { id: 42, username: 'f', displayName: 'F', role: 'fahrer' },
  }
  const respond = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })
  const refreshed = {
    success: true,
    data: { user: session.user, token: 'at_2', refreshToken: 'rt_2' },
  }
  let fetchMock: jest.Mock

  beforeEach(() => {
    window.localStorage.clear()
    resetSessionCache()
    saveSession(session)
    fetchMock = jest.fn()
    ;(global as { fetch?: unknown }).fetch = fetchMock
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  it('schickt das Access-Token als Bearer', async () => {
    fetchMock.mockResolvedValue(respond([]))

    await deliveryApi.drivers()

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer at_1')
  })

  it('erneuert bei 401 einmal und wiederholt die Anfrage mit dem neuen Token', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(respond(refreshed))
      .mockResolvedValueOnce(respond([{ id: 1 }]))

    expect(await deliveryApi.drivers()).toEqual([{ id: 1 }])
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/auth\/refresh$/)
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer at_2')
    expect(currentSession()?.refreshToken).toBe('rt_2')
  })

  it('meldet ab, wenn der Refresh abgelehnt wird - keine ApiError', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))

    const error = await deliveryApi.drivers().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SessionExpiredError)
    expect(error).not.toBeInstanceOf(ApiError)
    expect(currentSession()).toBeNull()
  })

  it('behält ein Abhaken in der Schlange, wenn die Sitzung abgelaufen ist', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))
    queueStopUpdate(7, 1, { status: 'done' })

    const result = await flushQueue()

    expect(result.rejected).toEqual([])
    expect(pendingUpdates()).toHaveLength(1)
  })

  it('bleibt angemeldet, wenn nur der Refresh im Funkloch scheitert', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ error: 'unauthorized' }, 401))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await deliveryApi.drivers().catch((e: unknown) => e)

    expect(error).not.toBeInstanceOf(SessionExpiredError)
    expect(error).not.toBeInstanceOf(ApiError)
    expect(currentSession()).toEqual(session)
  })

  it('löscht beim Abmelden Warteschlange, Kopien und gewählten Fahrer', () => {
    queueStopUpdate(7, 1, { status: 'done' })
    rememberDrivers([])
    window.localStorage.setItem('bakery-delivery-driver', '1')

    clearDeviceData()

    expect(pendingUpdates()).toEqual([])
    expect(rememberedDrivers()).toBeNull()
    expect(window.localStorage.getItem('bakery-delivery-driver')).toBeNull()
    // die Sitzung selbst beendet `logout()`, nicht diese Funktion
    expect(currentSession()).toEqual(session)
  })
})
