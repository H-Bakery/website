---
id: TASK-049
title: Lokale Spracherkennung mit whisper.cpp
slug: lokale-spracherkennung-whisper
status: in-progress
priority: 3
owner: ''
projects: []
customers: []
tags:
  - sprache
  - rest-am-abend
  - api
  - betrieb
sprint: ''
depends_on:
  - TASK-048
due_date: ''
created: 2026-11-28
updated: 2026-11-28
---

# Lokale Spracherkennung mit whisper.cpp

## Kontext

Seit TASK-048 (#189) kann die Verwaltung Aufnahmen für
[Rest am Abend](../../../docs/domains/rest-am-abend.md) über Mistral oder OpenAI
in Zählvorschläge übersetzen. Der Inhaber bevorzugt eine lokale Erkennung ohne
Schlüssel auf der Bäckerei-Box (Raspberry Pi 5, vier Kerne, 4 GB RAM).

Im Benchmark mit vier synthetischen deutschen Sätzen lud `whisper-cli` das
Modell für jeden Aufruf neu und nutzte das volle 30-Sekunden-Fenster.
`base-q5_1` brauchte 2,8–3,9 Sekunden und machte Fehler wie „2,5“ bei
„zwei halbe“ und „Brezelnen“. `small-q5_1` brauchte 12–14,5 Sekunden und
erkannte bis auf „Einbauernbroot“ die Sätze korrekt. Als Vorgabe dient
`ggml-small-q5_1.bin` in `whisper-server`, der das Modell im Speicher hält und
für kurze Aufnahmen einen kleineren Audiokontext nutzen kann.

## Umfang

- Anbieter `local` mit konfigurierbarer HTTP(S)-URL, Audiokontext und STT-Zeitlimit.
  Die API sendet die validierte WAV direkt zusammen mit deutschen Produktnamen
  als Erkennungshilfe. Bei Parser-Lücken kann weiterhin optional Claude helfen.
- Optionale Systemd-Unit für den Loopback-Server mit eigenem dynamischen Benutzer,
  schreibgeschütztem Modellverzeichnis und Ressourcenlimits.
- Konfigurationsbeispiele, [API-Vertrag](../../../docs/api/sprache.md) und
  [Betriebsanleitung](../../../docs/runbook.md#lokale-spracherkennung-whispercpp).

## Abnahme

- [ ] `VOICE_ENABLED=1` und `VOICE_STT_PROVIDER=local` genügen für
      `enabled: true` ohne Schlüssel. Eine ungültige URL lässt die Funktion aus.
- [ ] Die API übergibt die WAV unverändert. Der automatische Audiokontext
      berücksichtigt die Clipdauer samt Puffer bis 30 Sekunden. Ein fester Wert
      wird bei Bedarf angehoben, `0` verwendet die Servervorgabe.
- [ ] `voice_usage` erfasst lokale STT mit Kosten von 0. Auch über dem
      Monatsbudget sind lokale Aufnahmen möglich. Die Limits je Person sowie
      die Budgetprüfung für Claude greifen weiter.
- [ ] Nicht erreichbarer Server, HTTP-Fehler, Zeitlimit und ungültige Antwort
      führen zu einer deutschen Meldung über die Bäckerei-Box. Ein leeres Transkript
      führt zu „Nicht verstanden“.
- [ ] Das Installationsskript kopiert die Unit. Die Aktivierung erfolgt von Hand.

## Schritte des Inhabers auf der Box

1. `whisper-server` aus dem festgelegten Tag `v1.9.6` bauen, das Modell
   herunterladen, die Prüfsumme vergleichen und beides gemäß Runbook installieren.
2. Den Dienst aktivieren, `/health` und den POST mit synthetischer WAV prüfen
   und danach die API auf `local` umstellen.
3. Qualität, Latenz und Speicherverbrauch mit laufendem Server messen.
   Kurze und lange Clips sowie parallele Anfragen prüfen. Modell, Audiokontext
   und Speichergrenzen anhand des Benchmarks bestätigen.
4. HTTPS gemäß Q2 einrichten und den Mikrofonzugriff mit einer synthetischen
   Abendzählung am Tablet prüfen.
