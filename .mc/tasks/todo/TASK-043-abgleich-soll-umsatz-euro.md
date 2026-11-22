---
id: TASK-043
title: Abgleich in Euro - Soll-Umsatz aus der Produktion gegen die Kasse
slug: abgleich-soll-umsatz-euro
status: todo
priority: 2
owner: ''
projects: []
customers: []
tags:
  - abgleich
  - backzettel
  - kasse
  - management
  - api
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-22
---

# Abgleich in Euro - Soll-Umsatz aus der Produktion gegen die Kasse

## Kontext

Der Abgleich (`/admin/abgleich`, [`docs/domains/abgleich.md`](../../../docs/domains/abgleich.md))
vergleicht heute nur **Stück**: gebacken − CAP − verkauft − Rest. Der Inhaber fragt aber: „Was
hätten wir verdienen sollen?“ Am 22.11.2026 wurde das für ein Wochenende von Hand gerechnet
(Backzettel + Nachricht der Backstube × Ladenpreis, gegen die Kassenberichte Sa + So). Die
Rechnung lieferte ein klares Bild je Abschnitt (Brötchen passen, Kuchen/Brot/Croissants mit
großer Lücke) - genau das soll die App selbst zeigen, statt dass es jemand von Hand nachrechnet.
Die echten Zahlen stehen nur in `hq`, nicht hier.

## Ziel

Je Backtag und je Abschnitt (Brötchen, Brot, Kaffeestückchen, Kuchen, …) zusätzlich zu den Stück:

| Abschnitt | Soll € | Ist € (Kasse) | Differenz € |
| --------- | -----: | ------------: | ----------: |
| Beispiel  | 100,00 |         80,00 |      −20,00 |

**Soll € = (gebacken − CAP − anders bezahlte Vorbestellungen) × Ladenpreis.**

## Regeln, die aus der Handrechnung folgen (vorläufig, Inhaber bestätigt im Review)

1. **Preis:** Ladenpreis des Produkts aus hq (`products/*.md`). Fehlt er, der Durchschnittspreis
   der Kassennummer im Bericht; sonst „Preis offen“ - nie 0 €.
2. **CAP** verlässt den Laden zum Partnerpreis: aus dem Soll heraus (wie bei den Stück).
3. **Vorbestellungen, die nicht an der Kasse bezahlt werden** (z. B. per Überweisung, Feier eines
   Vereins): aus dem Soll heraus. Dafür braucht die Vorbestellung ein Merkmal „bezahlt per
   Überweisung / Rechnung“ - prüfen, ob `payment` das schon hergibt; sonst ergänzen.
4. **Ware vom Vortag:** Kuchen vom Samstag wird am Sonntag noch verkauft. Option „Folgetag
   einrechnen“ je Abschnitt (Vorgabe: Kuchen und Brot an, Brötchen aus), sonst steht der Kuchen
   am Samstag als Lücke und am Sonntag als „mehr verkauft“.
5. **Sammel-Kassennummern** („Brötchen, sonstige“, „Kuchen, sonstige“ …) lassen sich keinem
   Posten zuordnen. Im Euro-Vergleich zählen sie zum **Abschnitt** (über `group_name` / die
   Hunderter der Kassennummer), damit die Abschnittssumme stimmt; je Posten bleiben sie
   ausgewiesen als „nicht zuordenbar“. Anteil der Sammel-Nummern am Umsatz oben anzeigen - er
   sagt, wie belastbar der Vergleich ist.
6. **Nicht gebacken, aber verkauft** (Zukauf: Brezeln, Laugen, Getränke, Zeitungen): nicht im
   Soll, im Ist getrennt („Handelsware“), nicht in der Differenz.
7. **Sonntag:** gilt der Backtag (die Sonntagsweck werden am Samstag als Teig angesetzt, aber
   sonntags gebacken und verkauft) - das macht die Backliste schon richtig, nicht den Teigtag
   nehmen.
8. **Gebacken** wie heute: freigegebener Backzettel + quittierte Nachträge, sonst „geplant – nicht
   freigegeben“. Später: die Haken „gebacken“ der Backliste bzw. die Tagesmeldung der Backstube.
9. Kein Rest gezählt → Differenz heißt „nicht verkauft oder nicht kassiert“, wie bei den Stück.

## Umsetzung (Vorschlag)

- Rechnung in `abgleich.core.js` erweitern (eine Stelle, keine zweite Implementierung): je Posten
  `sollEur`, `istEur`, je Abschnitt Summen + `sammelEur`, `handelswareEur`, `preisOffen[]`.
- API `/api/abgleich` additiv erweitern (bestehende Felder unverändert), `docs/api/abgleich.md`.
- UI: Umschalter „Stück | Euro“ auf `/admin/abgleich`, Abschnittstabelle wie oben, nur Inhaber.
- Tests mit synthetischen Daten (keine echten Beträge): Sammel-Nummern, Folgetag, CAP,
  Überweisungs-Vorbestellung, Preis offen.

## Abnahme

- Für ein synthetisches Wochenende (Sa + So) stimmen Soll/Ist/Differenz je Abschnitt mit einer
  Handrechnung überein.
- Der Inhaber prüft einmal gegen ein echtes Wochenende aus `hq` (lokal, nicht im Repo).
