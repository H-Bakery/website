/**
 * Daily snapshots the app writes to hq (Z9, roadmap D13/D14/§4a): pure
 * rules, dependency-free CommonJS. Writing files and git live in
 * `hq-snapshots.service.ts`.
 *
 *   data/production/backzettel/YYYY-MM-DD.json   confirmed Backzettel (data)
 *   data/production/backzettel/YYYY-MM-DD.md     the same, German Markdown
 *                                                 for Anna and people
 *   data/production/vorbestellungen/YYYY-MM-DD.json  preorder sums per
 *                                                 product/variant, counts per
 *                                                 channel and pickup point
 *   data/production/rest/YYYY-MM-DD.json         „Rest am Abend“ (M4): baked,
 *                                                 rest and counts per line
 *
 * **No personal data (D13).** Every field is picked by a whitelist - a new
 * field in the day view or the preorder answer stays out until it is added
 * here on purpose. Left out on purpose: who confirmed, corrected or ticked
 * (only the confirming *role* is written), the free-text correction reasons
 * (they may name a customer), deltas and preorder ids/codes, customer names,
 * phones, notes, money - and variant slugs nobody configured: a preorder for
 * a product without Backzettel master data takes any slug, and a slug is
 * free text (`fuer-lisa-mueller`). Only configured variants are written;
 * warnings about the others carry a fixed text without the slug.
 *
 * **Schema 2 (Backzettel v2, Z10):** a sheet frozen as a dough-day sheet
 * (`sheetVersion: 2`) is written with `schema_version: 2` - additive: every
 * line carries its `bakeDate`, `doughDate` and `variantLabel`, and the day
 * the bake days, doughs, machine boxes, Bruch groups and open master data.
 * Unknown master values stay `null` (never 0). Days confirmed before Z10
 * (`sheetVersion: 1`) keep schema 1 byte for byte.
 */

const SNAPSHOT_SCHEMA_VERSION = 1
/** Dough-day sheets (Backzettel v2, Z10). */
const SNAPSHOT_SCHEMA_VERSION_V2 = 2
const SNAPSHOT_ROOT = 'data/production'
const BACKZETTEL_DIR = `${SNAPSHOT_ROOT}/backzettel`
const PREORDERS_DIR = `${SNAPSHOT_ROOT}/vorbestellungen`
/** M4 „Rest am Abend“ (after the pilot): what was left at closing. */
const REST_DIR = `${SNAPSHOT_ROOT}/rest`

const ROLE_LABELS = {
  inhaber: 'Inhaber',
  backstube: 'Backstube',
  verkauf: 'Verkauf',
  fahrer: 'Fahrer',
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isDate(date) {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return false
  const d = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date
}

function roleLabel(role) {
  return ROLE_LABELS[role] || 'Verwaltung'
}

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(x) {
  if (x === null || x === undefined || x === '') return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

function str(x) {
  return x === null || x === undefined ? null : String(x)
}

/** Paths of a day's files, relative to the hq root. */
function snapshotPaths(date) {
  return {
    backzettelJson: `${BACKZETTEL_DIR}/${date}.json`,
    backzettelMd: `${BACKZETTEL_DIR}/${date}.md`,
    preordersJson: `${PREORDERS_DIR}/${date}.json`,
    restJson: `${REST_DIR}/${date}.json`,
  }
}

function toIso(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ------------------------------------------------------------- Backzettel

function pickLine(line, v2) {
  const out = {
    itemId: str(line.itemId),
    name: str(line.name),
    variant:
      line.variant === null || line.variant === '' ? null : str(line.variant),
    unit: str(line.unit),
    // Schema 2: a Grundmenge not set yet stays null, never 0.
    base: v2 && line.baseUnset === true ? null : num(line.base),
    seasonal: num(line.seasonal),
    preorders: num(line.preorders),
    cap: num(line.cap),
    correction: num(line.correction),
    total: num(line.total),
    tray: line.tray ? String(line.tray) : null,
    plu: line.plu === undefined || line.plu === null ? null : line.plu,
  }
  if (line.loavesEstimate !== undefined && line.loavesEstimate !== null) {
    out.loavesEstimate = num(line.loavesEstimate)
  }
  if (v2) {
    out.bakeDate = isDate(line.bakeDate) ? line.bakeDate : null
    out.doughDate = isDate(line.doughDate) ? line.doughDate : null
    out.variantLabel =
      out.variant === null ? null : str(line.variantLabel) || out.variant
    out.baseUnset = line.baseUnset === true
    // Grundmenge offen: `total` ist nur das Bekannte (Mindestmenge, Regel 8)
    out.totalIsMinimum = line.totalIsMinimum === true
  }
  return out
}

/** `{ exact, rounded, reason }` of a litre or gram figure (Z10). */
function pickKnown(x) {
  if (!x || typeof x !== 'object') return null
  return {
    exact: numOrNull(x.exact),
    rounded: numOrNull(x.rounded),
    reason: str(x.reason),
  }
}

/** What a dough or group is missing (master data, never people). */
function pickMissing(list) {
  return (Array.isArray(list) ? list : []).map((m) => ({
    itemId: str(m && m.itemId),
    name: str(m && m.name),
    field: str(m && m.field),
    code: str(m && m.code),
    message: str(m && m.message),
  }))
}

function pickAddons(list) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    id: str(a.id),
    name: str(a.name),
    g_per_liter: numOrNull(a.g_per_liter),
    grams:
      a.grams && typeof a.grams === 'object'
        ? {
            exact: numOrNull(a.grams.exact),
            rounded: numOrNull(a.grams.rounded),
          }
        : null,
    reason: str(a.reason),
  }))
}

function pickBakeDates(list) {
  return (Array.isArray(list) ? list : [])
    .filter((b) => b && isDate(b.date))
    .map((b) => ({
      date: b.date,
      weekday: num(b.weekday),
      weekdayName: str(b.weekdayName),
      label: str(b.label),
      lineCount: num(b.lineCount),
    }))
}

function pickDoughs(list) {
  return (Array.isArray(list) ? list : []).map((d) => ({
    id: str(d.id),
    name: str(d.name),
    kg: numOrNull(d.kg),
    kgKnown: num(d.kgKnown),
    complete: d.complete === true,
    missing: pickMissing(d.missing),
    liters: pickKnown(d.liters),
    batches: numOrNull(d.batches),
    batch_max_kg: numOrNull(d.batch_max_kg),
    addons: pickAddons(d.addons),
    parts: (Array.isArray(d.parts) ? d.parts : []).map((p) => ({
      kind: str(p.kind),
      itemId: str(p.itemId),
      name: str(p.name),
      bakeDate: isDate(p.bakeDate) ? p.bakeDate : null,
      kg: numOrNull(p.kg),
    })),
    extras: (Array.isArray(d.extras) ? d.extras : []).map((e) => ({
      name: str(e.name),
      kg: numOrNull(e.kg),
      itemId: str(e.itemId),
    })),
    combinedWith: str(d.combinedWith),
  }))
}

function pickMachine(list) {
  return (Array.isArray(list) ? list : []).map((m) => ({
    id: str(m.id),
    name: str(m.name),
    doughIds: (Array.isArray(m.doughIds) ? m.doughIds : []).map(str),
    section: str(m.section),
    kg: numOrNull(m.kg),
    kgKnown: num(m.kgKnown),
    complete: m.complete === true,
    liters: pickKnown(m.liters),
    batches: numOrNull(m.batches),
    batch_max_kg: numOrNull(m.batch_max_kg),
    addons: pickAddons(m.addons),
  }))
}

function pickVariant(v) {
  return v === null || v === undefined || v === '' ? null : String(v)
}

function pickRolls(list) {
  return (Array.isArray(list) ? list : [])
    .filter((b) => b && isDate(b.bakeDate))
    .map((b) => ({
      bakeDate: b.bakeDate,
      label: str(b.label),
      groups: (Array.isArray(b.groups) ? b.groups : []).map((g) => ({
        group: str(g.group),
        name: str(g.name),
        doughId: str(g.doughId),
        g: numOrNull(g.g),
        piecesPerBruch: numOrNull(g.piecesPerBruch),
        pieces: numOrNull(g.pieces),
        brueche: numOrNull(g.brueche),
        kg: numOrNull(g.kg),
        spare: numOrNull(g.spare),
        spareProducts: numOrNull(g.spareProducts),
        perProduct: numOrNull(g.perProduct),
        // nur die bekannten Mitglieder („≥ n Bruch“), solange eine
        // Grundmenge offen ist - nie 0 für unbekannt (Regel 8)
        piecesKnown: numOrNull(g.piecesKnown),
        bruecheKnown: numOrNull(g.bruecheKnown),
        kgKnown: numOrNull(g.kgKnown),
        complete: g.complete !== false,
        missing: pickMissing(g.missing),
        split: (Array.isArray(g.split) ? g.split : []).map((x) => ({
          itemId: str(x.itemId),
          name: str(x.name),
          variant: pickVariant(x.variant),
          total: numOrNull(x.total),
          perProduct: numOrNull(x.perProduct),
          doughPieces: numOrNull(x.doughPieces),
          totalIsMinimum: x.totalIsMinimum === true,
        })),
      })),
      singles: (Array.isArray(b.singles) ? b.singles : []).map((x) => ({
        itemId: str(x.itemId),
        name: str(x.name),
        variant: pickVariant(x.variant),
        total: numOrNull(x.total),
        totalIsMinimum: x.totalIsMinimum === true,
        piece_g: numOrNull(x.piece_g),
        pieces: numOrNull(x.pieces),
        kg: numOrNull(x.kg),
      })),
    }))
}

function pickOpenMasterData(list) {
  return (Array.isArray(list) ? list : []).map((o) => ({
    path: str(o && o.path),
    code: str(o && o.code),
    message: str(o && o.message),
  }))
}

function pickHefeteig(h, v2) {
  if (!h || typeof h !== 'object') return null
  // Schema 2: an unknown weight or count stays null (docs/backzettel-v2.md
  // §3) - schema 1 days never had one.
  const n = v2 ? numOrNull : num
  const out = {
    pieces: n(h.pieces),
    dough_g: n(h.dough_g),
    doughs: (Array.isArray(h.doughs) ? h.doughs : []).map((d) => {
      const dough = {
        id: str(d.id),
        name: str(d.name),
        batch_max_kg: numOrNull(d.batch_max_kg),
        pieces: n(d.pieces),
        dough_g: n(d.dough_g),
        batches: numOrNull(d.batches),
        weighing: (Array.isArray(d.weighing) ? d.weighing : []).map((w) => ({
          piece_g: n(w.piece_g),
          pieces: n(w.pieces),
          items: (Array.isArray(w.items) ? w.items : []).map((i) => ({
            itemId: str(i.itemId),
            name: str(i.name),
            products: num(i.products),
            piecesPerProduct: num(i.piecesPerProduct),
            pieces: num(i.pieces),
          })),
        })),
      }
      if (v2) {
        dough.kg = numOrNull(d.kg)
        dough.kgKnown = num(d.kgKnown)
        dough.complete = d.complete !== false
        dough.missing = pickMissing(d.missing)
        dough.liters = pickKnown(d.liters)
      }
      return dough
    }),
  }
  if (v2) out.complete = h.complete !== false
  return out
}

function pickRecipe(r) {
  if (!r || typeof r !== 'object') return null
  return {
    title: str(r.title),
    batch_g: num(r.batch_g),
    grams: num(r.grams),
    factor: num(r.factor),
    complete: r.complete !== false,
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map(
      (i) => ({
        name: str(i.name),
        g: numOrNull(i.g),
        unit: str(i.unit),
        scaled_g: numOrNull(i.scaled_g),
      })
    ),
  }
}

function pickFillings(list, v2) {
  return (Array.isArray(list) ? list : []).map((f) => ({
    id: str(f.id),
    name: str(f.name),
    // Schema 2: with grams per piece missing the total is unknown (null);
    // `gramsKnown` is the sum of the known items.
    // A filled item without a Grundmenge (`baseUnset`) makes it unknown too.
    grams: v2 && (f.missingFillingG || f.baseUnset) ? null : num(f.grams),
    ...(v2
      ? {
          gramsKnown: num(f.grams),
          baseUnset: f.baseUnset === true,
          openItems: (Array.isArray(f.openItems) ? f.openItems : []).map(str),
        }
      : {}),
    missingFillingG: !!f.missingFillingG,
    items: (Array.isArray(f.items) ? f.items : []).map((i) => ({
      itemId: str(i.itemId),
      name: str(i.name),
      pieces: num(i.pieces),
      filling_g: numOrNull(i.filling_g),
      grams: numOrNull(i.grams),
    })),
    recipe: pickRecipe(f.recipe),
    recipeMissing: !!f.recipeMissing,
  }))
}

function pickPrep(list) {
  return (Array.isArray(list) ? list : []).map((p) => ({
    id: str(p.id),
    name: str(p.name),
    variant:
      p.variant === null || p.variant === undefined ? null : String(p.variant),
    note: p.note ? String(p.note) : null,
  }))
}

/**
 * Warnings whose message quotes a raw variant slug (possibly typed by staff)
 * get a fixed text instead; the item id comes from the master data.
 */
const SAFE_WARNING_TEXT = {
  variant_ignored: (id) =>
    `Vorbestellung mit Sorte für „${id}“, der Posten hat keine Sorten - ohne Sorte gezählt.`,
  unknown_variant: (id) =>
    `Vorbestellung mit unbekannter Sorte für „${id}“ - gezählt unter „ohne Angabe“.`,
  unknown_correction: (id) =>
    `Eine Korrektur${
      id ? ` für „${id}“` : ''
    } wird ignoriert - Posten oder Sorte gibt es nicht mehr.`,
}

function pickWarnings(list) {
  return (Array.isArray(list) ? list : []).map((w) => {
    const code = str(w && w.code)
    const safe = SAFE_WARNING_TEXT[code]
    return {
      code,
      message: safe ? safe(str(w && w.itemId) || '?') : str(w && w.message),
    }
  })
}

/**
 * The JSON snapshot of a confirmed day (the API's day view, Z3).
 * `role` = role of whoever confirmed (never the name, D13).
 */
function backzettelSnapshot(day, options) {
  const opts = options || {}
  if (!day || day.status !== 'confirmed' || !isDate(day.date)) {
    throw new Error(
      'Nur ein freigegebener Backzettel mit Datum wird geschrieben.'
    )
  }
  const v2 = day.sheetVersion === 2
  const sections = (Array.isArray(day.sections) ? day.sections : []).map(
    (s) => ({
      id: str(s.id),
      label: str(s.label),
      lines: (Array.isArray(s.lines) ? s.lines : []).map((l) =>
        pickLine(l, v2)
      ),
    })
  )
  const snapshot = {
    schema_version: v2 ? SNAPSHOT_SCHEMA_VERSION_V2 : SNAPSHOT_SCHEMA_VERSION,
    kind: 'backzettel',
    status: 'confirmed',
    date: day.date,
    weekday: num(day.weekday),
    weekdayName: str(day.weekdayName),
    seasonFactor: num(day.seasonFactor) || 1,
    confirmed: {
      at: toIso(day.confirmedAt),
      role: ROLE_LABELS[opts.role] ? opts.role : null,
    },
    prepDate: str(day.prepDate),
    prepDateProvisional:
      day.prepDateProvisional === undefined ? null : day.prepDateProvisional,
    sections,
    hefeteig: pickHefeteig(day.hefeteig, v2),
    fillings: pickFillings(day.fillings, v2),
    prep: pickPrep(day.prep),
    warnings: pickWarnings(day.warnings),
    source: 'Verwaltung (App)',
  }
  if (!v2) return snapshot
  // Additive (schema 2), before `source` so the file reads top to bottom.
  const { source, ...rest } = snapshot
  return {
    ...rest,
    sheetVersion: 2,
    isDoughDay: day.isDoughDay === undefined ? null : day.isDoughDay === true,
    bakeDates: pickBakeDates(day.bakeDates),
    doughs: pickDoughs(day.doughs),
    machine: pickMachine(day.machine),
    rolls: pickRolls(day.rolls),
    openMasterData: pickOpenMasterData(day.openMasterData),
    source,
  }
}

/**
 * What replaces a day's snapshot after a reopen (Z3 `reopen`): the released
 * version no longer holds, so hq must not keep saying "Freigegeben". The
 * next confirm writes the full Backzettel again. Role only (D13); the reopen
 * reason (free text) stays out.
 */
function backzettelReopenedSnapshot(input) {
  const i = input || {}
  if (!isDate(i.date)) {
    throw new Error('Ungültiges Datum für den Backzettel-Snapshot.')
  }
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    kind: 'backzettel',
    status: 'reopened',
    date: i.date,
    reopened: {
      at: toIso(i.at),
      role: ROLE_LABELS[i.role] ? i.role : null,
    },
    source: 'Verwaltung (App)',
  }
}

// ----------------------------------------------------------------- Markdown

const deNumber = (x, digits) =>
  num(x).toLocaleString('de-DE', {
    maximumFractionDigits: digits === undefined ? 2 : digits,
  })

function deDate(date) {
  const [y, m, d] = String(date).split('-')
  return `${d}.${m}.${y}`
}

function berlinDateTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type) => (parts.find((p) => p.type === type) || {}).value
  return {
    date: `${get('day')}.${get('month')}.${get('year')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

/** Table cell: no pipes, no line breaks. */
function cell(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/\|/g, '/')
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim()
}

function signed(x) {
  const n = num(x)
  if (n === 0) return ''
  return n > 0 ? `+${deNumber(n)}` : `−${deNumber(-n)}`
}

/** A known number with unit, or „unbekannt“ (schema 2: `null` = unknown). */
function known(x, digits, unit) {
  if (x === null || x === undefined) return 'unbekannt'
  return `${deNumber(x, digits)}${unit ? ` ${unit}` : ''}`
}

/** kg of a dough or machine box: exact, „≥ known“ when incomplete, or unknown. */
function kgText(d) {
  if (d.kg !== null && d.kg !== undefined) return `${deNumber(d.kg)} kg`
  return d.kgKnown > 0
    ? `≥ ${deNumber(d.kgKnown)} kg (unvollständig)`
    : 'unbekannt'
}

/** Litres: rounded, exact with „Rundung offen“, or unknown with the reason. */
function litersText(l) {
  if (!l) return 'unbekannt'
  if (l.rounded !== null) return `${deNumber(l.rounded)} L`
  if (l.exact !== null) return `${deNumber(l.exact)} L (Rundung offen)`
  const why = {
    kg_per_liter_unknown: 'kg je Liter offen',
    dough_incomplete: 'Teig unvollständig',
  }[l.reason]
  return why ? `unbekannt (${why})` : 'unbekannt'
}

function addonsText(list) {
  return list
    .map((a) => {
      const g = a.grams
        ? a.grams.rounded !== null
          ? `${deNumber(a.grams.rounded, 1)} g`
          : a.grams.exact !== null
          ? `${deNumber(a.grams.exact, 1)} g (Rundung offen)`
          : 'unbekannt'
        : 'unbekannt'
      return `${a.name || a.id} ${g}`
    })
    .join(', ')
}

/**
 * A quantity whose Grundmenge may be open: „7“, „≥ 7“ (only the preorders/CAP
 * are known) or „offen“ (nothing known yet) - never „0“ for unknown.
 */
function minimumText(total, isMinimum) {
  if (total === null || total === undefined) return 'offen'
  if (!isMinimum) return deNumber(total)
  return total > 0 ? `≥ ${deNumber(total)}` : 'offen'
}

/** „4 Bruch“, „≥ 2 Bruch“ (a Grundmenge open) or „? Bruch“. */
function bruecheText(g) {
  if (g.brueche !== null) return `${deNumber(g.brueche)} Bruch`
  return g.bruecheKnown ? `≥ ${deNumber(g.bruecheKnown)} Bruch` : '? Bruch'
}

/** „ (+4 frei)“ in products, „ (+9 Teigstücke frei)“ for mixed groups. */
function spareText(g) {
  if (g.spare === null || !(g.spare > 0)) return ''
  if (g.spareProducts !== null) {
    // a leftover dough piece that is no whole product: in dough pieces
    return g.spareProducts > 0
      ? ` (+${deNumber(g.spareProducts)} frei)`
      : ` (+${deNumber(g.spare)} ${
          g.spare === 1 ? 'Teigstück' : 'Teigstücke'
        } frei)`
  }
  return g.perProduct === 1
    ? ` (+${deNumber(g.spare)} frei)`
    : ` (+${deNumber(g.spare)} Teigstücke frei)`
}

/** „für Sonntag, 29.11.2026“ / „heute“ for a bake day of a sheet. */
function bakeDayTitle(s, date) {
  if (!date || date === s.date) return 'Heute backen'
  const b = (s.bakeDates || []).find((x) => x.date === date)
  return `Für ${b && b.weekdayName ? `${b.weekdayName}, ` : ''}${deDate(date)}`
}

function linesTable(out, lines, v2) {
  out.push(
    '| Posten | Sorte | Einheit | Basis | Saison | Vorbest. | CAP | Korr. | **Gesamt** | Blech |'
  )
  out.push(
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  )
  for (const l of lines) {
    const total =
      `**${v2 ? minimumText(l.total, l.totalIsMinimum) : deNumber(l.total)}**` +
      (l.loavesEstimate ? ` (ca. ${deNumber(l.loavesEstimate, 0)} Laibe)` : '')
    const base = v2 && l.base === null ? 'offen' : deNumber(l.base)
    out.push(
      `| ${cell(l.name)} | ${cell(
        (v2 ? l.variantLabel : l.variant) || ''
      )} | ${cell(l.unit)} | ${base} | ${signed(l.seasonal)} | ${
        l.preorders ? deNumber(l.preorders) : ''
      } | ${l.cap ? deNumber(l.cap) : ''} | ${signed(
        l.correction
      )} | ${total} | ${cell(l.tray || '')} |`
    )
  }
}

/** Schema 2: machine boxes, Brüche per bake day, open master data. */
function doughDayMarkdown(out, s) {
  if (s.machine.length > 0) {
    out.push('## Teige an der Maschine')
    out.push('')
    out.push('| Teig | kg | Liter | Chargen | Zugaben |')
    out.push('| --- | ---: | ---: | ---: | --- |')
    for (const m of s.machine) {
      out.push(
        `| ${cell(m.name || m.id || 'Teig offen')} | ${kgText(m)} | ${cell(
          litersText(m.liters)
        )} | ${known(m.batches, 0)} | ${cell(addonsText(m.addons))} |`
      )
    }
    out.push('')
    const combined = s.doughs.filter((d) => d.combinedWith)
    if (combined.length > 0) {
      out.push(
        'Gemeinsame Literzahl: ' +
          s.doughs
            .filter(
              (d) =>
                d.combinedWith || combined.some((c) => c.combinedWith === d.id)
            )
            .map((d) => `${d.name || d.id} ${kgText(d)}`)
            .join(', ') +
          '.'
      )
      out.push('')
    }
    const extras = s.doughs.flatMap((d) => d.extras)
    if (extras.length > 0) {
      out.push(
        'Dazu (kein Teig): ' +
          extras
            .map((e) => `${cell(e.name)} ${known(e.kg, 2, 'kg')}`)
            .join(', ') +
          '.'
      )
      out.push('')
    }
  }
  const rolls = s.rolls.filter(
    (b) => b.groups.length > 0 || b.singles.length > 0
  )
  if (rolls.length > 0) {
    out.push('## Brötchen nach Backtag')
    out.push('')
    for (const b of rolls) {
      out.push(`### ${bakeDayTitle(s, b.bakeDate)}`)
      out.push('')
      for (const g of b.groups) {
        const split = g.split
          .map(
            (x) =>
              (x.totalIsMinimum && !(x.total > 0)
                ? `${cell(x.name)} offen`
                : `${minimumText(x.total, x.totalIsMinimum)} ${cell(x.name)}`) +
              (x.perProduct > 1
                ? ` (je ${deNumber(x.perProduct)} Teigstücke)`
                : '')
          )
          .join(', ')
        out.push(
          `- ${bruecheText(g)} × ${known(g.g, 0, 'g')}` +
            (g.kg !== null
              ? ` = ${deNumber(g.kg)} kg`
              : g.kgKnown
              ? ` = ≥ ${deNumber(g.kgKnown)} kg`
              : '') +
            ` – ${split}` +
            spareText(g)
        )
      }
      for (const x of b.singles) {
        const qty =
          x.totalIsMinimum && !(x.total > 0)
            ? 'offen'
            : `${minimumText(x.total, x.totalIsMinimum)} Stück`
        out.push(
          `- ${cell(x.name)}: ${qty} à ${known(x.piece_g, 0, 'g')}` +
            (x.kg !== null ? ` = ${deNumber(x.kg)} kg` : ' (kg unbekannt)')
        )
      }
      out.push('')
    }
  }
}

/** German Markdown of a Backzettel snapshot (from `backzettelSnapshot`). */
function backzettelMarkdown(snapshot) {
  const s = snapshot
  if (s && s.status === 'reopened') return reopenedMarkdown(s)
  const v2 = s.schema_version === SNAPSHOT_SCHEMA_VERSION_V2
  const out = []
  out.push(
    `# Backzettel ${s.weekdayName || ''}, ${deDate(s.date)}`.replace(' ,', ',')
  )
  out.push('')
  const when = berlinDateTime(s.confirmed && s.confirmed.at)
  const who =
    s.confirmed && s.confirmed.role ? roleLabel(s.confirmed.role) : 'Verwaltung'
  out.push(
    when
      ? `Freigegeben (${who}) am ${when.date} um ${when.time} Uhr.`
      : `Freigegeben (${who}).`
  )
  out.push(
    `Saisonfaktor ${deNumber(
      s.seasonFactor
    )}. Geschrieben von der Verwaltungs-App; ` +
      'Mengen = Basis + Saison + Vorbestellungen + CAP + Korrektur.'
  )
  out.push('')
  if (v2) {
    const others = s.bakeDates.filter((b) => b.date !== s.date)
    if (others.length > 0) {
      out.push(
        `Teig von heute auch für: ${others
          .map((b) => `${b.weekdayName || ''}, ${deDate(b.date)}`)
          .join('; ')}. Die Brötchen werden am Backtag gebacken.`
      )
      out.push('')
    }
    doughDayMarkdown(out, s)
  }

  for (const section of s.sections) {
    out.push(`## ${section.label || section.id}`)
    out.push('')
    // Schema 2: lines of several bake days (rolls made the day before)
    // are grouped by bake day, so Tuesday's rolls never read as today's.
    const days = v2
      ? [...new Set(section.lines.map((l) => l.bakeDate || s.date))].sort()
      : [null]
    if (days.length > 1) {
      for (const d of days) {
        out.push(`### ${bakeDayTitle(s, d)}`)
        out.push('')
        linesTable(
          out,
          section.lines.filter((l) => (l.bakeDate || s.date) === d),
          v2
        )
        out.push('')
      }
    } else {
      linesTable(out, section.lines, v2)
      out.push('')
    }
  }
  if (s.sections.length === 0) {
    out.push('_Keine Posten an diesem Tag._')
    out.push('')
  }

  const h = s.hefeteig
  if (h && h.doughs.length > 0) {
    out.push('## Hefeteig')
    out.push('')
    out.push(
      `Insgesamt ${known(h.pieces, 0)} Teigstücke, ${known(
        h.dough_g === null ? null : h.dough_g / 1000
      )} kg Teig.`
    )
    out.push('')
    for (const d of h.doughs) {
      out.push(`### ${d.name || d.id}`)
      out.push('')
      out.push(
        `${known(d.pieces, 0)} Teigstücke, ${known(
          d.dough_g === null ? null : d.dough_g / 1000
        )} kg Teig` +
          (v2 && d.liters ? `, Wasser ${litersText(d.liters)}` : '') +
          (d.batches
            ? `, ${d.batches} ${d.batches === 1 ? 'Charge' : 'Chargen'}`
            : '') +
          (d.batch_max_kg
            ? ` (höchstens ${deNumber(d.batch_max_kg)} kg je Charge)`
            : '') +
          '.'
      )
      out.push('')
      out.push('**Wiegeliste**')
      out.push('')
      out.push('| Stückgewicht | Teigstücke | für |')
      out.push('| ---: | ---: | --- |')
      for (const w of d.weighing) {
        const forWhat = w.items
          .map(
            (i) =>
              `${deNumber(i.products)} × ${cell(i.name)}` +
              (i.piecesPerProduct > 1
                ? ` (je ${deNumber(i.piecesPerProduct)} Stück)`
                : '')
          )
          .join(', ')
        out.push(
          `| ${known(w.piece_g, 0, 'g')} | ${known(w.pieces, 0)} | ${forWhat} |`
        )
      }
      out.push('')
    }
  }

  if (s.fillings.length > 0) {
    out.push('## Füllungen')
    out.push('')
    for (const f of s.fillings) {
      out.push(
        v2 && f.grams === null
          ? `### ${f.name || f.id}: ${
              f.gramsKnown > 0
                ? `≥ ${deNumber(f.gramsKnown / 1000)} kg`
                : 'Menge unbekannt'
            } (${
              f.missingFillingG
                ? 'Füllmenge je Stück fehlt'
                : 'Grundmenge offen'
            })`
          : `### ${f.name || f.id}: ${deNumber(f.grams / 1000)} kg` +
              (f.missingFillingG ? ' (Füllmenge je Stück fehlt teilweise)' : '')
      )
      out.push('')
      for (const i of f.items) {
        out.push(
          `- ${deNumber(i.pieces)} × ${cell(i.name)}` +
            (i.filling_g
              ? ` à ${deNumber(i.filling_g, 0)} g`
              : ' (Füllmenge fehlt)')
        )
      }
      out.push('')
      if (f.recipe) {
        out.push(
          `Rezept „${cell(f.recipe.title)}“, Faktor ${deNumber(
            f.recipe.factor,
            3
          )}` +
            (f.recipe.complete ? '' : ' (Rezept unvollständig)') +
            ':'
        )
        out.push('')
        for (const ing of f.recipe.ingredients) {
          out.push(
            `- ${cell(ing.name)}: ` +
              (ing.scaled_g === null
                ? 'nach Gefühl'
                : `${deNumber(ing.scaled_g, 0)} g`)
          )
        }
        out.push('')
      } else if (f.recipeMissing) {
        out.push('_Kein Rezept in hq hinterlegt._')
        out.push('')
      }
    }
  }

  if (s.prep.length > 0) {
    out.push(
      `## Vorbereitung${
        s.prepDate
          ? ` (am ${deDate(s.prepDate)}${
              s.prepDateProvisional ? ', vorläufig' : ''
            })`
          : ''
      }`
    )
    out.push('')
    for (const p of s.prep) {
      out.push(
        `- ${cell(p.name)}${p.variant ? `: ${cell(p.variant)}` : ''}${
          p.note ? ` - ${cell(p.note)}` : ''
        }`
      )
    }
    out.push('')
  }

  if (v2 && s.openMasterData.length > 0) {
    out.push('## Offene Stammdaten')
    out.push('')
    out.push(
      '_Noch nicht festgelegt - der Zettel zeigt dort „unbekannt“, nie eine Schätzung._'
    )
    out.push('')
    for (const o of s.openMasterData) out.push(`- ${cell(o.message || o.code)}`)
    out.push('')
  }

  if (s.warnings.length > 0) {
    out.push('## Hinweise')
    out.push('')
    for (const w of s.warnings) out.push(`- ${cell(w.message || w.code)}`)
    out.push('')
  }
  return out.join('\n')
}

function reopenedMarkdown(s) {
  const when = berlinDateTime(s.reopened && s.reopened.at)
  const who =
    s.reopened && s.reopened.role ? roleLabel(s.reopened.role) : 'Verwaltung'
  return [
    `# Backzettel ${deDate(s.date)}: wieder geöffnet`,
    '',
    (when
      ? `Wieder geöffnet (${who}) am ${when.date} um ${when.time} Uhr.`
      : `Wieder geöffnet (${who}).`) +
      ' Die zuvor freigegebene Fassung gilt nicht mehr; der Backzettel wird überarbeitet.',
    'Nach der nächsten Freigabe steht hier wieder der vollständige Backzettel.',
    '',
  ].join('\n')
}

// ----------------------------------------------------------- Vorbestellungen

const CHANNELS = ['laden', 'telefon', 'whatsapp', 'shop', 'sammelstelle']

/**
 * Preorder snapshot of one pickup day from the API's day data
 * (`PreordersService.day()`): sums per product/variant, counts per channel and
 * per pickup point. Cancelled preorders are not counted. No names, phones,
 * notes, codes or amounts. No timestamp: a second run on unchanged data
 * writes the same bytes (and commits nothing).
 */
function preorderSnapshot(dayData, options) {
  const opts = options || {}
  const variantsOf =
    typeof opts.variantsOf === 'function' ? opts.variantsOf : () => null
  const date = (dayData && dayData.date) || opts.date
  if (!isDate(date))
    throw new Error('Ungültiges Datum für den Vorbestellungs-Snapshot.')
  const preorders = Array.isArray(dayData && dayData.preorders)
    ? dayData.preorders
    : []
  const active = preorders.filter((p) => p && p.status !== 'storniert')

  const channels = {}
  for (const c of CHANNELS) channels[c] = 0
  for (const p of active) {
    const c = String(p.channel || 'laden')
    channels[c] = (channels[c] || 0) + 1
  }

  const points = Array.isArray(dayData && dayData.pickupPoints)
    ? dayData.pickupPoints
    : []
  const pointName = new Map(points.map((p) => [p.id, p.name]))
  const byPoint = new Map([['laden', 0]])
  for (const p of active) {
    const id = p.pickupPointId || 'laden'
    byPoint.set(id, (byPoint.get(id) || 0) + 1)
  }
  for (const p of points) if (!byPoint.has(p.id)) byPoint.set(p.id, 0)
  const pickupPoints = [...byPoint.entries()].map(([id, count]) => ({
    id,
    name: id === 'laden' ? 'Laden' : str(pointName.get(id) || id),
    count,
  }))

  // Only configured variants (D13); the rest is merged into "ohne Sorte".
  const items = []
  const byKey = new Map()
  for (const i of Array.isArray(dayData && dayData.sums) ? dayData.sums : []) {
    const productId = str(i.productId)
    const raw = i.variant ? String(i.variant) : null
    const allowed = raw ? variantsOf(productId) : null
    const variant =
      raw && Array.isArray(allowed) && allowed.includes(raw) ? raw : null
    const key = `${productId}\u0000${variant || ''}`
    const known = byKey.get(key)
    if (known) {
      known.quantity += num(i.quantity)
      known.preorders += num(i.preorders)
      continue
    }
    const item = {
      productId,
      variant,
      name: str(i.name),
      unit: str(i.unit),
      quantity: num(i.quantity),
      preorders: num(i.preorders),
    }
    byKey.set(key, item)
    items.push(item)
  }

  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    kind: 'vorbestellungen',
    date,
    preorderCount: active.length,
    items,
    channels,
    pickupPoints,
    source: 'Verwaltung (App)',
  }
}

/**
 * „Rest am Abend“ of one day (M4) from the `/api/rest` day view
 * (`rest-am-abend.core.js` `buildDayView`): per Backzettel line the baked
 * amount, CAP, the rest in the item's unit and the count per product.
 * Whitelist: no counter (name or id), no times, no revision - and only
 * variants of the master data (the API refuses others). No timestamp: an
 * unchanged day writes the same bytes and commits nothing.
 */
function restSnapshot(view) {
  const date = view && view.date
  if (!isDate(date)) throw new Error('Ungültiges Datum für den Rest-Snapshot.')
  const lines = (Array.isArray(view.lines) ? view.lines : []).map((l) => ({
    itemId: str(l.itemId),
    variant: l.variant ? str(l.variant) : null,
    name: str(l.name),
    section: str(l.section),
    unit: str(l.unit),
    baked: numOrNull(l.baked),
    cap: num(l.cap),
    counted: l.counted === true,
    rest: l.counted === true ? numOrNull(l.rest) : null,
    counts: (Array.isArray(l.rows) ? l.rows : [])
      .filter((r) => r && r.qty !== null && r.qty !== undefined)
      .map((r) => ({
        productId: r.productId ? str(r.productId) : null,
        name: str(r.label),
        unit: str(r.unit),
        qty: num(r.qty),
        factor: num(r.factor),
      })),
  }))
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    kind: 'rest',
    date,
    backzettel: view.backzettelStatus === 'confirmed' ? 'confirmed' : 'draft',
    countedLines: lines.filter((l) => l.counted).length,
    lines: lines.length,
    items: lines,
    source: 'Verwaltung (App)',
  }
}

function restCommitMessage(date) {
  return `chore(production): Rest am Abend ${date} (App)\n`
}

/** Commit messages (German, no names, D13). */
function backzettelCommitMessage(date) {
  return `chore(production): Backzettel ${date} (App)\n`
}

function backzettelReopenedCommitMessage(date) {
  return `chore(production): Backzettel ${date} wieder geöffnet (App)\n`
}

function preordersCommitMessage(date) {
  return `chore(production): Vorbestellungen ${date} (App)\n`
}

/** JSON as written to hq: 2-space indent, trailing newline. */
function toJsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

module.exports = {
  BACKZETTEL_DIR,
  PREORDERS_DIR,
  REST_DIR,
  restSnapshot,
  restCommitMessage,
  ROLE_LABELS,
  SNAPSHOT_ROOT,
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION_V2,
  backzettelCommitMessage,
  backzettelMarkdown,
  backzettelReopenedCommitMessage,
  backzettelReopenedSnapshot,
  backzettelSnapshot,
  isDate,
  preorderSnapshot,
  preordersCommitMessage,
  roleLabel,
  snapshotPaths,
  toJsonFile,
}
