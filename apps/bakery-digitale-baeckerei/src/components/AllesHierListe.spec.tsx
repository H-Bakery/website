import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AllesHierListe, { LISTE_LEER_TEXT } from './AllesHierListe'
import { EINTRAEGE, VERBOTEN, zeige } from './testdaten'

function setup(
  props: Partial<React.ComponentProps<typeof AllesHierListe>> = {}
) {
  const onSelect = jest.fn()
  const onClose = jest.fn()
  zeige(
    <AllesHierListe
      offen
      eintraege={EINTRAEGE}
      blickpunktName="Theke"
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />
  )
  return { user: userEvent.setup(), onSelect, onClose }
}

describe('AllesHierListe', () => {
  it('zeigt geschlossen nichts', () => {
    setup({ offen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ist ein Dialog mit dem Namen des Blickpunkts', () => {
    setup()
    expect(
      screen.getByRole('dialog', { name: 'Alles hier: Theke' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Alles hier: Theke' })
    ).toBeInTheDocument()
  })

  it('zeigt jedes Produkt einmal, nach Name sortiert, als Liste aus Knöpfen', () => {
    setup()
    const liste = screen.getByRole('list')
    const zeilen = within(liste).getAllByRole('listitem')
    expect(zeilen).toHaveLength(4)
    const knoepfe = within(liste).getAllByRole('button')
    expect(knoepfe.map((k) => k.tagName)).toEqual(Array(4).fill('BUTTON'))
    expect(knoepfe.map((k) => k.textContent)).toEqual([
      'Äpfeltasche1 Stück',
      'Probeweck',
      'Testbrot500 g',
      'Zimtkringel',
    ])
  })

  it('zeigt die Stückzahl nicht', () => {
    setup()
    const text = screen.getByRole('list').textContent ?? ''
    expect(text).not.toMatch(/\b(4|7|9|12)\b/)
  })

  it('meldet beim Tippen den ersten Platz des Produkts', async () => {
    const { user, onSelect } = setup()
    await user.click(screen.getByRole('button', { name: /Testbrot/ }))
    expect(onSelect).toHaveBeenCalledWith('theke/vitrine/ebene-1/platz-01')
  })

  it('lässt sich mit der Tastatur wählen', async () => {
    const { user, onSelect } = setup()
    act(() => screen.getByRole('button', { name: /Zimtkringel/ }).focus())
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('theke/vitrine/ebene-1/platz-03')
  })

  it('sagt, wenn hier nichts liegt', () => {
    setup({ eintraege: [] })
    expect(screen.getByText(LISTE_LEER_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('schließt über den Knopf und mit Escape', async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('nennt weder Kosten noch Inhaltsstoff-Hinweise', () => {
    setup()
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })
})
