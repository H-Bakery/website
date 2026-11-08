import React from 'react'
import { render, within } from '@testing-library/react'
import { BakeListPrint } from './BakeListPrint'
import {
  SUN,
  TEST_CONFIG_V2,
  V2_TUE,
  sundayBakeList,
  tuesdayBakeList,
} from '../../lib/backzettelFixtures'

describe('Druck der Backliste (Z10 S6)', () => {
  it('je Posten Stück, aus welchem Teig, Kästchen - keine Teigzahlen', () => {
    const { getByTestId } = render(
      <BakeListPrint list={tuesdayBakeList()} config={TEST_CONFIG_V2} />
    )
    const sheet = within(getByTestId('bl-print'))
    expect(
      sheet.getByText('Backliste Dienstag, 01.12.2026')
    ).toBeInTheDocument()
    expect(
      sheet.getByText(
        'Aus: Teig vom Samstag · freigegeben; Teig von heute · Entwurf'
      )
    ).toBeInTheDocument()
    const doppel = getByTestId(`bl-line-test-doppel|@${V2_TUE}`)
    expect(doppel).toHaveTextContent('Testdoppel')
    expect(doppel).toHaveTextContent('Teig vom Samstag')
    expect(doppel).toHaveTextContent('44')
    // Der Backtag ist der Tag der Liste - kein „· für Di …“ am Namen.
    expect(doppel).not.toHaveTextContent('für Di')
    expect(doppel.querySelector('.box')).not.toBeNull()
    expect(getByTestId('bl-line-test-korn|g500')).toHaveTextContent(
      'Testkorn – 500 g'
    )
    // Nichts vom Teig: weder kg noch Liter noch Brüche.
    expect(getByTestId('bl-print')).not.toHaveTextContent(/kg|Bruch|Wasser/)
  })

  it('Entwurfsquelle als Banner, Nachträge getrennt und nie in der Zahl', () => {
    const { getByTestId } = render(
      <BakeListPrint list={tuesdayBakeList()} config={TEST_CONFIG_V2} />
    )
    expect(getByTestId('bl-draft')).toHaveTextContent('ENTWURF')
    expect(getByTestId(`bl-line-test-doppel|@${V2_TUE}`)).toHaveTextContent(
      'Nachtrag +3 (unten, nicht in der Zahl)'
    )
    const deltas = within(getByTestId('bl-deltas'))
    expect(deltas.getByText('+3')).toBeInTheDocument()
    expect(
      deltas.getByText(/Zettel vom Samstag, 28\.11\.2026/)
    ).toBeInTheDocument()
  })

  it('Sonntag nur aus Samstagsteig, ohne Nachträge', () => {
    const { getByTestId, queryByTestId } = render(
      <BakeListPrint list={sundayBakeList()} config={TEST_CONFIG_V2} />
    )
    expect(getByTestId(`bl-line-test-doppel|@${SUN}`)).toHaveTextContent('66')
    expect(queryByTestId('bl-deltas')).not.toBeInTheDocument()
  })

  it('Ruhetag oder ohne Stammdaten: kein Druckbild', () => {
    const { container } = render(
      <BakeListPrint
        list={{ ...sundayBakeList(), status: 'ruhetag', sections: [] }}
        config={TEST_CONFIG_V2}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
