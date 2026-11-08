# Dienstplan und Urlaub (M5-Kandidat, nach dem Pilot)

Der Inhaber plant in der Verwaltung, **wer im Verkauf wann arbeitet** (Schichten), **wer abwesend
ist** (alle Bereiche: Urlaub, frei, abwesend) und führt je Person und Jahr ein **Urlaubskonto**.
Mitarbeitende sehen noch nichts (später: eigene Ansicht, Urlaubsantrag). Laut D11 nicht Teil des
Pilots - im Pilotbetrieb ausgeblendet.

**Code:** Rechnung `apps/bakery-api/src/services/vacation.core.js` · DB, Prüfung, Transaktion,
Audit `dienstplan.service.ts` · Routen `src/routes/dienstplan.routes.ts` (`/api/dienstplan`) ·
Management-App `src/lib/dienstplanApi.ts`, `src/lib/dienstplanCalendar.ts`,
`src/app/admin/dienstplan/` (Kalender: `DienstplanClient.tsx`, `MonthView.tsx`, `YearView.tsx`;
Vorlagen: `ShiftTemplatesDialog.tsx`; Liste und Profil unter `mitarbeiter/`). API-Details (Endpunkte, Fehlercodes, Tabellen):
[`docs/api/dienstplan.md`](../api/dienstplan.md). Task und Entscheidungen des Inhabers:
`.mc/tasks/todo/TASK-042-dienstplan-urlaub-mitarbeiterprofile.md`.

## Zugriff und Pilot

- **Nur `inhaber` mit persönlicher Sitzung** - nicht über eine PIN an der Station
  (`PERSONAL_ONLY_ROUTES` in `src/lib/roles.ts`; die API prüft `requireRole('inhaber')` und
  `requirePersonalSession`). Andere Rollen bekommen 403.
- **Im Pilotbetrieb unsichtbar:** die drei Seiten stehen in `PILOT_HIDDEN_ROUTES` und **nicht** in
  `PILOT_ALLOWED_ROUTES` (`src/lib/pilotMode.ts`). Freischalten = eine Zeile + Deploy.
- **Personendaten bleiben in der SQLite der Box** (D13), nie in `hq`. Keine Telefonnummer, Adresse,
  Bankdaten, Steuer-ID oder Gesundheitsangaben - es gibt kein „krank“, nur das neutrale
  „abwesend“. Repo, Tests und Seed nutzen erfundene Personen.

## Regeln

- **Die Rechnung steht genau einmal**, in `vacation.core.js`: Feiertage Saarland (aus Ostern
  gerechnet), Ruhetag, Tagesgewicht, Urlaubstage, anteiliger Anspruch, Konto, „Verkauf besetzt“.
  Die Verwaltung rechnet nichts davon selbst - sie zeigt `days[]`, `days`/`daysInYear` und das
  Konto aus der API.
- **Urlaub zählt in Öffnungstagen**, für alle gleich (6-Tage-Woche, Samstag zählt immer): jeder
  Tag, der kein Ruhetag (`closed_weekdays` aus der Finanz-Config, sonst Montag) und kein Feiertag
  ist, zählt 1. **24.12. und 31.12. zählen 0,5.** Ein Halbtag-Eintrag zählt höchstens 0,5.
- **Nur Urlaub kostet Urlaubstage**; „frei“ und „abwesend“ stehen im Kalender, aber nicht auf dem
  Konto.
- **Anspruch je Jahr** in einer eigenen Zeile (Anspruch, Übertrag). **Fehlt er, ist das Konto
  „offen“** (`status: 'no-config'`, Rest `null`) - nie 0. Genommen und geplant stehen trotzdem da.
  Bei Ein- oder Austritt im Jahr anteilig: 1/12 je vollem Beschäftigungsmonat, Rundung nach § 5
  Abs. 2 BUrlG (ab einem halben Tag aufrunden, nie abrunden).
- **Übertrag verfällt am 31.03.**: genehmigter Urlaub bis dahin verbraucht zuerst den Übertrag;
  was danach übrig ist, steht als „verfallen“ im Konto.
- **Urlaub über den Jahreswechsel** zählt in jedem Jahr nur seinen Teil. Das Profil zeigt in der
  Spalte „Urlaubstage“ den Anteil im gezeigten Jahr (`daysInYear`, so wie das Konto ihn zählt) und
  darunter „von insgesamt n“, wenn die Abwesenheit ins Nachbarjahr reicht.
- **Schichten nur im Verkauf**, nur für aktive Personen, innerhalb der Beschäftigung, am selben Tag
  (keine Schicht über Mitternacht), keine Überschneidung derselben Person. Schichtvorlagen (z. B.
  „Früh 6-12“) füllen die Zeiten vor; sie bleiben je Schicht änderbar. Gepflegt werden die
  Vorlagen über „Schichtvorlagen“ im Kopf des Kalenders (anlegen, ändern, löschen); ändern oder
  löschen ändert keine bestehenden Schichten. Die Migration legt keine Vorlagen an.
- **Abwesenheiten** liegen ganz in der Beschäftigung und überschneiden sich nicht. Schicht an einem
  Abwesenheitstag oder an einem geschlossenen Tag ist **ein Hinweis, kein Fehler**.
- **Mitarbeiter werden deaktiviert, nie gelöscht.** Der Anzeigename ist maßgeblich; der Login ist
  nur ein optionaler Verweis. Konnten die Logins nicht geladen werden, ist das Feld gesperrt und
  sagt es - die Verknüpfung bleibt dann unverändert.

## Oberfläche

- **`/admin/dienstplan` - Kalender**, Ansicht, Zeitraum und Bereich stehen in der URL
  (`?woche=JJJJ-MM-TT`, `?ansicht=monat&monat=JJJJ-MM`, `?ansicht=jahr&jahr=JJJJ`, `&bereich=`).
  Beim Ansichtswechsel bleibt man im Zeitraum (mit heute, sonst nach dem Donnerstag der Woche wie
  bei der Kalenderwoche). Die Woche wechselt per Pfeil oder Datumsfeld, Monat und Jahr per Pfeil
  und „Heute“ (zwischen den Pfeilen steht der Zeitraum, kein Datum).
  - **Woche (Standard):** Zeilen = Mitarbeitende nach Bereich (Verkauf zuerst), Spalten Mo-So.
    Schichten mit Uhrzeit, Abwesenheiten als Balken (genehmigt gefüllt, geplant gestrichelt).
    Ruhetag und Feiertag sind hinterlegt und benannt; offene Tage zeigen „Verkauf besetzt: n“, eine
    Woche ganz ohne Schichten „nichts geplant“ statt 0. Leere Zelle antippen → Schicht oder
    Abwesenheit anlegen; Eintrag antippen → bearbeiten oder löschen.
  - **Monat:** Tage als schmale Spalten. Abwesenheit als Fläche mit Kürzel (U/F/A, geplant
    gestrichelt), Schicht als Punkt in der Farbe der Person, geschlossene Tage hinterlegt (Name im
    Tooltip). Tag antippen → die Woche dieses Tages; bearbeitet wird dort.
  - **Jahr:** je Person zwölf Monate mit den Abwesenheiten als Balken an ihrer Stelle im Monat,
    daneben das Urlaubskonto des Jahres (Rest, genommen, geplant; ohne Anspruch „offen“). Monat
    antippen → Monatsansicht. Konnte das Konto nicht geladen werden, steht „nicht geladen“ da.
  - Farbe ist nie der einzige Träger: Kürzel, Text und eine Legende stehen dabei.
- **`/admin/dienstplan/mitarbeiter` - Liste** (aktiv / ausgeschieden / alle), Mitarbeiter anlegen.
- **`/admin/dienstplan/mitarbeiter/[id]` - Profil:** Stammdaten, Urlaubskonto des Jahres
  (Anspruch, Übertrag, genommen, geplant, verfallen, Rest), Anspruch je Jahr, Abwesenheiten des
  Jahres, kommende Schichten.
- **Handy und Tablet:** die Raster scrollen waagrecht, die Namensspalte bleibt stehen. Alle eigenen
  klickbaren Flächen (Einträge der Woche, Tageszellen im Monat, Monatsköpfe im Jahr, Farbfelder,
  Vorlagen-Chips im Schichtdialog) sind auf Touch-Geräten mindestens 44 px groß (`TOUCH_MEDIA`).
  Leere Zellen der Woche zeigen dort das „+“ immer (gedämpft) - Touch kennt kein Hover.

## Tests

API: `tests/unit/vacationCore.test.js`, `tests/integration/dienstplan.test.ts`. Verwaltung:
`src/lib/dienstplanCalendar.spec.ts`, `src/lib/dienstplanApi.spec.ts`,
`src/app/admin/dienstplan/**/*.spec.tsx`. Lokaler Seed mit erfundenen Personen:
`seedDienstplan` in `.claude/skills/setup-dev/scripts/lib/seed-next.mjs`.
