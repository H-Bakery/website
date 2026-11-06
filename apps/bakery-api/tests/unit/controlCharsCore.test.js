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
