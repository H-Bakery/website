import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RaumWechsel, { RAUM_WECHSELN_TEXT } from './RaumWechsel'
import { zeige } from './testdaten'

const WERKSTATT = { id: 'werkstatt', wechsel: 'In die Werkstatt' }
const KELLER = { id: 'keller', wechsel: 'In den Keller' }

describe('RaumWechsel', () => {
  it('ohne anderen Raum gibt es keinen Knopf', () => {
    zeige(<RaumWechsel ziele={[]} onWechsel={jest.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('ein anderer Raum: ein Knopf mit seiner Beschriftung führt direkt hinein', async () => {
    const onWechsel = jest.fn()
    zeige(<RaumWechsel ziele={[WERKSTATT]} onWechsel={onWechsel} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'In die Werkstatt' })
    )
    expect(onWechsel).toHaveBeenCalledWith('werkstatt')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('mehrere andere Räume: „Raum wechseln“ öffnet die Auswahl', async () => {
    const onWechsel = jest.fn()
    zeige(<RaumWechsel ziele={[WERKSTATT, KELLER]} onWechsel={onWechsel} />)
    const knopf = screen.getByRole('button', { name: RAUM_WECHSELN_TEXT })
    expect(knopf).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(knopf)
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['In die Werkstatt', 'In den Keller'])
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'In den Keller' })
    )
    expect(onWechsel).toHaveBeenCalledWith('keller')
  })
})
