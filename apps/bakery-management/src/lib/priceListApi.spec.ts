import {
  canExportPartnerPriceList,
  canExportPriceList,
  priceListHref,
  priceListOptionsFromQuery,
  priceListQuery,
} from './priceListApi'
import { priceListCore } from './priceListFixtures'
import { CATEGORY_LABELS } from './products'

describe('priceListQuery', () => {
  it('ist leer für die Vorgabe (Laden, alles)', () => {
    expect(priceListQuery({ audience: 'laden' })).toBe('')
    expect(priceListHref({ audience: 'laden' })).toBe(
      '/admin/products/preisliste'
    )
  })

  it('trägt alle gewählten Optionen', () => {
    expect(
      priceListQuery({
        audience: 'partner',
        partnerId: 3,
        categories: ['brot', 'kuchen'],
        validFrom: '2026-12-01',
        includeUnavailable: true,
        allergens: true,
      })
    ).toBe(
      '?audience=partner&partnerId=3&categories=brot%2Ckuchen&validFrom=2026-12-01&includeUnavailable=1&allergens=1'
    )
  })

  it('schickt bei der Ladenliste keinen Partner mit', () => {
    expect(priceListQuery({ audience: 'laden', partnerId: 3 })).toBe('')
  })
})

describe('priceListOptionsFromQuery', () => {
  it('liest zurück, was priceListQuery schreibt', () => {
    const options = {
      audience: 'partner' as const,
      partnerId: 3,
      categories: ['brot', 'kuchen'],
      validFrom: '2026-12-01',
      includeUnavailable: true,
      allergens: true,
    }
    const query = Object.fromEntries(
      new URLSearchParams(priceListQuery(options).slice(1))
    )
    expect(priceListOptionsFromQuery(query)).toEqual(options)
  })

  it('lässt Unbrauchbares fallen', () => {
    expect(
      priceListOptionsFromQuery({
        audience: 'alle',
        partnerId: 'x',
        validFrom: 'morgen',
        categories: ['brot', 'kuchen'],
      })
    ).toEqual({
      audience: 'laden',
      partnerId: null,
      categories: ['brot'],
      validFrom: null,
      includeUnavailable: false,
      allergens: false,
    })
  })
})

describe('Rollen (Bedienführung; die API setzt es durch)', () => {
  it('Ladenliste: Inhaber und Verkauf', () => {
    expect(canExportPriceList('inhaber')).toBe(true)
    expect(canExportPriceList('verkauf')).toBe(true)
    expect(canExportPriceList('backstube')).toBe(false)
    expect(canExportPriceList(null)).toBe(false)
  })

  it('Partnerliste: nur Inhaber', () => {
    expect(canExportPartnerPriceList('inhaber')).toBe(true)
    expect(canExportPartnerPriceList('verkauf')).toBe(false)
  })
})

it('Kategorie-Bezeichnungen der Preisliste sind die der Produktliste', () => {
  expect({ ...priceListCore.CATEGORY_LABELS }).toEqual(CATEGORY_LABELS)
})
