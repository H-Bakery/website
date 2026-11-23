'use strict'

const rest = require('./rest-am-abend.core')

const ACTIONS = {
  rest: { action: 'rest.setCounts', roles: ['verkauf', 'inhaber'] },
}

const numbers = {
  null: 0,
  kein: 0,
  keine: 0,
  keinen: 0,
  nichts: 0,
  ein: 1,
  eine: 1,
  einen: 1,
  eins: 1,
  zwei: 2,
  zwo: 2,
  drei: 3,
  vier: 4,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwoelf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fuenfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreissig: 30,
  vierzig: 40,
  fuenfzig: 50,
  sechzig: 60,
  siebzig: 70,
  achtzig: 80,
  neunzig: 90,
  hundert: 100,
  tausend: 1000,
  halb: 0.5,
  halbe: 0.5,
  halben: 0.5,
  anderthalb: 1.5,
  eineinhalb: 1.5,
  dreiviertel: 0.75,
}

const units = new Map([
  ['stueck', 'Stück'],
  ['stuecke', 'Stück'],
  ['st', 'Stück'],
  ['blech', 'Blech'],
  ['bleche', 'Blech'],
  ['liter', 'Liter'],
  ['l', 'Liter'],
  ['kg', 'kg'],
  ['kilo', 'kg'],
  ['kilogramm', 'kg'],
  ['g', 'g'],
  ['gramm', 'g'],
  ['charge', 'Charge'],
  ['chargen', 'Charge'],
])

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function numberWord(value) {
  if (/^[-−]?\d+([.,]\d+)?$/.test(value))
    return Number(value.replace(',', '.').replace('−', '-'))
  const negative = /^minus\s+(.+)$/i.exec(value)
  if (negative) {
    const amount = numberWord(negative[1])
    return amount === undefined ? undefined : -Math.abs(amount)
  }
  const word = normalize(value)
  if (Object.hasOwn(numbers, word)) return numbers[word]
  const compound = /^(.+)und(.+)$/.exec(word)
  if (!compound) return undefined
  const one = numbers[compound[1]]
  const ten = numbers[compound[2]]
  if (one >= 1 && one <= 9 && ten >= 20 && ten <= 90 && ten % 10 === 0) {
    return one + ten
  }
  return undefined
}

function nameForms(value) {
  const compact = normalize(value).replace(/\s/g, '')
  if (!compact) return []
  const base = compact.replace(/^laugen(?=.{4})/, '')
  return [
    ...new Set([compact, base, base.replace(/(?:en|e|n|s)$/, '')]),
  ].filter(Boolean)
}

// Kölner Phonetik: Doppellaute vor dem Weglassen der inneren Nullen falten.
function koeln(value) {
  const word = value.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
  const codes = Array.from(word, (letter, i) => {
    const prev = word[i - 1] ?? ''
    const next = word[i + 1] ?? ''
    if ('aeijouy'.includes(letter)) return '0'
    if (letter === 'b' || (letter === 'p' && next !== 'h')) return '1'
    if ('dt'.includes(letter)) return /[csz]/.test(next) ? '8' : '2'
    if ('fvw'.includes(letter) || letter === 'p') return '3'
    if ('gkq'.includes(letter)) return '4'
    if (letter === 'x') return /[ckq]/.test(prev) ? '8' : '48'
    if (letter === 'l') return '5'
    if ('mn'.includes(letter)) return '6'
    if (letter === 'r') return '7'
    if ('sz'.includes(letter)) return '8'
    if (letter === 'c') {
      if (i === 0) return /[ahkloqrux]/.test(next) ? '4' : '8'
      return /[sz]/.test(prev) || !/[ahkoqux]/.test(next) ? '8' : '4'
    }
    return ''
  }).join('')
  return codes.replace(/(.)\1+/g, '$1').replace(/(?!^)0/g, '')
}

function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current.push(
        Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + Number(a[i - 1] !== b[j - 1])
        )
      )
    }
    previous = current
  }
  return previous[b.length]
}

function candidatesForDay(day, aliases = {}) {
  return day.lines.flatMap((line) =>
    line.rows
      .filter((row) => !row.stale)
      .map((row) => ({
        key: rest.rowKey(line.itemId, line.variant, row.productId),
        label: row.label,
        lineKey: line.key,
        itemId: line.itemId,
        itemName: line.name,
        itemUnit: line.unit,
        variant: line.variantLabel,
        unit: row.unit,
        integer: row.integer,
        factor: row.factor,
        aliases: Object.hasOwn(aliases, row.productId)
          ? aliases[row.productId]
          : [],
      }))
  )
}

function findRows(name, rows, lineOnly = false) {
  const forms = nameForms(name)
  if (forms.length === 0) return []
  const exactProducts = []
  const exact = []
  const fuzzy = []
  for (const row of rows) {
    const names = lineOnly
      ? [row.itemName, row.itemId]
      : [row.label, row.itemName, ...row.aliases]
    const full = names.flatMap((entry) =>
      row.variant ? [entry, `${entry} ${row.variant}`] : [entry]
    )
    const productNames = [row.label, ...row.aliases].flatMap((entry) =>
      row.variant ? [entry, `${entry} ${row.variant}`] : [entry]
    )
    if (
      !lineOnly &&
      productNames.some((entry) => nameForms(entry)[0] === forms[0])
    ) {
      exactProducts.push(row)
    }
    // Exact full names take precedence over stripped plurals or prefixes.
    if (full.some((entry) => nameForms(entry)[0] === forms[0])) exact.push(row)
    else if (
      full.some((entry) =>
        nameForms(entry).some((form) => forms.includes(form))
      )
    ) {
      fuzzy.push({ row, score: 0 })
    } else if (!lineOnly) {
      const term = forms[0]
      const score = Math.min(
        ...full.map((entry) => {
          const other = nameForms(entry)[0] ?? ''
          if (
            term.length < 4 ||
            other.length < 4 ||
            Math.abs(term.length - other.length) > 2
          )
            return Infinity
          const difference = distance(term, other)
          if (
            difference <= (term.length >= 7 ? 2 : 1) &&
            koeln(term) === koeln(other)
          ) {
            return difference
          }
          return term.length >= 6 && other.length >= 6 && difference === 1
            ? 2
            : Infinity
        })
      )
      if (Number.isFinite(score)) fuzzy.push({ row, score })
    }
  }
  if (exactProducts.length > 0) return exactProducts
  const best = Math.min(...fuzzy.map(({ score }) => score))
  return exact.length
    ? exact
    : fuzzy.filter(({ score }) => score === best).map(({ row }) => row)
}

function isRelative(text) {
  return /\b(dazu|plus|mehr)\b/.test(normalize(text)) || /\+/.test(text)
}

const TOKENS =
  /\bminus\s+(?:\d+(?:[.,]\d+)?|[\p{L}]+)|[-−]?\d+(?:[.,]\d+)?|[\p{L}]+|\+/giu

function parseFragment(heard, rows) {
  const relative = isRelative(heard)
  const block = /^posten\s+(.+)\s+nichts\s+übrig$/i.exec(heard)
  if (block) {
    const matches = findRows(block[1], rows, true)
    if (new Set(matches.map((row) => row.lineKey)).size === 1) {
      return { proposals: matches.map(({ key }) => ({ key, menge: 0, heard })) }
    }
    return { candidates: matches.map(({ key }) => key) }
  }
  const tokens = heard.match(TOKENS) ?? []
  const clean = tokens.filter(
    (token) =>
      !relative ||
      !['noch', 'dazu', 'plus', 'mehr', '+'].includes(normalize(token) || token)
  )
  // Eine Variante kann eine Zahl enthalten (z. B. „500 g“). Die Zahl
  // am Satzende, gegebenenfalls vor einer Einheit, ist dann die Menge.
  const last = clean.length - 1
  let unit = units.get(normalize(clean[last] ?? ''))
  const end = unit ? last - 1 : last
  const index = end >= 0 && numberWord(clean[end]) !== undefined ? end : 0
  const numeral = clean[index] ?? ''
  const menge = numberWord(numeral)
  let product = clean.slice(0, index).join(' ')
  if (index === 0 && clean.length > 1) {
    unit = units.get(normalize(clean[1]))
    product = clean.slice(unit ? 2 : 1).join(' ')
  }
  const matches = findRows(product, rows)
  if (matches.length === 1 && menge !== undefined) {
    return {
      proposals: [
        {
          key: matches[0].key,
          menge,
          heard,
          unit,
          decimalNotation: /[,.]/.test(numeral),
          reason: relative ? 'dazu?' : undefined,
        },
      ],
    }
  }
  return {
    candidates: (matches.length ? matches : findRows(heard, rows)).map(
      ({ key }) => key
    ),
  }
}

function parseWithoutPunctuation(heard, rows) {
  if (isRelative(heard) || /^posten\b/i.test(heard)) return []
  const tokens = [...heard.matchAll(TOKENS)]
  const values = []
  let start = 0
  for (let i = 1; i < tokens.length; i++) {
    if (numberWord(tokens[i][0]) === undefined) continue
    const offset = units.has(normalize(tokens[i + 1]?.[0] ?? ''))
      ? i + 2
      : i + 1
    // Zwischen Mengen muss ein Name stehen, sonst kann es eine Sorte sein.
    if (
      offset < tokens.length &&
      (numberWord(tokens[offset][0]) !== undefined ||
        offset === tokens.length - 1)
    )
      continue
    const end = tokens[offset]?.index ?? heard.length
    const parsed = parseFragment(heard.slice(start, end).trim(), rows)
    if (!parsed.proposals) continue
    values.push(...parsed.proposals)
    start = end
    i = offset
  }
  return start === heard.length ? values : []
}

function parseCountUtterance(transcript, rows) {
  const proposal = []
  const unmatched = []
  for (const fragment of transcript.split(
    /[;!?\n\r]+|(?<!\d)[,.]|[,.](?!\d)/
  )) {
    const heard = fragment.trim()
    if (!heard) continue
    const parsed = parseFragment(heard, rows)
    const values = parsed.proposals ?? parseWithoutPunctuation(heard, rows)
    if (values.length) proposal.push(...values)
    else unmatched.push({ heard, candidates: parsed.candidates })
  }
  return { proposal, unmatched }
}

function validateProposal(proposal, { rows, editable, role, screen = 'rest' }) {
  const known = new Map(rows.map((row) => [row.key, row]))
  const seen = new Set()
  const duplicates = new Set()
  for (const { key } of proposal) {
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  const allowed =
    Object.hasOwn(ACTIONS, screen) && ACTIONS[screen].roles.includes(role)
  return proposal.map(
    ({ key, menge, unit, heard, reason, unsicher, decimalNotation }) => {
      const row = known.get(key)
      let issue = !allowed
        ? 'Für diese Aktion fehlt die Berechtigung.'
        : !editable
        ? 'Dieser Tag ist gesperrt.'
        : !row
        ? 'Diese Zählzeile ist nicht bekannt.'
        : null
      if (!issue && menge !== null && typeof menge !== 'number')
        issue = 'Die Menge fehlt oder ist ungültig.'
      if (!issue && menge !== null) {
        const spoken =
          typeof unit === 'string'
            ? units.get(normalize(unit)) ?? unit
            : undefined
        const parsed = rest.parseSpokenQty(menge, spoken, row)
        if (decimalNotation && (spoken ?? row.unit) === 'Stück' && parsed.ok) {
          issue = 'Bitte eine ganze Zahl ohne Komma für Stück angeben.'
        } else if (parsed.ok) menge = parsed.value
        else issue = parsed.message
      }
      return {
        key,
        menge: issue ? null : menge,
        heard,
        unsicher: Boolean(
          issue || reason || unsicher || menge === null || duplicates.has(key)
        ),
        reason:
          ([reason, issue].filter(Boolean).join(' · ') || null) ??
          (duplicates.has(key)
            ? 'Zeile mehrfach gehört.'
            : menge === null
            ? 'Menge fehlt.'
            : unsicher
            ? 'Zuordnung oder Menge unklar.'
            : null),
      }
    }
  )
}

function mergeModelProposal(parsed, result, transcript, validation) {
  const normalizedTranscript = normalize(transcript)
  const relative = isRelative(transcript)
  const modelRows = result.zeilen
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const heard = typeof row.gehoert === 'string' ? row.gehoert.trim() : ''
      const excerpt = normalize(heard)
      const validExcerpt =
        excerpt && ` ${normalizedTranscript} `.includes(` ${excerpt} `)
      return {
        key: typeof row.key === 'string' ? row.key : '',
        menge: row.menge,
        unit: row.einheit,
        heard: heard || 'Gehörter Ausschnitt fehlt.',
        unsicher: row.unsicher !== false || !validExcerpt,
        reason: relative
          ? 'dazu?'
          : !validExcerpt
          ? 'Der gehörte Ausschnitt ist unklar.'
          : undefined,
      }
    })
    .filter(
      (row) =>
        !parsed.proposal.some(
          (entry) =>
            entry.key === row.key &&
            normalize(entry.heard) === normalize(row.heard)
        )
    )
  const proposal = validateProposal(
    [...parsed.proposal, ...modelRows],
    validation
  )
  const resolved = new Set(modelRows.map((row) => normalize(row.heard)))
  const unmatched = new Map(
    parsed.unmatched
      .filter(({ heard }) => !resolved.has(normalize(heard)))
      .map((entry) => [normalize(entry.heard), entry])
  )
  for (const heard of result.nicht_zugeordnet) {
    if (typeof heard !== 'string' || !heard.trim()) continue
    const key = normalize(heard)
    if (!unmatched.has(key)) unmatched.set(key, { heard })
  }
  return { proposal, unmatched: [...unmatched.values()] }
}

function budgetThreshold(microEuro) {
  return Math.ceil(microEuro * 0.8)
}

function estimatedCostMicroEur({
  seconds = 0,
  sttRate = 0,
  input = 0,
  output = 0,
  read = 0,
  write = 0,
  llmRate,
}) {
  // Konservative Näherung: USD-Tarife werden 1:1 in EUR angesetzt.
  return Math.ceil(
    ((seconds * sttRate) / 60) * 1_000_000 +
      (llmRate
        ? input * llmRate.input +
          output * llmRate.output +
          read * llmRate.input * 0.1 +
          write * llmRate.input * 1.25
        : 0)
  )
}

module.exports = {
  ACTIONS,
  candidatesForDay,
  parseCountUtterance,
  validateProposal,
  mergeModelProposal,
  budgetThreshold,
  estimatedCostMicroEur,
}
