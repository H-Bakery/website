# Rezepte (hq/data/recipes)

Rezepte sind die Markdown-Dateien in `hq/data/recipes/<kategorie>/<datei>`. Die Verwaltung zeigt
sie an, Inhaber und Backstubenleitung legen neue an und ändern sie; gespeichert wird nach hq wie
bei Produkten und Grundmengen (Schreib-Worktree `app/edits`, rollende PR, Freigabe in hq).

**Code:** Lesen, Schreiben, Prüfen `apps/bakery-api/src/services/recipe-file.core.js` (der eine
Parser - auch der Backzettel liest seine Füllungen darüber, `backzettel-recipes.core.js`) ·
Datei-I/O + git `recipes.service.ts` · Routen `src/routes/recipes.routes.ts`.
API-Vertrag (Endpunkte, Formen, Fehlercodes): [`docs/api/recipes.md`](../api/recipes.md).
Verwaltung (`apps/bakery-management/src`): Seiten `app/admin/rezepte/**` · Client
`lib/recipesApi.ts` · Formular-Modell `lib/recipeForm.ts` · Bausteine `components/rezepte/`
(`RecipeForm`, `RecipeText`, `RecipeStatusChips`).

## Wer darf was

| Rolle                                  | Lesen | Anlegen, Ändern, Löschen |
| -------------------------------------- | ----- | ------------------------ |
| `inhaber`                              | ja    | ja                       |
| `backstubenleiter` (Backstubenleitung) | ja    | ja                       |
| `backstube`                            | ja    | nein (403)               |
| `verkauf`, `fahrer`                    | nein  | nein                     |

Die API setzt das durch (`requireRole`); die Oberfläche führt nur. Eine PIN-Sitzung am
Backstube-Tablet reicht.

## Formate

In hq gibt es drei Formate; das Modell der API ist für alle dasselbe (Titel, „Ergibt“, Zutaten in
Gruppen mit Menge + Einheit, Arbeitsschritte in Gruppen, Notizen). Erfundene Beispiele je Variante:
`tools/e2e/hq-recipes/`.

| Format     | Wo (heute)                               | Woran erkannt                             | Bearbeitbar |
| ---------- | ---------------------------------------- | ----------------------------------------- | ----------- |
| `standard` | `breads`, `rolls`, `baguettes`, `snacks` | YAML-Kopf mit `title`                     | ja          |
| `table`    | `cakes`, `fillings`, `special`           | kein YAML-Kopf, Zutaten als Tabelle       | ja          |
| `teig`     | `teige`                                  | YAML-Kopf mit `art` / `basis` / `zutaten` | nein        |

**standard** - Kopf `title`, `category`, `yield`, dazu `total_mass`, `equipment`, `baking`
(`temperature`, `time`, `steam`), `preparation_time`, `resting_time`, `difficulty`, `tags` (nur
Anzeige). Körper: `# Titel`, `## Beschreibung`, `## Zutaten` mit `### Gruppe` und Zeilen
`- [ ] 100 g Mehl`, `## Zubereitung` mit `### Gruppe` und nummerierten Schritten oder Stichpunkten
(`- **Stockgare:** …`), `## Notizen`, weitere Abschnitte (`Qualitätskriterien`, `Fehlerquellen`,
`Sicherheitshinweise` - wörtlich, nur Anzeige), Fußzeile (`---` + kursive Zeilen), kein Zeilenende
am Schluss. Varianten der Zutatenzeile (Beispiele aus den erfundenen Dateien): `0,5 g Testhefe`,
`2 TL Testsaat`, `1 Prise Musterzucker`, `4 Eier (200g)`, `1 Ei + 15g Testmilch (zum Abglänzen)`,
Zeilen ohne Menge (`Probewasser zum Benetzen`, `Optional: Testsaat oder Probemohn`); Unterpunkte
unter einem Schritt.

**table** - `# 🍰 Name (für 3 Bleche)` (Emoji bleibt, die Klammer ist „Ergibt“), je Rezeptteil eine
Überschrift (`### Zutaten:` = der unbenannte Teil, sonst `### 🌰 Testnussfüllung`) mit Tabelle
`| Zutat | Menge |`, mehrere Teile durch `---` getrennt. Mengen: `1.350 g` (Tausenderpunkt),
`1.450 ml`, `1 Prise`, `120 g (nach Bedarf)`, `1 Dose (ca. 4 kg)`, `3–6 g (nach Geschmack)` (keine
Zahl → Menge offen, Text bleibt als Hinweis), Namen mit Fußnotenstern (`Quarkfest***`). Eine Datei
ohne `.md`: `- **Menge**: Ergibt ca. 16 Fladen à 110 g`, weitere Stichpunkte (werden Notizen),
Spalte `Menge (g)` mit Zahlen ohne Einheit, Summenzeile `| **Gesamtmasse** | … |` (bleibt
wörtlich, nur Anzeige), `### Zubereitung:` mit Stichpunkten.

**teig** (U10) - Kopf `id`, `name`, `art` (`teig | zusatz | fuellung`), `teig`, `basis`
(`{ wasser_l: 1 }` → „je 1 L Schüttwasser“), `zutaten: - { name, g, auch: […], notiz }` mit
Kommentaren, `teig_kg_je_l`, `quelle`, `bestaetigt`; darunter freier Text (`## Originalrezept` mit
mehrspaltiger Tabelle, `## Ablauf`). Das ist die Rechengrundlage des Backzettels; hq prüft Summen und
`teig_kg_je_l` im CI. **Vorläufig nur lesbar** - eine falsche Änderung würde die rollende PR und
damit auch Produkt- und Grundmengen-Freigaben blockieren.

## Invarianten

- **Null-Diff beim Speichern ohne Änderung - für jede Datei.** Die Datei wird in Bereiche zerlegt,
  deren Rohtext zusammen genau die Datei ergibt; neu geschrieben wird nur, was sich geändert hat
  (Bereich, Gruppe, Zeile). Eine geänderte Menge ändert eine Zeile. Bewiesen über alle erfundenen
  Dateien und - lokal, wo `hq` neben dem Repo liegt - über jede echte Datei
  (`tests/unit/recipeFileCore.test.js`; im CI übersprungen). Nach jeder Änderung am Parser diesen
  Test lokal laufen lassen.
- **Schreibgeschützt statt verlustbehaftet.** Versteht der Parser eine Stelle nicht (Freitext
  zwischen Zutaten, dreispaltige Tabelle, gemischte Schritte, kaputter Kopf), ist die Datei nur
  lesbar und nennt den Grund mit Zeile. Nie „so gut es geht“ neu schreiben.
- **Nichts erfinden.** Fehlende Menge = `amount: null` („offen“), fehlendes „Ergibt“ = `yield: null`,
  nie 0 und kein Beispielwert. Ein neues Rezept enthält nur, was eingegeben wurde. Ohne
  `data/recipes` antwortet die Liste `status: 'no-data'`.
- **Was das Modell nicht deutet, bleibt wörtlich** in der Datei und wird als `meta` / `sections`
  angezeigt - nie bearbeitet, nie verworfen.
- **Die Datei entscheidet.** Nach dem Schreiben wird die Datei neu gelesen und mit der Eingabe
  verglichen; passt es nicht (z. B. ein Titel mit Klammer am Ende in einer Tabellen-Datei), wird
  nichts gespeichert (400 `invalid_recipe_file`).
- **Stand prüfen.** Ändern und Löschen brauchen `expectedVersion`; hat sich die Datei seitdem
  geändert (auch in hq), gibt es 409 `stale_recipe` und nichts wird geschrieben.

## Backzettel

Ein Rezept, auf das `config/backzettel.yaml` mit `recipe:` zeigt (Füllungen; freigegebener Stand
**und** wartende Änderung), lässt sich bearbeiten, aber **nicht löschen oder verschieben** (409
`recipe_in_use`). Der Rezeptteil, den der Backzettel liest (`section`, sonst über die id), lässt
sich nicht umbenennen oder entfernen (409 `recipe_section_in_use`). Die API liefert je Rezept
`usedByBackzettel`; die Oberfläche sagt dazu, dass der Backzettel es verwendet. Der Backzettel
rechnet weiter mit dem freigegebenen Stand - eine Rezeptänderung wirkt dort erst nach der Freigabe.

## Freigabe in hq

Wie bei den Produkten: eine Änderung ist sofort in der Verwaltung zu sehen (Stand des
Schreib-Worktrees) und trägt `pending`: `created` (neu), `changed` (geändert) oder `deleted`
(gelöscht - das Rezept bleibt bis zur Freigabe in der Liste, nur lesbar). Nach dem Merge der PR
verschwindet die Markierung. Jede Änderung ist ein Commit mit dem Bearbeiter als `Co-authored-by`
und steht zusätzlich im Audit-Log.

**Löschen und Verschieben sind auf der Box vorerst aus** (`HQ_RECIPES_ALLOW_DELETE`): die Pfadwache
von hq lehnt Löschungen aus `app/edits` ab. Erst einschalten, wenn hq sie unter `data/recipes/**`
erlaubt. Die Liste meldet es mit `canDelete: false`.

## Dateinamen

Neue Rezepte heißen `<kategorie>/<slug>.md` (Slug aus dem Namen, Umlaute umgeschrieben, nur
`a-z0-9-`); in `teige/` legt die Verwaltung nichts an. Vorhandene Dateien behalten ihren Namen,
auch wenn der Titel sich ändert - die Kennung `<kategorie>/<slug>` bleibt stabil. Die Kennung wird
nie zu einem Pfad zusammengesetzt, sondern im Verzeichnis nachgeschlagen.

## Oberfläche (`/admin/rezepte`)

Im Pilotbetrieb freigegeben (`PILOT_ALLOWED_ROUTES`), Menüeintrag „Rezepte" unter „Backstube",
Schnellzugriff auf dem Dashboard. Die Verwaltung deutet das Dateiformat **nie selbst** - sie zeigt
und schickt das Modell der API.

| Seite                                             | Wer (`ROLE_ACCESS`)                   | Was                                             |
| ------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| `/admin/rezepte`                                  | Inhaber, Backstubenleitung, Backstube | Liste nach Kategorie, Suche, Kategorie-Filter   |
| `/admin/rezepte/<kategorie>/<kennung>`            | dieselben                             | Rezeptansicht, Drucken; für Schreibende Löschen |
| `/admin/rezepte/neu`                              | Inhaber, Backstubenleitung            | Formular „Neues Rezept"                         |
| `/admin/rezepte/bearbeiten/<kategorie>/<kennung>` | Inhaber, Backstubenleitung            | Formular „Bearbeiten"                           |

Die Formulare liegen unter festen Präfixen (`RECIPE_WRITE_PATHS` in `roles.ts`), damit `ROLE_ACCESS`
sie der Backstube mit einer `except`-Regel nehmen kann; der Proxy rendert sie für die Backstube gar
nicht erst. Die Backstube sieht dieselbe Liste und Ansicht ohne „Neues Rezept", „Bearbeiten",
„Löschen" und ohne den Abschnitt „Datei in hq".

- **Liste.** Gruppiert nach Kategorie; je Zeile Name, „Ergibt" (fehlt es: „Ergibt: offen") und
  Zutatenzahl. Die Suche geht an die API (`?q=`, 250 ms nach dem letzten Tastendruck) - nur sie
  kennt die Zutaten; der Kategorie-Filter läuft im Browser über das Suchergebnis, die Chips zählen
  die Treffer. Filter stehen in der Adresse (`?kategorie=&q=`), damit „Zurück" aus einem Rezept in
  derselben Auswahl landet.
- **Marker** (`RecipeStatusChips`, in Liste, Ansicht und Formular gleich): „wartet auf Freigabe"
  (auch „neu · …" und „gelöscht · …"), „Backzettel" (der Backzettel verwendet das Rezept) und - nur
  für Schreibende - „nur lesen". Die Liste nennt dazu die Zahl wartender Änderungen. Nicht
  wegkürzen.
- **Ansicht.** Für das Tablet in der Backstube: Zutaten und Schritte in großer Schrift (17/19 px),
  Menge rechtsbündig **vor** dem Namen wie auf dem Rezeptblatt, ab `md` Zutaten links und Zubereitung
  rechts. Eine Zutat ohne Menge zeigt „offen" (bei Tabellen-Dateien den Text der Datei, z. B.
  „3–6 g (nach Geschmack)"), nie 0. Notizen, Beschreibung, Schritte mit Unterpunkten und die wörtlich
  übernommenen Abschnitte rendert `RecipeText` (Absätze, Listen, `**fett**`, Tabellen; HTML wird
  nicht ausgeführt, Unbekanntes bleibt Text). „Drucken" = `window.print()`: ohne Knöpfe und
  Hinweise, hell, Zutaten vor Zubereitung.
- **Formular** (`RecipeForm`, für Neu und Bearbeiten): Name, Kategorie, „Ergibt", Beschreibung;
  Zutaten in Gruppen (Zeile hinzufügen/entfernen, mit Pfeilen umsortieren, Enter in der letzten Zeile
  legt die nächste an); Arbeitsschritte in Abschnitten (nummeriert oder Stichpunkte); Notizen. Leere
  Menge = offen. Einheiten und Kategorien kommen aus `GET /api/recipes` (`units`,
  `categories[].writable`) - keine eigene Liste. Das Feld „Hinweis" je Zutat gibt es nur bei
  Tabellen-Dateien (in Listen-Dateien gehört er in den Namen). Kein `<form>`-Submit: Enter in einem
  Mengenfeld speichert nicht.
- **Null-Diff auch von der Oberfläche.** `changedInput()` schickt nur die Felder, die vom geladenen
  Rezept abweichen; eine unberührte Zutatenzeile geht als dasselbe Objekt zurück, das die API
  geliefert hat. Ohne Änderung wird gar nicht gespeichert („Nichts geändert"). `meta`, `sections` und
  die Summenzeile einer Tabelle bearbeitet das Formular nicht - es nennt sie unter „Bleibt
  unverändert".
- **Vor dem Senden** prüft das Formular nur, was die Eingabe unklar macht (Name fehlt, Menge keine
  Zahl oder ≤ 0, Tausenderpunkt, Einheit ohne Menge, Zutat ohne Namen); alles andere prüft die API,
  ihre deutsche `message` steht über der Speichern-Leiste.
- **Veralteter Stand.** 409 `stale_recipe`: die Meldung der API plus „Aktuellen Stand laden" - die
  eigene Eingabe bleibt stehen, bis man lädt; überschrieben wird nichts.
- **Backzettel.** Verwendet der Backzettel das Rezept: Hinweis in Ansicht und Formular, kein
  „Löschen", Kategorie fest, und die Gruppe, die er liest (`usedByBackzettel[].section`), behält
  ihren Namen und lässt sich nicht entfernen.
- **Löschen** nur mit Rückfrage und nur, wenn die API `deletable` meldet; sonst steht der Grund
  (`deleteBlockedReason`) im Abschnitt „Datei in hq". Verschieben (Kategorie ändern) nur mit
  `canDelete`.
- **Nach dem Speichern** führt die App zur Rezeptansicht und sagt dort „Gespeichert" bzw.
  „… wartet jetzt auf die Freigabe in hq" (`?gespeichert=`, wird sofort aus der Adresse genommen).
- **Ungespeichertes** geht nicht still verloren (`useConfirmLeave`).
- **Hilfe:** eigene Kurzanleitung „Backstubenleitung", je ein Abschnitt „Rezepte" bei Backstube und
  Inhaber (`src/content/hilfe/spickzettel.ts`).

**Tests:** `lib/recipeForm.spec.ts` (Mengenfeld, Null-Diff, nur Geändertes, Prüfung),
`lib/recipeForm.files.spec.ts` (jede erfundene Datei und - lokal, wo `hq` neben dem Repo liegt -
jede echte: laden und unverändert zurückgeben ergibt keine Änderung; im CI für die echten
übersprungen),
`lib/recipesApi.spec.ts`, `components/rezepte/RecipeText.spec.tsx`,
`app/admin/rezepte/rezepte.spec.tsx` (Liste, Ansicht, Neu, Bearbeiten je Rolle; veralteter Stand;
Backzettel; Löschen), `lib/roles.spec.ts` und `lib/serverSession.spec.ts` (wer welche Seite öffnet),
Playwright `apps/bakery-management-e2e/src/management-rezepte.spec.ts` (echte API: lesen, anlegen,
ändern, löschen in der Wegwerf-Kopie; 403 für die Backstube; Rolle in der Benutzerverwaltung).
Erfundene Rezepte für Specs: `lib/recipeFixtures.ts`.
