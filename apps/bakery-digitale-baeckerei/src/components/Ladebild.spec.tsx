import React from 'react'
import { screen } from '@testing-library/react'
import Ladebild, { APP_NAME, LADE_TEXT } from './Ladebild'
import { VERBOTEN, zeige } from './testdaten'

describe('Ladebild', () => {
  it('zeigt App-Namen, Zeichnung und den Ladetext als Status', () => {
    zeige(<Ladebild fortschritt={0} />)
    expect(screen.getByText(APP_NAME)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(LADE_TEXT)
    const bild = screen.getByTestId('ladebild-illustration')
    expect(bild.tagName.toLowerCase()).toBe('svg')
    expect(bild).toHaveAttribute('aria-hidden', 'true')
  })

  it('die Zeichnung enthält keinen Text und kein eingebettetes Bild', () => {
    zeige(<Ladebild />)
    const bild = screen.getByTestId('ladebild-illustration')
    expect(bild.querySelector('text, image, foreignObject')).toBeNull()
    expect(bild.textContent).toBe('')
  })

  it('zeigt den Fortschritt in Prozent, wenn er bekannt ist', () => {
    zeige(<Ladebild fortschritt={0.42} />)
    const balken = screen.getByRole('progressbar', { name: LADE_TEXT })
    expect(balken).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('42 %')
  })

  it.each([
    [-1, '0'],
    [7, '100'],
  ])('begrenzt %s auf 0…100', (wert, erwartet) => {
    zeige(<Ladebild fortschritt={wert} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      erwartet
    )
  })

  it('läuft ohne Wert unbestimmt, ohne Prozentangabe', () => {
    zeige(<Ladebild />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByTestId('lade-prozent')).toHaveTextContent('')
    expect(screen.getByRole('status')).toHaveTextContent(LADE_TEXT)
  })

  it('nennt weder Kosten noch Inhaltsstoff-Hinweise', () => {
    zeige(<Ladebild fortschritt={0.5} />)
    expect(document.body.textContent).not.toMatch(VERBOTEN)
  })
})
