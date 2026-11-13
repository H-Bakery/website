import React from 'react'
import { screen, within } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import PriceListSheet, {
  ROWS_KEPT_WITH_HEADING,
  priceListPageCss,
} from './PriceListSheet'
import {
  SYNTHETIC_PARTNER,
  syntheticPriceList,
} from '../../../../lib/priceListFixtures'
import { SELLER } from '../../../../lib/seller'

const SELLER_FIXTURE = {
  name: 'Testbäckerei Muster',
  street: 'Musterweg 2',
  postalCode: '00000',
  city: 'Musterstadt',
  phone: '00000 0000',
  email: 'test@example.invalid',
}

const category = (key: string) => screen.getByTestId(`pl-category-${key}`)

describe('PriceListSheet', () => {
  it('zeigt jede Kategorie mit Überschrift, in fester Reihenfolge', () => {
    renderWithTheme(
      <PriceListSheet doc={syntheticPriceList()} seller={SELLER_FIXTURE} />
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Preisliste' })
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Brot', 'Brötchen', 'Baguette', 'Kuchen', 'Torten'])
  })

  it('setzt Brot als Gewichts-Tabelle, Preise im deutschen Format', () => {
    renderWithTheme(
      <PriceListSheet doc={syntheticPriceList()} seller={SELLER_FIXTURE} />
    )
    const brot = category('brot')
    expect(brot).toHaveAttribute('data-layout', 'matrix')
    expect(
      Array.from(brot.querySelectorAll('.pl-col')).map((c) => c.textContent)
    ).toEqual(['500\u00a0g', '750\u00a0g', '1000\u00a0g'])
    const row = within(brot).getByText('Musterbrot').closest('.pl-row')
    expect(
      Array.from((row as HTMLElement).querySelectorAll('.pl-price')).map(
        (c) => c.textContent
      )
    ).toEqual(['2,50\u00a0€', '\u00a0', '4,40\u00a0€'])
  })

  it('stellt Varianten unter den Namen und erfindet keine Einheit', () => {
    renderWithTheme(
      <PriceListSheet doc={syntheticPriceList()} seller={SELLER_FIXTURE} />
    )
    const row = within(category('kuchen'))
      .getByText('Musterkuchen')
      .closest('.pl-row') as HTMLElement
    expect(
      Array.from(row.querySelectorAll('.pl-price')).map((c) => c.textContent)
    ).toEqual(['14,00\u00a0€', '1,60\u00a0€'])
    expect(row.querySelector('.pl-unit')).toBeNull()
    expect(within(row).getByText('Stück')).toHaveClass('pl-sublabel')
    expect(within(category('kuchen')).getByText('saisonal')).toBeInTheDocument()
    const baguette = within(category('baguette'))
      .getByText('Musterbaguette')
      .closest('.pl-row') as HTMLElement
    expect(baguette.querySelector('.pl-unit')).toHaveTextContent('klein')
  })

  it('druckt kein Produkt ohne Preis und kein „auf Anfrage“', () => {
    const { container } = renderWithTheme(
      <PriceListSheet
        doc={syntheticPriceList({ includeUnavailable: true })}
        seller={SELLER_FIXTURE}
      />
    )
    expect(screen.queryByText('Probeplunder')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/auf Anfrage|Preis offen|0,00/)
    expect(screen.getByText('derzeit nicht erhältlich')).toBeInTheDocument()
  })

  it('hält die Überschrift mit den ersten Zeilen zusammen', () => {
    renderWithTheme(
      <PriceListSheet
        doc={syntheticPriceList({ categories: ['kuchen'] })}
        seller={SELLER_FIXTURE}
      />
    )
    const keep = category('kuchen').querySelector('.pl-keep') as HTMLElement
    expect(keep.querySelector('h2')).toHaveTextContent('Kuchen')
    expect(keep.querySelectorAll('.pl-row').length).toBe(
      Math.min(ROWS_KEPT_WITH_HEADING, 2)
    )
  })

  it('nennt Absender, Umfang, „gültig ab“ und Stand', () => {
    renderWithTheme(
      <PriceListSheet
        doc={syntheticPriceList({
          categories: ['brot', 'kuchen'],
          validFrom: '2026-12-01',
        })}
        seller={SELLER_FIXTURE}
      />
    )
    const sheet = screen.getByTestId('price-list-sheet')
    expect(sheet).toHaveTextContent('Musterweg 2 · 00000 Musterstadt')
    expect(sheet).toHaveTextContent('Telefon 00000 0000')
    expect(sheet).toHaveTextContent('Brot · Kuchen')
    expect(sheet).toHaveTextContent('Gültig ab 01.12.2026')
    expect(sheet).toHaveTextContent('Stand: 13.11.2026')
    expect((sheet.querySelector('style') as HTMLElement).innerHTML).toContain(
      '"Testbäckerei Muster · Preisliste · Stand: 13.11.2026"'
    )
  })

  it('nimmt den Absender aus dem Impressum, wenn keiner übergeben wird', () => {
    renderWithTheme(<PriceListSheet doc={syntheticPriceList()} />)
    expect(screen.getByTestId('price-list-sheet')).toHaveTextContent(
      `${SELLER.street} · ${SELLER.postalCode} ${SELLER.city}`
    )
    expect(SELLER.name.length).toBeGreaterThan(0)
    expect(SELLER.phone.length).toBeGreaterThan(0)
  })

  it('Partnerliste: Partner, Abrechnungsmodell, nur sein Sortiment', () => {
    renderWithTheme(
      <PriceListSheet
        doc={syntheticPriceList({
          audience: 'partner',
          partner: SYNTHETIC_PARTNER,
          assortment: { slugs: ['p-1', 'p-4'] },
        })}
        seller={SELLER_FIXTURE}
      />
    )
    expect(screen.getByTestId('pl-partner')).toHaveTextContent(
      'für Testmarkt Musterstadt, Musterweg 1, 00000 Musterstadt'
    )
    const sheet = screen.getByTestId('price-list-sheet')
    expect(sheet).toHaveTextContent(
      'Sortiment im Markt · Abrechnung: Kommission'
    )
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Brot', 'Brötchen'])
    expect(sheet.textContent).not.toMatch(/Rabatt|Provision/)
  })

  it('Allergene: nur positive Angaben, offene mit Hinweis', () => {
    renderWithTheme(
      <PriceListSheet
        doc={syntheticPriceList({ withAllergens: true })}
        seller={SELLER_FIXTURE}
      />
    )
    const brot = category('brot')
    expect(
      within(brot).getByText('Enthält: gluten, weizen')
    ).toBeInTheDocument()
    expect(
      within(brot).getByText('Allergene: bitte nachfragen*')
    ).toBeInTheDocument()
    const sheet = screen.getByTestId('price-list-sheet')
    expect(sheet).toHaveTextContent('Spuren davon sind in jedem Gebäck möglich')
    expect(sheet.textContent).not.toMatch(/frei von|keine Allergene/i)
  })

  it('ohne Allergene steht auch kein Allergen-Hinweis da', () => {
    renderWithTheme(
      <PriceListSheet doc={syntheticPriceList()} seller={SELLER_FIXTURE} />
    )
    expect(screen.getByTestId('price-list-sheet').textContent).not.toMatch(
      /Allergen|Enthält/
    )
  })
})

describe('priceListPageCss', () => {
  it('ist A4 hoch mit Stand links und Seitenzahl rechts', () => {
    const css = priceListPageCss('Muster · "Liste"')
    expect(css).toContain('size: A4 portrait')
    expect(css).toContain('@bottom-left { content: "Muster · \\"Liste\\""')
    expect(css).toContain('counter(page) " von " counter(pages)')
  })
})
