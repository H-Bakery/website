import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PriceListDialog from './PriceListDialog'
import { fetchPartners } from '../../../../lib/partnerApi'
import { downloadPriceListCsv } from '../../../../lib/priceListApi'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/admin/products',
}))
jest.mock('../../../../lib/partnerApi', () => ({
  ...jest.requireActual('../../../../lib/partnerApi'),
  fetchPartners: jest.fn(),
}))
jest.mock('../../../../lib/priceListApi', () => ({
  ...jest.requireActual('../../../../lib/priceListApi'),
  downloadPriceListCsv: jest.fn(async () => undefined),
}))

const mockPartners = fetchPartners as jest.MockedFunction<typeof fetchPartners>
const mockCsv = downloadPriceListCsv as jest.MockedFunction<
  typeof downloadPriceListCsv
>

const CATEGORIES = [
  { key: 'brot', label: 'Brot', count: 3 },
  { key: 'kuchen', label: 'Kuchen', count: 2 },
  { key: 'torten', label: 'Torten', count: 1 },
]

const PARTNER = {
  id: 7,
  name: 'Testmarkt Musterstadt',
  slug: 'testmarkt',
  street: '',
  zip: '',
  city: '',
  contactName: null,
  phone: null,
  email: null,
  deliveryDays: [2, 3],
  settlementModel: 'commission' as const,
  active: true,
  notes: null,
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof PriceListDialog>> = {}
) {
  const onClose = jest.fn()
  renderWithTheme(
    <PriceListDialog
      open
      onClose={onClose}
      categories={CATEGORIES}
      canPartner
      {...props}
    />
  )
  return { onClose }
}

describe('PriceListDialog', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockCsv.mockClear()
    mockPartners.mockReset()
  })

  it('führt ohne Auswahl zur ganzen Ladenliste', async () => {
    const { onClose } = renderDialog()
    expect(
      screen.getByRole('heading', { name: 'Preisliste erstellen' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ohne Auswahl: alle Kategorien.')
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Ansehen und drucken' })
    )
    expect(mockPush).toHaveBeenCalledWith('/admin/products/preisliste')
    expect(onClose).toHaveBeenCalled()
  })

  it('gibt Kategorien, Allergene und nicht verfügbare Produkte weiter', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Brot 3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Torten 1' }))
    expect(screen.getByText('2 von 3 gewählt.')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Mit Allergenen'))
    await userEvent.click(
      screen.getByLabelText('Auch nicht verfügbare Produkte (gekennzeichnet)')
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Ansehen und drucken' })
    )
    expect(mockPush).toHaveBeenCalledWith(
      '/admin/products/preisliste?categories=brot%2Ctorten&includeUnavailable=1&allergens=1'
    )
  })

  it('lädt das CSV mit der Auswahl', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Kuchen 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'CSV (Excel)' }))
    expect(mockCsv).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'laden', categories: ['kuchen'] })
    )
  })

  it('bietet dem Verkauf keine Partnerliste an', () => {
    renderDialog({ canPartner: false })
    expect(screen.queryByLabelText('Verkaufspartner')).not.toBeInTheDocument()
    expect(mockPartners).not.toHaveBeenCalled()
  })

  it('Partnerliste: wählt den einzigen Partner vor und sagt, was die Preise sind', async () => {
    mockPartners.mockResolvedValue([
      PARTNER,
      { ...PARTNER, id: 8, active: false },
    ])
    renderDialog()
    await userEvent.click(screen.getByLabelText('Verkaufspartner'))
    expect(await screen.findByText('Testmarkt Musterstadt')).toBeInTheDocument()
    expect(screen.getByTestId('partner-price-hint')).toHaveTextContent(
      'Rabatte oder ein Provisionssatz sind nicht hinterlegt'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Ansehen und drucken' })
    )
    expect(mockPush).toHaveBeenCalledWith(
      '/admin/products/preisliste?audience=partner&partnerId=7'
    )
  })

  it('weist auf wartende Änderungen hin', () => {
    renderDialog({ pendingCount: 2 })
    expect(
      screen.getByText(/2 Änderungen warten auf Freigabe/)
    ).toBeInTheDocument()
  })
})
