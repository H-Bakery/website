import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PreorderDetailClient from './PreorderDetailClient'
import {
  cancelPreorder,
  changePreorderStatus,
  fetchCatalogue,
  fetchPickupPoints,
  fetchPreorderVariants,
  getPreorder,
  updatePreorder,
} from '../../../../lib/preordersApi'
import {
  CATALOGUE,
  ONLY_DATE,
  POINT,
  preorder,
} from '../../../../lib/testing/preorderFixtures'
import { WithSession, fakeSession } from '../../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../../lib/roles'

jest.mock('../../../../lib/preordersApi', () => ({
  ...jest.requireActual('../../../../lib/preordersApi'),
  cancelPreorder: jest.fn(),
  changePreorderStatus: jest.fn(),
  fetchCatalogue: jest.fn(),
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
  ;(fetchPreorderVariants as jest.Mock).mockResolvedValue({
    configured: false,
    products: {},
  })
})

afterEach(() => jest.useRealTimers())

describe('PreorderDetailClient (P3)', () => {
  it('zeigt Code, Status, Kunde, Positionen mit Preis-Snapshot', async () => {
    renderAs('verkauf')
    expect(
      await screen.findByRole('heading', { name: 'LA-2026-11-13-01' })
    ).toBeInTheDocument()
    expect(screen.getByText('Offen')).toBeInTheDocument()
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

  it('storniert erst nach Rückfrage - nichts wird gelöscht', async () => {
    const user = userEvent.setup()
    mockCancel.mockResolvedValue(preorder({ status: 'storniert' }))
    renderAs('verkauf')
    await user.click(await screen.findByRole('button', { name: 'Stornieren' }))
    // findBy/waitFor statt getBy: unter Last dauert der MUI-Übergang länger
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Gelöscht wird nichts/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Behalten' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mockCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Stornieren' }))
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
    await user.click(screen.getByRole('button', { name: 'Stornieren' }))
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
    await user.click(await screen.findByRole('button', { name: 'Abgeholt' }))
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
    const pickedUp = await screen.findByRole('button', { name: 'Abgeholt' })
    mockGet.mockResolvedValue(handedOver)
    await user.click(pickedUp)
    expect(await screen.findByTestId('preorder-conflict')).toHaveTextContent(
      /inzwischen an anderer Stelle geändert.*nichts überschrieben/
    )
    expect(mockGet).toHaveBeenCalledTimes(2)
    // neu geladen: abgeholt + bezahlt, also kein Bearbeiten mehr
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    )
    expect(
      screen.getByRole('button', { name: 'Doch nicht bezahlt' })
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
    const note = screen.getByLabelText(/Notiz/)
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
    expect(await screen.findByTestId('preorder-conflict')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /bearbeiten/ })).toBeNull()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
    )
    expect(
      screen.getByRole('button', { name: 'Doch nicht bezahlt' })
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
