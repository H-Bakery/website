# Layout-Kit der Verwaltung

Ein Rahmen für jede Seite unter `/admin`, damit alle Seiten gleich aussehen und
nicht zu viel auf einmal zeigen. Referenzseiten: `/admin/settings`
(`app/admin/settings/page.tsx`, schmal) und `/admin/users`
(`app/admin/users/UsersClient.tsx`, Tabelle → Karten).

```tsx
import { PageLayout, PageSection, KeyFigures, ResponsiveList, LoadingState,
  EmptyState, ErrorState } from '../../../components/layout'

<PageLayout
  title="Benutzer"
  subtitle="Konten, Rollen, Passwörter und PINs"
  actions={<Button variant="contained">Neuer Benutzer</Button>}
>
  <PageSection title="Konten (7)" disablePadding>
    <ResponsiveList … />
  </PageSection>
</PageLayout>
```

## Bausteine

| Baustein                                     | Wofür                                                                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageLayout`                                 | Genau einer je Seite. Kopf (`PageHeader`) + Abschnitte mit festem Abstand.                                                                                                                          |
| `PageHeader`                                 | Nur, wenn eine Seite den Kopf ohne `PageLayout` braucht (selten).                                                                                                                                   |
| `PageSection`                                | Jeder inhaltliche Block: Überschrift, eine Zeile Beschreibung, Aktionen, zuklappbare Details. `variant="plain"` für Inhalte, die selbst Karten sind. `disablePadding` für Tabellen bis an den Rand. |
| `KeyFigures`                                 | Kennzahlen-Reihe, **höchstens 4** Werte: Bezeichnung, Wert, Hinweis.                                                                                                                                |
| `ResponsiveList`                             | Tabelle am PC, Karten unter `sm` (600 px) - die Aktionen bleiben am Handy sichtbar.                                                                                                                 |
| `LoadingState` / `EmptyState` / `ErrorState` | Laden, „nichts da“, „geht nicht“ - überall gleich.                                                                                                                                                  |

## Regeln

**Rahmen und Breite.** Den Seitenrand (16 px Handy, 24 px ab Tablet) setzt
`admin/layout.tsx`. Seiten geben **kein** eigenes `p`, `Container` oder
`maxWidth` dazu. Die Breite wählt `width`:

| `width`   | max.    | für                                                          |
| --------- | ------- | ------------------------------------------------------------ |
| `narrow`  | 760 px  | Formulare, Einstellungen, Detailansicht eines Datensatzes    |
| `default` | 1200 px | Dashboards, Listen mit wenigen Spalten, Tagesansichten       |
| `wide`    | 1600 px | breite Tabellen (Kassenarchiv, Grundmengen, Vorbestellungen) |
| `full`    | -       | Ausnahmen (Raster, die jede Spalte brauchen)                 |

**Überschriften.** Eine `h1` je Seite - nur über `PageLayout title`. Abschnitte
`h2` (`PageSection`), Unterabschnitte `level={3}`. Keine `variant="h4"`/`h5`/`h6`
als Überschrift und keine Icons im Seitentitel. Große Zahlen sind keine
Überschriften: `KeyFigures` (`<dl>`), nicht `<h4>56</h4>`.

**Aktionen.** Höchstens **eine** Hauptaktion (`variant="contained"`) je Seite,
im `actions`-Slot des Kopfes - Desktop rechts, Handy volle Breite darunter.
Weitere Aktionen `outlined` oder `text`; selten Gebrauchtes ins `⋮`-Menü.
Aktionen eines Abschnitts in `PageSection actions`. Rücksprung über
`back={{ href, label }}`, nicht als eigener Knopf im Inhalt.

**Weniger auf einmal.** Untertitel eine Zeile. Erklärungen, Annahmen,
Rechenwege in `details` (zugeklappt) oder als Tooltip. Höchstens 4 Kennzahlen
nebeneinander, höchstens zwei Hinweise (`Alert`) oben auf der Seite.
Nebenwerte als zweite Zeile in `text.secondary`, nicht als eigener Chip.

**Nicht wegkürzen.** Was CLAUDE.md als „nicht wegoptimieren“ führt, bleibt
sichtbar - nur ordentlich platziert: vorläufig/offen, „(geschätzt)“, „kein
Bericht“, „Wartet auf Freigabe“, Nachträge, offen ≠ 0, Rest-/Erstattungs-Chips,
Hinweise an der PIN-Station. Solche Marker gehören in `status` (Kopf),
`badge`/`hint` (`KeyFigures`) oder an die Zeile - nicht in „Details“.

**Hinweise (Alert).** `error` = etwas ging schief (`ErrorState`, mit „Erneut
versuchen“, wenn sinnvoll). `warning` = jemand muss handeln. `info` nur, wenn es
die Arbeit auf dieser Seite ändert - sonst als `description` oder in
`details`. `success` nach einer Aktion, schließbar.

**Zustände.** Laden: `LoadingState` mit Text („Benutzer werden geladen …“),
kein nackter Spinner. Leer: `EmptyState` mit einem Satz, was fehlt, und
höchstens einer Aktion. Fehler: `ErrorState`/`Alert severity="error"` mit der
deutschen API-`message`.

**Handy und Touch.** Kein waagrechtes Scrollen der Seite bei 320-390 px. Breite
Tabellen: `ResponsiveList` oder ein eigener Scroll-Container
(`TableContainer` mit `overflowX: 'auto'`). Touch-Ziele ≥ 44 px - das Theme
(`TOUCH_MEDIA` in `lib/muiTheme.ts`) erledigt Knöpfe und Felder; eigene
klickbare Flächen selbst auf 44 px bringen.

**Dunkelmodus (Standard).**

- Schrift auf `*.main`-Flächen: `*.contrastText`, nie `'white'`.
- Keine `grey.50/100/300`-Hintergründe - `action.hover` / `action.selected`.
- Gedämpfter Text: `text.secondary`, nicht `text.disabled` oder `opacity`.
- Farbe ist nie der einzige Träger (Label + Farbe), Kontrast ≥ 4,5:1 in hell
  und dunkel.
- Flächen: `PageSection`/`Paper` (Theme-Elevation), keine festen Farben.

**Druck.** Kopf-Aktionen und Details-Knöpfe sind im Druck ausgeblendet,
`PageLayout` nimmt im Druck die Breitenbegrenzung weg. Eigene Druckansichten
(Backzettel, Abholliste, Grundmengen, Hilfe) behalten ihr `@media print`; ein
Bildschirm-Layout darf dort nicht hineinwirken.

## Theme

`lib/muiTheme.ts` setzt dafür: `h1` 1,625 rem (Handy) / 2 rem (ab `md`),
`h2` 1,125 / 1,25 rem halbfett, Ecken 8 px, Tabellenköpfe halbfett.
`global.css` blendet `<section>` nicht mehr ein (jede `PageSection` ist eine),
Bildlaufleisten und Datumsfelder folgen dem Farbschema
(`CssBaseline enableColorScheme`).
