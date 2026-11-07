import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import TemplatesClient from './TemplatesClient'
import {
  fetchPartner,
  fetchTemplates,
  saveTemplate,
} from '../../../../../lib/partnerApi'
import {
  fakeSession,
  WithSession,
} from '../../../../../lib/testing/fakeSession'
import type { CatalogueProduct, Partner } from '../../../../../lib/partnerTypes'

jest.mock('../../../../../lib/partnerApi', () => ({
  fetchPartner: jest.fn(),
  fetchTemplates: jest.fn(),
  saveTemplate: jest.fn(),
}))

const mockFetchPartner = fetchPartner as jest.MockedFunction<
  typeof fetchPartner
>
const mockFetchTemplates = fetchTemplates as jest.MockedFunction<
  typeof fetchTemplates
>

const PARTNER: Partner = {
  id: 1,
  name: 'Testmarkt Musterstadt',
  slug: 'testmarkt',
  street: 'Musterweg 1',
  zip: '00000',
  city: 'Musterstadt',
  contactName: null,
  phone: null,
  email: null,
  deliveryDays: [2, 3],
  settlementModel: 'commission',
  active: true,
  notes: null,
}

const PRODUCT: CatalogueProduct = {
  productId: 1,
  productSlug: 'musterbrot',
  productName: 'Musterbrot',
  unitPrice: 3.2,
  category: 'brot',
  categoryLabel: 'Brot',
  available: true,
}

function renderTemplates() {
  return (
    <TemplatesClient
      partnerId="1"
      catalogue={[PRODUCT]}
      groups={[{ category: 'brot', label: 'Brot', products: [PRODUCT] }]}
    />
  )
}

describe('TemplatesClient - Rollen (F4)', () => {
  beforeEach(() => {
    mockFetchPartner.mockResolvedValue(PARTNER)
    mockFetchTemplates.mockResolvedValue([])
  })

  it('Inhaber kann speichern', async () => {
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        {renderTemplates()}
      </WithSession>
    )
    expect(
      await screen.findByRole('button', { name: /Speichern/ })
    ).toBeInTheDocument()
    expect(screen.queryByText(/ändert nur der Inhaber/)).toBeNull()
  })

  it('Verkauf sieht die Bestückung ohne Speichern', async () => {
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'verkauf' })}>
        {renderTemplates()}
      </WithSession>
    )
    expect(
      await screen.findByText(/Standard-Bestückung ändert nur der Inhaber/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Speichern/ })).toBeNull()
    // W4-Verifikation: nichts eintippen, was nie gespeichert werden kann.
    expect(screen.getByLabelText('Menge Musterbrot')).toBeDisabled()
  })

  it('Inhaber: mehr als 10.000 Stück je Position werden nicht gespeichert (W4-Verifikation)', async () => {
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        {renderTemplates()}
      </WithSession>
    )
    const input = await screen.findByLabelText('Menge Musterbrot')
    fireEvent.change(input, { target: { value: '250000' } })
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    expect(
      await screen.findByText(/250\.000 Stück sind zu viel - höchstens 10\.000/)
    ).toBeInTheDocument()
    expect(saveTemplate).not.toHaveBeenCalled()
    // Gruppenkopf in richtiger Einzahl.
    expect(screen.getByText('1 Position · 250000 Stück')).toBeInTheDocument()
  })

  it('fragt nach, bevor ein Link ungespeicherte Mengen verwirft', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        <>
          {renderTemplates()}
          <a href="/admin/partners">Seitenleiste</a>
        </>
      </WithSession>
    )
    const input = await screen.findByLabelText('Menge Musterbrot')
    const link = screen.getByRole('link', { name: 'Seitenleiste' })

    // Ohne Änderung: keine Rückfrage.
    fireEvent.click(link)
    expect(confirm).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '12' } })
    // „Abbrechen“ in der Rückfrage: der Klick wird verworfen (vorher
    // wechselte die Seite still, die Mengen waren weg).
    expect(fireEvent.click(link)).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)

    confirm.mockReturnValue(true)
    expect(fireEvent.click(link)).toBe(true)
    confirm.mockRestore()
  })

  it('meldet das Speichern in der Leiste, ohne Snackbar über den Knöpfen', async () => {
    ;(saveTemplate as jest.Mock).mockResolvedValue({})
    renderWithTheme(
      <WithSession value={fakeSession({ role: 'inhaber' })}>
        {renderTemplates()}
      </WithSession>
    )
    const input = await screen.findByLabelText('Menge Musterbrot')
    fireEvent.change(input, { target: { value: '12' } })
    expect(screen.getByRole('status')).toHaveTextContent('Nicht gespeichert')
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))

    expect(await screen.findByText('Dienstag gespeichert')).toBeInTheDocument()
    expect(document.querySelector('.MuiSnackbar-root')).toBeNull()
    expect(saveTemplate).toHaveBeenCalledWith('1', 2, [
      { productId: 1, productSlug: 'musterbrot', quantity: 12 },
    ])
  })
})
