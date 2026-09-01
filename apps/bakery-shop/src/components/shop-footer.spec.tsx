import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { shopTheme } from '../theme/theme'
import { ShopFooter } from './shop-footer'

function renderFooter() {
  return render(
    <ThemeProvider theme={shopTheme}>
      <ShopFooter />
    </ThemeProvider>
  )
}

describe('ShopFooter', () => {
  it('nennt die echte Adresse in Homburg', () => {
    renderFooter()

    expect(screen.getByTestId('shop-footer')).toBeInTheDocument()
    expect(screen.getByText('Eckstraße 3')).toBeInTheDocument()
    expect(screen.getByText('66424 Homburg')).toBeInTheDocument()
  })

  it('macht die Telefonnummer anrufbar', () => {
    renderFooter()

    expect(screen.getByText('06841 2229')).toHaveAttribute(
      'href',
      'tel:+4968412229'
    )
  })

  it('zeigt die Öffnungszeiten ab 05:30 Uhr', () => {
    renderFooter()

    expect(screen.getByText('Di – Fr')).toBeInTheDocument()
    expect(screen.getByText('05:30 – 13:30 Uhr')).toBeInTheDocument()
    expect(screen.getByText('05:30 – 12:30 Uhr')).toBeInTheDocument()
    expect(screen.getByText('Ruhetag')).toBeInTheDocument()
  })

  it('verlinkt die Rechtstexte auf der Website', () => {
    renderFooter()

    expect(screen.getByText('Impressum')).toHaveAttribute(
      'href',
      'https://xn--bckerei-heusser-0kb.de/imprint'
    )
    expect(screen.getByText('Datenschutz')).toHaveAttribute(
      'href',
      'https://xn--bckerei-heusser-0kb.de/datenschutz'
    )
  })

  it('weist auf Bruttopreise hin', () => {
    renderFooter()

    expect(screen.getByText(/inkl\. MwSt\./)).toBeInTheDocument()
  })

  it('wiederholt keine Marketing-Inhalte der Landingpage', () => {
    renderFooter()

    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Newsletter/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Über uns/i)).not.toBeInTheDocument()
  })
})
