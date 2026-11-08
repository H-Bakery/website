# Backzettel v2 (Z10) – design

Status: design record, 08.11.2026. Branch `feat/Z10-backzettel-v2`: slices S1–S6 built (see §10);
the rules as built are in `docs/domains/backzettel.md` and `docs/api/backzettel.md`.
Scope: roadmap Z10 (on `docs/claude-md-cleanup`), domain reference `hq/notes/procedures/backliste.md`
(private). **Every number in this document is invented.** Real quantities, the reference values of
Anhang A and the kg/L table derived from the paper sheets stay in `hq`.

Reading order for implementers: §1 (what changes), §2 (YAML), §3 (unknown values), then the
section of your slice (§10).

---

## 1. Summary

The bakers work by **dough day**, not by bake day. Rolls are made the day before they are baked;
Saturday makes Sunday's and Tuesday's rolls; Sunday only bakes. Bread is counted in **loaves per
size**, rolls in **Bruch** (one press of the divider), and the number the baker sets at the
kneader is **litres** (1 L of water plus the rest of the recipe), which follow from the dough
weight - never the other way round.

v2 keeps every v1 mechanism and adds four ideas on top:

| Idea                  | YAML                                                                 | Core                          | Where it shows                                                                        |
| --------------------- | -------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| Dough day ≠ bake day  | `dough_days`, `items[].lead`                                         | `backzettel-plan.core.js`     | the sheet of day D collects lines of several bake days; a slim bake list per bake day |
| Doughs as master data | `doughs[].kg_per_liter`, `liter_rounding`, `combined_with`, `addons` | `backzettel-dough.core.js`    | machine strip: kg, L (or "unbekannt"), batches, Dunkelsauer-style add-ons             |
| Bread by size         | `items[].sizes`, `products[].size`, `from_dough`                     | sizes are the item's variants | bread table with one column per size                                                  |
| Rolls in Bruch        | `items[].bruch`, top-level `bruch_pieces`                            | Bruch groups per bake day     | "2 Bruch × 1200 g – 12 Stern, 8 Käse (+0 frei)"                                       |

**Compatibility rule:** an item without `lead` has lead 0, so its dough day is its bake day. A
config without the new keys (today's `hq/config/backzettel.yaml`) therefore yields sheets that are
**identical** to v1 days (regression test S2-R1), and every endpoint keeps its v1 shape plus
additive fields. One deliberate difference (review Z10 round 2): where today's file leaves a
Grundmenge open (`null`), the dough sheet no longer counts it as 0 - Hefeteig kg, litres and
batches of that dough become unknown (`dough_g: null`, „≥ kgKnown", „Chargen: unbekannt") where
v1 showed a number, and a line with an open base shows its known part as a minimum
(`totalIsMinimum`, „≥ 4"). Set the Grundmengen in hq before the deploy where the number is
needed.

**Unknown rule:** every open master value is `null` in YAML, travels as `null` plus a reason
through core and API, and is shown as "unbekannt"/"–" with a hint. Nothing is estimated or
defaulted (§3).

---

## 2. YAML schema (additive to `version: 1`)

`version` stays `1`: the shape is a superset, and the hq CI validator rejects any other version.
Unknown keys were always warnings, so typos keep surfacing.

### 2.1 Top level

```yaml
version: 1
days: [2, 3, 4, 5, 6, 7] # unchanged: days that have a sheet and/or a bake list (bake days)
dough_days: [2, 3, 4, 5, 6] # NEW, optional: weekdays on which dough is made. Default: = days.
bruch_pieces: 20 # NEW, optional: pieces per press of the divider. null/missing = unknown.
sections: [...] # unchanged
items: [...]
doughs: [...] # extended (2.3)
fillings: [...] # unchanged; `recipe` may be missing (filling without recipe)
prep: [...] # unchanged
```

Validator: `dough_days` ⊆ `days`, non-empty, no duplicates (error). If any item has `lead > 0`
and `dough_days` is missing, warning ("Teigtage fehlen; es gilt days" - with today's days that
would make Sunday a dough day).

### 2.2 Items

New item keys (`ITEM_KEYS`): `lead`, `sizes`, `bruch`, `from_dough`. Changed: `dough`,
`filling_g`, `products[]`.

```yaml
# Bread by size (invented numbers)
- id: test-korn
  name: Testkorn
  section: brot
  dough: { id: test-korn-teig } # no piece_g: the sizes carry the weight
  sizes:
    - { id: g500, label: 500 g, dough_g: 600 }
    - { id: g1000, label: 1 kg, dough_g: 1000 }
    - { id: kasten, label: Kasten, dough_g: null } # null = unknown
  products:
    - { id: test-korn-500, size: g500 } # factor defaults to 1
    - { id: test-korn-1000, size: g1000 }
  base:
    2: { g500: 4, g1000: 2, kasten: null } # per size, like variants
    6: { g500: 8, g1000: 3 }

# A dough feeding another item with a fixed extra (Kerbricher pattern)
- id: test-kerb
  section: brot
  dough: { id: test-misch }
  sizes: [{ id: g500, label: 500 g, dough_g: 600 }]
  from_dough:
    id: test-misch # which dough the share is taken from
    mode: fixed # fixed | per_dough | null (= unknown)
    dough_kg: 5 # kg of that dough per charge
    extras: [{ name: Körner, kg: 1 }] # added on top, listed on the sheet

# Rolls in Bruch, made the day before
- id: test-doppel
  section: broetchen
  products: [{ id: test-doppel }]
  lead: 1 # 1 = the last dough day before the bake day
  dough: { id: test-weck }
  bruch: { g: 1200, per_product: 2 } # 2 dough pieces per roll
  base: { 2: 40, 7: 60 } # PIECES per BAKE weekday

- id: test-stern
  section: broetchen
  lead: 1
  dough: { id: test-weck }
  bruch: { g: 2000, group: test-gemischt } # same group = they share Brüche
  base: { 2: 12 }

- id: test-flitweck
  section: broetchen
  lead: { default: 1, 6: 2 } # per bake weekday; Saturday made two dough days ahead
  dough: { id: test-flit }
  bruch: { g: { 7: 1600, 2: 2000, default: null } } # weight per bake weekday

# Single pieces without the divider
- id: test-flit-klein
  section: broetchen
  lead: 1
  dough: { id: test-flit, piece_g: 300 } # pieces defaults to 1
- id: test-party
  section: broetchen
  lead: 1
  dough: { id: test-flit, piece_g: 250, pieces: null } # pieces unknown → no kg
```

Rules (validator `backzettel-config.core.js`):

| Key                                  | Shape                                                 | null                                  | missing                                                  | invalid (error)                                                                     |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------- | -------------------------- |
| `lead`                               | int 0…3, or `{ default?: int, <weekday>: int }`       | error                                 | 0                                                        | not int, < 0, > 3, weekday not in `days`                                            |
| `sizes`                              | non-empty list `{ id (slug), label (text), dough_g }` | –                                     | no sizes                                                 | duplicate id, item also has `variants`, empty list                                  |
| `sizes[].dough_g`                    | number > 0                                            | unknown (listed in `open`)            | unknown + warning                                        | ≤ 0, not a number                                                                   |
| `sizes[].plu`                        | non-empty list of PLUs, each in the item's `plu`      | unknown (listed in `open`)            | unknown, no message                                      | empty list, not a positive int, PLU not in the item's `plu`, PLU in two sizes       |
| `products[].size`                    | a size id of this item                                | –                                     | **error** on an item with `sizes`; on others: no size    | unknown size id; set on an item without sizes                                       |
| `dough`                              | `{ id, piece_g?, pieces? }`                           | –                                     | item not dough-based                                     | not an object                                                                       |
| `dough.id`                           | dough id from `doughs`                                | unknown dough (kg go to "Teig offen") | same as null + warning                                   | id not in `doughs`                                                                  |
| `dough.piece_g`                      | number > 0                                            | unknown                               | required unless `sizes` or `bruch` (then must be absent) | ≤ 0; present together with `sizes`/`bruch`                                          |
| `dough.pieces`                       | int > 0                                               | unknown                               | 1                                                        | not a positive int                                                                  |
| `bruch`                              | `{ g, per_product?, pieces?, group? }`                | –                                     | not a Bruch item                                         | not an object; with `sizes`; without `dough`                                        |
| `bruch.g`                            | number > 0, or `{ <weekday>: number                   | null, default?: number                | null }`                                                  | unknown                                                                             | unknown + warning | ≤ 0, weekday not in `days` |
| `bruch.per_product`                  | int > 0                                               | error                                 | 1                                                        | not a positive int                                                                  |
| `bruch.pieces`                       | int > 0 (override of `bruch_pieces`)                  | unknown                               | top-level `bruch_pieces`                                 | not a positive int                                                                  |
| `bruch.group`                        | slug                                                  | –                                     | own group (= item id)                                    | members of one group differ in `dough.id`, `bruch.g`, `pieces`, `lead` or `section` |
| `from_dough`                         | `{ id, mode, dough_kg, extras? }`                     | –                                     | none                                                     | `id` not in `doughs`; item has no `sizes`; `dough_kg` ≤ 0                           |
| `from_dough.mode`                    | `fixed` \| `per_dough`                                | unknown → that dough is incomplete    | unknown + warning                                        | other string                                                                        |
| `from_dough.dough_kg`, `extras[].kg` | number > 0                                            | unknown                               | unknown + warning                                        | ≤ 0                                                                                 |
| `filling_g`                          | number > 0, map per variant, or **null**              | **filled, grams unknown** (changed!)  | not filled                                               | as v1                                                                               |

Semantics that change from v1:

- **`filling_g: null`** used to mean "not filled" (the normaliser returned `null`). In v2 the
  _presence_ of the key marks a filled item; `null` (whole or per variant) means grams unknown.
  No item in today's hq file has `filling_g: null`, so nothing changes for it. The v1 rule "a
  filled item needs its base per variant" now also applies with `filling_g: null`.
- **Sizes are variants.** The normaliser sets `item.variants = sizes.map(s => s.id)` and
  `item.variantKind = 'size'` (fillings/Sorten: `'filling'`, none: `null`). Everything that
  already works per variant - base cells, Z4 editing (`variants: { g500: 4 }`), lines, corrections
  (`/lines/test-korn/g500/correction`), ticks, deltas, Rest am Abend rows, the Notfallblatt -
  works for sizes unchanged. Size ids must be slugs that **start with a letter** (`g500`, not
  `500`), so YAML never turns them into numbers and URLs stay readable; the label is what people
  see.
- **Preorders and sizes.** A product of a size item names its size in `products[].size`, so a
  preorder for "Testkorn 500 g" lands on `g500` without asking for a Sorte.
  `variantsForProduct()` returns `variants: []` plus `size` for such a product (preorders store
  `variant: ''`), and `variantsByProduct()` leaves it out - the entry form never asks.
- **Base is keyed by the bake weekday**, also for rolls made the day before. Tuesday's rolls are
  `base: { 2: … }` although the dough is made on Saturday.
- **Base of Bruch items is in pieces** (owner decision O1). The sheet shows the Brüche.

Legacy `unit: Liter` items (bread by water litres, `pieces_per_liter`) keep working unchanged:
they are lines in litres, belong to no dough computation, and appear in the bread table as a row
"in L" without size columns. hq can convert them one by one.

### 2.3 Doughs

```yaml
doughs:
  - id: test-korn-teig
    name: Testkorn
    kg_per_liter: 2 # number > 0 | null (unknown) – kg finished dough per recipe litre
    liter_rounding: { step: 0.5, mode: up } # | null (unknown)
    batch_max_kg: null # unchanged meaning; null = batches unknown
    combined_name: Korn + Holz # optional, only on the head of a combined group
  - id: test-holz-teig
    name: Testholz
    kg_per_liter: 2
    combined_with: test-korn-teig # one litre number at the machine (head = test-korn-teig)
    addons:
      - {
          id: test-sauer,
          name: Testsauer,
          g_per_liter: 10,
          rounding: { step: 5, mode: nearest },
        }
  - id: test-hefe
    name: Testhefe
    kg_per_liter: 5
    liter_rounding: { step: 1, mode: nearest }
    batch_max_kg: 50
```

| Key              | Shape                                                     | null                                              | missing                       | invalid                                                                                                                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `kg_per_liter`   | number > 0                                                | unknown → sheet shows kg only                     | unknown + warning             | ≤ 0, not a number                                                                                                                    |
| `liter_rounding` | `{ step > 0, mode: up\|nearest\|down }`                   | unknown → exact litres shown with "Rundung offen" | unknown + warning (head only) | step ≤ 0, unknown mode, partial object                                                                                               |
| `combined_with`  | id of another dough                                       | –                                                 | not combined                  | unknown id, points at itself, chain (the head must not have `combined_with`), member has its own `liter_rounding` (warning: ignored) |
| `addons[]`       | `{ id, name, g_per_liter > 0 \| null, rounding \| null }` | g_per_liter null → addon unknown                  | –                             | duplicate id, ≤ 0                                                                                                                    |

There is deliberately **no separate water field**. A recipe litre is one litre of water plus the
rest, so water (L) = litres = kg ÷ `kg_per_liter`; a Hefeteig rule "water = dough ÷ n" is
`kg_per_liter: n`. The sheet labels the Hefeteig number "Wasser … L" when the dough's
section is `hefeteig` and "… L" otherwise (display only).

Rounding: `round(x, {step, mode})` with the existing tolerance (`EPSILON`), so 10 × 1.1 does not
round up to 11.5. `up` = ceil, `down` = floor, `nearest` = half up.

### 2.4 Dough day resolution

```
doughDate(item, B) =
  lead(item, weekday(B)) === 0  ? B
  : the lead-th date D < B (looking back at most 14 days) with weekday(D) ∈ dough_days
```

With `dough_days: [2..6]` and lead 1: Sunday ← Saturday, Tuesday ← Saturday (Monday is not a
dough day, Sunday is not either), Wednesday ← Tuesday. Lead 2: Saturday ← Thursday. Not found
within 14 days → warning `no_dough_day`, the line goes to B itself (never dropped).

`bakeDatesFor(D)` = every B in [D, D + 14] with `B ∈ days` and at least one item whose
`doughDate(item, B) = D`, plus D itself when `D ∈ days`. `doughDatesFor(B)` = the distinct
`doughDate(item, B)` over all items.

A **sheet** exists for every `D ∈ days` (unchanged: Monday stays 409 `ruhetag`). Its lines are
(a) lead-0 items baked on D and (b) items with lead > 0 whose dough day is D. Sunday (not a dough
day) has a sheet with only its lead-0 lines - usually empty - and a bake list.

---

## 3. How "unknown" travels

One convention through all layers: **a value is either a number or `null`; every `null` that comes
from master data carries a reason.**

| Layer             | Representation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YAML              | `null` (or missing key → same, plus a validator warning)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Validator         | `{ ok, errors, warnings, open }` - new third list `open: [{ path, code, message }]`, one per explicit `null` on an open field (`dough_g`, `kg_per_liter`, `liter_rounding`, `bruch.g`, `bruch_pieces`, `dough.id`, `dough.piece_g`, `dough.pieces`, `from_dough.mode`, `addons[].g_per_liter`, `batch_max_kg`, `filling_g`, `sizes[].plu`). Not an error, not a warning: "offen". The CLI prints it as "Offen (n)". Base `null` is **not** in `open` (that is the existing `base_unset` warning per day). |
| Normalised config | the field stays `null`; nothing is filled in                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Core              | every computed quantity is `number \| null`; aggregates carry `kgKnown` (sum of the known parts), `complete: boolean` and `missing: [{ itemId, name, field, code, message }]`; litres carry `{ exact, rounded, reason }` with `reason ∈ kg_per_liter_unknown \| dough_incomplete \| rounding_unknown \| null`                                                                                                                                                                                             |
| Sheet (API)       | the same fields, plus `open[]` = the master-data gaps **that affect this sheet** (deduplicated by path), each with a German message                                                                                                                                                                                                                                                                                                                                                                       |
| Screen            | `formatKnown(value, unit)` → "–" for `null`; next to it the hint (Tooltip on PC, text under the box on tablet and in print): "Liter: unbekannt (kg je Liter offen)", "≥ 12,4 kg (Gewicht Vital offen)", "Chargen: unbekannt"                                                                                                                                                                                                                                                                              |
| Print             | "–" in the box, a footnote line "Offen: Liter Weckteig (kg je Liter), Bruchgewicht Elsässer"                                                                                                                                                                                                                                                                                                                                                                                                              |

Rules of the core (each has a test, §6):

1. kg of a dough = Σ of its parts. A part whose weight is unknown makes the dough **incomplete**:
   `kg: null`, `kgKnown` = sum of the known parts, `complete: false`, `missing` names the part. The
   screen shows "≥ kgKnown kg" only when `kgKnown > 0`.
2. Litres only when `complete && kg_per_liter !== null`. `exact = kg / kg_per_liter` (2 decimals);
   `rounded = round(exact, liter_rounding)` or `null` with `reason: 'rounding_unknown'`.
3. Combined group: kg = Σ members (each member's kg shown), litres = round(Σ exact member litres,
   head's rounding); any member incomplete or without `kg_per_liter` → group litres `null`.
4. Add-on grams = `g_per_liter × exact litres of its dough` (not the rounded group litres);
   `null` when those litres are unknown or `g_per_liter` is null; `rounding` null → exact grams to
   one decimal, `reason: 'rounding_unknown'`.
5. Batches = `ceil(kg / batch_max_kg)` only when both are known; else `null`.
6. Brüche are always computable from pieces (no weight needed) as long as `bruch_pieces` is known;
   kg of a Bruch group needs `bruch.g` for that bake weekday.
7. Filling grams: per variant `pieces × filling_g` or `null` with `missingFillingG: true` (v1
   already had the flag); no recipe scaling without grams.
8. Nothing unknown is ever turned into 0 and nothing missing into a default.

---

## 4. Core

All business rules stay in dependency-free CommonJS under `apps/bakery-api/src/services/`.

### 4.1 Files

| File                        | Status  | Contents                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backzettel-config.core.js` | changed | validator + normaliser for §2; `open` list; `variantKind`, `sizes`, `lead`, `bruch`, `from_dough`, dough fields; `variantDisplayName(cfg, item, v)` (size label → filling name → capitalised id) exported for everyone                                                                                                              |
| `backzettel-plan.core.js`   | **new** | `leadFor(item, weekday)`, `doughDateFor(cfg, item, bakeDate)`, `bakeDatesFor(cfg, doughDate)`, `doughDatesFor(cfg, bakeDate)`, `planForSheet(cfg, doughDate, owned?)` → `{ version: 2, doughDate, bakeDates: [{ date, itemIds }] }`, `legacyPlan(date)`, `planIncludes(plan, bakeDate, itemId)`, `isDoughDay(cfg, date)`, `addDays` |
| `backzettel-dough.core.js`  | **new** | `roundTo(x, rounding)`, `litersFor(dough, kg)`, `bruchGroups(cfg, lines)`, `doughParts(cfg, lines, groups)`, `summarizeDoughs(cfg, parts)` → `{ doughs, machine }`, `addonsFor(dough, exactLiters)`                                                                                                                                 |
| `backzettel.core.js`        | changed | `computeDay` gains `onlyItems` and `bakeDate`; size resolution; new `computeDoughDay`, `bakeListFromLines`; `computePreorderDeltas` gains `plan`; `variantsForProduct`/`variantsByProduct` size-aware; `computeHefeteig` adds litres                                                                                                |
| `backzettel-day.core.js`    | changed | snapshot entries carry `pickupDate`; keys with bake date; `reconcileDeltas` with `plan`; `computedSnapshot` v2; `frozenSections` v2; `deltaBakeExtras` per dough                                                                                                                                                                    |

### 4.2 `computeDay` (bake-day lines) - kept, extended

Signature unchanged plus two optional arguments:

```js
computeDay({
  config,
  date,
  preorderItems,
  capTemplate,
  corrections,
  seasonFactor,
  recipes,
  catalog,
  includeEmpty,
  onlyItems, // NEW: Set<itemId> - lines only for these items (default: all)
  sheetDate,
}) // NEW: the dough day this computation is for (default: date)
```

- Every line gains `bakeDate` (= `date`), `doughDate`, `lead`, `variantKind`, `variantLabel`
  (from `variantDisplayName`) and, for Bruch items, `bruch: { group, perProduct }`.
- `key` = `lineKey(itemId, variant, bakeDate, sheetDate)` = `itemId|variant` when
  `bakeDate === sheetDate` (all v1 keys stay valid), else `itemId|variant@bakeDate`.
- A preorder/CAP product of a size item resolves to `hit.size` as its variant
  (`createProductResolver` returns `{ item, factor, size }`).
- Corrections are filtered by `c.bakeDate ?? date`.
- Pooled-quarter rounding, `base_unset`, `correctionClamped`, trays: unchanged, per
  (bake date × item × variant).
- `hefeteig`/`fillings`/`prep` are still returned (v1 consumers); `computeDoughDay` recomputes them
  over the whole sheet.

### 4.3 `computeDoughDay` (the sheet)

```js
computeDoughDay({
  config, date /* dough day D */, seasonFactor,
  bakeInputs: { [bakeDate]: { preorderItems, capTemplate } },   // one per bakeDatesFor(D)
  corrections,             // [{ bakeDate, itemId, variant, qty, reason }]
  owned,                   // Set<`${bakeDate}|${itemId}`> owned by another confirmed sheet (§5.4)
  recipes, catalog, includeEmpty,
}) → DoughDaySheet
```

Algorithm:

1. `plan = planForSheet(cfg, D, owned)`; for each `{ date: B, itemIds }` call `computeDay` with
   `onlyItems = itemIds`, `sheetDate = D`, the bake day's preorders and CAP, D's season factor and
   the corrections for B. Concatenate the lines (sheet order: section order, then bake date, then
   config order).
2. `groups = bruchGroups(cfg, lines)`: per (bake date, group): pieces = Σ `total × perProduct`,
   `brueche = ceil(pieces / bruch_pieces)` (null if `bruch_pieces` unknown), `spare = brueche ×
bruch_pieces − pieces`, `g` for B's weekday, `kg = brueche × g / 1000` or null, `split` =
   members with their counts.
3. `parts = doughParts(cfg, lines, groups)`: sizes (`total × dough_g`), Bruch groups (kg),
   pieces (`total × pieces × piece_g`), `from_dough` shares (fixed: `dough_kg` once when the item's
   lines total > 0; per_dough: item kg × `dough_kg / (dough_kg + Σ extras)`; unknown mode → an
   unknown part). Parts with `dough.id: null` go to a pseudo dough `null` ("Teig offen").
4. `{ doughs, machine } = summarizeDoughs(cfg, parts)` with the rules of §3.
5. `hefeteig = computeHefeteig(cfg, lines in section hefeteig)` - v1 shape plus `liters` and
   `complete` per dough; `fillings = computeFillings(cfg, lines, recipes, warnings)` over the sheet;
   `prep = computePrep(cfg, lines, weekday(D))` (prep belongs to the sheet day, as in v1).
6. `bread` and `rolls` views (below) - built here so the screens compute nothing.

```ts
interface DoughDaySheet {
  // superset of the v1 computeDay result
  date
  weekday
  weekdayName
  open
  seasonFactor
  sections
  lines
  hefeteig
  fillings
  prep
  warnings
  sheetVersion: 2
  isDoughDay: boolean
  bakeDates: {
    date
    weekday
    weekdayName
    label /* "heute" | "für Sonntag" */
    lineCount
  }[]
  plan: { version: 2; doughDate; bakeDates: { date; itemIds: string[] }[] }
  doughs: DoughSummary[]
  machine: MachineBox[] // one per dough or combined group, sheet order = config order
  bread: { sizes: { id; label }[]; rows: BreadRow[] }
  rolls: { bakeDate; label; groups: BruchGroup[]; singles: SingleRow[] }[]
  open: { path; code; message }[]
}
interface DoughSummary {
  id: string | null
  name
  kg: number | null
  kgKnown: number
  complete: boolean
  missing: { itemId; name; field; code; message }[]
  liters: {
    exact: number | null
    rounded: number | null
    reason: string | null
  }
  batches: number | null
  batch_max_kg: number | null
  addons: { id; name; g_per_liter; grams: { exact; rounded } | null; reason }[]
  parts: {
    kind: 'sizes' | 'bruch' | 'pieces' | 'from_dough'
    itemId
    name
    bakeDate
    kg: number | null // from_dough: the share of the target dough
    loavesKg?: number | null // from_dough only: loaves × dough_g (the bread row's own dough)
  }[]
  extras: { name; kg: number | null; itemId }[] // Körner etc., listed, not dough
  combinedWith: string | null
}
interface MachineBox {
  id
  name
  doughIds
  kg
  kgKnown
  complete
  liters
  batches
  addons
}
interface BreadRow {
  itemId
  name
  doughId
  unit
  cells: Record<sizeId, { key; total } | null>
  kg // dough of the bread itself: loaves × dough_g, also for from_dough items (§4.1)
  complete
  note // from_dough: "… · davon x kg <dough>" once the share is known
}
interface BruchGroup {
  key
  group
  doughId
  bakeDate
  g: number | null
  piecesPerBruch: number | null
  brueche: number | null
  kg: number | null
  spare: number | null // free dough pieces; null while a member's base is open
  spareProducts: number | null // the same in products ("+n frei"), null if per_product differs
  bruecheKnown: number | null // from the known members only ("≥ n Bruch")
  kgKnown: number | null
  split: {
    key
    itemId
    name
    total /* known pieces */
    doughPieces
    totalIsMinimum /* base open */
  }[]
}
interface SingleRow {
  key
  itemId
  name
  total
  piece_g: number | null
  pieces: number | null
  kg: number | null
}
```

Spare pieces (`spare > 0`) are shown as "+n frei" and **not** added to any line (owner decision O2).

### 4.4 Bake list

`bakeListFromLines(cfg, bakeDate, sources)` with `sources = [{ doughDate, status, lines, deltas }]`
returns `{ date, sections: [{ id, label, lines: [{ ...line, doughDate, sheetStatus, madeOn: label }] }],
rolls /* same shape as the sheet, only this bake date */, deltas, warnings }`. No dough figures -
this is the sheet for the person who only bakes: product, pieces, from which dough day, open
Nachträge.

### 4.5 Deltas by dough day

`computePreorderDeltas({ config, date: D, plan, before, after, catalog })`: an entry counts when
its `pickupDate` is a bake date of `plan` and its item is in that bake date's `itemIds`. Without
`plan` → `legacyPlan(D)` (= v1). Delta key gains the bake date
(`preorderId#itemId|variant@bakeDate`). `reconcileDeltas` in the day core takes `plan` and passes
it through. A preorder for Tuesday rolls changed on Monday is therefore a delta **on Saturday's
sheet** (bake date Tuesday) and shows on Tuesday's bake list; it is not a delta on Tuesday's own
sheet.

### 4.6 What happens to existing consumers of the core

| Consumer                                              | Change                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backzettel.service.ts`                               | draft/confirm via `computeDoughDay` (§5)                                                                                                                     |
| `backzettel-reference.core.js` (Z4 medians)           | medians per item as before; per sized item also `sizes[]` over `sizes[].plu` (§9 point 10)                                                                   |
| `rest-am-abend.core.js`                               | `countRowsForItem`: for `variantKind: 'size'` only the products whose `size` is the variant; "baked" from the bake list (§5.5)                               |
| `preorder-variants.ts` / `delivery-preorders.core.js` | size products: no variant (via `variantsForProduct` returning `variants: []`)                                                                                |
| `hq-snapshots.core.js` (Z9)                           | whitelist adds `bakeDate`, `variantLabel`, `doughs`, `machine`, `bakeDates`; `schema_version: 2` when `sheetVersion` is 2; Markdown groups rolls by bake day |
| `scripts/validate-backzettel.js`                      | prints `open`                                                                                                                                                |
| `.claude/skills/setup-dev/scripts/lib/make-hq.js`     | synthetic YAML gets one example of each new feature                                                                                                          |
| hq CI (copies of loader + config core + recipes core) | refresh the copies in the hq PR that applies the new YAML                                                                                                    |

---

## 5. API and database

### 5.1 Migration `20270201000000-backzettel-dough-day.js` (additive)

- `backzettel_lines.bake_date` DATEONLY NOT NULL DEFAULT `''`, then `UPDATE … SET bake_date = date`.
  Drop index `backzettel_lines_date_item_variant`, create unique
  `backzettel_lines_date_bake_item_variant (date, bake_date, item_id, variant)` and index
  `(bake_date)`. (`date` stays the sheet/dough day and keeps the FK to `backzettel_days`.)
- `backzettel_deltas.bake_date` DATEONLY NOT NULL DEFAULT `''`, backfill `= date`, index `(bake_date)`.
- No change to `backzettel_days`; `computed_snapshot` gains `plan`, `doughs`, `machine`, `bread`,
  `rolls`, `open` (JSON), `preorder_snapshot` entries gain `pickupDate`.
- Models: `BackzettelLine.bakeDate`, `BackzettelDelta.bakeDate`.
- Down: drop the new index/columns, restore the old unique index (only valid while every sheet is
  same-day; documented).
- `tests/migrations/pilotBaseline.test.ts`: migrate a database with a confirmed v1 day, check the
  backfill and that the day reads identically.

### 5.2 Endpoints

| Endpoint                                         | Change                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/backzettel/:date`                      | returns the **sheet of dough day D** = v1 day shape + the `DoughDaySheet` additions (§4.3). Lines carry `bakeDate`, `doughDate`, `variantLabel`. v1 clients keep working: with today's config every line has `bakeDate === date`. Monday 409 `ruhetag` unchanged.                                   |
| `GET /api/backzettel/:date/bake-list`            | **new**, any session: `{ date, weekday, weekdayName, status: 'ok'\|'no-config'\|'ruhetag', sources: [{ doughDate, status: 'draft'\|'confirmed', confirmedAt }], sections, rolls, deltas, deltasPending, warnings }`. Lines from confirmed sheets come from the stored rows, from draft sheets live. |
| `PUT /:date/lines/:itemId[/:variant]/correction` | body gains optional `bakeDate` (default = `date`); must be a bake date of the sheet → else 400 `invalid_bake_date`. `expected` unchanged.                                                                                                                                                           |
| `POST /:date/confirm`                            | freezes the plan (`computed_snapshot.plan`) and the v2 parts; rows per (bake date × item × variant)                                                                                                                                                                                                 |
| `POST /:date/lines/:lineId/done`                 | unchanged (row id). On a lead > 0 line "done" means **made** (dough day); there is no "baked" tick in Z10 (owner decision O5)                                                                                                                                                                       |
| `GET /config`                                    | adds `open` and `working.open`; normalised items carry `sizes`, `variantKind`, `lead`, `bruch` (with `piecesPerBruch`), `from_dough`                                                                                                                                                                |
| `GET /:date/prep`                                | unchanged                                                                                                                                                                                                                                                                                           |
| Z4 `PUT /config/base`                            | unchanged; sizes are edited with `variants: { g500: n }`                                                                                                                                                                                                                                            |

Roles unchanged: read any session; plan/confirm/tick/ack `inhaber` + `backstube`; reopen `inhaber`.
Planning window (today − 7 … + 90) applies to the sheet date D.

### 5.3 Service (`backzettel.service.ts`)

- `loadPreorderSnapshot(D)` → preorders with `pickup_date IN bakeDatesFor(D)`, snapshot entries
  with `pickupDate`. `loadCapTemplates` per bake weekday.
- `draftView(D)`: owned pairs (§5.4) → `computeDoughDay` → v1 line view (ids, ticks, correction
  users) keyed by the new line key, rows looked up by (bake_date, item, variant).
- `confirm(D)`: upsert rows with `bake_date`; `computedSnapshot` v2; store
  `plan = sheet.plan`. Tick survival rules unchanged, per row.
- `confirmedView(D)`: lines from rows; v2 parts from `computed_snapshot`; a snapshot without
  `plan` is a **legacy day**: `plan = legacyPlan(D)`, no `doughs`/`machine`/`bread`/`rolls`
  (`sheetVersion: 1`) - the screens fall back to the v1 layout.
- `recordPreorderDeltas(pickupDates)`: target sheets = ∪ `doughDatesFor(B)` ∪ every confirmed
  sheet in [B − 14, B] whose frozen plan includes B; each reconciled with its own plan, inside
  the preorder's transaction (as today). `scheduleCatchUp`/`reconcileConfirmedDays` unchanged
  apart from the plan.
- `getBakeList(B)` and `getBakeLines(B, { light })` (replaces `getConfirmedLines` for Rest am
  Abend): sources = sheets feeding B (confirmed with a plan including B, or computed live as
  drafts); `status` of B for Rest = `confirmed` only when every source with lines for B is
  confirmed.

### 5.4 Ownership and already-confirmed days (transition)

A (bake date, item) pair belongs to **the confirmed sheet whose frozen plan contains it**; a draft
never recomputes a pair owned by another confirmed sheet (warning `owned_elsewhere`, "Dienstags-
Brötchen stehen schon auf dem freigegebenen Zettel vom Samstag, 05.12."). This covers:

- **Old confirmed days** (plan = legacy, all items of D): after hq switches Tuesday rolls to
  `lead: 1`, the Saturday draft does not add the Tuesday rolls that a Tuesday sheet confirmed
  before the switch already holds - no double count, no spurious "cancelled" deltas on the old
  sheet (its frozen plan still includes them).
- **Reopen** clears the plan → the pairs become free again.

### 5.5 Rest am Abend (M4)

- Count rows per size: only that size's products (`productsForVariant(item, variant)`).
- Baked on B = Σ over bake-list lines of B (all feeding sheets): frozen `total` + acknowledged
  deltas, as today per line. A bake day with any unconfirmed source is `backzettelStatus:
'draft'` → planned only.
- `rest_counts.business_date` stays the **bake/sale day** - unchanged.

---

## 6. Tests (invented numbers only)

Fixture: `apps/bakery-api/tests/fixtures/backzettel.synthetic.js` gains `configV2()` (the §2
examples: Testkorn + Testholz combined, Testmisch + Testkerb, Testweck with a Doppel item and a
mixed group, Testflit with per-weekday Bruch weight and singles, Testhefe) and `PRODUCTS_V2`
(`test-…` ids). `bruch_pieces: 20`, `kg_per_liter` 2/3/5, weights 600/800/1000/1200/2000 g. None of
these is a value from hq. Management fixtures: `backzettelFixtures.ts` gains a v2 sheet, same
numbers.

| #   | Rule (backliste.md)                                                                                                                      | Test (file)                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| R1  | v1 regression: a config without new keys gives the same `computeDay` result and a sheet equal to it                                      | `backzettelCore.test.js` (record v1 output first, deep-equal) |
| R2  | §4.0 litres = kg ÷ kg/L, rounding step/mode up/nearest/down, tolerance (`10 × 1.1`)                                                      | `backzettelDough.test.js`                                     |
| R3  | §4.0 kg/L null → kg only, `reason: kg_per_liter_unknown`                                                                                 | `backzettelDough.test.js`                                     |
| R4  | rounding null → exact litres, `rounded: null`, `rounding_unknown`                                                                        | `backzettelDough.test.js`                                     |
| R5  | §4.1 dough per size = Σ loaves × dough_g; unknown size weight → incomplete, `kgKnown`                                                    | `backzettelDough.test.js`                                     |
| R6  | §4.1 combined dough: one litre number from Σ exact member litres, member kg shown; one member unknown → group litres null                | `backzettelDough.test.js`                                     |
| R7  | §4.1 add-on g per litre of the member's exact litres, rounding; unknown → null                                                           | `backzettelDough.test.js`                                     |
| R8  | §4.1 from_dough fixed: share added once when the item is baked, extras listed, not dough                                                 | `backzettelDough.test.js`                                     |
| R9  | from_dough per_dough: share scaled with the item's kg                                                                                    | `backzettelDough.test.js`                                     |
| R10 | from_dough mode null → target dough incomplete, no litres, `open` entry                                                                  | `backzettelDough.test.js`                                     |
| R11 | §4.2 one Bruch = `bruch_pieces`; per_product 2 → half as many rolls per Bruch; ceil; spare                                               | `backzettelDough.test.js`                                     |
| R12 | §4.2 one Bruch split across products of a group; Brüche from summed pieces; split list                                                   | `backzettelDough.test.js`                                     |
| R13 | §4.2 Bruch weight per bake weekday (two bake days on one sheet, different g)                                                             | `backzettelDough.test.js`                                     |
| R14 | Bruch weight null → group kg null, dough incomplete; Brüche still shown                                                                  | `backzettelDough.test.js`                                     |
| R15 | §4.2 single pieces without divider: count × pieces × piece_g; `pieces: null` → unknown                                                   | `backzettelDough.test.js`                                     |
| R16 | §2 dough day: Saturday sheet collects Sunday + Tuesday (lead 1, dough_days without Sun/Mon)                                              | `backzettelPlan.test.js`                                      |
| R17 | lead 2 (Teiglinge): Thursday → Saturday; lead map per bake weekday                                                                       | `backzettelPlan.test.js`                                      |
| R18 | no dough day within 14 days → warning, line on its bake day                                                                              | `backzettelPlan.test.js`                                      |
| R19 | §2 preorders and CAP belong to the bake day (pickup date B, CAP weekday of B)                                                            | `backzettelCore.test.js`                                      |
| R20 | pooled quarters per (bake date × item × variant), not across bake dates                                                                  | `backzettelCore.test.js`                                      |
| R21 | §4.3 Hefeteig litres = kg ÷ 5 (fixture), nearest whole; batches null without batch_max                                                   | `backzettelCore.test.js`                                      |
| R22 | filling_g null → filled, grams null, no recipe scaling; base per variant still required                                                  | `backzettelCore.test.js`, `backzettelConfig.test.js`          |
| R23 | size products: preorder lands on its size; `variantsForProduct` → `variants: []`, `variantsByProduct` omits it                           | `backzettelCore.test.js`                                      |
| R24 | deltas: Tuesday-roll preorder after Saturday confirm → delta on Saturday (bake date Tue), none on Tuesday                                | `backzettelDay.test.js`, `backzettel.test.ts`                 |
| R25 | transition: legacy confirmed Tuesday keeps its rolls; Saturday draft skips owned pairs; no double delta                                  | `backzettelDay.test.js`, `backzettel.test.ts`                 |
| R26 | bake list collects lines from two sheets with their statuses                                                                             | `backzettelCore.test.js`, `backzettel.test.ts`                |
| R27 | Sunday: sheet with only lead-0 lines, bake list full; Monday still 409                                                                   | `backzettel.test.ts`                                          |
| R28 | validator null / missing / invalid for every row of the §2 tables; `open` list; v1 hq-shaped fixture: same errors and warnings as before | `backzettelConfig.test.js`                                    |
| R29 | correction with `bakeDate`, 400 `invalid_bake_date`; ticks per row                                                                       | `backzettel.test.ts`                                          |
| R30 | Rest am Abend: size rows only with that size's products; baked from two sheets                                                           | `restAmAbend.test.js`, `rest.test.ts`                         |
| R31 | Z9 snapshot v2 keeps the whitelist (planted personal markers stay out)                                                                   | `hqSnapshotsCore.test.js`                                     |
| R32 | migration backfill; legacy confirmed day reads identically                                                                               | `pilotBaseline.test.ts`                                       |
| R33 | Z4 editor: size ids in variant maps, flow and block, zero diff                                                                           | `backzettelBaseEdit.test.js`                                  |

---

## 7. Management app

"Ein Client, kein Rechnen" stays: every figure comes from the API.

### 7.1 Client libs

- `src/lib/backzettelApi.ts`: types `DoughDaySheet` additions, `DoughSummary`, `MachineBox`,
  `BreadRow`, `BruchGroup`, `SingleRow`, `OpenMasterData`, `BakeList`; `fetchBakeList(date)`;
  `setCorrection(…, { bakeDate })` (body field). `BackzettelLine` gains `bakeDate`, `doughDate`,
  `variantLabel`, `variantKind`.
- `src/lib/backzettelFormat.ts`: `formatKnown(value, unit)` ("–"), `litersText(l)` ("6,5 L",
  "6,47 L (Rundung offen)", "unbekannt"), `kgText(d)` ("12,4 kg", "≥ 12,4 kg"), `bakeDayLabel`,
  `variantLabel` uses `line.variantLabel` / `config.items[].sizes`.
- `src/lib/grundmengenApi.ts`: `variantLabel` with sizes; `bruchHint(value, item)` = value ÷
  `item.bruch.piecesPerBruch` (one decimal, `null` when unknown) - the only division in the UI,
  display of master data, tested.

### 7.2 Day planning `/admin/backzettel/[datum]` (Z5)

Top to bottom:

1. Header as today + "Teige heute: Brot · Weck für So + Di · Hefeteig" (from `bakeDates` and
   `machine`).
2. **`MachineStrip`** (`components/backzettel/MachineStrip.tsx`): one card per `machine` box: name,
   kg (≥ when incomplete), L, batches, add-ons; "unbekannt" + hint for nulls.
3. **`OpenMasterDataNote`**: collapsible "Offene Stammdaten (n)" from `open` - info, not a warning.
4. **`BreadTable`**: rows = bread items, columns = `bread.sizes`, cells editable through the
   existing `CorrectionEditor` (line key), kg per row, note (shared dough, Kerbricher extras).
   Legacy Liter items as rows with one "L" cell.
5. **`RollsByBakeDay`**: one block per bake date ("für Sonntag", "für Dienstag", "heute backen"),
   each with Bruch groups ("2 Bruch × 1200 g – 12 Stern, 8 Käse · +0 frei") and singles; per line
   the correction editor (sends `bakeDate`) and a "+1 Bruch" shortcut that pre-fills the
   correction with `piecesPerBruch / perProduct` (still needs a reason).
6. Other sections (Kaffeestückchen, Kuchen, Laugen…) as today (`BackzettelSectionView`).
7. Hefeteig card (+ Wasser L), fillings ("Gramm unbekannt" when null), deltas card (Nachträge show
   their bake date: "für Di"), prep.

Legacy day (`sheetVersion: 1`): today's layout unchanged.
New sub-page `/admin/backzettel/[datum]/backen` (**bake list**, read-only, print button). It is
covered by the existing `ROLE_ACCESS` rule for `/admin/backzettel` and by `PILOT_ALLOWED_ROUTES`;
`pilotMode.spec.ts` must see the page. Overview: each day shows "Teig für …" and links to both.

### 7.3 Backstube tablet `/backstube` (Z6)

- Tabs: **Zettel** (dough-day sheet of the chosen day) | **Backen** (bake list of the chosen day) |
  **Vorbereitung** (unchanged).
- Default tab: Zettel, except when the chosen day is not a dough day or its sheet has no lines →
  Backen (Sunday). `backstubeDay.ts` is unchanged (which day); a new pure `defaultBackstubeTab(sheet)`
  decides the tab (tested).
- Machine strip at the top of Zettel, large; rolls grouped by bake day; Hefeteig first on Saturday
  stays.
- Bake list: big rows "Doppelweck 60 (Teig vom Sa)", open Nachträge with "Gesehen" (same
  `ack` endpoint, the delta's sheet date). No tick (O5).

### 7.4 Grundmengen `/admin/backzettel/grundmengen` (Z4)

- Size items: one sub-row per size (label), like fillings today; the item row shows the item
  reference, each size row its own median (`sizes[].plu`) or "unbekannt" (§9 point 10).
- Bruch items: cell shows pieces; grey hint "≈ 2 Bruch" (`bruchHint`); column header note
  "Brötchen: Menge am Backtag, Teig am Teigtag davor".
- "Offene Stammdaten (n)" card from `working.open`.
- Print (`GrundmengenPrint.tsx`): size labels in sub-rows.

### 7.5 Print (Z7 → one page per dough day)

- **`DoughDayPrint.tsx`** (new, replaces page 1 of `BackzettelPrint.tsx` for `sheetVersion: 2`):
  A4 portrait, black on white, numbers right-aligned, one page:
  1. Header "Backzettel Samstag, 05.12.2026", teige heute, stamp Entwurf/Freigegeben.
  2. Machine strip: one bordered box per machine box, the litre number large; "–" for unknown.
  3. Brot: table rows × size columns, kg, checkbox.
  4. Brötchen: one column per bake day; rows `Brüche × g – split`; same-day block small.
  5. Hefeteig: two columns, count + checkbox; filled Kranz as one row with the split per filling.
  6. Other sections compact (two columns), Nachträge, "Offen: …" footnote, 4 note lines.
     Layout density via a pure `dayPrintLayout(sheet)` (row height and font step, like
     `notfallLayout`), so a busy Saturday stays on one page.
- **Second sheet (optional)**: today's pages 2–3 (weighing list, scaled recipes, prep) move to
  `BackzettelPrintExtras.tsx`; a checkbox "Abwiegeliste & Rezepte mitdrucken" (remembered in
  `localStorage`, default off - O8). Legacy days print as today.
- **`BakeListPrint.tsx`**: one page per bake day for the Sunday person: product, pieces, from which
  dough day, checkbox; no dough figures.
- Check with `page.pdf()` (page count 1 for the busiest fixture), never a screenshot; reset
  `emulateMedia` as noted in CLAUDE.md (P6).

### 7.6 Other screens

- Hilfe (P6): `BackzettelNotfallblatt` rows per size label; `spickzettel.ts` (Backstube) mentions
  "Zettel / Backen".
- Rest am Abend screens: no change (API keeps its shape; size rows have `variantLabel`).

---

## 8. Owner decisions and questionnaire values

Owner decisions: **O1, O2, O7 and O9 confirmed by the owner on 2026-11-08**; the rest are the
defaults the design assumes until the owner says otherwise.

| #   | Decision                                                     | Default in this design                              |
| --- | ------------------------------------------------------------ | --------------------------------------------------- |
| O1  | Unit of roll base quantities                                 | pieces (Brüche are derived)                         |
| O2  | Spare pieces of a rounded-up Bruch                           | shown "+n frei", not added to lines or "baked"      |
| O3  | Season factor                                                | per sheet (dough day), applies to all its bake days |
| O4  | Combined litres formula                                      | round(Σ exact member litres)                        |
| O5  | Tick on the bake list                                        | none in Z10 (paper); "done" on the sheet = made     |
| O6  | Dough master data editable in the app                        | no; hq by hand + CI validator                       |
| O7  | Switch bread to sizes now with `null` bases                  | yes, in the hq PR that follows the deploy           |
| O8  | Print default                                                | one page; extras opt-in                             |
| O9  | Old, unconfirmed `batch_max_kg` and `filling_g` values in hq | replaced by `null`                                  |
| O10 | Late preorder for a bake day whose dough is made             | accept, Nachtrag on sheet + bake list (as today)    |

Questionnaire answers (`backliste-fragebogen.md`) only fill `null`s in hq; no code waits for them.

---

## 9. Risks and open points

1. **Order of rollout.** The current app and the hq CI reject the new YAML (`sizes`, base per
   size, `dough` without `piece_g`) and would show "Stammdaten fehlen" for the whole Backzettel.
   Deploy S1–S3 first; refresh the validator copies in hq in the same PR as the YAML.
2. **Transition week.** Ownership (§5.4) prevents double counting, but a Tuesday whose sheet was
   confirmed before the switch shows its rolls on Tuesday, not Saturday. Switch hq on a
   Monday/Tuesday after the Tuesday sheet is confirmed, or reopen it.
3. **One page** - resolved. The S6 check had only a 34-line Saturday. Now the largest spec fixture
   is a 60-line busy Saturday (`busySaturdayV2Draft/Confirmed`, 6 Nachträge), and
   `dayPrintLayout.spec.ts` requires every v2 fixture to fit one sheet. `page.pdf()` with
   `make-hq.js --busy-saturday` (58 lines, 7 Nachträge after confirm): draft, confirmed and
   confirmed with Nachträge 1 page each. The other sections no longer use CSS columns (a section
   over 8 lines could split and leave its rows without heading at the top of the right column):
   `printColumns` splits them into two fixed columns, a long section continues under
   "… (Forts.)" with at least 3 rows on each side. If a sheet still overflows, the other sections
   move to sheet 2 and page 1 shows a framed "Weitere Abschnitte auf Blatt 2: …" box (checked with
   a forced overflow: 2 pages). Page 1 and sheet 2 then pick their density step separately
   (`layout.secondSheet`, own `--dd-font`/`--dd-row` on the sheet) - resolved review finding: sheet 2
   used to inherit page 1's roomier step and ran onto a third page at 75-100 lines although it fit
   at the densest step. Remaining limit: other sections that do not fit two columns of one page even
   at the densest step (estimate: about 120 lines) continue onto a further page without a heading.
   Details: docs/domains/backzettel.md, "Druck".
4. **Paper formula differences.** The paper computes the combined litres slightly differently
   (Korn share applied to the whole dough); after rounding it agrees on both reference Saturdays.
   Dunkelsauer rounding differs between Saturday and weekdays → `rounding: null` until answered.
5. **Make vs. bake for cakes** ("make n, bake m", Kränze made ahead and frozen) is not modelled;
   `lead` covers only whole lines. Follow-up if F13/Q-L18 confirm it.
6. **Weekday sheets carry only "N Bruch mehr"**: without standard quantities (F3) every roll line
   stays `base_unset`; the app cannot invent them. Corrections with reason cover "mehr".
7. **Rest am Abend vs. spare pieces**: physically more rolls come out than "baked" says (O2).
8. **Spezialbrote** (decimal number of unknown unit, rotation) stay legacy Liter items.
9. **Z9 snapshot schema 2**: Anna's readers of `data/production/backzettel/*.json` must accept
   `schema_version: 2` (additive fields).
10. **Per-size reference medians** - resolved. A size can carry its own register numbers
    (`sizes[].plu`, a subset of the item's `plu`, each PLU at most one size; missing or `null` =
    unknown, `null` listed in `open` as `size_plu_unknown`). `/reference` adds `sizes[]` per sized
    item with the same median formula over the size's PLUs (`status: unknown` without PLUs - never
    0, never a share of the item); the Grundmengen size rows show it, "unbekannt" when the item has
    PLUs but the size has none - on screen and in the print ("≈ unbekannt", never blank). The item median is unchanged; items without `sizes` (every v1
    file) answer byte-identically. Whether the register separates sizes is a property of the hq
    data: it has separate small/large articles for some breads, but one pair of articles can cover
    two items, so most `sizes[].plu` stay `null` until the owner confirms the mapping (hq
    suggestion, HQ-AENDERUNG.md).
11. **Same-day roll production** (Q-L17) is expressible (`lead: { default: 1, 3: 0 }`) but only per
    weekday, not per day; one-off cases go through corrections on the bake day's own sheet if the
    item is lead 0 that day - otherwise not at all. Accepted.
12. **"Stammdaten geändert" for an item newly moved onto a confirmed sheet** - resolved.
    `planDrift` also lists the pairs a `lead`/`dough_days` change newly puts on the dough day
    (`added`), except pairs another confirmed sheet holds now or held at confirm
    (`owned_elsewhere`) and items added to hq later (`knownItems`), so unchanged master data never
    flag (docs/api/backzettel.md).

---

## 10. Slices

Each slice leaves the branch green: `npx jest -c apps/bakery-api/jest.config.js`,
`npx nx run bakery-api:typecheck`, `npx nx test bakery-management`, `npm run type-check`
(memory: jest passes specs with type errors). Run the affected E2E smoke only in S5/S6.

### S1 - Schema, validator, normaliser

- Files: `backzettel-config.core.js`, `scripts/validate-backzettel.js` (print `open`),
  `tests/unit/backzettelConfig.test.js`, `tests/fixtures/backzettel.synthetic.js` (`configV2`,
  `PRODUCTS_V2`).
- Acceptance: R28; `normalizeConfig(configV2())` has `variants`/`variantKind`/`sizes`/`lead`/`bruch`
  as §2; the v1 fixture's validation result is byte-identical to before (snapshot taken first);
  no other file changes behaviour (nothing reads the new fields yet).
- Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests/unit/backzettel`.

### S2 - Core: plan, doughs, sheet, bake list, deltas (pure)

- Files: new `backzettel-plan.core.js`, `backzettel-dough.core.js`; `backzettel.core.js`,
  `backzettel-day.core.js`; new `tests/unit/backzettelPlan.test.js`,
  `tests/unit/backzettelDough.test.js`; `backzettelCore.test.js`, `backzettelDay.test.js`.
- Acceptance: R1–R24 (core parts), R25–R26 (core parts); `computeDay` with v1 config deep-equal to
  the recorded v1 output; no service change yet (`computeDay` callers unaffected).
- Tests: as S1.

### S3 - API and database

- Files: migration `20270201000000-backzettel-dough-day.js` + `db/migrations.ts`, models
  `BackzettelLine.ts`, `BackzettelDelta.ts`, `backzettel.service.ts`, `backzettel.routes.ts`,
  `preorder-variants.ts` (size), `tests/integration/backzettel.test.ts` (new `describe('v2')` on a
  synthetic hq written from `configV2`), `tests/migrations/pilotBaseline.test.ts`,
  `apps/bakery-api/CLAUDE.md` (Backzettel section).
- Acceptance: R24, R25, R27, R29, R32; all existing integration suites unchanged and green
  (`backzettel`, `backzettelGrundmengen`, `rest`, `hqSnapshots`, `preorders`); with today's config
  the day answer equals v1 plus additive fields - except where a Grundmenge is open: then the
  Hefeteig of the sheet is incomplete (kg/Chargen unknown) instead of counting the line as 0 (§1).
- Tests: `npx jest -c apps/bakery-api/jest.config.js apps/bakery-api/tests` +
  `npx nx run bakery-api:typecheck`.

### S4 - API consumers (parallel with S5)

- Files: `rest-am-abend.core.js`, `rest-am-abend.service.ts` (`getBakeLines`),
  `hq-snapshots.core.js`, `.claude/skills/setup-dev/scripts/lib/make-hq.js`, tests
  `restAmAbend.test.js`, `rest.test.ts`, `hqSnapshotsCore.test.js`, `hqSnapshots.test.ts`.
- Acceptance: R30, R31; Rest screens unchanged; snapshot schema 1 for legacy days.
- No file overlap with S5.

### S5 - Management screens (parallel with S4)

- Files: `src/lib/backzettelApi.ts`, `backzettelFormat.ts`, `grundmengenApi.ts`,
  `backzettelFixtures.ts`, `grundmengenFixtures.ts`; `admin/backzettel/[datum]/BackzettelDayClient.tsx`,
  new `admin/backzettel/[datum]/backen/{page,BakeListClient}.tsx`, `BackzettelOverviewClient.tsx`,
  `grundmengen/GrundmengenClient.tsx`; new `components/backzettel/{MachineStrip,BreadTable,RollsByBakeDay,OpenMasterDataNote}.tsx`;
  `app/backstube/BackstubeClient.tsx`, new `src/lib/backstubeTab.ts`; `components/hilfe/BackzettelNotfallblatt.tsx`;
  specs next to each (`*.spec.tsx`), `pilotMode.spec.ts`/`roles.spec.ts` if the new page needs it.
- Acceptance: v2 fixture renders machine strip, bread table, rolls per bake day, unknowns as "–"
  with hints; legacy fixture renders as today (existing specs untouched); correction sends
  `bakeDate`; tablet default tab rule; Grundmengen size rows and Bruch hint.
- Tests: `npx nx test bakery-management`, `npm run type-check`, `npx nx lint bakery-management`.

### S6 - Print, Hilfe, docs (built)

Built as designed, with these differences:

- Other sections print compact without the Basis/Saison/Vorb./CAP/Korr. columns; what those columns
  say (base unset, preorders, CAP, tray, correction reason, already done, delta) stands inline.
- Hefeteig rows list the count per variant without a row total (the app never sums).
- `dayPrintLayout` has five density steps (down to 7 pt) and a 10 mm page margin. If the densest
  step still does not fit, the other sections move to sheet 2 with a note on page 1 (§9.3), whether
  or not the extras box is ticked.
- The bake-list print has no Bruch groups (the bake list carries pieces per product only).
- `v2CoveredKeys`/`linesByKey` moved from `RollsByBakeDay.tsx` to `backzettelFormat.ts` (re-exported)
  so the print and the layout share them.
- The root `CLAUDE.md` only points to `docs/domains/*.md`; the rules went there.
- `page.pdf()` check: draft and confirmed sheet 1 page each, bake lists 1 page each. The Saturday
  checked then had 34 lines, not the 56 first noted here; the busy-Saturday recheck is in §9 Nr. 3.

Original plan:

- Files: new `components/backzettel/{DoughDayPrint,BackzettelPrintExtras,BakeListPrint}.tsx`,
  `src/lib/dayPrintLayout.ts` (+ spec), `BackzettelPrint.tsx` (legacy path only), wiring in
  `BackzettelDayClient.tsx` and `BakeListClient.tsx`; `src/content/hilfe/spickzettel.ts`;
  root `CLAUDE.md` (Backzettel sections), `docs/roadmap.md` (Z10 → done items).
- Acceptance: one page for the busiest fixture (`page.pdf()` check documented in the PR), second
  sheet only when ticked, bake list one page; spickzettel spec green.
- Runs after S5 (shares `BackzettelDayClient.tsx`). It can run in parallel with S5 only if S5
  leaves the print wiring (one import + one checkbox) to S6.

Order: S1 → S2 → S3 → (S4 ∥ S5) → S6. The box can take S1–S3 with today's hq file (nothing
changes for it). Apply the new hq YAML only after S5 is deployed: before that, the v1 screens would
list Tuesday's rolls inside Saturday's Brötchen section without saying they are for Tuesday.
