import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeliveryDashboard from './page'
import {
  deliveryApi,
  rememberDrivers,
  rememberTours,
  pendingUpdates,
  queuePreorderUpdate,
  type Driver,
  type Preorder,
  type Stop,
  type Tour,
} from '../lib/delivery-api'
import { nextSaturdayIso } from '../lib/format'

/**
 * Regression: ohne erreichbare API zeigte die Seite "Für diesen Tag ist noch
 * nichts geplant" samt aktivem "Tour anlegen" - obwohl die Tour auf dem Server
 * längst stand und nur das Handy kein Netz hatte. Ein Fahrer, dessen GET
 * scheiterte und dessen POST durchging, legte so eine zweite Samstagstour an.
 */

jest.mock('../lib/delivery-api', () => ({
  ...jest.requireActual('../lib/delivery-api'),
  deliveryApi: {
    drivers: jest.fn(),
    tours: jest.fn(),
    createTour: jest.fn(),
    updateStop: jest.fn(),
    updatePreorder: jest.fn(),
    reportPosition: jest.fn(),
  },
}))

// Leaflet braucht ein echtes Fenster; die Karte ist hier nicht Thema.
jest.mock('../components/Map', () => ({ Map: () => null }))

const api = deliveryApi as jest.Mocked<typeof deliveryApi>

const driver: Driver = {
  id: 1,
  name: 'Fahrer 1',
  phone: null,
  vehicle: 'car',
  active: true,
}

const tour: Tour = {
  id: 7,
  date: '2026-09-05',
  driverId: 1,
  driver,
  depot: {
    name: 'Backstube',
    street: 'Eckstraße 3',
    zip: '66424',
    city: 'Homburg',
    phone: null,
    lat: 49.3226,
    lon: 7.3389,
  },
  name: 'Samstagstour',
  status: 'planned',
  vehicleType: 'car',
  plannedStart: '06:30',
  startedAt: null,
  finishedAt: null,
  distance: null,
  duration: null,
  isEstimate: false,
  geometry: null,
  routedAt: null,
  lastPosition: null,
  stops: [],
  progress: { total: 0, done: 0, failed: 0, open: 0, isComplete: false },
  nextStopId: null,
}

/** So scheitert `fetch` im Browser, wenn der Server aus ist oder das Netz fehlt. */
const networkError = () => new TypeError('Failed to fetch')

describe('DeliveryDashboard ohne erreichbare API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    // Keine Fahrerliste: sonst wechselt der Fahrer nach dem Laden und die
    // Touren würden ein zweites Mal geholt - das würde die Zählung verwischen.
    api.drivers.mockResolvedValue([])
  })

  it('bietet "Tour anlegen" nicht an, wenn die Touren nicht geladen werden konnten', async () => {
    api.tours.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)

    expect(
      await screen.findByRole('heading', {
        name: 'Tour konnte nicht geladen werden',
      })
    ).toBeTruthy()
    expect(screen.queryByText(/noch nichts geplant/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(
      /Keine Verbindung zur Bäckerei-API/
    )
  })

  it('holt die Tour mit "Erneut laden" nach und räumt die Meldung weg', async () => {
    api.tours.mockRejectedValueOnce(networkError()).mockResolvedValue([tour])

    render(<DeliveryDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut laden' }))

    expect(
      await screen.findByRole('heading', { name: 'Samstagstour' })
    ).toBeTruthy()
    expect(api.tours).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Erneut laden' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
  })

  it('holt mit "Erneut laden" auch die Fahrerliste nach', async () => {
    // Im Funkloch scheitern Fahrer und Touren zusammen. Kaeme nur die Tour
    // zurueck, bliebe die Fahrerauswahl bis zum Neuladen der Seite leer.
    api.drivers
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue([driver])
    api.tours.mockRejectedValueOnce(networkError()).mockResolvedValue([tour])

    render(<DeliveryDashboard />)
    expect(
      await screen.findByRole('button', { name: 'Erneut laden' })
    ).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Fahrer 1' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))

    expect(
      await screen.findByRole('heading', { name: 'Samstagstour' })
    ).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Fahrer 1' })).toBeTruthy()
    expect((screen.getByLabelText('Fahrer') as HTMLSelectElement).value).toBe(
      '1'
    )
    // Der Fahrerwechsel loest das Laden aus - nicht noch einmal der Knopf.
    expect(api.tours).toHaveBeenCalledTimes(2)
    expect(api.tours).toHaveBeenLastCalledWith(
      expect.objectContaining({ driverId: 1 })
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('zeigt "Tour anlegen" nur, wenn die API wirklich keine Tour kennt', async () => {
    api.tours.mockResolvedValue([])

    render(<DeliveryDashboard />)

    expect(
      await screen.findByRole('button', { name: 'Tour anlegen' })
    ).toBeTruthy()
    expect(screen.getByText(/noch nichts geplant/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Erneut laden' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lässt "Tour anlegen" stehen, wenn nur das Anlegen scheitert', async () => {
    // `error` teilen sich alle Aktionen - ein abgelehntes Anlegen darf nicht
    // wie ein gescheitertes Laden aussehen und den Knopf verstecken.
    api.tours.mockResolvedValue([])
    api.createTour.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tour anlegen' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(
        /Keine Verbindung zur Bäckerei-API/
      )
    )
    expect(screen.getByRole('button', { name: 'Tour anlegen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Erneut laden' })).toBeNull()
    expect(api.tours).toHaveBeenCalledTimes(1)
  })
})

/**
 * Offline-Kopie: jeder Tipp auf „Navigation" reicht das Handy an die Navi-App
 * weiter, und beim Zurueckkommen laedt der Browser die Seite gern neu - im
 * Funkloch. Dann muss die zuletzt geladene Tour aus dem localStorage kommen.
 */
describe('DeliveryDashboard mit Offline-Kopie', () => {
  const date = nextSaturdayIso()

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    // So sieht der Speicher nach dem letzten Besuch mit Netz aus.
    rememberDrivers([driver])
    window.localStorage.setItem('bakery-delivery-driver', '1')
  })

  it('zeigt im Funkloch die gemerkte Tour mit Fahrer und Hinweis statt der Fehlermeldung', async () => {
    rememberTours(date, 1, [tour])
    api.drivers.mockRejectedValue(networkError())
    api.tours.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)

    expect(
      await screen.findByRole('heading', { name: 'Samstagstour' })
    ).toBeTruthy()
    expect((screen.getByLabelText('Fahrer') as HTMLSelectElement).value).toBe(
      '1'
    )
    const notice = await screen.findByText(
      /Gespeicherter Stand von \d{2}:\d{2} Uhr/
    )
    expect(notice.textContent).toMatch(/Kein Netz/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Erneut laden' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
    // Die Kopie gehoert zum gemerkten Fahrer - geholt wird mit ihm, nicht mit "Alle".
    expect(api.tours).toHaveBeenLastCalledWith(
      expect.objectContaining({ date, driverId: 1 })
    )
  })

  it('nennt bei einer Kopie von einem anderen Tag auch das Datum', async () => {
    // Freitagabend geladen, Samstagfrueh im Funkloch geoeffnet: "von 18:02 Uhr"
    // laese sich wie heute frueh.
    window.localStorage.setItem(
      'bakery-delivery-tours',
      JSON.stringify({
        date,
        driverId: 1,
        at: '2026-08-28T16:02:00.000Z',
        tours: [tour],
      })
    )
    api.drivers.mockRejectedValue(networkError())
    api.tours.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)

    expect(
      await screen.findByText(
        /Gespeicherter Stand vom 28\.08\.2026, \d{2}:\d{2} Uhr/
      )
    ).toBeTruthy()
  })

  it('bietet bei einer leeren Kopie ohne API kein "Tour anlegen" an', async () => {
    // "Zuletzt war nichts geplant" ist ohne Server nicht pruefbar - seit dem
    // letzten Blick kann die Backstube die Tour angelegt haben.
    rememberTours(date, 1, [])
    api.drivers.mockRejectedValue(networkError())
    api.tours.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)

    expect(
      await screen.findByRole('heading', {
        name: 'Tour konnte nicht geladen werden',
      })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
    expect(screen.queryByText(/Gespeicherter Stand/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeTruthy()
  })

  it('lässt ein Abhaken, das noch unterwegs ist, nicht vom Nachladen überschreiben', async () => {
    // Im Funkloch haengt der PATCH bis zu 15 s. Kommt in der Zeit das Netz
    // zurueck, darf das Nachladen der Kopie den Server-Stand ("Offen") nicht
    // ueber den angetippten Stopp legen - sonst sieht der Fahrer sein
    // Abhaken verschwinden und spaeter wiederkommen.
    const stop = {
      id: 1,
      customer: 'Kunde A',
      street: 'Talstraße 5',
      zip: '66424',
      city: 'Homburg',
      address: 'Talstraße 5, 66424 Homburg',
      phone: null,
      timeWindow: null,
      notes: null,
      items: [],
      status: 'open' as const,
      completedAt: null,
      failureReason: null,
      lat: 49.3226,
      lon: 7.3389,
      geocodeSource: null,
      geocodePrecision: null,
      estimatedArrival: null,
    }
    const withStop: Tour = {
      ...tour,
      stops: [stop],
      progress: { total: 1, done: 0, failed: 0, open: 1, isComplete: false },
      nextStopId: 1,
    }
    rememberTours(date, 1, [withStop])
    api.drivers.mockRejectedValue(networkError())
    let serverUp = false
    api.tours.mockImplementation(() =>
      serverUp ? Promise.resolve([withStop]) : Promise.reject(networkError())
    )
    // Der PATCH kommt nie zurueck - so lange haengt fetch im Funkloch.
    api.updateStop.mockImplementation(() => new Promise(() => undefined))

    render(<DeliveryDashboard />)
    await screen.findByText(/Gespeicherter Stand von/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Geliefert' })[0])
    expect(await screen.findByText(/1 von 1 geliefert/)).toBeTruthy()

    serverUp = true
    const loadsBefore = api.tours.mock.calls.length
    // Nichts nachgeladen, solange der PATCH unterwegs ist.
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(screen.getByText(/1 von 1 geliefert/)).toBeTruthy()
    expect(api.tours.mock.calls.length).toBe(loadsBefore)
    expect(screen.getByText(/Gespeicherter Stand von/)).toBeTruthy()
  })

  it('ersetzt die Kopie, sobald der Server wieder antwortet', async () => {
    rememberTours(date, 1, [tour])
    api.drivers.mockRejectedValue(networkError())
    const fresh: Tour = { ...tour, name: 'Samstagstour (Server)' }
    // Kein `mockRejectedValueOnce`: beim Start laufen zwei Ladevorgaenge (erst
    // "Alle", dann der gemerkte Fahrer), beide muessen scheitern.
    let serverUp = false
    api.tours.mockImplementation(() =>
      serverUp ? Promise.resolve([fresh]) : Promise.reject(networkError())
    )

    render(<DeliveryDashboard />)
    await screen.findByText(/Gespeicherter Stand von/)

    // Funk ist wieder da: der Browser meldet `online`.
    serverUp = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(
      await screen.findByRole('heading', { name: 'Samstagstour (Server)' })
    ).toBeTruthy()
    await waitFor(() =>
      expect(screen.queryByText(/Gespeicherter Stand/)).toBeNull()
    )
    expect(screen.queryByText(/Kein Netz/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

/**
 * Sammelstelle: der Fahrer steht im Übergabefenster am Kindergarten, die
 * Familien kommen nacheinander. Netz gibt es dort nicht verlässlich - eine
 * Übergabe muss trotzdem ankommen, und ein noch nicht abgehakter Kunde darf
 * nicht lautlos mit dem Stopp abgeschlossen werden.
 */
describe('DeliveryDashboard an der Sammelstelle', () => {
  const date = nextSaturdayIso()

  const preorder = (overrides: Partial<Preorder>): Preorder => ({
    id: 101,
    reference: 'MO-2026-09-12-01',
    pickupPointId: 'kindergarten-moersbach',
    date,
    customer: 'Vorbestellung 1',
    phone: null,
    items: [
      {
        productId: 'bauernbrot',
        name: 'Bauernbrot',
        qty: 2,
        unit: 'Stück',
        unitPrice: 3.05,
        lineTotal: 6.1,
      },
    ],
    total: 6.1,
    note: null,
    status: 'open',
    handedOverAt: null,
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
    deadline: null,
    afterDeadline: false,
    ...overrides,
  })

  const pickupStop: Stop = {
    id: 1,
    customer: 'Kindergarten Mörsbach',
    street: '',
    zip: '',
    city: 'Zweibrücken-Mörsbach',
    address: 'Zweibrücken-Mörsbach',
    phone: null,
    timeWindow: '09:00-09:30',
    notes: null,
    items: [],
    status: 'open',
    completedAt: null,
    failureReason: null,
    lat: null,
    lon: null,
    geocodeSource: null,
    geocodePrecision: null,
    estimatedArrival: null,
    pickupPointId: 'kindergarten-moersbach',
    preorders: [
      preorder({ id: 101, reference: 'MO-2026-09-12-01', total: 6.1 }),
      preorder({
        id: 102,
        reference: 'MO-2026-09-12-02',
        customer: 'Vorbestellung 2',
        total: 6.2,
      }),
    ],
  }

  const pickupTour: Tour = {
    ...tour,
    date,
    stops: [pickupStop],
    progress: { total: 1, done: 0, failed: 0, open: 1, isComplete: false },
    nextStopId: 1,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    api.drivers.mockResolvedValue([])
    api.tours.mockResolvedValue([pickupTour])
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  it('zeigt die Übergabeliste mit Kopfzeile statt „Geliefert / Nicht angetroffen"', async () => {
    render(<DeliveryDashboard />)

    // Der Stopp steht zweimal auf der Seite („Nächster Stopp" und die Liste).
    expect(
      (await screen.findAllByText(/0 von 2 übergeben/)).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Bar zu kassieren: 12,30/).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('MO-2026-09-12-01').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Geliefert' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Nicht angetroffen' })
    ).toBeNull()
    expect(
      screen.getAllByRole('button', { name: 'Stopp abschließen' }).length
    ).toBeGreaterThan(0)
  })

  it('nennt die fehlende Adresse der Sammelstelle, statt „Adresse nicht gefunden" zu behaupten', async () => {
    render(<DeliveryDashboard />)

    expect(
      (await screen.findAllByText(/noch keine Adresse hinterlegt/)).length
    ).toBeGreaterThan(0)
    // Der Text für gewöhnliche Stopps verspricht der Navigation die eingegebene
    // Adresse - es wurde aber nie eine eingegeben.
    expect(screen.queryByText(/Adresse nicht gefunden/)).toBeNull()
  })

  it('fragt nach, bevor der Stopp mit offenen Vorbestellungen abgeschlossen wird', async () => {
    render(<DeliveryDashboard />)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Stopp abschließen' }))[0]
    )

    // Kein window.confirm: das blockiert und sieht auf dem Handy aus wie ein
    // Absturz. Die Rückfrage steht in der Oberfläche.
    expect(
      screen.getByText(
        '2 Vorbestellungen sind noch offen. Trotzdem abschließen?'
      )
    ).toBeTruthy()
    expect(api.updateStop).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByText(/Trotzdem abschließen\?/)).toBeNull()
    expect(api.updateStop).not.toHaveBeenCalled()

    api.updateStop.mockResolvedValue(pickupTour)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Stopp abschließen' })[0]
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Trotzdem abschließen' })
    )
    await waitFor(() =>
      expect(api.updateStop).toHaveBeenCalledWith(7, 1, { status: 'done' })
    )
  })

  it('legt die Warteschlange über die Offline-Kopie der Tour', async () => {
    // Sonst stünde ein eben übergebener Kunde nach dem Neuladen im Funkloch
    // wieder auf „Offen" - und bekäme seine Tüte womöglich ein zweites Mal.
    rememberTours(date, null, [pickupTour])
    queuePreorderUpdate(101, { status: 'handed_over' })
    api.tours.mockRejectedValue(networkError())
    ;(global as { fetch?: unknown }).fetch = jest
      .fn()
      .mockRejectedValue(networkError())

    render(<DeliveryDashboard />)

    expect(
      (await screen.findAllByText(/1 von 2 übergeben/)).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Bar zu kassieren: 6,20/).length
    ).toBeGreaterThan(0)
  })

  it('legt eine Übergabe im Funkloch in die Warteschlange und sendet sie beim nächsten Lauf', async () => {
    api.updatePreorder.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Übergeben' }))[0]
    )

    // Sofort umgeschaltet - der Fahrer wartet nicht auf das Netz.
    await waitFor(() =>
      expect(screen.getAllByText(/1 von 2 übergeben/).length).toBeGreaterThan(0)
    )
    expect(screen.getByText(/Kein Netz/)).toBeTruthy()
    expect(pendingUpdates()).toEqual([
      expect.objectContaining({
        kind: 'preorder',
        preorderId: 101,
        body: { status: 'handed_over' },
      }),
    ])

    // Funk ist wieder da: die Warteschlange geht ueber den echten Client raus.
    const handedOver = {
      ...pickupStop.preorders?.[0],
      status: 'handed_over',
      handedOverAt: '2026-09-12T07:15:00.000Z',
    }
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(handedOver),
    })
    ;(global as { fetch?: unknown }).fetch = fetchMock

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/api\/deliveries\/preorders\/101$/
    )
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
    expect(pendingUpdates()).toEqual([])
    expect(screen.queryByText(/Kein Netz/)).toBeNull()
    expect(screen.getAllByText(/1 von 2 übergeben/).length).toBeGreaterThan(0)
  })
})
