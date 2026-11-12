import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DigitaleBaeckerei, {
  BEREIT_TEXT,
  FEHLER_TEXT,
  KEIN_WEBGL_TEXT,
  TITEL,
  UNTERBROCHEN_TEXT,
} from './DigitaleBaeckerei'
import { LADE_TEXT } from './Ladeanzeige'
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
    onProgress: (f: number) => void
    onReady: (info: unknown) => void
    onUnavailable: () => void
    onError: (e: unknown) => void
    onLost: () => void
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
    return (
      <div data-testid="fake-viewer" role="img" aria-label={props.label}>
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
      </div>
    )
  }
  return { __esModule: true, default: FakeViewer }
})

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

const status = () => screen.getByTestId('status')

beforeEach(() => {
  mounts.length = 0
})

describe('DigitaleBaeckerei', () => {
  it('zeigt Titel, Blickpunkt und die Ladeanzeige bei 0 %', async () => {
    setup()
    expect(screen.getByRole('heading', { name: TITEL })).toBeInTheDocument()
    expect(screen.getByText('Blickpunkt: Theke')).toBeInTheDocument()
    expect(screen.getByText(LADE_TEXT)).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
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

  it('zeigt den Fortschritt und räumt die Ladeanzeige ab, wenn das Modell steht', async () => {
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
    expect(screen.queryByText(LADE_TEXT)).not.toBeInTheDocument()
    expect(status()).toHaveTextContent(BEREIT_TEXT)
    expect(screen.getByTestId('fake-viewer')).toBeInTheDocument()
  })

  it('ohne WebGL: Hinweis auf Deutsch, keine Szene, kein Knopf', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'kein WebGL' }))
    expect(status()).toHaveTextContent(KEIN_WEBGL_TEXT)
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()
    expect(screen.queryByText(LADE_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('Ladefehler: Hinweis und „Noch einmal versuchen“ baut die Szene neu', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'halb geladen' }))
    await user.click(screen.getByRole('button', { name: 'Ladefehler' }))
    expect(status()).toHaveTextContent(FEHLER_TEXT)
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('0 %')
    expect(status()).toHaveTextContent('')
    expect(mounts).toHaveLength(2)
  })

  it('verlorener Kontext: Hinweis und „Neu laden“', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    await user.click(screen.getByRole('button', { name: 'Kontext verlieren' }))
    expect(status()).toHaveTextContent(UNTERBROCHEN_TEXT)
    expect(screen.queryByTestId('fake-viewer')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Neu laden' }))
    expect(await screen.findByTestId('fake-viewer')).toBeInTheDocument()
    expect(screen.getByText(LADE_TEXT)).toBeInTheDocument()
  })

  it('läuft unter React StrictMode', async () => {
    const { user } = setup(true)
    await screen.findByTestId('fake-viewer')
    expect(screen.getAllByTestId('fake-viewer')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    expect(status()).toHaveTextContent(BEREIT_TEXT)
  })

  it('nennt nirgends einen Preis (DB8)', async () => {
    const { user } = setup()
    await screen.findByTestId('fake-viewer')
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    expect(document.body.textContent).not.toMatch(/€|EUR|Preis/i)
  })
})
