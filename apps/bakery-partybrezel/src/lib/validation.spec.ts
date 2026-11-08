import { partybrezelConfig as config } from '../config/partybrezel.config'
import { draft, pretzel } from './testing'
import {
  findMissingToppings,
  firstInvalidStep,
  resumeStep,
  stepErrors,
  validateName,
  validateNote,
  validateOrder,
  validatePhone,
  validatePickupDate,
  validatePickupTime,
  validatePretzelCount,
  validateToppings,
} from './validation'

describe('validation', () => {
  it('Name: Pflicht, höchstens 120 Zeichen, keine Steuerzeichen', () => {
    expect(validateName('')).toMatch(/Namen/)
    expect(validateName('   ')).toMatch(/Namen/)
    expect(validateName('Erika Beispiel')).toBeNull()
    expect(validateName('x'.repeat(120))).toBeNull()
    expect(validateName('x'.repeat(121))).toMatch(/120/)
    expect(validateName('Erika\u0007')).toMatch(/Steuerzeichen/)
    expect(validateName('Erika\u202eBeispiel')).toMatch(/Steuerzeichen/)
    expect(validateName('Erika\u200bBeispiel')).toMatch(/Steuerzeichen/)
    expect(validateName('Zoë Ünal')).toBeNull()
  })

  it('Steuerzeichen wie die API (control-chars.core.js)', () => {
    // unsichtbare Füll- und Formatzeichen
    expect(validateName('Erika\u3164')).toMatch(/Steuerzeichen/) // Hangul-Füller
    expect(validateName('Erika\ufe00')).toMatch(/Steuerzeichen/) // Variantenselektor
    expect(validateName('Erika\u180eB')).toMatch(/Steuerzeichen/)
    expect(validateName('Erika\ufffc')).toMatch(/Steuerzeichen/)
    expect(validateName('Erika\u00adBeispiel')).toMatch(/Steuerzeichen/)
    expect(validateName('Eri\tka')).toMatch(/Steuerzeichen/)
    // „Zalgo“: mehr als vier Kombinationszeichen am Stück
    expect(validateName('E\u0301\u0302\u0303\u0304\u0305rika')).toMatch(
      /Steuerzeichen/
    )
    expect(validateName('Nguyê\u0303n')).toBeNull()
    // ZWJ nur zwischen zwei Emoji, Darstellungsselektoren erlaubt
    expect(validateName('Erika \u{1F468}\u200d\u{1F373}')).toBeNull()
    expect(validateName('Erika \u2615\ufe0f')).toBeNull()
    expect(validateName('Eri\u200dka')).toMatch(/Steuerzeichen/)
    // Telefon prüft genauso
    expect(validatePhone('0000\u3164 12345')).toMatch(/unzulässige/)
    // Anmerkung: Tab, Zeilenumbruch, Wagenrücklauf erlaubt, Füller nicht
    expect(validateNote('a\tb', 300)).toBeNull()
    expect(validateNote('a\r\nb', 300)).toBeNull()
    expect(validateNote('a\u3164b', 300)).toMatch(/Steuerzeichen/)
  })

  it('Telefon: optional, sonst mindestens 5 Ziffern', () => {
    expect(validatePhone('')).toBeNull()
    expect(validatePhone('  ')).toBeNull()
    expect(validatePhone('0123')).toMatch(/5 Ziffern/)
    expect(validatePhone('01-2-3')).toMatch(/5 Ziffern/)
    expect(validatePhone('0000 12345')).toBeNull()
    expect(validatePhone('+49 (0) 000 000')).toBeNull()
    expect(validatePhone('1'.repeat(41))).toMatch(/zu lang/)
  })

  it('Anmerkung: Länge und Steuerzeichen, Zeilenumbruch erlaubt', () => {
    expect(validateNote('', 300)).toBeNull()
    expect(validateNote('Zeile 1\nZeile 2', 300)).toBeNull()
    expect(validateNote('x'.repeat(301), 300)).toMatch(/300/)
    expect(validateNote('a\u0000b', 300)).toMatch(/Steuerzeichen/)
  })

  it('Uhrzeit: optional, sonst HH:MM', () => {
    expect(validatePickupTime('')).toBeNull()
    expect(validatePickupTime('10:30')).toBeNull()
    expect(validatePickupTime('24:00')).toMatch(/HH:MM/)
    expect(validatePickupTime('9:30')).toMatch(/HH:MM/)
  })

  it('Abholtag: Pflicht und aus der angebotenen Liste', () => {
    expect(validatePickupDate(null, ['2026-11-10'])).toMatch(/Abholtag/)
    expect(validatePickupDate('2026-11-09', ['2026-11-10'])).toMatch(
      /nicht \(mehr\) wählbar/
    )
    expect(validatePickupDate('2026-11-10', ['2026-11-10'])).toBeNull()
  })

  it('Anzahl: mindestens 1, höchstens maxPretzelsPerOrder', () => {
    expect(validatePretzelCount([], config)).toMatch(/mindestens eine/)
    expect(validatePretzelCount([pretzel(config, 'klein')], config)).toBeNull()
    const many = Array.from({ length: config.maxPretzelsPerOrder + 1 }, () =>
      pretzel(config, 'klein')
    )
    expect(validatePretzelCount(many, config)).toMatch(
      String(config.maxPretzelsPerOrder)
    )
  })

  it('je Teil: jedes Teil braucht einen bekannten Belag', () => {
    const ok = pretzel(config, 'gross', ['butter', 'kaese', 'salami'])
    const open = pretzel(config, 'klein', ['butter', null, 'gibts-nicht'])
    expect(validateToppings([ok], 'per-part', config)).toBeNull()
    expect(findMissingToppings([ok, open], 'per-part', config)).toEqual([
      { pretzelId: open.id, index: 2, parts: [1, 2], mixed: false },
    ])
    expect(validateToppings([ok, open], 'per-part', config)).toMatch(/Brezel 2/)
  })

  it('je Brezel: gemischte Teile zählen als offen, nicht still als ein Belag', () => {
    const mixed = pretzel(config, 'gross', ['butter', 'kaese', 'salami'])
    const uniform = pretzel(config, 'klein', 'kaese')
    expect(
      findMissingToppings([uniform, mixed], 'per-pretzel', config)
    ).toEqual([{ pretzelId: mixed.id, index: 2, parts: [], mixed: true }])
    expect(validateToppings([uniform], 'per-pretzel', config)).toBeNull()
    expect(validateToppings([mixed], 'per-pretzel', config)).toMatch(
      /für jede Brezel einen Belag/
    )
  })

  it('validateOrder sammelt Fehler je Schritt', () => {
    const empty = validateOrder(draft({ pickupDate: null, name: '' }), config, [
      '2026-11-10',
    ])
    expect(empty.valid).toBe(false)
    expect(stepErrors(empty.errors, 0)).toHaveLength(1)
    expect(stepErrors(empty.errors, 1)).toHaveLength(0)
    expect(stepErrors(empty.errors, 2)).toHaveLength(2)
    expect(stepErrors(empty.errors, 3)).toHaveLength(0)

    const full = validateOrder(
      draft({
        pretzels: [pretzel(config, 'klein', 'butter')],
        pickupDate: '2026-11-10',
      }),
      config,
      ['2026-11-10']
    )
    expect(full).toEqual({ valid: true, errors: {} })
  })

  it('firstInvalidStep / resumeStep: nie hinter einem offenen Schritt', () => {
    const errors = { toppings: 'x' }
    expect(firstInvalidStep(errors, 3)).toBe(1)
    expect(firstInvalidStep(errors, 1)).toBe(-1)
    expect(firstInvalidStep({}, 3)).toBe(-1)
    expect(resumeStep({}, 3)).toBe(3)
    expect(resumeStep({}, 99)).toBe(3)
    expect(resumeStep({}, -2)).toBe(0)
    expect(resumeStep({}, Number.NaN)).toBe(0)
    expect(resumeStep(errors, 3)).toBe(1)
    expect(resumeStep(errors, 1)).toBe(1)
    expect(resumeStep({ name: 'x' }, 3)).toBe(2)
  })
})
