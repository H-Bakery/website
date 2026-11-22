# Plan: Bankbuchungen in der App - ansehen, zuordnen, mit Rechnungen verknüpfen

Stand 22.11.2026. Planungsdokument, kein Pflichtenheft: Stufe 0 ist gebaut, alles danach ist
Vorschlag und wartet auf die Entscheidungen des Inhabers (Abschnitt „Offene Fragen“).
Regeln der gebauten Teile: [`domains/finanzen.md`](domains/finanzen.md) (Abschnitt Buchungen),
API: [`api/hq-data.md`](api/hq-data.md).

**Dieses Repo ist öffentlich.** Beispiele hier und in Tests sind erfunden; echte Buchungen,
Beträge, Namen und IBANs bleiben in `hq`.

## Ausgangslage

| Was                               | Wo                                                       | Wer pflegt es                                                         |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Kontoauszug (CSV-CAMT, Sparkasse) | `hq/data/finance/bank/ksk/*.CSV`                         | Inhaber lädt im Online-Banking herunter                               |
| Einzelbuchungen je Monat          | `hq/data/finance/transactions/JJJJ-MM.json`              | `import_bank_csv.py` (von Hand am Mac)                                |
| Zuordnungsregeln                  | `hq/data/finance/config/categories.json` (≈110 Regeln)   | von Hand in hq; erste passende Regel gewinnt                          |
| Monatssummen, Berichte            | `finance-summary.json`, `reports/`                       | `analyze_finance.py`                                                  |
| Ausgangsrechnungen                | Datenbank der App (`/admin/rechnungen`, `/api/invoices`) | Inhaber in der App ([`domains/rechnungen.md`](domains/rechnungen.md)) |
| Eingangsrechnungen (Lieferanten)  | Papier / E-Mail - **nirgends erfasst**                   | –                                                                     |

Die Buchungs-ID ist ein SHA-1 über Konto, Buchungs- und Valutadatum, Betrag, Gegenseite, IBAN,
Verwendungszweck und Buchungstext (16 Hex-Zeichen). Sie ist stabil, solange die Bank dieselbe
Zeile liefert. **Zwei Grenzen, die jede Verknüpfung beachten muss:** eine _vorgemerkte_ Buchung
kann beim endgültigen Buchen einen anderen Text bekommen (neue ID), und zwei völlig gleiche
Buchungen am selben Tag hätten dieselbe ID.

## Stufe 0 - Ansehen (gebaut, dieses PR)

- `/admin/finance/buchungen`: Monat wählen, Tabelle (am Handy Karten), Suche (Name, Zweck,
  Betrag), Filter Kategorie und Eingänge/Ausgänge, Summen gefiltert und je Monat.
- `/admin/finance/buchungen/[id]`: Detailseite (eigene Seite statt Modal: verlinkbar, Zurück-Taste
  funktioniert, am Handy besser lesbar) mit Zuordnung und weiteren Buchungen derselben Gegenseite.
- Nur lesen. Inhaber mit Passwort-Sitzung, IBAN maskiert, Referenzen weg, `no-store`.

## Stufe 1 - Zuordnen in der App

Ziel: Die „Nicht zugeordnet“-Buchungen (heute rund ein Dutzend, vor allem neue Lieferanten) ohne
Texteditor wegarbeiten.

**Zwei Werkzeuge auf der Detailseite:**

1. **„Für alle Buchungen dieser Gegenseite“** → neue Regel in `categories.json`
   (`match_on: counterparty`, `contains: <Name>`, Richtung aus dem Vorzeichen, Kategorie +
   Unterkategorie aus einer Auswahl). Vorschau: „trifft 7 Buchungen in 4 Monaten, davon 2 bisher
   anders zugeordnet“. Der Normalfall.
2. **„Nur diese Buchung“** → Ausnahme in einer neuen Datei `config/overrides.json`
   (`{ "<id>": { "category": …, "subcategory": …, "note": … } }`), die `import_bank_csv.py` **vor**
   den Regeln anwendet. Für Einzelfälle (Erstattung, Privatentnahme).

**Schreibweg wie bei Produkten und Backzettel:** Commit im hq-Schreib-Klon `HQ_WRITE_DIR` auf
`app/edits`, rollender PR nach hq ([`api/hq-products.md`](api/hq-products.md), B5b). Kein direkter
Push auf `main`.

**Neu einordnen:** Die Python-Skripte bleiben die einzige Stelle, die zuordnet (keine zweite
Implementierung in JS). Vorschlag: eine GitHub Action in hq führt bei jedem PR, der
`config/categories.json` oder `config/overrides.json` ändert, `import_bank_csv.py &&
analyze_finance.py` aus und committet das Ergebnis in denselben PR. Bis der PR gemergt und
synchronisiert ist (≤ 10 Min.), zeigt die App an der Buchung „Neue Zuordnung vorgemerkt – wirkt
nach dem Übernehmen“ (aus dem Schreib-Klon gelesen).

**Grenzen:** Neue Kategorien (nicht nur Regeln) bleiben vorerst Handarbeit in hq - sie ändern die
Ergebnisrechnung und den Jahresabschluss.

## Stufe 2 - Kontoauszug ohne Mac einlesen

Heute: CSV herunterladen → in hq ablegen → zwei Skripte → PR. Zwei Wege, Entscheidung offen:

- **a) Hochladen in der App** (klein, sicher): `/admin/finance/buchungen` → „Kontoauszug
  einlesen“ nimmt die CSV, prüft Kopfzeile und Konto, legt sie im Schreib-Klon unter `bank/ksk/`
  ab; die Action aus Stufe 1 rechnet. Keine Bank-Zugangsdaten auf der Box.
- **b) Automatisch abholen** wie die Kassenberichte (FinTS/HBCI, z. B. `python-fints`, auf
  `robot0`). Komfortabel, aber Online-Banking-Zugang und TAN-Verfahren auf einem Gerät im Laden -
  nur mit ausdrücklicher Zustimmung des Inhabers, Zugang dann nur lesend (falls die Sparkasse das
  anbietet).

Empfehlung: erst a); b) nur, wenn das Herunterladen wirklich stört.

## Stufe 3 - Mit Rechnungen verknüpfen

### 3a Ausgangsrechnungen (gibt es schon)

Eine Rechnung „per Überweisung“ wartet auf Geld. Ein Zahlungseingang trägt meist die
Rechnungsnummer im Verwendungszweck.

- **Vorschlag automatisch, Bestätigen von Hand.** Treffer, wenn ein Eingang die normalisierte
  Rechnungsnummer (`numberKey()` aus `invoice.core.js`) im Zweck enthält und der Betrag passt;
  schwächer: nur Betrag + Name. Der Inhaber bestätigt mit einem Tipp.
- **Speicherort: Datenbank der App**, nicht hq (Rechnungen leben dort): Tabelle
  `transaction_links (transaction_id, kind, target_id, amount, matched_by auto|manual,
confirmed_by, confirmed_at)`. Teilzahlungen = mehrere Zeilen.
- **Ausgestellte Rechnungen bleiben unveränderlich** - der Zahlungseingang ist ein eigener
  Datensatz, der Rechnungsinhalt und das festgeschriebene PDF ändern sich nicht.
- **Anzeige auf beiden Seiten:** an der Buchung „gehört zu Rechnung RE-…“, an der Rechnung
  „bezahlt am … (Bankeingang)“. Neue Liste **„Offene Posten“**: per Überweisung, fällig, kein
  Eingang.
- Wenn sich eine Buchungs-ID ändert (vorgemerkt → gebucht), wird die Verknüpfung über Betrag +
  Datum ± 3 Tage + Gegenseite neu gesucht und als „bitte prüfen“ markiert, nie still umgehängt.

### 3b Eingangsrechnungen und Belege (neu)

Zu jeder Lieferanten-Abbuchung gehört ein Beleg. Heute ist der nur auf Papier.

- **Beleg erfassen:** an der Buchung „Beleg hinzufügen“ → Foto (Handy) oder PDF; Lieferant,
  Rechnungsnummer, Datum, Betrag, Steuersatz von Hand (später Texterkennung als Vorschlag).
- **Ablage:** Dateien auf der Box unter `/var/lib/bakery/belege/` mit SHA-256 in der Datenbank,
  im restic-Backup. **Nicht** in `website` und nicht in hq (Git ist für PDFs und Fotos schlecht
  geeignet). Aufbewahrungsfristen und GoBD-Anforderungen vorher mit dem Steuerberater klären.
- **Abgleich:** „Ausgaben ohne Beleg“ je Monat als Liste - genau das, was der Steuerberater am
  Jahresende fragt.
- Optional: Belege per Telegram an Anna, die sie ablegt. Offen, ob gewünscht (siehe unten).

## Stufe 4 - Auswertungen auf dieser Grundlage

- **Lieferanten:** Ausgaben je Gegenseite und Monat, Preisentwicklung je Lieferant.
- **Wiederkehrende Abbuchungen** (Miete, Versicherungen, Leasing) erkennen → Fixkosten-Kalender,
  speist das Tagesziel ([`domains/finanzen.md`](domains/finanzen.md), Tagesziel-Ampel).
- **Kasse ↔ Bank:** Bareinzahlungen gegen die Tageslosungen der Kassenberichte - der
  Kassenabgleich der Monatsanalyse auf Tagesebene.
- **Export für den Steuerberater** (CSV, später DATEV-Format), mit Beleg-Verweisen.

## Datenschutz (gilt für alle Stufen)

- Nur Inhaber mit Passwort-Sitzung; nie an der PIN-Station, nie in einer Kachel für andere Rollen.
- Server-Whitelist wie in Stufe 0; volle IBAN nie im Browser. Lohnbuchungen sind Personaldaten -
  bei einer späteren Rolle „Buchhaltung“ prüfen, ob die Kategorie `personal` ausgeblendet wird.
- Bankdaten nicht über Telegram verschicken (Anna bekommt keine Buchungen).
- Tests und Screenshots nur mit erfundenen Daten.

## Offene Fragen an den Inhaber

1. Stufe 1: Reicht „Regel je Gegenseite + Ausnahme je Buchung“? Soll die hq-Action automatisch neu
   rechnen, oder lieber jeder PR von Hand?
2. Stufe 2: CSV hochladen (a) oder automatisch abholen (b)?
3. Stufe 3a: Wie oft wird per Überweisung bezahlt - lohnt die Liste „Offene Posten“ jetzt?
4. Stufe 3b: Sollen Lieferantenbelege digital werden? Wenn ja: Foto am Handy, E-Mail-Weiterleitung
   oder Telegram an Anna? Was sagt der Steuerberater zur Aufbewahrung?
5. Gibt es außer dem Inhaber jemanden, der Buchungen sehen soll (z. B. Steuerberater, Büro)?

## Reihenfolge (Vorschlag)

| Schritt | Inhalt                                               | Aufwand  | hängt ab von           |
| ------- | ---------------------------------------------------- | -------- | ---------------------- |
| 0       | Liste + Detail (gebaut)                              | –        | –                      |
| 1       | Zuordnen (Regel/Ausnahme), hq-Action                 | mittel   | Frage 1                |
| 2a      | CSV-Upload in der App                                | klein    | Frage 2, Stufe 1       |
| 3a      | Zahlungseingänge ↔ Ausgangsrechnungen, Offene Posten | mittel   | Frage 3                |
| 3b      | Belege erfassen und verknüpfen                       | groß     | Frage 4, Steuerberater |
| 4       | Auswertungen                                         | je klein | 1, 3                   |
