# bakery-digitale-baeckerei (Digitale Bäckerei)

Der Laden in 3D mit festen Blickpunkten: eigene statische Next.js-App ohne API, nicht im Pilot.
Stand **P1 (MVP)**: drei Blickpunkte (Theke, Brotregal, Regale) mit Kamera-Rig, Produkte antippen →
Karte mit Daten aus hq, Liste „Alles hier“, Ladebild, Ersatz ohne WebGL, Quellen. Dev auf 4222
(`npm run dev:digitale-baeckerei`), Export nach `apps/bakery-digitale-baeckerei/out`
(`npm run build:digitale-baeckerei`, webpack), ausgeliefert auf 4232
(`npm run serve:digitale-baeckerei`). Playwright: `apps/bakery-digitale-baeckerei-e2e`
(`npm run test:e2e:digitale-baeckerei`).

Regeln, die am meisten beißen:

- **Modell und Produktdaten gehören nicht ins Repo.** `build` und `serve` hängen an zwei
  Sync-Targets, die nach `public/` schreiben (git-ignoriert):
  - `sync-model` (`scripts/sync-model.mjs`): lädt `twin.glb` am festen Commit aus `model.lock.json`
    nach `public/model/`, prüft sha256, löscht dort alles, was nicht im Lock steht, und leitet aus
    den `extras` des GLB `public/data/belegung.json` ab (welches Produkt morgens auf welchem Platz
    liegt). `catalogue.json` des Explorers (mit Preisen) wird **nicht** geladen.
  - `sync-products` (`scripts/sync-products.mjs`): liest `hq/products/*.md` (`HQ_PRODUCTS_DIR`, sonst
    `../hq/products`) über `libs/shared/hq-products` und schreibt
    `public/data/products.snapshot.json` **ohne Preise** und nur für Produkte, die im Modell
    liegen. Ohne hq bricht es ab - es gibt keine Mock-Produkte. Felder außerhalb des Vertrags
    oder ein „€“ im Text lassen es scheitern.
  - `build` ist **nie im Nx-Cache** (`"cache": false`): Was in `out/` landet, hängt an Dingen,
    die Nx nicht hasht (git-ignoriertes `public/`, Fixture-Schalter, Unterpfad, hq).
- **Fixture-Modus:** `DIGITALE_BAECKEREI_FIXTURE=1` - beide Targets nehmen das synthetische
  Mini-Modell und den synthetischen Snapshot aus `src/test/fixtures/` (README dort), ohne Download
  und ohne hq. So bauen CI und die Playwright-Suite; deren Server (`serve-fixture.js`) liefert nichts
  anderes aus. Tests, Fixtures und Screenshots im Repo: nur synthetisch (erfundene Produkte wie
  „Testbrot“).
- **Neues Modell = bewusster Schritt:** Commit, sha256, Bytes und Datum in `model.lock.json`
  ändern, dann PR. Nie ein Branch-Name als Stand. Danach die Blickpunkte am echten Modell ansehen.
- **Keine Preise** (DB8) - nicht in Texten, Listen, im Snapshot oder im Bild: Die ins Modell
  gebackenen Preisschilder blendet `preiskarten.ts` aus. Keine Allergene. Nichts erfinden: Ein
  Produkt ohne Einheit zeigt keine, ein Bereich ohne hq-Produkte sagt das („Regale“ heute).
- **three nie statisch importieren.** three steckt nur in `src/lib/scene/` - zur Laufzeit in
  `createViewer.ts`, `loadModel.ts`, `pick.ts`, `interact.ts` (und im Spec-Helfer `testladen.ts`),
  als reiner Typ in `rigControls.ts`, `aussenraum.ts`, `preiskarten.ts` - erreichbar allein über
  `Viewer3D.tsx`, das allein `ladeViewer.ts` per `import()` nachlädt (nicht `next/dynamic`: ein
  gescheiterter Chunk wird so zum Ladefehler mit „Noch einmal versuchen“). In jest wird
  `ladeViewer` gemockt; die Specs, die three brauchen (`pick`, `preiskarten`), laufen über die
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
  `treffer.ts`, `bildausschnitt.ts`, `aussenraum.ts`, `src/lib/produkte/zuordnung.ts`,
  `scripts/model-lock.js`, `belegung.js`, `product-snapshot.js`.
- **Leistung:** Pixeldichte ≤ 2, gerendert wird nur bei Bedarf (kein Dauer-Loop; in Ruhe 0 Bilder),
  eigenes Canvas je Mounten (StrictMode), beim Abbauen alles freigeben (Rig und Picker vor dem
  Modell). Messhaken `window.__digitaleBaeckerei` gibt es nur mit `?debug`.
- **Deutsch, Du-Form.** `noindex, nofollow`, kein Tracking, keine Cookies, keine Fremd-Fonts.
  **Nichts auf dem Gerät speichern** (kein `localStorage`): Hell/dunkel folgt allein per CSS
  `prefers-color-scheme` (`theme.ts`) - kein `CssVarsProvider`, der schreibt `mui-mode`.
  Dark Mode nur für die Bedienelemente, Touch-Ziele ≥ 44 px.
- **Unterpfad:** `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei` beim Build. Der Deploy-Workflow
  und ein Link von der Landingpage kommen erst nach der Abnahme durch den Inhaber (P2).

Tests: `npx nx test bakery-digitale-baeckerei`, `npx nx lint bakery-digitale-baeckerei`,
`npx nx e2e bakery-digitale-baeckerei-e2e`. Plan, Entscheidungen DB1-DB9 und Phasen:
[`docs/apps/digitale-baeckerei.md`](../../docs/apps/digitale-baeckerei.md).
