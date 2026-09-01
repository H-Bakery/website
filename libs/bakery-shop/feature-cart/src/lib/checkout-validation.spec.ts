import {
  CheckoutFormValues,
  EMPTY_CHECKOUT_FORM,
  type LeadTimeLimit,
  earliestBookablePickupDate,
  firstInvalidField,
  leadTimeLimitFor,
  minPickupIsoDate,
  restoreCheckoutForm,
  serializeCheckoutForm,
  toLeadTimeItems,
  validateCheckout,
  validateEmail,
  validateName,
  validatePhone,
  validatePickupDate,
  validatePickupTime,
} from './checkout-validation'
import { pickupTimeSlots } from './pickup'

const SATURDAY = '2026-08-29'
const MONDAY = '2026-08-31'
const TUESDAY = '2026-09-01'
/** Ein Sonntag — die Bäckerei hat 08:00–11:00 Uhr geöffnet. */
const TODAY = '2026-08-30'

const TUESDAY_SLOTS = pickupTimeSlots(TUESDAY)

function form(overrides: Partial<CheckoutFormValues> = {}): CheckoutFormValues {
  return {
    ...EMPTY_CHECKOUT_FORM,
    customerName: 'Anna Beck',
    phone: '06841 123456',
    pickupDate: TUESDAY,
    pickupTime: '09:00',
    ...overrides,
  }
}

describe('validateName', () => {
  it('requires a name', () => {
    expect(validateName('')).toBe('Bitte geben Sie Ihren Namen ein.')
    expect(validateName('   ')).toBe('Bitte geben Sie Ihren Namen ein.')
  })

  it('accepts a real name', () => {
    expect(validateName('Anna Beck')).toBeNull()
  })
})

describe('validatePhone', () => {
  it('requires a number', () => {
    expect(validatePhone('')).toBe('Bitte geben Sie Ihre Telefonnummer ein.')
  })

  it('accepts the shapes Germans actually type', () => {
    expect(validatePhone('06841123456')).toBeNull()
    expect(validatePhone('06841 / 12 34 56')).toBeNull()
    expect(validatePhone('+49 (0)6841-123456')).toBeNull()
  })

  it('rejects text and too-short numbers', () => {
    expect(validatePhone('ruft mich an')).not.toBeNull()
    expect(validatePhone('12345')).not.toBeNull()
  })
})

describe('validateEmail', () => {
  it('is optional', () => {
    expect(validateEmail('')).toBeNull()
  })

  it('is validated once filled', () => {
    expect(validateEmail('anna@beispiel.de')).toBeNull()
    expect(validateEmail('anna@beispiel')).not.toBeNull()
    expect(validateEmail('anna.beispiel.de')).not.toBeNull()
  })
})

describe('validatePickupDate', () => {
  it('requires a date', () => {
    expect(validatePickupDate('', TODAY)).toBe(
      'Bitte wählen Sie ein Abholdatum.'
    )
  })

  it('rejects the past', () => {
    expect(validatePickupDate('2026-08-29', TODAY)).toBe(
      'Das Abholdatum darf nicht in der Vergangenheit liegen.'
    )
  })

  it('rejects the Ruhetag with a German explanation', () => {
    expect(validatePickupDate(MONDAY, TODAY)).toBe(
      'Montag ist Ruhetag. Bitte wählen Sie einen anderen Tag.'
    )
  })

  it('accepts an open day', () => {
    expect(validatePickupDate(TUESDAY, TODAY)).toBeNull()
  })

  it('skips the past check while today is still unknown', () => {
    expect(validatePickupDate('2020-01-07', '')).toBeNull()
  })
})

describe('validatePickupTime', () => {
  it('requires a time', () => {
    expect(validatePickupTime('', TUESDAY, TUESDAY_SLOTS, true)).toBe(
      'Bitte wählen Sie eine Abholzeit.'
    )
  })

  it('accepts a slot inside the opening hours', () => {
    expect(validatePickupTime('09:00', TUESDAY, TUESDAY_SLOTS, true)).toBeNull()
  })

  it('rejects a time outside the opening hours', () => {
    expect(validatePickupTime('18:00', TUESDAY, TUESDAY_SLOTS, true)).toContain(
      'Zu dieser Uhrzeit haben wir nicht geöffnet.'
    )
  })

  it('does not pile a second error onto an already-invalid date', () => {
    expect(validatePickupTime('18:00', MONDAY, [], false)).toBeNull()
  })

  it('explains when nothing is left for that day', () => {
    expect(validatePickupTime('09:00', TUESDAY, [], true)).toContain(
      'keine Abholung mehr anbieten'
    )
  })
})

describe('validateCheckout', () => {
  it('passes a complete, plausible form', () => {
    expect(validateCheckout(form(), TODAY, TUESDAY_SLOTS)).toEqual({})
  })

  it('reports every empty required field at once', () => {
    const errors = validateCheckout(EMPTY_CHECKOUT_FORM, TODAY, [])
    expect(Object.keys(errors).sort()).toEqual([
      'customerName',
      'phone',
      'pickupDate',
      'pickupTime',
    ])
  })

  it('leaves the optional fields alone when they are empty', () => {
    const errors = validateCheckout(form(), TODAY, TUESDAY_SLOTS)
    expect(errors.email).toBeUndefined()
    expect(errors.notes).toBeUndefined()
  })

  it('rejects a Monday pickup', () => {
    const errors = validateCheckout(
      form({ pickupDate: MONDAY, pickupTime: '09:00' }),
      TODAY,
      []
    )
    expect(errors.pickupDate).toContain('Ruhetag')
  })

  it('rejects overlong notes', () => {
    const errors = validateCheckout(
      form({ notes: 'x'.repeat(501) }),
      TODAY,
      TUESDAY_SLOTS
    )
    expect(errors.notes).toBeDefined()
  })
})

describe('firstInvalidField', () => {
  it('follows the visual field order', () => {
    expect(firstInvalidField({ pickupDate: 'x', phone: 'y' })).toBe('phone')
    expect(firstInvalidField({ email: 'x', customerName: 'y' })).toBe(
      'customerName'
    )
  })

  it('returns null for a valid form', () => {
    expect(firstInvalidField({})).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Vorbestellfrist                                                             */
/* -------------------------------------------------------------------------- */

/** Wie eine echte Warenkorbzeile aussieht: numerische ID, Slug, Anzeigekategorie. */
const WHOLE_TORTE = {
  id: 77,
  slug: 'schwarzwaelder-kirsch-torte',
  category: 'Torten',
}
const TORTE_SLICE = {
  id: 78,
  slug: 'schwarzwaelder-kirsch-torte-1-stueck',
  category: 'Torten',
}
const WHOLE_KUCHEN = { id: 55, slug: 'kaesekuchen', category: 'Kuchen' }
const BROETCHEN = { id: 3, slug: 'kaiserbroetchen', category: 'Brötchen' }

describe('toLeadTimeItems', () => {
  it('nimmt den Slug als ID — die numerische ID kennt kein Portionsmuster', () => {
    expect(toLeadTimeItems([TORTE_SLICE])).toEqual([
      { id: 'schwarzwaelder-kirsch-torte-1-stueck', category: 'torten' },
    ])
  })

  it('übersetzt den Anzeigenamen der Kategorie in den hq-Schlüssel', () => {
    expect(toLeadTimeItems([WHOLE_KUCHEN])[0].category).toBe('kuchen')
    expect(toLeadTimeItems([WHOLE_TORTE])[0].category).toBe('torten')
  })

  it('lässt einen bereits kleingeschriebenen hq-Schlüssel durch', () => {
    expect(
      toLeadTimeItems([{ ...WHOLE_TORTE, category: 'torten' }])[0]
    ).toEqual({ id: 'schwarzwaelder-kirsch-torte', category: 'torten' })
  })

  it('reicht ohne Slug die numerische ID als String durch — nie undefined', () => {
    const mapped = toLeadTimeItems([{ id: 77, category: 'Torten' }])
    expect(mapped[0].id).toBe('77')
    // Altbestand ohne Slug gilt damit als ganze Torte: im Zweifel die längere
    // Frist, nie ein Termin, den die Backstube nicht halten kann.
    expect(mapped[0].category).toBe('torten')
  })

  it('verkraftet fehlende Felder', () => {
    expect(toLeadTimeItems([{}])).toEqual([{ id: '', category: undefined }])
  })
})

describe('earliestBookablePickupDate', () => {
  it('überspringt den Ruhetag', () => {
    expect(earliestBookablePickupDate(MONDAY)).toBe(TUESDAY)
  })

  it('lässt einen offenen Tag stehen', () => {
    expect(earliestBookablePickupDate(TUESDAY)).toBe(TUESDAY)
    expect(earliestBookablePickupDate(TODAY)).toBe(TODAY)
  })

  it('gibt für Unsinn einen leeren String zurück', () => {
    expect(earliestBookablePickupDate('morgen')).toBe('')
    expect(earliestBookablePickupDate('2026-02-31')).toBe('')
  })
})

describe('leadTimeLimitFor', () => {
  it('gibt für einen Korb ohne Vorbestellware null zurück', () => {
    expect(
      leadTimeLimitFor([BROETCHEN], new Date(2026, 7, 29, 10, 0))
    ).toBeNull()
    expect(
      leadTimeLimitFor([TORTE_SLICE], new Date(2026, 7, 29, 10, 0))
    ).toBeNull()
    expect(leadTimeLimitFor([], new Date(2026, 7, 29, 10, 0))).toBeNull()
  })

  it('verlangt für eine ganze Torte zwei Tage und springt über den Ruhetag', () => {
    // Samstag + 2 Tage = Montag (Ruhetag) -> der Dienstag ist der erste Termin.
    const limit = leadTimeLimitFor(
      [BROETCHEN, WHOLE_TORTE],
      new Date(2026, 7, 29, 10, 0)
    )
    expect(limit).not.toBeNull()
    expect((limit as LeadTimeLimit).earliestIso).toBe(TUESDAY)
    expect((limit as LeadTimeLimit).reason).toMatch(/Torten/)
  })

  it('verlangt für einen ganzen Kuchen einen Tag', () => {
    const limit = leadTimeLimitFor([WHOLE_KUCHEN], new Date(2026, 7, 29, 16, 0))
    expect((limit as LeadTimeLimit).earliestIso).toBe(TODAY)
    expect((limit as LeadTimeLimit).reason).toMatch(/Kuchen/)
  })

  it('lässt die strengste Regel gewinnen', () => {
    const limit = leadTimeLimitFor(
      [WHOLE_KUCHEN, WHOLE_TORTE],
      new Date(2026, 7, 29, 10, 0)
    )
    expect((limit as LeadTimeLimit).earliestIso).toBe(TUESDAY)
  })
})

describe('minPickupIsoDate', () => {
  const limit: LeadTimeLimit = { earliestIso: TUESDAY, reason: 'egal' }

  it('nimmt das spätere von heute und Frist', () => {
    expect(minPickupIsoDate(TODAY, limit)).toBe(TUESDAY)
    expect(minPickupIsoDate('2026-09-04', limit)).toBe('2026-09-04')
  })

  it('kommt ohne Frist und ohne Heute klar', () => {
    expect(minPickupIsoDate(TODAY, null)).toBe(TODAY)
    expect(minPickupIsoDate('', limit)).toBe(TUESDAY)
    expect(minPickupIsoDate('', null)).toBe('')
  })
})

describe('validatePickupDate mit Vorbestellfrist', () => {
  const limit: LeadTimeLimit = {
    earliestIso: TUESDAY,
    reason: 'Ganze Torten backen wir auf Bestellung — bitte zwei Tage vorher.',
  }

  it('lehnt ein zu frühes Datum mit der Begründung der Regel ab', () => {
    const error = validatePickupDate(TODAY, TODAY, limit)
    expect(error).toContain('Ganze Torten backen wir auf Bestellung')
    expect(error).toContain('Frühester Termin: Dienstag, 01.09.2026.')
  })

  it('nennt die Frist auch dann, wenn der zu frühe Tag ein Ruhetag ist', () => {
    // Sonst korrigiert die Kundschaft erst den Wochentag und läuft dann
    // trotzdem noch einmal in die Frist.
    expect(validatePickupDate(MONDAY, TODAY, limit)).toContain(
      'Frühester Termin'
    )
  })

  it('akzeptiert den ersten erlaubten Tag', () => {
    expect(validatePickupDate(TUESDAY, TODAY, limit)).toBeNull()
  })

  it('prüft die Vergangenheit weiterhin zuerst', () => {
    expect(validatePickupDate(SATURDAY, TODAY, limit)).toBe(
      'Das Abholdatum darf nicht in der Vergangenheit liegen.'
    )
  })

  it('ändert ohne Frist nichts', () => {
    expect(validatePickupDate(TUESDAY, TODAY, null)).toBeNull()
    expect(validatePickupDate(MONDAY, TODAY, null)).toContain('Ruhetag')
  })
})

describe('validateCheckout mit Vorbestellfrist', () => {
  const limit: LeadTimeLimit = {
    earliestIso: '2026-09-02',
    reason: 'Ganze Torten backen wir auf Bestellung — bitte zwei Tage vorher.',
  }

  it('hängt den Fehler ans Datumsfeld und nicht an die Uhrzeit', () => {
    const errors = validateCheckout(form(), TODAY, TUESDAY_SLOTS, limit)
    expect(errors.pickupDate).toContain('Frühester Termin')
    expect(errors.pickupTime).toBeUndefined()
  })

  it('lässt einen Termin nach der Frist durch', () => {
    const errors = validateCheckout(
      form({ pickupDate: '2026-09-02', pickupTime: '09:00' }),
      TODAY,
      pickupTimeSlots('2026-09-02'),
      limit
    )
    expect(errors).toEqual({})
  })
})

/* -------------------------------------------------------------------------- */
/* Formular über einen Seitenwechsel retten                                    */
/* -------------------------------------------------------------------------- */

describe('serializeCheckoutForm / restoreCheckoutForm', () => {
  it('bringt ein ausgefülltes Formular unverändert zurück', () => {
    const values = form({ email: 'anna@beispiel.de', notes: 'ungeschnitten' })
    expect(restoreCheckoutForm(serializeCheckoutForm(values), TODAY)).toEqual(
      values
    )
  })

  it('speichert nur die sechs bekannten Felder', () => {
    const raw = serializeCheckoutForm(form())
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'customerName',
      'phone',
      'pickupDate',
      'pickupTime',
    ])
  })

  it('gibt für Unsinn im Speicher null zurück statt zu werfen', () => {
    expect(restoreCheckoutForm(null, TODAY)).toBeNull()
    expect(restoreCheckoutForm('', TODAY)).toBeNull()
    expect(restoreCheckoutForm('{kaputt', TODAY)).toBeNull()
    expect(restoreCheckoutForm('[]', TODAY)).toBeNull()
    expect(restoreCheckoutForm('"text"', TODAY)).toBeNull()
    expect(restoreCheckoutForm('{}', TODAY)).toBeNull()
  })

  it('ignoriert fremde Schlüssel und Nicht-Strings', () => {
    const restored = restoreCheckoutForm(
      JSON.stringify({
        customerName: 'Anna Beck',
        phone: 12345,
        isAdmin: true,
      }),
      TODAY
    )
    expect(restored).toEqual({
      ...EMPTY_CHECKOUT_FORM,
      customerName: 'Anna Beck',
    })
  })

  it('stutzt überlange Werte', () => {
    const restored = restoreCheckoutForm(
      JSON.stringify({ customerName: 'x'.repeat(5000) }),
      TODAY
    )
    expect((restored as CheckoutFormValues).customerName).toHaveLength(100)
  })

  it('verwirft einen Termin, der inzwischen vorbei ist', () => {
    const restored = restoreCheckoutForm(
      JSON.stringify({
        customerName: 'Anna Beck',
        pickupDate: SATURDAY,
        pickupTime: '09:00',
      }),
      TODAY
    )
    expect(restored).toEqual({
      ...EMPTY_CHECKOUT_FORM,
      customerName: 'Anna Beck',
    })
  })

  it('verwirft einen Termin, der auf dem Ruhetag liegt', () => {
    const restored = restoreCheckoutForm(
      JSON.stringify({ customerName: 'Anna Beck', pickupDate: MONDAY }),
      TODAY
    )
    expect((restored as CheckoutFormValues).pickupDate).toBe('')
  })

  it('gibt null zurück, wenn nach dem Aufräumen nichts übrig bleibt', () => {
    expect(
      restoreCheckoutForm(JSON.stringify({ pickupDate: MONDAY }), TODAY)
    ).toBeNull()
  })
})
