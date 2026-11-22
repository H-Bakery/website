---
id: TASK-045
title: Belege hochladen - Eingangsrechnungen per Foto/PDF, Texterkennung und Abgleich mit der Bank
slug: belege-hochladen-ocr-abgleich
status: todo
priority: 3
owner: ''
projects: []
customers: []
tags:
  - belege
  - finanzen
  - buchungen
  - ocr
  - management
  - api
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-22
---

# Belege hochladen - Eingangsrechnungen per Foto/PDF, Texterkennung und Abgleich mit der Bank

## Kontext

Lieferantenrechnungen und Kassenbelege liegen heute nur auf Papier oder im E-Mail-Postfach; in der
App gibt es sie nicht ([`docs/finanzen-buchungen.md`](../../../docs/finanzen-buchungen.md),
Tabelle „Ausgangslage“). Die Bankbuchungen sind seit Stufe 0 sichtbar
([`docs/domains/finanzen.md`](../../../docs/domains/finanzen.md), Abschnitt Buchungen; Core
`apps/bakery-api/src/services/finance-transactions.core.js`). Diese Aufgabe ist **Stufe 3b** des
Plans plus der **automatische Abgleichsvorschlag** aus 3a (Tabelle `transaction_links`). Optional:
TASK-044 (Bankumsätze täglich per FinTS) - ohne sie geht alles, nur kommen Abbuchungen erst mit
der nächsten CSV und der Vorschlag entsprechend später. Muster für Rechte, Dateien mit SHA-256,
Audit und Unveränderlichkeit: [`docs/domains/rechnungen.md`](../../../docs/domains/rechnungen.md).
Alle Beispiele hier sind erfunden.

## Ziel

1. Der Inhaber fotografiert am Handy einen Beleg (oder wählt ein PDF/eine XRechnung) - in unter
   einer Minute ist er abgelegt, die Felder sind vorgeschlagen, eine passende Abbuchung ebenso.
2. Er prüft und bestätigt mit wenigen Tipps. **Die Maschine schlägt vor, der Mensch bestätigt -
   immer.** Nichts wird still verknüpft oder gebucht.
3. Je Monat zwei Listen: **„Ausgaben ohne Beleg“** und **„Belege ohne Buchung“** - genau das, was
   der Steuerberater am Jahresende fragt.

Beispiel: Beleg „Beispiel-Mühle GmbH, Rechnung BM-2026-0815, 12.11.2026, 123,45 € brutto (7 %)“ ↔
Lastschrift vom 20.11.2026 „BEISPIEL-MUEHLE GMBH … BM-2026-0815“, −123,45 €.

## Recherche-Ergebnis

**E-Rechnung zuerst.** Seit 1.1.2025 muss jedes inländische Unternehmen E-Rechnungen (XRechnung,
ZUGFeRD ab 2.0.1) empfangen können; ausstellen müssen Lieferanten mit > 800.000 € Vorjahresumsatz
ab 1.1.2027, alle ab 1.1.2028 (bis dahin dürfen sie Papier/PDF schicken) [Q1][Q2]. Ein
wachsender Teil der Lieferantenrechnungen kommt also mit **strukturierter XML** - die wird
gelesen, nicht erkannt: exakt, ohne Rechenzeit. Nach der GoBD-Änderung vom 14.07.2025 genügt es,
den **XML-Teil unverändert** aufzubewahren; der PDF-Teil nur, wenn er steuerlich relevante
Zusatzinfos trägt [Q3].

**Texterkennung (OCR) und Feldextraktion** - für Fotos und Scans ohne Textschicht:

| Werkzeug                                 | Lizenz                                  | Pi 5 (4 GB, geteilt)         | Mac (Apple Silicon) | Qualität: CER gescannte Bons [Q6]       | Felder direkt?      | Quelle    |
| ---------------------------------------- | --------------------------------------- | ---------------------------- | ------------------- | --------------------------------------- | ------------------- | --------- |
| XML lesen (ZUGFeRD/XRechnung)            | z. B. `e-rechnung-parser` MIT (prüfen)  | trivial                      | –                   | exakt                                   | ja                  | [Q1][Q11] |
| Textschicht (`pdftotext`, poppler)       | GPL (externes Programm)                 | trivial, ms                  | –                   | exakt (Text)                            | nein, Regeln        | –         |
| Tesseract 5 + `deu`                      | Apache 2.0                              | ja, CPU (im Spike messen)    | ja                  | 0,335 (schlechteste)                    | nein                | [Q6]      |
| PaddleOCR PP-OCRv5 Latin (inkl. Dt.)     | Apache 2.0                              | wahrscheinlich, ONNX ~7,5 MB | ja                  | 0,204                                   | nein                | [Q7][Q6]  |
| docTR                                    | Apache 2.0                              | ungemessen                   | ja                  | 0,197                                   | nein                | [Q6]      |
| Surya 2 / Marker                         | Code Apache, Gewichte mit Umsatzgrenze  | nein (langsam)               | ja                  | 0,191                                   | nein                | [Q8][Q6]  |
| Granite-Docling 258M (statt SmolDocling) | Apache 2.0                              | möglich (sehr klein)         | ja                  | – (Layout → Markdown)                   | nein                | [Q9]      |
| olmOCR 2 7B (auf Qwen2.5-VL)             | Apache 2.0, gedacht für Forschung/Lehre | nein                         | nur mit viel RAM    | – (Text → Markdown)                     | nein                | [Q10]     |
| Qwen3-VL 2B/4B/8B Instruct (Ollama)      | Apache 2.0                              | 2B (~1,9 GB) - zu knapp      | 4B (~3,3 GB Q4), 8B | – (lt. Hersteller robust bei Unschärfe) | **ja, JSON**        | [Q12]     |
| **Mistral OCR 4.1** (Cloud)              | API, AV-Vertrag                         | –                            | –                   | – (Konfidenz je Block)                  | **ja, Annotation**  | [Q4][Q5]  |
| Azure Document Intelligence Invoice      | API, EU-Regionen                        | –                            | –                   | –                                       | ja, Rechnungsmodell | [Q13]     |

Deutsche Handyfotos hat keine gefundene Quelle getestet; „–“ heißt: keine vergleichbare Zahl.

Kernaussagen:

- **Die Extraktion entscheidet, nicht die reine OCR.** Im einzigen gefundenen Vergleich (engl.
  Bons, Anbieterseite) lagen sechs von acht Engines nach LLM-Nachbearbeitung bei ähnlicher
  Feld-Trefferquote (F1 0,57-0,62), reine Regex-Extraktion weit darunter (docTR 0,08) [Q6] →
  **eigener Spike nötig**.
- **Auf dem Pi kein Bildmodell im Regelbetrieb:** 4 GB teilen sich zwei Agenten, API und Next.js;
  schon Qwen3-VL-2B braucht ~2 GB plus Bild-Kontext. Pi-tauglich sind XML, Textschicht und
  allenfalls Tesseract/PaddleOCR-ONNX.
- **Mistral OCR 4.1** (`mistral-ocr-latest`, GA seit 16.07.2026; OCR 4.0 ist seit 30.09.2026
  abgeschaltet): 4 $ je 1000 Seiten, mit strukturierter Annotation (JSON-Schema) 5 $; liefert
  Bounding-Boxes und Konfidenz je Block [Q4]. Bei angenommen 100 Seiten im Monat < 1 $ - **Kosten
  sind kein Argument, Datenschutz ist eins:** Standard ist der globale Endpunkt; der EU-Endpunkt
  `api.eu.mistral.ai` kostet 1,1×, ob OCR dort läuft, ist nicht dokumentiert, Files-API und Batch
  gibt es regional nicht [Q5]; Zero-Data-Retention nur auf Antrag; der AV-Vertrag erlaubt
  Verarbeitung bei Google Cloud auch in den USA [Q14].

Quellen (abgerufen 22.11.2026): [Q1](https://www.ihk.de/dresden/hauptnavigation/recht-steuern/umsatzsteuer-national/e-rechnungspflicht-ab-2025-6232764) IHK Dresden, E-Rechnungspflicht · [Q2](https://www.ihk-muenchen.de/e-rechnung/) IHK München · [Q3](https://www.ey.com/de_de/technical/steuernachrichten/konkretisierung-der-gobd-mit-blick-auf-e-rechnungen) EY, GoBD/E-Rechnung ·
[Q4](https://docs.mistral.ai/models/ocr-4-1.md) Mistral OCR 4.1, [Preise](https://docs.mistral.ai/inference/pricing) · [Q5](https://docs.mistral.ai/inference/regional-inference) Mistral Regional inference · [Q6](https://imagetotable.ai/references/traditional-ocr-vs-document-parsing-vlm) OCR vs. VLM auf Kassenbons (Anbieterseite) ·
[Q7](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html) PP-OCRv5, [ONNX](https://huggingface.co/monkt/paddleocr-onnx) · [Q8](https://huggingface.co/datalab-to/surya-ocr-2) Surya 2 · [Q9](https://ibm.com/new/announcements/granite-docling-end-to-end-document-conversion) Granite-Docling · [Q10](https://huggingface.co/allenai/olmOCR-2-7B-1025/blob/main/README.md) olmOCR 2 ·
[Q11](https://www.pkgstats.com/pkg:e-rechnung-parser) e-rechnung-parser · [Q12](https://ollama.com/library/qwen3-vl:2b) Qwen3-VL, [GGUF](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF) · [Q13](https://azure.microsoft.com/pricing/details/ai-document-intelligence/) Azure Document Intelligence ·
[Q14](https://opentermsarchive.org/en/memos/mistral-operates-usa-no-notification/) Open Terms Archive, Mistral-AV-Vertrag · [Q15](https://www.gesetze-im-internet.de/ustg_1980/__14b.html) § 14b UStG · [Q16](https://www.ihk.de/karlsruhe/fachthemen/steuerrecht/aktuelles/neuer-inhalt4-buerokratieentlastungsgesetz-6347138) IHK Karlsruhe, BEG IV

**Empfehlung (Kaskade, billigste sichere Stufe zuerst):**

1. **XML** (XRechnung pur oder in ZUGFeRD-PDF eingebettet) → exakt, auf dem Pi.
2. **PDF mit Textschicht** → `pdftotext` + Regeln + Lieferanten-Gedächtnis, auf dem Pi.
3. **Foto/Scan** → Auftrag in eine Warteschlange; ein **lokaler Worker auf dem Mac** (Ollama,
   Qwen3-VL 4B oder 8B, Apache 2.0) holt ihn ab, sobald der Mac läuft.
4. **Optional Mistral OCR 4.1** mit Annotation - nur nach Opt-in des Inhabers (je Beleg-Knopf
   „Mit Mistral erkennen“ oder als Einstellung), wenn der Mac nicht da ist oder lokal unsicher ist.
5. Jede Stufe liefert dieselbe Form; dieselben Plausibilitätsprüfungen setzen die Konfidenz;
   **„Bitte prüfen“ und Bestätigen durch den Inhaber immer**, auch bei XML.

Vor dem Bau ein **Spike (1-2 Tage):** 20-30 echte Belege des Inhabers, **nur lokal** (nie im
Repo), gegen Tesseract, PaddleOCR-ONNX, Qwen3-VL 4B/8B und Mistral OCR 4.1; Trefferquote je Feld
(Lieferant, Nr., Datum, Brutto, USt je Satz, IBAN), Zeit, RAM. Ergebnis nur zusammengefasst in hq.

## Umsetzung (Vorschlag)

**Datenmodell** (Datenbank der App, Geld in ganzen Cent wie bei Rechnungen):

- `receipts`: `status` (`neu` → `erkannt` → `geprueft`; `verworfen` nur vor Bestätigung), `kind`
  (`eingangsrechnung|kassenbeleg|gutschrift`), Lieferant (`supplier_id`, Name, USt-IdNr., IBAN voll
  nur serverseitig), `invoice_number`, `invoice_date`, `due_date`, `gross_cents`, `payment`
  (`ueberweisung|lastschrift|bar|karte|offen`), Skonto (Satz, Frist), `extracted_by`
  (`xml|textlayer|tesseract|vlm_local|mistral|manuell`), `confidence`, `field_flags` (Feld →
  Grund für „bitte prüfen“), `confirmed_by/at`, `created_by/at`.
- `receipt_vat_lines` (`rate`, `net_cents`, `vat_cents`): mehrere Sätze je Beleg (7 % Mehl, 19 %
  Reinigungsmittel). `receipt_files` (`role` `original|xml|vorschau`, `mime`, `sha256`, `path`,
  `page`): mehrere Fotos = ein Beleg mit Seiten, Original nie überschrieben.
- `receipt_extractions`: jeder Erkennungslauf (Engine, Version, Rohergebnis, Dauer) - was die
  Maschine vorschlug und was der Inhaber änderte. `ocr_jobs` (`wartet|laeuft|fertig|fehler`,
  `attempts`, `locked_until`).
- `suppliers`: Name, Aliasse (Bank-Schreibweise), IBAN, USt-IdNr., übliche Steuersätze - nur aus
  bestätigten Belegen gelernt.
- `transaction_links` wie im Plan: `transaction_id`, `kind` (`invoice|receipt`), `target_id`,
  `amount_cents`, `matched_by` (`auto|manual`), `score`, `status`
  (`vorgeschlagen|bestaetigt|abgelehnt`), `confirmed_by`, `confirmed_at` **plus Schnappschuss**
  (`booking_date`, `amount`, `counterparty_key`) - damit eine neue Buchungs-ID (vorgemerkt →
  gebucht) wiedergefunden und als „bitte prüfen“ markiert wird, nie still umgehängt.

**Rechnen genau einmal**, dependency-frei: `receipt-extract.core.js` (Text → Felder: IBAN mit
Prüfziffer mod 97, USt-IdNr., deutsche Datums- und Betragsformate, Schlüsselwörter,
Plausibilität Netto + USt = Brutto je Satz ± 1 Cent, Datum nicht in der Zukunft, Konfidenz) und
`receipt-matching.core.js` (Abgleich, s. u.); `counterpartyKey()` aus
`finance-transactions.core.js` wiederverwenden. XML-Parsen und PDF-Auspacken in einem Service
(braucht eine Bibliothek), das Abbilden auf Felder im Core.

**API** (`/api/receipts`, nur `inhaber` + `requirePersonalSession`, `no-store`, Fehler mit
`message` + `error`):

- `POST /api/receipts` (multipart, 1-10 Dateien, je ≤ 15 MB; Typ an den Magic Bytes prüfen: JPEG,
  PNG, HEIC, PDF, XML) → 201 sofort, Erkennung läuft danach. Gleiche SHA-256 → 409 mit Verweis
  auf den vorhandenen Beleg; gleicher Lieferant + Rechnungsnummer → Warnung „schon erfasst?“.
- `GET /api/receipts?monat=&status=`, `GET /:id`, `GET /:id/files/:fileId`, `PATCH /:id` (nach
  Bestätigung nur mit Audit alt → neu), `POST /:id/confirm`, `POST /:id/extract` (`mistral` nur
  bei Opt-in); `GET /api/receipts/matches?monat=`, `POST /api/transaction-links`, `…/:id/reject`;
  `GET /api/finance/transactions/without-receipt?monat=`.
- Worker: `POST /api/ocr-jobs/claim` und `/:id/result` mit eigenem Dienst-Token (nur Warteschlange,
  nur die Datei des Auftrags). Multipart braucht eine neue Abhängigkeit (z. B. `busboy`) - im PR
  begründen. Doku `docs/api/receipts.md`.

**UI am Handy** (`/admin/finance/belege`, Layout-Kit `PageLayout`/`ResponsiveList`/`PageStates`,
Eintrag in `ROLE_ACCESS`):

- Hauptknopf **„Beleg fotografieren“** (`<input type="file" accept="image/*" capture="environment">`)
  und „Datei wählen“ (PDF/XML aus Mail-App oder Dateien); „Seite hinzufügen“, Vorschau. An jeder
  Buchung (`/admin/finance/buchungen/[id]`) „Beleg hinzufügen“ mit vorgeschlagener Verknüpfung.
- Nach dem Hochladen sofort „Gespeichert - wird erkannt“; niemand wartet auf die Erkennung.
- **Prüfen-Ansicht:** Bild oben (zoombar), Felder darunter, unsichere mit Symbol + „bitte prüfen“
  (Farbe nie allein); Karte „Passt zu: Lastschrift 20.11., Beispiel-Mühle GmbH, −123,45 €“ mit
  „Ja, verknüpfen“ · „Andere Buchung“ · „Noch nicht bezahlt“ · „Bar bezahlt“; dann „Bestätigen“.
- Reiter „Zu prüfen“, „Ohne Buchung“, „Ausgaben ohne Beleg“ (je Monat). Später optional
  PWA-Share-Target („Teilen → Bäckerei“ aus der Mail-App; nur Android).

**OCR-Pipeline:** (1) Hochladen: Magic Bytes, SHA-256, Original nach
`/var/lib/bakery/belege/JJJJ/MM/<sha256>.<ext>` (`0440`), DB-Zeile, Audit. (2) XML eingebettet
(`factur-x.xml`, `zugferd-invoice.xml`, `xrechnung.xml`) oder pur → lesen, das Zahlenwerk der XML
gilt. (3) Sonst Textschicht → `pdftotext -layout` → Core-Regeln. (4) Sonst Auftrag in `ocr_jobs`;
das Modell bekommt eine Arbeitskopie (EXIF-Drehung, lange Kante ~2000 px) und ein festes
JSON-Schema, das Ergebnis durchläuft **dieselben** Core-Prüfungen. (5) Lieferanten-Gedächtnis:
bekannte IBAN/USt-IdNr. → Lieferant und übliche Steuersätze.

**Abgleich-Regeln** (`receipt-matching.core.js`, nur Abbuchungen, Punkte statt Ja/Nein):

- **Betrag:** Abbuchung = −Brutto genau → stark; = Brutto − Skonto (Satz vom Beleg, sonst 2-3 %)
  innerhalb der Skontofrist → mittel; Gutschrift = Eingang.
- **Datum:** Buchungsdatum zwischen Rechnungsdatum − 3 Tage und Fälligkeit + 14 Tage (ohne
  Fälligkeit: Rechnungsdatum + 45 Tage) - Grenzen im Kopf der Datei, im Review bestätigen.
- **Gegenseite:** volle IBAN gleich (nur serverseitig) → stark; sonst `counterpartyKey` oder Alias.
  **Rechnungsnummer im Verwendungszweck** (normalisiert wie `numberKey()`) → stark.
- **Sammellastschrift:** eine Abbuchung = Summe von 2-6 offenen Belegen **desselben** Lieferanten
  im Datumsfenster → Vorschlag mit allen Teilen; mehrere Zeilen in `transaction_links`.
- **Teilzahlung:** mehrere Abbuchungen zu einem Beleg. Zwei Kandidaten mit ähnlicher Punktzahl →
  beide zeigen, keinen vorauswählen; vorgemerkte Buchungen mit Hinweis. **Nie automatisch bestätigen.**
- „Ausgaben ohne Beleg“ ohne Kategorien, die keinen Lieferantenbeleg brauchen (Liste in hq-Config).

**Tests** nur synthetisch: CII-/UBL-XML von „Beispiel-Mühle GmbH“ (gern aus `invoice.core.js`),
Textschicht-PDF per pdfkit, Foto eines ausgedruckten Beispielbelegs, alle Abgleichsfälle oben.

## Datenschutz/Aufbewahrung

- Nur Inhaber mit Passwort-Sitzung, nie an der PIN-Station; Dateien mit `no-store`; volle IBAN
  nie im Browser. Belege nicht über Telegram, solange der Inhaber das nicht ausdrücklich will.
- **Unveränderbar:** Original-Datei + SHA-256 in der DB, nie überschrieben, nach Bestätigung nicht
  löschbar; Korrekturen der Felder mit Audit (alt → neu, wer, wann). Monatlicher Lauf prüft alle
  Dateien gegen ihren Hash. Bei E-Rechnungen ist die **XML das Original** und bleibt unverändert [Q3].
- **Backup ist Voraussetzung:** `deploy/scripts/backup.sh` sichert heute nur die DB-Kopie -
  `/var/lib/bakery/belege` muss mit ins restic-Backup, und das Off-site-Ziel ist auf der Box noch
  nicht eingerichtet. Ohne laufendes, einmal zurückgespieltes Backup **keine** rein digitale Ablage.
- **Fristen:** seit 1.1.2025 **8 Jahre** für Buchungsbelege (§ 147 Abs. 3 AO, BEG IV) und
  Rechnungen (§ 14b UStG), ab Ende des Kalenderjahres [Q15][Q16]; Bücher, Jahresabschlüsse und
  einzelne USt-Aufzeichnungen weiter 10 Jahre. Kein automatisches Löschen in dieser Aufgabe.
- **Papier nach dem Foto vernichten** wäre „ersetzendes Scannen“ und braucht eine
  Verfahrensdokumentation - bis dahin Papier weiter abheften. **Mit Steuerberater klären**, ebenso
  Fristen im Einzelfall, ob er DATEV Unternehmen online nutzt (dann Belege eher dorthin) und welches
  Exportformat er will (Stufe 4).
- **Cloud nur nach Opt-in:** Bild inline an Mistral (keine Files-API), AV-Vertrag prüfen, ZDR
  beantragen, im Beleg vermerkt (`extracted_by: mistral`). B2B-Belege, aber mit Name des Inhabers.

## Entscheidungen für den Inhaber

1. **Erkennung:** nur lokal (Fotos warten, bis der Mac mit Ollama, ~3-6 GB Modell, läuft) oder
   Mistral als Rückfall erlaubt - je Beleg per Knopf oder generell?
2. **Eingangswege:** nur Handy-Foto/Datei in der App, oder auch ein eigenes Postfach für
   E-Rechnungen (Abruf per IMAP) bzw. Fotos an Anna?
3. **Papier** nach dem Foto aufheben (Vorschlag: ja, bis der Steuerberater es anders sagt)?
4. Welche **Kategorien brauchen keinen Beleg** (z. B. Löhne, Steuern, Privatentnahme)?
5. Wird **Skonto** gezogen, und bei welchen Lieferanten?
6. **Backup-Ziel** (restic) festlegen - Voraussetzung für den Start.

## Abnahme

- Spike-Ergebnis liegt vor (Trefferquote je Feld und Engine, nur zusammengefasst in hq); die
  Engine-Wahl ist im PR begründet. Pi-Speicher unter Last gemessen, kein Bildmodell auf dem Pi.
- Synthetische XRechnung (UBL), ZUGFeRD-PDF und Textschicht-PDF werden ohne OCR vollständig und
  richtig erkannt; ein synthetisches Foto liefert Felder mit „bitte prüfen“, wo unsicher.
- Am Handy (iPhone Safari, Android Chrome): fotografieren → gespeichert in < 10 s; Prüfen und
  Bestätigen ohne Zoomen bedienbar.
- Abgleich: alle Fälle oben wie beschrieben; nichts wird ohne Tipp des Inhabers verknüpft.
- Originale unverändert (Hash-Prüfung grün), bestätigte Belege nicht löschbar, Änderungen im
  Audit-Log; Belegordner im Backup, ein Restore geprobt.
- Der Inhaber prüft einen echten Monat (lokal, nicht im Repo): „Ausgaben ohne Beleg“ ist plausibel.
- Doku: `docs/domains/finanzen.md` (Abschnitt Belege), `docs/api/receipts.md`,
  `docs/finanzen-buchungen.md` (Stufe 3b aktualisiert).
