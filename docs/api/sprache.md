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
  `remainingEuro` und `warning` (mindestens 80 %). Ohne Freigabe oder passenden STT-Schlüssel kommt
  `enabled: false` und die Liste der Bildschirme ist leer.
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
  Stück, relative Angaben und Einheit geprüft.
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
| 503  | `voice_disabled`, `voice_unavailable`        | Funktion aus oder der Transkriptionsanbieter ist nicht erreichbar      |

## Konfiguration und Kosten

`VOICE_ENABLED=1` und der Schlüssel des gewählten Anbieters aktivieren die Funktion.
`VOICE_STT_PROVIDER=mistral` verwendet `MISTRAL_API_KEY` und standardmäßig
`voxtral-mini-2602` an `https://api.eu.mistral.ai`. Mistral führt dieses Modell
seit dem 31.10.2026 als veraltet und nennt auf der Modellseite kein Abschaltdatum.
Der STT-Vergleich in Phase 0 legt das Pilotmodell fest. Dabei läuft auch
`voxtral-mini-transcribe-3-0` mit deutschen Testaufnahmen am EU-Endpunkt mit.
[Mistral-Modellstatus](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) · [Sprachen](https://docs.mistral.ai/studio/audio/specs-and-limits/languages) · [EU-Preise](https://docs.mistral.ai/inference/pricing?region=eu)

`openai` verwendet `OPENAI_API_KEY` und standardmäßig `gpt-transcribe`.
`VOICE_STT_MODEL` überschreibt das Modell. OpenAI schaltet das abgelöste
`gpt-4o-mini-transcribe` am 26.02.2027 ab. Mit `ANTHROPIC_API_KEY` kann der
Parser bei Lücken das Modell aus `VOICE_LLM_MODEL` fragen (Vorgabe
`claude-haiku-5-5`). [OpenAI-Transkriptionsdoku](https://developers.openai.com/api/docs/guides/speech-to-text)

`VOICE_MONTHLY_BUDGET_EUR` beträgt standardmäßig 10. `VOICE_RATE_PER_MINUTE`
und `VOICE_RATE_PER_DAY` gelten je Benutzer in gleitenden Fenstern von
60 Sekunden bzw. 24 Stunden (Vorgaben 10 und 150). Die API reserviert Kosten
vor jedem Anbieteraufruf in SQLite. Sie setzt für STT mindestens die Clipdauer
an und übernimmt eine höhere gemeldete Dauer aus `usage.prompt_audio_seconds`
(Mistral) oder `usage.seconds` bei `usage.type: "duration"` (OpenAI). Für
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
[OpenAI-Verbrauchsdaten](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create/) · [Mini-Tokentarif](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe) · [4o-Tokentarif](https://developers.openai.com/api/docs/models/gpt-4o-transcribe)

`VOICE_STT_USD_PER_MINUTE` überschreibt 0,003 USD/min für Mistral oder
0,006 USD/min für OpenAI. Der OpenAI-Ansatz enthält einen Puffer gegenüber
dem Listentarif von 0,0045 USD/min für `gpt-transcribe`.
`VOICE_LLM_USD_PER_M_INPUT` (0,10) und `VOICE_LLM_USD_PER_M_OUTPUT` (0,50)
verwenden ebenfalls Dezimalpunkte. Beim Modellwechsel die Vorgaben anhand
des Anbietertarifs prüfen. Das lokale Budget schätzt Kosten mit 1 USD = 1 EUR.
Nachgemeldeter Verbrauch kann die Schätzung über das lokale Limit heben.
Die harte Ausgabengrenze wird beim Anbieter eingerichtet.
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
100 Begriffe als `context_bias` (Array von Strings), OpenAI als `prompt`. Bei Parser-Lücken
erhält Anthropic das Transkript, die bisherigen Parser-Treffer und die
Zählliste mit Schlüsseln, Namen, Sorten, Einheiten und Aliasen.
Die Anfragen übertragen keine Anmeldeinformationen der Beschäftigten.
Im Browser bleibt das Transkript bis zum Schließen des Vorschlags sichtbar.
In DB, Logs oder Dateien der Bäckerei-App stehen weder Audio noch Transkript.

`voice_usage` enthält Zeitpunkt, Benutzer-ID, Bildschirm, Dauer, STT-Anbieter,
Tokenzahlen, geschätzte Kosten in Mikro-Euro, Ausgang und ob Claude angefragt wurde.
Aufbewahrung und Verarbeitung beim jeweiligen Anbieter klärt der Inhaber vor
Freigabe. Die Nutzung ist freiwillig und die Eingabe per Tastatur bleibt verfügbar.
