import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '@bakery/shared/test-utils'
import Filter, { ALL_CATEGORIES } from './Filter'

const KATEGORIEN = [
  'Alle',
  'Brot',
  'Baguette',
  'Brötchen',
  'Teilchen',
  'Snacks',
  'Kuchen',
  'Torten',
]

/** Hält den Wert selbst, wie die Produktliste. */
function Controlled({ onChange }: { onChange?: (c: string) => void }) {
  const [value, setValue] = React.useState(ALL_CATEGORIES)
  return (
    <Filter
      value={value}
      onChange={(c) => {
        setValue(c)
        onChange?.(c)
      }}
    />
  )
}

const pressed = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent)

describe('Filter (Kategorie-Kacheln)', () => {
  it('zeigt acht Umschalt-Buttons Alle bis Torten in einer Gruppe „Kategorie“', () => {
    renderWithTheme(<Controlled />)

    const group = screen.getByRole('group', { name: 'Kategorie' })
    expect(group).toBeInTheDocument()
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(KATEGORIEN)
    // Echte Buttons: per Tab erreichbar.
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    }
  })

  it('setzt aria-pressed nur auf der gewählten Kategorie', () => {
    renderWithTheme(<Filter value="Brot" onChange={jest.fn()} />)

    expect(pressed()).toEqual(['Brot'])
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('wählt per Klick', async () => {
    const onChange = jest.fn()
    renderWithTheme(<Controlled onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Kuchen' }))

    expect(onChange).toHaveBeenCalledWith('Kuchen')
    expect(pressed()).toEqual(['Kuchen'])
  })

  it('lässt sich mit Tab, Enter und Leertaste bedienen', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()
    renderWithTheme(<Controlled onChange={onChange} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Brot' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('Brot')
    expect(pressed()).toEqual(['Brot'])

    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Brötchen' })).toHaveFocus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith('Brötchen')
    expect(pressed()).toEqual(['Brötchen'])
  })
})
