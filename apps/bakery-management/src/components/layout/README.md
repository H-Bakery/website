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
| `KeyFigures`                                 | Kennzahlen-Reihe, **höchstens 4** Werte: Bezeichnung, Wert, Hinweis. Ein `<dl>`, je Kennzahl ein `div` mit `<dt>` (Bezeichnung + Badge) und `<dd>`s.                                                |
| `ResponsiveList`                             | Tabelle am PC, Karten unter `sm` (600 px) - die Aktionen bleiben am Handy sichtbar.                                                                                                                 |
| `LoadingState` / `EmptyState` / `ErrorState` | Laden, „nichts da“, „geht nicht“ - überall gleich.                                                                                                                                                  |
| `DayNavigator`                               | Tageswechsel einer Tagesseite: ‹ Datumsfeld › (+ „Heute“). Immer ganz vorne im `actions`-Slot des Kopfes.                                                                                           |

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
`back={{ href, label }}`, nicht als eigener Knopf im Inhalt. Passen Titel
(mindestens `HEADER_TITLE_MIN_WIDTH`, 25 rem) und Aktionen nicht
nebeneinander (Tablet hochkant, drei Knöpfe), rutschen die Aktionen von
selbst unter den Titel - keine eigene Umbruch-Logik in der Seite.

**Tageswechsel.** Jede Seite, die einen Tag zeigt (Tagesübersicht,
Abholliste, Backzettel, Kassentag, Rest, Backschrank), wechselt den Tag mit
`DayNavigator` als **erstem** Element im `actions`-Slot - nicht in einer
Filterfläche, nicht als beschriftete Knöpfe. Ruhetage überspringt `step`,
Grenzen setzen `min`/`max`, „Heute“ kommt mit `today`.
Zeigt eine Seite einen Monat oder ein Jahr (Dienstplan), steht mit `display`
der Zeitraum („November 2026“) statt des Datumsfelds zwischen den Pfeilen.

**Weniger auf einmal.** Untertitel eine Zeile. Erklärungen, Annahmen,
Rechenwege in `details` (zugeklappt) oder als Tooltip. Höchstens 4 Kennzahlen
nebeneinander, höchstens zwei Hinweise (`Alert`) oben auf der Seite.
Nebenwerte als zweite Zeile in `text.secondary`, nicht als eigener Chip.

**Nicht wegkürzen.** Was `docs/domains/` als „nicht wegoptimieren“ führt, bleibt
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

**Fokus unter Leisten.** Die App-Hülle (`useFocusNotObscured`,
`focusNotObscured.ts`) prüft nach jedem Fokuswechsel, ob eine klebende
Leiste (Speichern unten, AppBar oben) das Feld zudeckt, und schiebt das
Fenster dann so weit, dass es mit 16 px Abstand frei steht - Tab mit
Bluetooth-Tastatur und die iOS-Pfeile „nächstes Feld“. Seiten tragen dafür
nichts nach; eine Leiste muss nur `position: sticky`/`fixed` sein.

**Sticky.** Speichern-Leisten und Tabellenköpfe kleben am Fenster
(`position: sticky`). Das geht nur, wenn kein Vorfahr `overflow: hidden`
oder `auto` hat, ohne selbst zu scrollen: `<main>` (`admin/layout.tsx`) und
die Fläche von `PageSection` schneiden deshalb mit `overflow: clip` ab. Um
eine Speichern-Leiste kein `overflow: hidden` legen; braucht eine Tabelle
einen eigenen Scroll-Container, klebt ihr Kopf nur darin (dann
`maxHeight` setzen).

**Druck.** Kopf-Aktionen und Details-Knöpfe sind im Druck ausgeblendet,
`PageLayout` nimmt im Druck die Breitenbegrenzung weg. Jede Seite druckt
ohne AppBar, Seitenleiste und Pfad (`admin/layout.tsx`), ohne Schatten
(`global.css`) und **hell, auch aus dem Dunkelmodus**: solange gedruckt
wird, rendert `Providers.tsx` mit dem hellen Theme (`lib/printMode.ts`,
`beforeprint`/`afterprint` und `matchMedia('print')`). `color-scheme`
allein ändert MUIs Palettenfarben nicht. Eigene Druckansichten
(Backzettel, Abholliste, Grundmengen, Hilfe) behalten ihr `@media print`; ein
Bildschirm-Layout darf dort nicht hineinwirken.

## Für Specs

- `PageSection` ist ein `<section aria-labelledby>`. `getByLabelText(/Notiz/)`
  trifft deshalb auch die Überschrift „Zahlung & Notiz“ - Felder über
  `getByRole('textbox', { name: … })` suchen.
- Zugeklappte `details` stehen im DOM, sind aber unsichtbar und für
  `getByRole` nicht da: erst den Details-Knopf klicken, dann suchen.
- `ErrorState` übersetzt rohe Browser-/Proxy-Meldungen („Failed to fetch“,
  „HTTP 502 …“, „Request timeout“) in „Keine Verbindung zum Server – bitte
  WLAN prüfen.“ (`displayErrorMessage`). Das ist nur ein Netz - Seiten
  übersetzen ihre Fehler weiter selbst (`describeBackstubeError`,
  `backzettelErrorText`, `partners/errorText`, `describeAuthError`).

## Zusätze

- `PageSection printHidden`: Abschnitt nur am Bildschirm (Filter, Knöpfe).
- `KeyFigures variant="plain"`: Kennzahlen ohne eigene Fläche, für die
  Verwendung in einer `PageSection` (keine Fläche in der Fläche);
  `dense`: kleinere Werte für dichte Seiten.
- `global.css` druckt ohne Übergänge, Animationen und Schatten; die hellen
  Farben kommen aus dem Theme (siehe „Druck“).
- **Fenstertitel:** `PageHeader` setzt `document.title` auf
  „<Seitentitel> - Bäckerei Heusser“, solange die Seite steht. Ist der
  Titel kein reiner Text oder soll der Reiter anders heißen:
  `documentTitle="…"`.
- **Sprunglink:** „Zum Inhalt springen“ ist der erste Tab-Halt jeder
  `/admin`-Seite und führt auf `<main id="inhalt">`.

## Theme

`lib/muiTheme.ts` setzt dafür: `h1` 1,625 rem (Handy) / 2 rem (ab `md`),
`h2` 1,125 / 1,25 rem halbfett, Ecken 8 px, Tabellenköpfe halbfett.
Tastaturfokus: jedes `ButtonBase` (Knöpfe, Chips, Reiter, Kacheln,
Navigation) bekommt bei `Mui-focusVisible` einen 2-px-Ring
(`FOCUS_RING_COLOR`, in der AppBar in Schriftfarbe), ein `Switch` den Ring
am Daumen - MUIs Ripple allein war hell kaum (Switch: gar nicht) zu sehen.
Eigene klickbare Flächen nicht mit `outline: 0` überschreiben.
`global.css` blendet `<section>` nicht mehr ein (jede `PageSection` ist eine),
Bildlaufleisten und Datumsfelder folgen dem Farbschema
(`CssBaseline enableColorScheme`).
