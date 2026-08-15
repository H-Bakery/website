import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import DatenschutzPage from './page'

describe('DatenschutzPage', () => {
  it('renders the page title', () => {
    renderWithTheme(<DatenschutzPage />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Datenschutzerklärung' })
    ).toBeInTheDocument()
  })

  it('names the controller', () => {
    renderWithTheme(<DatenschutzPage />)
    expect(screen.getByText(/Verantwortliche Stelle/)).toBeInTheDocument()
    expect(screen.getByText(/Inhaber: Karl-Heinz Heußer/)).toBeInTheDocument()
  })

  it('covers hosting, contact, WhatsApp and OpenStreetMap', () => {
    renderWithTheme(<DatenschutzPage />)
    expect(
      screen.getByRole('heading', { name: 'GitHub Pages' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'WhatsApp' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Kartendienst OpenStreetMap/ })
    ).toBeInTheDocument()
  })

  it('informs about data subject rights and the supervisory authority', () => {
    renderWithTheme(<DatenschutzPage />)
    expect(
      screen.getByText(/Widerspruchsrecht \(Art. 21 DSGVO\)/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Unabhängiges Datenschutzzentrum Saarland/)
    ).toBeInTheDocument()
  })
})
