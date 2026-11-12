import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { NahansichtOptions } from '../lib/scene/createNahansicht'
import { ladeNahansicht } from './ladeNahansicht'
import Nahansicht, {
  NAHANSICHT_BEDIENUNG_TOUCH,
  NAHANSICHT_FEHLER_TEXT,
  NAHANSICHT_LADEN_TEXT,
  NAHANSICHT_NOCHMAL_TEXT,
  NAHANSICHT_OHNE_WEBGL_TEXT,
  NAHANSICHT_UNTERBROCHEN_TEXT,
  ZURUECK_TEXT,
  nahansichtBereitAnsage,
  nahansichtLabel,
} from './Nahansicht'
import { VERBOTEN } from './testdaten'
import ThemeRegistry from './ThemeRegistry'

// Der 3D-Code (three.js, WebGL) wird in jsdom nie geladen: `ladeNahansicht`
// liefert einen Platzhalter, der sich merkt, was er bekam und ob er wieder
// abgebaut wurde.
jest.mock('./ladeNahansicht', () => ({ ladeNahansicht: jest.fn() }))
const ladeMock = ladeNahansicht as jest.MockedFunction<typeof ladeNahansicht>

interface Gebaut {
  container: HTMLElement
  options: NahansichtOptions
  dispose: jest.Mock
}
const gebaut: Gebaut[] = []
/** `false`: Das Gerät gibt keinen WebGL-Kontext her. */
let webgl = true

beforeEach(() => {
  gebaut.length = 0
  webgl = true
  ladeMock.mockReset()
  ladeMock.mockResolvedValue((container, options) => {
    if (!webgl) return null
    const canvas = document.createElement('canvas')
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', options.label)
    container.prepend(canvas)
    const dispose = jest.fn(() => canvas.remove())
    gebaut.push({ container, options, dispose })
    return { dispose }
  })
})

const URL_BROT = '/produkte-3d/testbrot-500g.glb'

function setup(strict = false) {
  const onClose = jest.fn()
  const baum = (
    <ThemeRegistry>
      <Nahansicht
        name="Testbrot"
        url={URL_BROT}
        bytes={14580}
        onClose={onClose}
      />
    </ThemeRegistry>
  )
  const view = render(
    strict ? <React.StrictMode>{baum}</React.StrictMode> : baum
  )
  return { user: userEvent.setup(), onClose, view }
}

const buehne = () => screen.getByTestId('nahansicht-buehne')
const status = () => screen.getByTestId('nahansicht-status')
const letzte = () => gebaut[gebaut.length - 1]

describe('Nahansicht', () => {
  it('ist ein Dialog mit dem Produktnamen als Überschrift und „Zurück“', async () => {
    const { user, onClose } = setup()
    expect(screen.getByRole('dialog', { name: 'Testbrot' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Testbrot' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ZURUECK_TEXT }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('zeigt beim Laden den Fortschritt und reicht Adresse, Größe und Beschriftung durch', async () => {
    setup()
    expect(buehne()).toHaveAttribute('data-phase', 'laden')
    expect(status()).toHaveTextContent(NAHANSICHT_LADEN_TEXT)
    await waitFor(() => expect(gebaut).toHaveLength(1))
    expect(letzte().options).toMatchObject({
      url: URL_BROT,
      bytes: 14580,
      label: nahansichtLabel('Testbrot'),
      reducedMotion: false,
    })
    expect(
      screen.getByRole('img', { name: '3D-Modell: Testbrot' })
    ).toBeInTheDocument()

    act(() => letzte().options.onProgress(0.5))
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50'
    )

    act(() => {
      letzte().options.onProgress(1)
      letzte().options.onReady({ ersteBildMs: 1, triangles: 162 })
    })
    expect(buehne()).toHaveAttribute('data-phase', 'bereit')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(status()).toHaveTextContent(nahansichtBereitAnsage('Testbrot'))
    expect(screen.getByTestId('nahansicht-hinweis-touch')).toHaveTextContent(
      NAHANSICHT_BEDIENUNG_TOUCH
    )
  })

  it('ohne Bewegung, wenn das Gerät sie abgestellt hat', async () => {
    const original = window.matchMedia
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }))
    try {
      setup()
      await waitFor(() => expect(gebaut).toHaveLength(1))
      expect(letzte().options.reducedMotion).toBe(true)
    } finally {
      window.matchMedia = original
    }
  })

  it('gibt beim Schließen (Abbauen) alles frei', async () => {
    const { view } = setup()
    await waitFor(() => expect(gebaut).toHaveLength(1))
    expect(letzte().dispose).not.toHaveBeenCalled()
    view.unmount()
    expect(gebaut[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('baut nichts mehr, wenn sie schon zu ist, bevor der 3D-Code da ist', async () => {
    let fertig: (v: Awaited<ReturnType<typeof ladeNahansicht>>) => void = () =>
      undefined
    const baue = jest.fn(() => ({ dispose: jest.fn() }))
    ladeMock.mockReturnValue(
      new Promise((resolve) => {
        fertig = resolve
      })
    )
    const { view } = setup()
    view.unmount()
    await act(async () => {
      fertig(baue)
    })
    expect(baue).not.toHaveBeenCalled()
  })

  it('läuft unter React StrictMode: ein Canvas, und jede gebaute Ansicht wird abgebaut', async () => {
    const { view } = setup(true)
    await waitFor(() => expect(gebaut.length).toBeGreaterThan(0))
    expect(buehne().querySelectorAll('canvas')).toHaveLength(1)
    expect(
      gebaut.filter((g) => g.dispose.mock.calls.length === 0)
    ).toHaveLength(1)
    view.unmount()
    for (const g of gebaut) expect(g.dispose).toHaveBeenCalledTimes(1)
  })

  it('ohne WebGL: deutsche Meldung, „Zurück“ bleibt benutzbar', async () => {
    webgl = false
    const { user, onClose } = setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      NAHANSICHT_OHNE_WEBGL_TEXT
    )
    expect(buehne()).toHaveAttribute('data-phase', 'kein-webgl')
    // Noch einmal versuchen hilft hier nicht.
    expect(
      screen.queryByRole('button', { name: NAHANSICHT_NOCHMAL_TEXT })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ZURUECK_TEXT }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Modell lädt nicht: Meldung, „Noch einmal versuchen“ baut neu auf und räumt die alte Ansicht ab', async () => {
    const { user } = setup()
    await waitFor(() => expect(gebaut).toHaveLength(1))
    act(() => gebaut[0].options.onError(new Error('404')))
    expect(screen.getByRole('alert')).toHaveTextContent(NAHANSICHT_FEHLER_TEXT)

    await user.click(
      screen.getByRole('button', { name: NAHANSICHT_NOCHMAL_TEXT })
    )
    await waitFor(() => expect(gebaut).toHaveLength(2))
    expect(gebaut[0].dispose).toHaveBeenCalledTimes(1)
    expect(buehne()).toHaveAttribute('data-phase', 'laden')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('der 3D-Code lädt nicht (wackliges Netz): dieselbe Meldung statt einer Fehlerseite', async () => {
    ladeMock.mockRejectedValue(new Error('ChunkLoadError'))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      NAHANSICHT_FEHLER_TEXT
    )
  })

  it('verlorener Kontext: Hinweis und neu laden', async () => {
    setup()
    await waitFor(() => expect(gebaut).toHaveLength(1))
    act(() => {
      letzte().options.onReady({ ersteBildMs: 1, triangles: 162 })
      letzte().options.onLost()
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      NAHANSICHT_UNTERBROCHEN_TEXT
    )
  })

  it('nennt nirgends Kosten oder Inhaltsstoff-Hinweise und speichert nichts', async () => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    setup()
    await waitFor(() => expect(gebaut).toHaveLength(1))
    act(() => letzte().options.onReady({ ersteBildMs: 1, triangles: 162 }))
    expect(document.body.textContent).not.toMatch(VERBOTEN)
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})
