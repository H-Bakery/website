# Factur-X / ZUGFeRD XSD, Profil EN 16931

Die offiziellen Schemadateien des Profils EN 16931 (Factur-X 1.09, entspricht ZUGFeRD 2.4),
unverändert. `tests/unit/invoiceCore.test.js` prüft damit die erzeugte XML (`xmllint --schema`).

Herausgeber: FNFE-MPE / FeRD (Forum elektronische Rechnung Deutschland), frei verwendbar.
Bezogen aus der Sammlung in
[akretion/factur-x](https://github.com/akretion/factur-x/tree/master/src/facturx/xsd_and_schematron/facturx-en16931).

Einstieg ist `Factur-X_EN16931.xsd`; die drei anderen Dateien werden von dort importiert.

Die Geschäftsregeln der EN 16931 (Schematron) liegen nicht hier: sie brauchen einen
XSLT-2.0-Prozessor. Geprüft werden sie in der CI mit Mustang (`.github/workflows/
invoice-conformance.yml`), siehe `docs/api/invoices.md`.
