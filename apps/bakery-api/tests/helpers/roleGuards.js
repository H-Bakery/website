/**
 * Rollen-Wache für die Unit-Tests der Routen-Module (`finance.routes.js`,
 * `targets.routes.js`), ohne Datenbank und ohne Anmeldung.
 *
 * Die Module bekommen in der API `createRoleGuards()` aus
 * `src/routes/hq-data.routes.ts` (B3-Sitzung, Rolle, persönliche Sitzung) -
 * das prüfen die Integrationstests (`tests/integration/hqData.test.ts`). Hier
 * geht es nur darum, dass jedes Modul seine Routen hinter der verlangten
 * Rolle einhängt: das „Token“ ist schlicht die Rolle (`Bearer inhaber`).
 */

'use strict'

function testRoleGuards() {
  return {
    requireRole:
      (...roles) =>
      (req, res, next) => {
        const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '')
        if (!match) {
          return res.status(401).json({
            success: false,
            error: 'unauthorized',
            message: 'Bitte zuerst anmelden.',
          })
        }
        if (!roles.includes(match[1])) {
          return res.status(403).json({
            success: false,
            error: 'forbidden',
            message: 'Keine Berechtigung für diesen Bereich.',
          })
        }
        return next()
      },
  }
}

module.exports = { testRoleGuards }
