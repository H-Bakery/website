---
id: TASK-037
title: Verkaufspartner CAP-Markt - Lieferungen erfassen und auswerten
slug: verkaufspartner-cap-markt-erfassung-und-auswertung
status: done
priority: 2
owner: ''
projects: []
customers: []
tags:
  - management
  - partner
  - delivery
  - analytics
sprint: ''
depends_on: []
due_date: ''
created: 2026-08-30
updated: 2026-08-30
---

# Verkaufspartner CAP-Markt - Lieferungen erfassen und auswerten

## Kontext

Wir beliefern seit Neuestem den **CAP-Markt Homburg-Kirrberg**
(https://cap-markt.de/maerkte/homburg-kirrberg) **Dienstag bis Samstag morgens** mit
Backwaren. Die Ware steht dort in einem **"Backschrank"** - ein Regal mit Brot, Brötchen
und Kaffeestückchen.

Es kommt regelmäßig vor, dass **mehrmals am Tag nachgeliefert und nachgefüllt** werden
muss. Aktuell wird **überhaupt nichts erfasst** - es gibt keine Liste, keinen
Lieferschein-Prozess, keine Zahlen. Die App definiert den Prozess also neu und ist
gleichzeitig die einzige Datenquelle.

Ziel: Das Team beim täglichen Bestücken/Nachfüllen unterstützen **und** belastbare Zahlen
zu gelieferter Ware, Abverkauf und Umsatz erzeugen - sowohl für uns intern als auch als
**Partner-Report** für den CAP-Markt.

## Fachliche Grundlagen (geklärt)

| Thema               | Entscheidung                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Abrechnungsmodell   | **Kommission** - CAP zahlt nur, was verkauft wurde, Rest kommt zurück                          |
| Verkaufsermittlung  | **Wir zählen den Restbestand vor Ort** - Verkauf = geliefert − Rest. Keine Kassendaten von CAP |
| Preise              | **HQ-Preise 1:1** aus `hq/products/*.md` - keine Partner-Preisliste, keine Provision           |
| Liefertage          | **Dienstag bis Samstag**, morgens, plus Nachlieferungen nach Bedarf                            |
| Standard-Bestückung | **Feste Liste je Wochentag** - App bietet Vorlagen zum Laden und Anpassen                      |
| Bisheriger Prozess  | **Keiner** - kein Altsystem, keine Migration nötig                                             |
| MVP-Umfang          | Erfassung + Nachlieferungen **und** Partner-Report                                             |

## Leitgedanke: Besuche statt Lieferungen

Zentrale Modellierungs-Entscheidung: Erfasst wird nicht "eine Lieferung", sondern ein
**Besuch am Backschrank**. Jeder Besuch hält zwei Dinge fest:

1. **Was lag noch da?** (Restbestand vorgefunden)
2. **Was habe ich reingelegt?** (geliefert)

Das bildet die Realität exakt ab - beim Nachfüllen zählt man ohnehin erst, was übrig ist -
und liefert nebenbei **Verkaufszahlen im Tagesverlauf** ohne Zusatzaufwand:

```
Bestand nach Besuch k   = Rest_k + Geliefert_k
Verkauf im Intervall    = Bestand nach Besuch k − Rest_(k+1)
Tagesverkauf            = Σ Geliefert − Rest beim letzten Besuch (Abholung)
Umsatz                  = Σ (Verkauf je Produkt × HQ-Preis)
Abverkaufsquote         = Verkauf / Geliefert
```

Der erste Besuch des Tages hat Rest = 0 (bzw. Rest vom Vortag, falls nicht abgeholt wird).

## Datenmodell

Generisch als **Partner**-Entität modelliert (CAP ist der erste Datensatz), weil ein
Partner-Portal später ohnehin geplant ist. Bewusst schlank gehalten - keine Vorratsfelder.

### `Partner`

| Feld                            | Typ           | Bemerkung                                                |
| ------------------------------- | ------------- | -------------------------------------------------------- |
| `id`                            | INTEGER PK    |                                                          |
| `name`                          | STRING        | "CAP-Markt Homburg-Kirrberg"                             |
| `slug`                          | STRING UNIQUE | `cap-markt-homburg-kirrberg`                             |
| `street`, `zip`, `city`         | STRING        | Adresse                                                  |
| `contactName`, `phone`, `email` | STRING NULL   | Ansprechpartner                                          |
| `deliveryDays`                  | JSON          | `[2,3,4,5,6]` (ISO-Wochentage Di–Sa)                     |
| `settlementModel`               | ENUM          | `commission` \| `firm_sale` - aktuell immer `commission` |
| `active`                        | BOOLEAN       |                                                          |
| `notes`                         | TEXT NULL     |                                                          |

### `PartnerDeliveryTemplate` - Standard-Bestückung je Wochentag

| Feld        | Typ          | Bemerkung                                |
| ----------- | ------------ | ---------------------------------------- |
| `id`        | INTEGER PK   |                                          |
| `partnerId` | FK → Partner |                                          |
| `weekday`   | INTEGER      | 2 = Di … 6 = Sa                          |
| `items`     | JSON         | `[{ productId, productSlug, quantity }]` |
| `active`    | BOOLEAN      |                                          |

Eine Vorlage pro Partner und Wochentag (Unique-Constraint auf `partnerId + weekday`).

### `PartnerVisit` - ein Besuch am Backschrank

| Feld                     | Typ            | Bemerkung                                                                                    |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| `id`                     | INTEGER PK     |                                                                                              |
| `partnerId`              | FK → Partner   |                                                                                              |
| `businessDate`           | DATEONLY       | Geschäftstag - Gruppierungsschlüssel für alle Auswertungen                                   |
| `visitAt`                | DATE           | Zeitpunkt, frei änderbar (Nacherfassung)                                                     |
| `visitType`              | ENUM           | `initial` (Erstbestückung) \| `refill` (Nachlieferung) \| `pickup` (Abholung/Tagesabschluss) |
| `sequence`               | INTEGER        | 1, 2, 3 … innerhalb des Geschäftstags                                                        |
| `staffId`                | FK → User NULL | wer war da                                                                                   |
| `note`                   | TEXT NULL      | z.B. "Brot war um 10 Uhr komplett leer"                                                      |
| `createdAt`, `updatedAt` | DATE           |                                                                                              |

### `PartnerVisitItem`

| Feld           | Typ               | Bemerkung                                                        |
| -------------- | ----------------- | ---------------------------------------------------------------- |
| `id`           | INTEGER PK        |                                                                  |
| `visitId`      | FK → PartnerVisit |                                                                  |
| `productId`    | INTEGER           | numerische HQ-ID                                                 |
| `productSlug`  | STRING            | HQ-`id`, stabil gegen Umnummerierung                             |
| `productName`  | STRING            | **Snapshot** zum Zeitpunkt des Besuchs                           |
| `unitPrice`    | DECIMAL(10,2)     | **Snapshot** des HQ-Preises - Reports bleiben historisch korrekt |
| `countedQty`   | INTEGER NULL      | Rest vorgefunden (`null` = nicht gezählt)                        |
| `deliveredQty` | INTEGER DEFAULT 0 | neu eingeräumt                                                   |

**Wichtig:** `productName` und `unitPrice` werden als Snapshot gespeichert. Ändert sich
später ein HQ-Preis, bleiben alte Abrechnungen korrekt.

### Verhältnis zum bestehenden `UnsoldProduct`

`apps/bakery-api/src/models/UnsoldProduct.ts` bildet Retouren **im eigenen Laden** ab
(`quantity`, `date`, `productId`, `userId`) und hat keinen Partnerbezug. Nicht erweitern -
Partner-Retouren ergeben sich aus `PartnerVisitItem.countedQty` des `pickup`-Besuchs.
Im Report-Layer prüfen, ob beide Quellen für eine gemeinsame "Retouren-Gesamtsicht"
zusammengeführt werden sollen (siehe Offene Punkte).

## Backend (`apps/bakery-api`)

Bestehende Patterns nutzen: Sequelize-Models in `src/models/`, Routen in `src/routes/`,
Controller in `src/controllers/`, Services in `src/services/`. Registrierung in
`src/models/index.ts` und `src/routes/index.ts`.

### Endpunkte

```
GET    /api/partners                          Liste
POST   /api/partners                          anlegen
GET    /api/partners/:id                      Detail
PUT    /api/partners/:id                      bearbeiten

GET    /api/partners/:id/templates            alle Wochentags-Vorlagen
PUT    /api/partners/:id/templates/:weekday   Vorlage speichern

GET    /api/partners/:id/visits?from=&to=     Besuche im Zeitraum
GET    /api/partners/:id/visits/today         Besuche des heutigen Geschäftstags
POST   /api/partners/:id/visits               Besuch erfassen
PATCH  /api/partners/:id/visits/:visitId      korrigieren
DELETE /api/partners/:id/visits/:visitId      löschen (Fehleingabe)

GET    /api/partners/:id/stats?from=&to=      Kennzahlen (aggregiert)
GET    /api/partners/:id/report?from=&to=     Report-Daten (JSON)
GET    /api/partners/:id/report.csv?from=&to= CSV-Export
```

### `partner-stats.service.ts` - Berechnungslogik

Eine Stelle, an der alle Kennzahlen berechnet werden (nicht im Controller, nicht im
Frontend). Liefert je Zeitraum:

- **je Produkt:** geliefert, Retoure, verkauft, Umsatz, Abverkaufsquote
- **je Geschäftstag:** Summen + Anzahl Besuche/Nachlieferungen
- **je Wochentag** (aggregiert über Zeitraum): Durchschnittswerte - Grundlage für spätere
  Mengenempfehlungen
- **Gesamt:** Umsatz, Retourenwert, Retourenquote

Ein Geschäftstag ohne `pickup`-Besuch gilt als **offen** - Verkauf/Umsatz sind dann
vorläufig. Das muss der Service als Flag mitliefern und die UI kennzeichnen, sonst
erscheinen unvollständige Tage im Report als 100 % Abverkauf.

### Seed

`src/seeders/` um CAP-Markt-Partner ergänzen (Adresse, Liefertage Di–Sa, `commission`).
Vorlagen leer lassen - die füllt das Team selbst.

## Frontend (`apps/bakery-management`)

### Navigation

Neuer Eintrag **"Verkaufspartner"** in `src/app/admin/navigation.ts`, sinnvoll direkt
neben "Lieferung" (aktuell Zeile ~108). Icon: `Storefront`.

### Seiten

| Route                            | Zweck                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| `/admin/partners`                | Partner-Übersicht (MVP: eine Karte für CAP mit Tages-Status) |
| `/admin/partners/[id]`           | Partner-Detail: heutiger Tag, Besuchs-Timeline, Kennzahlen   |
| `/admin/partners/[id]/visit/new` | **Erfassungsmaske** (mobile-first)                           |
| `/admin/partners/[id]/templates` | Standard-Bestückung je Wochentag pflegen                     |
| `/admin/partners/[id]/report`    | Report mit Zeitraumwahl + Export                             |

### Erfassungsmaske - mobile-first

Der wichtigste Screen. Wird am Handy im Markt bedient, ggf. mit schlechtem Empfang und
einer Hand voll Backblech.

- Produkte gruppiert nach Kategorie (Brot, Brötchen, Teilchen) - Reihenfolge wie in
  `CATEGORY_ORDER` aus `lib/products.ts`
- Pro Produkt zwei Zahlen nebeneinander: **"Rest"** und **"Neu"**
- Große `+`/`−`-Stepper, Touch-Ziele ≥ 44 px, kein Tippen auf Mini-Inputs
- Besuchstyp-Umschalter oben: Erstbestückung / Nachlieferung / Abholung
- Bei Erstbestückung: **Wochentags-Vorlage automatisch vorbefüllt**, nur noch anpassen
- Bei Nachlieferung: Produkte mit hohem Abverkauf seit letztem Besuch oben einsortieren
- Zwischenstand als Draft in `localStorage`, damit ein Verbindungsabbruch oder versehent-
  liches Schließen keine Zählung vernichtet
- Zeitpunkt frei änderbar → deckt Nacherfassung im Büro mit ab

Als Vorbild für Formular- und Tabellen-Patterns dient
`src/app/admin/delivery/page.tsx`; Datenzugriff über `apiClient` aus
`@bakery/shared/data-access` wie dort.

### Partner-Detail

- Kopf: heutiger Geschäftstag, Status (offen/abgeschlossen), Ampel für "Abholung fehlt"
- Timeline der Besuche des Tages mit Uhrzeit, Typ, Person, Mengen
- Kennzahlen-Kacheln: geliefert, verkauft, Retoure, Umsatz, Abverkaufsquote
- Button "Besuch erfassen" prominent und dauerhaft sichtbar

### Partner-Report

- Zeitraumwahl: Woche / Monat / frei
- Tabelle je Produkt: geliefert, verkauft, Retoure, Abverkaufsquote, Umsatz
- Tagesverlauf als Balken (Chart-Bibliothek wie in `admin/analytics` verwenden)
- Export **CSV** (MVP) und **PDF** (druckbare Ansicht, `@media print`)
- Kopf mit Partnername, Zeitraum, Abrechnungsmodell "Kommission" - so gestaltet, dass er
  ohne Nacharbeit an CAP herausgegeben werden kann

## Umsetzungsphasen

### Phase 1 - Datenmodell & API

1. Models `Partner`, `PartnerDeliveryTemplate`, `PartnerVisit`, `PartnerVisitItem` + Migrationen
2. Registrierung in `models/index.ts`, Associations setzen
3. CRUD-Routen Partner + Vorlagen
4. Besuchs-Endpunkte inkl. Validierung (`sequence` automatisch, keine zwei `initial` je Tag)
5. Seed CAP-Markt
6. Unit-Tests für Models und Routen (Pattern: `src/routes/__tests__/`)

### Phase 2 - Erfassung im Frontend

7. Navigationseintrag + Partner-Übersicht
8. Erfassungsmaske mobile-first inkl. Vorlagen-Vorbefüllung und localStorage-Draft
9. Vorlagen-Pflegeseite je Wochentag
10. Partner-Detail mit Besuchs-Timeline und Korrekturmöglichkeit

### Phase 3 - Kennzahlen

11. `partner-stats.service.ts` mit voller Berechnungslogik + Tests für die Formeln
12. `/api/partners/:id/stats`
13. Kennzahlen-Kacheln und Tagesverlauf im Partner-Detail

### Phase 4 - Partner-Report

14. Report-Endpunkt inkl. CSV
15. Report-Seite mit Zeitraumwahl, Tabelle, Chart
16. Druck-/PDF-Ansicht

### Phase 5 - später (nicht in diesem Task)

- **Partner-Portal**: eigener Read-only-Zugang für CAP auf seine eigenen Zahlen
- **Mengenempfehlung**: "Dienstags durchschnittlich 12 von 20 Broten verkauft - 14 liefern"
- Push-Erinnerung, wenn an einem Liefertag bis X Uhr kein Besuch erfasst wurde
- Weitere Verkaufspartner (Modell trägt das bereits)

## Akzeptanzkriterien

- [x] CAP-Markt ist als Partner angelegt und über `/admin/partners` erreichbar
- [x] Standard-Bestückung lässt sich je Wochentag (Di–Sa) pflegen
- [x] Erstbestückung erfassen: Vorlage des Wochentags ist vorbefüllt und anpassbar
- [x] Nachlieferung erfassen: Restbestand und neue Menge je Produkt in einem Formular
- [x] Mehrere Besuche am selben Tag werden korrekt gezählt und chronologisch angezeigt
- [x] Abholung/Tagesabschluss erfassen schließt den Geschäftstag ab
- [x] Erfassungsmaske ist am Handy einhändig bedienbar (Touch-Ziele ≥ 44 px, kein H-Scroll)
- [x] Abgebrochene Erfassung geht nicht verloren (localStorage-Draft)
- [x] Fehleingaben lassen sich korrigieren und löschen
- [x] Kennzahlen je Tag: geliefert, verkauft, Retoure, Umsatz, Abverkaufsquote
- [x] Umsatz rechnet mit dem **zum Besuchszeitpunkt gespeicherten** Preis, nicht mit dem aktuellen
- [x] Offene Tage (ohne Abholung) sind in Detail und Report klar als vorläufig markiert
- [x] Report über frei wählbaren Zeitraum, je Produkt und je Tag
- [x] Report als CSV exportierbar und als PDF druckbar
- [x] Produkte kommen aus HQ (`lib/products.ts`), keine Mock-Daten
- [x] Alle Texte auf Deutsch
- [x] Tests für die Berechnungslogik in `partner-stats.service.ts`
- [x] `npm test` und `npm run lint` laufen durch

## Offene Punkte

- **Was passiert mit der Retoure?** Wegwerfen, Personalverkauf, Tafel? Falls das erfasst
  werden soll, braucht `PartnerVisitItem` ein Feld `returnDisposition`. Vorerst weggelassen.
- **Rest über Nacht:** Bleibt Ware über Nacht im Schrank (dann Anfangsbestand am Folgetag)
  oder wird täglich alles abgeholt? Modell trägt beides, die UI muss sich für einen
  Standardfall entscheiden.
- **MwSt:** Report zunächst brutto. Falls CAP eine Abrechnung mit ausgewiesener MwSt (7 %
  auf Backwaren) braucht, kommt ein Steuerfeld dazu.
- **Retouren-Gesamtsicht:** Sollen Partner-Retouren mit den Laden-Retouren aus
  `UnsoldProduct` in einer gemeinsamen Auswertung zusammenlaufen?
- **Gerät des Fahrers:** Mobile-first ist angenommen. Falls im Markt kein Handy genutzt
  werden kann, verschiebt sich der Schwerpunkt auf Papier + Nacherfassung im Büro - die
  Maske deckt beides ab, aber die Priorisierung der UX würde sich ändern.

## Notes

- Produktquelle ist ausschließlich `hq/products/*.md` über `lib/products.ts`. Achtung:
  Das HQ-Verzeichnis fehlt lokal (`/Users/sebastian/develop/bakery/hq/products`), lokal
  greift der Fallback `src/mocks/products` - für Tests unkritisch, beim Rechnen mit echten
  Preisen aber im Blick behalten.
- Bestehende Patterns vor dem Implementieren ansehen: `admin/delivery/page.tsx` (Tabellen,
  Status-Chips, `apiClient`), `admin/cash` (Formulare), `admin/analytics` (Charts).
