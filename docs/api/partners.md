# Partners (B6): Backschrank CAP-Markt

Formulas once in `apps/bakery-api/src/services/partner-stats.core.js` (shared with the tests -
until B12 also with the mock; `partner-stats.service.ts` is only a typed wrapper). Routes in `src/routes/partner.routes.ts`,
`createPartnerRouter({ productsDir })` - `app.ts` passes the hq products dir, so products and
partners read the same catalogue. Slug and weekday rules live in `partner-import.core.js` and are
shared by the routes and the import. Domain rules (visits, open/incomplete days, `countedQty: null`
vs `0`, discrepancies, CSV formula escaping) are in [../domains/verkaufspartner.md](../domains/verkaufspartner.md).

| Endpoint                                                                                                                                                         | Who                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `GET /api/partners[?active=]`, `GET /:id`, `/:id/templates`, `/:id/visits[?from&to]`, `/:id/visits/today[?date]`, `/:id/stats`, `/:id/report`, `/:id/report.csv` | any session                    |
| `POST /:id/visits`, `PATCH /:id/visits/:visitId`, `DELETE /:id/visits/:visitId`                                                                                  | `inhaber`, `verkauf`, `fahrer` |
| `POST /api/partners`, `PUT /:id`, `PUT /:id/templates/:weekday`                                                                                                  | `inhaber`                      |

Shapes are the mock's (D3; `tests/contract/partners.contract.test.ts` covers all 14 routes against
the recorded mock, the CSV
byte-exact): visits as `PlainVisit`, `DELETE` → 200 `{ id, deleted: true, message: 'Besuch
gelöscht.' }`, template `PUT` → 200 (also on create). Errors via `sendError` (`success: false`,
`error`, German `message`): 400 `INVALID_NAME` / `INVALID_SLUG` / `INVALID_ACTIVE` /
`INVALID_SETTLEMENT_MODEL` / `INVALID_WEEKDAY` / `INVALID_ITEMS` / `INVALID_VISIT_TYPE` /
`INVALID_VISIT_AT` / `INVALID_BUSINESS_DATE` / `INVALID_RANGE` / `INVALID_TEXT` / `TEXT_TOO_LONG`,
401 `unauthorized`, 403 `forbidden` (the role check runs before the 404), 404 `PARTNER_NOT_FOUND`
/ `VISIT_NOT_FOUND`, 409 `PARTNER_SLUG_TAKEN` / `DUPLICATE_INITIAL_VISIT`, 503 `hq_unavailable`,
500 `*_FAILED`.

## What to know before changing it

- **Visit items are resolved against the hq catalogue** (`catalogueFor(productsDir)`, read clone =
  approved prices): by slug, else by `numeric_id` (the mock's `findHQProduct` order), through
  `validateVisitItems(items, lookup)`. Name and ids come from hq; the price from hq unless the
  request sends one (mock rule). PATCH adds the stored snapshot as a fallback
  (`snapshotLookup`), so a product removed from hq stays correctable; POST does not. An unknown
  product while the catalogue directory is missing is 503 `hq_unavailable`, not a 400.
  Integration tests that post visits with items need a synthetic catalogue:
  `createTestApp({ app: { hqProducts: { productsDir: makeProductsDir(), writeDir: null } } })`.
- **Prices and names are snapshots** on `PartnerVisitItem`, so a later hq price change does not
  alter old settlements.
- **The duplicate-initial check (POST and PATCH) and the slug check run inside the write
  transaction** (`assertNoOtherInitial` / `assertSlugFree` throw a `RouteError` that rolls back and
  is answered with its code). Write transactions are serialised (see [overview](overview.md)), so
  this check-then-insert cannot race: two parallel initial visits give exactly one 201 and one 409.
  A PATCH that moves a visit to another day gives it the next `sequence` there.
- **Attribution (D5):** `staffId` = `req.user.id` (a body `staffId` is ignored), `staffName`
  defaults to `req.user.displayName`. `audit()` in the write's transaction: `partner`
  create/update (field names only, no contact data), `partner_template` create/update,
  `partner_visit` create/update/delete (delete stores the whole visit, so a mistaken delete can be
  reconstructed).
- **Template `PUT`** fills `productId`/`productSlug` from hq, drops quantity 0, keeps `active`
  when the body does not name it (otherwise every save re-activated the template). It validates
  like visits (`validateTemplateItems` in the core): quantity an integer 0…10000 (`2.5`, `-3`,
  `1e9` are 400 `INVALID_ITEMS`, not truncated or dropped), the product must be in hq **or already
  in the stored template** (so a product removed from hq does not block saving), no duplicates; hq
  missing → 503. The quantity flows unchecked into the Backzettel CAP column, so this is the only
  gate.
- **Limits:** partner text fields (`name` 120, `slug` 80, `street`/`city`/`contactName` 120, `zip`
  16, `phone` 40, `email` 200, `notes` 2000) and visit `staffName` 120 / `note` 2000 → 400
  `TEXT_TOO_LONG`; control/bidi characters → 400 `INVALID_TEXT` (`control-chars.core.js`); a
  visit's business day must lie between 2020-01-01 and today + 7 days (POST and PATCH) → 400
  `INVALID_BUSINESS_DATE`; an explicit `visitAt` must lie at most one day from the business day
  (400 `INVALID_VISIT_AT`).
- **Deliberate deviations from the mock:** error codes; `GET …/templates` does not create empty
  templates on read; `from > to` is 400; PATCH with `visitAt` alone keeps the business day; an
  unknown `settlementModel` is 400; the template item checks and the limits above (the mock
  truncated/dropped and had no limits - the contract suite only sends valid input there).
- The management app downloads the CSV through `apiClient.getBlob()` with the Bearer token
  (`downloadReportCsv()` in `apps/bakery-management/src/lib/partnerApi.ts`); a plain link would
  get 401.

## `import-partners` CLI

```bash
npm run build:api
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- --file apps/bakery-api/data/partner-store.json --dry-run
DB_PATH=/var/lib/bakery/bakery.db npm run api:import-partners -- --file apps/bakery-api/data/partner-store.json [--update-partners]
```

Copies the former mock's `partner-store.json` (gitignored, deleted with the mock in B12 - such a
file is now only input for this CLI) into SQLite (`DB_PATH`, server rules, runs migrations).
Rules in `src/services/partner-import.core.js` (`planImport`: normalise, natural keys, problems),
writes in `partner-import.service.ts` (`importPartnerStore`): **one** serialised transaction,
all or nothing.

- **Idempotent:** partners by slug (existing ones untouched unless `--update-partners`), templates
  by partner + weekday (same), visits by partner slug + business day + type + `visitAt` (existing
  ones skipped, never changed).
- Items keep their price/name snapshot from the file (no hq lookup) but must pass
  `validateVisitItems`; the mock's `staffId` is dropped (it points at no user), `staffName` stays.
- A visit that fails the rules, or an initial visit on a day that already has another one in the
  database, is skipped and listed. `--dry-run` runs the same transaction and rolls it back (it
  still migrates a fresh `DB_PATH`). One `audit_log` row (`import`, `partner_store`).
- Exit 0 = all imported or already there, 2 = entries skipped (listed), 1 = unusable file (checked
  before the database is opened) or error.

Tests: `tests/unit/partnerStats.test.js`, `tests/unit/partnerImportCore.test.js`,
`tests/integration/partners.test.ts`, `tests/integration/partnerImport.test.ts`,
`tests/integration/partnerImportCli.test.ts`, `tests/contract/partners.contract.test.ts`; fixture
`tests/fixtures/partner-store.synthetic.json`.
