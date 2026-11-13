import React from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderDetailClient from './PreorderDetailClient'
import {
  cancelPreorder,
  changePreorderStatus,
  fetchCatalogue,
  fetchPickupPointInfo,
  fetchPickupPoints,
  fetchPreorderVariants,
  getPreorder,
  updatePreorder,
} from '../../../../lib/preordersApi'
import {
  CATALOGUE,
  ONLY_DATE,
  pickupDays,
  POINT,
  preorder,
} from '../../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../../lib/roles'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/preorders/7',
}))
jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  cancelPreorder: jest.fn(),
  changePreorderStatus: jest.fn(),
  fetchCatalogue: jest.fn(),
  fetchPickupPointInfo: jest.fn(),
  fetchPickupPoints: jest.fn(),
  fetchPreorderVariants: jest.fn(),
  getPreorder: jest.fn(),
  listPreorders: jest.fn().mockResolvedValue([]),
  updatePreorder: jest.fn(),
}))

const mockGet = getPreorder as jest.MockedFunction<typeof getPreorder>
const mockUpdate = updatePreorder as jest.MockedFunction<typeof updatePreorder>
const mockCancel = cancelPreorder as jest.MockedFunction<typeof cancelPreorder>
const mockStatus = changePreorderStatus as jest.MockedFunction<
  typeof changePreorderStatus
>

/** Öffnet das ⋮-Menü und wählt einen Eintrag (Stornieren, Abgeholt bei offen …). */
async function chooseMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(
    await screen.findByRole('button', { name: 'Weitere Aktionen' })
  )
  await user.click(await screen.findByRole('menuitem', { name }))
}

function renderAs(role: PilotRole) {
  return renderWithTheme(
    <WithSession value={fakeSession({ role })}>
      <PreorderDetailClient id={7} />
    </WithSession>
  )
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 10), doNotFake: ONLY_DATE })
  jest.clearAllMocks()
  mockGet.mockResolvedValue(preorder())
  ;(fetchCatalogue as jest.Mock).mockResolvedValue(CATALOGUE)
  ;(fetchPickupPoints as jest.Mock).mockResolvedValue([POINT])
  ;(fetchPickupPointInfo as jest.Mock).mockImplementation(async () => ({
    points: await fetchPickupPoints(),
    pickupDays: null,
  }))
  ;(fetchPreorderVariants as jest.Mock).mockResolvedValue({
    configured: false,
    products: {},
  })
})

afterEach(() => jest.useRealTimers())

describe('PreorderDetailClient (P3)', () => {
  it('„Rechnung erstellen“ sieht nur der Inhaber, nicht bei stornierten', async () => {
    const view = renderAs('inhaber')
    expect(
      await screen.findByRole('button', { name: 'Rechnung erstellen' })
    ).toBeInTheDocument()
    view.unmount()

    renderAs('verkauf')
    await screen.findByRole('heading', { name: 'LA-2026-11-13-01' })
    expect(
      screen.queryByRole('button', { name: 'Rechnung erstellen' })
    ).not.toBeInTheDocument()
  })

  it('bietet für eine stornierte Vorbestellung keine Rechnung an', async () => {
    mockGet.mockResolvedValue(preorder({ status: 'storniert' }))
    renderAs('inhaber')
    await screen.findByRole('heading', { name: 'LA-2026-11-13-01' })
    expect(
      screen.queryByRole('button', { name: 'Rechnung erstellen' })
    ).not.toBeInTheDocument()
  })

  it('zeigt Code, Status, Kunde, Positionen mit Preis-Snapshot', async () => {
    renderAs('verkauf')
    expect(
      await screen.findByRole('heading', { name: 'LA-2026-11-13-01' })
    ).toBeInTheDocument()
    expect(screen.getByText('Offen')).toBeInTheDocument()
    // Unbezahlt steht da, nicht nur ein fehlender Chip (UI-Runde 1).
    expect(screen.getByTestId('unpaid-chip')).toHaveTextContent('nicht bezahlt')
    expect(screen.getByText('Erika Beispiel')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Positionen' })
    expect(within(table).getByText('Kornbrot 500g')).toBeInTheDocument()
    expect(within(table).getByText(/2,40/)).toBeInTheDocument()
    expect(within(table).getAllByText(/4,80/).length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: 'Aktionen' })).toBeInTheDocument()
  })

  it('bearbeitet Positionen und Abholung (PATCH, Snapshot bleibt)', async () => {
    const user = userEvent.setup()
    mockUpdate.mockResolvedValue(
      preorder({ code: 'LA-2026-11-14-01', pickupDate: '2026-11-14' })
    )
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    expect(
      await screen.findByRole('heading', { name: /bearbeiten/ })
    ).toBeInTheDocument()
    // vorhandene Position mit altem Preis
    expect(screen.getByText(/2 × 2,40/)).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Kornbrot 500g eins mehr' })
    )
    await user.click(screen.getByRole('radio', { name: 'Sa 14.11.' }))
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    // nur Geändertes, mit der geladenen Version
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        7,
        {
          pickupDate: '2026-11-14',
          items: [{ productId: 'kornbrot-500g', variant: '', quantity: 3 }],
        },
        '2026-11-12T09:00:00.000Z'
      )
    )
    expect(
      await screen.findByText(/neuer Code LA-2026-11-14-01/)
    ).toBeInTheDocument()
  })

  it('Abholtag inzwischen geschlossen: der Tag bleibt mit Hinweis stehen und lässt sich speichern (Z14)', async () => {
    const user = userEvent.setup()
    ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
      points: [POINT],
      pickupDays: pickupDays(),
    })
    mockUpdate.mockResolvedValue(preorder({ note: 'Bitte schneiden' }))
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    // Fr 13.11. ist laut Kalender zu - das Datum bleibt, kein Fehler
    const date = await screen.findByLabelText('Abholtag')
    expect(date).toHaveValue('2026-11-13')
    expect(
      await screen.findByText(
        'An diesem Tag ist die Bäckerei geschlossen (Betriebsferien) - der Abholtag bleibt stehen, bis er geändert wird.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Fr 13.11.' })).toBeNull()
    expect(screen.queryByText(/bitte einen anderen Abholtag wählen/)).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Kornbrot 500g eins mehr' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        7,
        { items: [{ productId: 'kornbrot-500g', variant: '', quantity: 3 }] },
        '2026-11-12T09:00:00.000Z'
      )
    )
    expect(date).toHaveValue('2026-11-13')
  })

  it('von der Sammelstelle in den Laden: der Montag ist dort Ruhetag und weicht aus (Z14)', async () => {
    const user = userEvent.setup()
    const monday = {
      ...POINT,
      id: 'montag-test',
      name: 'Montagsstelle',
      weekday: 1,
    }
    ;(fetchPickupPointInfo as jest.Mock).mockResolvedValue({
      points: [monday],
      pickupDays: pickupDays(),
    })
    const stored = preorder({
      code: 'MO-2026-11-16-01',
      channel: 'sammelstelle',
      pickupDate: '2026-11-16',
      pickupTime: null,
      pickupPointId: monday.id,
      pickupPoint: { id: monday.id, name: monday.name, window: monday.window },
    })
    mockGet.mockResolvedValue(stored)
    mockUpdate.mockResolvedValue(stored)
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    const date = await screen.findByLabelText('Abholtag')
    // an der Sammelstelle ist der gespeicherte Montag in Ordnung
    expect(date).toHaveValue('2026-11-16')
    await user.click(await screen.findByRole('radio', { name: 'Im Laden' }))
    // im Laden ist Montag Ruhetag: der nächste offene Tag (Fr 13./Sa 14.11.
    // sind zu) statt stillem Speichern
    expect(date).toHaveValue('2026-11-15')

    // von Hand zurück auf den Montag: Fehler, nichts wird gespeichert
    fireEvent.change(date, { target: { value: '2026-11-16' } })
    expect(
      await screen.findByText(
        'Am Montag, 16.11.2026, ist Ruhetag - bitte einen anderen Abholtag wählen.'
      )
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('Sitzung endet beim Bearbeiten: nach neuer Anmeldung sind die Änderungen wieder da und werden auf der alten Version gespeichert (W4-verify r6)', async () => {
    const store = window.sessionStorage as unknown as Record<string, jest.Mock>
    const data = new Map<string, string>()
    store.getItem.mockImplementation((k: string) => data.get(k) ?? null)
    store.setItem.mockImplementation((k: string, v: string) => {
      data.set(k, String(v))
    })
    store.removeItem.mockImplementation((k: string) => {
      data.delete(k)
    })
    const user = userEvent.setup()
    const first = renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    const name = await screen.findByLabelText(/^Name/)
    await user.clear(name)
    await user.type(name, 'Erika Geändert')
    await user.click(
      screen.getByRole('button', { name: 'Kornbrot 500g eins mehr' })
    )
    // Sitzung endet: die Seite verschwindet ohne Speichern.
    first.unmount()

    // Inzwischen hat ein anderes Gerät die Bestellung neu gespeichert.
    mockGet.mockResolvedValue(
      preorder({ updatedAt: '2026-11-12T09:30:00.000Z' })
    )
    renderAs('verkauf')
    expect(
      await screen.findByTestId('preorder-draft-restored')
    ).toHaveTextContent('Nicht gespeicherte Eingaben')
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Erika Geändert')
    mockUpdate.mockResolvedValue(preorder({ customerName: 'Erika Geändert' }))
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    // gespeichert wird auf der Fassung, auf der die Änderungen beruhen - der
    // Server sagt 409, statt das andere Gerät still zu überschreiben.
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        7,
        {
          customerName: 'Erika Geändert',
          items: [{ productId: 'kornbrot-500g', variant: '', quantity: 3 }],
        },
        '2026-11-12T09:00:00.000Z'
      )
    )
    await waitFor(() =>
      expect(
        Array.from(data.keys()).some((k) =>
          k.startsWith('bakery-management-preorder-edit')
        )
      ).toBe(false)
    )
  })

  it('„Abbrechen“ verwirft die Änderungen - beim nächsten Öffnen nichts wiederhergestellt (W4-verify r6)', async () => {
    const store = window.sessionStorage as unknown as Record<string, jest.Mock>
    const data = new Map<string, string>()
    store.getItem.mockImplementation((k: string) => data.get(k) ?? null)
    store.setItem.mockImplementation((k: string, v: string) => {
      data.set(k, String(v))
    })
    store.removeItem.mockImplementation((k: string) => {
      data.delete(k)
    })
    const user = userEvent.setup()
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    await user.type(await screen.findByLabelText(/^Name/), 'x')
    expect(data.size).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(data.size).toBe(0)
  })

  it('storniert erst nach Rückfrage - nichts wird gelöscht', async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue(preorder({ status: 'storniert' }))
    renderAs('verkauf')
    expect(
      await screen.findByRole('button', { name: 'Bearbeiten' })
    ).toBeInTheDocument()
    // selten gebraucht: im ⋮-Menü, nicht als eigener Knopf
    expect(screen.queryByRole('button', { name: 'Stornieren' })).toBeNull()
    await chooseMenu(user, 'Stornieren')
    // findBy/waitFor statt getBy: unter Last dauert der MUI-Übergang länger
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Gelöscht wird nichts/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Behalten' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockCancel).not.toHaveBeenCalled()

    await chooseMenu(user, 'Stornieren')
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Stornieren',
      })
    )
    await waitFor(() =>
      expect(mockCancel).toHaveBeenCalledWith(7, '2026-11-12T09:00:00.000Z')
    )
    expect(await screen.findByText('Storniert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
  })

  it('bezahlt und teurer geworden: Rest kassieren; Storno nennt die Erstattung (W4-verify r2)', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(
      preorder({ paid: true, paidAmount: 10, total: 10.9, paymentBalance: 0.9 })
    )
    mockStatus.mockResolvedValue(
      preorder({ paid: true, paidAmount: 10.9, total: 10.9, paymentBalance: 0 })
    )
    renderAs('verkauf')
    expect(await screen.findByTestId('payment-balance')).toHaveTextContent(
      /Bei der Abholung noch\s*0,90\s*€\s*kassieren/
    )
    await chooseMenu(user, 'Stornieren')
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('cancel-refund')).toHaveTextContent(
      /bereits bezahlt.*zurückgegeben/
    )
    await user.click(within(dialog).getByRole('button', { name: 'Behalten' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: /Rest kassiert/ }))
    await waitFor(() =>
      expect(mockStatus).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ paid: true }),
        expect.anything()
      )
    )
  })

  it('schon übergeben mit Rest: kein „bei der Abholung kassieren“; Fahrer ohne Knopf bekommt keinen „Erstattet“-Auftrag (W4-verify r3)', async () => {
    mockGet.mockResolvedValue(
      preorder({
        status: 'abgeholt',
        paid: true,
        paidAmount: 41.4,
        total: 45,
        paymentBalance: 3.6,
      })
    )
    const first = renderAs('fahrer')
    const note = await screen.findByTestId('payment-balance')
    expect(note).toHaveTextContent(/Ohne den Rest übergeben:\s*3,60\s*€/)
    expect(note).not.toHaveTextContent(/Bei der Abholung/)
    first.unmount()
    mockGet.mockResolvedValue(
      preorder({
        status: 'storniert',
        paid: true,
        paidAmount: 9,
        total: 9,
        paymentBalance: -9,
      })
    )
    renderAs('fahrer')
    const refund = await screen.findByTestId('payment-balance')
    expect(refund).toHaveTextContent('Erfassen kann das der Verkauf.')
    expect(refund).not.toHaveTextContent('Danach „Erstattet“ tippen.')
  })

  it('setzt Status und bezahlt; zeigt Fehler des Servers', async () => {
    const user = userEvent.setup()
    mockStatus.mockRejectedValueOnce(
      Object.assign(new Error('Status muss „offen“ … sein.'), {
        code: 'invalid_status',
      })
    )
    mockStatus.mockResolvedValueOnce(preorder({ paid: true }))
    renderAs('verkauf')
    await chooseMenu(user, 'Abgeholt')
    expect(
      await screen.findByText('Status muss „offen“ … sein.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bezahlt' }))
    await waitFor(() =>
      expect(mockStatus).toHaveBeenLastCalledWith(
        7,
        { paid: true },
        '2026-11-12T09:00:00.000Z'
      )
    )
  })

  it('veraltete Anzeige: 409 stale_preorder lädt neu und überschreibt nichts', async () => {
    const user = userEvent.setup()
    // inzwischen hat der Fahrer übergeben und kassiert
    const handedOver = preorder({
      status: 'abgeholt',
      paid: true,
      updatedAt: '2026-11-12T09:05:00.000Z',
    })
    mockStatus.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'Diese Vorbestellung wurde inzwischen an anderer Stelle geändert.'
        ),
        { code: 'stale_preorder', status: 409 }
      )
    )
    renderAs('verkauf')
    await screen.findByRole('button', { name: 'Bearbeiten' })
    mockGet.mockResolvedValue(handedOver)
    await chooseMenu(user, 'Abgeholt')
    expect(await screen.findByTestId('preorder-conflict')).toHaveTextContent(
      /inzwischen an anderer Stelle geändert.*nichts überschrieben/
    )
    expect(mockGet).toHaveBeenCalledTimes(2)
    // neu geladen: abgeholt + bezahlt, also kein Bearbeiten mehr
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    )
    // abgeholt + bezahlt: „Doch nicht bezahlt“ steht im ⋮-Menü
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Doch nicht bezahlt' })
    ).toBeInTheDocument()
    expect(mockStatus).toHaveBeenCalledTimes(1)
  })

  it('Bearbeiten: 409 stale_preorder schließt die Maske und zeigt den neuen Stand', async () => {
    const user = userEvent.setup()
    mockUpdate.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'Diese Vorbestellung wurde inzwischen an anderer Stelle geändert.'
        ),
        { code: 'stale_preorder', status: 409 }
      )
    )
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Bearbeiten' }))
    await screen.findByRole('heading', { name: /bearbeiten/ })
    // nur die Anmerkung ergänzt: `paid` und Positionen gehen nicht mit
    const note = screen.getByLabelText(/^Notiz/)
    await user.type(note, 'Bitte schneiden')
    mockGet.mockResolvedValue(
      preorder({
        status: 'abgeholt',
        paid: true,
        updatedAt: '2026-11-12T09:05:00.000Z',
      })
    )
    await user.click(
      screen.getByRole('button', { name: 'Änderungen speichern' })
    )
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        7,
        { note: 'Bitte schneiden' },
        '2026-11-12T09:00:00.000Z'
      )
    )
    // Die eigene Eingabe ist NICHT gespeichert und steht da (W4-verify r4).
    expect(await screen.findByTestId('preorder-conflict')).toHaveTextContent(
      /Ihre Änderung wurde NICHT gespeichert: Notiz „Bitte schneiden“/
    )
    expect(screen.getByTestId('preorder-conflict')).not.toHaveTextContent(
      /nichts überschrieben/
    )
    expect(screen.queryByRole('heading', { name: /bearbeiten/ })).toBeNull()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    )
    // abgeholt + bezahlt: „Doch nicht bezahlt“ steht im ⋮-Menü
    await user.click(screen.getByRole('button', { name: 'Weitere Aktionen' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Doch nicht bezahlt' })
    ).toBeInTheDocument()
  })

  it('storniert: „Storno aufheben“ erst nach Rückfrage', async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(preorder({ status: 'storniert' }))
    mockStatus.mockResolvedValue(preorder({ status: 'offen' }))
    renderAs('verkauf')
    await user.click(
      await screen.findByRole('button', { name: 'Storno aufheben' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/wieder für die Backstube/)
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Storniert lassen' })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockStatus).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Storno aufheben' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Storno aufheben',
      })
    )
    await waitFor(() =>
      expect(mockStatus).toHaveBeenCalledWith(
        7,
        { status: 'offen' },
        '2026-11-12T09:00:00.000Z'
      )
    )
  })

  it('abgeholt: kein Bearbeiten, kein Stornieren, nur zurück auf „Offen“', async () => {
    mockGet.mockResolvedValue(preorder({ status: 'abgeholt' }))
    renderAs('verkauf')
    expect(
      await screen.findByRole('button', { name: /Auf „Offen“ zurück/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stornieren' })).toBeNull()
  })

  it('Fahrer sehen die Bestellung nur', async () => {
    renderAs('fahrer')
    expect(
      await screen.findByRole('heading', { name: 'LA-2026-11-13-01' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stornieren' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Aktionen' })).toBeNull()
  })

  it('meldet eine fehlende Bestellung', async () => {
    mockGet.mockRejectedValue(
      Object.assign(new Error('Diese Vorbestellung existiert nicht.'), {
        status: 404,
      })
    )
    renderAs('verkauf')
    expect(
      await screen.findByText('Diese Vorbestellung existiert nicht.')
    ).toBeInTheDocument()
  })
})

describe('detailActions', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { detailActions } = require('./PreorderDetailClient')
  const keys = (p: ReturnType<typeof preorder>, editable = true) =>
    detailActions(p, editable).map(
      (a: { key: string; inMenu?: boolean; primary?: boolean }) =>
        `${a.primary ? '*' : ''}${a.key}${a.inMenu ? '…' : ''}`
    )

  it('zeigt sichtbar nur den nächsten Schritt, den Rest im Menü', () => {
    expect(keys(preorder({ status: 'offen' }))).toEqual([
      '*edit',
      'ready',
      'pickedUp…',
      'paid',
      'cancel…',
    ])
    expect(keys(preorder({ status: 'bereit', paid: true }))).toEqual([
      '*edit',
      'pickedUp',
      'unpaid…',
      'reopen…',
      'cancel…',
    ])
    expect(keys(preorder({ status: 'abgeholt' }), false)).toEqual([
      '*paid',
      'reopen',
    ])
  })

  it('offenes Geld ist die Hauptaktion, genau eine ist primary', () => {
    const list = keys(
      preorder({ paid: true, paidAmount: 10, total: 10.9, paymentBalance: 0.9 })
    )
    expect(list[0]).toBe('*settle')
    expect(list.filter((k: string) => k.startsWith('*'))).toHaveLength(1)
    expect(
      keys(
        preorder({ status: 'storniert', paid: true, paymentBalance: -4.8 }),
        false
      )
    ).toEqual(['*refundCancelled', 'uncancel'])
    // Bezahlt abgeholt: nur Zurücknehmen bleibt - das ist kein Hauptknopf.
    expect(keys(preorder({ status: 'abgeholt', paid: true }), false)).toEqual([
      'unpaid…',
      'reopen',
    ])
  })
})
