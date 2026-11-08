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
 */

const SNAPSHOT_SCHEMA_VERSION = 1
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

function pickLine(line) {
  const out = {
    itemId: str(line.itemId),
    name: str(line.name),
    variant:
      line.variant === null || line.variant === '' ? null : str(line.variant),
    unit: str(line.unit),
    base: num(line.base),
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
  return out
}

function pickHefeteig(h) {
  if (!h || typeof h !== 'object') return null
  return {
    pieces: num(h.pieces),
    dough_g: num(h.dough_g),
    doughs: (Array.isArray(h.doughs) ? h.doughs : []).map((d) => ({
      id: str(d.id),
      name: str(d.name),
      batch_max_kg: numOrNull(d.batch_max_kg),
      pieces: num(d.pieces),
      dough_g: num(d.dough_g),
      batches: numOrNull(d.batches),
      weighing: (Array.isArray(d.weighing) ? d.weighing : []).map((w) => ({
        piece_g: num(w.piece_g),
        pieces: num(w.pieces),
        items: (Array.isArray(w.items) ? w.items : []).map((i) => ({
          itemId: str(i.itemId),
          name: str(i.name),
          products: num(i.products),
          piecesPerProduct: num(i.piecesPerProduct),
          pieces: num(i.pieces),
        })),
      })),
    })),
  }
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

function pickFillings(list) {
  return (Array.isArray(list) ? list : []).map((f) => ({
    id: str(f.id),
    name: str(f.name),
    grams: num(f.grams),
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
  const sections = (Array.isArray(day.sections) ? day.sections : []).map(
    (s) => ({
      id: str(s.id),
      label: str(s.label),
      lines: (Array.isArray(s.lines) ? s.lines : []).map(pickLine),
    })
  )
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
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
    hefeteig: pickHefeteig(day.hefeteig),
    fillings: pickFillings(day.fillings),
    prep: pickPrep(day.prep),
    warnings: pickWarnings(day.warnings),
    source: 'Verwaltung (App)',
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

/** German Markdown of a Backzettel snapshot (from `backzettelSnapshot`). */
function backzettelMarkdown(snapshot) {
  const s = snapshot
  if (s && s.status === 'reopened') return reopenedMarkdown(s)
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

  for (const section of s.sections) {
    out.push(`## ${section.label || section.id}`)
    out.push('')
    out.push(
      '| Posten | Sorte | Einheit | Basis | Saison | Vorbest. | CAP | Korr. | **Gesamt** | Blech |'
    )
    out.push(
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
    )
    for (const l of section.lines) {
      const total =
        `**${deNumber(l.total)}**` +
        (l.loavesEstimate
          ? ` (ca. ${deNumber(l.loavesEstimate, 0)} Laibe)`
          : '')
      out.push(
        `| ${cell(l.name)} | ${cell(l.variant || '')} | ${cell(
          l.unit
        )} | ${deNumber(l.base)} | ${signed(l.seasonal)} | ${
          l.preorders ? deNumber(l.preorders) : ''
        } | ${l.cap ? deNumber(l.cap) : ''} | ${signed(
          l.correction
        )} | ${total} | ${cell(l.tray || '')} |`
      )
    }
    out.push('')
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
      `Insgesamt ${deNumber(h.pieces, 0)} Teigstücke, ${deNumber(
        h.dough_g / 1000
      )} kg Teig.`
    )
    out.push('')
    for (const d of h.doughs) {
      out.push(`### ${d.name || d.id}`)
      out.push('')
      out.push(
        `${deNumber(d.pieces, 0)} Teigstücke, ${deNumber(
          d.dough_g / 1000
        )} kg Teig` +
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
          `| ${deNumber(w.piece_g, 0)} g | ${deNumber(
            w.pieces,
            0
          )} | ${forWhat} |`
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
        `### ${f.name || f.id}: ${deNumber(f.grams / 1000)} kg` +
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
