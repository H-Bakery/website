import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import BackzettelDayClient, { PRINT_EXTRAS_KEY } from './BackzettelDayClient'
import { fakeSession, WithSession } from '../../../../lib/testing/fakeSession'
import * as api from '../../../../lib/backzettelApi'
import {
  CONFIG_RESPONSE,
  CONFIG_RESPONSE_V2,
  SAT,
  SUN,
  V2_TUE,
  saturdayDraft,
  saturdayV2Confirmed,
  v2DeltaDough,
  saturdayV2Draft,
  sundayV2Sheet,
} from '../../../../lib/backzettelFixtures'
import type { PilotRole } from '../../../../lib/roles'

jest.mock('../../../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBackzettelDay: jest.fn(),
    setSeasonFactor: jest.fn(),
    setCorrection: jest.fn(),
    confirmDay: jest.fn(),
    reopenDay: jest.fn(),
    acknowledgeDelta: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

function renderDay(role: PilotRole = 'backstube', date = SAT) {
  return render(
    <WithSession value={fakeSession({ role })}>
      <BackzettelDayClient date={date} />
    </WithSession>
  )
}

const DOPPEL_TUE = `test-doppel|@${V2_TUE}`

describe('Backzettel-Tagesplanung - Teigtag-Zettel (Z10)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE_V2)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayV2Draft())
  })

  it('zeigt Maschinen-Leiste, Brot-Tabelle und Brötchen je Backtag', async () => {
    renderDay()
    const strip = within(await screen.findByTestId('machine-strip'))
    expect(
      strip.getByTestId('machine-liters-test-korn-teig')
    ).toHaveTextContent('6 L')
    expect(strip.getByTestId('machine-kg-test-korn-teig')).toHaveTextContent(
      '11,4 kg'
    )
    expect(strip.getByText('Testsauer 20 g')).toBeInTheDocument()
    expect(
      strip.getByTestId('machine-liters-test-weck-teig')
    ).toHaveTextContent('5,5 L')
    expect(screen.getByTestId('doughs-today')).toHaveTextContent(
      'Teige heute: Korn + Holz · Testweck für So + Di'
    )

    const bread = within(screen.getByTestId('bread-table'))
    expect(
      bread.getAllByRole('columnheader').map((h) => h.textContent)
    ).toEqual(['Brot', '500 g', '1 kg', 'Kasten', 'Teig'])
    expect(bread.getByTestId('bread-cell-test-korn|g500')).toHaveTextContent(
      '8'
    )
    expect(bread.getByTestId('bread-cell-test-korn|g1000')).toHaveTextContent(
      '3'
    )
    expect(bread.getByTestId('bread-kg-test-korn')).toHaveTextContent('7,8 kg')
    // offene Grundmenge bleibt „offen“
    expect(
      within(bread.getByTestId('bread-row-test-korn')).getByText('offen')
    ).toBeInTheDocument()

    // Handy (unter md): je Brot eine Karte mit allen Größen und kg - keine
    // Spalte fällt seitlich aus dem Bild (Review Z10 Runde 2)
    const card = within(screen.getByTestId('bread-card-test-korn'))
    expect(card.getByText('500 g')).toBeInTheDocument()
    expect(card.getByText('Kasten')).toBeInTheDocument()
    expect(
      card.getByTestId('bread-card-cell-test-korn|g1000')
    ).toHaveTextContent('3')
    expect(
      card.getByTestId('bread-card-cell-test-korn|kasten')
    ).toHaveTextContent('offen')
    expect(card.getByText('Teig 7,8 kg')).toBeInTheDocument()

    const sunday = within(screen.getByTestId(`rolls-${SUN}`))
    // je Brötchen-Zeile die Zusammensetzung wie am Tablet
    expect(
      sunday.getByTestId(`roll-breakdown-test-doppel|@${SUN}`)
    ).toHaveTextContent('Basis 60 · CAP 6')
    expect(sunday.getByText(/Brötchen für Sonntag, 29\.11\./)).toBeVisible()
    expect(sunday.getByText('Teig heute')).toBeInTheDocument()
    expect(
      sunday.getByTestId(`bruch-text-${SUN}|test-doppel`)
    ).toHaveTextContent('7 Bruch × 1.250 g – 66 Testdoppel · +4 frei')
    expect(
      sunday.getByTestId(`bruch-text-${SUN}|test-gemischt`)
    ).toHaveTextContent('12 Teststern, 8 Testkäse')
    const tuesday = within(screen.getByTestId(`rolls-${V2_TUE}`))
    expect(tuesday.getByTestId(`roll-total-${DOPPEL_TUE}`)).toHaveTextContent(
      '44'
    )

    // Was weder Brot noch Brötchen ist, steht weiter als Abschnitt da.
    expect(screen.getByTestId('section-kaffeestueckchen')).toBeInTheDocument()
    expect(screen.queryByTestId('section-brot')).not.toBeInTheDocument()
    // Backliste ist verlinkt
    expect(screen.getByRole('link', { name: /Backliste/ })).toHaveAttribute(
      'href',
      `/admin/backzettel/${SAT}/backen`
    )
  })

  it('zeigt Unbekanntes als „unbekannt“ bzw. „–“ mit Grund, nie geschätzt', async () => {
    renderDay()
    const flit = within(await screen.findByTestId('machine-test-flit-teig'))
    expect(flit.getByTestId('machine-liters-test-flit-teig')).toHaveTextContent(
      'unbekannt'
    )
    expect(flit.getByTestId('machine-kg-test-flit-teig')).toHaveTextContent(
      '≥ 3 kg'
    )
    expect(flit.getByTestId('machine-hints-test-flit-teig')).toHaveTextContent(
      'Liter: unbekannt (Teig unvollständig – ein Gewicht fehlt)'
    )
    expect(flit.getByText('Chargen: unbekannt')).toBeInTheDocument()
    expect(screen.getByTestId('machine-test-flit-teig')).toHaveAttribute(
      'data-complete',
      'false'
    )

    const tuesday = within(screen.getByTestId(`rolls-${V2_TUE}`))
    expect(
      tuesday.getByTestId(`bruch-text-${V2_TUE}|test-flitweck`)
    ).toHaveTextContent('? g (Bruchgewicht offen)')
    expect(tuesday.getByText('Teig: – kg')).toBeInTheDocument()
    expect(
      tuesday.getByText(
        '„Testflitweck“: Bruchgewicht für Dienstag ist noch offen.'
      )
    ).toBeInTheDocument()
    expect(
      within(tuesday.getByTestId(`roll-line-test-party|@${V2_TUE}`)).getByText(
        /Teigstücke je Stück offen/
      )
    ).toBeInTheDocument()

    // Offene Stammdaten aufklappbar
    const open = within(screen.getByTestId('open-master-data'))
    fireEvent.click(
      open.getByRole('button', { name: /Offene Stammdaten \(3\)/ })
    )
    expect(
      open.getByText(/kg je Liter ist noch offen – der Zettel zeigt nur kg/)
    ).toBeInTheDocument()
  })

  it('Korrektur einer Brötchen-Zeile für Dienstag schickt den Backtag mit', async () => {
    mocked.setCorrection.mockResolvedValue(saturdayV2Draft())
    renderDay()
    const tuesday = within(await screen.findByTestId(`rolls-${V2_TUE}`))
    fireEvent.click(
      tuesday.getByRole('button', {
        name: 'Korrektur Testdoppel · für Di 01.12. bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId(`rolls-correction-editor-${DOPPEL_TUE}`)
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '4' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testmarkt' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(mocked.setCorrection).toHaveBeenCalledWith(
        SAT,
        'test-doppel',
        null,
        4,
        'Testmarkt',
        { correction: 0, reason: null },
        { bakeDate: V2_TUE }
      )
    )
  })

  it('Korrektur am Zettel-Tag selbst bleibt ohne Backtag', async () => {
    mocked.setCorrection.mockResolvedValue(saturdayV2Draft())
    renderDay()
    const bread = within(await screen.findByTestId('bread-table'))
    fireEvent.click(
      bread.getByRole('button', {
        name: 'Korrektur Testkorn – 500 g bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId('bread-correction-editor-test-korn|g500')
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '1' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testmarkt' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(mocked.setCorrection).toHaveBeenCalledTimes(1))
    expect(mocked.setCorrection.mock.calls[0]).toHaveLength(6)
    expect(mocked.setCorrection.mock.calls[0].slice(0, 5)).toEqual([
      SAT,
      'test-korn',
      'g500',
      1,
      'Testmarkt',
    ])
  })

  it('„+1 Bruch“ öffnet die Korrektur mit einem Bruch mehr', async () => {
    renderDay()
    const sunday = within(await screen.findByTestId(`rolls-${SUN}`))
    fireEvent.click(
      sunday.getByRole('button', {
        name: 'Testdoppel · für So 29.11.: einen Bruch mehr (+10 Stück)',
      })
    )
    const editor = within(
      screen.getByTestId(`rolls-correction-editor-test-doppel|@${SUN}`)
    )
    expect(editor.getByLabelText('Korrektur')).toHaveValue('10')
    // Teststern: 20 Stück je Bruch bei 1 Teigstück - +20
    expect(
      sunday.getByRole('button', {
        name: 'Teststern · für So 29.11.: einen Bruch mehr (+20 Stück)',
      })
    ).toBeInTheDocument()
  })

  it('Zeile gehört inzwischen einem anderen Zettel: neu laden, Meldung in der Zeile', async () => {
    mocked.setCorrection.mockRejectedValue(
      Object.assign(
        new Error('Diese Zeile steht auf dem Zettel vom 29.11. - dort ändern.'),
        { status: 409, code: 'owned_elsewhere', sheetDate: SUN }
      )
    )
    renderDay()
    const tuesday = within(await screen.findByTestId(`rolls-${V2_TUE}`))
    fireEvent.click(
      tuesday.getByRole('button', {
        name: 'Korrektur Testdoppel · für Di 01.12. bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId(`rolls-correction-editor-${DOPPEL_TUE}`)
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '2' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testmarkt' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(await editor.findByText(/dort ändern/)).toBeInTheDocument()
    await waitFor(() =>
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    )
  })

  it('freigegeben: Nachtrag für Dienstag heißt „· für Di“', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayV2Confirmed())
    renderDay()
    const card = within(await screen.findByTestId('deltas-card'))
    expect(card.getByText(/Testdoppel · für Di 01\.12\./)).toBeInTheDocument()
    // freigegeben: keine Korrektur-Knöpfe
    expect(
      screen.queryByRole('button', { name: /einen Bruch mehr/ })
    ).not.toBeInTheDocument()
  })

  it('freigegeben: was Nachträge für Bruch und Teig heißen, steht unter den Nachträgen', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue({
      ...saturdayV2Confirmed(),
      ...v2DeltaDough(),
    })
    renderDay()
    const note = await screen.findByTestId('delta-dough')
    expect(note).toHaveTextContent(
      'Testdoppel für Di: +14 Teigstücke – 1 Bruch mehr (jetzt 6)'
    )
    expect(note).toHaveTextContent('Testweck: +1,25 kg Teig')
  })

  it('kein Teigtag (Sonntag): Hinweis mit Link zur Backliste', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(sundayV2Sheet())
    renderDay('backstube', SUN)
    const note = await screen.findByTestId('no-dough-day')
    expect(
      within(note).getByRole('link', { name: 'Backliste' })
    ).toHaveAttribute('href', `/admin/backzettel/${SUN}/backen`)
    expect(screen.queryByTestId('machine-strip')).not.toBeInTheDocument()
  })

  it('ein Tag von vor Z10 sieht aus wie bisher', async () => {
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
    renderDay()
    expect(await screen.findByTestId('section-brot')).toBeInTheDocument()
    expect(screen.queryByTestId('machine-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bread-table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('doughs-today')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Backliste/ })
    ).not.toBeInTheDocument()
  })

  describe('Druck (S6)', () => {
    const storage = window.localStorage as unknown as {
      getItem: jest.Mock
      setItem: jest.Mock
    }
    afterEach(() => storage.getItem.mockImplementation(() => undefined))

    it('druckt den Teigtag-Zettel auf einer Seite, Abwiegeliste nur auf Wunsch', async () => {
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      expect(sheet.getByTestId('dd-stamp')).toHaveTextContent('ENTWURF')
      expect(sheet.getByTestId('dd-machine')).toBeInTheDocument()
      expect(sheet.queryByTestId('print-page-2')).not.toBeInTheDocument()

      const box = screen.getByRole('checkbox', {
        name: 'Abwiegeliste & Rezepte mitdrucken',
      })
      expect(box).not.toBeChecked()
      fireEvent.click(box)
      expect(box).toBeChecked()
      expect(storage.setItem).toHaveBeenCalledWith(PRINT_EXTRAS_KEY, '1')
      expect(sheet.getByTestId('print-page-2')).toHaveClass('bz-break')
      expect(sheet.getByTestId('print-page-3')).toBeInTheDocument()
    })

    it('merkt sich „mitdrucken“ auf dem Gerät', async () => {
      storage.getItem.mockImplementation((key: string) =>
        key === PRINT_EXTRAS_KEY ? '1' : null
      )
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      expect(sheet.getByTestId('print-page-2')).toBeInTheDocument()
      expect(
        screen.getByRole('checkbox', {
          name: 'Abwiegeliste & Rezepte mitdrucken',
        })
      ).toBeChecked()
    })

    it('ein Tag von vor Z10 druckt wie bisher, ohne Auswahl', async () => {
      mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
      mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      expect(sheet.queryByTestId('dd-stamp')).not.toBeInTheDocument()
      expect(sheet.getByTestId('print-page-2')).toBeInTheDocument()
      expect(
        screen.queryByRole('checkbox', {
          name: 'Abwiegeliste & Rezepte mitdrucken',
        })
      ).not.toBeInTheDocument()
    })
  })
})
