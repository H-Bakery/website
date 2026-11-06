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

describe('control-chars.core: Unicode-Eigenschaften statt Liste (W4-verify r5)', () => {
  it.each([
    ['Khmer U+17B4', 'Ab឴c'],
    ['Mongolischer FVS U+180B', 'Ab᠋c'],
    ['Variantenselektor U+FE00', 'Ab︀c'],
    ['Musik-Formatzeichen U+1D173', 'Ab\u{1d173}c'],
    ['Objekt-Ersatzzeichen U+FFFC', 'Ab￼c'],
    ['Arabisches Zahlzeichen U+0600 (Cf)', 'Ab؀c'],
    ['Variantenselektor U+E0100', 'Ab\u{e0100}c'],
    ['40 gestapelte Akzente', 'A' + '́'.repeat(40)],
  ])('%s wird in Namen und Freitext abgelehnt', (_label, value) => {
    expect(hasNameControlChars(value)).toBe(true)
    expect(hasTextControlChars(value)).toBe(true)
  })

  it('Emoji-Darstellungsselektor, ZWJ und echte Akzente bleiben erlaubt', () => {
    expect(hasNameControlChars('Kaffee ☕️ und ❤️')).toBe(false)
    expect(hasNameControlChars('Backstube 👨‍🍳')).toBe(false)
    expect(hasNameControlChars('Nguyễn Thị')).toBe(false)
    expect(hasNameControlChars('Café mit Akzent')).toBe(false)
    expect(hasTextControlChars('Zeile\nZeile\tmit Tab\r\n')).toBe(false)
  })
})
