---
id: TASK-042
title: Dienstplan und Urlaubsplanung mit Mitarbeiterprofilen (Verwaltung, nur Inhaber)
slug: dienstplan-urlaub-mitarbeiterprofile
status: done
priority: 2
owner: ''
projects: []
customers: []
tags:
  - management
  - api
  - feature
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-08
updated: 2026-11-08
---

# Dienstplan und Urlaubsplanung mit Mitarbeiterprofilen

Arbeitsdokument (vorläufig). Roadmap: Kandidat „Dienstplan“ in M5 (`docs/roadmap.md` §6, Ziel 3);
laut D11 nicht Teil des Pilots, deshalb im Pilotbetrieb ausgeblendet (siehe unten).

## Ziel

Ein Kalender in der Verwaltung, in dem der Inhaber sieht und pflegt:

- **wer im Verkauf wann arbeitet** (Schichten),
- **wer abwesend ist** - alle Mitarbeitenden, auch Backstube und Fahrer: Urlaub (geplant und
  genehmigt), frei, krank/abwesend,
- **wie viele Urlaubstage** jede Person hat, verplant hat und noch übrig hat.

Ansichten **Woche (Standard)**, Monat, Jahr. Jede Person bekommt ein **Profil**. Vorerst trägt
nur der Inhaber ein; Mitarbeitende sehen noch nichts (später: eigene Ansicht, Urlaubsantrag).

## Ausgangslage (Research 2026-11-08)

- `/admin/staff` („Personal“) existiert, ist aber Vor-Pilot-Code: liest über den Mock
  `bakeryAPI.getStaff()` (TASK-019 abgebrochen, „Backend broken“). Im Pilotbetrieb ausgeblendet.
  → wird durch die neue Seite ersetzt, nicht repariert.
- `User` (`apps/bakery-api/src/models/User.ts`) ist ein **Login**: username, displayName, Rolle
  (`inhaber|verkauf|backstube|fahrer`), Passwort, PIN. Nicht jede Person hat einen Login (Backstube
  nutzt oft die Station). → Ein **Mitarbeiter** ist eine eigene Entität mit optionalem Verweis auf
  einen `User`.
- `@fullcalendar/*` steht in `package.json`, wird aber nirgends benutzt. **`resource-timegrid`
  ist ein Premium-Plugin** (kommerzielle Lizenz nötig). → Kein FullCalendar; eigene MUI-Ansichten
  mit `date-fns` (schon da). Ungenutzte `@fullcalendar/*`-Pakete können im selben PR raus.
- Ruhetag ist **Montag** (`hq/notes/procedures/backliste.md`). Standort Saarland → Feiertage
  Saarland (inkl. Fronleichnam, Mariä Himmelfahrt, Allerheiligen).
- D13: Personendaten kommen **nie** nach `hq`. Mitarbeiter, Schichten und Abwesenheiten liegen
  in der SQLite-DB der Box (Backup läuft schon mit). Repo öffentlich → Seeds, Tests, Screenshots
  nur mit erfundenen Personen.
- Letzte Migration auf `main`: `20270106000000-rest-count-line-rows.js` → neue Migration muss
  danach sortieren und in `src/db/migrations.ts` eingetragen werden.

## Fachmodell (Vorschlag - in der Umsetzung bestätigen)

**Mitarbeiter** (`employees`)

- Anzeigename, Bereich (`verkauf|backstube|fahrer|buero`), Farbe für den Kalender, aktiv/ausgeschieden
- Beschäftigung: Art (Vollzeit/Teilzeit/Minijob/Aushilfe), Wochenstunden (Soll), Arbeitstage pro Woche
- Urlaub: Jahresanspruch in Tagen, Übertrag aus dem Vorjahr (manuell), Eintritts-/Austrittsdatum
- optional: `userId` (Login), Notiz (nur Inhaber)
- **keine** Adresse, IBAN, Steuer-ID, Gesundheitsdaten - gehört in die Lohnbuchhaltung, nicht hierher

**Schicht** (`shifts`): Mitarbeiter, Datum, Beginn, Ende, Pause (min), Notiz.
Optional Schichtvorlagen (z. B. „Früh 6-12“, „Spät 12-18“) zum schnellen Eintragen.

**Abwesenheit** (`absences`): Mitarbeiter, von-bis (ganze Tage, optional halber Tag), Art
(`urlaub|frei|krank|sonstiges`), Status (`geplant|genehmigt`), Notiz. Bei `krank` **keine**
Diagnose o. Ä. speichern.

**Urlaubstage-Rechnung** - genau einmal, in `apps/bakery-api/src/services/vacation.core.js`
(abhängigkeitsfrei, CommonJS, von API, Verwaltung und Tests genutzt):

- zählt Arbeitstage der Person im Zeitraum: ohne Ruhetag, ohne Feiertage Saarland, nur ihre
  Arbeitstage (Wochentage aus dem Profil), Halbtage = 0,5
- Saldo je Jahr: Anspruch (anteilig bei Ein-/Austritt im Jahr) + Übertrag − genehmigt − geplant
  (geplant getrennt ausweisen)
- Feiertage Saarland ebenfalls dort berechnet (Ostern-basiert), kein externer Dienst

## Oberfläche (Verwaltung, nur `inhaber`)

- **`/admin/dienstplan`** - Kalender
  - **Woche (Standard):** Zeilen = Mitarbeitende, gruppiert nach Bereich (Verkauf zuerst), Spalten
    = Mo-So. Zelle zeigt Schicht(en) mit Uhrzeit oder einen Abwesenheitsbalken (Urlaub/frei/krank,
    geplant gestrichelt). Ruhetag und Feiertage grau hinterlegt mit Namen. Kopfzeile je Tag:
    „Verkauf besetzt: n“ als schneller Lückencheck.
  - **Monat:** dieselbe Zeilenlogik, Tage als schmale Spalten (Gantt-artig), nur Abwesenheiten +
    Schicht-Punkte.
  - **Jahr:** pro Person eine Zeile mit 12 Monaten, Urlaub als Balken; daneben Saldo.
  - Navigation: zurück/heute/vor, Ansichtswechsel, Filter nach Bereich. Klick auf leere Zelle →
    Schicht oder Abwesenheit anlegen; Klick auf Eintrag → bearbeiten/löschen.
  - Mobil/Tablet bedienbar (Woche auf schmalem Bildschirm: ein Tag pro Seite oder horizontal scrollbar).
- **`/admin/staff`** - Mitarbeiterliste (ersetzt die Mock-Seite) → **`/admin/staff/[id]`** Profil:
  Stammdaten, Urlaubskonto des Jahres (Anspruch, Übertrag, genommen, geplant, Rest), Liste der
  Abwesenheiten, kommende Schichten.
- Dark-Mode-Regeln aus `CLAUDE.md` beachten (Text auf `*.main` → `*.contrastText`, keine `grey.*`
  Hintergründe). Alle Texte Deutsch.

## API

- `GET/POST/PATCH /api/employees`, `GET /api/employees/:id` (Profil inkl. Urlaubskonto)
- `GET /api/shifts?from&to`, `POST/PATCH/DELETE /api/shifts/:id`
- `GET /api/absences?from&to[&employeeId]`, `POST/PATCH/DELETE /api/absences/:id`
- `GET /api/vacation/balance?year[&employeeId]`
- alles `requireRole('inhaber')`; Fehler mit `message` (Deutsch) + `error` (Code); Validierung:
  Ende nach Beginn, keine überlappenden Schichten derselben Person, Abwesenheit innerhalb
  Beschäftigungszeit. Überschneidung Schicht ↔ Abwesenheit: Warnung im UI, kein harter Fehler.
- Audit über das bestehende `AuditLog`.

## Pilotbetrieb und Rollen

- Route in `ROLE_ACCESS` (`src/lib/roles.ts`) nur für `inhaber`.
- **Nicht** in `PILOT_ALLOWED_ROUTES` (`src/lib/pilotMode.ts`) - auf der Box (`NEXT_PUBLIC_PILOT_MODE=1`)
  bleibt es unsichtbar, bis der Inhaber es freigibt. Freischalten = eine Zeile + Deploy.

## Abgrenzung (nicht in diesem Task)

- Mitarbeitende sehen ihren Plan / stellen Urlaubsanträge (spätere Stufe; Modell schon mit
  `status` vorbereitet)
- Zeiterfassung (Ist-Stunden), Lohn, Export an die Lohnbuchhaltung
- automatische Planerstellung, Benachrichtigungen (Telegram)
- Import echter Mitarbeiterdaten - trägt der Inhaber in der App ein

## Offene Fragen an den Inhaber

1. Feste Schichtzeiten im Verkauf (z. B. Früh/Spät) oder frei je Tag?
2. Urlaub in Arbeitstagen oder Kalendertagen? Halbe Tage nötig?
3. Soll „krank“ überhaupt erfasst werden, oder nur „abwesend“?
4. Zählt der Samstag als Arbeitstag für den Urlaub (Teilzeit/Minijob unterschiedlich)?
5. Urlaubsübertrag: bis wann verfällt Resturlaub (gesetzlich 31.03.)?

## Entscheidungen (2026-11-08, Inhaber + Code-Review) - gelten vor dem Vorschlag oben

Antworten des Inhabers:

1. Schichten: **Vorlagen + frei** - Schichtvorlagen (z. B. „Früh 6-12“) zum schnellen Eintragen,
   Zeiten je Schicht änderbar.
2. Schichten **nur für den Verkauf** (API lehnt Schichten für andere Bereiche ab). Backstube/Fahrer/
   Büro nur mit Abwesenheiten. Keine Schichten über Mitternacht (Ende > Beginn am selben Tag).
3. Urlaub in **Arbeitstagen, Halbtage möglich** (halber Tag = 0,5).
4. **Kein „krank“**: Abwesenheitsarten `urlaub|frei|abwesend` - neutral, kein Gesundheitsdatum.
5. Übertrag verfällt am **31.03. des Folgejahres**: Urlaub bis 31.03. verbraucht zuerst den Übertrag;
   was am 31.03. vom Übertrag übrig ist, wird im Konto als „verfallen“ ausgewiesen.
6. **Samstag zählt immer**: Urlaubstage = alle Öffnungstage im Zeitraum, für alle gleich
   (6-Tage-Woche), unabhängig vom Profil. Öffnungstage = nicht Ruhetag (`closed_weekdays` aus der
   Finanz-Config wie in `targets.core.js`, nur wenn dort nichts steht: Montag) und kein Feiertag.
   → Kein Feld „Arbeitstage pro Woche“ im Profil nötig.
7. **Feiertage Saarland: geschlossen** - zählen nie als Urlaubstag, im Kalender als geschlossen.
8. **24.12. und 31.12. zählen als halbe Tage** (0,5), sofern Öffnungstag; ein Halbtag-Eintrag dort
   bleibt 0,5.

Änderungen aus dem Code-Review:

- `/admin/staff` existiert seit B12 nicht mehr - nichts zu ersetzen. Routen:
  `/admin/dienstplan` (Kalender), `/admin/dienstplan/mitarbeiter` (Liste),
  `/admin/dienstplan/mitarbeiter/[id]` (Profil).
- Pilot: alle Seiten in `PILOT_HIDDEN_ROUTES`, **nicht** in `PILOT_ALLOWED_ROUTES`.
  `ROLE_ACCESS` braucht keinen Eintrag (inhaber = all), aber `/admin/dienstplan` in
  `PERSONAL_ONLY_ROUTES` (nicht an der PIN-Station) und API mit `requirePersonalSession`.
- Ein Router **`/api/dienstplan`** (`/employees`, `/shifts`, `/shift-templates`, `/absences`,
  `/balance`) plus Sammel-Endpunkt `GET /api/dienstplan?from&to` mit Mitarbeitern, Schichten,
  Abwesenheiten und `days[]` (Feiertagsname, Ruhetag, Gewicht 1/0,5/0, „Verkauf besetzt“). Der
  Browser rechnet keine Feiertage/Salden selbst.
- Anspruch je Jahr in einer eigenen Tabelle (Mitarbeiter, Jahr, Anspruch, Übertrag), damit spätere
  Änderungen alte Jahre nicht umschreiben. Fehlt der Anspruch → Konto `status: 'no-config'` / „offen“,
  nie 0. Anteilig bei Ein-/Austritt: 1/12 je vollem Monat, Rundung nach §5 Abs. 2 BUrlG.
- `employees.displayName` ist maßgeblich; `userId` nur optionaler Verweis. Keine Telefonnummer.
- Mitarbeiter werden deaktiviert, nie gelöscht. Audit-`data` ohne Notizen.
- Migration `20270107000000-dienstplan.js` (Muster `20261201000000-rest-am-abend.js`), in
  `migrations.ts` + `tests/migrations/pilotBaseline.test.ts` + `PILOT_MODELS` eintragen.
- Seed über die echte API in `.claude/skills/setup-dev/scripts/lib/seed-next.mjs`, erfundene Namen.
- `@fullcalendar/*` **und** `date-fns` entfernen, falls weiterhin ungenutzt.

## Fertig, wenn

- [x] Migration + Modelle + Routen, Tests (inkl. `vacation.core.js` mit Feiertagen, Ruhetag, Halbtagen,
      Ein-/Austritt im Jahr) - Migration heißt `20270301000000-dienstplan.js` (sortiert nach den
      Migrationen von `main`)
- [x] Woche/Monat/Jahr in der Verwaltung, Woche ist Standard; Profil-Seite mit Urlaubskonto
- [x] kein altes `/admin/staff` zu ersetzen (seit B12 gelöscht); die Seiten liegen unter
      `/admin/dienstplan`, `/admin/dienstplan/mitarbeiter` und `/admin/dienstplan/mitarbeiter/[id]`;
      `@fullcalendar/*` und `date-fns` entfernt
- [x] Synthetischer Seed für lokale Entwicklung (`setup-dev`), keine echten Namen
- [x] `docs/domains/dienstplan.md` (Deutsch) + `docs/api/` ergänzt, `docs/README.md` verlinkt,
      Roadmap-M5-Zeile verweist auf diesen Task
- [x] type-check, lint, format, `nx test bakery-api`, `nx test bakery-management` grün
- [x] Build grün (`bakery-api`, `bakery-management` mit webpack, voll und Pilotbetrieb);
      Smoke-Test mit `setup-dev` (synthetischer Seed): API, Woche/Monat/Jahr, Liste und Profil
      für den Inhaber; PIN-Station und Verkauf bekommen 403; im Pilotbetrieb gesperrt und nicht
      im Menü
- [ ] PR auf `main` (Branch `feat/dienstplan`, noch nicht gepusht)
