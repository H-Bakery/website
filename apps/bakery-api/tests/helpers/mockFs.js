/**
 * Ersatz für `mock-fs` auf Basis von `memfs`.
 *
 * `mock-fs` steht nur in apps/bakery-api/package.json, das npm im Monorepo
 * nie installiert. `memfs` liegt (transitiv) in node_modules und bietet
 * dasselbe: ein In-Memory-Dateisystem, das die Tests mit einem Objektbaum
 * befüllen. Anders als `mock-fs` patcht memfs nicht das globale fs-Binding,
 * sondern wird pro Testdatei über `jest.mock('fs', ...)` eingehängt - Jest
 * selbst (Modul-Loader, Coverage) liest weiter vom echten Dateisystem.
 *
 * Verwendung - beide Zeilen gehören an den Anfang der Testdatei:
 *
 *   jest.mock('fs', () => require('memfs').fs)
 *   const mockFs = require('../helpers/mockFs')
 *
 *   mockFs({ '/abs/pfad': { 'datei.md': 'inhalt', leer: {} } })  // Baum setzen
 *   mockFs.restore()                                              // leeren
 *
 * Relative Schlüssel werden wie bei `mock-fs` gegen process.cwd() aufgelöst.
 */
const { vol } = require('memfs')

function mockFs(tree = {}) {
  vol.reset()
  vol.fromNestedJSON(tree)
}

mockFs.restore = () => {
  vol.reset()
}

module.exports = mockFs
