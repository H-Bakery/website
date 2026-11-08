# Partybrezel-Prototyp (`apps/bakery-partybrezel`)

Ein klickbarer Prototyp „Partybrezel selbst zusammenstellen“: Größe und Anzahl wählen, Teile
belegen, Abholtag und Kontakt angeben, Übersicht mit Preis und der Vorbestellung, die daraus
entstünde. **Nichts wird gesendet**, es gibt keine API-Aufrufe. Zweck: mit dem Inhaber die offenen
Fragen (Q-P1 … Q-P7) am Bildschirm durchspielen, bevor Produkte, Backzettel und Shop sie abbilden.

Eigenständige statische Next.js-App (Next 16, React 18, MUI 5, App Router, `output: 'export'`),
aufgebaut wie `apps/bakery-landing`, aber ohne `withNx()` und ohne `@bakery/*`-Libs.
Kein Pilot-Bildschirm, nicht auf der Box. Kurzfassung für Agenten:
[`apps/bakery-partybrezel/CLAUDE.md`](../../apps/bakery-partybrezel/CLAUDE.md).

## Was feststeht und was nicht

Fest (aus dem Ablauf der Backstube): Partybrezeln sind aus **Flitteig**, zwei Größen, **klein =
3 Teile × 300 g**, **groß = 3 Teile × 400 g**. Der Teig wird am Vortag des Backtags angesetzt,
abgeholt wird am Backtag. **Montag ist Ruhetag.**

Offen - im Prototyp als Platzhalter:

| Frage | Inhalt                                                   | Platzhalter in der Config                                                      |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Q-P1  | Zähleinheit: ganze Brezel oder Teil?                     | `productIds` (beide Abbildungen A/B, siehe unten)                              |
| Q-P2  | Personen / Stücke je Größe                               | `sizes[].persons` (8 / 12)                                                     |
| Q-P3  | Welche Beläge, gemischt je Teil oder ein Belag je Brezel | `toppings` (6 erfundene), `defaultToppingMode: 'per-part'`                     |
| Q-P4  | Wer belegt wann                                          | nicht abgebildet (nur Hinweis im Dialog)                                       |
| Q-P5  | Nur Vorbestellung? Vorlauf?                              | `leadTimeDays: 2`, `maxPretzelsPerOrder: 10`, `pickupDaysShown: 14`            |
| Q-P6  | Preise je Größe und Belag                                | `sizes[].basePriceCents` (19,90 / 26,90 €), `toppings[].surchargePerPartCents` |
| Q-P7  | An welchen Tagen                                         | `availableWeekdays: [2..7]` (Di-So; Montag wird nie angeboten)                 |

**Dienstag ist ein Widerspruch der beiden festen Regeln:** der Teig entsteht am Vortag, Montag ist
Ruhetag. Eine Abholung am Dienstag bräuchte also Teig vom Montag. Der Prototyp bietet Dienstag
trotzdem an (Platzhalter Di-So), erfindet aber keinen Teigtag: `pickupDates()` markiert solche
Tage mit `doughOnRuhetag` (`doughDateIsRuhetag()` in `src/lib/dates.ts`), Abholschritt und
Übersicht sagen „der Vortag ist Ruhetag … offen (Q-P4/Q-P7)“ statt „Teig am Montag ansetzen“.
Das entspricht `prepDateProvisional` beim Backzettel (Q-B2). Q-P7 im Dialog nennt den Fall.

Alle Preise, Personenzahlen, Beläge und Produkt-IDs sind **erfunden** - dieses Repo ist
öffentlich, echte Werte gehören nach `hq`. Die Seite zeigt dauerhaft den Hinweis „Prototyp –
Platzhalterpreise, keine echte Bestellung“ und listet die offenen Fragen in einem Dialog
(Text ebenfalls aus der Config, `openQuestions`).

## Starten

```bash
npm run dev:partybrezel          # = nx serve bakery-partybrezel -> next dev --webpack -p 4221
npm run build:partybrezel        # = nx build bakery-partybrezel -> statischer Export nach apps/bakery-partybrezel/out
npm run serve:partybrezel        # = nx serve-static bakery-partybrezel -> out/ auf http://localhost:4231
npm run test:unit:partybrezel    # = nx test bakery-partybrezel (jest + RTL)
npx nx lint bakery-partybrezel   # eigenes lint-Target, damit `nx affected:lint` in CI die App mitnimmt
```

CI baut die App in der Build-Matrix von `.github/workflows/ci.yml` mit. Tests: Kern in
`src/lib/*.spec.ts`, der Durchklick aller Schritte (auch unter React StrictMode) in
`src/components/PartybrezelDesigner.spec.tsx`.

Gebaut wird mit **webpack** (`next build --webpack`) - Turbopack ist in Worktrees mit verlinktem
`node_modules` unzuverlässig. `out/` und `.next/` sind über die Root-`.gitignore` ausgeschlossen.
`next-env.d.ts` ist **nicht** eingecheckt (Root-`.gitignore`): Next 16 schreibt die Datei bei
jedem `next build` / `next dev` neu, je nach Lauf mit `.next/types` oder `.next/dev/types` - eine
eingecheckte Fassung bliebe nach jedem Build als Änderung liegen. `tsc` (`npm run type-check`)
braucht sie nicht.

**Unterpfad:** `PARTYBREZEL_BASE_PATH=/partybrezel npm run build:partybrezel` setzt `basePath` und
`assetPrefix`; `out/index.html` lädt dann `/partybrezel/_next/...`, das Icon liegt unter
`/partybrezel/icon.svg`. Zum Ansehen den Export in ein Verzeichnis `partybrezel/` kopieren und
dessen Elternverzeichnis ausliefern, z. B.
`node tools/e2e/serve-static.js /tmp/site --port 4231` → `http://localhost:4231/partybrezel/`.
Ein ungültiger Wert (ohne führendes `/`, Sonderzeichen) bricht den Build ab.

## Aufbau

- **`src/config/partybrezel.config.ts`** - die einzige Quelle aller Werte; jeder Platzhalter trägt
  `// PLATZHALTER Q-P…`. Komponenten haben keine eigenen Preise, Gewichte oder Tage: Config ändern
  heißt Prototyp ändern. `checkConfig()` (`src/lib/configLookup.ts`) prüft sie im Test
  (Slugs, Montag, doppelte IDs).
- **`src/lib/`** - reines TypeScript ohne React:
  - `pricing.ts` - Grundpreis + Aufpreis je belegtem Teil, intern in ganzen Cent;
    `format.ts` formatiert de-DE (`19,90 €`, `2,4 kg`).
  - `dates.ts` - Abholtage aus einem **hineingereichten** „heute“ (`YYYY-MM-DD`): ab heute +
    Vorlauf, nur `availableWeekdays`, nie Montag, höchstens ein Jahr Suche. Gerechnet wird in
    UTC-Mitternacht (keine Sommerzeit-Verschiebung); `todayInBerlin(new Date())` ruft nur die
    Oberfläche auf, und zwar im Browser - der Export ist statisch, ein „heute“ zur Build-Zeit
    wäre nach einem Tag falsch.
  - `validation.ts` - Name Pflicht (≤ 120), Telefon optional, sonst ≥ 5 Ziffern, mindestens eine
    Brezel, höchstens `maxPretzelsPerOrder`, jedes Teil (bzw. jede Brezel) belegt, Uhrzeit
    `HH:MM`, Anmerkung ≤ `maxCustomerNoteLength`. Steuer- und unsichtbare Zeichen prüft eine
    **Kopie** der API-Regel (`control-chars.core.js`: C0/C1, `\p{Cf}`, Default-Ignorables,
    > 4 Kombinationszeichen, ZWJ nur zwischen Emoji; Tab/Zeilenumbruch nur in der Anmerkung) -
    > wer die API-Regel ändert, zieht sie hier nach. **Belagsliste + Anmerkung ≤ 500 Zeichen**
    > (`validateNoteFits`), siehe unten.
  - `payload.ts` - die beiden Abbildungen (unten), `note.ts` - die Anmerkung (Belagsliste je
    Brezel + Text der Kundschaft), `summary.ts` - Teile und Teig (g) je Größe und Teile je Belag
    für den Hinweis „Für die Backstube“.
  - `orderState.ts` - Reducer (`useReducer`) und `sanitizeOrderState` für den Entwurf im
    `localStorage` (`bakery-partybrezel-draft-v1`, in try/catch, nur Komfort). Neue Brezeln
    werden **hinten angehängt** - die Nummer einer schon belegten Brezel ändert sich nicht, wenn
    später eine andere Größe dazukommt. Gespeichert wird erst, nachdem der Entwurf geladen und
    angewandt ist (sonst überschriebe der leere Anfangszustand ihn unter React StrictMode in
    `next dev`). Der Entwurf merkt sich auch den offenen Schritt (`step`); nach dem Neuladen geht
    es dort weiter - höchstens aber bis zum ersten inzwischen offenen Schritt
    (`resumeStep()` in `validation.ts`, z. B. Abholtag abgelaufen).
- **`src/components/`** - eine Seite, vier Schritte (MUI-Stepper), feste Leiste unten mit
  laufender Summe und Zurück/Weiter, einklappbare **Prototyp-Einstellungen** (Belag je Teil ↔ ein
  Belag je Brezel zur Laufzeit, Entwurf verwerfen). Verwerfen und „Neu beginnen“ fragen nach.
  Wird ein früherer Schritt auf der Übersicht ungültig (Modus umgestellt, Teile gemischt
  belegt), sagt ein Hinweis oben, was offen ist, mit Knopf zum Schritt; die Vorschau heißt dann
  „(unvollständig)“ und „Kopieren“ ist gesperrt.
  `scroll-padding` oben/unten (ThemeRegistry) hält fokussierte Elemente aus dem klebenden Hinweis
  und der festen Leiste heraus. Der Aufpreis am Belag-Chip ist der eines Klicks („je Teil“ bzw.
  „je Brezel“ = je Teil × Teile). Hell/dunkel nach `prefers-color-scheme`
  (`CssVarsProvider`, Skript vor dem Rendern - kein Aufblitzen), Touch-Ziele ≥ 44 px, die
  Brezel-Vorschau (SVG) trägt Nummern, Legende und Titel - Farbe ist nie der einzige Träger.
  Im Modus „ein Belag je Brezel“ wird eine gemischt belegte Brezel nicht still vereinheitlicht,
  sondern als offen gemeldet. In der Oberfläche heißt es immer „Belag“; „Sorte“ ist das Wort der
  API (`variant`) und steht nur bei Abbildung B.

## Die Vorbestellung: zwei Abbildungen

Später soll aus der Zusammenstellung eine normale Vorbestellung werden (`POST /api/preorders`,
Vertrag B7). Der Prototyp zeigt den Body, sendet ihn aber nicht. Felder: `channel: 'shop'`,
`customerName`, `customerPhone?`, `pickupDate`, `pickupTime?`, `items[{ productId, variant?,
quantity }]`, `note?`. Grenzen der API, die die Builder einhalten bzw. melden: Menge ganzzahlig
1…99, höchstens 50 Positionen, gleiche `productId` + `variant` werden zusammengefasst, `variant`
passt auf `^[a-z0-9]+(?:-[a-z0-9]+)*$` und ist ≤ 64 Zeichen, Anmerkung ≤ 500 Zeichen. Beide
Builder liefern `{ payload, warnings }`; eine zu lange Anmerkung wird mit `…` gekürzt **und**
gemeldet, nie still.

**Die 500 Zeichen reichen nicht für jede Bestellung.** Die Anmerkung trägt die Belagsliste
(„Brezel 1, 2 (groß): Käse, Schinken, Butter; Brezel 3 (klein): 3× Butter“ - gleich belegte
Brezeln einer Größe stehen in einer Gruppe, die Nummern bleiben) **und** den Text der Kundschaft
(≤ 300). Eine gemischte Brezel braucht bis zu ~75 Zeichen; bei zehn verschieden gemischten
Brezeln ist schon die Liste allein länger als 500. Gekürzt ginge in Abbildung B die Zuordnung
Teil → Brezel verloren. Deshalb lehnt die Prüfung ab, statt zu kürzen (`validateNoteFits`): zu
lange Liste → Fehler am Schritt Belag („mehr Brezeln gleich belegen oder Bestellung aufteilen“),
erst mit dem Text zu lang → Fehler an der Anmerkung mit der Zahl der zu kürzenden Zeichen. Was die
Prüfung durchlässt, kürzt die Vorschau nie (Test in `payload.spec.ts`). Für den echten Bestellweg
heißt das: die Belagsliste gehört nicht dauerhaft in die Anmerkung - in Abbildung B tragen die
Positionen die Beläge ohnehin, es fehlt nur die Zuordnung zur Brezel.

|            | A „Produkt je Größe“                                                      | B „Teile mit Sorte“                                                                            |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Positionen | eine je Größe (`partybrezel-klein`, `partybrezel-gross`), Menge = Brezeln | eine je Größe × Belag (`partybrezel-teil-gross` + `variant: 'kaese'`), Menge = Teile           |
| Beläge     | nur in der Anmerkung („Brezel 1 (groß): Käse, Schinken, Butter; …“)       | als Sorte; die Zuordnung Teil → Brezel bleibt in der Anmerkung                                 |
| passt zu   | Zähleinheit „ganze Brezel“ (Q-P1)                                         | Zähleinheit „Teil“; der Backzettel kann Flitteig-Teile (g) und Beläge wie andere Sorten zählen |
| Nachteil   | Backstube liest Beläge aus Freitext; Backzettel kann sie nicht summieren  | mehr Positionen; ein Teil-Produkt mit Sorten muss in hq und `backzettel.yaml` angelegt werden  |

Die Produkt-IDs sind **hypothetisch** - keines dieser Produkte gibt es in hq.

**Warum Beläge über `/api/preorders` heute keinen Preis haben:** der Endpunkt nimmt keine
Preisfelder an; der Server schreibt bei jeder Position den Preis des Produkts aus hq als Snapshot
(`getProduct()` im hq-Katalog), unabhängig von der Sorte. In A kostet jede Brezel also den
Grundpreis, in B jedes Teil den Teil-Preis - Aufpreise je Belag kommen in keiner Variante an.
Dafür bräuchte es entweder Preise je Sorte im Katalog, eigene Produkte je Belag oder einen
Aufpreis-Mechanismus in der API. Die Oberfläche sagt das an der Vorschau.

## Hosting (nicht umgesetzt)

- **(a) Unterpfad der Landing-Pages-Seite**, z. B. `…/partybrezel`: mit
  `PARTYBREZEL_BASE_PATH=/partybrezel` bauen und `apps/bakery-partybrezel/out/` im Deploy-Workflow
  der Landing Page nach `apps/bakery-landing/out/partybrezel/` kopieren, bevor hochgeladen wird.
  Ein Deploy, eine Domain; der Workflow `deploy-to-github-pages.yml` bleibt dafür bewusst
  unverändert, bis das entschieden ist.
- **(b) Eigenes Repo bzw. eigene Pages-Seite** - unabhängig von der Landing Page, eigene URL,
  Basis-Pfad = Repo-Name (`PARTYBREZEL_BASE_PATH=/<repo>`).

In beiden Fällen bleibt die Seite `noindex, nofollow` und ohne Service Worker.

## Wie es weitergeht

1. Q-P1 … Q-P7 mit dem Inhaber klären (am Prototyp; Modus in den Prototyp-Einstellungen
   umschalten, Abbildung A/B vergleichen).
2. hq: Produkt(e) anlegen - je nach Q-P1 Brezel je Größe (A) oder Teil je Größe mit Sorten (B),
   echte Preise (Q-P6) nur dort.
3. Backzettel (Z10): Partybrezel in `hq/config/backzettel.yaml` - Flitteig-Teile mit
   Teigstücken (300 / 400 g), Belag als Variante; der Teig gehört auf den Vortag.
4. Shop / Verwaltung: Erfassung als Vorbestellung (P1-Maske der Verwaltung oder ein künftiger
   öffentlicher Bestellweg im Shop), Belag-Aufpreise je nach Entscheidung oben.
