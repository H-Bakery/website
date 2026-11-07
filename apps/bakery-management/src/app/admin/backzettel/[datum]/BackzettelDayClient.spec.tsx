import React from 'react'
import {
  act,
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
      'Testsauerteig (Misch)'
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
        'Testmarkt',
        expect.objectContaining({ correction: expect.any(Number) })
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
      null,
      expect.objectContaining({ correction: expect.any(Number) })
    )
  })

  it('Korrektur von einem anderen Gerät: nicht überschreiben, Editor behält die Eingabe (W4-verify r4)', async () => {
    const message =
      'Die Korrektur dieser Zeile wurde inzwischen auf +5 („Verein“) gesetzt von Test Bäcker. Deine Eingabe wurde nicht gespeichert - bitte prüfen und erneut speichern.'
    mocked.setCorrection.mockRejectedValueOnce(
      Object.assign(new Error(message), {
        status: 409,
        code: 'correction_changed',
      })
    )
    renderDay()
    await screen.findByTestId('section-broetchen')
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(1)
    fireEvent.click(
      table('broetchen').getByRole('button', {
        name: 'Korrektur Testweck bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId('table-correction-editor-test-weck|')
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '2' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testkita' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(await editor.findByText(message)).toBeInTheDocument()
    expect(mocked.setCorrection).toHaveBeenCalledWith(
      SAT,
      'test-weck',
      null,
      2,
      'Testkita',
      // der Stand, den der Editor beim Öffnen zeigte
      { correction: -5, reason: 'Testgrund' }
    )
    // neu geladen, Eingabe steht noch da
    await waitFor(() =>
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    )
    expect(
      screen.getByTestId('table-correction-editor-test-weck|')
    ).toBeInTheDocument()
    expect(editor.getByLabelText('Korrektur')).toHaveValue('2')
    expect(editor.getByLabelText('Grund')).toHaveValue('Testkita')
    expect(screen.queryByText('Korrektur gespeichert.')).not.toBeInTheDocument()
  })

  it('negative Korrektur: ±-Knopf (iOS-Ziffernblock ohne Minus) und U+2212', async () => {
    mocked.setCorrection.mockResolvedValue(saturdayDraft())
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
    const input = editor.getByLabelText('Korrektur')
    // inputMode bleibt numerisch (Ziffernblock), das Minus kommt vom Knopf
    expect(input).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(
      editor.getByRole('button', { name: 'Vorzeichen wechseln (plus/minus)' })
    )
    expect(input).toHaveValue('-3')
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testmarkt zu' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(mocked.setCorrection).toHaveBeenCalledWith(
        SAT,
        'test-weck',
        null,
        -3,
        'Testmarkt zu',
        expect.objectContaining({ correction: expect.any(Number) })
      )
    )
  })

  it('negative Korrektur mit typografischem Minus (−) im Liter-Feld', async () => {
    mocked.setCorrection.mockResolvedValue(saturdayDraft())
    renderDay()
    await screen.findByTestId('section-brot')
    fireEvent.click(
      table('brot').getByRole('button', {
        name: 'Korrektur Testkornbrot bearbeiten',
      })
    )
    const editor = within(
      screen.getByTestId('table-correction-editor-test-kornbrot|')
    )
    expect(editor.getByLabelText('Korrektur')).toHaveAttribute(
      'inputmode',
      'decimal'
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '\u22120,5' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testgrund' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(mocked.setCorrection).toHaveBeenCalledWith(
        SAT,
        'test-kornbrot',
        null,
        -0.5,
        'Testgrund',
        expect.objectContaining({ correction: expect.any(Number) })
      )
    )
  })

  it('409 confirmed (anderes Gerät hat freigegeben): Hinweis und neu laden', async () => {
    const stale = Object.assign(
      new Error('Der Backzettel ist schon freigegeben.'),
      { status: 409, code: 'confirmed' }
    )
    mocked.confirmDay.mockRejectedValue(stale)
    renderDay('backstube')
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }))
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Jetzt freigeben',
      })
    )
    expect(
      await screen.findByText(
        'Der Backzettel ist schon freigegeben. Der Backzettel wurde neu geladen.'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Freigeben' })
      ).not.toBeInTheDocument()
    )
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    expect(
      screen.queryByRole('button', { name: /Korrektur .* bearbeiten/ })
    ).not.toBeInTheDocument()
  })

  it('409 confirmed beim Korrigieren: Editor zu, neu laden', async () => {
    mocked.setCorrection.mockRejectedValue(
      Object.assign(new Error('Der Backzettel ist schon freigegeben.'), {
        status: 409,
        code: 'confirmed',
      })
    )
    renderDay()
    await screen.findByTestId('section-broetchen')
    fireEvent.click(
      table('broetchen').getByRole('button', {
        name: 'Korrektur Testweck bearbeiten',
      })
    )
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    const editor = within(
      screen.getByTestId('table-correction-editor-test-weck|')
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '0' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(
      await screen.findByText(
        /schon freigegeben\. Der Backzettel wurde neu geladen/
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByTestId('table-correction-editor-test-weck|')
      ).not.toBeInTheDocument()
    )
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
  })

  it('andere Fehler laden nicht neu', async () => {
    mocked.confirmDay.mockRejectedValue(
      Object.assign(new Error('Keine Berechtigung.'), {
        status: 403,
        code: 'forbidden',
      })
    )
    renderDay('backstube')
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Jetzt freigeben',
      })
    )
    expect(await screen.findByText('Keine Berechtigung.')).toBeInTheDocument()
    expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(1)
  })

  it('Freigabe mit anderem Stand als angezeigt: Abweichungen werden genannt', async () => {
    const confirmed = saturdayConfirmed()
    const zopf = confirmed.sections[2].lines[0]
    confirmed.sections[2].lines[0] = { ...zopf, preorders: 3, total: 7 }
    mocked.confirmDay.mockResolvedValue(confirmed)
    renderDay('backstube')
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Jetzt freigeben',
      })
    )
    const notice = await screen.findByTestId('confirm-changes')
    expect(notice).toHaveTextContent('Testzopf gefüllt – Testnussfüllung')
    expect(notice).toHaveTextContent('6 → 7')
  })

  it('Freigabe ohne Abweichung: kein Hinweis', async () => {
    mocked.confirmDay.mockResolvedValue(saturdayConfirmed())
    renderDay('backstube')
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Jetzt freigeben',
      })
    )
    await waitFor(() => expect(mocked.confirmDay).toHaveBeenCalled())
    await screen.findAllByText(/Freigegeben von Test Backstube/)
    expect(screen.queryByTestId('confirm-changes')).not.toBeInTheDocument()
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
      expect(mocked.setSeasonFactor).toHaveBeenCalledWith(
        SAT,
        1.2,
        expect.any(Number)
      )
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

  it('ein Nachtrag, den es nicht mehr gibt (404), lädt den Tag neu', async () => {
    mocked.fetchBackzettelDay.mockResolvedValue(saturdayConfirmed())
    mocked.acknowledgeDelta.mockRejectedValue(
      Object.assign(new Error('Dieser Nachtrag ist nicht mehr offen.'), {
        status: 404,
        code: 'not_found',
      })
    )
    renderDay('backstube')
    const card = within(await screen.findByTestId('deltas-card'))
    fireEvent.click(card.getByRole('button', { name: 'Gesehen' }))
    expect(
      await screen.findByText(
        'Dieser Nachtrag ist nicht mehr offen. Der Backzettel wurde neu geladen.'
      )
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    )
  })

  it('ein langsames Neuladen überschreibt eine Freigabe nicht', async () => {
    renderDay('backstube')
    await screen.findByRole('button', { name: 'Freigeben' })
    // „Aktualisieren“ läuft noch, als freigegeben wird ...
    let resolveSlow: (day: api.BackzettelDayResult) => void = () => undefined
    mocked.fetchBackzettelDay.mockImplementationOnce(
      () =>
        new Promise<api.BackzettelDayResult>((resolve) => {
          resolveSlow = resolve
        })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }))
    mocked.confirmDay.mockResolvedValue(saturdayConfirmed({ deltas: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Jetzt freigeben',
      })
    )
    await screen.findByText('Backzettel freigegeben.')
    // ... und kommt erst danach mit dem alten Entwurf zurück.
    await act(async () => {
      resolveSlow(saturdayDraft())
    })
    expect(
      screen.queryByRole('button', { name: 'Freigeben' })
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByTestId('page-status')).getByText('Freigegeben')
    ).toBeInTheDocument()
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

  it('noch nicht erfasste Nachträge: Hinweis, kurz danach neu laden (W4)', async () => {
    jest.useFakeTimers()
    try {
      mocked.fetchBackzettelDay
        .mockResolvedValueOnce(saturdayConfirmed({ deltasPending: true }))
        .mockResolvedValue(saturdayConfirmed({ deltasPending: false }))
      renderDay()
      expect(await screen.findByTestId('deltas-pending')).toHaveTextContent(
        'gerade übernommen'
      )
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(1)
      await act(async () => {
        jest.advanceTimersByTime(api.DELTAS_PENDING_RELOAD_MS)
      })
      await waitFor(() =>
        expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
      )
      await waitFor(() =>
        expect(screen.queryByTestId('deltas-pending')).not.toBeInTheDocument()
      )
      // erledigt: kein weiteres Nachladen
      await act(async () => {
        jest.advanceTimersByTime(api.DELTAS_PENDING_RELOAD_MS * 3)
      })
      expect(mocked.fetchBackzettelDay).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
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
      expect(p3.getByText('Testsauerteig (Misch)')).toBeInTheDocument()
      // Jede Seite eines Entwurfs ist als Entwurf markiert (W4-verify r5).
      expect(
        p3.getByText('ENTWURF – noch nicht freigegeben')
      ).toBeInTheDocument()
      expect(sheet.getByTestId('print-page-2')).toHaveClass('bz-break')

      fireEvent.click(screen.getByRole('button', { name: 'Drucken' }))
      expect(print).toHaveBeenCalled()
    })

    it('abgehakte Zeilen sind auf dem Ausdruck abgehakt', async () => {
      const confirmed = saturdayConfirmed()
      confirmed.sections[1].lines[0] = {
        ...confirmed.sections[1].lines[0],
        doneAt: '2026-11-28T04:10:00.000Z',
        doneBy: { id: 2, displayName: 'Test Backstube' },
      }
      mocked.fetchBackzettelDay.mockResolvedValue(confirmed)
      renderDay()
      const sheet = within(await screen.findByTestId('bz-print'))
      expect(sheet.getByTestId('print-done-test-weck|')).toHaveTextContent('✓')
      // W4-verify r2: Kürzel statt Name - der Name lief über den Rand
      expect(
        sheet.getByTestId('print-done-test-weck|').parentElement
      ).toHaveTextContent('✓TB')
      expect(
        sheet.queryByTestId('print-done-test-kornbrot|')
      ).not.toBeInTheDocument()
    })

    it('Nachträge bleiben auf Blatt 1: Spaltenköpfe nur einmal, Nachtrag einzeilig (W4-verify r2)', async () => {
      const confirmed = saturdayConfirmed()
      confirmed.sections[1].lines[0] = {
        ...confirmed.sections[1].lines[0],
        previouslyDone: { qty: 50, at: null, by: null },
      }
      mocked.fetchBackzettelDay.mockResolvedValue(confirmed)
      renderDay()
      const sheet = await screen.findByTestId('bz-print')
      const p1 = sheet.querySelector('[data-testid="print-page-1"]') as Element
      const tables = p1.querySelectorAll('table.lines')
      expect(tables.length).toBeGreaterThan(1)
      expect(tables[0].classList.contains('follow')).toBe(false)
      tables.forEach((t, i) => {
        if (i > 0) expect(t.classList.contains('follow')).toBe(true)
        expect(t.querySelectorAll('colgroup col')).toHaveLength(8)
      })
      // Die Überschrift der Nachträge steht im Tabellenkopf und wiederholt
      // sich beim Seitenumbruch (W4-verify r4).
      const deltaHead = sheet.querySelector(
        '[data-testid="print-deltas"] thead'
      )
      expect(deltaHead).toHaveTextContent('Nachträge seit der Freigabe')
      expect(p1).toHaveTextContent('(Liste unten)')
      expect(p1).not.toHaveTextContent('siehe unten')
      expect(p1).toHaveTextContent(/bereits 50 erledigt - noch \+\d+/)
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
