import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@bakery/shared/data-access'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderEntryClient from './PreorderEntryClient'
import { LOAD_RETRY_MS } from '../PreorderForm'
import {
  changePreorderStatus,
  createPreorder,
  fetchCatalogue,
  fetchPickupPointInfo,
  fetchPickupPoints,
  fetchPreorderVariants,
  listPreorders,
  updatePreorder,
} from '../../../../lib/preordersApi'
import {
  CATALOGUE,
  ONLY_DATE,
  POINT,
  pickupDays,
  preorder,
} from '../../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  changePreorderStatus: jest.fn(),
  createPreorder: jest.fn(),
  fetchCatalogue: jest.fn(),
  fetchPickupPointInfo: jest.fn(),
  fetchPickupPoints: jest.fn(),
  fetchPreorderVariants: jest.fn(),
  listPreorders: jest.fn(),
  updatePreorder: jest.fn(),
}))

const mockCreate = createPreorder as jest.MockedFunction<typeof createPreorder>

// Donnerstag, 12.11.2026, 10 Uhr - nächster Backtag Fr 13.11., Sa 14.11.
const NOW = new Date(2026, 10, 12, 10, 0, 0)

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ONLY_DATE })
  mockCreate.mockReset()
  ;(fetchCatalogue as jest.Mock).mockResolvedValue(CATALOGUE)
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([POINT])
  ;(fetchPickupPointInfo as jest.Mock).mockImplementation(async () => ({
    points: await fetchPickupPoints(),
    pickupDays: null,
  }))
  ;(fetchPreorderVariants as jest.Mock).mockResolvedValue({
    configured: true,
    products: { mustersemmel: ['nuss', 'mohn'] },
  })
  ;(listPreorders as jest.Mock).mockResolvedValue([
    preorder(),
    preorder({ id: 9 }),
    preorder({
      id: 10,
      items: [
        {
          productId: 'musterweck',
          name: 'Musterweck',
          variant: '',
          unit: 'Stück',
          unitPrice: 0.5,
          quantity: 4,
          lineTotal: 2,
        },
      ],
    }),
  ])
  ;(window.localStorage.getItem as jest.Mock).mockReturnValue(null)
})

afterEach(() => {
  jest.useRealTimers()
})

/** `sessionStorage` als echter Speicher (Entwurf, W4-verify r4). */
function memorySessionStorage(): Map<string, string> {
  const data = new Map<string, string>()
  const store = window.sessionStorage as unknown as Record<string, jest.Mock>
  store.getItem.mockImplementation((key: string) =>
    data.has(key) ? data.get(key) : null
  )
  store.setItem.mockImplementation((key: string, value: string) => {
    data.set(key, String(value))
  })
  store.removeItem.mockImplementation((key: string) => {
    data.delete(key)
  })
  return data
}

async function readyAs(userId: number) {
  const view = renderWithTheme(
    <WithSession
      value={fakeSession({
        user: {
          id: userId,
          username: 'test.verkauf',
          displayName: 'Test Verkauf',
          role: 'verkauf',
        },
      })}
    >
      <PreorderEntryClient />
    </WithSession>
  )
  const name = await screen.findByLabelText(/^Name/)
  await waitFor(() => expect(name).toHaveFocus())
  return view
}

async function ready() {
  renderWithTheme(<PreorderEntryClient />)
  const name = await screen.findByLabelText(/^Name/)
  await waitFor(() => expect(name).toHaveFocus())
  return name
}

describe('PreorderEntryClient (P1)', () => {
  it('Chip-Gruppen sind je ein Tab-Halt, Pfeiltasten wählen (UI-Runde 2)', async () => {
    const user = userEvent.setup()
    await ready()
    for (const name of ['Bestellweg', 'Abholort', 'Abholtag schnell wählen']) {
      const group = screen.getByRole('radiogroup', { name })
      const radios = within(group).getAllByRole('radio')
      expect(radios.length).toBeGreaterThan(1)
      expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1)
    }
    const channel = screen.getByRole('radiogroup', { name: 'Bestellweg' })
    const checked = within(channel).getByRole('radio', { checked: true })
    expect(checked.tabIndex).toBe(0)
    checked.focus()
    await user.keyboard('{ArrowRight}')
    const now = within(channel).getByRole('radio', { checked: true })
    expect(now).not.toBe(checked)
    expect(now).toHaveFocus()
    expect(now.tabIndex).toBe(0)
  })

  it('Suchfeld zeigt nur auf eine Ergebnisliste, die es gibt (UI-Runde 2)', async () => {
    const user = userEvent.setup()
    await ready()
    const search = screen.getByLabelText('Produkt suchen')
    expect(search).not.toHaveAttribute('aria-controls')
    await user.type(search, 'korn')
    expect(search).toHaveAttribute('aria-controls', 'preorder-product-results')
    expect(document.getElementById('preorder-product-results')).not.toBeNull()
  })

  it('erfasst per Tastatur: Name ↵ Telefon ↵ Produkt ↵ Menge ↵ Strg+↵', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(
      preorder({ code: 'LA-2026-11-13-04', customerName: 'Erika Beispiel' })
    )
    await ready()

    await user.keyboard('Erika Beispiel{Enter}0170 1234567{Enter}')
    expect(screen.getByLabelText('Produkt suchen')).toHaveFocus()
    await user.keyboard('korn{Enter}')
    // Menge hat den Fokus, die erste Ziffer ersetzt die vorbelegte 1
    expect(screen.getByLabelText('Menge')).toHaveFocus()
    await user.keyboard('3{Enter}')

    const lines = screen.getByRole('list', { name: 'Positionen' })
    expect(within(lines).getByText('Kornbrot 500g')).toBeInTheDocument()
    // Namen brechen um statt „Probebrötchen …“ (UI-Runde 2, 390 px).
    expect(within(lines).getByText('Kornbrot 500g')).not.toHaveClass(
      'MuiTypography-noWrap'
    )
    expect(within(lines).getByText(/3 × 2,50\s€ = 7,50\s€/)).toBeInTheDocument()
    expect(screen.getByLabelText('Produkt suchen')).toHaveFocus()

    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith({
      channel: 'telefon',
      customerName: 'Erika Beispiel',
      customerPhone: '0170 1234567',
      pickupDate: '2026-11-13',
      pickupPointId: null,
      pickupTime: null,
      items: [{ productId: 'kornbrot-500g', variant: '', quantity: 3 }],
      paid: false,
      note: null,
      requestId: expect.any(String),
    })

    expect(await screen.findByTestId('preorder-saved')).toHaveTextContent(
      'LA-2026-11-13-04'
    )
    const next = within(screen.getByTestId('preorder-saved')).getByRole(
      'button',
      { name: /Nächste Bestellung/ }
    )
    expect(next).toHaveFocus()
    // UI-Runde 2: nur die Karte - keine Snackbar mit einem zweiten
    // „Nächste Bestellung“.
    expect(
      screen.getAllByRole('button', { name: /Nächste Bestellung/ })
    ).toHaveLength(1)
    expect(
      screen.queryByText(/Vorbestellung LA-2026-11-13-04 gespeichert/)
    ).not.toBeInTheDocument()

    await user.click(next)
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('')
    expect(screen.getByText('Noch keine Artikel.')).toBeInTheDocument()
  })

  it('verlangt bei Produkten mit Sorten eine Sorte; Ziffernblock für die Menge', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder())
    await ready()
    await user.type(screen.getByLabelText(/^Name/), 'Max Muster')

    await user.type(screen.getByLabelText('Produkt suchen'), 'semmel')
    await user.click(screen.getByRole('button', { name: /Mustersemmel/ }))

    const add = screen.getByRole('button', { name: 'Erst Sorte wählen' })
    expect(add).toBeDisabled()
    expect(
      screen.getByText('Für dieses Produkt muss eine Sorte gewählt werden.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Nuss' }))
    expect(screen.getByRole('button', { name: 'Hinzufügen' })).toBe(add)
    const pad = screen.getByRole('group', { name: 'Ziffernblock Menge' })
    await user.click(within(pad).getByRole('button', { name: '1' }))
    await user.click(within(pad).getByRole('button', { name: '2' }))
    expect(screen.getByLabelText('Menge')).toHaveValue('12')
    await user.click(
      within(pad).getByRole('button', { name: 'Letzte Ziffer löschen' })
    )
    await user.click(within(pad).getByRole('button', { name: '0' }))
    expect(screen.getByLabelText('Menge')).toHaveValue('10')
    await user.click(add)

    expect(screen.getByText('Mustersemmel (Nuss)')).toBeInTheDocument()
    expect(screen.getByTestId('preorder-total')).toHaveTextContent('6,00')

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 'mustersemmel', variant: 'nuss', quantity: 10 }],
        })
      )
    )
  })

  it('Sammelstelle: Kanal „Sammelstelle“, nur Liefertage, keine Uhrzeit', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder())
    await ready()
    expect(screen.queryByRole('radio', { name: 'Sammelstelle' })).toBeNull()

    await user.click(screen.getByRole('radio', { name: POINT.name }))
    expect(screen.getByRole('radio', { name: 'Sammelstelle' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Sa 14.11.' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.queryByLabelText('Uhrzeit (optional)')).toBeNull()
    expect(screen.getByText(/Übergabe 09:00-09:30 Uhr/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Name/), 'Kita Kind')
    // Schnellknopf aus „häufig vorbestellt“
    const quick = screen.getByRole('group', { name: 'Häufig vorbestellt' })
    await user.click(
      within(quick).getByRole('button', { name: 'Kornbrot 500g' })
    )
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await user.click(screen.getByRole('checkbox', { name: /bezahlt/i }))
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'sammelstelle',
          pickupPointId: POINT.id,
          pickupDate: '2026-11-14',
          pickupTime: null,
          paid: true,
          items: [{ productId: 'kornbrot-500g', variant: '', quantity: 1 }],
        })
      )
    )
  })

  it('erst Bestellweg, dann Sammelstelle (Kurzanleitung): der Bestellweg bleibt (W4-verify r6)', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder())
    await ready()
    await user.click(screen.getByRole('radio', { name: 'Telefon' }))
    await user.click(screen.getByRole('radio', { name: POINT.name }))
    expect(screen.getByRole('radio', { name: 'Telefon' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Sammelstelle' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('lässt keinen Montag zu und speichert nichts Unvollständiges', async () => {
    const user = userEvent.setup()
    await ready()
    const date = screen.getByLabelText('Abholtag')
    fireEvent.change(date, { target: { value: '2026-11-16' } })
    expect(
      screen.getByText('Montag ist Ruhetag - bitte einen anderen Tag wählen.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Mo / })).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(mockCreate).not.toHaveBeenCalled()
    expect(screen.getByText('Bitte den Namen eintragen.')).toBeInTheDocument()
    expect(
      screen.getByText('Bitte mindestens einen Artikel hinzufügen.')
    ).toBeInTheDocument()
  })

  describe('Schließtage laut Kalender (Z14)', () => {
    beforeEach(() => {
      ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
        points: [POINT],
        pickupDays: pickupDays(),
      })
    })

    it('bietet Schließtage nicht an: Vorgabe, Vorschläge und Hinweis', async () => {
      await ready()
      // Fr 13. und Sa 14.11. sind zu - Vorgabe ist der Sonntag
      await waitFor(() =>
        expect(screen.getByLabelText('Abholtag')).toHaveValue('2026-11-15')
      )
      expect(screen.queryByRole('radio', { name: 'Fr 13.11.' })).toBeNull()
      expect(screen.queryByRole('radio', { name: 'Sa 14.11.' })).toBeNull()
      expect(screen.queryByRole('radio', { name: 'Mo 16.11.' })).toBeNull()
      expect(screen.getByRole('radio', { name: 'So 15.11.' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(screen.getByTestId('closed-days-hint')).toHaveTextContent(
        'Geschlossen, deshalb nicht wählbar: Fr 13.11. (Betriebsferien), Sa 14.11. (Betriebsferien)'
      )
      // das Datumsfeld kennt das Fenster der API
      expect(screen.getByLabelText('Abholtag')).toHaveAttribute(
        'min',
        '2026-10-13'
      )
      expect(screen.getByLabelText('Abholtag')).toHaveAttribute(
        'max',
        '2027-11-13'
      )
    })

    it('ein von Hand gewählter Schließtag: Grund sofort, nichts wird gespeichert', async () => {
      const user = userEvent.setup()
      await ready()
      await user.type(screen.getByLabelText(/^Name/), 'Erika Beispiel')
      const quick = screen.getByRole('group', { name: 'Häufig vorbestellt' })
      await user.click(
        within(quick).getByRole('button', { name: 'Kornbrot 500g' })
      )
      await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
      fireEvent.change(screen.getByLabelText('Abholtag'), {
        target: { value: '2026-11-13' },
      })
      expect(
        screen.getByText(
          'Am Freitag, 13.11.2026 (Betriebsferien), ist die Bäckerei geschlossen - bitte einen anderen Abholtag wählen.'
        )
      ).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: 'Vorbestellung speichern' })
      )
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('Sonderöffnung am Montag ist wählbar, der normale Montag nicht', async () => {
      await ready()
      const date = screen.getByLabelText('Abholtag')
      fireEvent.change(date, { target: { value: '2026-11-23' } })
      expect(screen.queryByText(/Ruhetag/)).toBeNull()
      fireEvent.change(date, { target: { value: '2026-11-30' } })
      expect(
        screen.getByText(
          'Am Montag, 30.11.2026, ist Ruhetag - bitte einen anderen Abholtag wählen.'
        )
      ).toBeInTheDocument()
    })

    it('Sammelstelle: der geschlossene Liefertag fällt weg, der nächste ist Vorgabe', async () => {
      const user = userEvent.setup()
      await ready()
      await user.click(screen.getByRole('radio', { name: POINT.name }))
      expect(screen.queryByRole('radio', { name: 'Sa 14.11.' })).toBeNull()
      expect(screen.getByRole('radio', { name: 'Sa 21.11.' })).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(screen.getByLabelText('Abholtag')).toHaveValue('2026-11-21')
      expect(screen.getByTestId('closed-days-hint')).toHaveTextContent(
        'Geschlossen, deshalb nicht wählbar: Sa 14.11. (Betriebsferien)'
      )
      // zurück in den Laden: der Samstag ist offen und bleibt
      await user.click(screen.getByRole('radio', { name: 'Im Laden' }))
      expect(screen.getByLabelText('Abholtag')).toHaveValue('2026-11-21')
    })

    it('ohne Kalenderdaten vom Server gilt nur der Montag - kein Hinweis', async () => {
      ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
        points: [POINT],
        pickupDays: null,
      })
      await ready()
      await waitFor(() =>
        expect(screen.getByLabelText('Abholtag')).toHaveValue('2026-11-13')
      )
      expect(screen.queryByTestId('closed-days-hint')).toBeNull()
    })
  })

  it('zeigt die deutsche Meldung des Servers', async () => {
    const user = userEvent.setup()
    mockCreate.mockRejectedValue(
      Object.assign(new Error('„Mustersemmel“ gibt es nicht in Sorten.'), {
        status: 400,
        code: 'invalid_variant',
      })
    )
    await ready()
    await user.keyboard('Erika{Enter}{Enter}weck{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      await screen.findByText('„Mustersemmel“ gibt es nicht in Sorten.')
    ).toBeInTheDocument()

    // W4-verify r2: an invalid field afterwards replaces the stale server message
    fireEvent.change(screen.getByLabelText('Abholtag'), {
      target: { value: '2026-11-16' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      screen.queryByText('„Mustersemmel“ gibt es nicht in Sorten.')
    ).toBeNull()
  })

  it('fragt nach, bevor ein Abholtag in der Vergangenheit gespeichert wird (W4-verify r2)', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue(preorder({ pickupDate: '2026-11-07' }))
    await ready()
    await user.keyboard('Erika{Enter}{Enter}weck{Enter}{Enter}')
    fireEvent.change(screen.getByLabelText('Abholtag'), {
      target: { value: '2026-11-07' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(
      await screen.findByText(
        /liegt in der Vergangenheit - die Bestellung erscheint dann in keiner Liste/
      )
    ).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      pickupDate: '2026-11-07',
    })
  })
})

const DRAFT_7 = 'bakery-management-preorder-draft:7'

describe('Entwurf und Wiederholen (W4-verify r4)', () => {
  let stored: Map<string, string>
  beforeEach(() => {
    stored = memorySessionStorage()
  })

  it('eine halb erfasste Bestellung überlebt Abmelden und Neuladen - nur für denselben Benutzer', async () => {
    const user = userEvent.setup()
    const first = await readyAs(7)
    await user.keyboard('Erika Beispiel{Enter}0170 1234567{Enter}')
    await user.keyboard('korn{Enter}3{Enter}')
    await waitFor(() => expect(stored.get(DRAFT_7)).toContain('kornbrot-500g'))
    first.unmount()

    // ein anderer Benutzer an derselben Station sieht nichts davon
    const other = await readyAs(8)
    expect(screen.getByLabelText(/^Name/)).toHaveValue('')
    expect(screen.queryByTestId('preorder-draft-restored')).toBeNull()
    other.unmount()
    expect(stored.get(DRAFT_7)).toContain('Erika Beispiel')

    await readyAs(7)
    expect(
      await screen.findByTestId('preorder-draft-restored')
    ).toHaveTextContent('Nicht gespeicherte Eingaben von 10:00 Uhr')
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Erika Beispiel')
    const lines = screen.getByRole('list', { name: 'Positionen' })
    expect(within(lines).getByText('Kornbrot 500g')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(screen.getByLabelText(/^Name/)).toHaveValue('')
    expect(screen.queryByTestId('preorder-draft-restored')).toBeNull()
    expect(stored.has(DRAFT_7)).toBe(false)
  })

  it('verlorene Antwort: deutsche Meldung, nochmal Speichern schickt dieselbe Kennung', async () => {
    const user = userEvent.setup()
    mockCreate
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        preorder({ code: 'LA-2026-11-13-04', customerName: 'Erika' })
      )
    await readyAs(7)
    await user.keyboard('Erika{Enter}{Enter}korn{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    const message = await screen.findByText(
      /Keine Verbindung zum Server – bitte WLAN prüfen\. Ob die Bestellung schon angekommen ist, ist unklar/
    )
    expect(message).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    expect(await screen.findByTestId('preorder-saved')).toBeInTheDocument()
    expect(mockCreate).toHaveBeenCalledTimes(2)
    const [firstCall, secondCall] = mockCreate.mock.calls.map(
      (c) => c[0].requestId
    )
    expect(firstCall).toEqual(expect.any(String))
    expect(secondCall).toBe(firstCall)
    // gespeichert: der Entwurf ist weg
    expect(stored.has(DRAFT_7)).toBe(false)
  })
  it('ein Kollege an derselben Station überschreibt den Entwurf nicht (W4-verify r5)', async () => {
    const user = userEvent.setup()
    const vera = await readyAs(7)
    await user.keyboard('Frau Telefon Vera{Enter}{Enter}korn{Enter}2{Enter}')
    await waitFor(() => expect(stored.get(DRAFT_7)).toContain('kornbrot-500g'))
    vera.unmount()

    const valentin = await readyAs(8)
    await user.keyboard('Herr Laden Valentin')
    await waitFor(() =>
      expect(stored.get('bakery-management-preorder-draft:8')).toContain(
        'Herr Laden Valentin'
      )
    )
    valentin.unmount()

    await readyAs(7)
    expect(
      await screen.findByTestId('preorder-draft-restored')
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Frau Telefon Vera')
    const lines = screen.getByRole('list', { name: 'Positionen' })
    expect(within(lines).getByText('Kornbrot 500g')).toBeInTheDocument()
  })

  it('nach verlorener Antwort geändert: kein „Gespeichert“ mit der alten Fassung, sondern übernehmen oder neu (W4-verify r5)', async () => {
    const user = userEvent.setup()
    const conflict = new ApiError(
      'Diese Vorbestellung ist beim ersten Versuch schon angekommen: LA-2026-11-13-04 · Erika · 1 × Kornbrot 500g - mit den Angaben von damals. Was seitdem geändert wurde, ist NICHT gespeichert.',
      409,
      'request_id_changed'
    )
    conflict.details = {
      preorder: {
        id: 42,
        code: 'LA-2026-11-13-04',
        updatedAt: '2026-11-12T09:00:00.000Z',
      },
    }
    mockCreate
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(conflict)
    const mockUpdate = updatePreorder as jest.MockedFunction<
      typeof updatePreorder
    >
    mockUpdate.mockReset()
    mockUpdate.mockResolvedValue(
      preorder({ id: 42, code: 'LA-2026-11-13-04', customerName: 'Erika' })
    )
    await readyAs(7)
    await user.keyboard('Erika{Enter}{Enter}korn{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await screen.findByText(/Ob die Bestellung schon angekommen ist/)

    // die Kundin bestellt noch etwas dazu
    await user.click(screen.getByLabelText('Produkt suchen'))
    await user.keyboard('weck{Enter}4{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    const notice = await screen.findByTestId('preorder-earlier')
    expect(notice).toHaveTextContent('NICHT gespeichert')
    expect(screen.queryByTestId('preorder-saved')).toBeNull()
    expect(mockCreate.mock.calls[1][0].requestId).toBe(
      mockCreate.mock.calls[0][0].requestId
    )
    // die Eingaben stehen noch da
    const lines = screen.getByRole('list', { name: 'Positionen' })
    expect(within(lines).getByText('Musterweck')).toBeInTheDocument()

    await user.click(
      within(notice).getByRole('button', {
        name: 'Änderungen in LA-2026-11-13-04 übernehmen',
      })
    )
    expect(await screen.findByTestId('preorder-saved')).toBeInTheDocument()
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const [id, fields, version] = mockUpdate.mock.calls[0]
    expect(id).toBe(42)
    expect(version).toBe('2026-11-12T09:00:00.000Z')
    expect(fields).not.toHaveProperty('requestId')
    expect(fields.items).toEqual([
      { productId: 'kornbrot-500g', variant: '', quantity: 1 },
      { productId: 'musterweck', variant: '', quantity: 4 },
    ])
    expect(stored.has(DRAFT_7)).toBe(false)
  })

  it('übernehmen mit „Bezahlt“: die ganze Summe gilt als bezahlt, nicht nur der erste Versuch (W4-verify r6)', async () => {
    const user = userEvent.setup()
    const conflict = new ApiError('schon angekommen', 409, 'request_id_changed')
    conflict.details = {
      preorder: {
        id: 42,
        code: 'LA-2026-11-13-04',
        updatedAt: '2026-11-12T09:00:00.000Z',
      },
    }
    mockCreate
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(conflict)
    const mockUpdate = updatePreorder as jest.MockedFunction<
      typeof updatePreorder
    >
    const mockStatus = changePreorderStatus as jest.MockedFunction<
      typeof changePreorderStatus
    >
    mockUpdate.mockReset()
    mockStatus.mockReset()
    // Der Server behält beim PATCH den Betrag des ersten Versuchs.
    mockUpdate.mockResolvedValue(
      preorder({
        id: 42,
        code: 'LA-2026-11-13-04',
        paid: true,
        paidAmount: 2.6,
        total: 4.6,
        paymentBalance: 2,
        updatedAt: '2026-11-12T09:05:00.000Z',
      })
    )
    mockStatus.mockResolvedValue(
      preorder({
        id: 42,
        code: 'LA-2026-11-13-04',
        paid: true,
        paidAmount: 4.6,
        total: 4.6,
        paymentBalance: 0,
      })
    )
    await readyAs(7)
    await user.keyboard('Erika{Enter}{Enter}korn{Enter}{Enter}')
    await user.click(screen.getByLabelText('Noch nicht bezahlt'))
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await screen.findByText(/Ob die Bestellung schon angekommen ist/)
    await user.click(screen.getByLabelText('Produkt suchen'))
    await user.keyboard('weck{Enter}4{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    const notice = await screen.findByTestId('preorder-earlier')
    await user.click(
      within(notice).getByRole('button', {
        name: 'Änderungen in LA-2026-11-13-04 übernehmen',
      })
    )
    expect(await screen.findByTestId('preorder-saved')).toBeInTheDocument()
    expect(mockUpdate.mock.calls[0][1].paid).toBe(true)
    expect(mockStatus).toHaveBeenCalledWith(
      42,
      { paid: true },
      '2026-11-12T09:05:00.000Z'
    )
  })

  it('„Als neue Vorbestellung speichern“ schickt eine neue Kennung (nächste Kundin über dem Entwurf)', async () => {
    const user = userEvent.setup()
    const conflict = new ApiError('schon angekommen', 409, 'request_id_changed')
    conflict.details = {
      preorder: { id: 42, code: 'LA-2026-11-13-04', updatedAt: null },
    }
    mockCreate
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(
        preorder({ id: 43, code: 'LA-2026-11-13-05', customerName: 'Zweit' })
      )
    await readyAs(7)
    await user.keyboard('Erika{Enter}{Enter}korn{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await screen.findByText(/Ob die Bestellung schon angekommen ist/)
    await user.clear(screen.getByLabelText(/^Name/))
    await user.type(screen.getByLabelText(/^Name/), 'Zweit')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    const notice = await screen.findByTestId('preorder-earlier')
    await user.click(
      within(notice).getByRole('button', {
        name: 'Als neue Vorbestellung speichern',
      })
    )
    expect(await screen.findByTestId('preorder-saved')).toBeInTheDocument()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    const ids = mockCreate.mock.calls.map((c) => c[0].requestId)
    expect(ids[1]).toBe(ids[0])
    expect(ids[2]).not.toBe(ids[0])
    expect(mockCreate.mock.calls[2][0].customerName).toBe('Zweit')
  })

  it('ein wiederhergestellter Entwurf nach unklarem Speichern sagt „vielleicht schon angekommen“', async () => {
    const user = userEvent.setup()
    mockCreate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const first = await readyAs(7)
    await user.keyboard('Erika{Enter}{Enter}korn{Enter}{Enter}')
    await user.click(
      screen.getByRole('button', { name: 'Vorbestellung speichern' })
    )
    await screen.findByText(/Ob die Bestellung schon angekommen ist/)
    first.unmount()
    await readyAs(7)
    const banner = await screen.findByTestId('preorder-draft-restored')
    expect(banner).toHaveTextContent('vielleicht schon angekommen')
    expect(banner).not.toHaveTextContent('Nicht gespeicherte')
  })
})

describe('Sortiment nicht erreichbar beim Öffnen (W4-verify r5)', () => {
  it('lädt mit „Erneut laden“ und von selbst nach, die Eingaben bleiben', async () => {
    const user = userEvent.setup()
    ;(fetchCatalogue as jest.Mock)
      .mockReset()
      .mockRejectedValueOnce(new ApiError('HTTP 500: x', 500))
      .mockRejectedValueOnce(new ApiError('HTTP 500: x', 500))
      .mockResolvedValue(CATALOGUE)
    renderWithTheme(<PreorderEntryClient />)
    const alert = await screen.findByTestId('preorder-load-error')
    expect(alert).toHaveTextContent('Fehler 500')
    await user.type(screen.getByLabelText(/^Name/), 'Erika')

    await user.click(
      within(alert).getByRole('button', { name: 'Erneut laden' })
    )
    await waitFor(() => expect(fetchCatalogue).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('preorder-load-error')).toBeInTheDocument()

    // von selbst, ohne Tippen: WLAN wieder da (sonst alle LOAD_RETRY_MS)
    expect(LOAD_RETRY_MS).toBeLessThanOrEqual(30_000)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() =>
      expect(screen.queryByTestId('preorder-load-error')).toBeNull()
    )
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Erika')
    await user.type(screen.getByLabelText('Produkt suchen'), 'korn')
    expect(
      await screen.findByRole('button', { name: /Kornbrot 500g/ })
    ).toBeInTheDocument()
  })
})
