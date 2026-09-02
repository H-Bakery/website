import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeliveryDashboard from './page'
import {
  deliveryApi,
  rememberDrivers,
  rememberTours,
  type Driver,
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
