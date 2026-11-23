# Belege und Buchungsverknüpfungen

Die Verwaltung unter `/admin/finance/belege` und die API sind dem Inhaber mit persönlicher
Passwort-Sitzung vorbehalten. Eine PIN-Sitzung bekommt `403 personal_session_required`. Alle
Antworten einschließlich Originaldateien tragen `Cache-Control: no-store`. JSON-Antworten haben die
Form `{ success: true, data }`. Fehler enthalten `{ success: false, error, message }` mit
deutscher Meldung. Lieferanten-IBANs sind in den Datenbankfeldern serverseitig und erscheinen
in JSON nur maskiert. Die USt-IdNr. bleibt in den serverseitigen Belegdaten. Der berechtigte
Dateidownload gibt das unveränderte Original mit den darin enthaltenen Angaben aus.

| Methode und Pfad                                       | Wirkung                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/receipts`                                   | Erste Datei speichern. Optional `?buchung=<id>` als Hinweis aus der Buchungsdetailseite                      |
| `POST /api/receipts/:id/files`                         | Weitere Datei anhängen, solange der Beleg in Prüfung ist                                                     |
| `GET /api/receipts?monat=&status=`                     | Belege nach Monat und optional nach `neu`, `erkannt`, `geprueft` oder `verworfen`                            |
| `GET /api/receipts/without-booking?monat=`             | Belege ohne aktuell auffindbare bestätigte Buchungsverknüpfung. Barzahlungen und verworfene Belege entfallen |
| `GET /api/receipts/:id`                                | Belegfelder, Dateien, Hinweisbuchung, mögliche Duplikate und Status der Erkennung                            |
| `GET /api/receipts/:id/files/:fileId`                  | Original als Download mit MIME-Typ und Header `X-Receipt-Sha256`                                             |
| `PATCH /api/receipts/:id`                              | Nur mitgesendete Belegfelder korrigieren. Auch nach Bestätigung mit Alt- und Neuwert im Audit                |
| `POST /api/receipts/:id/confirm`                       | Beleg nach Sichtprüfung bestätigen                                                                           |
| `POST /api/receipts/:id/discard`                       | Ungeprüften Beleg als verworfen markieren                                                                    |
| `DELETE /api/receipts/:id`                             | Ungeprüften Beleg aus der Datenbank entfernen                                                                |
| `GET /api/receipts/matches?monat=&beleg=&buchung=`     | Rangliste der Vorschläge und bestätigte Zuordnungen, optional nach Beleg-ID oder Buchungs-ID gefiltert       |
| `POST /api/transaction-links`                          | Vorschlag bestätigen oder ausdrücklich manuell verknüpfen                                                    |
| `POST /api/transaction-links/:id/reject`               | Vorschlag ablehnen. `:id` ist die ID aus der Rangliste                                                       |
| `GET /api/finance/transactions/without-receipt?monat=` | Abbuchungen ohne bestätigte Zuordnung, abzüglich konfigurierter Ausnahmen                                    |

Der Monat hat das Format `JJJJ-MM` und ist standardmäßig der laufende Berliner Monat. Bei Belegen
zählt das Rechnungsdatum, ersatzweise der Uploadmonat. Bei Buchungen zählt das Buchungsdatum. Mit
`beleg` oder `buchung` und ohne `monat` sucht der Abgleich auch über Monatsgrenzen hinweg. Fehlt eine
Bank-Monatsdatei oder ist sie ungültig, meldet die Ausgabenliste `available: false`. Eine gültige
Monatsdatei ohne offene Buchungen ergibt `available: true` mit leerer Liste.

## Dateien und Erkennung

Je Upload eine Datei als Rohkörper, mit `Content-Type` für JPEG, PNG, HEIC, PDF, XML oder
`application/octet-stream`. Der Server prüft den tatsächlichen Dateianfang. Das Limit beträgt
15.000.000 Bytes je Datei und zehn Dateien je Beleg. Die Schreibpfade entstehen aus Uploadmonat,
SHA-256 und erkannter Endung. Als Pfadangabe dient ausschließlich der intern erzeugte Dateiname.
HTTP 201 enthält `{ id, file_id, status: 'gespeichert' }`. Derselbe SHA-256 ergibt `409
duplicate_receipt_file` mit `receipt_id` des vorhandenen Belegs. Gleicher Lieferantenname und
gleiche normalisierte Rechnungsnummer werden als `duplicates` in der Detailantwort gemeldet.

Der lokale Erkennungslauf beginnt nach der Upload-Antwort. `extraction_pending` zeigt einen im
laufenden Prozess noch offenen Versuch. Pure UBL- und CII-XML werden ohne DTD und ohne externe
Entitäten gelesen. Bei PDFs kann ein installiertes `pdftotext` die Textschicht auslesen. Bei Fotos,
Scans ohne Textschicht und ohne verfügbares `pdftotext` bleibt die manuelle Eingabe offen.
Scheitert ein Erkennungslauf, enthält die Detailantwort `extraction_errors` mit einem deutschen
Hinweis. Rohdaten und vollständige Extraktionsfelder bleiben auf dem Server. Der gemeinsame
Feldvorschlag wird mit `extracted_by`, `confidence` und `field_flags` gespeichert. Bei bereits
bearbeiteten, bestätigten oder verworfenen Belegen protokolliert die Erkennung ihren Lauf und
belässt die Belegfelder. Pure XML hat Vorrang vor einer Textschicht. Nach einem Prozessneustart
bleibt ein noch unbearbeiteter Beleg manuell prüfbar.

`PATCH` akzeptiert unter anderem `kind`, `supplier_name`, `supplier_vat_id`, `supplier_iban`,
`invoice_number`, `invoice_date`, `due_date`, `gross_cents`, `currency`, `payment`, `skonto_rate`,
`skonto_due_date` und `vat_lines: [{ rate, net_cents, vat_cents }]`. Geld steht in ganzen Cent,
Datum in `JJJJ-MM-TT` und Steuersatz und Skonto in Prozent. Ein gesendetes `vat_lines` ersetzt die
ganze Aufteilung. `null` leert optionale Felder. Bestätigen verlangt mindestens Lieferant,
Rechnungsdatum bis heute und einen eingetragenen Bruttobetrag.

## Bestätigung des Abgleichs

Ein Vorschlag trägt `status: 'vorgeschlagen'`, eine ID, einen Punktwert und einen oder mehrere
`parts` mit Buchung, Ziel, Teilbetrag und gegebenenfalls Skonto. Die API berechnet Vorschläge beim
Lesen und speichert eine Entscheidung erst nach ausdrücklicher Aktion. Bestätigung mit
`{ proposal_id }` berechnet den Vorschlag erneut und speichert alle Teile in einer Transaktion.
Einen inzwischen geänderten Vorschlag beantwortet die API mit `409 proposal_changed`.
Eine manuelle Bestätigung erwartet `{ transaction_id, kind, target_id, amount_cents? }`. Bei
weggelassenem Teilbetrag nimmt der Server den kleineren offenen Betrag von Beleg und Buchung.
Für eine ausdrücklich ausgewählte Ersatzbuchung sendet der Client zusätzlich `replace_link_id`.
Die bestätigte Zuordnung zeigt bei fehlender alter Buchungs-ID `review_required` und gegebenenfalls
`replacements`. Die API hält die alte ID bis zur ausdrücklichen Korrektur fest. Wird ein ungeprüfter Beleg
verworfen oder gelöscht, hebt die API seine Verknüpfungen mit Audit-Eintrag auf.

Optional enthält `$HQ_FINANCE_DIR/config/receipt-exclusions.json` ein Objekt mit der Liste
`excluded_categories` von Kategorie-IDs aus hq. Die Vorgabe bei fehlender oder ungültiger Datei ist
`{ "excluded_categories": [] }`.

Die Migration `20270403000000-receipts.js` legt `receipts`, `receipt_vat_lines`, `receipt_files`,
`receipt_extractions` und `transaction_links` an. `audit_log` enthält Erfassung, Dateiergänzungen,
Feldänderungen, Bestätigungen und Ablehnungen mit Zeit und Akteur. Der
Dienst `ReceiptsService.verifyFileHashes()` prüft alle in der Datenbank geführten Originale
und meldet fehlende, unlesbare oder geänderte Dateien.
