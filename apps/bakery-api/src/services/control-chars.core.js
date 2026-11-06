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
 * Unsichtbare Format- und Füllzeichen (W4-Verifikation Runde 4): U+061C
 * (Arabic Letter Mark) ist wie LRM/RLM ein Bidi-Steuerzeichen und drehte
 * „10-20“ in einem Namen zu „20-10“; weiches Trennzeichen, Null-Breiten-
 * Leerzeichen/-Nichtverbinder, Wortverbinder, unsichtbare Operatoren,
 * veraltete Formatzeichen, Hangul-Füller, Annotationszeichen und die
 * Tag-Zeichen U+E0000-E007F lassen zwei gleich aussehende Namen
 * verschieden gespeichert werden. Erlaubt bleibt U+200D (ZWJ) - ohne ihn
 * zerfallen Emoji wie 👨‍🍳.
 */
const INVISIBLE =
  '\\u00ad\\u034f\\u061c\\u115f\\u1160\\u180e\\u200b\\u200c\\u200e\\u200f' +
  '\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u206f\\u2028\\u2029\\u3164' +
  '\\ufeff\\uffa0\\ufff9-\\ufffb'
const TAG_CHARS = '|\\udb40[\\udc00-\\udc7f]'

const NAME_CONTROL_CHARS = new RegExp(
  `[\\u0000-\\u001f\\u007f-\\u009f${INVISIBLE}]${TAG_CHARS}`
)
const TEXT_CONTROL_CHARS = new RegExp(
  `[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f${INVISIBLE}]${TAG_CHARS}`
)

/** `true`, wenn ein einzeiliger Name unzulässige Steuerzeichen enthält. */
function hasNameControlChars(value) {
  return typeof value === 'string' && NAME_CONTROL_CHARS.test(value)
}

/** `true`, wenn ein Freitext unzulässige Steuerzeichen enthält. */
function hasTextControlChars(value) {
  return typeof value === 'string' && TEXT_CONTROL_CHARS.test(value)
}

module.exports = {
  NAME_CONTROL_CHARS,
  TEXT_CONTROL_CHARS,
  hasNameControlChars,
  hasTextControlChars,
}
