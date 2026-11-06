const {
  hasNameControlChars,
  hasTextControlChars,
} = require('../../src/services/control-chars.core')

describe('control-chars.core (W4-verify r2/r3)', () => {
  it.each([
    ['NUL', 'a\u0000b'],
    ['BEL', 'a\u0007b'],
    ['RLO', 'a‮b'],
    ['LRI', 'a⁦b'],
    ['BOM', 'a﻿b'],
    ['Zeilentrenner', 'a b'],
  ])('Name mit %s wird abgelehnt', (_label, value) => {
    expect(hasNameControlChars(value)).toBe(true)
    expect(hasTextControlChars(value)).toBe(true)
  })

  it('Umlaute, Emoji und Gedankenstriche sind erlaubt; Freitext darf umbrechen', () => {
    expect(hasNameControlChars('Bäckerei Öztürk – Laden 🥨')).toBe(false)
    expect(hasNameControlChars('Zeile\nZeile')).toBe(true)
    expect(hasTextControlChars('Zeile\nZeile\tmit Tab\r\n')).toBe(false)
  })
})

describe('control-chars.core: unsichtbare Format- und Füllzeichen (W4-verify r4)', () => {
  it.each([
    ['ALM U+061C', 'Almtest Weber ؜10-20 Uhr'],
    ['weiches Trennzeichen', 'Mus­ter'],
    ['Null-Breiten-Leerzeichen', 'Mus​ter'],
    ['ZWNJ', 'Mus‌ter'],
    ['Wortverbinder', 'Mus⁠ter'],
    ['Hangul-Füller', 'Musterㅤ'],
    ['Annotationszeichen', 'Mus￹ter'],
    ['Tag-Zeichen U+E0041', 'Muster\u{e0041}'],
    ['LRM', 'a‎b'],
  ])('%s wird in Namen und Freitext abgelehnt', (_label, value) => {
    expect(hasNameControlChars(value)).toBe(true)
    expect(hasTextControlChars(value)).toBe(true)
  })

  it('Emoji mit ZWJ und gewöhnliche Sonderzeichen bleiben erlaubt', () => {
    expect(hasNameControlChars('Backstube 👨‍🍳')).toBe(false)
    expect(hasNameControlChars('Café „Zur Ecke“ – 10-20 Uhr')).toBe(false)
    expect(hasNameControlChars('Muster 😀')).toBe(false)
  })
})
