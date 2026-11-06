'use strict'

/**
 * Steuerzeichen in Namen und Texten - genau einmal (W4-Verifikation Runde 2;
 * vorher je eine Kopie in Vorbestellungen und hq-Produkten, Benutzer und
 * Partner prüften gar nicht).
 *
 * In einem Namen nichts verloren haben: C0/C1 (auch NUL), DEL und die
 * Bidi-Steuerzeichen (LRM/RLM, LRE…RLO, LRI…PDI), dazu (W4-Verifikation
 * Runde 3) das unsichtbare BOM U+FEFF sowie Zeilen-/Absatztrenner
 * U+2028/U+2029. NUL brach den git-Commit
 * der hq-Produkte, ein RLO dreht den Rest eines Namens auf Stationskacheln,
 * Abholliste und im CSV optisch um. Freitext (Anmerkung, Langtext) darf
 * Zeilenumbruch, Wagenrücklauf und Tab behalten.
 *
 * Dependency-freies CommonJS wie die übrigen `*.core.js`.
 */

/**
 * Unsichtbare Format- und Füllzeichen. Runde 4 führte sie als Liste
 * einzelner Codepunkte - Runde 5 fand die nächsten (U+17B4, U+180B, U+FE00,
 * U+1D173 …). Deshalb jetzt über Unicode-Eigenschaften statt Liste:
 * `\p{Cf}` (alle Formatzeichen: Bidi, ALM, weiches Trennzeichen, Null-Breite,
 * Tag-Zeichen, …) und `\p{Default_Ignorable_Code_Point}` (Füller wie
 * Hangul/Khmer, Variantenselektoren, Mongolische FVS), dazu U+FFFC
 * (Objekt-Ersatzzeichen, zeichnet je nach Schrift nichts oder ein Kästchen)
 * und die Zeilen-/Absatztrenner U+2028/U+2029 (Kategorie Zl/Zp, nicht Cf).
 * Zwei gleich aussehende Namen werden so nicht verschieden gespeichert, ein
 * RLO/ALM dreht nichts mehr um.
 *
 * Erlaubt bleiben, weil Emoji sonst zerfallen: U+200D (ZWJ, 👨‍🍳) und die
 * Darstellungsselektoren U+FE0E/U+FE0F (☕️, ❤️). Zusätzlich abgelehnt:
 * mehr als vier Kombinationszeichen am Stück („Zalgo“-Text, der über die
 * Nachbarzeilen von Abholliste und Stationskacheln wächst); echte Schrift
 * braucht höchstens zwei, drei (Vietnamesisch, Devanagari).
 *
 * W4-Verifikation Runde 6: ein ZWJ zwischen je vier Kombinationszeichen
 * setzte die Zählung zurück, und ein ZWJ neben Buchstaben machte aus
 * „Testkundin Fichte“ einen zweiten, gleich aussehenden Namen. Deshalb gilt
 * der ZWJ nur noch **zwischen zwei Emoji** (`EMOJI_ZWJ`), und gezählt wird
 * ohne ZWJ und Darstellungsselektoren.
 */
const ALLOWED_INVISIBLE = new Set(['\ufe0e', '\ufe0f'])
const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\u2028\u2029\ufffc]/gu
const STACKED_MARKS = /\p{M}{5,}/u
/** ZWJ einer Emoji-Sequenz: Emoji (+ Selektor/Hautton) ZWJ Emoji. */
const EMOJI_ZWJ =
  /(?<=\p{Extended_Pictographic}[\ufe0e\ufe0f\p{Emoji_Modifier}]*)\u200d(?=\p{Extended_Pictographic})/gu
const JOINERS = /[\u200d\ufe0e\ufe0f]/gu
const NAME_ASCII_CONTROL = /[\u0000-\u001f\u007f-\u009f]/
const TEXT_ASCII_CONTROL =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/

function hasInvisible(value) {
  for (const m of value.replace(EMOJI_ZWJ, '').matchAll(INVISIBLE)) {
    if (!ALLOWED_INVISIBLE.has(m[0])) return true
  }
  return false
}

/** Mehr als vier Kombinationszeichen am Stück - ZWJ/Selektoren zählen nicht als Pause. */
function hasStackedMarks(value) {
  return STACKED_MARKS.test(value.replace(JOINERS, ''))
}

function makeChecker(asciiControl) {
  const test = (value) =>
    typeof value === 'string' &&
    (asciiControl.test(value) || hasInvisible(value) || hasStackedMarks(value))
  // Aufrufer benutzen `NAME_CONTROL_CHARS.test(x)` wie eine RegExp.
  return { test, source: asciiControl.source }
}

const NAME_CONTROL_CHARS = makeChecker(NAME_ASCII_CONTROL)
const TEXT_CONTROL_CHARS = makeChecker(TEXT_ASCII_CONTROL)

/** `true`, wenn ein einzeiliger Name unzulässige Steuerzeichen enthält. */
function hasNameControlChars(value) {
  return NAME_CONTROL_CHARS.test(value)
}

/** `true`, wenn ein Freitext unzulässige Steuerzeichen enthält. */
function hasTextControlChars(value) {
  return TEXT_CONTROL_CHARS.test(value)
}

module.exports = {
  NAME_CONTROL_CHARS,
  TEXT_CONTROL_CHARS,
  hasNameControlChars,
  hasTextControlChars,
}
