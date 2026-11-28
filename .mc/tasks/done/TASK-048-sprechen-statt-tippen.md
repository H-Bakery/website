---
id: TASK-048
title: Sprechen statt Tippen - Spracheingabe in der Verwaltung (zuerst Rest am Abend)
slug: sprechen-statt-tippen
status: done
priority: 3
owner: ''
projects: []
customers: []
tags:
  - sprache
  - ki
  - rest-am-abend
  - management
  - api
  - ux
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-22
---

# Sprechen statt Tippen - Spracheingabe in der Verwaltung (zuerst Rest am Abend)

Idee des Inhabers (22.11.2026), recherchiert am selben Tag. Noch nicht eingeplant.

## Kontext

Die Verwaltung (Next.js-PWA) läuft auf dem Laden-Tablet (PIN-Station), dem Backstube-Tablet und den
Handys des Teams. Mit Mehl oder Handschuhen an den Händen tippt man ungern. Am häufigsten getippt
wird abends bei **Rest am Abend** (`docs/domains/rest-am-abend.md`): eine Zahl je Posten × Sorte ×
Produkt. Im Smoke waren das 28 Posten mit 61 Fingertipps in etwa 1,5 Minuten. Der Wunsch ist ein
Mikrofon-Knopf: Man sagt _„Bauernbrot drei, Weck zwölf, Laugenbrezel keine, Käsekuchen zwei
Stück“_, die App zeigt das Erkannte als Tabelle, und ein Tipp übernimmt es.

**Was schon da ist und genutzt werden muss:**

- **Zählliste:** `GET /api/rest?date=` (`lines[]` aus `countRowsForItem`). Gespeichert wird nur
  über `PUT /api/rest/:date`: mit `expected`, alles oder nichts, 409 `rest_changed`, `audit_log`.
- **Entwurf:** liegt in `src/lib/restApi.ts` (`setDraftEntry`, `rowKey`, `draftConflicts`), je
  Benutzer und Tag im `localStorage`.
- **Rollen:** `REST_COUNT_ROUTE` in `src/lib/roles.ts`. Der Verkauf zählt, die Backstube liest.
- **Namen:** stehen in `hq/products/*.md` (`id`, `name`, **kein Alias-Feld**) und
  `hq/config/backzettel.yaml`. Gesprochene Namen („Brezel“, „Weck“, Mundart) den richtigen Zeilen
  zuzuordnen, ist das Kernproblem.
- **Box:** Raspberry Pi 5 mit 4 GB RAM. Darauf laufen schon API, Next.js, Caddy und zwei
  OpenClaw-Agenten. Konfiguration in `/etc/bakery/bakery.env` (Runbook §3.6).
- **Hürde HTTPS:** Das Mikrofon gibt es nur in einem sicheren Kontext. Bei `http://` ist
  `navigator.mediaDevices` `undefined`
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). Die Box
  läuft bis **Q2** (DNS-01, Runbook §3.7) mit LAN-HTTP, dort geht heute **kein Mikrofon**. Q2 ist
  Voraussetzung.

## Ziel / Nicht-Ziel

**Ziel:**

1. Ein Mikrofon-Knopf auf freigegebenen Bildschirmen. Das Gesprochene wird transkribiert und in
   einen **Vorschlag** übersetzt, den ein Bestätigungsblatt zeigt. Ein Tipp übernimmt ihn **in den
   bestehenden Entwurf**.
2. MVP: Rest am Abend am Laden-Tablet, spürbar schneller als 61 Tipps.
3. Jede Aktion steht auf einer festen Liste je Bildschirm und Rolle. Der Server prüft sie
   deterministisch.

**Nicht-Ziel:**

- **Kein zweiter Schreibweg.** Der Sprach-Endpunkt schreibt keine Fachdaten. Gespeichert wird nur
  über den vorhandenen PUT aus der Speicherleiste.
- Kein automatisches Speichern, kein Dauerzuhören, kein Aktivierungswort, keine Sprachausgabe.
- Kein freier Chat; der gehört zu TASK-046 bzw. Anna.
- Das Modell rechnet nie um (Blech, Liter, Stück). Umgerechnet wird nur in
  `rest-am-abend.core.js`.

## Recherche-Ergebnis (Stand 22.11.2026)

### 1. Sprache → Text (STT), Deutsch

| Weg                                                                                    | Preis                                                                                                                                                                                                | Deutsch / Fachwörter                                                                                                                                                                                                                                                                                                                                                                                | Datenschutz                                                                                                                                                           | Passt?                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web Speech API** (Browser)                                                           | kostenlos                                                                                                                                                                                            | Chrome schickt das Audio an Google. Safari (iOS ab 14.5) nur teilweise, über Apple. Firefox nur hinter einem Schalter. Ob es in einer iOS-Homescreen-PWA läuft, ist ungeklärt ([caniuse](https://caniuse.com/speech-recognition), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API), [WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298)) | kein AVV                                                                                                                                                              | **Nein.** Unzuverlässig je Gerät. On-Device-Modus (`processLocally`, [Chromium](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM)) beobachten                                                                                                                   |
| **OpenAI** `gpt-4o-mini-transcribe` / `gpt-4o-transcribe` / `gpt-transcribe` / Whisper | $0,003 / $0,006 / $0,0045 / $0,006 pro Min. ([Preise](https://developers.openai.com/api/docs/pricing))                                                                                               | gut; `prompt` mit Produktnamen                                                                                                                                                                                                                                                                                                                                                                      | AVV. EU-Residenz nur für berechtigte Projekte, für Transkription unbestätigt ([Guide](https://developers.openai.com/api/docs/guides/data-residency))                  | **Kandidat B**                                                                                                                                                                                                                                                                    |
| **Mistral Voxtral Mini Transcribe V2** (`voxtral-mini-2602`)                           | $0,003 pro Min., Realtime $0,006 ([Ankündigung](https://mistral.ai/news/voxtral-transcribe-2))                                                                                                       | Deutsch ist eine von 13 Sprachen, ca. 4 % WER (FLEURS, Top-10-Mittel). Context biasing mit ≤ 100 Begriffen, für Deutsch „experimentell“                                                                                                                                                                                                                                                             | EU-Anbieter, Endpunkt `api.eu.mistral.ai` ([Doku](https://docs.mistral.ai/studio/regional-inference)), [DPA](https://legal.mistral.ai/terms/data-processing-addendum) | **Kandidat A**                                                                                                                                                                                                                                                                    |
| **Deepgram Nova-3** (deutsches Modell)                                                 | ca. $0,0043–0,0077 pro Min., Keyterms +$0,0013 ([Pricing](https://deepgram.com/pricing), [Deutsch](https://deepgram.com/learn/deepgram-expands-nova-3-with-german-dutch-swedish-and-danish-support)) | gut, Keyterm-Prompting                                                                                                                                                                                                                                                                                                                                                                              | US-Anbieter                                                                                                                                                           | möglich, kein Vorteil gegenüber A/B                                                                                                                                                                                                                                               |
| **whisper.cpp / faster-whisper** auf dem Pi 5                                          | kostenlos                                                                                                                                                                                            | `small` ist auf Deutsch deutlich schwächer als `large-v3-turbo`. Turbo-WER auf deutschen Testsätzen 3,2–8,3 % ([Vergleich](https://huggingface.co/primeline/whisper-large-v3-turbo-german))                                                                                                                                                                                                         | lokal                                                                                                                                                                 | **Jetzt nicht.** Turbo braucht ca. 1,8 GB RAM ([RK3588-Messung](https://turingpi.com/whisper-cpp-piper-tts-arm64-turing-pi-rk3588/)); `small` liegt auf dem Pi 5 laut Berichten unter Echtzeit. Belastbare Pi-5-Zahlen fehlen: mit `whisper-bench` messen. Der Mac ist abends aus |

**Empfehlung: Cloud-STT mit kurzen Clips (≤ 30 s) für das MVP.**

Vorher ein Vergleich A (Voxtral) gegen B (`gpt-4o-mini-transcribe` und `gpt-4o-transcribe`) mit
40–60 echten Aufnahmen: abends im Laden, mit Lärm und Mundart (Aufnahmen lokal bzw. in hq, nie
hier). Gemessen werden Trefferquote bei Produktnamen und Zahlen (nicht nur WER) und Latenz; bei
Gleichstand gewinnt A (EU, AVV, Preis). Der Anbieter sitzt hinter einem Adapter
(`VOICE_STT_PROVIDER`), damit lokales STT auf einer stärkeren Box später nur eine Einstellung ist.

**Claude kann kein Audio.** Die Messages API nimmt Text, Bilder und PDFs. Die
OpenAI-Kompatibilitätsschicht lehnt `input_audio` ab
([Doku](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)), und das
Anthropic-Cookbook nimmt für STT einen Fremdanbieter
([Beispiel](https://platform.claude.com/cookbook/third-party-elevenlabs-low-latency-stt-claude-tts)).
Die Claude-Guthaben decken also nur das **Verstehen**.

### 2. Verstehen (LLM): Claude Haiku 5.5

- **Modell:** `claude-haiku-5-5`: $0,10 / $0,50 pro Mio. Token, Cache-Lesen $0,01,
  Cache-Schreiben $0,125 ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)).
  `output_config.effort: "low"` und `thinking: {type: "disabled"}` (bei Haiku 5.5 bis `high`
  erlaubt); adaptives Denken erst, wenn eine Messung es verlangt. Sonnet 5.5 (etwa 20× teurer) ist
  Plan B, falls Haiku die Testsätze nicht schafft.
- **Anfrage:** zuerst ein _stabiles Präfix_ mit `cache_control` (Systemanweisung, Werkzeuge des
  Bildschirms, kompakte Zählliste des Tages: `key`, Name, Posten, Sorte, Einheit, Aliase),
  **danach** das Transkript. Das Präfix hat etwa 2.000–3.000 Token (Cache-Minimum bei Haiku 5.5:
  512); der Cache spart hier vor allem Latenz.
- **Ausgabe:** ein Werkzeug je erlaubter Aktion mit `strict: true`. `key` ist ein **Enum** der
  Zeilen des Tages, `menge` ≥ 0 oder `null`, dazu je Zeile `unsicher` und eine Liste
  `nicht_zugeordnet` (gehörte Bruchstücke). Kein Werkzeugaufruf oder `stop_reason: "refusal"`
  (bei Haiku 5.5 ohne Fallback) heißt „Nicht verstanden – bitte nochmal oder tippen“.
- **Danach prüft der Server deterministisch:**

  - Ist der `key` bekannt, und ist der Tag `editable`?
  - Passt die Menge zur Einheit (ganze Stück, 0,5er-Schritte bei L/kg, 0…10000 wie im PUT)?
  - Gibt es Doppelte? Darf die Rolle das?

  Was durchfällt, wird als „bitte prüfen“ markiert, nie still verworfen.

- **Kosten (Schätzung):** pro Befehl ca. 2.500 Token gecacht + 200 neu + 300–800 Ausgabe, also
  **$0,0003–0,0006**. Bei 30 Befehlen am Tag (ca. 900 im Monat) **unter $1 im Monat**. STT bei
  Ø 15 s pro Befehl (ca. 225 Minuten): **$0,70–1,40 im Monat**. **Zusammen unter 3 € im Monat**;
  eine Budgetgrenze bleibt trotzdem Pflicht.

### 3. Ohne LLM: eigener Parser, und der hybride Weg

Eine Zählliste klingt sehr regelmäßig: „Name Zahl [Einheit]“. Ein dependency-freier Parser in
`sprache.core.js` deckt das meiste ab:

- **Zahlwörter:** null, kein/keine/nichts, ein/eine, zwei/zwo … zwölf, zwanzig, halb, anderthalb,
  dreiviertel.
- **Einheiten:** Stück, Blech, Liter.
- **Namen:** Normalisierung (Umlaute, Plural, „Laugen-“), Aliasliste, Kölner Phonetik und
  Levenshtein gegen die Zeilen des Tages.

|                                                            | Parser          | LLM                  | **Hybrid (Empfehlung)**         |
| ---------------------------------------------------------- | --------------- | -------------------- | ------------------------------- |
| Kosten / Latenz                                            | 0 / ca. 10 ms   | < 0,1 Cent / ca. 1 s | meist 0                         |
| Freie Sätze („vom Bauernbrot noch drei, Brezeln alle weg“) | schwach         | gut                  | gut                             |
| Vorhersagbar, testbar                                      | voll            | über Testsätze       | Parser voll, LLM über Testsätze |
| Andere Bildschirme (Vorbestellung)                         | viel Handarbeit | gut                  | LLM                             |

**Hybrid:** Zuerst läuft der Parser. Ist **jedes** Bruchstück sicher zugeordnet, wird kein LLM
gefragt. Sonst geht das Transkript zusammen mit den Parser-Treffern an Haiku. Beide Ergebnisse
laufen durch dieselbe Prüfung. Ohne Claude-Guthaben zeigt das Blatt dann eben Lücken.

## Architektur-Vorschlag

```text
Tablet/Handy (HTTPS, nach Q2)                       Bäckerei-Box (Pi 5)
┌──────────────────────────────┐                ┌─────────────────────────────────────────┐
│ MicButton → MediaRecorder    │  POST audio    │ bakery-api  /api/sprache/verstehen      │
│ (webm/opus bzw. mp4/aac,     │ ─────────────► │ 1 Sitzung, Rolle, Bildschirm prüfen     │
│  ≤ 30 s, noiseSuppression)   │ ?screen=rest   │ 2 Rate-Limit + Monatsbudget (SQLite)    │
│                              │ &date=…        │ 3 STT-Adapter ──────► Voxtral (EU)      │
│ Bestätigungsblatt            │                │                  oder ► OpenAI          │
│ (je Zeile änderbar)          │ ◄───────────── │ 4 Kandidaten = Zählzeilen des Tages     │
│      │ „Übernehmen“          │ { transcript,  │   (rest-am-abend.core.js) + Aliase      │
│      ▼                       │   proposal[],  │ 5 sprache.core.js: Parser               │
│ setDraftEntry() → Entwurf    │   unmatched[], │   └ unsicher? ► Claude Haiku 5.5        │
│      │ „Speichern“ (wie heute)│ usage }       │ 6 validateProposal() (core)             │
│      ▼                       │                │ 7 voice_usage (ohne Audio, ohne Text)   │
│ PUT /api/rest/:date ───────────────────────►  │ rest.routes.ts (unverändert, + source)  │
└──────────────────────────────┘                └─────────────────────────────────────────┘
```

- **API:** `src/routes/sprache.routes.ts` mit `POST /api/sprache/verstehen` (Rohdaten `audio/*`
  über `express.raw`, ≤ 1 MB, keine Upload-Bibliothek) und `GET /api/sprache/status` (`enabled`,
  Bildschirme, Restbudget; die App zeigt den Knopf nur dann, kein `NEXT_PUBLIC`-Schalter).
  `src/services/sprache.core.js` (Zahlwörter, Phonetik, `parseCountUtterance`,
  `validateProposal`, Aktionsliste), `sprache.service.ts` (Adapter für STT und Claude über
  `@anthropic-ai/sdk`, Budget), Migration `voice_usage`.
- **Konfiguration** in `bakery.env` (Vorlage `deploy/bakery.env.example`, Runbook §3.6):
  `VOICE_ENABLED=0`, `VOICE_STT_PROVIDER=mistral|openai`, `MISTRAL_API_KEY`/`OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, `VOICE_LLM_MODEL=claude-haiku-5-5`, `VOICE_MONTHLY_BUDGET_EUR=10`.
- **Verwaltung:** `src/components/sprache/` (`MicButton`, `VoiceSheet`, `useRecorder`) und
  `src/lib/spracheApi.ts`. In `RestClient.tsx` wird nur eingehängt. „Übernehmen“ ruft je Zeile
  `setDraftEntry` auf. Konfliktweg (`base`, `draftConflicts`, 409) bleibt unverändert.

## Ablauf & UX

1. **Knopf:** rund, 72 px, „Sprechen“, unten rechts über der Speicherleiste, ohne den Fokus zu
   verdecken (`focusNotObscured`). Er erscheint nur, wenn die Spracheingabe aktiv ist, die Rolle
   schreiben darf und der Tag `editable` ist.
2. **Aufnahme: Tippen zum Starten, nicht Gedrückthalten** (Mehl- und Handschuhhände). Schluss nach
   ca. 1,5 s Stille (WebAudio-Pegel), durch erneutes Tippen oder nach 30 s. Anzeige: pulsierender
   Pegelring, Sekunden, „Ich höre zu …“; nach 3 s ohne Pegel „Ich höre nichts – Mikrofon
   erlaubt?“. Lautstärketasten kann eine Web-App nicht nutzen; ein Bluetooth-Taster, der sich als
   Tastatur meldet, ist eine Option für später (prüfen).
3. **Verarbeiten:** „Verstehe …“ mit Abbrechen. Ziel ≤ 3 s vom Aufnahmeende bis zum Blatt
   (messen). Batch-STT liefert kein Live-Transkript. Live-Text (Voxtral Realtime) nur, wenn der
   Test zeigt, dass er fehlt.
4. **Bestätigungsblatt** (Dialog mit Fokusfalle, Escape schließt):
   - Oben „Gehört: ‚…‘“.
   - Je Zeile: Produkt (Posten · Sorte), „gehört“, Menge (−/+ und Ziffernblock wie auf der Seite),
     „bisher → neu“, ×.
   - Status _sicher_ oder **bitte prüfen** (gelb, mit Grund: „1 kg oder 500 g?“). Bei unklarer
     Größe oder Sorte Chips statt Raten.
   - „Nicht zugeordnet: ‚Krustis zwei‘“ mit Produktsuche.
   - Knöpfe **„Übernehmen (5)“**, „Nochmal sprechen“ (hängt an), „Verwerfen“.
5. **Danach:** Die Werte sind ungespeicherte Änderungen im Entwurf, kurz hervorgehoben. Snackbar
   „5 Zeilen übernommen“ mit **„Rückgängig“** (stellt die vorherigen Entwurfswerte wieder her).
   Gespeichert wird wie heute über die Leiste, **nie automatisch**.
6. **Ohne Verbindung** (Box oder Anbieter nicht erreichbar): Knopf grau, „Spracheingabe braucht
   Internet – bitte tippen.“ Audio wird **nicht** gepuffert.
7. **Barrierefreiheit:** `aria-label`, `aria-pressed`, Status per `aria-live`. Das Blatt ist ganz
   per Tastatur bedienbar. Sprache ist immer nur ein zusätzlicher Weg.
8. **Lärm:** `getUserMedia` mit `noiseSuppression`, `echoCancellation` und `autoGainControl`;
   Tipps unter `/admin/hilfe` (nah sprechen, Name vor Zahl). Die Backstube (Öfen, Lüfter) kommt
   erst in Phase 3, eventuell mit Headset.

## Aktionen (Whitelist je Bildschirm)

| Phase   | Bildschirm                    | Aktion                                                                                                                                              | Rolle            | Ergebnis                                                                                  |
| ------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| **MVP** | `/admin/rest`                 | `rest.setCounts([{ key, menge }])`. „keine/nichts“ ergibt 0; „Posten X nichts übrig“ setzt alle Produkte der Zeile auf 0 (wie der vorhandene Knopf) | verkauf, inhaber | Entwurf der Zählliste                                                                     |
| 2       | `/admin/preorders/neu`        | `preorder.fillDraft({ name, telefon, abholtag, uhrzeit, positionen, anmerkung })`                                                                   | verkauf, inhaber | Entwurf (`preorderDraft.ts`). Abholtag nur offene Tage (`closedPickupDay`), Sorte Pflicht |
| 2       | überall                       | `navigate({ ziel })` nur zu Routen aus `ROLE_ACCESS` und der Pilotliste („Abholliste morgen“)                                                       | jede             | Seitenwechsel                                                                             |
| 3       | Backstube-Tablet / Backzettel | Abhaken bzw. Nachtrag, **nur** über einen vorhandenen Eingabeweg                                                                                    | backstube        | Entwurf/Markierung                                                                        |

- Das MVP kennt nur absolute Werte. „Noch zwei Weck dazu“ wird als `unsicher` markiert („dazu?“).
- Eine neue Aktion braucht einen Eintrag in der Aktionsliste von `sprache.core.js`, ein Schema,
  eine Prüfung und Testsätze. Ohne Eintrag wird sie nie angeboten.

## Sicherheit, Datenschutz, Kosten

- **Schlüssel nur auf dem Server** (`bakery.env`, nie `NEXT_PUBLIC_*`, nie im Log). Für Claude ein
  eigener Schlüssel und Workspace „Verwaltung“, getrennt von den Agenten, mit Ausgabengrenze in der
  Console.
- **Audio wird nicht gespeichert:** Es liegt nur im Speicher, geht ans STT und wird verworfen.
  Transkripte werden standardmäßig auch nicht gespeichert. `voice_usage` hält nur Metadaten: Datum,
  Benutzer, Bildschirm, Dauer, Token, Kosten, Ausgang, ob das LLM gefragt wurde.
- **Was zu wem geht:** Der STT-Anbieter bekommt die Stimme. Claude bekommt nur das Transkript und
  die Produktliste, keine Benutzernamen. Bei Rest am Abend sind das praktisch keine
  personenbezogenen Daten. Ab Phase 2 stehen Kundenname und Telefon im Prompt, das muss ins
  Verarbeitungsverzeichnis.
- **AVV/DPA vor dem Start abschließen und in hq ablegen:** Mistral (DPA, EU-Endpunkt), OpenAI
  (DPA), Anthropic (DPA aus den Commercial Terms; `inference_geo` kennt nur `global`/`us`, keinen
  EU-Inferenzort; Drittland, Aufbewahrung und „kein Training“ prüfen).
- **Mitarbeitende:** Stimmen sind personenbezogene Daten (keine biometrische Auswertung, niemand
  wird identifiziert). Vorher schriftlich informieren (Art. 13 DSGVO). Nutzung **freiwillig**,
  Tippen bleibt gleichwertig. Hinweis beim ersten Mal, in der Hilfe und im Datenschutzhinweis.
- **Kosten deckeln:** Rate-Limit je Benutzer (z. B. 10/min, 150/Tag), Clips ≤ 30 s und ≤ 1 MB.
  **Monatsbudget** aus `voice_usage`, danach 429 `voice_budget_exhausted` („Spracheingabe für
  diesen Monat aufgebraucht – bitte tippen.“). Bei 80 % ein Telegram-Alarm.
- **Prompt-Injection** (geringes Risiko): Das Transkript ist nicht vertrauenswürdig. Das Modell
  kann nur Werkzeuge des Bildschirms vorschlagen, der Server prüft IDs, Mengen und Rolle, und am
  Ende bestätigt ein Mensch.
- **Audit:** Übernommene Werte landen über den normalen PUT im `audit_log` (`rest_count`). Neu ist
  ein optionales Feld `source: 'sprache'` im Body, gespeichert in `data`. Daran lässt sich
  auswerten, wie oft per Stimme gezählt und danach korrigiert wird.

## Phasen

0. **Voraussetzungen:** Q2 (HTTPS), Konten und AVV, 40–60 Testaufnahmen (mit Einwilligung, lokal),
   STT-Vergleich A/B mit Bericht, `whisper-bench` einmal auf der Box als Referenz.
1. **MVP Rest am Abend:**
   - `sprache.core.js` (Parser, Prüfung, Unit-Tests mit synthetischen Sätzen), Endpunkt, Budget,
     `voice_usage`, Claude-Fallback.
   - Knopf und Blatt in `RestClient.tsx`, Hilfe-Text.
   - Doku: `docs/domains/rest-am-abend.md`, neue `docs/api/sprache.md`, Runbook.
   - Pilot zwei Wochen hinter `VOICE_ENABLED`.
2. **Vorbestellung erfassen und Navigation:** dieselbe Pipeline, LLM zuerst, Entwurf in der Maske.
3. **Backstube:** Lärmtest mit Headset, eventuell Live-Transkript.
4. **Später:** lokales STT (faster-whisper / Voxtral Realtime) auf einer eigenen, stärkeren Box
   (Roadmap D4), wenn Kosten oder Datenschutz es verlangen.

## Entscheidungen für den Inhaber

1. **STT-Anbieter:** Mistral (EU) oder OpenAI. Vorschlag: der Vergleich entscheidet, bei Gleichstand
   Mistral.
2. **Claude:** eigener API-Schlüssel und Workspace aus den vorhandenen Guthaben; Monatsbudget
   (Vorschlag 10 €).
3. **Aliase („Brezel“, „Weck“, Mundart):** Vorschlag ist eine eigene Datei
   `hq/config/sprache.yaml` (Produkt-id → Liste). Dann bleiben die Round-Trip-Regeln der
   Produktdateien unberührt. Alternative: Feld `aliases` im Frontmatter.
4. **Transkripte:** 14 Tage zur Verbesserung behalten, oder gar nicht (Vorgabe)?
5. **„Dazu“-Sätze:** addieren lassen, oder nur absolute Zahlen?
6. **Geräte:** Nur das Laden-Tablet, oder auch persönliche Handys? Wer informiert das Team, und
   wann?
7. **Phase 2:** freigeben, sobald das MVP läuft? Dann stehen Kundendaten im Prompt.

## Abnahme MVP

- Am Laden-Tablet über HTTPS wird _„Bauernbrot drei, Weck zwölf, Laugenbrezel keine, Käsekuchen
  zwei Stück“_ (synthetische Testprodukte) ≤ 3 s nach Aufnahmeende als vier richtige Zeilen
  vorgeschlagen.
- Nichts wird gespeichert, bevor „Übernehmen“ **und** „Speichern“ getippt sind. „Rückgängig“
  stellt den vorherigen Entwurf wieder her, ein 409 `rest_changed` verhält sich wie beim Tippen.
- Unbekannte Namen, Mengen außerhalb des Bereichs oder ein Komma bei Stück erscheinen als „bitte
  prüfen“ oder „nicht zugeordnet“, nie als stiller Wert.
- Kein Knopf oder eine deutsche Meldung gibt es: mit Backstube-Rolle, an einem gesperrten Tag, ohne
  HTTPS, ohne Verbindung und bei leerem Budget. Tippen funktioniert unverändert.
- Die Testsätze löst der Parser ohne LLM, freie Sätze gehen an Haiku. `voice_usage` zeigt beides
  mit Kosten. Auf der Box liegt keine Audio- oder Transkriptdatei.
- Eine volle Abendzählung (Smoke, 28 Posten) ist mit Stimme einschließlich Prüfen schneller als
  per Tippen (heute ca. 1,5 min).
- Unit-Tests (Zahlwörter, Phonetik, Prüfung) und Integrationstests (Rollen, Budget, Rate-Limit,
  STT/Claude gemockt) sind grün. Fixtures sind nur synthetisch.
