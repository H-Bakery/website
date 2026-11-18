import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProduktSheet, {
  MEHR_LESEN_TEXT,
  NAHANSICHT_TEXT,
  WEBSITE_LINK_TEXT,
  WENIGER_TEXT,
  WISCH_ENTSCHEIDUNG,
  ZIEH_SCHWELLE,
} from './ProduktSheet'
import ThemeRegistry from './ThemeRegistry'
import { AEPFELTASCHE, PROBEWECK, TESTBROT, VERBOTEN, zeige } from './testdaten'
import type { ProduktInfo } from '../lib/produkte/types'

function setup(
  produkt: ProduktInfo | null = TESTBROT,
  props: Partial<React.ComponentProps<typeof ProduktSheet>> = {}
) {
  const onClose = jest.fn()
  const view = zeige(
    <ProduktSheet produkt={produkt} onClose={onClose} {...props} />
  )
  const neu = (p: ProduktInfo | null) =>
    view.rerender(
      <ThemeRegistry>
        <ProduktSheet produkt={p} onClose={onClose} {...props} />
      </ThemeRegistry>
    )
  return { user: userEvent.setup(), onClose, neu }
}

const sheet = () => screen.getByRole('dialog')

/**
 * jsdom kennt kein PointerEvent: ein MouseEvent mit dem Namen trägt clientY,
 * dazu die Angaben des Zeigers (Standard: die Maus).
 */
const zeiger = (
  ziel: Element,
  typ: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  clientY: number,
  { pointerType = 'mouse', pointerId = 1 } = {}
) => {
  const event = new MouseEvent(typ, { bubbles: true, clientY })
  Object.defineProperties(event, {
    pointerType: { value: pointerType },
    pointerId: { value: pointerId },
    isPrimary: { value: true },
  })
  return fireEvent(ziel, event)
}
const FINGER = { pointerType: 'touch' }
const inhalt = () => screen.getByTestId('sheet-inhalt')
/** Der Text ist so weit gescrollt (jsdom scrollt nicht selbst). */
const scrollteSchon = (px: number) =>
  Object.defineProperty(inhalt(), 'scrollTop', {
    configurable: true,
    value: px,
  })
/** touchmove wie im Browser: abbrechbar, mit einem Finger. */
const fingerBewegt = (clientY: number) => {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: [{ clientY }] })
  inhalt().dispatchEvent(event)
  return event
}
const LANG = 'Der Teig ruht lange und wird von Hand geformt.'

describe('ProduktSheet', () => {
  it('zeigt ohne Produkt nichts', () => {
    setup(null)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sheet-hintergrund')).not.toBeInTheDocument()
  })

  it('zeigt Name, Einheit und Kurztext; der lange Text ist zugeklappt', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Testbrot' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Testbrot' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('sheet-einheit')).toHaveTextContent('500 g')
    expect(
      screen.getByText('Ein erfundenes Brot mit kräftiger Kruste.')
    ).toBeInTheDocument()
    expect(screen.queryByText(LANG, { exact: false })).not.toBeInTheDocument()
    expect(sheet()).toHaveAttribute('data-aufgeklappt', 'false')
  })

  it('lässt die Einheit weg, wenn es keine gibt', () => {
    setup(PROBEWECK)
    expect(screen.queryByTestId('sheet-einheit')).not.toBeInTheDocument()
  })

  it('klappt den langen Text mit „Mehr lesen“ auf und mit „Weniger“ zu', async () => {
    const { user } = setup()
    const mehr = screen.getByRole('button', { name: MEHR_LESEN_TEXT })
    expect(mehr).toHaveAttribute('aria-expanded', 'false')
    await user.click(mehr)
    expect(screen.getByText(LANG, { exact: false })).toBeInTheDocument()
    expect(sheet()).toHaveAttribute('data-aufgeklappt', 'true')
    const weniger = screen.getByRole('button', { name: WENIGER_TEXT })
    expect(weniger).toHaveAttribute('aria-expanded', 'true')
    await user.click(weniger)
    expect(screen.queryByText(LANG, { exact: false })).not.toBeInTheDocument()
  })

  it('bietet kein Aufklappen an, wenn der lange Text fehlt oder dem Kurztext gleicht', () => {
    const { neu } = setup(PROBEWECK)
    expect(
      screen.queryByRole('button', { name: MEHR_LESEN_TEXT })
    ).not.toBeInTheDocument()
    neu(AEPFELTASCHE)
    expect(
      screen.queryByRole('button', { name: MEHR_LESEN_TEXT })
    ).not.toBeInTheDocument()
  })

  it('startet bei einem anderen Produkt wieder zugeklappt', async () => {
    const { user, neu } = setup()
    await user.click(screen.getByRole('button', { name: MEHR_LESEN_TEXT }))
    neu({ ...TESTBROT, id: 'zweitbrot', name: 'Zweitbrot' })
    expect(
      screen.getByRole('dialog', { name: 'Zweitbrot' })
    ).toBeInTheDocument()
    expect(screen.queryByText(LANG, { exact: false })).not.toBeInTheDocument()
  })

  it('zeigt „Mehr auf der Website“ nur, wenn es eine Seite gibt', () => {
    const { neu } = setup()
    expect(
      screen.getByRole('link', { name: WEBSITE_LINK_TEXT })
    ).toHaveAttribute('href', 'https://example.org/produkte/testbrot')
    neu(PROBEWECK)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('schließt über den Knopf', async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('schließt mit Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('schließt beim Tippen daneben - außer das ist abgestellt', async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByTestId('sheet-hintergrund'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ohne hintergrundSchliesst liegt nichts über der Szene', () => {
    setup(TESTBROT, { hintergrundSchliesst: false })
    expect(screen.queryByTestId('sheet-hintergrund')).not.toBeInTheDocument()
    expect(sheet()).toBeInTheDocument()
  })

  it('schließt beim Herunterziehen, aber nicht bei einem kurzen Ruck', () => {
    const { onClose } = setup()
    const griff = screen.getByTestId('sheet-griff')

    zeiger(griff, 'pointerdown', 500)
    zeiger(griff, 'pointermove', 500 + ZIEH_SCHWELLE - 10)
    expect(sheet().style.transform).toBe(`translateY(${ZIEH_SCHWELLE - 10}px)`)
    zeiger(griff, 'pointerup', 500 + ZIEH_SCHWELLE - 10)
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet().style.transform).toBe('')

    zeiger(griff, 'pointerdown', 500)
    zeiger(griff, 'pointermove', 500 + ZIEH_SCHWELLE + 20)
    zeiger(griff, 'pointerup', 500 + ZIEH_SCHWELLE + 20)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('bindet den Zeiger beim Ziehen an den Griff', () => {
    setup()
    const griff = screen.getByTestId('sheet-griff')
    const fange = jest.fn()
    griff.setPointerCapture = fange
    zeiger(griff, 'pointerdown', 500, { pointerId: 7 })
    expect(fange).toHaveBeenCalledWith(7)
    // Auf dem Schließen-Knopf beginnt kein Ziehen.
    fange.mockClear()
    zeiger(
      screen.getByRole('button', { name: 'Schließen' }),
      'pointerdown',
      500
    )
    expect(fange).not.toHaveBeenCalled()
  })

  it('losgelassen neben dem Griff: federt zurück oder schließt', () => {
    const { onClose } = setup()
    const griff = screen.getByTestId('sheet-griff')

    zeiger(griff, 'pointerdown', 500)
    zeiger(griff, 'pointermove', 540)
    expect(sheet().style.transform).toBe('translateY(40px)')
    // Weitergezogen und losgelassen über der Szene, nicht über dem Griff.
    zeiger(document.body, 'pointermove', 545)
    expect(sheet().style.transform).toBe('translateY(45px)')
    zeiger(document.body, 'pointerup', 540)
    expect(sheet().style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    // Danach zieht ein Zeiger ohne Druck nichts mehr mit.
    zeiger(griff, 'pointermove', 600)
    expect(sheet().style.transform).toBe('')

    zeiger(griff, 'pointerdown', 500)
    zeiger(document.body, 'pointerup', 500 + ZIEH_SCHWELLE + 1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ein abgebrochener Zeiger lässt die Karte zurückfedern', () => {
    const { onClose } = setup()
    const griff = screen.getByTestId('sheet-griff')
    zeiger(griff, 'pointerdown', 500)
    zeiger(griff, 'pointermove', 600)
    zeiger(document.body, 'pointercancel', 600)
    expect(sheet().style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ein zweiter Finger ändert das Ziehen nicht', () => {
    const { onClose } = setup()
    const griff = screen.getByTestId('sheet-griff')
    const erster = { ...FINGER, pointerId: 1 }
    const zweiter = { ...FINGER, pointerId: 2 }
    zeiger(griff, 'pointerdown', 500, erster)
    zeiger(griff, 'pointermove', 530, erster)
    expect(sheet().style.transform).toBe('translateY(30px)')
    // Ein anderer Finger (etwa in der Szene) bewegt sich, hebt ab, bricht ab.
    zeiger(document.body, 'pointermove', 700, zweiter)
    zeiger(document.body, 'pointerup', 700, zweiter)
    zeiger(document.body, 'pointercancel', 700, zweiter)
    expect(sheet().style.transform).toBe('translateY(30px)')
    expect(onClose).not.toHaveBeenCalled()
    // Es zählt allein der Finger am Griff.
    zeiger(document.body, 'pointerup', 500 + ZIEH_SCHWELLE + 1, erster)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ein zweiter Finger entscheidet nicht über den Wisch auf dem Text', () => {
    const { onClose } = setup()
    scrollteSchon(0)
    zeiger(inhalt(), 'pointerdown', 400, { ...FINGER, pointerId: 1 })
    zeiger(inhalt(), 'pointermove', 480, { ...FINGER, pointerId: 2 })
    expect(sheet().style.transform).toBe('')
    zeiger(inhalt(), 'pointerup', 480, { ...FINGER, pointerId: 2 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('der Griff markiert beim Ziehen keinen Text', () => {
    setup()
    expect(screen.getByTestId('sheet-griff')).toHaveStyle({
      userSelect: 'none',
    })
  })

  it('ein Wisch nach unten auf dem Text schließt, wenn der Text oben steht', () => {
    const { onClose } = setup()
    scrollteSchon(0)
    zeiger(inhalt(), 'pointerdown', 400, FINGER)
    // Unter der Schwelle der Entscheidung: noch nichts.
    zeiger(inhalt(), 'pointermove', 400 + WISCH_ENTSCHEIDUNG - 1, FINGER)
    expect(sheet().style.transform).toBe('')
    zeiger(inhalt(), 'pointermove', 420, FINGER)
    expect(sheet().style.transform).toBe('translateY(20px)')
    // Ab jetzt scrollt der Text nicht mit.
    expect(fingerBewegt(430).defaultPrevented).toBe(true)
    zeiger(inhalt(), 'pointermove', 400 + ZIEH_SCHWELLE + 30, FINGER)
    zeiger(inhalt(), 'pointerup', 400 + ZIEH_SCHWELLE + 30, FINGER)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ein kurzer Wisch auf dem Text federt zurück', () => {
    const { onClose } = setup()
    scrollteSchon(0)
    zeiger(inhalt(), 'pointerdown', 400, FINGER)
    zeiger(inhalt(), 'pointermove', 430, FINGER)
    zeiger(inhalt(), 'pointerup', 430, FINGER)
    expect(sheet().style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ist der Text gescrollt, scrollt ein Wisch nach unten ihn zurück - die Karte bleibt', () => {
    const { onClose } = setup()
    scrollteSchon(30)
    zeiger(inhalt(), 'pointerdown', 400, FINGER)
    zeiger(inhalt(), 'pointermove', 420, FINGER)
    expect(fingerBewegt(440).defaultPrevented).toBe(false)
    zeiger(inhalt(), 'pointermove', 500, FINGER)
    expect(sheet().style.transform).toBe('')
    zeiger(inhalt(), 'pointerup', 500, FINGER)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ein Wisch nach oben scrollt den Text, auch wenn er danach nach unten geht', () => {
    const { onClose } = setup()
    scrollteSchon(0)
    zeiger(inhalt(), 'pointerdown', 400, FINGER)
    zeiger(inhalt(), 'pointermove', 380, FINGER)
    zeiger(inhalt(), 'pointermove', 500, FINGER)
    expect(sheet().style.transform).toBe('')
    zeiger(inhalt(), 'pointerup', 500, FINGER)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('mit der Maus zieht nur der Griff - auf dem Text wird markiert', () => {
    const { onClose } = setup()
    scrollteSchon(0)
    zeiger(inhalt(), 'pointerdown', 400)
    zeiger(inhalt(), 'pointermove', 500)
    zeiger(inhalt(), 'pointerup', 500)
    expect(sheet().style.transform).toBe('')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('zieht nicht nach oben', () => {
    const { onClose } = setup()
    const griff = screen.getByTestId('sheet-griff')
    zeiger(griff, 'pointerdown', 500)
    zeiger(griff, 'pointermove', 300)
    expect(sheet().style.transform).toBe('')
    zeiger(griff, 'pointerup', 300)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('holt den Fokus ins Sheet und gibt ihn beim Schließen zurück', () => {
    const ausloeser = document.createElement('button')
    document.body.appendChild(ausloeser)
    ausloeser.focus()

    const { neu } = setup()
    expect(sheet()).toHaveFocus()
    neu(null)
    expect(ausloeser).toHaveFocus()
    ausloeser.remove()
  })

  it('behält den Fokus, wenn nur das Produkt wechselt', async () => {
    const { user, neu } = setup()
    await user.tab()
    const schliessen = screen.getByRole('button', { name: 'Schließen' })
    expect(schliessen).toHaveFocus()
    neu(PROBEWECK)
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
  })

  it('fokus={false}: der Fokus bleibt, wo er ist - auch beim Schließen', () => {
    const ausloeser = document.createElement('button')
    document.body.appendChild(ausloeser)
    ausloeser.focus()

    const { neu } = setup(TESTBROT, { fokus: false })
    expect(ausloeser).toHaveFocus()
    neu(PROBEWECK)
    expect(ausloeser).toHaveFocus()
    neu(null)
    expect(ausloeser).toHaveFocus()
    ausloeser.remove()
  })

  it('holt den Fokus nicht zurück, wenn er inzwischen woanders steht', () => {
    const ausloeser = document.createElement('button')
    const anderer = document.createElement('button')
    document.body.append(ausloeser, anderer)
    ausloeser.focus()

    const { neu } = setup()
    expect(sheet()).toHaveFocus()
    anderer.focus()
    neu(null)
    expect(anderer).toHaveFocus()
    ausloeser.remove()
    anderer.remove()
  })

  it('zeigt eine Hinweiszeile unter dem Namen, wenn es eine gibt', () => {
    const { neu } = setup(TESTBROT, { hinweis: 'Von hier aus nicht im Bild.' })
    expect(screen.getByTestId('sheet-hinweis')).toHaveTextContent(
      'Von hier aus nicht im Bild.'
    )
    neu(TESTBROT)
    expect(sheet()).toBeInTheDocument()
  })

  it('zeigt „In 3D ansehen“ nur, wenn es eine Nahansicht gibt', async () => {
    const onNahansicht = jest.fn()
    const { user, onClose } = setup(TESTBROT, { onNahansicht })
    const knopf = screen.getByRole('button', { name: NAHANSICHT_TEXT })
    await user.click(knopf)
    expect(onNahansicht).toHaveBeenCalledTimes(1)
    // Die Karte bleibt dabei offen.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ohne 3D-Modell gibt es den Knopf nicht', () => {
    setup(TESTBROT)
    expect(
      screen.queryByRole('button', { name: NAHANSICHT_TEXT })
    ).not.toBeInTheDocument()
  })

  it('ohne Hinweis keine leere Zeile', () => {
    setup()
    expect(screen.queryByTestId('sheet-hinweis')).not.toBeInTheDocument()
  })

  it('nennt nie Kosten oder Inhaltsstoff-Hinweise - auch aufgeklappt nicht', async () => {
    const { user, neu } = setup()
    expect(document.body.textContent).not.toMatch(VERBOTEN)
    await user.click(screen.getByRole('button', { name: MEHR_LESEN_TEXT }))
    expect(document.body.textContent).not.toMatch(VERBOTEN)
    for (const produkt of [PROBEWECK, AEPFELTASCHE]) {
      neu(produkt)
      expect(document.body.textContent).not.toMatch(VERBOTEN)
    }
    // auch nicht in Beschriftungen
    const labels = [...document.querySelectorAll('[aria-label], [title]')]
      .map(
        (el) => `${el.getAttribute('aria-label')} ${el.getAttribute('title')}`
      )
      .join(' ')
    expect(labels).not.toMatch(VERBOTEN)
  })
})
