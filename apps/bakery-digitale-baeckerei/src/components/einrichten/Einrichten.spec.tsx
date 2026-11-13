import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { raeume } from '../../config/raeume'
import type {
  Belegung,
  BelegungDatei,
  Platz,
  ProduktSnapshot,
} from '../../lib/produkte/types'
import { EINRICHTEN_SPUR as SPUR_IM_WAECHTER } from '../../../scripts/export-pruefung'
import ThemeRegistry from '../ThemeRegistry'
import Einrichten, {
  EINRICHTEN_SPUR,
  ENTWURF_HINWEIS,
  HQ_FEHLER_TEXT,
  MIT_REGAL_TEXT,
  OHNE_REGAL_TEXT,
  ZIEL_IN_HQ,
} from './Einrichten'

// Erfundene Plätze und Produkte - nie echte Daten.
const PLATZ: Platz = {
  o: [0, 1, 0],
  r: [1, 0, 0],
  n: [0, 1, 0],
  f: [0, 0, 1],
  b: 0.45,
  t: 0.12,
  h: 0.2,
  art: 'reihen',
  neigung: 0,
}
const produkt = (id: string, name: string) => ({
  id,
  name,
  kategorie: 'brot',
  kurztext: 'Nur ein Test.',
  text: '',
})
const SNAPSHOT: ProduktSnapshot = {
  version: 1,
  erstellt: '2026-01-01T00:00:00.000Z',
  produkte: {
    testbrot: produkt('testbrot', 'Testbrot'),
    testkuchen: produkt('testkuchen', 'Testkuchen'),
    testweck: produkt('testweck', 'Testweck'),
  },
}
const MODELL: BelegungDatei = {
  version: 3,
  raeume: {
    laden: {
      quelle: { commit: 'x' },
      slots: [
        { slot: 'theke/platz-01', produkt: 'testkuchen', anzahl: 3 },
        { slot: 'theke/platz-02', produkt: 'testweck', anzahl: 6 },
      ],
    },
  },
}
const GEBAUT: BelegungDatei = {
  version: 3,
  raeume: {
    laden: {
      quelle: { commit: 'x' },
      slots: [{ slot: 'theke/platz-01', produkt: 'testkuchen', anzahl: 3 }],
      leer: ['theke/platz-02'],
      plaetze: {
        'theke/platz-01': PLATZ,
        'theke/platz-02': PLATZ,
        'theke/platz-03': PLATZ,
      },
    },
  },
}
const QUELLE = `# von Hand
raeume:
  laden:
    theke/platz-02: leer # montags
`
const REGAL = {
  testbrot: {
    bbox_m: { min: [-0.1, 0, -0.05], max: [0.1, 0.075, 0.05] },
    dreiecke: 14,
  },
}
const LADEN = raeume[0]

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith('einrichtung.quelle.yaml')
      ? { ok: true, text: async () => QUELLE }
      : { ok: true, json: async () => MODELL }
  )
  global.fetch = fetchMock as unknown as typeof fetch
})

function Huelle({
  start = null,
  onEntwurf,
}: {
  start?: string | null
  onEntwurf: (b: Record<string, Belegung>) => void
}) {
  const [platz, setPlatz] = React.useState<string | null>(start)
  return (
    <ThemeRegistry>
      <Einrichten
        basePath="/digitale-baeckerei"
        raum={LADEN}
        gebaut={GEBAUT}
        snapshot={SNAPSHOT}
        regal={REGAL}
        platz={platz}
        onPlatz={setPlatz}
        onEntwurf={onEntwurf}
      />
    </ThemeRegistry>
  )
}

async function setup(start: string | null = null) {
  const user = userEvent.setup()
  const onEntwurf = jest.fn()
  render(<Huelle start={start} onEntwurf={onEntwurf} />)
  // Der Entwurf steht, sobald die beiden Dateien geladen sind.
  await waitFor(() => expect(onEntwurf).toHaveBeenCalled())
  const letzter = (): Record<string, Belegung> => onEntwurf.mock.calls.at(-1)[0]
  const yaml = async () => {
    await user.click(screen.getByTestId('einrichten-aenderungen'))
    const dialog = await screen.findByTestId('einrichten-dialog')
    return {
      dialog,
      text: (
        within(dialog).getByTestId('einrichten-yaml') as HTMLTextAreaElement
      ).value,
    }
  }
  return { user, onEntwurf, letzter, yaml }
}

describe('Einrichten-Modus', () => {
  it('lädt die Einrichtung aus hq und die Belegung der Modelle unter dem Basis-Pfad', async () => {
    await setup()
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      '/digitale-baeckerei/data/einrichtung.modell.json',
      '/digitale-baeckerei/data/einrichtung.quelle.yaml',
    ])
  })

  it('ohne Änderung: null Änderungen, und die Datei kommt Zeichen für Zeichen heraus', async () => {
    const { letzter, yaml } = await setup()
    expect(screen.getByTestId('einrichten-aenderungen')).toHaveTextContent(
      'Änderungen (0)'
    )
    expect(letzter().laden.leer).toEqual(['theke/platz-02'])
    const { dialog, text } = await yaml()
    expect(text).toBe(QUELLE)
    expect(dialog).toHaveTextContent('Noch nichts geändert')
    expect(dialog).toHaveTextContent(ZIEL_IN_HQ)
    expect(dialog).toHaveTextContent(ENTWURF_HINWEIS)
  })

  it('Platz aus der Liste wählen, Produkt suchen und setzen: Szene, Liste der Änderungen und Datei folgen', async () => {
    const { user, letzter, yaml } = await setup()
    await user.click(screen.getByRole('button', { name: 'Plätze' }))
    await user.click(screen.getByTestId('einrichten-waehle-theke/platz-03'))
    const platz = await screen.findByTestId('einrichten-platz')
    expect(platz).toHaveTextContent('Theke · Platz 3')
    expect(screen.getByTestId('einrichten-inhalt')).toHaveTextContent(
      'Ware aus dem Modell'
    )

    await user.type(screen.getByTestId('einrichten-suche'), 'brot')
    // Die Suche filtert; die Zeile sagt, ob es ein Regal-Modell gibt.
    expect(screen.queryByTestId('einrichten-produkt-testkuchen')).toBeNull()
    const zeile = screen.getByTestId('einrichten-produkt-testbrot')
    expect(zeile).toHaveTextContent(MIT_REGAL_TEXT)
    await user.click(zeile)
    await user.click(screen.getByTestId('einrichten-mehr'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('2')
    expect(screen.getByTestId('einrichten-inhalt')).toHaveTextContent(
      '2 × Testbrot'
    )

    await waitFor(() =>
      expect(letzter().laden.slots.at(-1)).toEqual({
        slot: 'theke/platz-03',
        produkt: 'testbrot',
        anzahl: 2,
        quelle: 'einrichtung',
      })
    )
    expect(screen.getByTestId('einrichten-aenderungen')).toHaveTextContent(
      'Änderungen (1)'
    )
    const { dialog, text } = await yaml()
    expect(text).toContain('# von Hand')
    expect(text).toContain('theke/platz-02: leer # montags')
    expect(text).toContain(
      '    theke/platz-03:\n      produkt: testbrot\n      anzahl: 2\n'
    )
    expect(within(dialog).getByTestId('einrichten-liste')).toHaveTextContent(
      'Theke · Platz 3wie im Modell → 2 × Testbrot'
    )
  })

  it('ein neu gewähltes Produkt erbt keine Stückzahl, die nicht passt: Sie wird angepasst, und das Werkzeug sagt es', async () => {
    const { user, letzter } = await setup('theke/platz-01')
    // Dort liegen 3 Testkuchen. Platz 0,45 m breit: zwei Testbrote (0,20 m)
    // passen, drei nicht.
    await user.click(screen.getByTestId('einrichten-produkt-testbrot'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('2')
    expect(screen.getByTestId('einrichten-angepasst')).toHaveTextContent(
      'Auf diesen Platz passen nur 2 Stück – die Stückzahl ist angepasst (vorher 3).'
    )
    expect(screen.queryByTestId('einrichten-hinweis')).toBeNull()
    await waitFor(() =>
      expect(letzter().laden.slots[0]).toMatchObject({
        produkt: 'testbrot',
        anzahl: 2,
      })
    )
    // Die nächste Änderung räumt den Satz weg.
    await user.click(screen.getByTestId('einrichten-weniger'))
    expect(screen.queryByTestId('einrichten-angepasst')).toBeNull()
  })

  it('ein Produkt ohne Regal-Modell behält die Stückzahl (dort gibt es nichts zu messen)', async () => {
    const { user } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-produkt-testweck'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('3')
    expect(screen.queryByTestId('einrichten-angepasst')).toBeNull()
  })

  it('die Stückzahl bleibt im gültigen Bereich: „+“ endet bei 500, „−“ bei 1 - der Entwurf geht dabei nie verloren', async () => {
    // In hq steht schon die größte erlaubte Stückzahl.
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('einrichtung.quelle.yaml')
        ? {
            ok: true,
            text: async () =>
              'raeume:\n  laden:\n    theke/platz-03:\n      produkt: testweck\n      anzahl: 500\n',
          }
        : { ok: true, json: async () => MODELL }
    )
    const { user, letzter, yaml } = await setup('theke/platz-03')
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('500')
    expect(screen.getByTestId('einrichten-mehr')).toBeDisabled()
    await user.click(screen.getByTestId('einrichten-weniger'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('499')
    await user.click(screen.getByTestId('einrichten-mehr'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('500')
    expect(screen.getByTestId('einrichten-mehr')).toBeDisabled()
    // Das Werkzeug lebt: Entwurf, Liste und Datei sind da.
    expect(letzter().laden.slots.at(-1)).toMatchObject({ anzahl: 500 })
    expect(screen.queryByTestId('einrichten-platz-fehler')).toBeNull()
    expect((await yaml()).text).toContain('anzahl: 500')
  })

  it('am unteren Ende: „−“ ist bei 1 aus', async () => {
    const { user } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-weniger'))
    await user.click(screen.getByTestId('einrichten-weniger'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('1')
    expect(screen.getByTestId('einrichten-weniger')).toBeDisabled()
  })

  it('eine Einrichtung aus hq, die nicht zum Modell passt, wird gemeldet statt verschwiegen', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('einrichtung.quelle.yaml')
        ? {
            ok: true,
            text: async () => 'raeume:\n  laden:\n    theke/platz-77: leer\n',
          }
        : { ok: true, json: async () => MODELL }
    )
    render(<Huelle onEntwurf={jest.fn()} />)
    const meldung = await screen.findByTestId('einrichten-hq-fehler')
    expect(meldung).toHaveTextContent(HQ_FEHLER_TEXT)
    expect(meldung).toHaveTextContent(
      'den Platz "theke/platz-77" gibt es im Modell nicht'
    )
  })

  it('sagt, wenn die Stückzahl nicht passt oder das Produkt kein Regal-Modell hat', async () => {
    const { user } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-produkt-testbrot'))
    // Zwei passen (so viele hat das Werkzeug gesetzt); wer mehr will, liest den Hinweis.
    await user.click(screen.getByTestId('einrichten-mehr'))
    expect(screen.getByTestId('einrichten-anzahl')).toHaveTextContent('3')
    expect(screen.getByTestId('einrichten-hinweis')).toHaveTextContent(
      'Hinweis: nur 2 von 3 passen.'
    )
    await user.click(screen.getByTestId('einrichten-weniger'))
    expect(screen.queryByTestId('einrichten-hinweis')).toBeNull()

    const ohne = screen.getByTestId('einrichten-produkt-testweck')
    expect(ohne).toHaveTextContent(OHNE_REGAL_TEXT)
    await user.click(ohne)
    expect(screen.getByTestId('einrichten-hinweis')).toHaveTextContent(
      /kein Regal-Modell/
    )
  })

  it('„Leer“ leert den Platz, „Wie im Modell“ nimmt ihn aus der Datei', async () => {
    const { user, letzter, yaml } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-leer'))
    await waitFor(() =>
      expect(letzter().laden.leer).toEqual(['theke/platz-01', 'theke/platz-02'])
    )
    expect(screen.getByTestId('einrichten-inhalt')).toHaveTextContent('leer')
    // Ein leerer Platz hat keine Stückzahl.
    expect(screen.getByTestId('einrichten-mehr')).toBeDisabled()

    await user.click(screen.getByTestId('einrichten-modell'))
    await waitFor(() =>
      expect(letzter().laden.leer).toEqual(['theke/platz-02'])
    )
    expect(screen.getByTestId('einrichten-inhalt')).toHaveTextContent(
      '3 × Testkuchen'
    )
    // Wieder wie geladen: keine Änderung, dieselbe Datei.
    expect((await yaml()).text).toBe(QUELLE)
  })

  it('„Zurücknehmen“ nimmt eine Änderung aus dem Entwurf', async () => {
    const { user, yaml } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-leer'))
    await user.click(screen.getByRole('button', { name: 'Platz schließen' }))
    const { dialog } = await yaml()
    await user.click(
      within(dialog).getByRole('button', { name: 'Zurücknehmen' })
    )
    expect(dialog).toHaveTextContent('Noch nichts geändert')
    expect(
      (within(dialog).getByTestId('einrichten-yaml') as HTMLTextAreaElement)
        .value
    ).toBe(QUELLE)
  })

  it('eine geladene Datei ersetzt den Stand; eine mit unbekanntem Platz wird mit Meldung abgelehnt', async () => {
    const { user, letzter, yaml } = await setup()
    const { dialog } = await yaml()
    const eingabe = within(dialog).getByTestId('einrichten-datei')
    const datei = (text: string) =>
      new File([text], 'einrichtung.yaml', { type: 'text/yaml' })

    await user.upload(
      eingabe as HTMLInputElement,
      datei('raeume:\n  laden:\n    theke/platz-99: leer\n')
    )
    expect(await screen.findByTestId('einrichten-fehler')).toHaveTextContent(
      'den Platz "theke/platz-99" gibt es im Modell nicht'
    )
    expect(letzter().laden.leer).toEqual(['theke/platz-02'])

    const neu = 'raeume:\n  laden:\n    theke/platz-01: leer\n'
    await user.upload(eingabe as HTMLInputElement, datei(neu))
    await waitFor(() =>
      expect(letzter().laden.leer).toEqual(['theke/platz-01'])
    )
    expect(screen.queryByTestId('einrichten-fehler')).toBeNull()
    // Rundlauf: laden und ohne Änderung ausgeben ergibt dieselbe Datei.
    expect(
      (within(dialog).getByTestId('einrichten-yaml') as HTMLTextAreaElement)
        .value
    ).toBe(neu)
  })

  it('„kopieren“ legt die Datei in die Zwischenablage', async () => {
    const { user, yaml } = await setup()
    const { dialog } = await yaml()
    await user.click(within(dialog).getByTestId('einrichten-kopieren'))
    expect(await window.navigator.clipboard.readText()).toBe(QUELLE)
    expect(within(dialog).getByTestId('einrichten-kopieren')).toHaveTextContent(
      'Kopiert'
    )
  })

  it('„herunterladen“ gibt die Datei als einrichtung.yaml aus', async () => {
    const { user, yaml } = await setup()
    const { dialog } = await yaml()
    const blobs: Blob[] = []
    const createObjectURL = jest.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:test'
    })
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() })
    let name = ''
    const klick = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        name = this.download
      })
    await user.click(within(dialog).getByTestId('einrichten-herunterladen'))
    expect(name).toBe('einrichtung.yaml')
    expect(blobs[0].size).toBe(new Blob([QUELLE]).size)
    klick.mockRestore()
  })

  it('ohne Datei in hq beginnt der Entwurf leer', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('einrichtung.quelle.yaml')
        ? { ok: false, status: 404 }
        : { ok: true, json: async () => MODELL }
    )
    const { yaml } = await setup()
    expect((await yaml()).text).toBe('')
  })

  it('der Wächter des Exports erkennt das Werkzeug an seinem Knopf', async () => {
    expect(EINRICHTEN_SPUR).toBe(SPUR_IM_WAECHTER)
    const { yaml } = await setup()
    const { dialog } = await yaml()
    expect(
      within(dialog).getByRole('button', { name: EINRICHTEN_SPUR })
    ).toBeInTheDocument()
  })

  it('speichert nichts auf dem Gerät', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    const { user } = await setup('theke/platz-01')
    await user.click(screen.getByTestId('einrichten-leer'))
    expect(setItem).not.toHaveBeenCalled()
    expect(document.cookie).toBe('')
    setItem.mockRestore()
  })
})
