import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Quellen from './Quellen'
import { VERBOTEN, zeige } from './testdaten'

describe('Quellen', () => {
  it('ist zuerst nur ein kleiner Eintrag', () => {
    zeige(<Quellen />)
    expect(screen.getByRole('button', { name: 'Quellen' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('nennt im Dialog Geodaten, OpenStreetMap, das Modell und die Rechte der Bäckerei', async () => {
    const user = userEvent.setup()
    zeige(<Quellen />)
    await user.click(screen.getByRole('button', { name: 'Quellen' }))
    const dialog = screen.getByRole('dialog', { name: 'Quellen' })
    const text = dialog.textContent ?? ''
    expect(text).toContain('© GeoBasis-DE/LVGL-SL (2026), dl-de/by-2-0')
    expect(text).toContain('© OpenStreetMap-Mitwirkende, ODbL')
    expect(text).toContain('Saar LiDAR Explorer (Code unter MIT-Lizenz)')
    expect(text).toContain(
      'Name, Schriftzug und Texte gehören der Bäckerei Heusser.'
    )
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(4)
    for (const link of within(dialog).getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
    expect(text).not.toMatch(VERBOTEN)
  })

  it('schließt über „Schließen“ und mit Escape', async () => {
    const user = userEvent.setup()
    zeige(<Quellen />)
    await user.click(screen.getByRole('button', { name: 'Quellen' }))
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Quellen' }))
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
})
