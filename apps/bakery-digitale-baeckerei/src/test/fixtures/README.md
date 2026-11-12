# Test-Fixtures

Hier liegen ab P1 das **synthetische** Mini-GLB und der synthetische Katalog für Unit- und
Playwright-Tests (erfundene Produkte wie „Testbrot“, keine Preise).

Das echte Modell (`twin.glb`, `catalogue.json`) gehört **nicht** ins Repo: `scripts/sync-model.mjs`
lädt es nach `public/model/` (git-ignoriert). In P0 bauen die Specs ihre Mini-Bäume direkt im Test
(`src/lib/scene/fills.spec.ts`).
