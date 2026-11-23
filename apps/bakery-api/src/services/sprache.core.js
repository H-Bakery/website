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
  ['litern', 'Liter'],
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
  const magnitude = /^(.*?)(tausend|hundert)(.*)$/.exec(word)
  if (magnitude) {
    const scale = numbers[magnitude[2]]
    const count = magnitude[1] ? numberWord(magnitude[1]) : 1
    const remainder = magnitude[3].replace(/^und(?=.)/, '')
    const tail = remainder ? numberWord(remainder) : 0
    if (
      Number.isInteger(count) &&
      count > 0 &&
      count < scale &&
      tail >= 0 &&
      tail < scale
    ) {
      return count * scale + tail
    }
  }
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

const FRAGMENT_SEPARATOR = /[;!?\n\r]+|(?<!\d)[,.]|[,.](?!\d)/

function spokenUnit(unit) {
  return typeof unit === 'string'
    ? units.get(normalize(unit)) ?? unit
    : undefined
}

function parseCountUtterance(transcript, rows) {
  const proposal = []
  const unmatched = []
  for (const fragment of transcript.split(FRAGMENT_SEPARATOR)) {
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
        const spoken = spokenUnit(unit)
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

// Für die Belegprüfung Satzzeichen in Zahlen beibehalten. Der Namensvergleich
// würde hier zum Beispiel das Komma in „1,0“ verlieren.
function speechText(text) {
  return text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Zahlenteile aus dem gesamten Bruchstück lesen. Ein Zitat kann mitten in
// einer Dezimalzahl oder zwischen Hundertern und Tausendern beginnen.
function quantityExpressions(tokens) {
  const amounts = []
  for (let start = 0; start < tokens.length; ) {
    const signed = /^[-−]/.test(tokens[start])
    let expression = tokens[start].replace(/^[-−]/, '')
    let qty = numberWord(expression)
    let end = start + 1
    if (qty === undefined) {
      start = end
      continue
    }

    const groupedDigits = /^[-−]?\d{1,3}$/.test(expression)
    while (/^\d{3}$/.test(tokens[end] ?? '') && groupedDigits) {
      expression += tokens[end++]
      qty = numberWord(expression)
    }
    while (
      end < tokens.length &&
      (!/^\d+$/.test(tokens[end]) || /(?:tausend|hundert)/.test(expression))
    ) {
      const last =
        tokens[end] === 'und' && /(?:tausend|hundert)/.test(expression)
          ? Math.min(end + 1, tokens.length - 1)
          : end
      const combined = expression + tokens.slice(end, last + 1).join('')
      const joined = numberWord(combined)
      if (joined === undefined) break
      expression = combined
      end = last + 1
      qty = joined
    }

    if (signed) qty = -Math.abs(qty)
    let decimalNotation = /[,.]/.test(expression)
    if (tokens[end] === 'komma') {
      decimalNotation = true
      end++
      let digits = ''
      while (end < tokens.length) {
        const token = tokens[end]
        const digit = numberWord(token)
        if (/^\d+$/.test(token)) digits += token
        else if (Number.isInteger(digit) && digit >= 0 && digit <= 9)
          digits += digit
        else break
        end++
      }
      qty =
        digits && Number.isInteger(qty)
          ? Number(
              `${
                qty < 0 || signed || /^minus\b/.test(expression) ? '-' : ''
              }${Math.abs(qty)}.${digits}`
            )
          : undefined
    }
    amounts.push({ start, end, qty, decimalNotation })
    start = end
  }
  return amounts
}

// Längere belegte Produktnamen haben Vorrang vor ihren Teilnamen.
// Unabhängige Treffer im selben Zitat bleiben mehrdeutig.
function modelNameMatches(tokens, rows, maxWords) {
  const keys = new Set()
  let coveredUntil = 0
  for (let start = 0; start < tokens.length; start++) {
    for (
      let end = Math.min(tokens.length, start + maxWords);
      end > Math.max(start, coveredUntil);
      end--
    ) {
      const words = tokens.slice(start, end)
      if (
        words.every(
          (word) => numberWord(word) !== undefined || units.has(normalize(word))
        )
      )
        continue
      const matches = findRows(words.join(' '), rows)
      if (!matches.length) continue
      for (const row of matches) keys.add(row.key)
      coveredUntil = end
      break
    }
  }
  return keys
}

function modelEvidence(
  heard,
  { surface, fragments, rows, maxNameWords },
  row,
  model
) {
  const excerpt = speechText(heard)
  const tokens = excerpt.match(TOKENS) ?? []
  const matches = []
  if (!tokens.length || !surface.includes(excerpt))
    return { reason: 'Der gehörte Ausschnitt kommt im Transkript nicht vor.' }

  const excerptWithoutSeparators = excerpt
    .replace(/^[,.;!?]+|[,.;!?]+$/g, '')
    .trim()
  for (const fragment of fragments) {
    if (!fragment.text.includes(excerptWithoutSeparators)) continue
    for (
      let start = 0;
      start + tokens.length <= fragment.tokens.length;
      start++
    ) {
      if (tokens.every((token, i) => token === fragment.tokens[start + i]))
        matches.push({ fragment, start, end: start + tokens.length })
    }
  }
  if (!matches.length)
    return { reason: 'Der gehörte Ausschnitt kommt im Transkript nicht vor.' }

  const reasons = []
  const names = modelNameMatches(tokens, rows, maxNameWords)
  const nameVerified = names.size === 1 && names.has(row?.key)
  if (!names.size) reasons.push('Von der KI zugeordnet – bitte prüfen')
  else if (!nameVerified) reasons.push(`Zuordnung prüfen: gehört „${heard}“`)
  if (matches.some(({ fragment }) => fragment.relative)) reasons.push('dazu?')

  const heardUnits = new Set()
  let ambiguous = false
  let partial = false
  let differs = false
  let decimalNotation = false
  for (const { fragment, start, end } of matches) {
    const amounts = fragment.amounts.filter(
      (amount) => amount.start < end && amount.end > start
    )
    if (amounts.length !== 1 || amounts[0].qty === undefined) ambiguous = true
    for (const amount of amounts) {
      const before = fragment.tokens[amount.start - 1]
      const after = fragment.tokens[amount.end]
      if (amount.start < start || amount.end > end) partial = true
      if (amount.qty !== undefined && amount.qty !== model.menge) differs = true
      if (amount.decimalNotation) decimalNotation = true
      if (['oder', 'bis'].includes(before) || ['oder', 'bis'].includes(after))
        ambiguous = true
      for (const adjacent of [before, after]) {
        const unit = units.get(normalize(adjacent ?? ''))
        if (unit) heardUnits.add(unit)
      }
    }
  }
  if (partial)
    reasons.push('Das Zitat enthält nur einen Teil der gesprochenen Menge.')
  if (ambiguous)
    reasons.push('Die gesprochene Menge ist nicht eindeutig erkennbar.')
  else if (differs)
    reasons.push(
      'Die vorgeschlagene Menge weicht von der gesprochenen Menge ab.'
    )

  if (!heardUnits.size) {
    for (const { fragment } of matches) {
      for (const token of fragment.tokens) {
        const unit = units.get(normalize(token))
        if (unit) heardUnits.add(unit)
      }
    }
  }
  const claimed = spokenUnit(model.einheit)
  const [unit] = heardUnits
  if (
    heardUnits.size > 1 ||
    (claimed && claimed !== unit) ||
    (row && unit && unit !== row.unit)
  ) {
    reasons.push('Die gesprochene Einheit passt nicht eindeutig zur Zählzeile.')
  }

  return {
    unit,
    decimalNotation,
    reason: reasons.join(' · ') || undefined,
    nameVerified,
  }
}

function mergeModelProposal(parsed, result, transcript, validation) {
  const known = new Map(validation.rows.map((row) => [row.key, row]))
  const fragments = transcript.split(FRAGMENT_SEPARATOR).map(speechText)
  const context = {
    surface: speechText(transcript),
    rows: validation.rows,
    maxNameWords: validation.rows.reduce(
      (max, row) =>
        Math.max(
          max,
          ...[row.label, row.itemName, ...row.aliases].map(
            (name) =>
              normalize(`${name} ${row.variant ?? ''}`).split(' ').length + 1
          )
        ),
      1
    ),
    fragments: fragments.map((text, index) => {
      const tokens = text.match(TOKENS) ?? []
      return {
        text,
        tokens,
        amounts: quantityExpressions(tokens),
        relative:
          isRelative(text) ||
          /^(dazu|plus|mehr)$/.test(fragments[index + 1] ?? ''),
      }
    }),
  }
  const modelRows = result.zeilen
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const heard = typeof row.gehoert === 'string' ? row.gehoert.trim() : ''
      const key = typeof row.key === 'string' ? row.key : ''
      const candidate = known.get(key)
      const evidence = modelEvidence(heard, context, candidate, row)
      return {
        key,
        menge: row.menge,
        heard: heard || 'Gehörter Ausschnitt fehlt.',
        unsicher: row.unsicher !== false,
        ...evidence,
        // Bei einem fremden Schlüssel benennt validateProposal die Ursache.
        reason: candidate ? evidence.reason : undefined,
      }
    })
    .filter(
      (row) =>
        !parsed.proposal.some(
          (entry) =>
            entry.key === row.key &&
            speechText(entry.heard) === speechText(row.heard)
        )
    )
  const proposal = validateProposal(
    [...parsed.proposal, ...modelRows],
    validation
  )
  const resolved = new Set(
    modelRows
      .filter(({ nameVerified }) => nameVerified)
      .map(({ heard }) =>
        speechText(heard)
          .replace(/^[,.;!?]+|[,.;!?]+$/g, '')
          .trim()
      )
  )
  const unmatched = new Map(
    parsed.unmatched
      .filter(({ heard }) => !resolved.has(speechText(heard)))
      .map((entry) => [speechText(entry.heard), entry])
  )
  for (const heard of result.nicht_zugeordnet) {
    if (typeof heard !== 'string' || !heard.trim()) continue
    const key = speechText(heard)
    if (!unmatched.has(key)) unmatched.set(key, { heard })
  }
  return { proposal, unmatched: [...unmatched.values()] }
}

function reserveSttCost({
  clipSeconds,
  sttRate,
  promptBytes,
  maxOutputTokens,
  tokenRate,
}) {
  const seconds = Math.max(3, Math.ceil(clipSeconds * 1.5))
  const durationCost = estimatedCostMicroEur({ seconds, sttRate })
  if (!tokenRate) return durationCost

  // Ein Audiotoken je 20 ms, ein Token je UTF-8-Byte und Platz für
  // die Einbettung des Prompts. Für die Ausgabe das Modellmaximum ansetzen.
  const input = seconds * 50 + promptBytes + 64
  const tokenCost = estimatedCostMicroEur({
    input,
    output: maxOutputTokens,
    tokenRate,
  })
  return Math.max(durationCost, tokenCost)
}

function settledSttCost(
  clipSeconds,
  reportedSeconds,
  sttRate,
  tokens,
  tokenRate
) {
  const seconds =
    typeof reportedSeconds === 'number' && Number.isFinite(reportedSeconds)
      ? Math.max(clipSeconds, reportedSeconds)
      : clipSeconds
  return Math.max(
    estimatedCostMicroEur({ seconds, sttRate }),
    estimatedCostMicroEur({ ...tokens, tokenRate })
  )
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
  tokenRate,
}) {
  // Konservative Näherung: USD-Tarife werden 1:1 in EUR angesetzt.
  return Math.ceil(
    ((seconds * sttRate) / 60) * 1_000_000 +
      (tokenRate
        ? input * tokenRate.input +
          output * tokenRate.output +
          read * tokenRate.input * 0.1 +
          write * tokenRate.input * 1.25
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
  reserveSttCost,
  settledSttCost,
  estimatedCostMicroEur,
}
