# Recipes (`/api/recipes`)

Recipes are the Markdown files in `hq/data/recipes/<category>/<file>`. The API reads them into one
structured model and writes edits back to hq like products and Grundmengen (B5/B5b). Rules as seen
from outside: [`docs/domains/rezepte.md`](../domains/rezepte.md).

**Code** in `apps/bakery-api/src/`: parsing, serialising, validation, slugs and references in
`services/recipe-file.core.js` (dependency-free CommonJS, the **only** recipe parser -
`backzettel-recipes.core.js` builds its filling tables and gram amounts on
`scanIngredientTables`/`readQuantity` from it), file I/O + git in `services/recipes.service.ts`,
routes in `routes/recipes.routes.ts`, approved versions in `HqEditsSync.approvedRecipeFiles()`.

## Endpoints

Mounted below the session guard; every answer is `{ success: true, data }`, every error
`{ success: false, error, message }` (German `message`).

| Endpoint                              | Who                                        | Answer                                                                 |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /api/recipes[?category=&q=]`     | `inhaber`, `backstubenleiter`, `backstube` | `data: RecipeList`                                                     |
| `GET /api/recipes/:category/:slug`    | same                                       | `data: Recipe`; 404 `not_found`                                        |
| `POST /api/recipes`                   | `inhaber`, `backstubenleiter`              | 201 `{ success, data: Recipe, pending, changed: true }`                |
| `PUT /api/recipes/:category/:slug`    | `inhaber`, `backstubenleiter`              | 200 `{ success, data: Recipe, pending, changed }`                      |
| `DELETE /api/recipes/:category/:slug` | `inhaber`, `backstubenleiter`              | 200 `{ success, data: { id, deleted: true }, pending, changed: true }` |

`verkauf` and `fahrer` get 403 everywhere, no session 401. A PIN session at a station is enough
(the Backstube tablet). `backstubenleiter` passes the `backstube` guard through `ROLE_INCLUDES`
(`auth-crypto.core.js`, see [auth.md](auth.md)).

`id` = `<category>/<slug>` - also the path of the API. `category` is the directory
(`breads | rolls | baguettes | snacks | cakes | fillings | special | teige`), `slug` is derived from
the file name (`Gefüllte-Testkränze.md` → `gefuellte-testkraenze`, `slugsForFiles`; equal results get `-2`,
`-3` in name order). The id is never turned into a path: it is looked up in the directory listing,
so `..`, encoded slashes or `Testkuchen.md` are plain 404s.

### `RecipeList`

```jsonc
{
  "status": "ok", // or "no-data" (+ "message") when hq has no data/recipes
  "categories": [{ "id": "breads", "label": "Brote", "count": 2, "writable": true }], // all known ones, counts unfiltered; teige: writable false
  "recipes": [RecipeSummary], // sorted by category order, then title
  "count": 12,
  "units": ["g", "kg", "ml", "l", "mg", "cl", "dl", "Stück", "Stk.", "TL", "EL", "Prise", "…"], // what `unit` accepts
  "writable": true, // a write target exists (says nothing about the role)
  "writeIssue": null, // or { error, message } - the 503 a write would get
  "canDelete": true, // deleting and moving are switched on
  "deleteIssue": null // German reason when not
}
```

`?category=` filters by directory (unknown or repeated = nothing), `?q=` searches title, ingredient
names, group names, tags and file name - all words, case- and accent-insensitive.

### `RecipeSummary` and `Recipe`

```jsonc
{
  // RecipeSummary
  "id": "breads/musterkruste",
  "category": "breads",
  "categoryLabel": "Brote",
  "slug": "musterkruste",
  "file": "Musterkruste.md",
  "path": "data/recipes/breads/Musterkruste.md", // in hq
  "format": "standard", // standard | table | teig | unknown
  "title": "Musterkruste",
  "yield": "3 Laibe à 700g", // free text of the file; null = offen
  "ingredientCount": 13,
  "editable": true,
  "readOnlyReason": null, // German, when editable is false
  "pendingApproval": false, // = pending !== null
  "pending": null, // null | "created" | "changed" | "deleted"
  "usedByBackzettel": [
    {
      "kind": "filling",
      "id": "nuss",
      "name": "Testnussfüllung",
      "section": "Testnussfüllung"
    }
  ],

  // Recipe (detail) adds
  "description": "…", // string | null
  "parts": [
    {
      "title": "Hauptteig", // null = unnamed (only the first part in list form)
      "ingredients": [
        { "name": "Salz", "amount": 23, "unit": "g", "note": null }
      ],
      "total": null // { label, text }: the file's own total row, display only
    }
  ],
  "steps": [
    { "title": "Backen", "ordered": true, "items": ["Ofen vorheizen", "…"] }
  ],
  "notes": "- **Haltbarkeit:** 5 Tage", // Markdown text | null
  "meta": [
    {
      "key": "baking.temperature",
      "label": "Backtemperatur (°C)",
      "value": "228"
    }
  ], // rest of the YAML head, display only
  "sections": [{ "title": "Fehlerquellen", "text": "- …" }], // sections the model does not interpret, verbatim, display only
  "version": "9f2c…", // 24 hex chars; send back as expectedVersion
  "deletable": true,
  "deleteBlockedReason": null // German: Backzettel uses it / switched off / teig / already deleted
}
```

- `amount: null` = the amount is open - never 0. `unit` is then `null` too. In table files a
  quantity that is no plain number (`3–6 g (nach Geschmack)`) is `amount: null` with the text in
  `note`; `120 g (nach Bedarf)` is `120`, `g`, `note: "nach Bedarf"`.
- A step is one string; sub-points of a step are further lines of it, indented
  (`"Laibe formen:\n   - straff aufrollen"`).
- `ordered: false` = bullet points (`- **Stockgare:** 35 Minuten`), `true` = numbered.

### Writing

**`POST`** body: `{ title, category, yield?, description?, parts?, steps?, notes? }`. Creates
`data/recipes/<category>/<slug>.md` in the standard format, with only what was given (no invented
defaults). `category` must be a known, writable one (not `teige`).

**`PUT`** body: `{ expectedVersion, title?, category?, yield?, description?, parts?, steps?, notes? }`.
A field that is missing stays as it is; `null`/`""`/`[]` empties it. `total`, `meta` and `sections`
are ignored. A different `category` **moves** the file (same file name). Empty ingredient rows and
empty steps are dropped. The answer is the recipe as read back from the written file - the file
decides the final shape (in list files a `note` becomes part of the name, a name typed as
`2 Eier` comes back as amount 2 + name `Eier`).

**`DELETE`**: `expectedVersion` in the JSON body or as `?expectedVersion=`.

`pending` (top level) = the recipe now waits for approval in the hq PR; `changed: false` = the save
changed nothing (nothing written, nothing committed, no audit row).

### Errors

| Status | `error`                                                          | When                                                                                                  |
| ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 400    | `validation`                                                     | bad input (German reason: missing name, amount ≤ 0, unknown unit, `\|` in a name, heading in notes …) |
| 400    | `invalid_recipe_file`                                            | the input would not read back from the file as entered (e.g. a title ending in `(…)` in a table file) |
| 400    | `invalid_category`                                               | unknown or read-only category (create, move)                                                          |
| 400    | `invalid_id`                                                     | no file name can be derived from the title                                                            |
| 400    | `version_required`                                               | `expectedVersion` missing (PUT, DELETE)                                                               |
| 404    | `not_found`                                                      | no such recipe                                                                                        |
| 409    | `stale_recipe`                                                   | the file changed since `expectedVersion` (carries `currentVersion`)                                   |
| 409    | `recipe_exists`                                                  | create/move: a recipe of that name is already in the category                                         |
| 409    | `recipe_read_only`                                               | teig recipe, or a file the parser does not fully understand (`message` = the reason)                  |
| 409    | `recipe_in_use`                                                  | delete/move of a recipe `config/backzettel.yaml` points at (carries `usedByBackzettel`)               |
| 409    | `recipe_section_in_use`                                          | an edit would rename or remove the part the Backzettel reads                                          |
| 409    | `recipe_deleted`                                                 | the recipe is deleted and waits for approval                                                          |
| 409    | `recipe_delete_unavailable`                                      | deleting/moving is switched off (see below)                                                           |
| 409    | `hq_write_out_of_sync`                                           | delete/move of a file the write worktree does not have yet                                            |
| 500    | `hq_commit_failed`                                               | git refused the commit; the files are restored                                                        |
| 503    | `hq_unavailable`                                                 | no recipes directory (development)                                                                    |
| 503    | `hq_write_unavailable` / `hq_write_wrong_branch` / `repo_locked` | as for the products ([hq-products.md](hq-products.md))                                                |

## How it works

- **Lossless by regions.** `parseRecipeFile` cuts a file into regions whose raw text adds up to the
  file (YAML entries, `# title`, intro, one region per top-level section, footer), groups inside a
  section and lines inside a group. `applyRecipeInput` writes back raw text wherever the value is
  unchanged - per region, per group, per line - and renders only the rest in the file's own style.
  A no-op is byte-identical by construction; an edited amount changes one line. The result is parsed
  again and compared with the input; a mismatch is `invalid_recipe_file` and nothing is written.
- **Values that come back unchanged are not validated again** (limits, amount > 0, control
  characters): an unchanged save never fails on something the file already contains.
- **Read-only instead of lossy.** Anything in a structured section the parser does not understand
  (free text between ingredients, a three-column table, mixed numbered/bulleted steps, an
  unterminated YAML head …) makes the file `editable: false` with a reason naming the line. Teig
  recipes (`teige/`, U10 format) are always read-only: hq validates their sums in CI, a wrong edit
  would block the rolling PR.
- **Working version.** With `HQ_WRITE_DIR` the service serves the file of the write worktree (what a
  PUT builds on), else the approved one. Approved = `origin/main` of the write clone
  (`approvedRecipeFiles()`, refreshed with every fetch) while the sync is enabled, else the read
  clone. `pending`: in the worktree only = `created`, different = `changed`; approved but missing
  in the worktree **and** deleted in the branch's history (`git log --no-renames --diff-filter=D`)
  = `deleted` (served from the approved content, read-only) - a recipe added on main by hand and
  not rebased in yet is not mistaken for a deletion.
- **Writes** go through one queue under the repo lock (`withRepoLock`, shared with rebase/push):
  atomic file write, `git add -A -- <paths>`, commit **with the pathspec**, author and committer
  `Verwaltung (App)`, message `recipes: <Titel> (<category>/<file>) angelegt|geändert|gelöscht|verschoben`
  plus `Co-authored-by: <displayName> <user-<id>@bakery.local>` (never the login, D13), then
  `afterCommit` → `HqEditsSync` pushes into the rolling PR. A failed commit restores every file and
  unstages. Without `HQ_WRITE_DIR` (development) the read directory is written directly, no git;
  in production that is 503.
- **Audit:** every changing write also adds an `audit_log` row (`create | update | delete`, entity
  `recipe`, id `<category>/<slug>`, data `{ path, title, pending, movedFrom? }`), after the commit
  and without failing the request.
- **Backzettel references:** `collectRecipeReferences` takes every `recipe:` path of
  `config/backzettel.yaml` (`fillings[]` today; `doughs[]` as soon as one is written there), from
  the approved file **and** the write worktree's. Such a recipe cannot be deleted or moved; an edit
  must leave every referenced part resolvable - checked with the Backzettel's own
  `findRecipeForReference` before and after.
- **Files that count:** regular files directly in a category directory (`[a-z0-9][a-z0-9_-]*`),
  named `*.md` or without extension, not hidden, not `_…`, not `README`, ≤ 512 kB. Symlinks, other
  types and nested directories are ignored. A file that is not valid UTF-8 is read-only.

## Deleting and moving are switched off on the box (for now)

hq's path guard (`hq/scripts/validate/check-paths.js`) rejects every deletion on `app/edits` - a
deleted or moved recipe would turn the rolling PR red and block product and Grundmengen approvals
with it. So with a write dir, `DELETE` and a category change answer 409 `recipe_delete_unavailable`
(`canDelete: false` in the list) unless `HQ_RECIPES_ALLOW_DELETE=1` (option `allowDelete`). Set it
on the box only after hq allows `D` below `data/recipes/**`. Without a write dir (development,
E2E) and in `setup-dev` it is on.

## Configuration

`HQ_RECIPES_DIR`, else `${HQ_DIR}/data/recipes` (the Backzettel's hq root). Write dir, branch and
production flag are the products' (`HQ_WRITE_DIR`, `HQ_WRITE_BRANCH`).
`createApp({ recipes: { recipesDir, writeDir, allowDelete, production, … } })` overrides (tests).

## Synthetic recipes

`tools/e2e/hq-recipes/` holds invented recipes in every format variant (not touched by Prettier).
The E2E hq (`prepareE2eHq()`, `HQ_RECIPES_DIR`) and `setup-dev` (`make-hq.js`) copy them;
`setup-dev` also seeds `verify.leitung` (role `backstubenleiter`).

## Tests

`tests/unit/recipeFileCore.test.js` (formats, zero diff for every fixture, minimal diffs, new file,
validation, read-only cases, slugs - **and the same proofs over the real `hq/data/recipes` when it
lies next to the repo**, skipped in CI), `tests/integration/recipes.test.ts` (401/403 matrix for
all five roles, reading, both write modes, stale versions, Backzettel references, delete/move,
audit), `tests/integration/recipesHqSync.test.ts` (rolling PR, merged edits and deletions against a
bare origin), `tests/integration/backstubenleiter.test.ts` (the role in user administration and on
every guard `backstube` passes). The Backzettel's own suites pin that its filling recipes read as
before.
