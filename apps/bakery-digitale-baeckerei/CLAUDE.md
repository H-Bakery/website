# bakery-digitale-baeckerei (Digitale Bäckerei)

Der Laden in 3D mit festen Blickpunkten: eigene statische Next.js-App ohne API, nicht im Pilot.
Stand **P1 (MVP)**: drei Blickpunkte (Theke, Brotregal, Regale) mit Kamera-Rig, Produkte antippen →
Karte mit Daten aus hq, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen. Dazu aus **P4**
die Nahansicht: „In 3D ansehen“ in der Karte, vorerst nur lokal (DB9); aus **P3** der Flug zum Start
und „entdeckt x von y“ in der Liste. Dev auf 4222
(`npm run dev:digitale-baeckerei`), Export nach `apps/bakery-digitale-baeckerei/out`
(`npm run build:digitale-baeckerei`, webpack), ausgeliefert auf 4232
(`npm run serve:digitale-baeckerei`). Playwright: `apps/bakery-digitale-baeckerei-e2e`
(`npm run test:e2e:digitale-baeckerei`).

Regeln, die am meisten beißen:

- **Modell und Produktdaten gehören nicht ins Repo.** `build` und `serve` hängen an drei
  Sync-Targets, die nach `public/` schreiben (git-ignoriert):
  - `sync-model` (`scripts/sync-model.mjs`): lädt `twin.glb` am festen Commit aus `model.lock.json`,
    prüft sha256, **nimmt die Preisschilder heraus** (`scripts/glb-bereinigen.js`: Primitive mit
    Material `preiskarte`/`preisschrift` samt ihren Bytes, dazu die `extras` `source`, `sigma_m`,
    `confidence`), prüft das Ergebnis gegen die zweite Prüfsumme im Lock (`ausgeliefert`) und
    schreibt es nach `public/model/`. Dort löscht es alles, was nicht im Lock steht, und leitet aus
    den `extras` des GLB `public/data/belegung.json` ab (welches Produkt morgens auf welchem Platz
    liegt). Das Original der Quelle liegt nie unter `public/`. `catalogue.json` des Explorers (mit
    Preisen) wird **nicht** geladen.
  - `sync-products` (`scripts/sync-products.mjs`): liest `hq/products/*.md` (`HQ_PRODUCTS_DIR`, sonst
    `../hq/products`) über `libs/shared/hq-products` und schreibt
    `public/data/products.snapshot.json` **ohne Preise** und nur für Produkte, die im Modell
    liegen. Ohne hq bricht es ab - es gibt keine Mock-Produkte. Felder außerhalb des Vertrags
    oder ein „€“ im Text lassen es scheitern.
  - `build` ist **nie im Nx-Cache** (`"cache": false`): Was in `out/` landet, hängt an Dingen,
    die Nx nicht hasht (git-ignoriertes `public/`, Fixture-Schalter, Unterpfad, hq).
  - `sync-produkte-3d` (`scripts/sync-produkte-3d.mjs`): kopiert die 3D-Modelle einzelner Produkte
    (Nahansicht) am Commit aus `produkte-3d.lock.json` aus dem **nur lokalen** Daten-Repo
    `../produkte-3d` (`PRODUKTE_3D_DIR`; in einem Worktree immer setzen) nach `public/produkte-3d/`,
    prüft sha256 und schreibt `public/data/produkte-3d.json`. **Fehlt das Daten-Repo (CI, Deploy,
    andere Rechner): leerer Index, Exit 0** - das darf nie einen Build brechen.
- **Fixture-Modus:** `DIGITALE_BAECKEREI_FIXTURE=1` - alle drei Targets nehmen das synthetische
  Mini-Modell, den synthetischen Snapshot und das eine synthetische Produkt-Modell (`testbrot-500g`)
  aus `src/test/fixtures/` (README dort), ohne Download, ohne hq und ohne Daten-Repo. So bauen CI
  und die Playwright-Suite; deren Server (`serve-fixture.js`) liefert nichts anderes aus. Tests,
  Fixtures und Screenshots im Repo: nur synthetisch (erfundene Produkte wie „Testbrot“).
- **Neues Modell = bewusster Schritt:** Commit, sha256, Bytes und Datum in `model.lock.json`
  ändern, dazu `ausgeliefert` (sha256 und Bytes der bereinigten Datei - `sync-model` nennt die
  Ist-Werte, wenn sie nicht passen), dann PR. Nie ein Branch-Name als Stand. Danach die Blickpunkte
  am echten Modell ansehen, das Brotregal aus der Nähe. Dasselbe gilt nach jeder Änderung an
  `glb-bereinigen.js`. Kennt die Bereinigung den Aufbau eines neuen Modells nicht (Texturen,
  Animationen, fremde Extensions), bricht sie ab.
- **Nahansicht „In 3D ansehen“ (P4):** Den Knopf in der Karte gibt es nur für Produkte, die im
  Index stehen - kein Ersatzmodell, ohne Index kein Knopf und kein Fehler. Die echten Modelle
  gehören der Bäckerei und nie in dieses Repo. Neues Modell: Commit in `produkte-3d` → `commit`,
  `sha256`, `bytes` in `produkte-3d.lock.json` → PR. `createNahansicht.ts` hat einen **eigenen
  Renderer** mit Licht wie die Vorschau des Daten-Repos (`RoomEnvironment` 0,75, ein Richtungslicht,
  `NeutralToneMapping`) - diese Modelle sind beleuchtetes PBR, der Laden bleibt unlit. Nachgeladen
  nur über `ladeNahansicht.ts`, Modell erst beim Öffnen; beim Schließen alles freigeben, auch die
  von three geteilte `DFG_LUT`-Textur (`loeseGeteilteTexturen`, sonst bleibt je Öffnen ein
  WebGL-Kontext hängen - die Playwright-Suite zählt nach). Grenzen des Drehtellers: `drehteller.ts`.
- **Keine Preise** (DB8) - nicht in Texten, Listen, im Snapshot, im Bild oder in der Modell-Datei:
  Die ins Modell gebackenen Preisschilder nimmt `sync-model` heraus; `preiskarten.ts` blendet als
  zweite Sicherung aus, was trotzdem ankäme (am echten Modell heute 0). Keine Allergene. Nichts erfinden: Ein
  Produkt ohne Einheit zeigt keine, ein Bereich ohne hq-Produkte sagt das („Regale“ heute).
- **three nie statisch importieren.** three steckt nur in `src/lib/scene/` - zur Laufzeit in
  `createViewer.ts`, `loadModel.ts`, `pick.ts`, `interact.ts` (und im Spec-Helfer `testladen.ts`),
  `createNahansicht.ts`, als reiner Typ in `rigControls.ts`, `aussenraum.ts`, `preiskarten.ts` -
  erreichbar allein über `Viewer3D.tsx`, das allein `ladeViewer.ts` per `import()` nachlädt (nicht
  `next/dynamic`: ein gescheiterter Chunk wird so zum Ladefehler mit „Noch einmal versuchen“); die
  Nahansicht ebenso allein über `ladeNahansicht.ts`. In jest werden `ladeViewer` und
  `ladeNahansicht` gemockt; die Specs, die three brauchen (`pick`, `preiskarten`), laufen über die
  Transform-Ausnahme in `jest.config.ts`, ohne WebGL.
- **Wer was macht:** `createViewer.ts` verdrahtet nur. Kamera: `rig.ts` (Rechnung) +
  `rigControls.ts` (Zeiger, Tasten). Antippen: `treffer.ts` (Rechnung) + `pick.ts`. Hervorhebung:
  `interact.ts`. Karte verdeckt das Produkt: `bildausschnitt.ts`. Daten: `src/lib/produkte/`.
  Bedienelemente in `src/components/` sind reines React/MUI ohne three und ohne fetch; den Zustand
  hält `DigitaleBaeckerei.tsx`. Die Szene wird nur neu gebaut, wenn sich das Modell ändert -
  Blickpunkt, Beschriftung und Auswahl gehen an die laufende Szene.
- **Farben:** Renderer-Einstellungen 1:1 aus dem Explorer (kein Tone-Mapping, sRGB-Ausgabe, keine
  Lichter - das Licht steckt in den Vertex-Farben). Nicht „verbessern“.
- **Koordinaten** sind der Zonen-Rahmen des Explorers (x Ost, y Höhe ≈ 244 m, z −Nord) - nicht
  umrechnen. Kamerawerte und welches Möbel zu welchem Blickpunkt gehört, stehen nur in
  `src/config/raeume.ts`; die Playwright-Suite liest sie von dort.
- **Reine Logik ohne three** dort testen, wo sie steht: `fills.ts`, `view.ts`, `rig.ts`,
  `treffer.ts`, `bildausschnitt.ts`, `aussenraum.ts`, `drehteller.ts`, `intro.ts`,
  `src/lib/produkte/zuordnung.ts`, `modelle.ts`, `entdeckt.ts`, `scripts/model-lock.js`, `glb-bereinigen.js`
  (auch der eine Leser für GLB-Container), `belegung.js`, `product-snapshot.js`,
  `produkte-3d-lock.js`.
- **Flug zum Start (P3):** Weg und Zeitplan je Raum in `raeume.ts` (`intros`, Stützpunkte aus dem
  Explorer - nicht verschieben, ohne die Bilder am echten Modell neu anzusehen), Rechnung in
  `intro.ts`, geführt von `createViewer.ts` mit eigenem Takt nur für die Dauer des Flugs; das Rig
  ist so lange gesperrt (`sperren`). Einmal je Seitenaufruf, **nichts wird gemerkt**; aus mit
  `?intro=0` und bei `prefers-reduced-motion`. Ein Flug mit `braucht` wird nur angeboten, wenn das
  Modell einen Knoten mit diesem Namensanfang hat. Die Playwright-Suite öffnet mit `?intro=0`
  (`oeffne()`), nur `intro.spec.ts` mit Flug. „Entdeckt“ (`entdeckt.ts`) lebt nur im Arbeitsspeicher.
- **Leistung:** Pixeldichte ≤ 2, gerendert wird nur bei Bedarf (kein Dauer-Loop; in Ruhe 0 Bilder),
  eigenes Canvas je Mounten (StrictMode), beim Abbauen alles freigeben (Rig und Picker vor dem
  Modell). Messhaken `window.__digitaleBaeckerei` gibt es nur mit `?debug`.
- **Deutsch, Du-Form.** `noindex, nofollow`, kein Tracking, keine Cookies, keine Fremd-Fonts.
  **Nichts auf dem Gerät speichern** (kein `localStorage`): Hell/dunkel folgt allein per CSS
  `prefers-color-scheme` (`theme.ts`) - kein `CssVarsProvider`, der schreibt `mui-mode`.
  Dark Mode nur für die Bedienelemente, Touch-Ziele ≥ 44 px.
- **Unterpfad und Deploy:** `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei` beim Build.
  `deploy-to-github-pages.yml` baut die App mit hq (Deploy-Key nur lesend, nur `products/`) und hängt
  sie unter `/digitale-baeckerei/` in den Export der Landingpage. Davor läuft der Wächter
  `scripts/pruefe-export.mjs` (`export-pruefung.js`): nur das bereinigte Modell aus dem Lock, Snapshot
  im Vertrag, kein „€“, kein Fixture - sonst kein Deploy. Wer etwas Neues nach `public/` oder in den
  Snapshot legt, muss es dort erlauben. Logs sind öffentlich: nie Inhalte aus hq ausgeben.
  Der Link von der Landingpage kommt erst nach der Abnahme durch den Inhaber.

Tests: `npx nx test bakery-digitale-baeckerei`, `npx nx lint bakery-digitale-baeckerei`,
`npx nx e2e bakery-digitale-baeckerei-e2e`. Plan, Entscheidungen DB1-DB9 und Phasen:
[`docs/apps/digitale-baeckerei.md`](../../docs/apps/digitale-baeckerei.md).
