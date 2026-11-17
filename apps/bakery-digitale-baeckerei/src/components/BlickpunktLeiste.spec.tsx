import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BlickpunktLeiste from './BlickpunktLeiste'
import { BLICKPUNKTE, VERBOTEN, zeige } from './testdaten'
import { LEISTE_HOEHE_VAR } from './theme'

function setup(
  props: Partial<React.ComponentProps<typeof BlickpunktLeiste>> = {}
) {
  const onWechsel = jest.fn()
  const onAllesHier = jest.fn()
  const view = zeige(
    <BlickpunktLeiste
      blickpunkte={BLICKPUNKTE}
      aktiv="theke"
      onWechsel={onWechsel}
      onAllesHier={onAllesHier}
      {...props}
    />
  )
  return {
    user: userEvent.setup(),
    onWechsel,
    onAllesHier,
    unmount: view.unmount,
  }
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

  describe('Höhe für Karte und Hinweis', () => {
    /** Ein nachgebauter ResizeObserver: Die Spec meldet die Größe selbst. */
    let melde: (hoehe: number) => void
    const beobachtet: Element[] = []
    const getrennt = jest.fn()
    const original = window.ResizeObserver

    beforeEach(() => {
      beobachtet.length = 0
      getrennt.mockClear()
      window.ResizeObserver = class {
        constructor(rueckruf: ResizeObserverCallback) {
          melde = (hoehe) =>
            act(() =>
              rueckruf(
                beobachtet.map(
                  (target) =>
                    ({
                      target,
                      borderBoxSize: [{ blockSize: hoehe, inlineSize: 370 }],
                    } as unknown as ResizeObserverEntry)
                ),
                this as unknown as ResizeObserver
              )
            )
        }
        observe(ziel: Element) {
          beobachtet.push(ziel)
        }
        unobserve() {
          // nicht gebraucht
        }
        disconnect() {
          getrennt()
        }
      } as unknown as typeof ResizeObserver
    })
    afterEach(() => {
      window.ResizeObserver = original
      document.documentElement.style.removeProperty(LEISTE_HOEHE_VAR)
    })

    const variable = () =>
      document.documentElement.style.getPropertyValue(LEISTE_HOEHE_VAR)

    it('schreibt die gemessene Höhe der Leiste an <html>', () => {
      setup()
      expect(beobachtet).toEqual([screen.getByTestId('blickpunkt-leiste')])
      melde(151.2)
      expect(variable()).toBe('152px')
      // Bricht die Leiste um (zweiter Raum), wächst der Wert mit.
      melde(200)
      expect(variable()).toBe('200px')
      // Eine ausgeblendete Leiste (0) behält den letzten Wert.
      melde(0)
      expect(variable()).toBe('200px')
    })

    it('nimmt den Wert wieder weg, wenn die Leiste geht', () => {
      const view = setup()
      melde(120)
      expect(variable()).toBe('120px')
      view.unmount()
      expect(getrennt).toHaveBeenCalled()
      expect(variable()).toBe('')
    })
  })

  it('ohne ResizeObserver (jsdom) bleibt es beim Ersatzwert', () => {
    setup()
    expect(
      document.documentElement.style.getPropertyValue(LEISTE_HOEHE_VAR)
    ).toBe('')
  })

  describe('mit einem zweiten Raum', () => {
    const ZIELE = [{ id: 'werkstatt', wechsel: 'In die Werkstatt' }]

    it('steht der Raumwechsel hochkant in einer eigenen Zeile, „Quellen“ bleibt neben „Alles hier“', () => {
      const onRaumWechsel = jest.fn()
      setup({ raumZiele: ZIELE, onRaumWechsel })
      const knopf = screen.getByRole('button', { name: 'In die Werkstatt' })
      const zeile = knopf.parentElement as HTMLElement
      // jsdom wertet keine Medienabfragen aus: das ist die Regel fürs Hochformat.
      expect(zeile).toHaveStyle({ order: '1', flexBasis: '100%' })
      expect(
        screen.getByRole('button', { name: 'Alles hier' }).parentElement
      ).toBe(zeile.parentElement)
    })

    it('ohne Ziele gibt es keinen Raumwechsel und keine leere Zeile', () => {
      setup({ raumZiele: [], onRaumWechsel: jest.fn() })
      expect(screen.queryByTestId('raum-wechsel')).not.toBeInTheDocument()
      const zeile = screen.getByRole('button', { name: 'Alles hier' })
        .parentElement as HTMLElement
      expect(zeile.children).toHaveLength(2)
    })
  })

  it('nennt weder Kosten noch Inhaltsstoff-Hinweise', () => {
    setup()
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })
})
