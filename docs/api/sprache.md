# Spracheingabe für Rest am Abend

Die Spracheingabe erstellt auf `/admin/rest` Vorschläge für `rest.setCounts`.
Sie schreibt ausschließlich Verbrauchsmetadaten. Die Verwaltung übernimmt
bestätigte Mengen in den bestehenden Entwurf und speichert sie über den
[regulären Rest-PUT](rest.md).

## Endpunkte

Beide Endpunkte verlangen eine Sitzung mit Rolle `verkauf` oder `inhaber`.
Erfolgreiche Antworten verwenden `{ success: true, data: … }`.
Die Antworten tragen `Cache-Control: no-store`.

- `GET /api/sprache/status` liefert `enabled`, `screens` und `budget` mit
  `month` (Kalendermonat in Berlin), `limitEuro`, `spentEuro` und
  `remainingEuro` und `warning` (mindestens 80 %). `sttProvider` nennt den aktiven
  Anbieter oder ist `null`. Ohne Freigabe oder gültige Anbieterkonfiguration kommt
  `enabled: false` und die Liste der Bildschirme ist leer. Der Status prüft die
  Konfiguration. Ein Ausfall des Anbieters zeigt sich beim Transkriptionsaufruf.
- `POST /api/sprache/verstehen?screen=rest&date=YYYY-MM-DD` erwartet über HTTPS
  einen rohen WAV-Body (`audio/wav` oder `audio/x-wav`) mit PCM, 16 kHz,
  16 Bit, mono und einem Datenblock direkt nach dem Formatblock. Es gelten
  höchstens 1 MiB und 30 Sekunden. Ohne Datum gilt heute in Berlin.
  Die Antwort enthält `transcript`, `proposal[]` mit `key`, `menge` in der
  Eingabeeinheit der Zeile, `heard`, `unsicher` und `reason`, außerdem
  `unmatched[]` mit `heard` und optionalen `candidates` sowie `usage` mit
  `costEuro`, `llmUsed` und Tokenzählern (`input`, `output`, `read`, `write`).
  Eine Menge `null` im Vorschlag erfordert eine manuelle Eingabe. Modellvorschläge
  werden am wörtlichen Transkriptausschnitt auf Menge, Kommaschreibweise bei
  Stück, relative Angaben und Einheit geprüft. Der Name muss mit denselben
  Namensregeln wie im Parser eindeutig zur Zeile passen. Bei abweichender oder
  unklarer Zuordnung bleiben der markierte Vorschlag und das offene Bruchstück
  sichtbar. Die Mengenprüfung bezieht den vollständigen Zahlenausdruck ein.
- Wenn Claude ausfällt, ablehnt, kein gültiges Werkzeugergebnis liefert oder
  das Budget für diesen Schritt fehlt, bleiben vorhandene Parser-Vorschläge
  samt offenen Bruchstücken erhalten. `hint` enthält den Hinweis für das
  Bestätigungsblatt. Hat der Parser keine Zeile erkannt, antwortet die API
  in diesem Fall mit 422.

| HTTP | Fehlercode                                   | Ursache                                                                |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 403  | `forbidden`, `voice_https_required`          | Rolle hat kein Schreibrecht oder Upload läuft ohne HTTPS               |
| 409  | `voice_day_locked`, `voice_no_rows`          | Tag gesperrt oder keine passenden Zählzeilen                           |
| 413  | `payload_too_large`, `voice_audio_duration`  | Aufnahme überschreitet Byte- oder Zeitgrenze                           |
| 415  | `voice_audio_format`                         | Audioformat fehlt oder passt nicht                                     |
| 422  | `voice_not_understood`                       | Kein verwertbares Transkript oder Claude scheitert ohne Parser-Treffer |
| 429  | `voice_rate_limit`, `voice_budget_exhausted` | Zu viele Aufnahmen je Benutzer oder Monatsbudget reicht nicht          |
| 503  | `voice_disabled`, `voice_unavailable`        | Funktion aus oder Transkription beim Anbieter fehlgeschlagen           |

Bei einem Verbindungsfehler, Zeitlimit, HTTP-Fehler oder ungültigem JSON
liefert `local` den Fehler `voice_unavailable` mit der Meldung
„Die Spracherkennung auf der Bäckerei-Box antwortet nicht – bitte tippen.“
Auch ein fehlendes oder nicht als String vorliegendes `text` gilt als Anbieterfehler.
Ein leerer String ergibt 422. Bei Cloud-Ausfall lautet die Meldung
„Spracheingabe braucht Internet – bitte tippen.“ Die Antworttexte des Anbieters
werden bei Fehlern weder weitergegeben noch protokolliert.

## Konfiguration und Kosten

`VOICE_ENABLED=1` und eine gültige Konfiguration des gewählten Anbieters aktivieren die Funktion.
`VOICE_STT_PROVIDER=mistral` verwendet `MISTRAL_API_KEY` und standardmäßig
`voxtral-mini-2602` an `https://api.eu.mistral.ai`. Mistral führt dieses Modell
seit dem 31.10.2026 als veraltet und nennt auf der Modellseite kein Abschaltdatum.
Der STT-Vergleich in Phase 0 legt das Pilotmodell fest. Dabei läuft auch
`voxtral-mini-transcribe-3-0` mit deutschen Testaufnahmen am EU-Endpunkt mit.
[Mistral-Modellstatus](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) · [Sprachen](https://docs.mistral.ai/studio/audio/specs-and-limits/languages) · [EU-Preise](https://docs.mistral.ai/inference/pricing?region=eu)

`openai` verwendet `OPENAI_API_KEY` und standardmäßig `gpt-transcribe`.
`VOICE_STT_MODEL` überschreibt das Cloud-Modell. OpenAI schaltet das abgelöste
`gpt-4o-mini-transcribe` am 26.02.2027 ab.
[OpenAI-Transkriptionsdoku](https://developers.openai.com/api/docs/guides/speech-to-text)

`local` verwendet `whisper-server` ohne API-Schlüssel oder Authorization-Header.
Die Vorgabe für `VOICE_STT_URL` ist `http://127.0.0.1:8178/inference`.
Nur HTTP- und HTTPS-URLs sind gültig. Die API sendet die unveränderte WAV
als Multipart-Feld `file` (`aufnahme.wav`, `audio/wav`) mit
`response_format=json`, `language=de`, `temperature=0` und einem
`Produktnamen:`-Prompt. Die Zeilenbeschriftungen haben Vorrang vor Postennamen
und Aliasen. Die API nimmt ganze Namen bis zu einem Limit von 400 UTF-8-Bytes
auf. Das lässt Spielraum für die Tokenisierung von Umlauten und Sonderzeichen.
Das Modell wird am Server eingestellt.
[Einrichtung auf der Bäckerei-Box](../runbook.md#lokale-spracherkennung-whispercpp)

- `VOICE_STT_AUDIO_CTX=auto` (Vorgabe) berechnet `audio_ctx` je Clip aus
  aufgerundeten 50 Frames pro Sekunde plus 64 Frames Puffer (1,28 Sekunden).
  Mindestens 256 Frames geben kurzen Clips zusätzlichen Spielraum. Bei 1500
  Frames (30 Sekunden) liegt die Obergrenze.
- Eine positive Ganzzahl gibt den Zielwert vor. Die API erhöht ihn bei Bedarf
  auf die Clipdauer samt Puffer, höchstens auf 1500 Frames. Ungültige Werte
  verwenden die automatische Berechnung.
- Bei `VOICE_STT_AUDIO_CTX=0` sendet die API ausdrücklich `audio_ctx=0` für
  das volle 30-Sekunden-Fenster. Die API setzt `audio_ctx` für jede
  Aufnahme. `WHISPER_AUDIO_CTX` gilt für andere Aufrufer, die das Feld
  weglassen.
- `VOICE_STT_TIMEOUT_MS` begrenzt den STT-Aufruf inklusive Wartezeit beim
  Anbieter auf 1000 bis 60000 ms. Die Vorgaben sind 12000 ms für Mistral und
  OpenAI und 25000 ms für `local`. Claude hat weiterhin 12000 ms.

Mit `ANTHROPIC_API_KEY` kann die API bei Parser-Lücken nach jedem STT-Anbieter
das Modell aus `VOICE_LLM_MODEL` fragen (Vorgabe `claude-haiku-5-5`).

`VOICE_MONTHLY_BUDGET_EUR` beträgt standardmäßig 10. `VOICE_RATE_PER_MINUTE`
und `VOICE_RATE_PER_DAY` gelten je Benutzer in gleitenden Fenstern von
60 Sekunden bzw. 24 Stunden (Vorgaben 10 und 150). Die API erfasst lokale
Aufnahmen in `voice_usage` als `stt_provider = 'local'` mit STT-Kosten und
Reserve von 0. STT-Tarifvariablen haben dafür keine Wirkung. Das Monatsbudget
gilt für Cloud-STT und für jeden optionalen Claude-Aufruf. Lokale
Transkription bleibt auch bei ausgeschöpftem Budget verfügbar.

Für Cloud-Aufrufe reserviert die API geschätzte Kosten vorab in SQLite.
Für Cloud-STT beträgt die Reserve das
1,5-Fache der Clipdauer, auf volle Sekunden aufgerundet und mit mindestens
drei Sekunden angesetzt. Für Tokentarife reserviert die API den höheren
Betrag aus Dauer- und Tokenschätzung. Die Tokenschätzung nutzt 50 Audiotokens
je reservierter Sekunde, ein Token je
UTF-8-Byte des Prompts, 64 Tokens für die Einbettung und dem Ausgabemaximum
(2.000 für die bekannten 4o-Modelle, bei anderen manuell bepreisten Modellen
pauschal 16.384 als Reserve). Nach der Antwort gibt die API den
unverbrauchten Anteil frei. Abgerechnet wird mindestens die tatsächliche
Clipdauer, bei höherer gemeldeter Dauer `usage.prompt_audio_seconds`
(Mistral) oder `usage.seconds` mit `usage.type: "duration"` (OpenAI).
Mistral-Tokenzahlen stammen aus `prompt_tokens` und `completion_tokens`. Für
OpenAI-Modelle mit Token-Abrechnung erfasst sie Eingabe- und Ausgabe-Tokens
als Metadaten und berechnet bei bekannten Tarifen den höheren Betrag aus
Token- und Dauerschätzung. Hinterlegt sind die veröffentlichten Tarife für
`gpt-4o-mini-transcribe` (1,25/5 USD pro Mio. Tokens) und
`gpt-4o-transcribe` (2,50/10 USD pro Mio. Tokens). Bei einem Modellwechsel
können `VOICE_STT_USD_PER_M_INPUT` und `VOICE_STT_USD_PER_M_OUTPUT` die
Tokenpreise setzen. Fehlt ein vollständiger Tarif, gilt die Dauerschätzung.
Bei einem gescheiterten Claude-Aufruf bleibt
mindestens dessen Reservierung verbucht. Die API warnt einmal je Monat
im Log, sobald mindestens 80 % verbraucht sind.
[Mistral-Verbrauchsdaten](https://docs.mistral.ai/studio/audio/speech-to-text/transcribe-files) · [OpenAI-Verbrauchsdaten](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/) · [Mini-Tokentarif](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe) · [4o-Tokentarif](https://developers.openai.com/api/docs/models/gpt-4o-transcribe)

`VOICE_STT_USD_PER_MINUTE` überschreibt 0,003 USD/min für Mistral oder
0,006 USD/min für OpenAI. Der OpenAI-Ansatz enthält einen Puffer gegenüber
dem Listentarif von 0,0045 USD/min für `gpt-transcribe`.
`VOICE_LLM_USD_PER_M_INPUT` (0,10) und `VOICE_LLM_USD_PER_M_OUTPUT` (0,50)
verwenden ebenfalls Dezimalpunkte. Beim Modellwechsel die Vorgaben anhand
des Anbietertarifs prüfen. Das lokale Budget schätzt Kosten mit 1 USD = 1 EUR.
Nachgemeldeter Verbrauch kann die Schätzung über das lokale Limit heben.
Die harte Ausgabengrenze für Cloud-Aufrufe wird beim Anbieter eingerichtet.
[OpenAI-Preise](https://developers.openai.com/api/docs/pricing) · [Pilot-Checkliste](../runbook.md#36-konfiguration-ausfüllen)

## Aliase

Optionale Datei `config/sprache.yaml` im selben hq-Leseklon wie die
Backzettel-Konfiguration (`HQ_DIR`). Fehlt sie, arbeitet der Parser mit den
Produkt- und Postennamen. Das Format ist eine YAML-Zuordnung von Produkt-ID
zu einer Liste gesprochener Namen. Synthetisches Beispiel:

```yaml
test-laugenbrezel:
  - Brezel
  - Laugen-Brezel
test-weck:
  - Semmelchen
```

## Datenschutz

Die Bäckerei-App hält die Aufnahme nur für die Verarbeitung im Arbeitsspeicher.
Der gewählte STT-Dienst erhält die Aufnahme und eine Auswahlliste aus
Produktnamen, Postennamen und Aliasen des Tages. Mistral bekommt bis zu
100 Begriffe als `context_bias` (Array von Strings), OpenAI und der lokale
Dienst als `prompt`. Mit dem lokalen Loopback-Endpunkt bleibt die Aufnahme auf
der Box. Bei Parser-Lücken und eingerichtetem Claude-Schlüssel erhält
Anthropic das Transkript, die bisherigen Parser-Treffer und die
Zählliste mit Schlüsseln, Namen, Sorten, Einheiten und Aliasen.
Die Anfragen übertragen keine Anmeldeinformationen der Beschäftigten.
Im Browser bleibt das Transkript bis zum Schließen des Vorschlags sichtbar.
In DB, Logs oder Dateien der Bäckerei-App stehen weder Audio noch Transkript.

`voice_usage` enthält Zeitpunkt, Benutzer-ID, Bildschirm, Dauer, STT-Anbieter,
Tokenzahlen, geschätzte Kosten in Mikro-Euro, Ausgang und ob Claude angefragt wurde.
Aufbewahrung und Verarbeitung beim jeweiligen Anbieter klärt der Inhaber vor
Freigabe. Die Nutzung ist freiwillig und die Eingabe per Tastatur bleibt verfügbar.
