import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DeliveryDashboard from './page'
import { deliveryApi, type Driver, type Tour } from '../lib/delivery-api'

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
