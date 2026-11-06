'use strict'

/**
 * Steuerzeichen in Namen und Texten - genau einmal (W4-Verifikation Runde 2;
 * vorher je eine Kopie in Vorbestellungen und hq-Produkten, Benutzer und
 * Partner prüften gar nicht).
 *
 * In einem Namen nichts verloren haben: C0/C1 (auch NUL), DEL und die
 * Bidi-Steuerzeichen (LRM/RLM, LRE…RLO, LRI…PDI). NUL brach den git-Commit
 * der hq-Produkte, ein RLO dreht den Rest eines Namens auf Stationskacheln,
 * Abholliste und im CSV optisch um. Freitext (Anmerkung, Langtext) darf
 * Zeilenumbruch, Wagenrücklauf und Tab behalten.
 *
 * Dependency-freies CommonJS wie die übrigen `*.core.js`.
 */

// eslint-disable-next-line no-control-regex
const NAME_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/
// eslint-disable-next-line no-control-regex
const TEXT_CONTROL_CHARS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/

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
