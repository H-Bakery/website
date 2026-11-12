import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Belegung, ProduktSnapshot } from '../lib/produkte/types'
import { LISTE_LEER_TEXT } from './AllesHierListe'
import DigitaleBaeckerei, {
  BEREIT_TEXT,
  DATEN_FEHLER_TEXT,
  FEHLER_TEXT,
  KEINE_INFOS_HINWEIS,
  KEINE_INFOS_MS,
  NICHT_IM_BILD_TEXT,
  TITEL,
  UNTERBROCHEN_TEXT,
  blickpunktAnsage,
  kartenAnsage,
} from './DigitaleBaeckerei'
import { HINWEIS_TEXT } from './Hinweis'
import { ladeNahansicht } from './ladeNahansicht'
import { ladeViewer } from './ladeViewer'
import { LADE_TEXT } from './Ladebild'
import { ZURUECK_TEXT, nahansichtLabel } from './Nahansicht'
import { OHNE_WEBGL_TEXT } from './OhneWebGL'
import { NAHANSICHT_TEXT } from './ProduktSheet'
import { AEPFELTASCHE, PROBEWECK, TESTBROT, VERBOTEN } from './testdaten'
import ThemeRegistry from './ThemeRegistry'

// three.js (ESM, WebGL) nie in jsdom laden: Statt der nachgeladenen Komponente
// liefert `ladeViewer` einen Platzhalter, dessen Knöpfe die Rückmeldungen der
// echten Szene auslösen - oder scheitert, wie ein Chunk im wackligen Netz.
const mounts: Record<string, unknown>[] = []
jest.mock('./ladeViewer', () => ({ ladeViewer: jest.fn() }))
// Ebenso die Nahansicht: Ihr 3D-Code wird nie geladen.
jest.mock('./ladeNahansicht', () => ({ ladeNahansicht: jest.fn() }))

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
  onAuswahlImBild?: (slot: string, imBild: boolean) => void
}) {
  React.useEffect(() => {
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
      <button
        type="button"
        onClick={() =>
          props.auswahl && props.onAuswahlImBild?.(props.auswahl, false)
        }
      >
        Auswahl nicht im Bild
      </button>
      <button
        type="button"
        onClick={() =>
          props.auswahl && props.onAuswahlImBild?.(props.auswahl, true)
        }
      >
        Auswahl im Bild
      </button>
    </div>
  )
}

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

/** Nur das Testbrot hat ein (erfundenes) 3D-Modell für die Nahansicht. */
const MODELLE = {
  version: 1,
  modelle: {
    [TESTBROT.id]: {
      datei: `produkte-3d/${TESTBROT.id}.glb`,
      bytes: 1234,
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.08, 0.05] },
    },
  },
}

const fetchMock = jest.fn()

function antworteMitDaten(modelle: unknown = MODELLE) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/data/produkte-3d.json') && modelle === null) {
      return { ok: false, status: 404 }
    }
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/data/belegung.json')
          ? BELEGUNG
          : url.endsWith('/data/produkte-3d.json')
          ? modelle
          : SNAPSHOT,
    }
  })
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
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(strict ? 6 : 3))
  // Die Liste für Screenreader erscheint, sobald die Daten geladen sind.
  await screen.findByTestId('ohne-webgl')
  return { user }
}

const status = () => screen.getByTestId('status')
const viewer = () => screen.getByTestId('fake-viewer')
const sheet = () => screen.queryByTestId('produkt-sheet')

const ladeViewerMock = ladeViewer as jest.MockedFunction<typeof ladeViewer>
const ladeNahansichtMock = ladeNahansicht as jest.MockedFunction<
  typeof ladeNahansicht
>
/** Was die (gemockte) Nahansicht gebaut und wieder abgebaut hat. */
const nahansichten: { url: string; bytes?: number; dispose: jest.Mock }[] = []

beforeEach(() => {
  mounts.length = 0
  fetchMock.mockReset()
  antworteMitDaten()
  global.fetch = fetchMock as unknown as typeof fetch
  ladeViewerMock.mockReset()
  ladeViewerMock.mockResolvedValue(
    FakeViewer as unknown as Awaited<ReturnType<typeof ladeViewer>>
  )
  nahansichten.length = 0
  ladeNahansichtMock.mockReset()
  ladeNahansichtMock.mockResolvedValue((container, options) => {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', options.label)
    container.prepend(canvas)
    const dispose = jest.fn(() => canvas.remove())
    nahansichten.push({ url: options.url, bytes: options.bytes, dispose })
    return { dispose }
  })
  window.localStorage.clear()
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
      '/data/produkte-3d.json',
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

  it('Ladefehler: Meldung, die Liste bleibt benutzbar, „Noch einmal versuchen“ baut die Szene neu', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await screen.findByTestId('ohne-webgl')
    await user.click(screen.getByRole('button', { name: 'halb geladen' }))
    await user.click(screen.getByRole('button', { name: 'Ladefehler' }))

    const ersatz = within(screen.getByTestId('ohne-webgl'))
    expect(ersatz.getByRole('status')).toHaveTextContent(FEHLER_TEXT)
    expect(ersatz.getByText('Testbrot')).toBeInTheDocument()
    expect(ersatz.getByRole('heading', { name: 'Brotregal' })).toBeVisible()
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()
    // nur eine Meldung, nicht noch eine über dem Bild
    expect(status()).toHaveTextContent('')

    await user.click(
      ersatz.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
    expect(mounts).toHaveLength(2)
  })

  it('Ladefehler ohne Produktdaten: Meldung über dem Bild mit „Noch einmal versuchen“', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }))
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'Ladefehler' }))
    expect(status()).toHaveTextContent(FEHLER_TEXT)
    expect(screen.queryByTestId('ohne-webgl')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(status()).toHaveTextContent('')
  })

  it('der 3D-Code lädt nicht: derselbe Ladefehler auf Deutsch, der zweite Versuch gelingt', async () => {
    ladeViewerMock.mockReset()
    ladeViewerMock.mockRejectedValueOnce(new Error('Loading chunk 824 failed'))
    ladeViewerMock.mockResolvedValue(
      FakeViewer as unknown as Awaited<ReturnType<typeof ladeViewer>>
    )
    const { user } = setup()

    const ersatz = within(await screen.findByTestId('ohne-webgl'))
    await waitFor(() =>
      expect(ersatz.getByRole('status')).toHaveTextContent(FEHLER_TEXT)
    )
    expect(screen.getByRole('heading', { name: TITEL })).toBeInTheDocument()
    expect(ersatz.getByText('Testbrot')).toBeInTheDocument()
    expect(screen.queryByTestId('ladebild')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/chunk|error|exception/i)

    await user.click(
      ersatz.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(ladeViewerMock).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    expect(status()).toHaveTextContent(BEREIT_TEXT)
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

describe('DigitaleBaeckerei: Fokus und Ansage', () => {
  it('nach einem Tipp ins Bild bleibt der Fokus in der Szene, die Status-Region sagt die Karte an', async () => {
    const { user } = await bereit()
    const knopf = screen.getByRole('button', { name: 'tippe Testbrot' })
    await user.click(knopf)
    expect(sheet()).toBeInTheDocument()
    // Der Fokus steht noch dort, wo getippt wurde - nicht im Sheet.
    expect(sheet() as HTMLElement).not.toContainElement(
      document.activeElement as HTMLElement
    )
    expect(knopf).toHaveFocus()
    expect(status()).toHaveTextContent(kartenAnsage('Testbrot'))

    await user.click(screen.getByRole('button', { name: 'tippe Probeweck' }))
    expect(status()).toHaveTextContent(kartenAnsage('Probeweck'))
  })

  it('aus der Liste geöffnet: der Fokus geht ins Sheet und kehrt beim Schließen zurück', async () => {
    const { user } = await bereit()
    const allesHier = screen.getByRole('button', { name: 'Alles hier' })
    await user.click(allesHier)
    const liste = within(await screen.findByTestId('alles-hier-liste'))
    await user.click(liste.getByText('Probeweck'))
    await waitFor(() => expect(sheet()).toHaveFocus())

    await user.keyboard('{Escape}')
    expect(sheet()).not.toBeInTheDocument()
    await waitFor(() => expect(allesHier).toHaveFocus())
  })
})

describe('DigitaleBaeckerei: Produkt nicht im Bild', () => {
  it('sagt es in der Karte, statt stillschweigend ein anderes Produkt zu zeigen', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(screen.queryByTestId('sheet-hinweis')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Auswahl nicht im Bild' })
    )
    expect(screen.getByTestId('sheet-hinweis')).toHaveTextContent(
      NICHT_IM_BILD_TEXT
    )
    // keine Richtung behauptet
    expect(NICHT_IM_BILD_TEXT).not.toMatch(/rechts|links|zieh/i)

    // wieder im Bild (z. B. nach dem Drehen des Geräts)
    await user.click(screen.getByRole('button', { name: 'Auswahl im Bild' }))
    expect(screen.queryByTestId('sheet-hinweis')).not.toBeInTheDocument()
  })

  it('der Hinweis gilt nur für dieses Produkt', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(
      screen.getByRole('button', { name: 'Auswahl nicht im Bild' })
    )
    await user.click(screen.getByRole('button', { name: 'tippe Probeweck' }))
    expect(screen.queryByTestId('sheet-hinweis')).not.toBeInTheDocument()
  })
})

describe('DigitaleBaeckerei: Blickpunkt ohne Produktinfos', () => {
  const hinweis = () => screen.getByTestId('hinweis')

  it('sagt bei der Ankunft einmal, dass es hier nichts zum Antippen gibt', async () => {
    const { user } = await bereit()
    const leiste = within(screen.getByTestId('blickpunkt-leiste'))
    await user.click(leiste.getByRole('button', { name: 'Brotregal' }))
    expect(hinweis()).toHaveAttribute('data-sichtbar', 'false')

    await user.click(leiste.getByRole('button', { name: 'Regale' }))
    expect(hinweis()).toHaveAttribute('data-sichtbar', 'true')
    expect(hinweis()).toHaveTextContent(KEINE_INFOS_HINWEIS)

    // ein Tipp (auf Ware: ohne Karte) räumt ihn weg
    await user.click(screen.getByRole('button', { name: 'tippe daneben' }))
    expect(hinweis()).toHaveAttribute('data-sichtbar', 'false')

    // beim zweiten Besuch nicht noch einmal
    await user.click(leiste.getByRole('button', { name: 'Theke' }))
    await user.click(leiste.getByRole('button', { name: 'Regale' }))
    expect(hinweis()).toHaveAttribute('data-sichtbar', 'false')
  })

  it('verschwindet nach einigen Sekunden von selbst', async () => {
    const { user } = await bereit()
    jest.useFakeTimers()
    try {
      const leiste = within(screen.getByTestId('blickpunkt-leiste'))
      const regale = leiste.getByRole('button', { name: 'Regale' })
      act(() => regale.click())
      expect(hinweis()).toHaveAttribute('data-sichtbar', 'true')
      act(() => {
        jest.advanceTimersByTime(KEINE_INFOS_MS + 10)
      })
      expect(hinweis()).toHaveAttribute('data-sichtbar', 'false')
    } finally {
      jest.useRealTimers()
    }
    expect(user).toBeDefined()
  })

  it('nicht, solange die Produktdaten fehlen - dann wäre die Aussage geraten', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }))
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    const leiste = within(screen.getByTestId('blickpunkt-leiste'))
    await user.click(leiste.getByRole('button', { name: 'Regale' }))
    expect(hinweis()).not.toHaveTextContent(KEINE_INFOS_HINWEIS)
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
    // ohne die Meldung „kein 3D“ und ohne eine zweite Status-Region
    expect(liste.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(viewer()).toBeInTheDocument()
  })
})

describe('DigitaleBaeckerei: nichts auf dem Gerät', () => {
  it('schreibt nichts in localStorage oder sessionStorage', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(screen.getByRole('button', { name: 'weiter' }))
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
    expect(document.cookie).toBe('')
  })
})

describe('DigitaleBaeckerei: Nahansicht „In 3D ansehen“', () => {
  // Laden, Karte und Dialog (MUI-Modal) in einem Test: auf den CI-Maschinen
  // reichen die üblichen 5 s dafür nicht immer.
  jest.setTimeout(30_000)

  const knopf = () => screen.queryByRole('button', { name: NAHANSICHT_TEXT })

  it('bietet den Knopf nur bei einem Produkt mit 3D-Modell an', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(knopf()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'tippe Probeweck' }))
    expect(sheet()).toHaveTextContent('Probeweck')
    expect(knopf()).not.toBeInTheDocument()
  })

  it.each([
    ['fehlt (404)', null],
    ['ist leer', { version: 1, modelle: {} }],
    ['ist unlesbar', { irgendwas: true }],
  ])(
    'kein Knopf, wenn der Index %s - der Laden läuft weiter',
    async (_, index) => {
      antworteMitDaten(index)
      const { user } = await bereit()
      await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
      expect(sheet()).toHaveTextContent('Testbrot')
      expect(knopf()).not.toBeInTheDocument()
      expect(status()).toHaveTextContent(kartenAnsage('Testbrot'))
      expect(ladeNahansichtMock).not.toHaveBeenCalled()
    }
  )

  it('lädt den 3D-Code erst beim Öffnen, zeigt das Modell und gibt beim Schließen alles frei', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    expect(ladeNahansichtMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: NAHANSICHT_TEXT }))
    const dialog = await screen.findByRole('dialog', { name: 'Testbrot' })
    expect(
      await within(dialog).findByRole('img', {
        name: nahansichtLabel('Testbrot'),
      })
    ).toBeInTheDocument()
    expect(nahansichten).toHaveLength(1)
    expect(nahansichten[0]).toMatchObject({
      url: `/produkte-3d/${TESTBROT.id}.glb`,
      bytes: 1234,
    })
    expect(nahansichten[0].dispose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: ZURUECK_TEXT }))
    await waitFor(() =>
      expect(
        screen.queryByRole('img', { name: nahansichtLabel('Testbrot') })
      ).not.toBeInTheDocument()
    )
    expect(nahansichten[0].dispose).toHaveBeenCalledTimes(1)
    // Die Karte und der Laden dahinter sind noch da.
    expect(sheet()).toHaveTextContent('Testbrot')
    expect(viewer()).toHaveAttribute(
      'data-auswahl',
      'theke/vitrine/ebene-1/platz-01'
    )
    expect(mounts).toHaveLength(1)
  })

  it('Escape schließt nur die Nahansicht, die Karte bleibt offen', async () => {
    const { user } = await bereit()
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(screen.getByRole('button', { name: NAHANSICHT_TEXT }))
    await screen.findByRole('img', { name: nahansichtLabel('Testbrot') })

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByTestId('nahansicht-buehne')).not.toBeInTheDocument()
    )
    expect(nahansichten[0].dispose).toHaveBeenCalledTimes(1)
    expect(sheet()).toHaveTextContent('Testbrot')

    // Jetzt gilt Escape wieder der Karte.
    await user.keyboard('{Escape}')
    expect(sheet()).not.toBeInTheDocument()
  })

  it('läuft unter React StrictMode: jede gebaute Nahansicht wird wieder abgebaut', async () => {
    const { user } = await bereit(true)
    await user.click(screen.getByRole('button', { name: 'tippe Testbrot' }))
    await user.click(screen.getByRole('button', { name: NAHANSICHT_TEXT }))
    await screen.findByRole('img', { name: nahansichtLabel('Testbrot') })
    expect(
      document.querySelectorAll('[data-testid="nahansicht-buehne"] canvas')
    ).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: ZURUECK_TEXT }))
    await waitFor(() =>
      expect(screen.queryByTestId('nahansicht-buehne')).not.toBeInTheDocument()
    )
    expect(nahansichten.length).toBeGreaterThan(0)
    for (const n of nahansichten) expect(n.dispose).toHaveBeenCalledTimes(1)
  })
})

describe('DigitaleBaeckerei: Messhaken der Nahansicht (nur mit ?debug)', () => {
  afterEach(() => {
    delete window.__digitaleBaeckerei
  })

  it('öffnet die Nahansicht eines Modells ohne Karte - und nur für IDs aus dem Index', async () => {
    // Den Haken legt sonst die Szene an (createViewer, nur mit ?debug).
    window.__digitaleBaeckerei = {} as NonNullable<
      typeof window.__digitaleBaeckerei
    >
    await bereit()
    const haken = window.__digitaleBaeckerei
    await waitFor(() => expect(haken?.nahansicht).toBeDefined())

    let ergebnis: boolean | undefined
    act(() => {
      ergebnis = haken?.nahansicht?.('gibt-es-nicht')
    })
    expect(ergebnis).toBe(false)
    expect(screen.queryByTestId('nahansicht-buehne')).not.toBeInTheDocument()

    act(() => {
      ergebnis = haken?.nahansicht?.(TESTBROT.id)
    })
    expect(ergebnis).toBe(true)
    expect(
      await screen.findByRole('dialog', { name: 'Testbrot' })
    ).toBeInTheDocument()
    expect(sheet()).not.toBeInTheDocument()
  })

  it('ohne ?debug gibt es keinen Haken', async () => {
    await bereit()
    expect(window.__digitaleBaeckerei).toBeUndefined()
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
