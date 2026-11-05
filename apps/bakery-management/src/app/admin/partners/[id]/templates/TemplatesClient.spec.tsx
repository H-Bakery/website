import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import TemplatesClient from './TemplatesClient'
import { fetchPartner, fetchTemplates } from '../../../../../lib/partnerApi'
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
  })
})
