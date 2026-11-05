import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import BackzettelDayClient from './BackzettelDayClient'
import { fakeSession, WithSession } from '../../../../lib/testing/fakeSession'
import * as api from '../../../../lib/backzettelApi'
import {
  CONFIG_RESPONSE,
  SAT,
  saturdayConfirmed,
  saturdayDraft,
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

/** Die Tabelle (ab md) - die Kartenliste steht parallel im DOM. */
function table(sectionId: string) {
  return within(screen.getByTestId(`table-${sectionId}`))
}

describe('Backzettel-Tagesplanung', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayDraft())
  })

  it('zeigt Abschnitte in Reihenfolge mit allen Spalten und Sorten', async () => {
    renderDay()
    expect(await screen.findByTestId('section-brot')).toBeInTheDocument()
    const ids = screen
      .getAllByTestId(/^section-/)
      .map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual([
      'section-brot',
      'section-broetchen',
      'section-hefeteig',
    ])

    const head = table('broetchen').getAllByRole('columnheader')
    expect(head.map((h) => h.textContent)).toEqual([
      'Posten',
      'Basis',
      'Saison',
      'Vorbestellt',
      'CAP',
      'Korrektur',
      'Gesamt',
    ])
    const weck = within(screen.getByTestId('line-row-test-weck|'))
    expect(weck.getByText('65')).toBeInTheDocument()
    expect(weck.getByText('−5')).toBeInTheDocument()
    expect(weck.getByText(/Testgrund/)).toBeInTheDocument()
    // Sorte mit Füllungsnamen, Liter mit Komma und Laib-Schätzung
    expect(
      table('hefeteig').getByText('Testzopf gefüllt – Testnussfüllung')
    ).toBeInTheDocument()
    expect(table('brot').getByText('2,25 l')).toBeInTheDocument()
    expect(table('brot').getByText(/≈ 5 Laibe/)).toBeInTheDocument()
    // offene Grundmenge ist kein 0
    const mohn = within(screen.getByTestId('line-row-test-zopf|mohn'))
    expect(mohn.getByText('offen')).toBeInTheDocument()
    expect(screen.getByTestId('warnings')).toHaveTextContent(
      'Grundmenge für Samstag noch nicht festgelegt'
    )
  })

  it('Samstag: Hefeteig & Füllungen mit Teig, Chargen, Abwiegeliste und Rezept', async () => {
    renderDay()
    const card = within(await screen.findByTestId('hefeteig-card'))
    expect(card.getByText('Hefeteig & Füllungen')).toBeInTheDocument()
    const dough = within(card.getByTestId('dough-test-hefeteig'))
    expect(dough.getByText('3 kg')).toBeInTheDocument()
    expect(dough.getByText('1 Charge à max. 10 kg')).toBeInTheDocument()
    expect(dough.getByText('500 g')).toBeInTheDocument()
    const filling = within(card.getByTestId('filling-nuss'))
    expect(filling.getByText('2,4 kg')).toBeInTheDocument()
    expect(filling.getByText('Testnüsse')).toBeInTheDocument()
    expect(filling.getAllByText('1,2 kg')).toHaveLength(2)
    expect(screen.getByTestId('prep-card')).toHaveTextContent(
      'Testsauerteig (misch)'
    )
  })

  it('Korrektur ≠ 0 verlangt einen Grund und speichert mit Sorte', async () => {
    mocked.setCorrection.mockResolvedValue(saturdayDraft())
    renderDay()
    await screen.findByTestId('section-hefeteig')
    fireEvent.click(
      table('hefeteig').getByRole('button', {
        name: 'Korrektur Testzopf gefüllt – Testnussfüllung bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId('table-correction-editor-test-zopf|nuss')
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '3' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(
      await editor.findByText('Für eine Korrektur ist ein Grund nötig.')
    ).toBeInTheDocument()
    expect(mocked.setCorrection).not.toHaveBeenCalled()

    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testmarkt' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(mocked.setCorrection).toHaveBeenCalledWith(
        SAT,
        'test-zopf',
        'nuss',
        3,
        'Testmarkt'
      )
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId('table-correction-editor-test-zopf|nuss')
      ).not.toBeInTheDocument()
    )
  })

  it('zeigt Fehler der API in der Zeile (deutsche message)', async () => {
    mocked.setCorrection.mockRejectedValue(
      new Error('Korrekturen in Stück müssen ganze Zahlen sein.')
    )
    renderDay()
    await screen.findByTestId('section-broetchen')
    fireEvent.click(
      table('broetchen').getByRole('button', {
        name: 'Korrektur Testweck bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId('table-correction-editor-test-weck|')
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '0' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(
      await editor.findByText('Korrekturen in Stück müssen ganze Zahlen sein.')
    ).toBeInTheDocument()
    expect(mocked.setCorrection).toHaveBeenCalledWith(
      SAT,
      'test-weck',
      null,
      0,
      null
    )
  })

  it('Saisonfaktor nur im Entwurf, mit Komma', async () => {
    mocked.setSeasonFactor.mockResolvedValue(
      saturdayDraft({ seasonFactor: 1.2 })
    )
    renderDay()
    const input = await screen.findByLabelText('Saisonfaktor')
    expect(input).toHaveValue('1,0')
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))
    expect(
      await screen.findByText(/größer 0 und höchstens 5/)
    ).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '1,2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))
    await waitFor(() =>
      expect(mocked.setSeasonFactor).toHaveBeenCalledWith(SAT, 1.2)
    )
  })

  it('Freigeben fragt nach (mit Hinweis auf offene Grundmengen) und friert ein', async () => {
    mocked.confirmDay.mockResolvedValue(saturdayConfirmed())
    renderDay('backstube')
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/Es gibt 1 Hinweis/)).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Jetzt freigeben' }))
    await waitFor(() => expect(mocked.confirmDay).toHaveBeenCalledWith(SAT))
    expect(
      await within(screen.getByTestId('bz-screen')).findByText(
        /Freigegeben von Test Backstube/
      )
    ).toBeInTheDocument()
    // freigegeben: keine Korrektur, kein Saisonfeld, Backstube kann nicht öffnen
    expect(
      screen.queryByRole('button', { name: /Korrektur .* bearbeiten/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Saisonfaktor')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Wieder öffnen' })
    ).not.toBeInTheDocument()
  })

  it('Nachträge nach der Freigabe: hervorgehoben und quittierbar', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    mocked.acknowledgeDelta.mockResolvedValue(
      saturdayConfirmed().deltas[0] as api.BackzettelDeltaEntry
    )
    renderDay('backstube')
    const card = within(await screen.findByTestId('deltas-card'))
    expect(card.getByText('1 offen')).toBeInTheDocument()
    expect(card.getByText(/LA-2026-11-28-03/)).toBeInTheDocument()
    expect(
      card.getByText(/quittiert .* von Test Backstube/)
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('line-row-test-zopf|nuss')).getByTestId(
        'delta-chip-test-zopf|nuss'
      )
    ).toHaveTextContent('Nachtrag +2')
    fireEvent.click(card.getByRole('button', { name: 'Gesehen' }))
    await waitFor(() =>
      expect(mocked.acknowledgeDelta).toHaveBeenCalledWith(SAT, 7)
    )
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
  })

  it('Wieder öffnen nur für den Inhaber, mit optionalem Grund', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    mocked.reopenDay.mockResolvedValue(saturdayDraft())
    renderDay('inhaber')
    fireEvent.click(
      await screen.findByRole('button', { name: 'Wieder öffnen' })
    )
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Grund (optional)'), {
      target: { value: 'Testgrund' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Wieder öffnen' }))
    await waitFor(() =>
      expect(mocked.reopenDay).toHaveBeenCalledWith(SAT, 'Testgrund')
    )
    expect(
      await screen.findByRole('button', { name: 'Freigeben' })
    ).toBeInTheDocument()
  })

  it('Verkauf sieht den Zettel nur', async () => {
    renderDay('verkauf')
    expect(await screen.findByTestId('read-only')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Freigeben' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Korrektur .* bearbeiten/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Saisonfaktor')).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('bz-screen')).getByText(/Saisonfaktor/)
    ).toBeInTheDocument()
  })

  it('Stammdaten geändert und vorläufiger Vorbereitungstag werden angesagt', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(
      saturdayConfirmed({
        configChangedSinceConfirm: true,
        prepDateProvisional: true,
      })
    )
    renderDay()
    expect(await screen.findByTestId('config-changed')).toBeInTheDocument()
    expect(screen.getByTestId('prep-provisional')).toHaveTextContent(
      'ist Ruhetag'
    )
  })

  it('ohne Stammdaten: Erklärung, keine Zahlen, kein Drucken', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue({
      date: SAT,
      status: 'no-config',
      reasons: [
        { path: '', message: 'Die Backzettel-Stammdaten fehlen in hq.' },
      ],
    })
    renderDay()
    const alert = await screen.findByTestId('no-config')
    expect(alert).toHaveTextContent('keine geschätzten Zahlen')
    expect(alert).toHaveTextContent('Die Backzettel-Stammdaten fehlen in hq.')
    expect(screen.queryByTestId(/^section-/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Drucken' })
    ).not.toBeInTheDocument()
  })

  it('Ruhetag: Erklärung und Weg zum nächsten Produktionstag', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue({
      date: '2026-11-23',
      status: 'ruhetag',
      weekday: null,
      message: 'Montag ist Ruhetag - an diesem Tag gibt es keinen Backzettel.',
    })
    renderDay('backstube', '2026-11-23')
    const alert = await screen.findByTestId('ruhetag')
    expect(alert).toHaveTextContent('Montag ist Ruhetag')
    expect(
      within(alert).getByRole('link', { name: 'Zum Di 24.11.' })
    ).toHaveAttribute('href', '/admin/backzettel/2026-11-24')
  })

  it('ungültiges Datum fragt die API gar nicht', async () => {
    renderDay('backstube', '2026-02-30')
    expect(await screen.findByText(/kein gültiges Datum/)).toBeInTheDocument()
    expect(mocked.fetchBackzettelDay).not.toHaveBeenCalled()
  })

  describe('Druck (Z7)', () => {
    it('Seite 1 Backzettel, Seite 2 Hefeteig, Seite 3 Vorbereitung', async () => {
      const print = jest.fn()
      Object.defineProperty(window, 'print', { value: print, writable: true })
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      const p1 = within(sheet.getByTestId('print-page-1'))
      expect(p1.getByText('Backzettel Samstag, 28.11.2026')).toBeInTheDocument()
      expect(
        p1.getByText('ENTWURF – noch nicht freigegeben')
      ).toBeInTheDocument()
      expect(
        p1.getByText('Testzopf gefüllt – Testnussfüllung')
      ).toBeInTheDocument()
      const p2 = within(sheet.getByTestId('print-page-2'))
      expect(p2.getByText('Abwiegeliste')).toBeInTheDocument()
      expect(p2.getByText('Testnussfüllung: 2,4 kg')).toBeInTheDocument()
      const p3 = within(sheet.getByTestId('print-page-3'))
      expect(p3.getByText('Testsauerteig (misch)')).toBeInTheDocument()
      expect(sheet.getByTestId('print-page-2')).toHaveClass('bz-break')

      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }))
      expect(print).toHaveBeenCalled()
    })

    it('ohne Hefeteig und Vorbereitung nur eine Seite', async () => {
      mocked.fetchBackzettelDay.mockResolvedValue(
        saturdayConfirmed({
          hefeteig: { doughs: [], pieces: 0, dough_g: 0 },
          fillings: [],
          prep: [],
        })
      )
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      expect(sheet.getByTestId('print-page-1')).toBeInTheDocument()
      expect(sheet.queryByTestId('print-page-2')).not.toBeInTheDocument()
      expect(sheet.queryByTestId('print-page-3')).not.toBeInTheDocument()
      expect(
        sheet.getByText(/Freigegeben von Test Backstube/)
      ).toBeInTheDocument()
      expect(
        sheet.getByText(
          'Nachträge seit der Freigabe (nicht in den Mengen oben)'
        )
      ).toBeInTheDocument()
    })
  })
})
