import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeRegistry from './ThemeRegistry'
import ToppingStep from './steps/ToppingStep'
import { WEBGL_INTERRUPTED_TEXT, WEBGL_UNAVAILABLE_TEXT } from './PretzelView'
import { partybrezelConfig as config } from '../config/partybrezel.config'
import { resetWebGLCheck, VIEW_STORAGE_KEY } from '../lib/previewMode'
import { pretzel } from '../lib/testing'
import type { PretzelDraft } from '../lib/types'

// three.js (ESM, WebGL) nie in jsdom laden: die nachgeladene Komponente ist
// ein Platzhalter, der den Ausfall des Kontexts auslösen kann und den Fokus
// wie die echte Komponente setzt (einmal beim Mounten, dann onFocused).
jest.mock('./PretzelPreview3D', () => {
  const { useEffect, useRef } =
    jest.requireActual<typeof import('react')>('react')
  function Fake3D({
    label,
    onUnavailable,
    onInterrupted,
    focusOnMount,
    onFocused,
  }: {
    label: string
    onUnavailable: () => void
    onInterrupted: () => void
    focusOnMount?: boolean
    onFocused?: () => void
  }) {
    const first = useRef<HTMLButtonElement>(null)
    useEffect(() => {
      if (!focusOnMount) return
      first.current?.focus()
      onFocused?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return (
      <div data-testid="fake-3d" role="img" aria-label={`3D ${label}`}>
        <button type="button" ref={first} onClick={onInterrupted}>
          Kontext verlieren
        </button>
        <button type="button" onClick={onUnavailable}>
          Start scheitert
        </button>
      </div>
    )
  }
  return { __esModule: true, default: Fake3D }
})

const realGetContext = HTMLCanvasElement.prototype.getContext

function withWebGL() {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    getExtension: () => ({ loseContext: jest.fn() }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

function setup(pretzels: PretzelDraft[]) {
  const user = userEvent.setup()
  const onPartTopping = jest.fn()
  const utils = render(
    <ThemeRegistry>
      <ToppingStep
        config={config}
        pretzels={pretzels}
        mode="per-part"
        onPartTopping={onPartTopping}
        onPretzelTopping={jest.fn()}
        onCopyToAll={jest.fn()}
      />
    </ThemeRegistry>
  )
  return { user, onPartTopping, ...utils }
}

const toggle2D = () => screen.getByRole('button', { name: '2D-Ansicht' })
const toggle3D = () => screen.getByRole('button', { name: '3D-Ansicht' })
const card = (n: number) => screen.getByTestId(`pretzel-card-${n}`)
const notice = () => screen.getByTestId('preview-notice')

beforeEach(() => {
  window.localStorage.clear()
  resetWebGLCheck()
  HTMLCanvasElement.prototype.getContext = realGetContext
})

describe('Vorschau 2D | 3D', () => {
  it('ohne WebGL: Umschalter da, 3D gesperrt, Hinweis, 2D-Vorschau bleibt', async () => {
    setup([pretzel(config, 'gross', ['kaese', null, null])])
    expect(screen.getByRole('group', { name: 'Vorschau' })).toBeInTheDocument()
    expect(toggle2D()).toHaveAttribute('aria-pressed', 'true')
    expect(toggle3D()).toBeDisabled()
    expect(await screen.findByText(WEBGL_UNAVAILABLE_TEXT)).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Brezel 1 (groß) – Teil 1: Käse, Teil 2: noch offen, Teil 3: noch offen',
      })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
  })

  it('mit WebGL: zeigt 3D samt Legende und merkt sich die Wahl 2D', async () => {
    withWebGL()
    const p = pretzel(config, 'klein', ['butter', 'butter', 'salami'])
    const { user, unmount } = setup([p])
    expect(
      await screen.findByRole('img', { name: '3D Brezel 1 (klein)' })
    ).toBeInTheDocument()
    expect(toggle3D()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText(WEBGL_UNAVAILABLE_TEXT)).not.toBeInTheDocument()
    // Die Legende steht auch unter der 3D-Ansicht.
    const legend = screen.getByRole('list', {
      name: 'Teile von Brezel 1 (klein)',
    })
    expect(within(legend).getByText('Salami')).toBeInTheDocument()

    await user.click(toggle2D())
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^Brezel 1 \(klein\) – Teil 1: Butter/ })
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(VIEW_STORAGE_KEY)).toBe('2d')

    unmount()
    setup([p])
    expect(toggle2D()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
  })

  it('zeigt bei mehreren Brezeln eine in 3D, gewechselt nur per Knopf', async () => {
    withWebGL()
    const { user, onPartTopping } = setup([
      pretzel(config, 'gross'),
      pretzel(config, 'klein'),
    ])
    expect(
      await within(card(1)).findByRole('img', { name: '3D Brezel 1 (groß)' })
    ).toBeInTheDocument()
    // Nur ein 3D-Bild (ein WebGL-Kontext), die zweite Brezel bleibt 2D.
    expect(screen.getAllByTestId('fake-3d')).toHaveLength(1)
    expect(
      within(card(2)).getByRole('img', { name: /^Brezel 2 \(klein\) – / })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Brezel 2 (klein) in 3D ansehen' })
    )
    expect(
      await within(card(2)).findByRole('img', { name: '3D Brezel 2 (klein)' })
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('fake-3d')).toHaveLength(1)
    // Der Knopf verschwindet - der Fokus geht an die 3D-Bedienung, nicht verloren.
    expect(
      within(card(2)).getByRole('button', { name: 'Kontext verlieren' })
    ).toHaveFocus()

    // Ein Belag-Klick in der anderen Karte verschiebt die 3D-Ansicht nicht
    // (sonst sprängen dort die Chips unter dem Zeiger weg).
    await user.click(
      screen.getByRole('button', {
        name: /^Käse .* für Brezel 1 \(groß\), Teil 2$/,
      })
    )
    expect(onPartTopping).toHaveBeenCalled()
    expect(
      within(card(2)).getByRole('img', { name: '3D Brezel 2 (klein)' })
    ).toBeInTheDocument()
    expect(within(card(1)).queryByTestId('fake-3d')).not.toBeInTheDocument()
  })

  it('setzt den Fokus nach „In 3D ansehen“ nur einmal', async () => {
    withWebGL()
    const { user } = setup([pretzel(config, 'gross'), pretzel(config, 'klein')])
    await screen.findByTestId('fake-3d')
    await user.click(
      screen.getByRole('button', { name: 'Brezel 2 (klein) in 3D ansehen' })
    )
    expect(
      await within(card(2)).findByRole('button', { name: 'Kontext verlieren' })
    ).toHaveFocus()

    // 2D und zurück zu 3D per Tastatur: der Fokus bleibt am Umschalter.
    act(() => toggle2D().focus())
    await user.keyboard('{Enter}')
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
    act(() => toggle3D().focus())
    await user.keyboard('{Enter}')
    expect(await screen.findByTestId('fake-3d')).toBeInTheDocument()
    expect(toggle3D()).toHaveFocus()
  })

  it('zeigt nach verlorenem Kontext 2D, 3D lässt sich erneut wählen', async () => {
    withWebGL()
    const { user } = setup([pretzel(config, 'gross')])
    await screen.findByTestId('fake-3d')
    await user.click(screen.getByRole('button', { name: 'Kontext verlieren' }))
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
    expect(notice()).toHaveTextContent(WEBGL_INTERRUPTED_TEXT)
    expect(screen.queryByText(WEBGL_UNAVAILABLE_TEXT)).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^Brezel 1 \(groß\) – / })
    ).toBeInTheDocument()
    // nur eine Unterbrechung: die gemerkte Wahl bleibt 3D
    expect(window.localStorage.getItem(VIEW_STORAGE_KEY)).toBeNull()

    expect(toggle3D()).toBeEnabled()
    await user.click(toggle3D())
    expect(await screen.findByTestId('fake-3d')).toBeInTheDocument()
    expect(notice()).toHaveTextContent('')
  })

  it('sperrt 3D, wenn der Renderer nicht startet', async () => {
    withWebGL()
    const { user } = setup([pretzel(config, 'gross')])
    // Die Status-Region ist von Anfang an da (leer), damit sie angesagt wird.
    expect(notice()).toHaveTextContent('')
    await screen.findByTestId('fake-3d')
    await user.click(screen.getByRole('button', { name: 'Start scheitert' }))
    expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
    expect(notice()).toHaveTextContent(WEBGL_UNAVAILABLE_TEXT)
    expect(toggle3D()).toBeDisabled()
    expect(
      screen.getByRole('img', { name: /^Brezel 1 \(groß\) – / })
    ).toBeInTheDocument()
  })

  it('läuft auch, wenn der Browser-Speicher wirft', async () => {
    withWebGL()
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    const set = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })
    try {
      const { user } = setup([pretzel(config, 'gross')])
      await screen.findByTestId('fake-3d')
      await user.click(toggle2D())
      expect(screen.queryByTestId('fake-3d')).not.toBeInTheDocument()
    } finally {
      spy.mockRestore()
      set.mockRestore()
    }
  })
})
