# Dienstplan und Urlaub (M5-Kandidat, im Pilot für den Inhaber freigegeben)

Der Inhaber plant in der Verwaltung, **wer wann arbeitet** (Schichten, alle Bereiche), **wer
abwesend ist** (Urlaub, frei, abwesend), sieht **wann der Laden offen ist und wer dann im Verkauf
steht** (Besetzung), die **geplanten Stunden** je Person neben dem Soll mit einer **geschätzten
Überstundenbezahlung** und **Lohnkosten** (Stundenlohn), der **Minijob-Grenze** und führt je
Person und Jahr ein **Urlaubskonto**.
Mitarbeitende sehen noch nichts (später: eigene Ansicht, Urlaubsantrag). Ursprünglich laut D11
nicht Teil des Pilots; jetzt im Pilot für den Inhaber freigegeben (Entscheidung 2026-11-08).

**Code:** Rechnung `apps/bakery-api/src/services/vacation.core.js`, Öffnungszeiten
`opening-hours.core.js` · DB, Prüfung, Transaktion,
Audit `dienstplan.service.ts` · Routen `src/routes/dienstplan.routes.ts` (`/api/dienstplan`) ·
Management-App `src/lib/dienstplanApi.ts`, `src/lib/dienstplanCalendar.ts`,
`src/app/admin/dienstplan/` (Kalender: `DienstplanClient.tsx`, `MonthView.tsx`, `YearView.tsx`;
Vorlagen: `ShiftTemplatesDialog.tsx`; Liste und Profil unter `mitarbeiter/`). API-Details (Endpunkte, Fehlercodes, Tabellen):
[`docs/api/dienstplan.md`](../api/dienstplan.md). Task und Entscheidungen des Inhabers:
`.mc/tasks/done/TASK-042-dienstplan-urlaub-mitarbeiterprofile.md`.

## Zugriff und Pilot

- **Nur `inhaber` mit persönlicher Sitzung** - nicht über eine PIN an der Station
  (`PERSONAL_ONLY_ROUTES` in `src/lib/roles.ts`; die API prüft `requireRole('inhaber')` und
  `requirePersonalSession`). Andere Rollen bekommen 403.
- **Im Pilot für den Inhaber freigegeben (Entscheidung 2026-11-08):** `/admin/dienstplan` steht in
  `PILOT_ALLOWED_ROUTES` (`src/lib/pilotMode.ts`) und deckt die drei Seiten ab (Kalender,
  Mitarbeiterliste, Profil). Auf der Box (`NEXT_PUBLIC_PILOT_MODE=1`) sieht nur der Inhaber mit
  persönlicher Sitzung den Menüpunkt „Dienstplan“; Verkauf, Backstube und Fahrer nicht (Rolle),
  der Inhaber an der PIN-Station auch nicht (`PERSONAL_ONLY_ROUTES`).
- **Personendaten bleiben in der SQLite der Box** (D13), nie in `hq`. Keine Telefonnummer, Adresse,
  Bankdaten, Steuer-ID oder Gesundheitsangaben - es gibt kein „krank“, nur das neutrale
  „abwesend“. Repo, Tests und Seed nutzen erfundene Personen.

## Regeln

- **Die Rechnung steht genau einmal**, in `vacation.core.js`: Feiertage Saarland (aus Ostern
  gerechnet), Ruhetag, Tagesgewicht, Öffnungszeit des Tages, Urlaubstage, anteiliger Anspruch,
  Konto, „Verkauf besetzt“, Besetzung über die Öffnungszeit, Plan- und Soll-Stunden. Die
  Verwaltung rechnet nichts davon selbst - sie zeigt `days[]`, `hours[]`, `days`/`daysInYear`
  und das Konto aus der API.
- **Öffnungszeiten stehen einmal**, in `opening-hours.core.js`: Mo Ruhetag, Di-Fr 05:30-13:30,
  Sa 05:30-12:30, So 08:00-11:00 (24./31.12. mit den Zeiten ihres Wochentags). Ob ein Tag offen
  ist, entscheiden weiter Ruhetag (`closed_weekdays`, sonst Montag) und Feiertage; ein offener Tag
  bekommt die Zeiten seines Wochentags. Öffnet die Finanz-Config einen Wochentag, für den die
  Tabelle keine Zeiten hat, steht „Öffnungszeit nicht hinterlegt“ und die alte Zählung
  „Verkauf besetzt: n“. Die Landing-Page (statischer Export) hat eine eigene Tabelle
  (`apps/bakery-landing/src/config/openingHours.ts`); `openingHours.spec.ts` daneben fällt um,
  wenn die beiden nicht übereinstimmen, ein Unit-Test, wenn der Ruhetag der Tabelle nicht der
  Standard-Ruhetag ist. Zeiten ändern = beide Dateien.
- **Ob ein Tag offen ist, sagt der Kalender der Bäckerei (Z14)** - derselbe wie bei Backzettel
  und Rest am Abend (`kalender.core.js` `dayKind`, hq `config/kalender.yaml`, siehe
  [backzettel.md](backzettel.md) „Kalender“). `dayInfo` fragt ihn mit den Öffnungstagen des
  Dienstplans als Wochenplan und liefert je Tag `kind` (`normal`, `ruhetag`, `geschlossen`,
  `wie-sonntag`, `sonderoeffnung`, `teigtag`), `kindLabel`, `kindDetail` und `calendar`:
  - **Schließtag** (`geschlossen`, Betriebsferien, „nur Teig“): `closed`, keine Öffnungszeit,
    keine Besetzung; im Kalender hinterlegt und mit Notiz benannt („Geschlossen ·
    Betriebsferien“). Eine Schicht an dem Tag bleibt ein Hinweis mit dem Grund.
  - **Sonderöffnung / „wie Sonntag“**: offen - auch am Ruhetag oder Feiertag -, mit den Zeiten des
    Wochentags, nach dem geöffnet wird (`offen_bis` kürzt das Ende; ein späteres `offen_bis` als das
    reguläre Ende dieses Wochentags verlängert die Öffnungszeit nicht - im Kalender ist es „nur
    Anzeige“, **vorläufig**); die Besetzung des Verkaufs wird über diese Zeit geprüft, der Tag ist benannt („Sonderöffnung (wie Samstag) · Notiz“).
  - **Ohne Kalender** (Datei fehlt oder ungültig) gilt genau die Regel wie zuvor: Ruhetag oder
    gesetzlicher Feiertag = geschlossen. Für ein Jahr, das der Kalender nicht führt, bleibt ein
    gesetzlicher Feiertag ohne eigenen Eintrag geschlossen (der Backzettel behandelt ihn dann als
    normalen Tag - beim Dienstplan wäre das ein Rückschritt; **vorläufig**).
  - **Urlaubstage und Soll hängen nicht am Kalender (vorläufig):** das Tagesgewicht bleibt 0 am
    Ruhetag und am gesetzlichen Feiertag (auch wenn der Laden dann offen hat - ein Feiertag ist
    nie ein Urlaubstag), 0,5 an 24./31.12., sonst 1 - auch an einem Schließtag des Kalenders:
    Betriebsferien kosten Urlaub, und wer an einem Schließtag weder Urlaub noch „abwesend“ hat,
    behält sein Soll. Offene Inhaber-Frage: sollen einzelne Schließtage das Soll mindern, ohne
    Urlaub zu kosten?
- **Urlaub zählt in Öffnungstagen**, für alle gleich (6-Tage-Woche, Samstag zählt immer): jeder
  Tag, der kein Ruhetag (`closed_weekdays` aus der Finanz-Config, sonst Montag) und kein Feiertag
  ist, zählt 1. **24.12. und 31.12. zählen 0,5.** Ein Halbtag-Eintrag zählt höchstens 0,5.
- **Nur Urlaub kostet Urlaubstage**; „frei“ und „abwesend“ stehen im Kalender, aber nicht auf dem
  Konto.
- **Anspruch je Jahr** in einer eigenen Zeile (Anspruch, Übertrag). **Fehlt er, ist das Konto
  „offen“** (`status: 'no-config'`, Rest `null`) - nie 0. Genehmigt und geplant stehen trotzdem da.
  Bei Ein- oder Austritt im Jahr anteilig: 1/12 je vollem Beschäftigungsmonat, Rundung nach § 5
  Abs. 2 BUrlG (ab einem halben Tag aufrunden, nie abrunden).
- **Übertrag verfällt am 31.03.**: genehmigter Urlaub bis dahin verbraucht zuerst den Übertrag;
  was danach übrig ist, steht als „verfallen“ im Konto.
- **Urlaub über den Jahreswechsel** zählt in jedem Jahr nur seinen Teil. Das Profil zeigt in der
  Spalte „Urlaubstage“ den Anteil im gezeigten Jahr (`daysInYear`, so wie das Konto ihn zählt) und
  darunter „von insgesamt n“, wenn die Abwesenheit ins Nachbarjahr reicht.
- **Schichten in allen Bereichen** (Verkauf, Backstube, Fahrer, Büro - Entscheidung des Inhabers
  2026-11-08, vorher nur Verkauf), nur für aktive Personen, innerhalb der Beschäftigung, am selben
  Tag (keine Schicht über Mitternacht), keine Überschneidung derselben Person. Ein
  Bereichswechsel lässt die Schichten stehen. **„Verkauf besetzt“ und die Besetzung zählen nur
  den Verkauf**; in die Stunden der Person gehen alle ihre Schichten ein. Schichtvorlagen (z. B.
  „Früh 6-12“) füllen die Zeiten vor; sie bleiben je Schicht änderbar. Gepflegt werden die
  Vorlagen über „Schichtvorlagen“ im Kopf des Kalenders (anlegen, ändern, löschen); ändern oder
  löschen ändert keine bestehenden Schichten. Die Migration legt keine Vorlagen an.
- **Abwesenheitsarten** `urlaub`, `frei`, `abwesend`; Status `geplant` oder `genehmigt` (später:
  Urlaubsantrag der Mitarbeitenden). Ganze Tage, ein einzelner Tag auch als halber Tag.
- **Abwesenheiten** liegen ganz in der Beschäftigung und überschneiden sich nicht. Schicht an einem
  Abwesenheitstag oder an einem geschlossenen Tag ist **ein Hinweis, kein Fehler**.
- **Besetzung des Verkaufs:** je offenem Tag lückenlose Abschnitte über die Öffnungszeit, wer im
  Verkauf da ist (Schicht von Beginn bis Ende; die Pause hat keine Uhrzeit und ist keine Lücke),
  und die Lücken. Wer ganztägig abwesend ist, zählt nicht, ein halber Tag lässt die Schicht
  stehen. Was vor dem Öffnen oder nach dem Schließen liegt, fällt heraus.
- **Stunden (Plan neben Soll)** je Person für den Zeitraum der Ansicht (Woche, Monat):
  - **Plan** = Σ (Ende − Beginn − Pause) ihrer Schichten im Zeitraum.
  - **Soll** = Wochenstunden ÷ Zahl der offenen Wochentage (6 beim Ruhetag Montag) je
    Öffnungstag im Zeitraum, an dem die Person beschäftigt ist. 24./31.12. zählen halb, Ruhetag
    und Feiertage gar nicht. Eine volle Woche ohne Feiertag ergibt genau die Wochenstunden, ein
    Monat im Mittel **Wochenstunden × 13/3** (26 Öffnungstage ÷ 6); der tatsächliche Monat hängt
    von seinen Öffnungstagen ab (November 2026: 24 Tage).
  - **Abwesenheiten:** ein Tag mit **Urlaub** oder **abwesend** (geplant oder genehmigt) mindert
    das Soll um diesen Tag, ein halber Tag um die Hälfte - wer im Urlaub ist, soll keine Stunden
    haben. **„frei“ mindert das Soll nicht**: ein freier Tag ist Ausgleich, die Stunden fehlen
    dann wirklich in der Woche.
  - **Ohne Wochenstunden ist das Soll „offen“**, nie 0, und es gibt keine Differenz.
  - **Differenz** = Plan − Soll, als Text mit Vorzeichen („+2:30 h“, „−4:00 h“, „±0:00 h“).
  - **Später** (nicht Teil dieser Stufe): Ist-Stunden aus der Stechuhr und der Vergleich Plan/Ist.
- **Stundenlohn und geschätzte Überstundenbezahlung** (11/2026, `overtimePay`/`monthHours`/
  `hoursOverview` in `vacation.core.js`):
  - **Stundenlohn** (brutto, €/h) ist Personendaten wie die übrigen Stammdaten: SQLite der Box,
    nur Inhaber, nie in `hq`; gepflegt im Profil („Bearbeiten“). Nicht erfasst = **„offen“**, nie 0.
    Das Audit-Log sagt nur, dass er sich geändert hat (`hourlyWageChanged`), nie den Betrag.
  - **Überstunden** = Plan − Soll eines Zeitraums, nur wenn positiv; **Bezahlung geschätzt** =
    Überstunden × Stundenlohn, auf den Cent gerundet. Kein Freizeitausgleich - eine Schätzung nach
    Plan, keine Lohnabrechnung, überall „geschätzt“ beschriftet.
  - Ohne Soll: „Soll offen“; Plan ≤ Soll: „keine Überstunden“ (0 €); Überstunden ohne Lohn:
    **„Stundenlohn offen“**, nie 0 €. Die Summe zählt nur Personen mit Lohn und heißt dann
    „mind. … €“ mit „n × Stundenlohn offen“; ohne jeden Betrag „offen“.
  - **Bezahlt wird der Monat, bis heute** (vorläufig, Entscheidung 2026-11-14, der Inhaber kann sie
    ändern): im **laufenden Monat** stehen als Hauptzahl Plan bis heute gegen Soll bis heute
    (Erster bis heute, einschließlich) - daraus Überstunden und Bezahlung; der ganze Monat steht
    daneben („ganzer Monat geplant 150:00 h / Soll 120:00 h“). **Vergangener Monat:** der ganze
    Monat. **Künftiger Monat:** nur geplant gegen Soll, **noch keine Überstunden** („Monat noch
    nicht begonnen“). „Heute“ ist das Datum der Box (API, `today` an den Core), nie die Uhr des
    Browsers.
  - **Verrechnung im Monat** (vorläufig): Minusstunden einer Woche gleichen Überstunden einer
    anderen Woche **im selben Monat** aus - Überstunden des Monats = max(0, Plan − Soll des
    Monats bis heute), Bezahlung = das × Stundenlohn. Die **Woche** zeigt ihre eigene Differenz und
    eine Bezahlung nur als **Richtwert**; die Summe, auf die man schaut, ist der Monat (so
    beschriftet). **Kein Übertrag zwischen Monaten** (offen).
  - **Zuschläge:** keine (Nacht, Sonntag, Feiertag) - weiter offen.
  - **Lohnkosten (geschätzt)** (vorläufig) = Plan-Stunden × Stundenlohn (brutto, ohne
    Arbeitgeberanteile) je Person für den Monat: bis heute und ganzer Monat geplant, dazu die
    Summe. Ohne Lohn bei geplanten Stunden „Stundenlohn offen“ (nie 0 €), die Summe dann
    „mind. … €“ mit „n × Stundenlohn offen“; wer nichts geplant hat, kostet 0 €.
  - **Minijob-Grenze** (vorläufig): bei Beschäftigung **Minijob** warnt die Seite, wenn die
    geplanten Lohnkosten des **ganzen Monats** über der Grenze liegen (genau die Grenze ist noch in
    Ordnung). Grenze **2026: 603 € im Monat**, einmal in `MINIJOB_LIMIT_CENTS` (`vacation.core.js`,
    je Jahr; Mindestlohn × 130 ÷ 3). Ein Jahr ohne Wert prüft nichts („Minijob-Grenze … nicht
    hinterlegt“), ohne Stundenlohn „Minijob-Grenze offen“. Die Beschäftigung (Vollzeit, Teilzeit,
    Minijob, Aushilfe; leer = „offen“) gab es schon im Profil (`employment_type`) - keine Migration.
  - **Woche und Monat:** die Woche (Mo-So) und **der Monat ihres Donnerstags** (wie die
    Kalenderwoche; KW 49/2026 = 30.11.-06.12. gehört zum Dezember, die Seite sagt das). Jeder Tag
    zählt in dem Monat, in dem er liegt. Das Profil zeigt die laufende Woche und den laufenden
    Kalendermonat (bis heute und ganz).
  - **Offene Inhaber-Fragen** (bewusst nicht erfunden): Zuschläge (Nacht, Sonntag, Feiertag)?
    Werden Überstunden bezahlt oder abgefeiert? Übertrag von Plus-/Minusstunden in den nächsten
    Monat? Die vorläufigen Entscheidungen oben (bis heute, Verrechnung im Monat, Lohnkosten,
    Minijob) bestätigen. Minijob-Grenze ab 2027 eintragen. Ab wann zählen Ist-Stunden statt Plan?
- **Feiertage Saarland sind geschlossen** (Neujahr, Karfreitag, Ostermontag, 1. Mai, Christi
  Himmelfahrt, Pfingstmontag, Fronleichnam, Mariä Himmelfahrt, 3. Oktober, Allerheiligen, beide
  Weihnachtsfeiertage): sie zählen nie als Urlaubstag und stehen im Kalender wie der Ruhetag als
  geschlossen - außer der Kalender der Bäckerei öffnet den Tag (Sonderöffnung, „wie Sonntag“).
  24.12./31.12. zählen nur dann 0,5, wenn sie weder Ruhetag noch Feiertag sind.
- **Mitarbeiter werden deaktiviert, nie gelöscht.** Der Anzeigename ist maßgeblich; der Login ist
  nur ein optionaler Verweis. Konnten die Logins nicht geladen werden, ist das Feld gesperrt und
  sagt es - die Verknüpfung bleibt dann unverändert.
- **Audit:** jede Änderung steht im `AuditLog`, aber **ohne Notizen und Anzeigenamen** (nur
  „geändert“).
- **Datenbank:** Migration `20270301000000-dienstplan.js` (sortiert nach den Backzettel-v2-
  Migrationen von `main`, daher nicht das im Task genannte `20270107…`), Tabellen `employees`,
  `vacation_entitlements`, `shift_templates`, `shifts`, `absences` in der SQLite der Box. Der
  Stundenlohn kam mit `20270401000000-dienstplan-hourly-wage.js` (Spalte
  `employees.hourly_wage_cents`, additiv, bestehende Personen „offen“).

## Oberfläche

- **`/admin/dienstplan` - Kalender**, Ansicht, Zeitraum und Bereich stehen in der URL
  (`?woche=JJJJ-MM-TT`, `?ansicht=monat&monat=JJJJ-MM`, `?ansicht=jahr&jahr=JJJJ`, `&bereich=`).
  Beim Ansichtswechsel bleibt man im Zeitraum (mit heute, sonst nach dem Donnerstag der Woche wie
  bei der Kalenderwoche). Die Woche wechselt per Pfeil oder Datumsfeld, Monat und Jahr per Pfeil
  und „Heute“ (zwischen den Pfeilen steht der Zeitraum, kein Datum).
  - **Woche (Standard):** Zeilen = Mitarbeitende nach Bereich (Verkauf zuerst), Spalten Mo-So.
    Schichten mit Uhrzeit, Abwesenheiten als Balken (genehmigt gefüllt, geplant gestrichelt).
    Ruhetag, Feiertag und Schließtage des Kalenders sind hinterlegt und benannt, eine
    Sonderöffnung steht mit Namen im Kopf; offene Tage zeigen im Kopf ihre
    **Öffnungszeit** („05:30–13:30“). Darunter steht die Zeile **„Besetzung Verkauf“** (nur bei
    „Alle“ oder „Verkauf“): je Tag ein schmaler Zeitstrahl (besetzt gefüllt, Lücke schraffiert -
    nur Beiwerk) und als Text, wer welchen Teil abdeckt („06:00–12:00 Vera“, Kurzname, bei
    gleichem Vornamen der volle Name) und wo niemand da ist („unbesetzt 05:30–06:00“, bis
    Ladenschluss „ab 12:00 unbesetzt“, fett mit Warnzeichen); ohne Lücke „durchgehend besetzt“.
    Eine Woche ganz ohne Schichten im Verkauf zeigt „nichts geplant“ statt an jedem Tag einer
    Lücke. Ganz rechts die Spalte **„Stunden“**: Plan, Soll („offen“ ohne Wochenstunden), was
    Urlaub/abwesend vom Soll abzieht, und die Differenz mit Vorzeichen; am Handy stehen Plan und
    Differenz zusätzlich unter dem Namen. Leere Zelle antippen → Schicht oder Abwesenheit
    anlegen (alle Bereiche); Eintrag antippen → bearbeiten oder löschen. Das „+“ in einer Zelle mit
    Einträgen bietet dasselbe an wie der Monat (an einem Abwesenheitstag keine zweite Abwesenheit;
    bleibt nichts anzulegen, fehlt das „+“).
  - **Monat:** dieselbe Zeilenlogik, Tage als schmale Spalten (Gantt-artig). Abwesenheit als
    durchgehender Balken mit Kürzel (U/F/A, geplant gestrichelt), Schicht als Punkt in der Farbe
    der Person, geschlossene Tage hinterlegt und im Kopf mit „×“, halbe Tage (24./31.12.) mit „½“
    markiert; eine Sonderöffnung bekommt im Kopf kein Zeichen (Name im Tooltip und darunter). Die Namen der Feiertage, Schließtage („Geschlossen · Notiz (×)“), Sonderöffnungen
    („… (offen)“) und halben Tage stehen zusätzlich unter der Tabelle - Touch kennt keinen Tooltip. Ein Tag einer Person öffnet
    **dieselben Dialoge wie die Woche**: leerer Tag → Schicht oder Abwesenheit anlegen; Tag mit
    Einträgen → Menü mit jedem Eintrag zum Bearbeiten, dazu „Schicht anlegen“ (aktive Personen,
    alle Bereiche) und „Abwesenheit eintragen“ (nur ohne Abwesenheit an dem Tag). Gibt es nur eine Möglichkeit, öffnet gleich der Dialog. Das Datum im Kopf öffnet
    die Woche dieses Tages. Ganz rechts die **Stunden des Monats** wie in der Woche (Plan, Soll,
    Differenz).
  - **Jahr:** je Person zwölf Monate mit den Abwesenheiten als Balken an ihrer Stelle im Monat,
    daneben das Urlaubskonto des Jahres aus `GET /api/dienstplan/balance?year` (Rest, genehmigt -
    auch noch Kommendes, daher nicht „genommen“ -, geplant, „verfallen“ wenn am 31.03. Übertrag
    übrig blieb; ohne Anspruch Rest „offen“ und „Anspruch offen“). Monat im Kopf antippen →
    Monatsansicht; Monat einer Person mit Abwesenheiten antippen → bearbeiten (eine: gleich der
    Dialog, mehrere: Menü); leerer Monat → Abwesenheit ab dem Ersten eintragen. Konnte das Konto
    nicht geladen werden, steht „nicht geladen“ in der Spalte und ein Hinweis in ihrem Kopf - keine
    eigene Meldung über der Seite. Am Handy steht der Rest zusätzlich unter dem Namen, weil die
    Kontospalte ganz rechts liegt. Das Jahr reicht von 2000 bis 2100 (so weit rechnet die API das
    Konto); ein anderes `?jahr=` zeigt das laufende Jahr.
  - **Stunden und Überstunden** (unter Woche und Monat, `HoursOverview.tsx`): oben die Kennzahlen
    des **Monats** („November 2026 · bis heute (14.11.) · wird bezahlt“: Plan bis heute mit Soll,
    Überstunden netto, Lohnkosten bis heute, ganzer Monat geplant mit Lohnkosten), darunter in der
    Woche die Kennzahlen der **KW als Richtwert**; ein Hinweis nennt Minijobs über der Grenze.
    Die Tabelle je Person: Stundenlohn, Monat (Differenz, Plan / Soll bis heute, „≈ … €“ oder
    „Stundenlohn offen“, „ganzer Monat …“), in der Woche die KW (Richtwert), Lohnkosten (bis heute,
    ganzer Monat, Minijob-Grenze). Folgt dem Bereichsfilter (Summen von der API). Person antippen -
    oder ihre Zelle in der Stundenspalte des Rasters - öffnet eine Schublade mit Monat (bis heute,
    ganzer Monat, Lohnkosten mit Rechenweg, Minijob) und Woche (Richtwert) und dem Weg ins Profil
    („Stundenlohn im Profil eintragen“). Die Stundenspalte des Rasters zeigt zusätzlich
    „Überstd. ≈ … €“ (im laufenden Monat „Überstd. bis heute ≈ … €“) oder „Stundenlohn offen“.
    Scheitert nur die Übersicht, steht der Kalender trotzdem. Liest nur
    `GET /api/dienstplan/hours`, rechnet nichts.
  - **Regeln erklärt:** ein kleiner (i)-Knopf neben Kennzahlen und Bezeichnungen (Übersicht,
    Schublade, Profil) öffnet per Tippen eine kurze Erklärung (bis heute / ganzer Monat,
    Verrechnung im Monat, Woche als Richtwert, geschätzte Bezahlung ohne Zuschläge, Lohnkosten,
    Minijob-Grenze); „So rechnet die App“ unter den Kennzahlen klappt alle auf einmal auf. Die
    Texte stehen einmal in `src/lib/dienstplanInfo.ts` (du-Form); Werte wie die Minijob-Grenze
    kommen aus der API-Antwort (`limitCents`, dieselbe Konstante wie die Rechnung), nie
    abgetippt.
  - **Meldungen** („Schicht angelegt.“, Fehler beim Löschen) gehören zum Zeitraum und verschwinden
    beim Blättern oder Ansichtswechsel. Höchstens zwei stehen über dem Kalender: ein Fehler ersetzt
    die Erfolgsmeldung, und ein Ladefehler beim Nachladen zeigt sich nur, solange kein Fehler einer
    Aktion dasteht.
  - Farbe ist nie der einzige Träger: Kürzel, Text und eine Legende stehen dabei.
- **`/admin/dienstplan/mitarbeiter` - Liste** (aktiv / ausgeschieden / alle), Mitarbeiter anlegen.
- **`/admin/dienstplan/mitarbeiter/[id]` - Profil:** Stammdaten (mit **Beschäftigung** und
  **Stundenlohn**, ohne: „offen“), Urlaubskonto des Jahres (Anspruch, Übertrag, genehmigt, geplant,
  verfallen, Rest), Anspruch je Jahr, Abwesenheiten des Jahres, **Stunden** des laufenden Monats
  (bis heute und ganzer Monat: Plan, Soll, Differenz; Überstunden-Bezahlung netto im Monat;
  Lohnkosten; bei Minijob die Grenze) und der laufenden Woche (Richtwert), kommende Schichten.
  Beschäftigung und Stundenlohn ändert „Bearbeiten“ (Euro mit Komma, leer = offen).
- **Handy und Tablet:** die Raster scrollen waagrecht, die Namensspalte bleibt stehen. Alle eigenen
  klickbaren Flächen (Name als Link aufs Profil, Einträge der Woche, Tageszellen im Monat,
  Monatsköpfe und Monate im Jahr, Farbfelder, Vorlagen-Chips im Schichtdialog) sind auf
  Touch-Geräten mindestens 44 px groß (`TOUCH_MEDIA`).
  Leere Zellen der Woche und leere Monate im Jahr zeigen dort das „+“ immer (gedämpft) - Touch
  kennt kein Hover.
- **Daten nur aus der API:** Woche, Monat und Jahr laden `GET /api/dienstplan?from&to`
  (Mitarbeiter, Schichten, Abwesenheiten, `days[]` mit Feiertagsname, Ruhetag, Gewicht,
  Öffnungszeit, „Verkauf besetzt“ und Besetzung, `hours[]` mit Plan und Soll je Person), das Jahr
  zusätzlich das Konto, Woche und Monat zusätzlich `GET /api/dienstplan/hours` (Stunden und
  Überstunden). Kein FullCalendar (`resource-timegrid` ist
  ein kostenpflichtiges Plugin) und kein `date-fns`: eigene MUI-Tabellen auf dem Layout-Kit.

## Tests

API: `tests/unit/vacationCore.test.js` (auch Öffnungszeiten, Besetzung, Stunden, Überstunden,
Monat bis heute, Verrechnung, Lohnkosten, Minijob-Grenze),
`tests/integration/dienstplan.test.ts`. Landing: `src/config/openingHours.spec.ts`. Verwaltung:
`src/lib/dienstplanCalendar.spec.ts`, `src/lib/dienstplanApi.spec.ts`,
`src/app/admin/dienstplan/**/*.spec.tsx`. Lokaler Seed mit erfundenen Personen:
`seedDienstplan` in `.claude/skills/setup-dev/scripts/lib/seed-next.mjs`.
