# Rechnungen (Ausgangsrechnungen mit ZUGFeRD)

Der Inhaber stellt unter `/admin/rechnungen` Rechnungen aus - frei oder aus einer Vorbestellung -
und lädt sie als PDF, in dem dieselbe Rechnung zusätzlich als XML steckt (ZUGFeRD/Factur-X, Profil
EN 16931). Nur die Rolle `inhaber` sieht und darf das.

**Code:** Regeln und Formeln `apps/bakery-api/src/services/invoice.core.js` · DB, Transaktion, Audit
`invoices.service.ts` · PDF `invoice-pdf.ts` · Verkäufer `invoice-seller.ts` · Routen
`src/routes/invoices.routes.ts` (`/api/invoices`) · Management-App `src/lib/invoicesApi.ts`,
`src/app/admin/rechnungen/`, `src/components/invoices/`.
API-Details (Endpunkte, Fehlercodes, Tabellen, PDF-Aufbau, Prüfung):
[`docs/api/invoices.md`](../api/invoices.md).

## Stand und was (noch) nicht geht

- **Die Rechnungsnummer trägt der Inhaber ein.** Das alte System läuft parallel und vergibt die
  Nummern; die App zählt **nicht** selbst. Sie prüft nur: Pflicht beim Ausstellen, eindeutig, höchstens
  40 Zeichen, ohne `< > & " '`. Ein eigener Nummernkreis kommt erst, wenn das alte System abgelöst
  ist (Frage an den Steuerberater, `docs/roadmap.md` §7).
- **7 % ist eine Annahme.** Vorgabe je Position ist der ermäßigte Satz (Backwaren zum Mitnehmen),
  19 % ist je Position wählbar. Die Vorgabe steht an genau einer Stelle
  (`DEFAULT_VAT_RATE` in `invoice.core.js`) und ist vom Steuerberater **noch nicht bestätigt**. hq
  kennt keinen Steuersatz je Produkt - wer Getränke oder Verzehr im Laden berechnet, stellt die
  Position selbst auf 19 %.
- **Kein Stornobeleg.** „Stornieren“ markiert die Rechnung (mit Grund und Datum, Aufdruck im PDF).
  Eine förmliche Stornorechnung mit eigener Nummer (Typ 381) erzeugt die App nicht.
- **Nicht gebaut:** Anzahlungen/„bereits bezahlt“, Rabatte und Zuschläge, Lieferanschrift,
  USt-IdNr. des Empfängers, Versand per E-Mail, Sammel- und Monatsrechnungen (CAP), Kunden-Stammdaten,
  andere Währungen und Länderregeln als Deutschland.

## Regeln

- **Die Rechnung steht genau einmal**, in `invoice.core.js` (dependency-frei): Positionsbeträge,
  Umsatzsteuer je Satz, Rundung, Pflichtangaben, XML. Die Management-App rechnet nichts - sie zeigt
  die Beträge der API und formatiert mit denselben Funktionen (`formatEuro`, `formatIban` …).
- **Entwurf und ausgestellt.** Ein Entwurf braucht keine Nummer, darf unvollständig sein und lässt
  sich ändern oder löschen. **„Ausstellen“** verlangt Nummer, Rechnungs- und Leistungsdatum, die
  vollständige Anschrift des Empfängers (Name, Straße, PLZ, Ort), mindestens eine Position, einen
  Betrag über 0 und die Bankverbindung der Bäckerei. Die App zeigt am Entwurf, was noch fehlt.
- **Ausgestellt ist unveränderlich.** Beim Ausstellen werden Verkäufer (mit Bankverbindung), Summen
  und die XML festgeschrieben; PDF und XML kommen danach nur noch aus diesem Stand. Ändern und
  Löschen antworten mit 409. **Korrektur = stornieren und eine neue Rechnung mit neuer Nummer
  ausstellen.** Eine vergebene Nummer bleibt vergeben, auch nach dem Storno.
- **Aus einer Vorbestellung** („Rechnung erstellen“ auf der Detailseite, nur Inhaber, nicht bei
  stornierten): Positionen mit den Preisen der Vorbestellung (die aus dem hq-Katalog stammen), Name
  des Kunden, Leistungsdatum = Abholtag, Bestellcode als Bezug. Die Anschrift trägt der Inhaber
  nach - die Vorbestellung kennt nur einen Namen. Je Vorbestellung gibt es höchstens eine nicht
  stornierte Rechnung.
- **Rechnungen werden nicht anonymisiert.** Die 90-Tage-Anonymisierung betrifft nur Vorbestellungen
  und Lieferstopps. Die Rechnung hält Name und Anschrift selbst (kein Fremdschlüssel) und bleibt
  vollständig - Aufbewahrungspflicht nach § 14b UStG. Das Audit-Log bekommt nur Nummer und Betrag.
- **Verkäuferangaben aus einer Quelle.** Name, Anschrift, USt-IdNr., Telefon und E-Mail kommen aus
  den Impressumsangaben (`LEGAL` in `libs/shared/utils/src/lib/legal.ts`, von der API einzeln als
  `@bakery/shared/legal` eingebunden; dieselbe Quelle wie Impressum und Preisliste) - nie abgetippt. Auf der Rechnung steht „Bäckerei …, Inh. …“.
- **Die Bankverbindung steht nicht im Repo.** IBAN, BIC und Kontoinhaber kommen aus der Umgebung der
  Box (`INVOICE_IBAN`, `INVOICE_BIC`, `INVOICE_ACCOUNT_HOLDER`; `docs/runbook.md` §3.6). Fehlt etwas
  oder ist die IBAN ungültig, wird **nicht ausgestellt** (409 `bank_not_configured`, deutsche
  Meldung, Hinweis schon am Entwurf) - es gibt keinen Platzhalter.
- **Zahlungsziel:** Vorgabe 14 Tage ab Rechnungsdatum, „Zahlbar per Überweisung“. Auf der Rechnung:
  „Zahlbar per Überweisung bis TT.MM.JJJJ ohne Abzug.“
- **Maßgeblich ist das PDF.** Die Ansicht in der App und ihr Browser-Druck zeigen dieselben Angaben,
  aber ohne Anschriftfeld und Fußzeile und ohne eingebettete XML. Verschickt und abgelegt wird die
  PDF-Datei („PDF (ZUGFeRD)“).

## Vom Bruttopreis zur Netto-Rechnung

Die Katalogpreise sind Verbraucherpreise (brutto). EN 16931 rechnet netto. Die Rechnung muss
trotzdem auf dem Betrag enden, den der Kunde kennt. `computeInvoice()` rechnet deshalb **je
Steuersatz von der Bruttosumme zurück** und rundet nicht je Position:

1. Position brutto = Menge × Brutto-Einzelpreis, auf Cent gerundet.
2. Je Steuersatz: `G` = Summe brutto, Netto `N = G − runde(G × Satz / (100 + Satz))`, Steuer
   `U = runde(N × Satz / 100)` - das ist genau die Rechnung, die EN 16931 prüft (BR-CO-17).
3. `N` wird nach größten Resten auf die Positionen verteilt; die Summe der Positionen ist exakt `N`
   (BR-CO-10, BR-S-08).
4. Der Netto-Einzelpreis in der XML hat vier Nachkommastellen und gilt je 1 Einheit; ab etwa
   100 Stück reicht das nicht, dann gilt er je 10, 100 oder 1000 (Basismenge, BT-149), sodass
   Menge × Preis immer den Positionsbetrag ergibt.
5. `N + U = G` gilt für die allermeisten Beträge. **Bei 7 % sind 7 von 107, bei 19 % 19 von 119
   Bruttobeträgen so nicht darstellbar** - Beispiel 4,81 € bei 7 %: aus 4,49 € netto werden 4,80 €,
   aus 4,50 € netto 4,82 €. Dann steht auf der Rechnung „Rechnungsbetrag 4,82 €, Rundung −0,01 €,
   Zahlbetrag 4,81 €“ (Rundungsbetrag BT-114, BR-CO-16). Der Zahlbetrag ist **immer** die
   Bruttosumme; kein Betrag wird passend gemacht. Etwa jede 15. Rechnung mit nur 7 % hat diese Zeile.

Die Alternative - Steuer aus dem Brutto herausrechnen (`G × 7/107`) und Netto als Rest - endet ohne
Rundungszeile, verletzt aber in denselben Fällen BR-CO-17 um einen Cent. Welche Darstellung der
Steuerberater bevorzugt, ist eine offene Frage (`docs/roadmap.md` §7).

Geld ist überall ganze Cent; gerundet wird kaufmännisch mit ganzen Zahlen (`divRound`).
`checkBusinessRules()` rechnet die Regeln nach; die Tests laufen über jeden Bruttobetrag bis 300 €
je Satz und über Zufallsrechnungen mit krummen Mengen.

## Pflichtangaben (§ 14 Abs. 4 UStG) und wo sie herkommen

| Angabe                                          | Quelle                                      |
| ----------------------------------------------- | ------------------------------------------- |
| Name und Anschrift der Bäckerei                 | Impressumsangaben (`legal.ts`), mit Inhaber |
| Name und Anschrift des Empfängers               | Formular (Pflicht beim Ausstellen)          |
| USt-IdNr. der Bäckerei                          | Impressumsangaben                           |
| Ausstellungsdatum                               | Formular, Vorgabe heute                     |
| Fortlaufende Rechnungsnummer                    | Formular - vom Inhaber aus dem alten System |
| Menge und Bezeichnung                           | Positionen                                  |
| Zeitpunkt der Lieferung                         | Liefer-/Leistungsdatum, Vorgabe Abholtag    |
| Entgelt je Steuersatz, Steuersatz, Steuerbetrag | gerechnet (`computeInvoice`), Summenblock   |
| Bruttobetrag, Zahlungsziel, Bankverbindung      | gerechnet / Formular / Umgebung der Box     |

## Geprüft und nicht geprüft

- **XML gegen das offizielle XSD** (Factur-X 1.09, EN 16931): `xmllint` im Test
  `tests/unit/invoiceCore.test.js`; lokal übersprungen, wenn `xmllint` fehlt, in der CI Pflicht.
- **Geschäftsregeln der EN 16931 (Schematron) und PDF/A-3b:** nicht lokal (braucht Java), sondern
  im CI-Workflow „Rechnungen (ZUGFeRD-Konformität)“ mit dem Mustang-Validator (enthält veraPDF) auf
  den synthetischen Beispielrechnungen. Stand und Handgriffe: `docs/api/invoices.md`.
- **Nicht geprüft:** die steuerliche Richtigkeit (Satz, Rundungsdarstellung, Nummernkreis) - das
  entscheidet der Steuerberater.
