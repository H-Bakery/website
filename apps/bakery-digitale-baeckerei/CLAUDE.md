# bakery-digitale-baeckerei (Digitale Bäckerei)

Der Laden in 3D mit festen Blickpunkten: eigene statische Next.js-App ohne API und ohne
`@bakery/*`-Libs, nicht im Pilot. Stand **P0 (Spike)**: Modell laden, Morgens-Filter, ein Blickpunkt
(Theke), Kamera fest. Dev auf 4222 (`npm run dev:digitale-baeckerei`), Export nach
`apps/bakery-digitale-baeckerei/out` (`npm run build:digitale-baeckerei`, webpack), ausgeliefert
auf 4232 (`npm run serve:digitale-baeckerei`).

Regeln, die am meisten beißen:

- **Das Modell gehört nicht ins Repo.** `twin.glb` und `catalogue.json` (echte Produkttexte und
  Preise) lädt `scripts/sync-model.mjs` am festen Commit aus `model.lock.json` nach `public/model/`
  (git-ignoriert) und prüft sha256; `build` und `serve` hängen an `sync-model`. Tests, Fixtures und
  Screenshots im Repo: nur synthetisch (erfundene Produkte wie „Testbrot“).
- **Neues Modell = bewusster Schritt:** Commit, sha256, Bytes und Datum in `model.lock.json`
  ändern, dann PR. Nie ein Branch-Name als Stand.
- **Keine Preise** (DB8) - nicht in Texten, Listen oder im Bild.
- **three nie statisch importieren.** three steckt nur in `src/lib/scene/createViewer.ts` und
  `loadModel.ts`, erreichbar allein über `Viewer3D.tsx`, das `DigitaleBaeckerei.tsx` per
  `next/dynamic` (`ssr: false`) nachlädt. In jest wird `Viewer3D` gemockt.
- **Farben:** Renderer-Einstellungen 1:1 aus dem Explorer (kein Tone-Mapping, sRGB-Ausgabe, keine
  Lichter - das Licht steckt in den Vertex-Farben). Nicht „verbessern“.
- **Koordinaten** sind der Zonen-Rahmen des Explorers (x Ost, y Höhe ≈ 244 m, z −Nord) - nicht
  umrechnen. Kamerawerte stehen nur in `src/config/raeume.ts` (Räume → Blickpunkte).
- **Reine Logik ohne three** in `src/lib/scene/fills.ts` (Morgens-Filter) und `view.ts`
  (Hoch-/Querformat) und in `scripts/model-lock.js` (Lock, Prüfsumme) - dort testen.
- **Leistung:** Pixeldichte ≤ 2, gerendert wird nur bei Bedarf (kein Dauer-Loop), eigenes Canvas
  je Mounten (StrictMode), beim Abbauen alles freigeben. Messhaken `window.__digitaleBaeckerei`
  gibt es nur mit `?debug`.
- **Deutsch, Du-Form.** `noindex, nofollow`, kein Tracking, keine Cookies, keine Fremd-Fonts.
- **Unterpfad:** `DIGITALE_BAECKEREI_BASE_PATH=/digitale-baeckerei` beim Build. Der Deploy-Workflow
  und ein Link von der Landingpage kommen erst nach der Abnahme durch den Inhaber (P2).

Tests: `npx nx test bakery-digitale-baeckerei`, `npx nx lint bakery-digitale-baeckerei`. Plan,
Entscheidungen DB1-DB9 und Phasen:
[`docs/apps/digitale-baeckerei.md`](../../docs/apps/digitale-baeckerei.md).
