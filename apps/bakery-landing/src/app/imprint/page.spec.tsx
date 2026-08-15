import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import ImprintPage from './page'
import { LEGAL } from '../../config/legal'

describe('ImprintPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<ImprintPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Impressum' })
    ).toBeInTheDocument()
  })

  it('displays provider information according to § 5 DDG', () => {
    renderWithTheme(<ImprintPage />)
    expect(screen.getByText(/Angaben gemäß § 5 DDG/)).toBeInTheDocument()
    expect(screen.getByText(/Inhaber: Karl-Heinz Heußer/)).toBeInTheDocument()
    expect(screen.getByText(/Eckstraße 3/)).toBeInTheDocument()
    expect(
      screen.getAllByText(/66424 Homburg\/Kirrberg/).length
    ).toBeGreaterThan(0)
  })

  it('shows contact details', () => {
    renderWithTheme(<ImprintPage />)
    expect(screen.getByText(LEGAL.phone)).toBeInTheDocument()
    expect(screen.getByText(LEGAL.mobile)).toBeInTheDocument()
    expect(screen.getByText(LEGAL.email)).toBeInTheDocument()
  })

  it('includes the VAT id', () => {
    renderWithTheme(<ImprintPage />)
    expect(screen.getByText(/USt-IdNr: DE356803905/)).toBeInTheDocument()
  })

  it('includes craft chamber and profession', () => {
    renderWithTheme(<ImprintPage />)
    expect(
      screen.getByText(/Handwerkskammer des Saarlandes/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Bäckermeister/)).toBeInTheDocument()
  })

  it('displays the editorially responsible person (§ 18 Abs. 2 MStV)', () => {
    renderWithTheme(<ImprintPage />)
    expect(screen.getByText(/§ 18 Abs. 2 MStV/)).toBeInTheDocument()
    expect(screen.getByText(/Sebastian Heußer/)).toBeInTheDocument()
  })

  it('does not link the discontinued EU ODR platform', () => {
    renderWithTheme(<ImprintPage />)
    expect(screen.queryByText(/ec\.europa\.eu\/consumers\/odr/)).toBeNull()
  })

  it('links to the privacy policy', () => {
    renderWithTheme(<ImprintPage />)
    const link = screen.getByRole('link', { name: 'Datenschutzerklärung' })
    expect(link).toHaveAttribute('href', '/datenschutz')
  })
})
