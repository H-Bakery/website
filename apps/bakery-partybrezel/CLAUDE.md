# bakery-partybrezel (Partybrezel-Prototyp)

Klickbarer Prototyp „Partybrezel selbst zusammenstellen“ (Größe → Belag → Abholung → Übersicht):
eigene statische Next.js-App ohne API und ohne `@bakery/*`-Libs, kein Pilot-Bildschirm. Dev auf
4221 (`npm run dev:partybrezel`), Export nach `apps/bakery-partybrezel/out`
(`npm run build:partybrezel`, webpack), ausgeliefert auf 4231 (`npm run serve:partybrezel`).

Regeln, die am meisten beißen:

- **Fest ist nur:** Flitteig, klein 3 × 300 g, groß 3 × 400 g, Teig am Vortag, Abholung am
  Backtag, Montag Ruhetag. Für eine Abholung am **Dienstag** widersprechen sich die beiden letzten
  Regeln: `doughOnRuhetag` markiert den Tag, die Seite nennt dann die offene Frage (Q-P4/Q-P7) -
  kein „Teig am Montag ansetzen“ erfinden. Alles andere (Q-P1 … Q-P7) ist offen und steht als
  `// PLATZHALTER Q-P…` **nur** in `src/config/partybrezel.config.ts`; Komponenten haben keine
  eigenen Werte. Preise und Produkt-IDs sind erfunden - echte Werte nie hierher (Repo öffentlich).
- **Rechnen in `src/lib/`, reines TS:** Preise in ganzen Cent, Abholtage aus einem
  hineingereichten „heute“ (`pickupDates(today, …)`, nie `new Date()` darin; die Seite bestimmt
  es erst im Browser mit `todayInBerlin`, sonst gälte das Build-Datum).
- **Nichts wird gesendet.** Die Übersicht zeigt den Body für `POST /api/preorders` in zwei
  Abbildungen (A „Produkt je Größe“, B „Teile mit Sorte“), ohne Preisfelder. Belagsliste +
  Anmerkung ≤ 500 Zeichen: zu lang lehnt die Prüfung ab (`validateNoteFits`), statt zu kürzen.
- **Belag-Modus** (`per-part` / `per-pretzel`): eine gemischt belegte Brezel im Modus je Brezel
  wird als offen gemeldet, nie still vereinheitlicht.
- **Steuerzeichen** prüft `src/lib/validation.ts` mit einer Kopie der API-Regel
  (`apps/bakery-api/src/services/control-chars.core.js`) - bei Änderungen dort nachziehen.
- **3D-Ansicht** (Schritt Belag): Geometrie rein in `src/lib/pretzel3d.ts`, three.js nur in
  `PretzelPreview3D.tsx`, nachgeladen über `PretzelView` (`next/dynamic`) - three nie statisch
  importieren. Ohne WebGL 2D mit Hinweis; in jest wird die Komponente gemockt.
- **Unterpfad:** `PARTYBREZEL_BASE_PATH=/partybrezel` beim Build setzt `basePath`/`assetPrefix`;
  Hosting ist nicht umgesetzt, der Deploy-Workflow bleibt unverändert.

Tests: `npx nx test bakery-partybrezel`, `npx nx lint bakery-partybrezel`. Details, Abbildungen A/B,
Hosting-Optionen: [`docs/apps/partybrezel.md`](../../docs/apps/partybrezel.md).
