import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlickpunktLeiste from './BlickpunktLeiste'
import { BLICKPUNKTE, VERBOTEN, zeige } from './testdaten'

function setup(
  props: Partial<React.ComponentProps<typeof BlickpunktLeiste>> = {}
) {
  const onWechsel = jest.fn()
  const onAllesHier = jest.fn()
  zeige(
    <BlickpunktLeiste
      blickpunkte={BLICKPUNKTE}
      aktiv="theke"
      onWechsel={onWechsel}
      onAllesHier={onAllesHier}
      {...props}
    />
  )
  return { user: userEvent.setup(), onWechsel, onAllesHier }
}

describe('BlickpunktLeiste', () => {
  it('zeigt je Blickpunkt einen Knopf in einer Liste innerhalb der Navigation', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Blickpunkte' })
    expect(within(nav).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Theke', 'Brotregal', 'Regale'])
  })

  it('markiert nur den aktiven Blickpunkt mit aria-current und einem Zeichen', () => {
    setup({ aktiv: 'brotregal' })
    const aktiv = screen.getByRole('button', { name: 'Brotregal' })
    expect(aktiv).toHaveAttribute('aria-current', 'true')
    expect(aktiv.querySelector('svg')).not.toBeNull()
    for (const name of ['Theke', 'Regale']) {
      const knopf = screen.getByRole('button', { name })
      expect(knopf).not.toHaveAttribute('aria-current')
      expect(knopf.querySelector('svg')).toBeNull()
    }
  })

  it('wechselt beim Tippen auf einen Chip', async () => {
    const { user, onWechsel } = setup()
    await user.click(screen.getByRole('button', { name: 'Regale' }))
    expect(onWechsel).toHaveBeenCalledWith('regale')
  })

  it('hat Pfeile mit dem Namen des Nachbarn; sie laufen im Kreis', async () => {
    const { user, onWechsel } = setup({ aktiv: 'theke' })
    await user.click(
      screen.getByRole('button', { name: 'Vorheriger Blickpunkt: Regale' })
    )
    expect(onWechsel).toHaveBeenLastCalledWith('regale')
    await user.click(
      screen.getByRole('button', { name: 'Nächster Blickpunkt: Brotregal' })
    )
    expect(onWechsel).toHaveBeenLastCalledWith('brotregal')
  })

  it('lässt die Pfeile weg, wenn es nur einen Blickpunkt gibt', () => {
    setup({ blickpunkte: BLICKPUNKTE.slice(0, 1) })
    expect(
      screen.queryByRole('button', { name: /Blickpunkt:/ })
    ).not.toBeInTheDocument()
  })

  it('ist mit der Tastatur bedienbar', async () => {
    const { user, onWechsel } = setup()
    act(() => screen.getByRole('button', { name: 'Brotregal' }).focus())
    await user.keyboard('{Enter}')
    expect(onWechsel).toHaveBeenCalledWith('brotregal')
  })

  it('öffnet „Alles hier“ und lässt den Knopf ohne Funktion weg', async () => {
    const { user, onAllesHier } = setup()
    await user.click(screen.getByRole('button', { name: 'Alles hier' }))
    expect(onAllesHier).toHaveBeenCalledTimes(1)
  })

  it('ohne onAllesHier gibt es den Knopf nicht', () => {
    setup({ onAllesHier: undefined })
    expect(
      screen.queryByRole('button', { name: 'Alles hier' })
    ).not.toBeInTheDocument()
  })

  it('enthält den Eintrag „Quellen“, der den Dialog öffnet', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Quellen' }))
    expect(screen.getByRole('dialog', { name: 'Quellen' })).toBeInTheDocument()
  })

  it('nennt weder Kosten noch Inhaltsstoff-Hinweise', () => {
    setup()
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })
})
