/**
 * Mehrere Räume (DB11): Wechsel, Adresse `?raum=<id>`, „Zurück“, Infopunkte,
 * Türen, Listen. Mit einem erfundenen zweiten Raum („Werkstatt“) - die
 * Szene ist wie in DigitaleBaeckerei.spec.tsx ein Platzhalter.
 */
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { raeume, type Raum } from '../config/raeume'
import DigitaleBaeckerei, {
  BEREIT_TEXT,
  KEINE_INFOS_HINWEIS,
  RAUM_FEHLER_TEXT,
  kartenAnsage,
  raumBereitText,
} from './DigitaleBaeckerei'
import { ladeNahansicht } from './ladeNahansicht'
import { ladeViewer } from './ladeViewer'
import { KEINE_INFOS_TEXT } from './produktliste'
import { MEHR_LESEN_TEXT, NAHANSICHT_TEXT } from './ProduktSheet'
import { TESTBROT, VERBOTEN } from './testdaten'
import ThemeRegistry from './ThemeRegistry'

jest.mock('./ladeViewer', () => ({ ladeViewer: jest.fn() }))
jest.mock('./ladeNahansicht', () => ({ ladeNahansicht: jest.fn() }))

interface FakeProps {
  modelUrl: string
  modelBytes?: number
  label: string
  blickpunkt: { id: string }
  auswahl?: string | null
  introSpielen?: boolean
  onProgress: (f: number) => void
  onReady: (info: unknown) => void
  onUnavailable: () => void
  onError: (e: unknown) => void
  onTreffer?: (t: unknown) => void
}

/** Was gebaut und wieder abgebaut wurde - jede Szene hat ihr eigenes Modell. */
const gebaut: { modelUrl: string; blickpunkt: string; flug: boolean }[] = []
const abgebaut: string[] = []
let szene: FakeProps | null = null

function FakeViewer(props: FakeProps) {
  szene = props
  React.useEffect(() => {
    gebaut.push({
      modelUrl: props.modelUrl,
      blickpunkt: props.blickpunkt.id,
      flug: props.introSpielen !== false,
    })
    return () => {
      abgebaut.push(props.modelUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      data-testid="fake-viewer"
      role="img"
      aria-label={props.label}
      data-modell={props.modelUrl}
      data-blickpunkt={props.blickpunkt.id}
      data-auswahl={props.auswahl ?? ''}
    />
  )
}

const LADEN = raeume[0]
/** Ein erfundener Raum ohne Produkte: zwei Blickpunkte, zwei Türen. */
const WERKSTATT: Raum = {
  id: 'werkstatt',
  name: 'Werkstatt',
  wechsel: 'In die Werkstatt',
  modell: 'werkstatt.glb',
  fuellung: 'morgens',
  produkte: false,
  start: 'ofen',
  blickpunkte: [
    {
      id: 'ofen',
      name: 'Ofen',
      eye: [4, 1.6, 0],
      look: [0, 1, 0],
      fov: 60,
      yawDeg: 20,
      pitchDeg: 10,
      fovMin: 24,
      fovMax: 60,
      moebel: ['ofen/', 'kneter/'],
    },
    {
      id: 'lager',
      name: 'Lager',
      eye: [4, 1.6, 4],
      look: [0, 1, 4],
      fov: 60,
      yawDeg: 20,
      pitchDeg: 10,
      fovMin: 24,
      fovMax: 60,
      moebel: ['sack/'],
    },
  ],
  tueren: [
    { knoten: 'tuer', ziel: 'laden' },
    // Diesen Raum gibt es nicht: Die Tür bleibt ein Stück Wand.
    { knoten: 'kellertuer', ziel: 'keller' },
  ],
}
const ZWEI = [LADEN, WERKSTATT]

const RAUMINFOS = {
  version: 1,
  raeume: {
    werkstatt: {
      infopunkte: [
        {
          knoten: 'ofen',
          titel: 'Probeofen',
          kurz: 'Ein erfundener Ofen.',
          text: 'Mehr zum Probeofen.',
        },
        {
          knoten: 'kneter',
          titel: 'Probekneter',
          kurz: 'Ein erfundener Kneter.',
        },
      ],
    },
  },
}
const SNAPSHOT = {
  version: 1,
  erstellt: '2026-01-01T00:00:00.000Z',
  produkte: { [TESTBROT.id]: TESTBROT },
}
const BELEGUNG = {
  version: 2,
  raeume: {
    laden: {
      quelle: { commit: 'fixture' },
      slots: [{ slot: 'theke/vitrine/ebene-1/platz-01', produkt: TESTBROT.id }],
    },
    werkstatt: { quelle: { commit: 'fixture' }, slots: [] },
  },
}

const fetchMock = jest.fn()
const ladeViewerMock = ladeViewer as jest.MockedFunction<typeof ladeViewer>

beforeEach(() => {
  gebaut.length = 0
  abgebaut.length = 0
  szene = null
  window.history.replaceState(null, '', '/')
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url.endsWith('/data/belegung.json')
        ? BELEGUNG
        : url.endsWith('/data/rauminfos.json')
        ? RAUMINFOS
        : url.endsWith('/data/produkte-3d.json')
        ? { version: 1, modelle: {} }
        : SNAPSHOT,
  }))
  global.fetch = fetchMock as unknown as typeof fetch
  ladeViewerMock.mockReset()
  ladeViewerMock.mockResolvedValue(
    FakeViewer as unknown as Awaited<ReturnType<typeof ladeViewer>>
  )
  ;(ladeNahansicht as jest.Mock).mockReset()
  window.localStorage.clear()
})

function setup(raeumeDerApp: readonly Raum[] = ZWEI) {
  const user = userEvent.setup()
  render(
    <ThemeRegistry>
      <DigitaleBaeckerei raeume={raeumeDerApp} />
    </ThemeRegistry>
  )
  return { user }
}

/** Die Szene meldet: Modell steht. */
async function fertig(flug = false) {
  await screen.findByTestId('fake-viewer')
  act(() => {
    szene?.onProgress(1)
    szene?.onReady({
      firstFrameMs: 1,
      triangles: 12,
      fill: null,
      intro: flug ? { id: 'kurz', laeuft: true } : null,
    })
  })
  await screen.findByTestId('blickpunkt-leiste')
  // Produktdaten und Infopunkte sind da (Liste für Screenreader).
  await screen.findByTestId('ohne-webgl')
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
}

const tippe = (slot: string, produkt?: string) =>
  act(() => {
    szene?.onTreffer?.({
      slot,
      produkt,
      moebel: slot.split('/')[0],
      punkt: [0, 0, 0],
    })
  })

const viewer = () => screen.getByTestId('fake-viewer')
const sheet = () => screen.queryByTestId('produkt-sheet')
const status = () => screen.getByTestId('status')
const wechsel = () => screen.queryByTestId('raum-wechsel')
const zustand = () =>
  document.querySelector('main')?.getAttribute('data-zustand')

describe('ein Raum (wie heute live)', () => {
  it('kein Raumwechsel in der Leiste, die Adresse bleibt, wie sie ist', async () => {
    setup([LADEN])
    await fertig()
    expect(wechsel()).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(gebaut).toEqual([
      { modelUrl: '/model/twin.glb', blickpunkt: 'theke', flug: true },
    ])
    expect(status()).toHaveTextContent(BEREIT_TEXT)
  })

  it('ein Link in einen Raum, der nicht gebaut ist, landet im Laden', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup([LADEN])
    await fertig()
    expect(viewer()).toHaveAttribute('data-modell', '/model/twin.glb')
    expect(wechsel()).not.toBeInTheDocument()
  })

  it('ein Stück ohne Produkt und ohne Infopunkt öffnet keine Karte', async () => {
    setup([LADEN])
    await fertig()
    tippe('theke/korpus')
    expect(sheet()).not.toBeInTheDocument()
    tippe('theke/vitrine/ebene-1/platz-01', TESTBROT.id)
    expect(
      within(sheet() as HTMLElement).getByRole('heading')
    ).toHaveTextContent(TESTBROT.name)
  })
})

describe('Raum wechseln', () => {
  it('der Knopf führt in den anderen Raum: neue Szene mit dessen Modell am Start-Blickpunkt, die alte ist abgebaut', async () => {
    const { user } = setup()
    await fertig()
    expect(wechsel()).toHaveTextContent('In die Werkstatt')
    await user.click(wechsel() as HTMLElement)

    // Laden mit Ladebild, bis das Modell des Raums steht.
    expect(zustand()).toBe('laden')
    expect(screen.getByTestId('ladebild')).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
    expect(screen.queryByTestId('blickpunkt-leiste')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    expect(viewer()).toHaveAttribute('data-blickpunkt', 'ofen')
    expect(abgebaut).toEqual(['/model/twin.glb'])
    expect(gebaut.map((g) => g.modelUrl)).toEqual([
      '/model/twin.glb',
      '/model/werkstatt.glb',
    ])
    expect(window.location.search).toBe('?raum=werkstatt')

    await fertig()
    expect(status()).toHaveTextContent(raumBereitText('Werkstatt', 'Ofen'))
    const leiste = within(screen.getByTestId('blickpunkt-leiste'))
    expect(leiste.getByRole('button', { name: 'Ofen' })).toBeInTheDocument()
    expect(leiste.getByRole('button', { name: 'Lager' })).toBeInTheDocument()
    expect(leiste.queryByRole('button', { name: 'Theke' })).toBeNull()
    // Und wieder zurück - der Knopf nennt jetzt den Laden.
    expect(wechsel()).toHaveTextContent('In den Laden')
  })

  it('der Fokus geht beim Wechsel nicht verloren: Er steht danach wieder auf dem Raumwechsel', async () => {
    const { user } = setup()
    await fertig()
    await user.click(wechsel() as HTMLElement)
    // Unterwegs ist die Leiste weg - der Fokus fällt auf BODY.
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    expect(document.body).toHaveFocus()
    await fertig()
    expect(wechsel()).toHaveFocus()
    expect(wechsel()).toHaveTextContent('In den Laden')
  })

  it('wer den Fokus inzwischen woanders hat, behält ihn', async () => {
    const { user } = setup()
    await fertig()
    await user.click(wechsel() as HTMLElement)
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    const titel = screen.getByRole('heading', { level: 1 })
    titel.tabIndex = -1
    titel.focus()
    await fertig()
    expect(titel).toHaveFocus()
  })

  it('die erwartete Größe gibt es nur für Räume aus dem Lock', async () => {
    const { user } = setup()
    await fertig()
    expect(szene?.modelBytes).toEqual(expect.any(Number))
    await user.click(wechsel() as HTMLElement)
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    expect(szene?.modelBytes).toBeUndefined()
  })

  it('Karte und Liste des alten Raums gehen zu', async () => {
    const { user } = setup()
    await fertig()
    tippe('theke/vitrine/ebene-1/platz-01', TESTBROT.id)
    expect(sheet()).toBeInTheDocument()
    // Die Karte liegt im Hochformat über der Leiste - der Wechsel kommt hier
    // über „Zurück“/„Vor“ des Browsers.
    act(() => {
      window.history.pushState(null, '', '/?raum=werkstatt')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')
    await user.keyboard('{Escape}')
  })

  it('„Zurück“ im Browser führt in den vorigen Raum, „Vor“ wieder hinein', async () => {
    const { user } = setup()
    await fertig()
    await user.click(wechsel() as HTMLElement)
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    await fertig()

    act(() => window.history.back())
    await waitFor(() => expect(window.location.search).toBe(''))
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/twin.glb')
    )
    expect(viewer()).toHaveAttribute('data-blickpunkt', 'theke')
    expect(abgebaut).toEqual(['/model/twin.glb', '/model/werkstatt.glb'])

    act(() => window.history.forward())
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    expect(window.location.search).toBe('?raum=werkstatt')
  })

  it('andere Parameter der Adresse bleiben beim Wechsel stehen', async () => {
    window.history.replaceState(null, '', '/?debug&intro=0')
    const { user } = setup()
    await fertig()
    await user.click(wechsel() as HTMLElement)
    expect(window.location.search).toBe('?debug&intro=0&raum=werkstatt')
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    await fertig()
    await user.click(wechsel() as HTMLElement)
    expect(window.location.search).toBe('?debug&intro=0')
  })

  it('nichts davon landet auf dem Gerät', async () => {
    const { user } = setup()
    await fertig()
    await user.click(wechsel() as HTMLElement)
    await waitFor(() => expect(window.location.search).toBe('?raum=werkstatt'))
    expect(window.localStorage).toHaveLength(0)
    expect(window.sessionStorage).toHaveLength(0)
    expect(document.cookie).toBe('')
  })
})

describe('Link in einen Raum (?raum=<id>)', () => {
  it('öffnet gleich diesen Raum - das Modell des Ladens wird nie gebaut', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup()
    await fertig()
    expect(gebaut).toEqual([
      { modelUrl: '/model/werkstatt.glb', blickpunkt: 'ofen', flug: true },
    ])
    expect(abgebaut).toEqual([])
    expect(status()).toHaveTextContent(raumBereitText('Werkstatt', 'Ofen'))
    // Beim Laden über einen Link nimmt sich die App keinen Fokus.
    expect(document.body).toHaveFocus()
    expect(window.location.search).toBe('?raum=werkstatt')
  })

  it('ein unbekannter Raum landet im Laden', async () => {
    window.history.replaceState(null, '', '/?raum=keller')
    setup()
    await fertig()
    expect(gebaut.map((g) => g.modelUrl)).toEqual(['/model/twin.glb'])
  })

  it('ein Ladefehler nennt den Raum, nicht den Laden', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup()
    await screen.findByTestId('fake-viewer')
    act(() => szene?.onError(new Error('404')))
    const ersatz = within(await screen.findByTestId('ohne-webgl'))
    expect(ersatz.getByRole('status')).toHaveTextContent(RAUM_FEHLER_TEXT)
  })
})

describe('Flug zum Start', () => {
  it('läuft je Raum einmal: Wer in den Laden zurückkommt, steht gleich an der Theke', async () => {
    const { user } = setup()
    await fertig(true)
    expect(gebaut[0].flug).toBe(true)
    // Unterwegs gibt es keine Leiste: der Wechsel über die Adresse.
    act(() => {
      window.history.pushState(null, '', '/?raum=werkstatt')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
    await fertig()
    await user.click(wechsel() as HTMLElement)
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/twin.glb')
    )
    expect(gebaut.map((g) => [g.modelUrl, g.flug])).toEqual([
      ['/model/twin.glb', true],
      ['/model/werkstatt.glb', true],
      ['/model/twin.glb', false],
    ])
  })
})

describe('Infopunkte', () => {
  async function inDerWerkstatt() {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    const { user } = setup()
    await fertig()
    return { user }
  }

  it('ein Tipp auf ein Stück mit Infopunkt öffnet die Karte und hebt den ganzen Infopunkt hervor', async () => {
    const { user } = await inDerWerkstatt()
    tippe('ofen/tuer')
    const karte = within(sheet() as HTMLElement)
    expect(karte.getByRole('heading')).toHaveTextContent('Probeofen')
    expect(karte.getByText('Ein erfundener Ofen.')).toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', 'ofen')
    expect(status()).toHaveTextContent(kartenAnsage('Probeofen'))
    // Der lange Text steckt hinter „Mehr lesen“.
    await user.click(karte.getByRole('button', { name: MEHR_LESEN_TEXT }))
    expect(karte.getByText('Mehr zum Probeofen.')).toBeInTheDocument()
    // Keine Nahansicht für Infopunkte, nichts zu Kosten.
    expect(karte.queryByRole('button', { name: NAHANSICHT_TEXT })).toBeNull()
    expect(sheet()?.textContent).not.toMatch(VERBOTEN)
  })

  it('ein anderes Stück wechselt die Karte, eines ohne Infopunkt schließt sie', async () => {
    await inDerWerkstatt()
    tippe('ofen/korpus')
    tippe('kneter/kessel')
    expect(
      within(sheet() as HTMLElement).getByRole('heading')
    ).toHaveTextContent('Probekneter')
    expect(viewer()).toHaveAttribute('data-auswahl', 'kneter')
    tippe('spuele/becken')
    expect(sheet()).not.toBeInTheDocument()
    expect(viewer()).toHaveAttribute('data-auswahl', '')
  })

  it('in einem Raum ohne Produkte gibt es keine Produktkarte, auch wenn das Modell ein Produkt nennt', async () => {
    await inDerWerkstatt()
    tippe('sack/platz-01', TESTBROT.id)
    expect(sheet()).not.toBeInTheDocument()
  })

  it('„Alles hier“ listet die Infopunkte des Blickpunkts; die Auswahl öffnet die Karte', async () => {
    const { user } = await inDerWerkstatt()
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    const liste = within(screen.getByTestId('alles-hier-liste'))
    expect(
      liste.getAllByRole('listitem').map((zeile) => zeile.textContent)
    ).toEqual(['Probekneter', 'Probeofen'])
    // „Entdeckt x von y“ zählt Produkte - hier gibt es keine.
    expect(liste.queryByTestId('entdeckt')).toBeNull()
    await user.click(liste.getByRole('button', { name: 'Probeofen' }))
    await waitFor(() =>
      expect(screen.queryByTestId('alles-hier-liste')).not.toBeInTheDocument()
    )
    expect(
      within(sheet() as HTMLElement).getByRole('heading')
    ).toHaveTextContent('Probeofen')
    expect(viewer()).toHaveAttribute('data-auswahl', 'ofen')
  })

  it('ein Blickpunkt ohne Infopunkte sagt das - im Hinweis und in der Liste', async () => {
    const { user } = await inDerWerkstatt()
    await user.click(screen.getByRole('button', { name: 'Lager' }))
    expect(await screen.findByText(KEINE_INFOS_HINWEIS)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    expect(
      within(screen.getByTestId('alles-hier-liste')).getByText(KEINE_INFOS_TEXT)
    ).toBeInTheDocument()
  })

  it('am Blickpunkt mit Infopunkten kommt der Hinweis „keine Infos“ nicht', async () => {
    await inDerWerkstatt()
    expect(screen.queryByText(KEINE_INFOS_HINWEIS)).not.toBeInTheDocument()
  })
})

describe('Türen', () => {
  it('ein Tipp auf die Tür führt in ihren Raum - als eigener Schritt im Verlauf', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup()
    await fertig()
    tippe('tuer/blatt')
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/twin.glb')
    )
    expect(window.location.search).toBe('')
    expect(sheet()).not.toBeInTheDocument()
    act(() => window.history.back())
    await waitFor(() =>
      expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    )
  })

  it('eine Tür in einen Raum, den es nicht gibt, ist ein Stück Wand', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup()
    await fertig()
    tippe('kellertuer/blatt')
    expect(viewer()).toHaveAttribute('data-modell', '/model/werkstatt.glb')
    expect(window.location.search).toBe('?raum=werkstatt')
    expect(gebaut).toHaveLength(1)
  })
})

describe('ohne WebGL', () => {
  it('alle Räume untereinander, jeder mit Überschrift: Produkte des Ladens und Infopunkte der Werkstatt', async () => {
    setup()
    await screen.findByTestId('fake-viewer')
    act(() => szene?.onUnavailable())
    const ersatz = within(await screen.findByTestId('ohne-webgl'))
    await waitFor(() =>
      expect(ersatz.getByText('Probeofen')).toBeInTheDocument()
    )
    expect(
      ersatz.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['Laden', 'Werkstatt'])
    expect(
      ersatz.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    ).toEqual(['Theke', 'Brotregal', 'Regale', 'Ofen', 'Lager'])
    const werkstatt = within(ersatz.getByRole('region', { name: 'Werkstatt' }))
    expect(werkstatt.getByText('Ein erfundener Kneter.')).toBeInTheDocument()
    // Leerer Abschnitt: in der Werkstatt „keine Infos“, nicht „keine Produktinfos“.
    expect(werkstatt.getByText(KEINE_INFOS_TEXT)).toBeInTheDocument()
    expect(
      within(ersatz.getByRole('region', { name: 'Laden' })).getByText(
        TESTBROT.name
      )
    ).toBeInTheDocument()
    expect(wechsel()).not.toBeInTheDocument()
  })

  it('neben der laufenden Szene steht für Screenreader nur der Raum, in dem man steht', async () => {
    window.history.replaceState(null, '', '/?raum=werkstatt')
    setup()
    await fertig()
    const liste = within(screen.getByTestId('ohne-webgl'))
    expect(liste.getByText('Probeofen')).toBeInTheDocument()
    expect(liste.queryByText(TESTBROT.name)).toBeNull()
    expect(
      liste.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(['Ofen', 'Lager'])
  })
})
