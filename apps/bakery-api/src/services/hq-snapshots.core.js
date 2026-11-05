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
 *
 * **No personal data (D13).** Every field is picked by a whitelist - a new
 * field in the day view or the preorder answer stays out until it is added
 * here on purpose. Left out on purpose: who confirmed, corrected or ticked
 * (only the confirming *role* is written), the free-text correction reasons
 * (they may name a customer), deltas and preorder ids/codes, customer names,
 * phones, notes, money.
 */

const SNAPSHOT_SCHEMA_VERSION = 1
const SNAPSHOT_ROOT = 'data/production'
const BACKZETTEL_DIR = `${SNAPSHOT_ROOT}/backzettel`
const PREORDERS_DIR = `${SNAPSHOT_ROOT}/vorbestellungen`

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

function pickWarnings(list) {
  return (Array.isArray(list) ? list : []).map((w) => ({
    code: str(w && w.code),
    message: str(w && w.message),
  }))
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

  const items = (
    Array.isArray(dayData && dayData.sums) ? dayData.sums : []
  ).map((i) => ({
    productId: str(i.productId),
    variant: i.variant ? String(i.variant) : null,
    name: str(i.name),
    unit: str(i.unit),
    quantity: num(i.quantity),
    preorders: num(i.preorders),
  }))

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

/** Commit messages (German, no names, D13). */
function backzettelCommitMessage(date) {
  return `chore(production): Backzettel ${date} (App)\n`
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
  ROLE_LABELS,
  SNAPSHOT_ROOT,
  SNAPSHOT_SCHEMA_VERSION,
  backzettelCommitMessage,
  backzettelMarkdown,
  backzettelSnapshot,
  isDate,
  preorderSnapshot,
  preordersCommitMessage,
  roleLabel,
  snapshotPaths,
  toJsonFile,
}
