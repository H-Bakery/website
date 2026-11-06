import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import HilfeClient from './HilfeClient'
import * as api from '../../../lib/backzettelApi'
import { CONFIG_RESPONSE } from '../../../lib/backzettelFixtures'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'
import { PRINT_ATTR } from '../../../components/hilfe/hilfePrint'

jest.mock('../../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../../lib/backzettelApi')
  return { ...actual, fetchBackzettelConfig: jest.fn() }
})
const mocked = api as jest.Mocked<typeof api>

function renderFor(role: PilotRole | null) {
  return render(
    <WithSession value={fakeSession(role ? { role } : {})}>
      <HilfeClient />
    </WithSession>
  )
}

const shownSheet = () => {
  const sheets = screen
    .getAllByRole('article')
    .filter((el) => el.getAttribute('data-print-default') === 'true')
  expect(sheets).toHaveLength(1)
  return sheets[0]
}

describe('Hilfe (/admin/hilfe, P6)', () => {
  let print: jest.Mock
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE)
    print = jest.fn()
    window.print = print
    document.documentElement.removeAttribute(PRINT_ATTR)
  })

  const cases: [PilotRole, string, string[]][] = [
    [
      'verkauf',
      'Kurzanleitung Verkauf',
      [
        'Vorbestellung erfassen (unter 30 Sekunden)',
        'Code auf den Zettel',
        'Nicht abgeholt',
        'Stornieren',
        'Keine Verbindung?',
      ],
    ],
    [
      'backstube',
      'Kurzanleitung Backstube',
      [
        'Heute oder Morgen',
        'Abhaken',
        'Nachträge quittieren',
        'Vorbereitung',
        'Noch nicht freigegeben',
      ],
    ],
    [
      'fahrer',
      'Kurzanleitung Fahrer',
      [
        'Vor der Fahrt',
        'Übergeben und bezahlt',
        'Nicht abgeholt',
        'Zurück in der Bäckerei',
      ],
    ],
    [
      'inhaber',
      'Kurzanleitung Inhaber',
      [
        'Benutzer und PIN',
        'Station einrichten',
        'Backzettel planen und freigeben',
        'Grundmengen',
        'Papierbetrieb auslösen',
      ],
    ],
  ]

  it.each(cases)(
    '%s: eigener Spickzettel zuerst und gewählt',
    async (role, title, headings) => {
      renderFor(role)
      const tabs = screen.getAllByRole('tab')
      expect(tabs[0]).toHaveAttribute('data-testid', `tab-${role}`)
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
      expect(tabs[0]).toHaveTextContent('(Ihre Rolle)')
      expect(tabs).toHaveLength(4)
      const sheet = shownSheet()
      expect(sheet).toHaveAttribute('data-sheet', `spickzettel-${role}`)
      expect(
        within(sheet).getByRole('heading', { level: 2, name: title })
      ).toBeInTheDocument()
      for (const heading of headings) {
        expect(
          within(sheet).getByRole('heading', { level: 3, name: heading })
        ).toBeInTheDocument()
      }
      await screen.findByText(/die Posten stehen schon da/)
    }
  )

  it('wechselt per Reiter zu einer anderen Rolle', async () => {
    renderFor('verkauf')
    fireEvent.click(screen.getByTestId('tab-inhaber'))
    expect(screen.getByTestId('tab-inhaber')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(shownSheet()).toHaveAttribute('data-sheet', 'spickzettel-inhaber')
    await screen.findByText(/die Posten stehen schon da/)
  })

  it('ohne Sitzung: Verkauf zuerst, ohne „Ihre Rolle“', async () => {
    renderFor(null)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('data-testid', 'tab-verkauf')
    expect(screen.queryByText(/Ihre Rolle/)).not.toBeInTheDocument()
    await screen.findByText(/die Posten stehen schon da/)
  })

  it('„Drucken“ druckt genau das gezeigte Blatt und räumt nach afterprint auf', async () => {
    renderFor('backstube')
    await screen.findByText(/die Posten stehen schon da/)
    fireEvent.click(screen.getByTestId('print-spickzettel-backstube'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.documentElement.getAttribute(PRINT_ATTR)).toBe(
      'spickzettel-backstube'
    )
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(document.documentElement.hasAttribute(PRINT_ATTR)).toBe(false)
  })

  it.each([
    'papier-regel',
    'vorbestellschein-2',
    'vorbestellschein-4',
    'notfallblatt',
  ])('Papierbetrieb: %s ist ein eigenes druckbares Blatt', async (id) => {
    renderFor('verkauf')
    await screen.findByText(/die Posten stehen schon da/)
    expect(screen.getByTestId(`sheet-${id}`)).toHaveAttribute('data-sheet', id)
    fireEvent.click(screen.getByTestId(`print-${id}`))
    expect(document.documentElement.getAttribute(PRINT_ATTR)).toBe(id)
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('Papier-Regel steht auf der Seite, mit 10 Minuten und wer entscheidet', async () => {
    renderFor('verkauf')
    const regel = screen.getByTestId('sheet-papier-regel')
    expect(
      within(regel).getByRole('heading', { name: 'Wer entscheidet' })
    ).toBeInTheDocument()
    expect(regel).toHaveTextContent('10 Minuten')
    expect(regel).toHaveTextContent('in App übertragen')
    await screen.findByText(/die Posten stehen schon da/)
  })

  it('Vorbestellschein: Felder der Erfassung, 2 bzw. 4 je Seite', async () => {
    renderFor('verkauf')
    await screen.findByText(/die Posten stehen schon da/)
    const two = screen.getByTestId('sheet-vorbestellschein-2')
    const four = screen.getByTestId('sheet-vorbestellschein-4')
    expect(two.querySelectorAll('.vbs-slip')).toHaveLength(2)
    expect(four.querySelectorAll('.vbs-slip')).toHaveLength(4)
    for (const label of [
      'Name',
      'Telefon',
      'Bestellweg',
      'Abholung im Laden',
      'Uhrzeit',
      'Sammelstelle',
      'Produkt',
      'Sorte',
      'Menge',
      'bezahlt',
      'Anmerkung',
      'Aufgenommen von',
      'in App übertragen',
      'Code aus der App',
    ]) {
      expect(two).toHaveTextContent(label)
    }
  })

  it('Notfallblatt: Posten und Sorten aus den Stammdaten, Spalten leer', async () => {
    renderFor('backstube')
    await screen.findByText(/die Posten stehen schon da/)
    const sheet = screen.getByTestId('sheet-notfallblatt')
    expect(sheet).toHaveTextContent('letzten freigegebenen Ausdruck verwenden')
    const rows = Array.from(sheet.querySelectorAll('tbody tr')).map(
      (tr) => tr.querySelector('td')?.textContent
    )
    expect(rows).toEqual([
      'Testkornbrot',
      '',
      'Testweck',
      '',
      'Testzopf gefüllt – Testnussfüllung',
      'Testzopf gefüllt – Testmohnfüllung',
      '',
    ])
    const headers = Array.from(sheet.querySelectorAll('thead th')).map(
      (th) => th.textContent
    )
    expect(headers.slice(0, 5)).toEqual([
      'Posten',
      'Basis',
      'Vorb.',
      'Gesamt',
      '✓',
    ])
  })

  it('Notfallblatt ohne Stammdaten: leere Zeilen je Abschnitt, kein Fehler', async () => {
    mocked.fetchBackzettelConfig.mockRejectedValue(new Error('offline'))
    renderFor('backstube')
    await screen.findByText(/ohne Stammdaten mit leeren Zeilen/)
    const sheet = screen.getByTestId('sheet-notfallblatt')
    expect(sheet).toHaveTextContent('Brot')
    expect(sheet).toHaveTextContent('Hefeteig')
    expect(sheet).toHaveTextContent('Posten von Hand eintragen')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('alle Knöpfe sind mindestens 44 px hoch (Touch)', async () => {
    renderFor('verkauf')
    await screen.findByText(/die Posten stehen schon da/)
    const printButtons = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-testid')?.startsWith('print-'))
    expect(printButtons).toHaveLength(5)
    for (const button of printButtons) {
      const style = window.getComputedStyle(button)
      expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(44)
    }
    for (const tab of screen.getAllByRole('tab')) {
      expect(
        parseInt(window.getComputedStyle(tab).minHeight, 10)
      ).toBeGreaterThanOrEqual(44)
    }
  })
})
