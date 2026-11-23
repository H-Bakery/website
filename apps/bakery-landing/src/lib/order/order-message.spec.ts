import {
  buildOrderMessage,
  newOrderReference,
  orderWhatsAppLink,
} from './order-message'
import { ORDER_CONFIG } from './order-config'

const fixture = {
  items: [
    { name: 'Beispielbrot 1 kg', quantity: 2 },
    { name: 'Beispielweck', quantity: 3 },
    {
      name: 'Beispieltorte (ganz)',
      quantity: 1,
      note: 'Aufschrift „Alles Gute“',
    },
  ],
  day: '2026-11-28',
  time: '09:30',
  place: 'Laden',
  name: ' Erika Beispielfrau ',
  note: 'bitte geschnitten',
  estimate: 24.8,
  reference: 'W-7K3F',
}
const testNumber = '15550100000'

it('baut exakt den vereinbarten Nachrichtentext', () => {
  expect(buildOrderMessage(fixture)).toBe(`Hallo, ich möchte vorbestellen:

2× Beispielbrot 1 kg
3× Beispielweck
1× Beispieltorte (ganz) – Aufschrift „Alles Gute“

Abholung: Samstag, 28.11.2026, 09:30 Uhr
Abholort: Laden
Name: Erika Beispielfrau
Anmerkung: bitte geschnitten

Summe ca. 24,80 € (bezahlt wird bei Abholung)
Bestell-Nr. W-7K3F`)
})

it('kodiert Sonderzeichen, entfernt Formatzeichen und hält Angaben auf einer Zeile', () => {
  const message = buildOrderMessage({
    ...fixture,
    name: 'Änne\u200b Müller',
    note: '50 %\nÖl & Süßes? 🍞\u202e\ud800',
  })
  expect(message).toContain(
    'Name: Änne Müller\nAnmerkung: 50 % Öl & Süßes? 🍞\n'
  )
  expect(message).not.toMatch(/[\u200b\u202e]/)
  const url = new URL(orderWhatsAppLink(message, testNumber) ?? '')
  expect(url.origin).toBe('https://wa.me')
  expect(url.searchParams.get('text')).toBe(message)
})

it('lässt leere Anmerkungen weg und bezeichnet einen unbekannten Preis als offen', () => {
  const message = buildOrderMessage({
    ...fixture,
    note: ' \u200b',
    estimate: null,
  })
  expect(message).not.toContain('Anmerkung')
  expect(message).toContain('Summe offen (bezahlt wird bei Abholung)')
})

it('begrenzt die vollständige kodierte URL vor 2000 Zeichen', () => {
  const prefixLength = orderWhatsAppLink('', testNumber)?.length ?? 0
  const budget = ORDER_CONFIG.maxWhatsAppUrlLength - prefixLength
  expect(orderWhatsAppLink('a'.repeat(budget - 1), testNumber)).toHaveLength(
    1999
  )
  expect(orderWhatsAppLink('a'.repeat(budget), testNumber)).toBeNull()
  expect(orderWhatsAppLink('ä'.repeat(400), testNumber)).toBeNull()
})

it('erzeugt eine kurze lesbare Bestellnummer', () => {
  expect(newOrderReference()).toMatch(/^W-[A-HJ-NP-Z2-9]{4}$/)
})
