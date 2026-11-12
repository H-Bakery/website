import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProduktSheet, {
  MEHR_LESEN_TEXT,
  NAHANSICHT_TEXT,
  WEBSITE_LINK_TEXT,
  WENIGER_TEXT,
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

/** jsdom kennt kein PointerEvent: ein MouseEvent mit dem Namen trägt clientY. */
const zeiger = (
  ziel: Element,
  typ: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number
) => fireEvent(ziel, new MouseEvent(typ, { bubbles: true, clientY }))
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
