import React from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import DeliveryDashboard from './page'
import {
  ApiError,
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
import { saveSession, type DeliveryRole } from '../lib/session'

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
    updateTour: jest.fn(),
    deleteTour: jest.fn(),
    updateStop: jest.fn(),
    updatePreorder: jest.fn(),
    reportPosition: jest.fn(),
  },
}))

// Leaflet braucht ein echtes Fenster; die Karte ist hier nicht Thema.
jest.mock('../components/Map', () => ({ Map: () => null }))

// Feste Uhr (nur `Date`, die Timer bleiben echt): die Seite rechnet mit
// „heute“ (Standardtag, Abhak-Fenster `markWindow`). Ohne sie hingen die Tests
// am Wochentag - sonntags bis donnerstags liegt der nächste Samstag mehr als
// einen Tag vorn, „Geliefert“ fehlt dann zu Recht. Steht vor `tour`, weil
// dessen Datum beim Laden des Moduls entsteht.
jest.useFakeTimers({
  now: new Date(2026, 8, 12, 12, 0, 0), // Samstag, 12.09.2026, 12:00 Ortszeit
  doNotFake: [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
  ],
})
afterAll(() => jest.useRealTimers())

const api = deliveryApi as jest.Mocked<typeof deliveryApi>

/** Die Seite steht hinter `AuthGate` (Layout); hier genügt eine Sitzung im Speicher. */
function signIn(role: DeliveryRole, id = 1) {
  saveSession({
    token: 'test-token',
    refreshToken: 'rt_test',
    user: { id, username: `test.${role}`, displayName: `Test ${role}`, role },
  })
}

const driver: Driver = {
  id: 1,
  name: 'Fahrer 1',
  phone: null,
  vehicle: 'car',
  active: true,
}

const tour: Tour = {
  id: 7,
  // Ein Tag, an dem abgehakt werden darf (`markWindow`): sonst hinge jeder
  // Test mit „Geliefert“ am Kalender.
  date: nextSaturdayIso(),
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
    signIn('inhaber')
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
    signIn('inhaber')
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
 * Abhaken im Funkloch: ein PATCH haengt bis zu 15 s. Frueher sperrte das
 * jeden Knopf der Seite - der Fahrer stand am naechsten Haus und konnte nichts
 * tun. Jetzt ist nur der Stopp gesperrt, dessen Aenderung unterwegs ist. Und
 * "Nicht angetroffen" haelt fest, warum und wo die Ware geblieben ist.
 */
describe('DeliveryDashboard beim Abhaken', () => {
  const date = nextSaturdayIso()

  const stop = (id: number, customer: string): Stop => ({
    id,
    customer,
    street: 'Talstraße 5',
    zip: '66424',
    city: 'Homburg',
    address: 'Talstraße 5, 66424 Homburg',
    phone: null,
    timeWindow: null,
    notes: null,
    items: [],
    status: 'open',
    completedAt: null,
    failureReason: null,
    goodsDisposition: null,
    lat: 49.3226,
    lon: 7.3389,
    geocodeSource: null,
    geocodePrecision: null,
    estimatedArrival: null,
  })

  const twoStops: Tour = {
    ...tour,
    date,
    stops: [stop(1, 'Kunde A'), stop(2, 'Kunde B')],
    progress: { total: 2, done: 0, failed: 0, open: 2, isComplete: false },
    nextStopId: 1,
  }

  /** Die Karte eines Stopps in der Liste „Alle Stopps". */
  const card = (customer: string) => {
    const heading = screen.getAllByRole('heading', { name: customer })
    // Das letzte Vorkommen liegt in der Liste; das erste kann der
    // "Naechster Stopp"-Block sein.
    return heading[heading.length - 1].closest('li') as HTMLElement
  }

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    signIn('inhaber')
    api.drivers.mockResolvedValue([])
    api.tours.mockResolvedValue([twoStops])
  })

  it('sperrt bei einem hängenden Statuswechsel nur den betroffenen Stopp', async () => {
    // Der PATCH kommt nie zurueck - so lange haengt fetch im Funkloch.
    api.updateStop.mockImplementation(() => new Promise(() => undefined))

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })

    fireEvent.click(
      within(card('Kunde A')).getByRole('button', { name: 'Geliefert' })
    )
    expect(await screen.findByText(/1 von 2 geliefert/)).toBeTruthy()

    // Der eigene Stopp wartet auf den Server ...
    expect(
      (
        within(card('Kunde A')).getByRole('button', {
          name: 'Zurücksetzen',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    // ... der naechste nicht.
    const next = within(card('Kunde B'))
    expect(
      (next.getByRole('button', { name: 'Geliefert' }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
    expect(
      (
        next.getByRole('button', {
          name: 'Nicht angetroffen',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)

    fireEvent.click(next.getByRole('button', { name: 'Geliefert' }))
    expect(await screen.findByText(/2 von 2 geliefert/)).toBeTruthy()
    expect(api.updateStop).toHaveBeenCalledTimes(2)
    // Ein Umbau der ganzen Tour wartet dagegen, bis nichts mehr unterwegs ist.
    expect(
      (
        screen.getByRole('button', {
          name: 'Route berechnen',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  /**
   * Die Sperre je Stopp erlaubt zwei PATCHes zugleich - und jede Antwort
   * ersetzt die ganze Tour. Antwortet B vor A (A ist noch nicht geokodiert,
   * der Server wartet bis zu 2,5 s auf Nominatim), steht A in Bs Antwort noch
   * „Offen". Ohne Ueberlagerung zeigte Karte A wieder „Geliefert" als Knopf,
   * und der Fahrer hakte doppelt ab oder hielt das Abhaken fuer verloren.
   */
  const serverTourWithBDone: Tour = {
    ...twoStops,
    stops: [
      stop(1, 'Kunde A'),
      {
        ...stop(2, 'Kunde B'),
        status: 'done',
        completedAt: '2026-09-12T07:20:00.000Z',
      },
    ],
    progress: { total: 2, done: 1, failed: 0, open: 1, isComplete: false },
    nextStopId: 1,
  }

  /** PATCH an Stopp A haengt (steuerbar), an Stopp B antwortet der Server. */
  const hangingA = () => {
    let rejectA: (err: unknown) => void = () => undefined
    api.updateStop.mockImplementation((_tourId, stopId) => {
      if (stopId === 1) {
        return new Promise<Tour>((_resolve, reject) => {
          rejectA = reject
        })
      }
      return Promise.resolve(serverTourWithBDone)
    })
    return { failA: (err: unknown) => rejectA(err) }
  }

  it('lässt die Antwort auf Stopp B ein noch laufendes Abhaken von Stopp A stehen', async () => {
    hangingA()

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })

    fireEvent.click(
      within(card('Kunde A')).getByRole('button', { name: 'Geliefert' })
    )
    expect(await screen.findByText(/1 von 2 geliefert/)).toBeTruthy()
    fireEvent.click(
      within(card('Kunde B')).getByRole('button', { name: 'Geliefert' })
    )
    await waitFor(() => expect(api.updateStop).toHaveBeenCalledTimes(2))

    // Bs Antwort ist da - A bleibt trotzdem geliefert, weil sein PATCH noch laeuft.
    expect(await screen.findByText(/2 von 2 geliefert/)).toBeTruthy()
    const a = within(card('Kunde A'))
    expect(
      (a.getByRole('button', { name: 'Zurücksetzen' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(a.queryByRole('button', { name: 'Geliefert' })).toBeNull()
    // B ist vom Server bestaetigt und wieder frei.
    expect(
      (
        within(card('Kunde B')).getByRole('button', {
          name: 'Zurücksetzen',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  })

  it('hält das Abhaken von A, wenn es nach Bs Antwort im Funkloch landet', async () => {
    const { failA } = hangingA()

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })

    fireEvent.click(
      within(card('Kunde A')).getByRole('button', { name: 'Geliefert' })
    )
    fireEvent.click(
      within(card('Kunde B')).getByRole('button', { name: 'Geliefert' })
    )
    expect(await screen.findByText(/2 von 2 geliefert/)).toBeTruthy()

    // Jetzt bricht A nach dem Timeout ab: die Aenderung wandert in die
    // Warteschlange, die Karte zeigt weiter „geliefert" - nicht „Offen" mit
    // aktivem Knopf, als waere nie abgehakt worden.
    await act(async () => {
      failA(networkError())
    })
    expect(await screen.findByText(/Kein Netz/)).toBeTruthy()
    expect(screen.getByText(/2 von 2 geliefert/)).toBeTruthy()
    const a = within(card('Kunde A'))
    expect(
      (a.getByRole('button', { name: 'Zurücksetzen' }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
    expect(a.queryByRole('button', { name: 'Geliefert' })).toBeNull()
    expect(pendingUpdates()).toEqual([
      expect.objectContaining({
        kind: 'stop',
        tourId: 7,
        stopId: 1,
        body: { status: 'done', completedAt: expect.any(String) },
      }),
    ])
  })

  it('zeigt erledigte Stopps zugeklappt und nummeriert in Fahrtreihenfolge', async () => {
    // Regression (UI-Runde 1): nach „Route berechnen" liess der Server
    // erledigte Stopps auf ihrem Platz - die Liste stand „1 offen, 2 offen,
    // 3 geliefert, 4 nicht angetroffen, 5 offen", der Fahrer scrollte an
    // erledigten Karten vorbei, und die Nummer hiess nicht „so wird gefahren".
    const finished = (
      id: number,
      customer: string,
      status: 'done' | 'failed',
      at: string
    ): Stop => ({ ...stop(id, customer), status, completedAt: at })
    api.tours.mockResolvedValue([
      {
        ...twoStops,
        stops: [
          stop(1, 'Kunde Fink'),
          stop(2, 'Kunde Drossel'),
          finished(3, 'Kunde Amsel', 'done', '2026-09-12T07:10:00.000Z'),
          finished(4, 'Kunde Buchfink', 'failed', '2026-09-12T07:20:00.000Z'),
          stop(5, 'Kunde Mörsbach'),
        ],
        progress: { total: 5, done: 1, failed: 1, open: 3, isComplete: false },
        nextStopId: 1,
      },
    ])

    render(<DeliveryDashboard />)
    const next = await screen.findByRole('region', { name: 'Nächster Stopp' })
    const numbers = (region: HTMLElement) =>
      Array.from(region.querySelectorAll('li')).map(
        (li) =>
          `${li.querySelector('span')?.textContent} ${
            li.querySelector('h3')?.textContent
          }`
      )

    expect(numbers(next)).toEqual(['3 Kunde Fink'])
    expect(
      numbers(screen.getByRole('region', { name: 'Weitere Stopps' }))
    ).toEqual(['4 Kunde Drossel', '5 Kunde Mörsbach'])
    const done = screen.getByRole('region', { name: 'Erledigte Stopps' })
    expect(numbers(done)).toEqual(['1 Kunde Amsel', '2 Kunde Buchfink'])
    // Zugeklappt: nachsehen und zurücksetzen geht, im Weg sind sie nicht.
    expect(done.querySelector('details')?.open).toBe(false)
    expect(
      within(done).getByText('Erledigt (2, davon 1 nicht angetroffen)')
    ).toBeTruthy()
    // Der nächste Stopp kommt kein zweites Mal.
    expect(screen.getAllByRole('heading', { name: 'Kunde Fink' })).toHaveLength(
      1
    )
  })

  it('schickt Grund und Verbleib der Ware mit „Nicht angetroffen" und zeigt sie an', async () => {
    api.updateStop.mockImplementation(async (_tourId, stopId, body) => ({
      ...twoStops,
      stops: twoStops.stops.map((s) =>
        s.id === stopId
          ? {
              ...s,
              status: 'failed' as const,
              completedAt: new Date().toISOString(),
              failureReason: body.failureReason ?? null,
              goodsDisposition: body.goodsDisposition ?? null,
            }
          : s
      ),
      progress: { total: 2, done: 0, failed: 1, open: 1, isComplete: false },
      nextStopId: 2,
    }))

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })

    const a = within(card('Kunde A'))
    fireEvent.click(a.getByRole('button', { name: 'Nicht angetroffen' }))
    // Noch nichts gesendet: erst kommt die Rueckfrage.
    expect(api.updateStop).not.toHaveBeenCalled()
    fireEvent.click(a.getByRole('radio', { name: 'Adresse nicht gefunden' }))
    fireEvent.click(a.getByRole('radio', { name: 'Ware abgestellt' }))
    fireEvent.click(
      a.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )

    await waitFor(() =>
      expect(api.updateStop).toHaveBeenCalledWith(7, 1, {
        status: 'failed',
        failureReason: 'Adresse nicht gefunden',
        goodsDisposition: 'left_at_address',
        completedAt: expect.any(String),
      })
    )
    // Die Karte wandert nach „Erledigt" - also frisch suchen.
    expect(
      await within(card('Kunde A')).findByText(
        'Grund: Adresse nicht gefunden · Ware abgestellt'
      )
    ).toBeTruthy()
    expect(
      screen.getByText(/0 von 2 geliefert, 1 nicht angetroffen/)
    ).toBeTruthy()
  })

  it('legt Grund und Verbleib im Funkloch mit in die Warteschlange', async () => {
    api.updateStop.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })

    const a = within(card('Kunde A'))
    fireEvent.click(a.getByRole('button', { name: 'Nicht angetroffen' }))
    fireEvent.click(a.getByRole('radio', { name: 'Annahme verweigert' }))
    fireEvent.click(
      a.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )

    await screen.findByText(/Kein Netz/)
    expect(pendingUpdates()).toEqual([
      expect.objectContaining({
        kind: 'stop',
        tourId: 7,
        stopId: 1,
        body: {
          status: 'failed',
          failureReason: 'Annahme verweigert',
          goodsDisposition: 'taken_back',
          completedAt: expect.any(String),
        },
      }),
    ])
    // Die lokale Vorschau zeigt den Grund schon, bevor der Server ihn kennt.
    expect(
      within(card('Kunde A')).getByText(
        'Grund: Annahme verweigert · Ware mitgenommen'
      )
    ).toBeTruthy()
  })

  it('räumt den Grund weg, wenn der Stopp doch geliefert wird', async () => {
    api.tours.mockResolvedValue([
      {
        ...twoStops,
        stops: [
          {
            ...stop(1, 'Kunde A'),
            status: 'failed',
            failureReason: 'Nicht angetroffen',
            goodsDisposition: 'taken_back',
          },
          stop(2, 'Kunde B'),
        ],
        progress: { total: 2, done: 0, failed: 1, open: 1, isComplete: false },
        nextStopId: 2,
      },
    ])
    api.updateStop.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })
    const a = within(card('Kunde A'))
    expect(a.getByText(/Grund: Nicht angetroffen/)).toBeTruthy()

    fireEvent.click(a.getByRole('button', { name: 'Zurücksetzen' }))
    await screen.findByText(/Kein Netz/)
    expect(within(card('Kunde A')).queryByText(/Grund:/)).toBeNull()
    expect(pendingUpdates()[0]).toEqual(
      expect.objectContaining({
        body: { status: 'open' },
      })
    )
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
    signIn('inhaber')
    api.drivers.mockResolvedValue([])
    api.tours.mockResolvedValue([pickupTour])
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  it('zeigt die Übergabeliste mit Kopfzeile statt „Geliefert / Nicht angetroffen"', async () => {
    render(<DeliveryDashboard />)

    // Der Stopp steht einmal auf der Seite: als „Nächster Stopp", nicht
    // zusätzlich in der Liste darunter (UI-Runde 1: acht Familien doppelt).
    expect((await screen.findAllByText(/0 von 2 übergeben/)).length).toBe(1)
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

  it('lässt den Grund stehen, wenn der Server eine Übergabe ablehnt', async () => {
    // Regression (next-Integration): `loadTours` leerte die Meldung, die
    // Ablehnung (etwa 403) verschwand also im selben Moment.
    const { ApiError } = jest.requireActual('../lib/delivery-api')
    api.updatePreorder.mockRejectedValue(
      new ApiError('Diese Übergabe ist nicht erlaubt.', 403)
    )

    render(<DeliveryDashboard />)

    const buttons = await screen.findAllByRole('button', { name: 'Übergeben' })
    fireEvent.click(buttons[0])
    // Unbezahlt: erst die Frage nach dem Geld.
    fireEvent.click(
      screen.getByRole('button', { name: 'Bezahlt und übergeben' })
    )

    expect(
      await screen.findByText('Diese Übergabe ist nicht erlaubt.')
    ).toBeTruthy()
    await waitFor(() => expect(api.tours).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Diese Übergabe ist nicht erlaubt.')).toBeTruthy()
  })

  it('zeigt dem Fahrer an einer übergebenen Bestellung kein „Zurücksetzen"', async () => {
    signIn('fahrer', 42)
    const own: Driver = { ...driver, userId: 42 }
    api.drivers.mockResolvedValue([own])
    api.tours.mockResolvedValue([
      {
        ...pickupTour,
        driver: own,
        stops: [
          {
            ...pickupStop,
            preorders: [preorder({ id: 101, status: 'handed_over' })],
          },
        ],
      },
    ])

    render(<DeliveryDashboard />)

    expect(
      (await screen.findAllByText('Zurücknehmen kann der Verkauf.')).length
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).toBeNull()
  })

  it('nennt einen erledigten Sammelstellen-Stopp „Abgeschlossen", nicht „Geliefert"', async () => {
    // An der Sammelstelle wird nichts zugestellt, sondern ausgegeben.
    api.tours.mockResolvedValue([
      {
        ...pickupTour,
        stops: [
          {
            ...pickupStop,
            status: 'done',
            preorders: [preorder({ id: 101, status: 'handed_over' })],
          },
        ],
        progress: { total: 1, done: 1, failed: 0, open: 0, isComplete: true },
        nextStopId: null,
      },
    ])

    render(<DeliveryDashboard />)

    expect(
      (await screen.findAllByText('Abgeschlossen')).length
    ).toBeGreaterThan(0)
    expect(screen.queryByText('Geliefert')).toBeNull()
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
      expect(api.updateStop).toHaveBeenCalledWith(7, 1, {
        status: 'done',
        completedAt: expect.any(String),
      })
    )
  })

  it('setzt eine Übergabe, die noch unterwegs ist, nicht durch die Antwort auf den Stopp zurück', async () => {
    // Die Vorbestellungen haengen an der Tour. Haengt der PATCH an der
    // Uebergabe und antwortet der Stopp-PATCH zuerst, kennt dessen Tour die
    // Uebergabe noch nicht - sie darf trotzdem nicht wieder „Offen" werden.
    api.updatePreorder.mockImplementation(() => new Promise(() => undefined))
    api.updateStop.mockResolvedValue({
      ...pickupTour,
      stops: [
        {
          ...pickupStop,
          status: 'done',
          completedAt: '2026-09-12T09:30:00.000Z',
        },
      ],
      progress: { total: 1, done: 1, failed: 0, open: 0, isComplete: true },
      nextStopId: null,
    })

    render(<DeliveryDashboard />)
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Übergeben' }))[0]
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Bezahlt und übergeben' })
    )
    await waitFor(() =>
      expect(screen.getAllByText(/1 von 2 übergeben/).length).toBeGreaterThan(0)
    )

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Stopp abschließen' })[0]
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Trotzdem abschließen' })
    )
    await waitFor(() =>
      expect(api.updateStop).toHaveBeenCalledWith(7, 1, {
        status: 'done',
        completedAt: expect.any(String),
      })
    )

    expect(await screen.findByText('Abgeschlossen')).toBeTruthy()
    expect(screen.getAllByText(/1 von 2 übergeben/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/0 von 2 übergeben/)).toBeNull()
  })

  it('fragt beim Übergeben einer unbezahlten nach dem Geld und bucht „ohne Zahlung" nicht als bezahlt', async () => {
    // Regression (UI-Runde 1): ein Tipp auf „Übergeben" schickte nur
    // `{ status }`, und der Server buchte die unbezahlte Bestellung als
    // bezahlt - Bargeld, das nie geflossen ist.
    api.updatePreorder.mockImplementation(async (id, body) => ({
      ...preorder({ id, reference: 'MO-2026-09-12-01', total: 6.1 }),
      status: body.status,
      handedOverAt: '2026-09-12T07:15:00.000Z',
      paid: false,
      paidAmount: null,
      paymentBalance: 0,
    }))

    render(<DeliveryDashboard />)
    const next = within(
      await screen.findByRole('region', { name: 'Nächster Stopp' })
    )
    fireEvent.click(next.getAllByRole('button', { name: 'Übergeben' })[0])

    // Kein PATCH ohne Antwort auf die Geldfrage; der Betrag steht da.
    expect(api.updatePreorder).not.toHaveBeenCalled()
    expect(next.getByText(/Noch nicht bezahlt: 6,10/)).toBeTruthy()
    fireEvent.click(
      next.getByRole('button', { name: 'Ohne Zahlung übergeben' })
    )

    await waitFor(() =>
      expect(api.updatePreorder).toHaveBeenCalledWith(101, {
        status: 'handed_over',
        paid: false,
      })
    )
    expect((await next.findByTestId('payment-101')).textContent).toMatch(
      /^Nicht bezahlt – 6,10\s€ offen$/
    )
    // Die Kopfzeile verliert das Geld nicht: es steht für sich.
    expect(
      next.getByText(
        /1 von 2 übergeben · Bar zu kassieren: 6,20\s€ · Ohne Zahlung übergeben: 6,10\s€/
      )
    ).toBeTruthy()
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Bezahlt und übergeben' })
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
        body: { status: 'handed_over', paid: true },
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
    // B8: auch die Warteschlange geht mit Bearer raus.
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer test-token',
    })
  })
})

/**
 * B8: was die Oberfläche anbietet, hängt an der Rolle. Durchgesetzt wird in
 * der API; hier geht es darum, dass niemand Knöpfe sieht, die mit 403 enden.
 */
describe('DeliveryDashboard nach Rolle', () => {
  const date = nextSaturdayIso()
  const openStop: Stop = {
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
    status: 'open',
    completedAt: null,
    failureReason: null,
    goodsDisposition: null,
    lat: 49.3226,
    lon: 7.3389,
    geocodeSource: null,
    geocodePrecision: null,
    estimatedArrival: null,
  }
  const oneStop: Tour = {
    ...tour,
    date,
    stops: [openStop],
    progress: { total: 1, done: 0, failed: 0, open: 1, isComplete: false },
    nextStopId: 1,
  }
  const own: Driver = { ...driver, id: 2, name: 'Fahrer 2', userId: 42 }
  const other: Driver = { ...driver, id: 1, name: 'Fahrer 1', userId: 7 }

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
  })

  it('Verkauf liest nur: kein Planen, Abhaken, Routen oder Standort', async () => {
    signIn('verkauf')
    api.drivers.mockResolvedValue([])
    api.tours.mockResolvedValue([oneStop])

    render(<DeliveryDashboard />)

    expect(
      await screen.findByRole('heading', { name: 'Samstagstour' })
    ).toBeTruthy()
    // Einmal: der nächste Stopp steht nicht noch einmal in der Liste.
    expect(screen.getAllByRole('heading', { name: 'Kunde A' }).length).toBe(1)
    expect(screen.queryByRole('button', { name: 'Tour planen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Route berechnen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Geliefert' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Standort verfolgen' })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeTruthy()
    expect(screen.getByText(/· Verkauf/)).toBeTruthy()
  })

  it('Verkauf bekommt an einem leeren Tag kein "Tour anlegen"', async () => {
    signIn('verkauf')
    api.drivers.mockResolvedValue([])
    api.tours.mockResolvedValue([])

    render(<DeliveryDashboard />)

    expect(
      await screen.findByText('Für diesen Tag ist noch nichts geplant.')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
  })

  it('ein Fahrer ist auf den eigenen Fahrer festgelegt und kann abhaken', async () => {
    signIn('fahrer', 42)
    // Ein gemerkter fremder Fahrer zählt nicht.
    window.localStorage.setItem('bakery-delivery-driver', '1')
    api.drivers.mockResolvedValue([other, own])
    api.tours.mockResolvedValue([{ ...oneStop, driverId: 2, driver: own }])

    render(<DeliveryDashboard />)

    await waitFor(() =>
      expect(api.tours).toHaveBeenLastCalledWith(
        expect.objectContaining({ date, driverId: 2 })
      )
    )
    const select = screen.getByLabelText('Fahrer') as HTMLSelectElement
    expect(select.value).toBe('2')
    expect(select.disabled).toBe(true)
    expect(
      (await screen.findAllByRole('button', { name: 'Geliefert' })).length
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Route berechnen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tour planen' })).toBeNull()
  })

  it('ein Fahrer ohne zugeordneten Fahrer bekommt einen Hinweis statt fremder Touren', async () => {
    signIn('fahrer', 99)
    api.drivers.mockResolvedValue([other, own])
    api.tours.mockResolvedValue([])

    render(<DeliveryDashboard />)

    expect(
      await screen.findByText(/Ihrem Konto ist noch kein Fahrer zugeordnet/)
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tour anlegen' })).toBeNull()
  })
})

describe('DeliveryDashboard: Tour planen (Abschluss-Verifikation next)', () => {
  const date = nextSaturdayIso()
  const second: Driver = { ...driver, id: 2, name: 'Fahrer 2' }
  const planStop = (id: number, customer: string): Stop => ({
    id,
    customer,
    street: 'Talstraße 5',
    zip: '66424',
    city: 'Homburg',
    address: 'Talstraße 5, 66424 Homburg',
    phone: null,
    timeWindow: null,
    notes: null,
    items: [],
    status: 'open',
    completedAt: null,
    failureReason: null,
    goodsDisposition: null,
    lat: 49.3226,
    lon: 7.3389,
    geocodeSource: null,
    geocodePrecision: null,
    estimatedArrival: null,
  })
  // Unter „Alle" angelegt: ohne Fahrer.
  const unassigned: Tour = {
    ...tour,
    date,
    driverId: null,
    driver: null,
    stops: [planStop(1, 'Kunde A'), planStop(2, 'Kunde B')],
    progress: { total: 2, done: 0, failed: 0, open: 2, isComplete: false },
    nextStopId: 1,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    signIn('inhaber')
    api.drivers.mockResolvedValue([driver, second])
    api.tours.mockResolvedValue([unassigned])
  })

  async function openPlanning() {
    render(<DeliveryDashboard />)
    // Erst nach dem Fahrerwechsel (Fahrerliste geladen → erster Fahrer): der
    // leert die Liste kurz (`shownKeyRef`), ein früherer Klick ging auf
    // langsamen Rechnern (CI mit Coverage) ins Leere.
    await waitFor(() =>
      expect(api.tours).toHaveBeenCalledWith(
        expect.objectContaining({ driverId: 1 })
      )
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Tour planen' }))
  }

  it('ordnet einer Tour ohne Fahrer nachträglich einen zu', async () => {
    api.updateTour.mockResolvedValue({
      ...unassigned,
      driverId: 2,
      driver: second,
    })
    await openPlanning()
    fireEvent.change(screen.getByLabelText('Fahrer dieser Tour'), {
      target: { value: '2' },
    })
    await waitFor(() =>
      expect(api.updateTour).toHaveBeenCalledWith(7, { driverId: 2 })
    )
    expect(await screen.findByText(new RegExp(`· Fahrer 2`))).toBeTruthy()
  })

  it('sortiert Stopps von Hand', async () => {
    api.updateTour.mockResolvedValue({
      ...unassigned,
      stops: [unassigned.stops[1], unassigned.stops[0]],
    })
    await openPlanning()
    const down = screen.getAllByRole('button', { name: 'Nach unten' })
    expect(
      (
        screen.getAllByRole('button', {
          name: 'Nach oben',
        })[0] as HTMLButtonElement
      ).disabled
    ).toBe(true)
    fireEvent.click(down[down.length - 2])
    await waitFor(() =>
      expect(api.updateTour).toHaveBeenCalledWith(7, { stopOrder: [2, 1] })
    )
  })

  it('löscht eine Tour erst nach Rückfrage', async () => {
    api.deleteTour.mockResolvedValue({ success: true })
    await openPlanning()
    fireEvent.click(screen.getByRole('button', { name: 'Tour löschen' }))
    expect(api.deleteTour).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ja, Tour löschen' }))
    await waitFor(() => expect(api.deleteTour).toHaveBeenCalledWith(7))
    expect(
      await screen.findByRole('heading', { name: /Keine Tour für/ })
    ).toBeTruthy()
  })
})

describe('DeliveryDashboard: Tageswechsel und Meldungen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    signIn('inhaber')
    api.drivers.mockResolvedValue([])
  })

  it('zeigt nach einem Tageswechsel nicht die Tour des alten Tages, solange der neue lädt', async () => {
    // Regression: ohne Offline-Kopie des neuen Tages blieb die alte Tour samt
    // Abhak-Knöpfen stehen, bis die Antwort kam - im Funkloch bis zu 15 s,
    // während im Datumsfeld schon der neue Tag stand.
    api.tours
      .mockResolvedValueOnce([tour])
      .mockImplementation(() => new Promise(() => undefined))

    render(<DeliveryDashboard />)
    expect(
      await screen.findByRole('heading', { name: 'Samstagstour' })
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Tag'), {
      target: { value: '2026-09-06' },
    })

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Samstagstour' })).toBeNull()
    )
    expect(screen.getByText('Tour wird geladen …')).toBeTruthy()
  })

  it('ignoriert ein geleertes Datumsfeld statt „Ob für  eine Tour …" zu zeigen', async () => {
    // Regression: iOS „Zurücksetzen" liefert `''`, die API antwortet auf
    // `date=` mit 400, und die Seite sagte „Ob für  eine Tour geplant ist".
    api.tours.mockResolvedValue([tour])

    render(<DeliveryDashboard />)
    await screen.findByRole('heading', { name: 'Samstagstour' })
    const calls = api.tours.mock.calls.length

    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: '' } })

    expect((screen.getByLabelText('Tag') as HTMLInputElement).value).toBe(
      nextSaturdayIso()
    )
    expect(api.tours).toHaveBeenCalledTimes(calls)
    expect(screen.getByRole('heading', { name: 'Samstagstour' })).toBeTruthy()
  })

  it('lässt eine Fehlermeldung schließen', async () => {
    api.tours.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    const alert = await screen.findByRole('alert')
    fireEvent.click(within(alert).getByRole('button', { name: 'Schließen' }))

    expect(screen.queryByRole('alert')).toBeNull()
    // Der Zustand der Seite bleibt: nur die Meldung ist weg.
    expect(screen.getByRole('button', { name: 'Erneut laden' })).toBeTruthy()
  })
})

/**
 * UI-Runde 2 (Fahrer-App): abgelehnte Nachsendungen, Serverfehler, Planung
 * und Abhaken nur am Tourtag.
 */
describe('DeliveryDashboard - UI-Runde 2', () => {
  const date = nextSaturdayIso()
  const paidPreorder: Preorder = {
    id: 201,
    reference: 'MO-2026-09-12-07',
    pickupPointId: 'kindergarten-moersbach',
    date,
    customer: 'Testkundin Faulbaum',
    phone: null,
    items: [],
    total: 16.4,
    note: null,
    status: 'open',
    handedOverAt: null,
    createdAt: '2026-09-10T08:00:00.000Z',
    updatedAt: '2026-09-10T08:00:00.000Z',
    deadline: null,
    afterDeadline: false,
    paid: true,
    paidAmount: 16.4,
    paymentBalance: 0,
  }
  const pickupStop: Stop = {
    id: 1,
    customer: 'Kindergarten Mörsbach',
    street: 'Höhenstraße 24',
    zip: '66482',
    city: 'Zweibrücken',
    address: 'Höhenstraße 24, 66482 Zweibrücken',
    phone: null,
    timeWindow: '09:00-09:30',
    notes: null,
    items: [],
    status: 'open',
    completedAt: null,
    failureReason: null,
    lat: 49.25,
    lon: 7.36,
    geocodeSource: null,
    geocodePrecision: 'house',
    estimatedArrival: null,
    pickupPointId: 'kindergarten-moersbach',
    preorders: [paidPreorder],
  }
  const homeStop: Stop = {
    ...pickupStop,
    id: 2,
    customer: 'Testkundin Amsel',
    pickupPointId: null,
    preorders: undefined,
    timeWindow: '07:30-08:00',
  }
  const twoStops: Tour = {
    ...tour,
    date,
    stops: [pickupStop, homeStop],
    progress: { total: 2, done: 0, failed: 0, open: 2, isComplete: false },
    nextStopId: 1,
  }
  const respond = (status: number, body: unknown) =>
    jest.fn().mockResolvedValue({
      ok: status < 400,
      status,
      text: async () => JSON.stringify(body),
    })

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    api.drivers.mockResolvedValue([])
  })

  afterEach(() => {
    delete (global as { fetch?: unknown }).fetch
  })

  it('nimmt eine beim Nachsenden abgelehnte Übergabe zurück und nennt Kundin und Grund', async () => {
    // Regression: ohne Netz übergeben, das Büro storniert inzwischen, der
    // Server lehnt das Nachsenden mit 409 ab. Die Karte zeigte danach weiter
    // „Abgeholt · Bezahlt“, die einzige Meldung war „1 Änderung(en) …
    // verworfen“ - ohne Namen, ohne Grund.
    signIn('fahrer', 42)
    api.drivers.mockResolvedValue([{ ...driver, userId: 42 }])
    api.tours.mockResolvedValue([twoStops])
    api.updatePreorder.mockRejectedValue(networkError())

    render(<DeliveryDashboard />)
    // Erst wenn der eigene Fahrer gewählt ist (zweiter Ladevorgang).
    await waitFor(() =>
      expect(api.tours).toHaveBeenLastCalledWith(
        expect.objectContaining({ driverId: 1 })
      )
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Übergeben' }))
    await waitFor(() =>
      expect(screen.getAllByText(/1 von 1 übergeben/).length).toBeGreaterThan(0)
    )
    expect(pendingUpdates()).toHaveLength(1)

    // Der Server kennt die Bestellung inzwischen als storniert.
    const cancelled = {
      ...paidPreorder,
      status: 'cancelled' as const,
      paymentBalance: -16.4,
    }
    api.tours.mockResolvedValue([
      {
        ...twoStops,
        stops: [{ ...pickupStop, preorders: [cancelled] }, homeStop],
      },
    ])
    ;(global as { fetch?: unknown }).fetch = respond(409, {
      error: 'cancelled',
      message: 'Die Bestellung wurde storniert.',
    })
    const loadsBefore = api.tours.mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(pendingUpdates()).toEqual([])
    // Neu geladen: der Stand des Servers steht da, nicht die Vorschau.
    expect(api.tours.mock.calls.length).toBeGreaterThan(loadsBefore)
    await waitFor(() =>
      expect(screen.getByTestId('payment-201').textContent).toMatch(
        /^Erstattung 16,40\s€ offen$/
      )
    )
    expect(screen.queryByText(/1 von 1 übergeben/)).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain(
      'Übergabe an Testkundin Faulbaum nicht gespeichert: Die Bestellung wurde storniert.'
    )
  })

  it('meldet einen Serverfehler (5xx) nicht als „Kein Netz“', async () => {
    // Regression: auf ein 500 hieß es „Kein Netz …“ - der Fahrer suchte den
    // Fehler am Handy. Gemerkt wird die Änderung trotzdem.
    signIn('inhaber')
    api.tours.mockResolvedValue([twoStops])
    api.updateStop.mockRejectedValue(new ApiError('Interner Fehler', 500))

    render(<DeliveryDashboard />)
    // Erst den Stopp der Sammelstelle ohne offene Bestellung abschließen …
    // einfacher: der Hausstopp in „Weitere Stopps“.
    const weitere = await screen.findByRole('region', {
      name: 'Weitere Stopps',
    })
    fireEvent.click(within(weitere).getByRole('button', { name: 'Geliefert' }))

    const notice = await screen.findByText(
      /Der Server hat einen Fehler gemeldet/
    )
    expect(notice.textContent).toContain('(1 offen)')
    expect(screen.queryByText(/Kein Netz/)).toBeNull()
    expect(pendingUpdates()).toHaveLength(1)
  })

  it('zeigt in der Planung jeden Stopp einmal und kompakt, ohne Fahrer-Bedienung', async () => {
    // Regression: „Nächster Stopp“ blieb mit voller Übergabeliste stehen,
    // darunter derselbe Stopp noch einmal - bis zu 7 Knöpfe je Stopp.
    signIn('inhaber')
    api.tours.mockResolvedValue([twoStops])

    render(<DeliveryDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tour planen' }))

    expect(screen.queryByRole('region', { name: 'Nächster Stopp' })).toBeNull()
    const list = screen.getByRole('region', { name: 'Alle Stopps' })
    expect(
      within(list).getAllByRole('heading', { name: 'Kindergarten Mörsbach' })
    ).toHaveLength(1)
    for (const name of [
      'Geliefert',
      'Nicht angetroffen',
      'Stopp abschließen',
      'Übergeben',
      'Navigation',
    ]) {
      expect(within(list).queryByRole('button', { name })).toBeNull()
      expect(within(list).queryByRole('link', { name })).toBeNull()
    }
    expect(
      within(list).getAllByRole('button', { name: 'Nach unten' })
    ).toHaveLength(2)
    expect(
      within(list).getByText(/1 Vorbestellung · 0 von 1 übergeben/)
    ).toBeTruthy()
  })

  it('lässt Name und geplante Abfahrt der Tour einstellen', async () => {
    // Regression: jede Tour hieß „Samstagstour“ und fuhr fest um 06:30 ab -
    // alle Ankunftszeiten hingen daran, ändern ließ es sich in der App nicht.
    signIn('inhaber')
    api.tours.mockResolvedValue([twoStops])
    api.updateTour.mockImplementation(async (_id, body) => ({
      ...twoStops,
      ...(body as Partial<Tour>),
    }))

    render(<DeliveryDashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tour planen' }))

    const start = screen.getByLabelText('Abfahrt geplant') as HTMLInputElement
    expect(start.value).toBe('06:30')
    fireEvent.change(start, { target: { value: '08:15' } })
    fireEvent.blur(start)
    await waitFor(() =>
      expect(api.updateTour).toHaveBeenCalledWith(7, { plannedStart: '08:15' })
    )
    expect(await screen.findByText('08:15')).toBeTruthy()

    const name = screen.getByLabelText('Name der Tour')
    fireEvent.change(name, { target: { value: 'Samstagstour Süd' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    await waitFor(() =>
      expect(api.updateTour).toHaveBeenCalledWith(7, {
        name: 'Samstagstour Süd',
      })
    )
  })

  it('benennt eine neue Tour nach dem Wochentag und nummeriert die zweite', async () => {
    signIn('inhaber')
    api.tours.mockResolvedValue([])
    api.createTour.mockResolvedValue({ ...twoStops, id: 9, stops: [] })

    render(<DeliveryDashboard />)
    fireEvent.change(await screen.findByLabelText('Tag'), {
      target: { value: '2026-11-13' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Tour anlegen' }))
    await waitFor(() =>
      expect(api.createTour).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-11-13', name: 'Freitagstour' })
      )
    )
  })

  it('bietet an einer Tour der nächsten Woche kein Abhaken an (API: 400)', async () => {
    // Regression: „Geliefert“ an einer künftigen Tour endete mit „Der
    // Zeitpunkt muss zum Tourtag passen.“
    signIn('inhaber')
    const later = new Date(`${date}T12:00:00`)
    later.setDate(later.getDate() + 7)
    const iso = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(later.getDate()).padStart(2, '0')}`
    api.tours.mockResolvedValue([{ ...twoStops, date: iso }])

    render(<DeliveryDashboard />)
    expect(await screen.findByTestId('mark-window')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Geliefert' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Stopp abschließen' })
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Nicht angetroffen' })
    ).toBeNull()
    // Die Übergabe einzelner Vorbestellungen prüft die API nicht am Tourtag.
    expect(screen.getByRole('button', { name: 'Übergeben' })).toBeTruthy()
    // Planen geht weiter.
    expect(screen.getByRole('button', { name: 'Tour planen' })).toBeTruthy()
  })
})
