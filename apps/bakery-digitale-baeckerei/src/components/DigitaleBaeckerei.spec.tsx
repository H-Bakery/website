import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Belegung, ProduktSnapshot } from '../lib/produkte/types'
import { LISTE_LEER_TEXT } from './AllesHierListe'
import DigitaleBaeckerei, {
  BEREIT_TEXT,
  DATEN_FEHLER_TEXT,
  FEHLER_TEXT,
  TITEL,
  UNTERBROCHEN_TEXT,
  blickpunktAnsage,
} from './DigitaleBaeckerei'
import { HINWEIS_TEXT } from './Hinweis'
import { LADE_TEXT } from './Ladebild'
import { OHNE_WEBGL_TEXT } from './OhneWebGL'
import { AEPFELTASCHE, PROBEWECK, TESTBROT, VERBOTEN } from './testdaten'
import ThemeRegistry from './ThemeRegistry'

// three.js (ESM, WebGL) nie in jsdom laden: die nachgeladene Komponente ist
// ein Platzhalter, dessen Knöpfe die Rückmeldungen der echten Szene auslösen.
const mounts: Record<string, unknown>[] = []
jest.mock('./Viewer3D', () => {
  function FakeViewer(props: {
    modelUrl: string
    modelBytes?: number
    fuellung: string
    label: string
    blickpunkt: { id: string }
    auswahl?: string | null
    onProgress: (f: number) => void
    onReady: (info: unknown) => void
    onUnavailable: () => void
    onError: (e: unknown) => void
    onLost: () => void
    onTreffer?: (t: unknown) => void
    onErsteGeste?: () => void
    onWechselGeste?: (r: -1 | 1) => void
  }) {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    useEffect(() => {
      mounts.push({
        modelUrl: props.modelUrl,
        modelBytes: props.modelBytes,
        fuellung: props.fuellung,
        blickpunkt: props.blickpunkt.id,
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const tipp = (slot: string, produkt?: string, ware?: string) => () =>
      props.onTreffer?.({
        slot,
        produkt,
        ware,
        moebel: slot.split('/')[0],
        punkt: [0, 0, 0],
      })
    return (
      <div
        data-testid="fake-viewer"
        role="img"
        aria-label={props.label}
        data-blickpunkt={props.blickpunkt.id}
        data-auswahl={props.auswahl ?? ''}
      >
        <button type="button" onClick={() => props.onProgress(0.5)}>
          halb geladen
        </button>
        <button
          type="button"
          onClick={() => {
            props.onProgress(1)
            props.onReady({ firstFrameMs: 1, triangles: 12, fill: null })
          }}
        >
          fertig
        </button>
        <button type="button" onClick={props.onUnavailable}>
          kein WebGL
        </button>
        <button type="button" onClick={() => props.onError(new Error('404'))}>
          Ladefehler
        </button>
        <button type="button" onClick={props.onLost}>
          Kontext verlieren
        </button>
        <button
          type="button"
          onClick={tipp('theke/vitrine/ebene-1/platz-01', 'testbrot-500g')}
        >
          tippe Testbrot
        </button>
        <button
          type="button"
          onClick={tipp('theke/vitrine/ebene-2/platz-02', 'probeweck')}
        >
          tippe Probeweck
        </button>
        <button
          type="button"
          onClick={tipp('theke/vitrine/ebene-3/platz-02', 'phantomgebaeck')}
        >
          tippe Unbekanntes
        </button>
        <button type="button" onClick={() => props.onTreffer?.(null)}>
          tippe daneben
        </button>
        <button type="button" onClick={() => props.onErsteGeste?.()}>
          erste Geste
        </button>
        <button type="button" onClick={() => props.onWechselGeste?.(1)}>
          weiter
        </button>
        <button type="button" onClick={() => props.onWechselGeste?.(-1)}>
          zurück
        </button>
      </div>
    )
  }
  return { __esModule: true, default: FakeViewer }
})

/** Erfundene Daten: Theke und Brotregal belegt, an den Regalen kein Produkt. */
const SNAPSHOT: ProduktSnapshot = {
  version: 1,
  erstellt: '2026-01-01T00:00:00.000Z',
  produkte: {
    [TESTBROT.id]: TESTBROT,
    [PROBEWECK.id]: PROBEWECK,
    [AEPFELTASCHE.id]: AEPFELTASCHE,
  },
}
const BELEGUNG: Belegung = {
  version: 1,
  quelle: { commit: 'fixture' },
  slots: [
    { slot: 'theke/vitrine/ebene-1/platz-01', produkt: TESTBROT.id },
    { slot: 'theke/vitrine/ebene-2/platz-02', produkt: PROBEWECK.id },
    { slot: 'theke/vitrine/ebene-3/platz-02', produkt: 'phantomgebaeck' },
    { slot: 'brotregal/ebene-1/platz-01', produkt: AEPFELTASCHE.id },
  ],
}

const fetchMock = jest.fn()

function antworteMitDaten() {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith('/data/belegung.json') ? BELEGUNG : SNAPSHOT,
  }))
}

function setup(strict = false) {
  const user = userEvent.setup()
  const tree = (
    <ThemeRegistry>
      <DigitaleBaeckerei />
    </ThemeRegistry>
  )
  render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree)
  return { user }
}

/** Bis das Modell „steht“ und die Produktdaten da sind. */
async function bereit(strict = false) {
  const { user } = setup(strict)
  await screen.findByTestId('fake-viewer')
  await user.click(screen.getByRole('button', { name: 'fertig' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(strict ? 4 : 2))
  // Die Liste für Screenreader erscheint, sobald die Daten geladen sind.
  await screen.findByTestId('ohne-webgl')
  return { user }
}

const status = () => screen.getByTestId('status')
const viewer = () => screen.getByTestId('fake-viewer')
const sheet = () => screen.queryByTestId('produkt-sheet')

beforeEach(() => {
  mounts.length = 0
  fetchMock.mockReset()
  antworteMitDaten()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('DigitaleBaeckerei: Laden', () => {
  it('zeigt Titel und das Ladebild bei 0 %, noch ohne Bedienelemente', async () => {
    setup()
    expect(screen.getByRole('heading', { name: TITEL })).toBeInTheDocument()
    expect(screen.getByTestId('ladebild')).toBeInTheDocument()
    expect(screen.getByText(LADE_TEXT)).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('img', {
        name: '3D-Ansicht der Bäckerei, Blickpunkt Theke',
      })
    ).toBeInTheDocument()
  })

  it('reicht Modell, erwartete Größe, Morgens und den Blickpunkt Theke durch', async () => {
    setup()
    await screen.findByTestId('fake-viewer')
    expect(mounts).toEqual([
      {
        modelUrl: '/model/twin.glb',
        modelBytes: expect.any(Number),
        fuellung: 'morgens',
        blickpunkt: 'theke',
      },
    ])
  })

  it('lädt Snapshot und Belegung aus data/', async () => {
    await bereit()
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      '/data/belegung.json',
      '/data/products.snapshot.json',
    ])
  })

  it('zeigt den Fortschritt und räumt das Ladebild ab, wenn das Modell steht', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'halb geladen' }))
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('50 %')
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(status()).toHaveTextContent('')

    await user.click(screen.getByRole('button', { name: 'fertig' }))
    expect(screen.queryByTestId('ladebild')).not.toBeInTheDocument()
    expect(status()).toHaveTextContent(BEREIT_TEXT)
    expect(viewer()).toBeInTheDocument()
    expect(screen.getByTestId('blickpunkt-leiste')).toBeInTheDocument()
  })

  it('Ladefehler: Hinweis und „Noch einmal versuchen“ baut die Szene neu', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'halb geladen' }))
    await user.click(screen.getByRole('button', { name: 'Ladefehler' }))
    expect(status()).toHaveTextContent(FEHLER_TEXT)
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
    expect(status()).toHaveTextContent('')
    expect(mounts).toHaveLength(2)
  })

  it('verlorener Kontext: Hinweis und „Neu laden“', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'Kontext verlieren' }))
    expect(status()).toHaveTextContent(UNTERBROCHEN_TEXT)
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Neu laden' }))
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(screen.getByText(LADE_TEXT)).toBeInTheDocument()
  })

  it('läuft unter React StrictMode', async () => {
    await bereit(true)
    expect(screen.getAllByTestId('fake-viewer')).toHaveLength(1)
    expect(status()).toHaveTextContent(BEREIT_TEXT)
  })
})

describe('DigitaleBaeckerei: Blickpunkte', () => {
  it('wechselt über die Chips, ohne die Szene neu zu bauen, und sagt es an', async () => {
    const { user } = await bereit()
    const leiste = within(screen.getByTestId('blickpunkt-leiste'))
    await user.click(leiste.getByRole('button', { name: 'Brotregal' }))

    expect(viewer()).toHaveAttribute('data-blickpunkt', 'brotregal')
    expect(viewer()).toHaveAttribute(
      'aria-label',
      '3D-Ansicht der Bäckerei, Blickpunkt Brotregal'
    )
    expect(status()).toHaveTextContent(blickpunktAnsage('Brotregal'))
    expect(mounts).toHaveLength(1)
  })

  it('Wischen und Pfeiltasten blättern im Kreis', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'zurück' }))
    expect(viewer()).toHaveAttribute('data-blickpunkt', 'regale')
    await user.click(screen.getByRole('button', { name: 'weiter' }))
    expect(viewer()).toHaveAttribute('data-blickpunkt', 'theke')
    await user.click(screen.getByRole('button', { name: 'weiter' }))
    expect(viewer()).toHaveAttribute('data-blickpunkt', 'brotregal')
  })

  it('der Hinweis steht bis zur ersten Geste', async () => {
    const { user } = await bereit()
    expect(screen.getByTestId('hinweis')).toHaveAttribute(
      'data-sichtbar',
      'true'
    )
    expect(screen.getByText(HINWEIS_TEXT)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'erste Geste' }))
    expect(screen.getByTestId('hinweis')).toHaveAttribute(
      'data-sichtbar',
      'false'
    )
  })
})

describe('DigitaleBaeckerei: Produkt antippen', () => {
  it('öffnet die Karte, hebt den Platz hervor und lässt die Szene bedienbar', async () => {
    const { user } = await bereit()
    expect(sheet()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    const karte = sheet() as HTMLElement
    expect(
      within(karte).getByRole('heading', { name: 'Testbrot' })
    ).toBeInTheDocument()
    expect(viewer()).toHaveAttribute(
      'data-auswahl',
      'theke/vitrine/ebene-1/platz-01'
    )
    // Keine Fläche über der Szene, die den nächsten Tipp schluckt.
    expect(screen.queryByTestId('sheet-hintergrund')).not.toBeInTheDocument()

    // Das nächste Produkt wechselt die Karte.
    await user.click(screen.getByRole('button', { name: 'tippe Probeweck' }))
    expect(
      within(sheet() as HTMLElement).getByRole('heading', {
        name: 'Probeweck',
      })
    ).toBeInTheDocument()
    expect(viewer()).toHaveAttribute(
      'data-auswahl',
      'theke/vitrine/ebene-2/platz-02'
    )
  })

  it('ein Tipp ohne Produkt schließt die Karte und nimmt die Hervorhebung weg', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(sheet()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'tippe daneben' }))
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')
  })

  it('ein Produkt, das der Snapshot nicht kennt, bekommt keine Karte', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Unbekanntes' }))
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')
    expect(document.body).not.toHaveTextContent('phantomgebaeck')
  })

  it('„Schließen“ und ein Wechsel des Blickpunkts schließen die Karte', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(
      within(sheet() as HTMLElement).getByRole('button', { name: 'Schließen' })
    )
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')

    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(screen.getByRole('button', { name: 'weiter' }))
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')
  })
})

describe('DigitaleBaeckerei: Liste „Alles hier“', () => {
  it('zeigt die Produkte des Blickpunkts; die Auswahl schließt die Liste, hebt hervor und öffnet die Karte', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    const liste = within(await screen.findByTestId('alles-hier-liste'))
    expect(liste.getByText('Testbrot')).toBeInTheDocument()
    expect(liste.getByText('Probeweck')).toBeInTheDocument()
    // nichts vom Brotregal, nichts Unbekanntes
    expect(liste.queryByText('Äpfeltasche')).not.toBeInTheDocument()
    expect(liste.queryByText(/phantom/i)).not.toBeInTheDocument()

    await user.click(liste.getByText('Probeweck'))
    await waitFor(() =>
      expect(screen.queryByTestId('alles-hier-liste')).not.toBeInTheDocument()
    )
    expect(viewer()).toHaveAttribute(
      'data-auswahl',
      'theke/vitrine/ebene-2/platz-02'
    )
    expect(
      within(sheet() as HTMLElement).getByRole('heading', {
        name: 'Probeweck',
      })
    ).toBeInTheDocument()
  })

  it('an den Regalen: ehrlicher Leertext statt erfundener Einträge', async () => {
    const { user } = await bereit()
    const leiste = within(screen.getByTestId('blickpunkt-leiste'))
    await user.click(leiste.getByRole('button', { name: 'Regale' }))
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    const liste = within(await screen.findByTestId('alles-hier-liste'))
    expect(LISTE_LEER_TEXT).toBe(
      'Für diesen Bereich gibt es noch keine Produktinfos.'
    )
    expect(liste.getByText(LISTE_LEER_TEXT)).toBeInTheDocument()
    expect(liste.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('ohne Produktdaten: die Szene läuft, die Liste nennt den Fehler, ein Tipp öffnet nichts', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }))
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    expect(status()).toHaveTextContent(BEREIT_TEXT)

    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(sheet()).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    const liste = within(await screen.findByTestId('alles-hier-liste'))
    expect(await liste.findByText(DATEN_FEHLER_TEXT)).toBeInTheDocument()
  })
})

describe('DigitaleBaeckerei: ohne WebGL und für Screenreader', () => {
  it('ohne WebGL: die Produktlisten aller Blickpunkte statt der Szene', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'kein WebGL' }))

    const ersatz = within(await screen.findByTestId('ohne-webgl'))
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ladebild')).not.toBeInTheDocument()
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()
    expect(ersatz.getByRole('status')).toHaveTextContent(OHNE_WEBGL_TEXT)
    for (const name of ['Theke', 'Brotregal', 'Regale']) {
      expect(ersatz.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(ersatz.getByText('Testbrot')).toBeInTheDocument()
    expect(ersatz.getByText('Äpfeltasche')).toBeInTheDocument()
    expect(ersatz.getByText(LISTE_LEER_TEXT)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: TITEL })).toBeInTheDocument()
  })

  it('ohne WebGL und ohne Produktdaten: sagt beides, ohne Liste', async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error('offline')
    })
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'kein WebGL' }))
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        `${OHNE_WEBGL_TEXT} ${DATEN_FEHLER_TEXT}`
      )
    )
    expect(screen.queryByTestId('ohne-webgl')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('neben der laufenden Szene steht dieselbe Liste unsichtbar für Screenreader', async () => {
    await bereit()
    const liste = within(screen.getByTestId('ohne-webgl'))
    expect(liste.getByRole('heading', { name: 'Theke' })).toBeInTheDocument()
    expect(liste.getByText('Testbrot')).toBeInTheDocument()
    // ohne die Meldung „kein 3D“
    expect(liste.getByRole('status')).toHaveTextContent('')
    expect(viewer()).toBeInTheDocument()
  })
})

describe('DigitaleBaeckerei: DB8', () => {
  it('nennt nirgends einen Preis - auch nicht mit Karte und Liste', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(document.body.textContent).not.toMatch(VERBOTEN)
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    await screen.findByTestId('alles-hier-liste')
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })
})
