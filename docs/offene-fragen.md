# Offene Fragen an den Inhaber

Stand 23.11.2026. Eine Liste für alle Entscheidungen, die die Umsetzung braucht. Wo schon gebaut
wird, steht die **gewählte Vorgabe** dabei - die gilt, bis du etwas anderes sagst. Antworten
einfach hier eintragen (oder per Nachricht), danach wird die Vorgabe angepasst und die Frage
gestrichen.

**Dieses Repo ist öffentlich.** Hier stehen nur Fragen, keine echten Zahlen, Namen oder Beträge;
die Details dazu liegen in `hq`.

## Sofort: Freigaben

| #   | Was                                                                                                                                                            | Stand                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Deploy auf den Pi** mit TASK-043 (Abgleich in Euro, Datenbank-Migration für zwei neue Spalten an den Vorbestellungen).                                       | Gemergt, aber **nicht deployt**: der Auto-Modus hat den Deploy-Befehl blockiert. Entweder selbst `sudo /opt/bakery/bin/deploy.sh main` auf dem Pi oder dem Assistenten erlauben. Nicht um 14:30 / 17:30. |
| F2  | **Abnahme TASK-043 an einem echten Wochenende:** Abgleich → Umschalter „Euro“, Soll/Ist je Abschnitt plausibel?                                                | nach dem Deploy                                                                                                                                                                                          |
| F3  | **PRs der Codex-Runde prüfen und mergen:** #188 (TASK-047 Warenkorb), #189 (TASK-048 Sprache), #190 (TASK-045 Belege). Je drei Codex-Reviews, Befunde behoben. | #188 und #189 CI grün; #190 CI lief noch                                                                                                                                                                 |
| F4  | **Deploy danach:** #189 und #190 bringen je eine Migration und eine Caddy-Änderung (Mikrofon erlauben; 15 MB nur für den Beleg-Upload).                        | mit F1 zusammen möglich                                                                                                                                                                                  |

## TASK-043 - Abgleich in Euro (gemergt)

1. Zählt eine Vorbestellung „per Überweisung/Rechnung“ schon als „nicht an der Kasse“, auch wenn
   die Zahlung noch offen ist? **Vorgabe: ja**, außer storniert oder nicht abgeholt.
2. Kuchen und Brot rechnen standardmäßig den Folgetag ein (Rest geht am nächsten Tag noch weg),
   höchstens bis zum Überschuss des Folgetags. **Vorgabe: ja, für Kuchen und Brot.** Andere
   Abschnitte?
3. Bei Kassen-Sammeltasten (Gruppenbuchungen ohne Einzelprodukt) gilt „im Zweifel offen“: der
   Betrag erscheint als eigener Posten statt geschätzt verteilt. Passt das?

## TASK-045 - Belege hochladen (PR #190)

Belege per Foto/PDF/XRechnung in der App, Ablage auf der Box mit Prüfsumme, Eingabe von Hand,
Vorschläge Beleg ↔ Bankbuchung (nie automatisch bestätigt), „Ausgaben ohne Beleg“ je Monat.
Texterkennung nur lokal: XRechnung exakt, PDF-Textschicht falls `pdftotext` auf der Box ist, Fotos
von Hand. Gewählte Vorgaben:

1. **Erkennung nur lokal oder mit Cloud-Rückfall (Mistral)?** Vorgabe: nur lokal.
2. **Mac-Worker (Ollama) für Fotos?** Vorgabe: erst ein Test mit echten Belegen, lokal.
3. **Eingangswege** (E-Mail-Postfach, Telegram an Anna, „Teilen“ am Handy)? Vorgabe: nur Foto/Datei
   in der App.
4. **ZUGFeRD** (XML im PDF) auslesen? Vorgabe: Folgeschritt.
5. **Papier nach dem Foto aufheben?** Vorgabe: ja. Ersetzendes Scannen erst mit
   Verfahrensdokumentation und Steuerberater.
6. **Aufbewahrung/GoBD** (8/10 Jahre, DATEV-Export): Vorgabe keine automatische Löschung,
   bestätigte Belege nicht löschbar. Bitte mit dem Steuerberater klären.
7. **Ausgaben, die keinen Beleg brauchen** (z. B. Gebühren, Lohn): Vorgabe leere Liste, pflegbar in
   hq `finance/config/receipt-exclusions.json`. Welche Kategorien?
8. **Skonto:** Vorgabe erfasster Satz + Frist ergibt einen Vorschlag; ohne Satz 2 %/3 % als
   schwächerer Vorschlag.
9. **Backup-Ziel (restic) einrichten:** Ohne Ziel und Restore-Probe keine rein digitale Ablage.
   `pdftotext` (Paket `poppler-utils`) auf dem Pi installieren?
10. **Zeitraum für den Abgleich:** Vorgabe 3 Tage vor Rechnungsdatum bis Fälligkeit + 14 Tage
    (ohne Fälligkeit + 45).
11. **Abnahme nach dem Merge:** echter Monat Belege, Handytest (iPhone/Android), Restore-Probe.

## TASK-047 - Warenkorb mit WhatsApp-Vorbestellung (PR #188)

Warenkorb auf der Website, Abholtag/-zeit, fertige WhatsApp-Nachricht mit Bestellnummer (am
Desktop als QR-Code), Korb bleibt 7 Tage auf dem Gerät. Stufe 2 (Nachricht in die Verwaltung
einfügen) ist nicht gebaut.

1. **Vorlauf / Bestellschluss:** Vorgabe 60 Min. am selben Tag, Torten 2 Tage, Kuchen 1 Tag, kein
   Bestellschluss für den Folgetag.
2. **Sortiment:** Vorgabe alle verfügbaren Produkte. Handelsware/Getränke ausschließen?
3. **Abholort:** Vorgabe nur der Laden. Auch die Sammelstelle?
4. **Summe:** Vorgabe „ca.“-Summe, bei fehlendem Preis „Summe offen“.
5. **Höchstmenge:** Vorgabe 20 Stück je Artikel, darüber „bitte anrufen“.
6. **Welches Handy empfängt, wer bestätigt wann?** Vorgabe: die Mobilnummer aus dem Impressum,
   kein fester Bestätigungszeitpunkt.
7. **Andere Nummer?** Über die Repo-Variable `NEXT_PUBLIC_WHATSAPP_NUMBER` (leer = Impressum).
8. **Betriebsferien aus `hq/config/kalender.yaml` auf der öffentlichen Seite:** Vorgabe aus. Nach
   Freigabe gingen nur Datum und „geschlossen“/„Sonderzeiten“ in den öffentlichen Build.
9. **Aufbewahrung auf dem Gerät:** Vorgabe 7 Tage ab letzter Änderung; Name bis „Angaben
   vergessen“.
10. **Praxistest:** nach dem Merge eine Testbestellung mit drei Artikeln - lässt sich die Nachricht
    im Laden ohne Rückfrage erfassen?

## TASK-048 - Sprechen statt Tippen (PR #189)

Gebaut als MVP für den Rest am Abend, **ausgeschaltet**: ohne `VOICE_ENABLED=1` und Schlüssel kein
Mikrofon-Knopf, kein Aufruf eines bezahlten Dienstes. Gewählte Vorgaben:

1. **STT-Anbieter:** Mistral (EU), OpenAI als Alternative; Modell per `VOICE_STT_MODEL`
   umstellbar. Der Vergleich in Phase 0 wählt das Pilotmodell.
2. **Claude:** Haiku 5.5 nur für freie Sätze, die der eigene Parser nicht löst; eigener
   API-Schlüssel mit Ausgabelimit in der Console. Ohne Schlüssel läuft nur der Parser. Wer legt
   die Schlüssel an?
3. **Budget:** 10 € im Monat, 10 Aufnahmen/Minute und 150/Tag je Person. Harte Grenze ist das
   Limit in der Anbieter-Console.
4. **Aliase** („Brezel“, „Weck“, Mundart): optionale Datei `hq/config/sprache.yaml` (Produkt-id →
   Liste). Wer pflegt sie (Anna?)
5. **Transkripte und Audio:** werden nicht gespeichert.
6. **„Dazu“-Sätze** („noch zwei Weck dazu“): nur absolute Zahlen, sonst „unsicher“.
7. **Geräte und Team:** jedes Gerät mit Rolle Verkauf/Inhaber über HTTPS, freiwillig; das Team
   wird vorher schriftlich informiert (Art. 13 DSGVO). Wer informiert, und wann?
8. **Warnung bei 80 % Budget:** Vorgabe Log + Anzeige. Zusätzlich Telegram?
9. **Phase 2** (Kundendaten im Prompt): eigene Freigabe nach dem Pilot.
10. **Vor dem Pilot:** HTTPS im LAN (DNS-01-Zertifikat, Q2) - ohne HTTPS gibt der Browser das
    Mikrofon nicht frei; Auftragsverarbeitungsverträge in hq ablegen; Testaufnahmen und Messung am
    Laden-Tablet. Die Caddy-Änderung (Mikrofon erlauben) wirkt erst nach dem Deploy.

## TASK-044 - Bankumsätze per FinTS (nicht begonnen)

Bewusst **nicht** an Codex gegeben: der Code liegt in `hq` neben echten Bankdaten, und vor allem
anderen steht Frage 1. Empfehlung: **erst Stufe 2a** (Kontoauszug-CSV in der App hochladen,
`docs/finanzen-buchungen.md`), FinTS nur, wenn das Herunterladen wirklich stört.

1. **2a oder 2b?** Automatik heißt: Online-Banking-PIN liegt auf einem Gerät im Laden (ohne TAN
   kein Geld bewegen, aber alle Umsätze lesbar). Nur mit ausdrücklichem Ja.
2. Eigener Lese-Zugang bei der Sparkasse möglich? Sonst: eigener Zugang des Inhabers ok?
3. Produktregistrierung (FinTS) auf den Namen der Bäckerei beantragen?
4. Commits direkt auf hq `main` (wie die Kasse) oder Zweig + PR?
5. Telegram: nur „N neue Buchungen, Stand …“ oder nur bei Fehlern?
6. Rückfall auf 2a, wenn FinTS bei der Sparkasse hakt - ok?

## TASK-046 - Agentische Bäckerei-Beratung (nicht begonnen)

Wartet auf diese Entscheidungen (Vorstudie: `hq/projects/PROJ-002-bakery-2026/specs/kennzahlen-vorstudie.md`).
Vor dem Agenten kommt Phase 0: die Daten (Rezeptkosten, Einkaufspreise, weniger Sammeltasten).

1. Eigener Agent `berater` oder zusätzliche Skills für Anna?
2. Termin und Kanal: Montagabend per Telegram? Zusätzlich Markdown in `hq`?
3. Ablage: `hq/data/analysis/` mit Direkt-Commit oder jeder Bericht als PR?
4. Welche Daten darf die Beratung sehen: Finanzen? Dienstplan/Lohn nur aggregiert? App-Daten
   (Rest, Abgleich, CAP) per Export nach `hq`?
5. Monatsbudget für Modellkosten.
6. Wetterdaten (Bright Sky/DWD) ja/nein.
7. Branchen-Benchmarks beschaffen (DSGV-Branchenreport, Betriebsvergleich der Innung)?
8. Schwerpunkt der ersten drei Monate (Vorschlag: Rest/Überproduktion + CAP).
9. Werkzeug-Code im öffentlichen `website` (nur synthetische Tests) oder im privaten `hq`?

## Bankbuchungen in der App (`docs/finanzen-buchungen.md`)

1. Stufe 1: Reicht „Regel je Gegenseite + Ausnahme je Buchung“? Soll eine hq-Action automatisch
   neu rechnen?
2. Stufe 2: CSV hochladen (a) oder automatisch abholen (b)? (= TASK-044 Frage 1)
3. Stufe 3a: Wie oft wird per Überweisung bezahlt - lohnt die Liste „Offene Posten“ jetzt?
4. Gibt es außer dem Inhaber jemanden, der Buchungen sehen soll (Steuerberater, Büro)?
5. **Kategorien für fünf Lieferantenzahlungen**, die keine Regel trifft (Namen in hq, Kontoauszug
   bis 20.11.). Kategorie nennen → Regel wird eingetragen.

## Kasse und Daten (aus der Kassenanalyse)

1. **Was wird an der Kasse für halbe Kranzkuchen bzw. Kuchenstücke gebucht?** Davon hängt das
   Kuchen-Soll im Abgleich ab.
2. **Stornos:** kurz den Grund notieren (Liste/Kasse)? Überweisungs-Bestellungen gar nicht erst in
   die Kasse tippen?
3. **Fehler im Kassen-Konverter (hq):** 7 % und 0 % Umsatzsteuer landen beide als „0 %“. Soll das
   behoben und die bisherigen Tage neu umgerechnet werden (eigener hq-PR)? **Vorgabe: ja**, sobald
   du zustimmst.
4. **Sammeltasten** („Brötchen, sonstige“ usw.) machen einen wachsenden Teil des Umsatzes aus und
   verhindern eine Auswertung je Produkt. Können an der Kasse mehr Einzeltasten genutzt werden?
5. **Rezepte und Einkaufspreise:** Für Deckungsbeiträge je Produkt braucht es bestätigte Rezepte
   und echte Einkaufspreise. Wer kann die liefern (Bäcker-Prüfbogen, BÄKO-Rechnungen)?
