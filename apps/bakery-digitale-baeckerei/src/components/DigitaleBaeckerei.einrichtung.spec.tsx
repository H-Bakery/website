import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { raeume } from '../config/raeume'
import type { SzenenEinrichtung } from '../lib/scene/createViewer'
import DigitaleBaeckerei from './DigitaleBaeckerei'
import { ladeViewer } from './ladeViewer'
import { TESTBROT } from './testdaten'
import ThemeRegistry from './ThemeRegistry'

// Einrichtung (DB12): Was bekommt die Szene, bevor sie das erste Bild zeigt?
// three.js wird in jsdom nie geladen - ein Platzhalter merkt sich seine Props.
jest.mock('./ladeViewer', () => ({ ladeViewer: jest.fn() }))
jest.mock('./ladeNahansicht', () => ({ ladeNahansicht: jest.fn() }))

const gesehen: {
  einrichtung?: Promise<SzenenEinrichtung | null>
  belegung?: unknown
}[] = []

function FakeViewer(props: {
  einrichtung?: Promise<SzenenEinrichtung | null>
  belegung?: unknown
  auswahl?: string | null
  onProgress: (f: number) => void
  onReady: (info: unknown) => void
  onTreffer?: (t: unknown) => void
}) {
  React.useEffect(() => {
    gesehen.push({ einrichtung: props.einrichtung, belegung: props.belegung })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div data-testid="fake-viewer" data-auswahl={props.auswahl ?? ''}>
      <button
        type="button"
        onClick={() => {
          props.onProgress(1)
          props.onReady({
            firstFrameMs: 1,
            triangles: 1,
            fill: null,
            intro: null,
          })
        }}
      >
        fertig
      </button>
      <button
        type="button"
        onClick={() =>
          props.onTreffer?.({
            slot: 'theke/vitrine/ebene-1/platz-01',
            produkt: TESTBROT.id,
            moebel: 'theke',
            punkt: [0, 0, 0],
          })
        }
      >
        tipp
      </button>
    </div>
  )
}

const PLATZ = {
  o: [0, 1, 0],
  r: [1, 0, 0],
  n: [0, 1, 0],
  f: [0, 0, 1],
  b: 0.4,
  t: 0.3,
  h: 0.2,
  art: 'reihen',
  neigung: 0,
}
const BELEGUNG = {
  version: 3,
  raeume: {
    laden: {
      quelle: { commit: 'fixture' },
      slots: [
        {
          slot: 'theke/vitrine/ebene-1/platz-01',
          produkt: TESTBROT.id,
          anzahl: 2,
          quelle: 'einrichtung',
        },
      ],
      leer: ['theke/vitrine/ebene-1/platz-02'],
      plaetze: { 'theke/vitrine/ebene-1/platz-01': PLATZ },
    },
  },
}
const SNAPSHOT = {
  version: 1,
  erstellt: '2026-01-01T00:00:00.000Z',
  produkte: { [TESTBROT.id]: TESTBROT },
}
const REGAL = {
  datei: 'produkte-3d/_regal.glb',
  bytes: 3048,
  modelle: {
    [TESTBROT.id]: {
      bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] },
      dreiecke: 14,
    },
  },
}

const fetchMock = jest.fn()
function antworte(o: { index?: unknown; belegungFehlt?: boolean } = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/data/belegung.json') && o.belegungFehlt) {
      return { ok: false, status: 404 }
    }
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/data/belegung.json')
          ? BELEGUNG
          : url.endsWith('/data/rauminfos.json')
          ? { version: 1, raeume: {} }
          : url.endsWith('/data/produkte-3d.json')
          ? o.index ?? { version: 1, modelle: {} }
          : SNAPSHOT,
    }
  })
}

beforeEach(() => {
  gesehen.length = 0
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  ;(ladeViewer as jest.MockedFunction<typeof ladeViewer>).mockResolvedValue(
    FakeViewer as unknown as Awaited<ReturnType<typeof ladeViewer>>
  )
})

async function szene() {
  render(
    <ThemeRegistry>
      <DigitaleBaeckerei />
    </ThemeRegistry>
  )
  await screen.findByTestId('fake-viewer')
  expect(gesehen).toHaveLength(1)
  return gesehen[0]
}

describe('DigitaleBaeckerei: Einrichtung für die Szene (DB12)', () => {
  it('gibt der Szene die Belegung des Raums mit den Rahmen der Plätze, die Regal-Modelle und die Blickpunkte', async () => {
    antworte({ index: { version: 1, modelle: {}, regal: REGAL } })
    const { einrichtung } = await szene()
    const daten = await einrichtung
    expect(daten?.belegung.slots).toEqual(BELEGUNG.raeume.laden.slots)
    expect(daten?.belegung.leer).toEqual(['theke/vitrine/ebene-1/platz-02'])
    expect(daten?.belegung.plaetze).toEqual(BELEGUNG.raeume.laden.plaetze)
    expect(daten?.regal).toEqual({
      url: '/produkte-3d/_regal.glb',
      modelle: REGAL.modelle,
    })
    expect(daten?.blickpunkte).toBe(raeume[0].blickpunkte)
  })

  it('ohne Regal-Modelle (so baut der Deploy): die Belegung, aber kein Paket - der Laden zeigt die Ware seines Modells', async () => {
    antworte()
    const daten = await (await szene()).einrichtung
    expect(daten?.regal).toBeUndefined()
    expect(daten?.belegung.slots).toHaveLength(1)
    // Es wird auch nichts nachgeladen.
    expect(fetchMock.mock.calls.map((c) => c[0])).not.toContain(
      '/produkte-3d/_regal.glb'
    )
  })

  it('sind die Produktdaten nicht ladbar, bleibt der Raum, wie er im Modell ist', async () => {
    antworte({ belegungFehlt: true })
    await expect((await szene()).einrichtung).resolves.toBeNull()
  })

  it('die Szene bekommt dasselbe Versprechen, solange der Raum derselbe bleibt', async () => {
    antworte()
    const { einrichtung } = await szene()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'fertig' }))
    await screen.findByTestId('ohne-webgl')
    expect(gesehen).toHaveLength(1)
    expect(gesehen[0].einrichtung).toBe(einrichtung)
  })

  it('im normalen Build gibt es den Einrichten-Modus nicht: kein Werkzeug, keine Belegung von außen, ein Tipp öffnet die Karte', async () => {
    antworte()
    const user = userEvent.setup()
    const { belegung } = await szene()
    expect(belegung).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    await screen.findByTestId('ohne-webgl')
    expect(screen.queryByTestId('einrichten-leiste')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'tipp' }))
    await waitFor(() =>
      expect(screen.getByTestId('produkt-sheet')).toHaveTextContent(
        TESTBROT.name
      )
    )
    // Die Dateien des Werkzeugs werden nie angefragt.
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes('einrichtung.'))
    ).toBe(false)
  })

  it('die Liste folgt der Belegung: Der leere Platz steht nicht darin', async () => {
    antworte()
    const user = userEvent.setup()
    await szene()
    await user.click(screen.getByRole('button', { name: 'fertig' }))
    const liste = await screen.findByTestId('ohne-webgl')
    expect(liste).toHaveTextContent(TESTBROT.name)
  })
})
