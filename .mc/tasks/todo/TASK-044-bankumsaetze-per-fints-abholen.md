---
id: TASK-044
title: Bankumsätze per FinTS automatisch abholen (statt CSV von Hand)
slug: bankumsaetze-per-fints-abholen
status: todo
priority: 3
owner: ''
projects: []
customers: []
tags:
  - finanzen
  - bank
  - fints
  - pipeline
  - robot0
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-28
---

# Bankumsätze per FinTS automatisch abholen (statt CSV von Hand)

## Kontext

Heute lädt der Inhaber den Kontoauszug als CSV-CAMT (V8) im Online-Banking einer Sparkasse
herunter, legt ihn in `hq/data/finance/bank/ksk/` ab, und am Mac laufen `import_bank_csv.py` +
`analyze_finance.py` → PR. Die App zeigt das Ergebnis unter `/admin/finance/buchungen`. Dieser Task
ist **Stufe 2 b** aus [`docs/finanzen-buchungen.md`](../../../docs/finanzen-buchungen.md)
(„Automatisch abholen“).

**Entschieden am 28.11.2026: Stufe 2 b per FinTS.** Der Inhaber will die Buchungen automatisch
holen lassen. Kein PSD2-Aggregator (kein Dritter, der alle Buchungen sieht) und kein EBICS (kostet
bei der Sparkasse Monatsgebühr). Damit liegt die Online-Banking-PIN auf dem Pi (eigener
Systembenutzer, root-only, siehe unten), und alle 90-180 Tage ist eine pushTAN nötig.

Vorbild ist die Kassen-Pipeline auf `robot0` (`hq/data/reports/docs/AUTOMATION.md`,
`agent/CLAUDE.md` §9): Zugangsdaten in einer 600-Datei, Deploy-Skript vom Mac, Cron, reine
Daten-Commits, `--dry-run`, Meldungstext kommt aus dem Skript.

Bank-Eckdaten (Institut, BLZ, FinTS-Endpunkt): privat in `hq/data/finance/bank/README.md`.
**Dieses Repo ist öffentlich** - keine Kontonummern, IBANs, Namen, Beträge, PIN oder Produkt-ID
hier, in Tests oder Commit-Texten.

## Ziel

Einmal täglich holt ein Skript auf `robot0` die neuen Buchungen des Geschäftskontos per FinTS
(PIN/TAN), legt sie als Rohdatei in hq ab und erzeugt `transactions/JJJJ-MM.json` mit **denselben
Feldern und IDs** wie der CSV-Import - ohne Duplikate gegenüber der CSV-Historie. Eine manuell
hochgeladene CSV funktioniert weiterhin (Rückfallweg).

## Recherche-Ergebnis (Stand 22.11.2026)

1. **Bibliothek:** `fints` (python-fints) **5.0.1** vom 09.10.2026, reines Python, LGPL.
   `FinTS3PinTanClient(blz, user, pin, url, product_id=…, from_data=…)`; `product_id` ist seit v4
   Pflicht (sonst `TypeError`). `get_sepa_accounts()` liefert die Konten.
   - `get_transactions(account, start, end, include_pending=False)` → MT940, geparst mit `mt940`
     (Felder aus `:86:`, z. B. `applicant_iban`, `end_to_end_reference`; vorgemerkte Umsätze nur mit
     `include_pending=True` und „evtl. ohne Buchungstag“). Seit 5.0 fällt es automatisch auf XML
     zurück, wenn die Bank kein MT940 mehr anbietet - Ausgabe kann dann abweichen.
   - `get_transactions_xml(account, start, end, supported_camt_messages=None)` → **zwei Listen
     CAMT-XML: gebucht + vorgemerkt.** Das ist dieselbe Quelle wie der CSV-Export („CSV-CAMT V8“ =
     camt.052.001.08): Gegen-IBAN/BIC, Name, `EndToEndId`, `MndtId`, Gläubiger-ID, Buchungs-/
     Valutadatum, Status `BOOK`/`PDNG`. **→ CAMT nehmen**, MT940 nur als Notlösung.
2. **Produktregistrierung:** Seit 2019 lassen Banken nur registrierte FinTS-Produkte zu. PDF-Formular
   auf fints.org ausfüllen, im Original an die dort genannte Stelle der Deutschen Kreditwirtschaft
   senden; die Registrierungsnummer kommt „in der Regel innerhalb von 10–15 Werktagen“. Gebühren
   nennt die Seite keine (gilt als kostenlos). Die Nummer geht bei jeder Dialog-Eröffnung als
   Produktbezeichnung mit (`product_id`), Produktversion frei. Der Inhaber registriert sich als
   „Hersteller“ eines Eigenbau-Werkzeugs. **Vorlauf: 2–4 Wochen einplanen.**
3. **PSD2 / starke Authentifizierung (SCA):** Kontoinformationen beim eigenen Institut fallen unter
   Art. 10 RTS (geändert durch VO (EU) 2022/2360, gilt seit 25.07.2023): Die Bank **darf** auf eine
   TAN verzichten, für Umsätze der **letzten 90 Tage**, sofern die letzte SCA **höchstens 180 Tage**
   her ist (vorher 90). „Darf“ - jede Bank entscheidet selbst; die Sparkassen verlangen laut eigener
   PSD2-Seite fürs Online-Banking-Login alle 180 Tage eine TAN. Für FinTS ist das nicht dokumentiert
   → im Test messen. Ältere Umsätze (> 90 Tage) brauchen immer eine TAN.
   - **Decoupled (S-pushTAN)** wird unterstützt (HKTAN7): `NeedTANResponse.decoupled == True`, dann
     `send_tan(resp, "")` wiederholen, bis der Inhaber in der App freigegeben hat.
   - **Zustand halten:** `client.deconstruct()` → Blob mit System-ID, BPD/UPD (ohne PIN). Mit
     `from_data=` wieder einlesen - ohne gespeicherte System-ID verlangen manche Banken bei jedem
     Login eine TAN. Blob nur aus vertrauenswürdiger Quelle laden (Doku: HMAC empfohlen).
     `pause_dialog()` / `resume_dialog()` / `NeedRetryResponse.from_data()` erlauben, eine TAN-Abfrage
     zu parken und später fortzusetzen.
   - `init_tan_response` kann schon beim Dialog-Start eine TAN verlangen - immer prüfen.
4. **Nur lesen:** python-fints überweist nur, wenn `simple_sepa_transfer` / `sepa_transfer` /
   `sepa_debit` aufgerufen wird, und selbst dann braucht es eine TAN vom Handy des Inhabers. Der
   Code darf diese APIs **nicht verwenden** (Test/grep in CI prüft das). Zusätzlich bei der Sparkasse
   erfragen: eigener Online-Banking-Zugang (eigener Anmeldename + PIN) nur mit
   Abfrageberechtigung bzw. Verfügungslimit 0 - Firmenkunden-Vereinbarungen kennen solche
   Berechtigungen oft; ob es hier geht, ist offen.
5. **Alternativen:**
   - **CSV-Upload in der App (Stufe 2 a):** kein Zugang auf dem Pi, null Risiko; bleibt Handarbeit.
   - **EBICS:** für Unternehmen gemacht, läuft unbeaufsichtigt ohne 180-Tage-TAN; kostet bei der
     Sparkasse Monatsgebühr, Einrichtung mit INI-Brief, Python-Bibliotheken meist kommerziell.
   - **PSD2-Aggregator (finAPI, GoCardless Bank Account Data, …):** fertige REST-API; aber Dritter
     sieht alle Buchungen, Verträge/Kosten, Zustimmung trotzdem alle 180 Tage; GoCardless verweist
     Neukunden inzwischen an den Vertrieb.

**Quellen:**
[PyPI fints](https://pypi.org/project/fints/) ·
[Doku: Umsätze lesen](https://python-fints.readthedocs.io/en/latest/reading.html) ·
[Doku: TANs](https://python-fints.readthedocs.io/en/latest/tans.html) ·
[Doku: Client-Zustand](https://python-fints.readthedocs.io/en/latest/client.html) ·
[Doku: Produkt-ID](https://python-fints.readthedocs.io/en/latest/quickstart.html#register-for-a-product-id) ·
[Upgrade 4→5](https://python-fints.readthedocs.io/en/latest/upgrading_4_5.html) ·
[Quellcode client.py](https://github.com/raphaelm/python-fints/blob/master/fints/client.py) ·
[fints.org Produktregistrierung](https://www.fints.org/de/hersteller/produktregistrierung) ·
[VO (EU) 2022/2360](https://eur-lex.europa.eu/eli/reg_del/2022/2360/oj) ·
[EBA Q&A 2023_6820](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2023_6820) ·
[Sparkasse zu PSD2](https://www.sparkasse.de/unsere-loesungen/privatkunden/rund-ums-konto/psd2.html) ·
[GoCardless Bank Account Data](https://gocardless.com/bank-account-data)

## Umsetzung (Vorschlag)

Code landet in `hq` (Skripte) und `agent/fleet/` (Pi-Seite); hier im Repo nur Doku.

- **`hq/data/finance/scripts/fints_fetch.py`**: liest Zugang aus der Secrets-Datei, lädt den
  Client-Blob, holt CAMT für `(letzter gebuchter Tag in transactions/ − 7 Tage) … heute` (immer
  < 90 Tage), schreibt die XML **roh** nach `bank/ksk/fints/JJJJ-MM-TT.camt052.xml` (gebucht +
  vorgemerkt getrennt) und speichert den Blob zurück. Nur `get_sepa_accounts` +
  `get_transactions_xml`. Optionen `--dry-run` (nichts schreiben/committen), `--freigabe` (s. u.).
- **Import erweitern statt zweiter Implementierung:** `import_bank_csv.py` liest zusätzlich
  `bank/*/fints/*.xml` (stdlib `xml.etree`) und bildet daraus **dieselben Felder** wie `normalize()`
  (`account`, `booking_date`, `value_date`, `booking_text`, `purpose`, `counterparty`,
  `counterparty_iban`, `counterparty_bic`, `creditor_id`, `mandate_reference`,
  `end_to_end_reference`, `amount`, `currency`, `status`, `source`). Wichtig: der Import baut
  `transactions/` jedes Mal **komplett aus den Rohdateien neu** - FinTS-Ergebnisse also nie direkt
  in `transactions/` schreiben, sonst löscht der nächste Lauf sie.
- **IDs / Duplikate:** Die ID ist SHA-1 über
  `account|booking_date|value_date|amount|counterparty|counterparty_iban|purpose|booking_text`.
  Das passt nur, wenn die CAMT-Felder exakt wie die CSV-Spalten aufbereitet werden (Buchungstext,
  Verwendungszweck zusammengesetzt, Leerzeichen, Konto als IBAN vs. Kontonummer). Erster Schritt:
  Überlappungstest gegen die letzte CSV (mind. 30 Tage) und Abbildung so lange anpassen, bis alle
  gebuchten IDs gleich sind. Bleibt ein Rest, Zweitschlüssel `account|booking_date|amount|
end_to_end_reference oder counterparty_iban` quellübergreifend - Treffer = Duplikat, CSV gewinnt.
  Jeder FinTS-Lauf zählt als „Export“ mit `first`/`last`, damit `superseded()` alte vorgemerkte
  Zeilen wie bisher verwirft.
- **Pi-Seite (`agent/fleet/`):** `deploy-fints-auth.sh` (Mac → Pi, PIN per `read -s`, nie im Repo,
  nie in Logs) und `setup-fints-fetch.sh` (venv mit `fints`, Smoke-Test, Zeitplan; idempotent,
  `--check`). Lauf 1× täglich morgens (z. B. 07:00, Buchungen der Nacht sind dann da), danach
  `import_bank_csv.py && analyze_finance.py`, Daten-Commit nach hq (Pfade nur `bank/ksk/fints/`,
  `transactions/`, `finance-summary.json`, `reports/`).
- **Kein Agent im Ablauf:** Anna und Robin haben Shell-Zugriff als Benutzer `robot`. Deshalb
  eigener Systembenutzer (z. B. `bakery-bank`) mit eigenem hq-Klon und systemd-Timer; Secrets +
  Blob unter `/etc/bakery-bank/` bzw. `/var/lib/bakery-bank/` (600/700). Die Agenten können PIN und
  Rohdaten so nicht lesen.
- **Meldung (Telegram):** Bankdaten gehen **nicht** über Telegram. Das Skript schreibt nur eine
  Statuszeile in eine lesbare Datei, ein OpenClaw-Command-Job (kein Modell) schickt sie:
  „Bank: 4 neue Buchungen, Stand 23.11.2026“ / „Bank: Freigabe nötig“ / „Bank: Abruf fehlgeschlagen“.
  Keine Beträge, Namen, Salden, keine Kategorie. Nichts Neues → `NO_REPLY`.
- **TAN-Fälle:** Der Timer löst **nie selbst** eine pushTAN aus (der Inhaber soll keine
  unerwarteten Freigaben bestätigen). Kommt eine `NeedTANResponse`, bricht der Lauf ab und meldet
  „Freigabe nötig“. Der Inhaber startet dann bewusst `fints_fetch.py --freigabe` (per SSH /
  `connect.sh`), bestätigt in der S-pushTAN-App, das Skript fragt alle 5 s nach (max. 5 min),
  speichert den Blob. Erwartung: alle 90–180 Tage einmal.
- **PIN-Sperre vermeiden:** Bei Anmeldefehlern (9xxx, z. B. PIN falsch/gesperrt) sofort stoppen,
  Sperrdatei setzen, **keine** Wiederholung bis zur Hand-Freigabe - drei Fehlversuche sperren
  das Online-Banking.
- **Doku:** `hq/data/finance/docs/AUTOMATION.md` (wie bei den Kassenberichten),
  `docs/finanzen-buchungen.md` Stufe 2 b → „gebaut“, `agent/CLAUDE.md` neuer Abschnitt.

## Risiken / Entscheidungen für den Inhaber

1. ~~2 a oder 2 b?~~ **Entschieden: 2 b per FinTS** (28.11.2026).
2. **Eigener Lese-Zugang:** bei der Sparkasse nach einem zweiten Online-Banking-Zugang nur mit
   Abfrageberechtigung fragen. Falls es keinen gibt: eigener Zugang des Inhabers ok?
3. **Produktregistrierung** auf den Namen der Bäckerei beantragen (Formular, Unterschrift) -
   **nächster Schritt, liegt auf dem kritischen Pfad** (10-15 Werktage). Ohne Nummer kein Test
   gegen die Bank.
4. **Commits direkt auf hq `main`** (wie Kasse, reine Daten) oder Zweig `bank/auto` + PR?
5. **Telegram-Text** wie oben (nur Anzahl + Datum) - oder gar keine Meldung außer bei Fehlern?
6. **Rückfall:** Wenn FinTS bei der Sparkasse hakt (Dialog-Abbrüche sind bei einzelnen Sparkassen
   als Issues bekannt) oder die TAN zu oft kommt → zurück zu 2 a, Code bleibt liegen.

## Abnahme

- Überlappungstest: Für ≥ 30 Tage, die auch in einer CSV stehen, ergeben FinTS und CSV dieselben
  gebuchten IDs; der Import meldet 0 neue Duplikate, `finance-summary.json` bleibt gleich.
- Vorgemerkte Buchung aus FinTS verschwindet, sobald ein späterer Lauf sie gebucht liefert.
- `--dry-run` auf dem Pi läuft ohne Commit, Baum bleibt sauber.
- Zwei Tage Echtbetrieb: Telegram zeigt nur „N neue Buchungen, Stand …“; neue Buchungen stehen in
  `/admin/finance/buchungen`.
- TAN-Fall einmal durchgespielt (`--freigabe` mit S-pushTAN); falsche PIN führt zu genau einem
  Fehlversuch und Sperrdatei.
- `grep` findet kein `sepa_transfer`/`simple_sepa_transfer`/`sepa_debit` im Code; im öffentlichen
  Repo stehen keine Bank-Eckdaten.
