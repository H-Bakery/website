import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeRegistry from '../components/ThemeRegistry'
import Fehlerseite from './error'

describe('Fehlerseite (app/error.tsx)', () => {
  it('meldet den Fehler auf Deutsch und bietet einen zweiten Versuch an', async () => {
    const reset = jest.fn()
    render(
      <ThemeRegistry>
        <Fehlerseite reset={reset} />
      </ThemeRegistry>
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Die Digitale Bäckerei konnte gerade nicht angezeigt werden.'
    )
    expect(
      screen.getByRole('heading', { name: 'Da ist etwas schiefgegangen' })
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/error|exception/i)
    await userEvent.click(
      screen.getByRole('button', { name: 'Noch einmal versuchen' })
    )
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
