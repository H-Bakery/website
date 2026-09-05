---
id: TASK-041
title: Samstagslieferung Mörsbach - Sammelstelle Kindergarten mit Vorbestellungen
slug: sammelstelle-moersbach-vorbestellungen
status: done
priority: 1
owner: ''
projects: []
customers: []
tags:
  - delivery
  - management
  - api
  - feature
sprint: ''
depends_on: []
due_date: ''
created: 2026-09-05
updated: 2026-09-05
---

# Samstagslieferung Mörsbach - Sammelstelle Kindergarten mit Vorbestellungen

## Anlass

Samstags wird ab sofort nach Mörsbach an den Kindergarten geliefert. Das ist der erste echte
Liefer-Use-Case der Fahrer-App. Vorbestellt werden kann - und zwar **nicht** im Shop, sondern
im Team: die Management-App ist das Eingabetor für Telefon- und Thekenbestellungen.

## Fachliche Festlegung

Der Kindergarten ist eine **Sammelstelle**, keine Haustürlieferung: alle Vorbestellungen eines
Samstags werden dorthin gebracht und im Zeitfenster 09:00-09:30 übergeben. Für den Fahrer ist
das **ein Stopp mit einer Übergabeliste** - je Kunde Referenz, Artikel, Betrag, einzeln
abzuhaken.

## Was gebaut wurde

- **API** (`simple-server.js` + neuer Kern `delivery-preorders.core.js`): Lieferstellen und
  Vorbestellungen im bestehenden Liefer-Store, acht Endpunkte unter `/api/deliveries`,
  Preis-Snapshot aus `hq`, Bestellschluss (Freitag 12:00, warnt statt zu blockieren),
  Backlisten-Summierung, gesperrte Statusübergänge, Migration älterer Stores.
- **Management-App** (`/admin/delivery/preorders`): Tagesliste mit Summe und Bestellschluss,
  Erfassungsmaske mit Produktauswahl und Live-Summe, druckbare Backliste für die Backstube,
  Pflege der Lieferstelle, Stornieren mit Rückfrage.
- **Fahrer-App**: Übergabeliste am Sammelstellen-Stopp, "X von Y übergeben · Bar zu kassieren",
  Rückfrage beim Abschließen mit offenen Vorbestellungen, Offline-Warteschlange trägt jetzt
  auch Vorbestellungen.
- **Dunkelmodus** der Fahrer-App: System / Hell / Dunkel, CSS-Variablen, kein Flash, keine
  Hydration-Abweichung, abgedunkelte Kartenkacheln.

## Offen

- ~~Die Adresse des Kindergartens fehlt.~~ Nachgetragen am 05.09.2026: Höhenstraße 24, 66482
  Zweibrücken-Mörsbach (städt. Kita „Hand in Hand"), von Nominatim auf die Hausnummer genau
  gefunden und im Seed hinterlegt.
- Touren aus älteren Stores bekommen den Sammelstellen-Stopp nicht automatisch; die
  Management-Liste warnt in dem Fall.
- Keine Authentifizierung (gilt für die ganze Fahrer-App).
- ~~E2E-Suiten nicht erweitert.~~ `apps/bakery-delivery-e2e/src/sammelstelle.spec.ts` deckt
  Übergabeliste, Abhaken, Rückfrage, Nichtabholung und Dunkelmodus ab — auf Desktop und Pixel 5,
  26 Tests grün. Die roten Suiten aus TASK-040 (Shop, Management, Landing) bleiben davon unberührt.
