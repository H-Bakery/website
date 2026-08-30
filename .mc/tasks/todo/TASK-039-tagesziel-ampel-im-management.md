---
id: TASK-039
title: Tagesziel-Ampel - Break-even als täglicher Messwert im Management
slug: tagesziel-ampel-im-management
status: todo
priority: 2
owner: ''
projects: []
customers: []
tags:
  - management
  - finance
  - analytics
  - kpi
  - dashboard
sprint: ''
depends_on:
  - TASK-038
due_date: ''
created: 2026-08-31
updated: 2026-08-31
---

# Tagesziel-Ampel - Break-even als täglicher Messwert im Management

## Kontext

Aus Kassen- und Bankdaten lässt sich beantworten, wie viel Umsatz nötig ist, damit ein
Monat nicht ins Minus läuft. Diese Zahl existiert bisher nur, wenn jemand sie ausrechnet —
und dann als abstrakter Monatsbetrag, mit dem im Tagesgeschäft niemand etwas anfangen kann.

Ein Monatsbetrag ist der falsche Maßstab für einen Ladentag. Ein **Tagesziel** ist einer:
etwas, das man abends an der Kasse ablesen und einordnen kann.

Erschwerend kommt hinzu, dass die Wochentage weit auseinanderliegen — der stärkste Tag
macht ein Vielfaches des schwächsten. Ein pauschales Tagesziel wäre dadurch an fast jedem
Tag falsch: samstags zu leicht, sonntags unerreichbar. Das Ziel muss **je Wochentag**
skaliert sein.

Ziel dieses Tasks: eine Ampel, die für jeden Geschäftstag zeigt, ob er über oder unter
seinem Wochentagsziel lag — plus die aggregierte Sicht auf Woche und Monat, denn dort
entscheidet sich das Ergebnis tatsächlich.

## Wichtig: die Daten sind nicht live

Die Kassendaten entstehen aus **Tagesabschluss-Exporten** der Registrierkasse und werden
im `hq`-Repo per Skript verarbeitet. Der frischeste verfügbare Tag ist damit im
Regelfall **gestern**, nicht heute.

Die Ampel ist deshalb bewusst **rückblickend**. Sie darf nicht so gestaltet sein, dass sie
Live-Charakter vortäuscht:

- kein „heute" ohne Datenbasis, kein Hochrechnen des laufenden Tages
- immer sichtbar, welcher Tag zuletzt ausgewertet wurde
- der laufende, noch nicht abgeschlossene Tag erscheint als _offen_, nicht als rot

Eine echte Live-Ansicht bräuchte eine andere Datenquelle und ist nicht Teil dieses Tasks.

## Datenschutz

Dieses Repo ist **öffentlich**, `hq` ist **privat**. Die Kostenbasis (Fixkosten,
Kostenquoten, Zielwerte) ist betriebswirtschaftlich sensibel und aus Personalkosten
abgeleitet.

- **Keine konkreten Beträge** in Code, Tests, Fixtures, Kommentaren, Commit-Messages oder
  Screenshots in diesem Repo. Testdaten sind synthetisch und als solche erkennbar.
- Die Parameter leben in `hq` (privat), nicht hier.
- Der Endpunkt liefert Zielwerte nur authentifiziert und rollengeprüft aus.

## Das Modell

Klassische Deckungsbeitragsrechnung. Alle Größen kommen aus `finance-summary.json`
(siehe TASK-038) und den Kassenberichten.

```
variable Kostenquote   = |variable Kosten| / Umsatz
Deckungsbeitragsquote  = 1 − variable Kostenquote

Break-even (Monat)     = Fixkosten / Deckungsbeitragsquote
Kassenziel (Monat)     = Break-even − erwarteter Umsatz außerhalb der Kasse
Tagesziel (Basis)      = Kassenziel / Geschäftstage im Monat
Ziel je Wochentag      = Tagesziel (Basis) × Wochentagsfaktor
```

**Variabel** sind die Kosten, die mit dem Umsatz mitwachsen: Wareneinsatz, Verpackung,
Kartengebühren. **Fix** ist alles andere — vor allem Personal und Energie.

**Umsatz außerhalb der Kasse**: B2B-Rechnungen (Vereine, Einrichtungen, Kommune) kommen
per Überweisung und tauchen in der Kasse nie auf. Sie zählen aufs Break-even ein, dürfen
aber nicht Teil des Kassenziels sein — sonst ist das Tagesziel systematisch zu hoch.

### Wochentagsfaktor

Aus den historischen Tagesumsätzen je Wochentag über ein rollierendes Fenster
(Vorschlag: 12 Monate), normiert auf Mittelwert 1:

```
Faktor(Wochentag) = Ø Umsatz(Wochentag) / Ø Umsatz(alle Geschäftstage)
```

Zu beachten:

- Ruhetage haben keinen Faktor und zählen nicht als Geschäftstage.
- Betriebsferien und geschlossene Feiertage müssen **aus der Berechnung fallen**, sonst
  drücken sie die Faktoren.
- Ein Tag ohne Bericht ist keine Null (siehe TASK-038).
- Die Faktoren sind stabil, aber nicht konstant. Neuberechnung bei jedem Datenimport,
  Anzeige mit Stand-Datum.

### Zwei Zielhöhen

| Stufe                             | Bedeutung                                          |
| --------------------------------- | -------------------------------------------------- |
| **Betriebsergebnis ausgeglichen** | Das Konto sinkt nicht. Untergrenze.                |
| **Inklusive Entnahme**            | Zusätzlich die regelmäßige Privatentnahme gedeckt. |

Beide anzeigen, die zweite als das eigentliche Ziel markieren. Wer nur die erste sieht,
hält eine schwarze Null für Erfolg.

Hinweis: In den Bankdaten sind Überweisungen auf ein Privatkonto derzeit als **neutraler
Geldtransit** klassifiziert, weil aus dem Verwendungszweck nicht hervorgeht, ob es
Privatentnahme oder ein Eigenkonto ist. Solange das ungeklärt ist, muss die zweite Stufe
als **Annahme** gekennzeichnet sein.

## Konfiguration

Die Parameter gehören nach `hq/data/finance/config/targets.json` (privat), nicht in
dieses Repo.

```ts
type TargetConfig = {
  schema_version: 1
  updated: string // YYYY-MM-DD, Stand der Kostenbasis
  mode: 'derived' | 'manual' // aus finance-summary ableiten oder fest vorgeben
  fixed_costs_monthly?: number // nur bei mode 'manual'
  variable_cost_ratio?: number // nur bei mode 'manual', 0..1
  non_pos_revenue_monthly?: number // erwarteter Rechnungsumsatz
  private_draw_monthly?: number // für die zweite Zielstufe
  business_days_per_month: number // oder aus dem Öffnungskalender abgeleitet
  weekday_window_months: number // Fenster für die Wochentagsfaktoren
  thresholds: { green: number; amber: number } // Anteil vom Ziel, z. B. 1.0 / 0.9
  closed_weekdays: number[] // ISO-Wochentage ohne Öffnung
}
```

`mode: 'derived'` ist der Normalfall: Fixkosten und Kostenquote werden aus einem
rollierenden Fenster von `finance-summary.json` berechnet. `manual` ist die Notbremse,
wenn sich die Kostenbasis gerade ändert (Einstellung, Preisrunde) und der Rückblick noch
nicht passt.

**Die Kostenbasis ist nicht stabil.** Ändert sich das Team, verschiebt sich das Ziel
spürbar. Deshalb gehört `updated` in die UI — ein Ziel auf Basis einer ein Jahr alten
Kostenstruktur ist irreführend.

## Umsetzung

### Phase 1 — Berechnung

1. `libs/shared/utils` oder `apps/bakery-api/src/services/targets.service.ts`:
   eine Stelle für die gesamte Rechnung, nicht im Controller und nicht im Frontend.
2. Funktionen: `computeCostBase(summary, window)`, `computeWeekdayFactors(days, window)`,
   `computeTargets(costBase, factors, config)`.
3. Tests mit **synthetischen** Zahlen — insbesondere:
   - Break-even reagiert korrekt auf Änderung der Kostenquote
   - Wochentagsfaktoren normieren auf Mittelwert 1
   - Ferien-/Schließzeiten verzerren die Faktoren nicht
   - Tage ohne Bericht fließen nicht als Null ein
   - fehlende oder unplausible Config führt zu „kein Ziel", nicht zu einem Fantasiewert

### Phase 2 — API

```
GET /api/finance/targets              aktuelle Zielwerte + Wochentagsfaktoren + Stand
GET /api/finance/targets/status?date= Ist/Ziel/Ampel für einen Tag
GET /api/finance/targets/period?from=&to=   Tagesreihe + Wochen-/Monatsaggregat
```

4. Rollenprüfung wie bei den übrigen Finanzendpunkten.
5. Fehlerantworten mit `message` **und** `error` (siehe TASK-038).

### Phase 3 — Oberfläche

6. **Dashboard-Kachel**: letzter ausgewerteter Tag mit Ampel, darunter Woche bis heute und
   Monat bis heute. Die aggregierten Werte optisch gleichwertig oder stärker als der
   Einzeltag — siehe „Fallstricke".
7. **Seite `/admin/finance/tagesziel`**:
   - Zielwerte je Wochentag als Tabelle: Ziel, Ø Ist, Abweichung
   - Tagesverlauf über den gewählten Zeitraum als Balken mit Ziel-Linie und Ampelfarbe
   - Monatssicht: Ist bis heute, Ziel bis heute, Hochrechnung auf Monatsende
   - Kopfzeile mit Stand der Kostenbasis und zuletzt ausgewertetem Tag
   - beide Zielstufen umschaltbar
8. **Ampel-Logik** zentral, nicht je Komponente:
   `grün ≥ thresholds.green`, `gelb ≥ thresholds.amber`, sonst `rot`; `offen` für Tage
   ohne Daten. Farbe **nie allein** als Träger der Information — immer mit Zahl und
   Textlabel, sonst ist die Ampel für farbfehlsichtige Nutzer wertlos.
9. Dark Mode beachten: keine `grey.50/100/300` als Hintergrund, kein `color: 'white'` auf
   `*.main` — die Ampelfarben brauchen in beiden Modi geprüften Kontrast.

## Fallstricke

- **Einzeltage sind Rauschen.** Wetter, Feiertagslage und Zahltage bewegen einen Tag stark.
  Wer auf jeden roten Dienstag reagiert, optimiert Zufall. Deshalb: rollierende 7 Tage und
  Monat bis heute prominent, Einzeltag als Detail.
- **Ferien und Feiertage** dürfen weder rot leuchten noch in die Faktoren einfließen. Ein
  Öffnungskalender ist dafür Voraussetzung — solange er fehlt, müssen Tage ohne Bericht
  als _geschlossen/unbekannt_ behandelt werden.
- **Das Ziel wandert.** Nach Personalveränderungen ist ein Ziel aus alten Daten falsch.
  `updated` sichtbar halten und bei zu altem Stand aktiv warnen.
- **Nicht zum Druckmittel machen.** Der Messwert soll Orientierung geben. Eine Ampel, die
  vor allem als Bewertung des Verkaufspersonals gelesen wird, verändert eher das
  Buchungsverhalten an der Kasse als den Umsatz.
- **Umsatz ist nur eine Seite.** Ein Euro weniger Wareneinsatz wirkt stärker als ein Euro
  mehr Umsatz. Die Seite sollte auch die Kostenquote zeigen, nicht nur die Ziellinie.

## Akzeptanzkriterien

- [ ] Zielwerte werden aus `finance-summary.json` abgeleitet (`mode: 'derived'`)
- [ ] `mode: 'manual'` überschreibt die Ableitung vollständig
- [ ] Wochentagsfaktoren aus rollierendem Fenster, normiert auf Mittelwert 1
- [ ] Ruhetage, Ferien und Tage ohne Bericht verzerren die Faktoren nicht
- [ ] Beide Zielstufen abrufbar, die Entnahme-Stufe als Annahme gekennzeichnet
- [ ] Ampel je Tag mit den Zuständen grün / gelb / rot / offen
- [ ] Farbe nie alleiniger Informationsträger — Zahl und Textlabel immer vorhanden
- [ ] Kontrast in Light und Dark Mode geprüft
- [ ] Woche bis heute und Monat bis heute inkl. Hochrechnung
- [ ] Zuletzt ausgewerteter Tag und Stand der Kostenbasis sichtbar
- [ ] Laufender Tag wird als offen dargestellt, nicht als rot
- [ ] Fehlende Konfiguration führt zu „kein Ziel verfügbar", nicht zu einem geschätzten Wert
- [ ] Endpunkte auth- und rollengeschützt
- [ ] Keine echten Beträge in Code, Tests oder Fixtures dieses Repos
- [ ] Berechnungslogik ist getestet und liegt an genau einer Stelle
- [ ] Alle Texte auf Deutsch
- [ ] `npm test` und `npm run lint` laufen durch

## Offene Punkte

- **Öffnungskalender.** Es gibt keine gepflegte Liste von Ruhetagen, Feiertagen und
  Betriebsferien. Ohne sie muss aus fehlenden Berichten geraten werden. Eigener Task?
- **Geldtransit klären.** Ob die Überweisungen aufs Privatkonto Privatentnahme sind,
  entscheidet über die zweite Zielstufe. Fachliche Klärung nötig, keine technische.
- **Monatsziel oder Jahresziel?** Ein Monat mit Betriebsferien kann das Ziel nicht
  erreichen. Soll das Jahresziel auf die geöffneten Monate umgelegt werden?
- **Saisonalität.** Wochentagsfaktoren fangen die Woche ab, nicht das Jahr. Ob zusätzlich
  ein Monatsfaktor nötig ist, zeigt sich erst mit mehr Historie.
- **Zielwert pro Bon oder pro Kunde?** Umsatz lässt sich über Frequenz oder Bonhöhe
  steigern. Eine Aufteilung der Ampel in „genug Kunden" und „genug pro Kunde" wäre
  operativ hilfreicher, braucht aber ein zweites Ziel.
- **Wer sieht das?** Nur die Betriebsleitung oder auch das Verkaufsteam? Das ist keine
  Rechte-, sondern eine Führungsfrage und sollte vor dem Bau entschieden sein.

## Notes

- Rechenweg und Datengrundlage sind in `hq/data/finance/README.md` beschrieben.
  Entscheidende Einschränkung, die auch in der UI stehen sollte: es ist eine
  **Cashflow-Sicht nach Buchungsdatum, keine GuV**. Abschreibungen, Rückstellungen und
  Rücklagen für Ersatzinvestitionen fehlen — das tatsächliche „Plus" liegt über der hier
  berechneten Linie.
- Die Zahlungsströme sind ungleichmäßig verteilt (Abschläge, Nachzahlungen,
  Quartalsbeiträge). Für die Kostenbasis deshalb ein Fenster von mindestens zwölf Monaten
  verwenden, nie einzelne Monate hochrechnen.
- Für Chart- und Kachel-Muster: `admin/analytics`. Für Tabellen und Status-Chips:
  `admin/delivery`.
