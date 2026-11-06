import React from 'react'
import { render, screen } from '@testing-library/react'
import NotFound from './not-found'

describe('NotFound (404)', () => {
  it('ist deutsch und führt zur Startseite zurück', () => {
    render(<NotFound />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Zur Startseite' })
    ).toHaveAttribute('href', '/admin')
    expect(screen.queryByText(/could not be found/i)).not.toBeInTheDocument()
  })
})
