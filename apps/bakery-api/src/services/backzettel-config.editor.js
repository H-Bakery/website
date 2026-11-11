// Grundmengen in `hq/config/backzettel.yaml` ändern, ohne den Rest der Datei
// anzufassen (Z4).
//
// Die Datei ist von Hand geschrieben und voller Kommentare („# OFFEN Q-B…"),
// in Prettier-Schreibweise (`{ 2: 6 }`, `[202]`). Ein Neu-Serialisieren des
// ganzen Dokuments - auch mit dem Document-API des `yaml`-Pakets - würde jede
// Flow-Sammlung umformatieren und eine Grundmenge zu einem Diff über die
// halbe Datei machen. Deshalb: `yaml` (`parseDocument`) liefert nur die
// Positionen der Knoten (`range`), geändert wird genau der Text des einen
// Werts bzw. ein eingefügtes Paar. Alles andere bleibt Byte für Byte.
//
// Zur Sicherheit wird das Ergebnis mit demselben Parser wie der Loader
// (js-yaml, CORE_SCHEMA) zurückgelesen und mit dem erwarteten Objekt
// verglichen; stimmt es nicht, wird nichts geschrieben.

'use strict'

const YAML = require('yaml')

const loader = require('./backzettel-config.loader')
const baseCore = require('./backzettel-base.core')

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(error, message) {
  return { ok: false, error, message }
}

/** Schlüssel als YAML-Text: Wochentag als Zahl, Sorten-Slug ohne Quotes. */
function renderKey(key) {
  const text = String(key)
  if (/^\d+$/.test(text) || SLUG.test(text) || baseCore.isSpecialColumn(text))
    return text
  return JSON.stringify(text)
}

/** Ein Mengenwert als YAML-Text (Flow-Map für Sorten). */
function renderValue(value, padded) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number') return String(value)
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(
      ([k, v]) => `${renderKey(k)}: ${renderValue(v, padded)}`
    )
    if (entries.length === 0) return '{}'
    return padded ? `{ ${entries.join(', ')} }` : `{${entries.join(', ')}}`
  }
  return JSON.stringify(value)
}

function lineStart(text, pos) {
  return text.lastIndexOf('\n', pos - 1) + 1
}

function column(text, pos) {
  return pos - lineStart(text, pos)
}

/**
 * Ende des eigentlichen Inhalts vor `pos`: Block-Sammlungen schließen in
 * `range` den Zeilenumbruch (und Leerzeilen) mit ein.
 */
function contentEnd(text, pos) {
  let end = pos
  while (end > 0 && /\s/.test(text[end - 1])) end -= 1
  return end
}

/** Position direkt nach dem Zeilenende von `pos` (inkl. `\n`), oder Dateiende. */
function afterLine(text, pos) {
  const nl = text.indexOf('\n', pos)
  return nl === -1 ? text.length : nl + 1
}

function keyMatches(pair, key) {
  const k = pair && pair.key
  const value = k && typeof k === 'object' && 'value' in k ? k.value : k
  return String(value).trim() === String(key)
}

/** Sind die Flow-Sammlungen der Datei mit Innenabstand geschrieben (`{ a: 1 }`)? */
function detectPadding(text, node) {
  if (node && node.flow && Array.isArray(node.range)) {
    return text[node.range[0] + 1] === ' '
  }
  const m = /\{(\s?)[^\s}]/.exec(text)
  return m ? m[1] === ' ' : true
}

/**
 * Einfügestelle + Text für ein neues Paar in einer Map (Flow oder Block).
 * `index` = Position unter den vorhandenen Paaren.
 */
function insertPair(text, map, index, keyText, valueText) {
  const pairs = map.items
  if (map.flow) {
    const padded = text[map.range[0] + 1] === ' '
    if (pairs.length === 0) {
      return {
        start: map.range[0],
        end: map.range[1],
        text: padded
          ? `{ ${keyText}: ${valueText} }`
          : `{${keyText}: ${valueText}}`,
      }
    }
    if (index === 0) {
      const at = pairs[0].key.range[0]
      return { start: at, end: at, text: `${keyText}: ${valueText}, ` }
    }
    const prev = pairs[index - 1]
    const at =
      prev.value && prev.value.range ? prev.value.range[1] : prev.key.range[1]
    return { start: at, end: at, text: `, ${keyText}: ${valueText}` }
  }
  if (pairs.length === 0) return null
  const indent = ' '.repeat(column(text, pairs[0].key.range[0]))
  const line = `${indent}${keyText}: ${valueText}\n`
  if (index < pairs.length) {
    const at = lineStart(text, pairs[index].key.range[0])
    return { start: at, end: at, text: line }
  }
  const last = pairs[pairs.length - 1]
  const end = contentEnd(
    text,
    last.value && last.value.range ? last.value.range[1] : last.key.range[1]
  )
  let at = afterLine(text, end)
  // Kommentarzeilen direkt darunter, so weit eingerückt wie die Schlüssel,
  // gehören noch zu dieser Map - das neue Paar kommt dahinter.
  for (;;) {
    const next = afterLine(text, at)
    const line = text.slice(at, next)
    const m = /^( *)#/.exec(line)
    if (!m || m[1].length < indent.length || next === at) break
    at = next
  }
  const prefix = at === text.length && !text.endsWith('\n') ? '\n' : ''
  return { start: at, end: at, text: prefix + line }
}

/** Ersetzt einen Skalar (auch den leeren `6:`) durch `valueText`. */
function replaceScalar(text, node, valueText) {
  const [start, end] = node.range
  if (start !== end) return { start, end, text: valueText }
  // Ein leerer Skalar: `7:` → `7: 4`, `{ a: }` → `{ a: 4 }`.
  const before = text[start - 1] === ':' ? ' ' : ''
  const after = /[}\],]/.test(text[start] || '') && before === '' ? ' ' : ''
  return { start, end, text: before + valueText + after }
}

/**
 * Ersetzt den Wert eines Paars, der eine Block-Sammlung ist, durch einen
 * einzeiligen Wert hinter dem Doppelpunkt.
 */
function replaceBlockValue(text, pair, valueText) {
  const colon = text.indexOf(':', pair.key.range[1])
  return {
    start: colon + 1,
    end: contentEnd(text, pair.value.range[1]),
    text: ` ${valueText}`,
  }
}

function sortedIndex(pairs, weekday) {
  const i = pairs.findIndex((p) => {
    const n = Number(p.key && p.key.value)
    return Number.isFinite(n) && n > weekday
  })
  return i === -1 ? pairs.length : i
}

/**
 * Z14: ein Paar aus einer Map entfernen (Sonderspalte leeren). Eine
 * Block-Map, die dadurch leer würde, fasst das nicht an (`base:` hieße dann
 * `null`) - dafür in hq von Hand.
 */
function removePair(text, map, pair) {
  const pairs = map.items
  const i = pairs.indexOf(pair)
  const valueEnd = (p) =>
    p.value && p.value.range ? p.value.range[1] : p.key.range[1]
  if (map.flow) {
    if (pairs.length === 1) {
      return { start: map.range[0], end: map.range[1], text: '{}' }
    }
    if (i > 0) {
      return { start: valueEnd(pairs[i - 1]), end: valueEnd(pair), text: '' }
    }
    return { start: pair.key.range[0], end: pairs[1].key.range[0], text: '' }
  }
  if (pairs.length === 1) return null
  return {
    start: lineStart(text, pair.key.range[0]),
    end: afterLine(text, contentEnd(text, valueEnd(pair))),
    text: '',
  }
}

/** Splices, absteigend angewendet (Offsets bleiben gültig). */
function applySplices(text, splices) {
  let out = text
  for (const s of [...splices].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, s.start) + s.text + out.slice(s.end)
  }
  return out
}

/**
 * Plant die Textänderungen für `base[weekday] = next` eines Postens.
 * @returns {{ok: true, splices: Array} | {ok: false, error, message}}
 */
function planBaseSplices(text, itemNode, weekday, next, current, variantOrder) {
  const padded = detectPadding(text, itemNode.get('base', true))
  const basePair = itemNode.items.find((p) => keyMatches(p, 'base'))

  // 0. Z14: Sonderspalte leeren = Schlüssel entfernen.
  if (next === undefined) {
    const baseMap = basePair && basePair.value
    const pair =
      baseMap && YAML.isMap(baseMap)
        ? baseMap.items.find((p) => keyMatches(p, weekday))
        : null
    const s = pair ? removePair(text, baseMap, pair) : null
    return s
      ? { ok: true, splices: [s] }
      : fail(
          'config_layout_unsupported',
          'Die Spalte lässt sich in dieser Datei nicht automatisch leeren. Bitte in hq von Hand entfernen.'
        )
  }

  // 1. Kein `base:` am Posten → Paar anhängen.
  if (!basePair) {
    if (itemNode.flow) {
      return fail(
        'config_layout_unsupported',
        'Der Posten ist in einer Zeile geschrieben ({ … }); die Grundmenge lässt sich so nicht automatisch ergänzen. Bitte in hq von Hand eintragen.'
      )
    }
    const s = insertPair(
      text,
      itemNode,
      itemNode.items.length,
      'base',
      renderValue({ [weekday]: next }, padded)
    )
    return s ? { ok: true, splices: [s] } : fail('config_edit_failed', '')
  }

  const baseNode = basePair.value
  // 2. `base:` leer oder null → ganze Map setzen.
  if (!baseNode || YAML.isScalar(baseNode)) {
    if (!baseNode) {
      return fail('config_edit_failed', '')
    }
    return {
      ok: true,
      splices: [
        replaceScalar(text, baseNode, renderValue({ [weekday]: next }, padded)),
      ],
    }
  }
  if (!YAML.isMap(baseNode)) {
    return fail(
      'config_layout_unsupported',
      'base ist in hq keine Zuordnung Wochentag → Menge.'
    )
  }

  const dayPair = baseNode.items.find((p) => keyMatches(p, weekday))
  // 3. Wochentag fehlt → Paar an der sortierten Stelle einfügen.
  if (!dayPair) {
    const s = insertPair(
      text,
      baseNode,
      sortedIndex(baseNode.items, weekday),
      String(weekday),
      renderValue(next, padded)
    )
    return s ? { ok: true, splices: [s] } : fail('config_edit_failed', '')
  }

  const dayNode = dayPair.value
  // 4. Ganzer Tag (Zahl/null).
  if (!isPlainObject(next)) {
    if (!dayNode || YAML.isScalar(dayNode)) {
      return dayNode
        ? {
            ok: true,
            splices: [replaceScalar(text, dayNode, renderValue(next))],
          }
        : fail('config_edit_failed', '')
    }
    if (dayNode.flow) {
      return {
        ok: true,
        splices: [
          {
            start: dayNode.range[0],
            end: dayNode.range[1],
            text: renderValue(next),
          },
        ],
      }
    }
    return {
      ok: true,
      splices: [replaceBlockValue(text, dayPair, renderValue(next))],
    }
  }

  // 5. Je Sorte: vorhandene Sorten-Map → nur geänderte Werte anfassen.
  if (dayNode && YAML.isMap(dayNode)) {
    const splices = []
    const cur = isPlainObject(current) ? current : {}
    const pairs = dayNode.items
    const toInsert = []
    for (const [variant, value] of Object.entries(next)) {
      const pair = pairs.find((p) => keyMatches(p, variant))
      if (!pair) {
        toInsert.push([variant, value])
        continue
      }
      if (baseCore.sameValue(cur[variant], value)) continue
      if (!pair.value || !YAML.isScalar(pair.value)) {
        return fail(
          'config_layout_unsupported',
          `Die Menge für „${variant}“ ist in hq keine einfache Zahl.`
        )
      }
      splices.push(replaceScalar(text, pair.value, renderValue(value)))
    }
    if (toInsert.length > 0) {
      // Neue Sorten in einem Rutsch hinten anfügen (Reihenfolge wie `variants`).
      const order = Array.isArray(variantOrder) ? variantOrder : []
      toInsert.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      if (dayNode.flow) {
        if (pairs.length === 0) {
          splices.push({
            start: dayNode.range[0],
            end: dayNode.range[1],
            text: renderValue(Object.fromEntries(toInsert), padded),
          })
        } else {
          const last = pairs[pairs.length - 1]
          const at =
            last.value && last.value.range
              ? last.value.range[1]
              : last.key.range[1]
          splices.push({
            start: at,
            end: at,
            text: toInsert
              .map(([k, v]) => `, ${renderKey(k)}: ${renderValue(v)}`)
              .join(''),
          })
        }
      } else {
        for (const [k, v] of toInsert) {
          const s = insertPair(
            text,
            dayNode,
            dayNode.items.length,
            renderKey(k),
            renderValue(v)
          )
          if (!s) return fail('config_edit_failed', '')
          splices.push(s)
        }
        // Mehrere Einfügungen an derselben Stelle: in Reihenfolge zusammenfassen.
        return { ok: true, splices: mergeSameStart(splices) }
      }
    }
    return { ok: true, splices }
  }

  // 6. Bisher Zahl/null/leer → Sorten-Map an die Stelle des Werts.
  if (!dayNode) return fail('config_edit_failed', '')
  if (YAML.isScalar(dayNode)) {
    return {
      ok: true,
      splices: [replaceScalar(text, dayNode, renderValue(next, padded))],
    }
  }
  return fail(
    'config_layout_unsupported',
    'Die Grundmenge dieses Tages ist in hq keine einfache Zahl.'
  )
}

/** Einfügungen an derselben Position in der geplanten Reihenfolge verbinden. */
function mergeSameStart(splices) {
  const out = []
  for (const s of splices) {
    const same = out.find(
      (o) => o.start === s.start && o.end === s.end && o.start === o.end
    )
    if (same && s.start === s.end) same.text += s.text
    else out.push({ ...s })
  }
  return out
}

function findItemNode(doc, itemId) {
  const items = doc.get('items', true)
  if (!items || !YAML.isSeq(items)) return null
  for (const node of items.items) {
    if (!YAML.isMap(node)) continue
    const idPair = node.items.find((p) => keyMatches(p, 'id'))
    const id = idPair && idPair.value && idPair.value.value
    if (String(id) === itemId) return node
  }
  return null
}

function findRawItem(raw, itemId) {
  const items = isPlainObject(raw) && Array.isArray(raw.items) ? raw.items : []
  return items.find((i) => isPlainObject(i) && String(i.id) === itemId) || null
}

/** Deep-Equal für geparste YAML-Werte. */
function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    return (
      ka.length === kb.length &&
      ka.every(
        (k) =>
          Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k])
      )
    )
  }
  return false
}

/**
 * Wendet eine geprüfte Grundmengen-Änderung (`parseBaseEdit`) auf den Text
 * der YAML an.
 *
 * @param {string} text Inhalt von `backzettel.yaml`
 * @param {{itemId:string, weekday:number, item:object, value?, variants?}} edit
 * @returns {{ok: true, changed: boolean, text: string, before: object, after: object}
 *          | {ok: false, error: string, message: string}}
 *   `before`/`after`: das ganze geparste YAML-Objekt vor/nach der Änderung
 *   (für die Schema-Prüfung).
 */
function applyBaseEdit(text, edit) {
  const parsed = loader.parseBackzettelYaml(text)
  if (!parsed.ok) {
    return fail(
      'config_unreadable',
      `Die Backzettel-Stammdaten lassen sich nicht lesen: ${parsed.errors[0].message}`
    )
  }
  const before = parsed.data
  const rawItem = findRawItem(before, edit.itemId)
  if (!rawItem) {
    return fail(
      'unknown_item',
      `Den Posten „${edit.itemId}“ gibt es in den Backzettel-Stammdaten nicht.`
    )
  }
  const current = baseCore.currentDayValue(rawItem, edit.weekday)
  const next = baseCore.nextDayValue(current, edit)
  // Sonderspalten (Z14): fehlt + leer = keine Änderung.
  if (
    current === undefined
      ? next === undefined
      : baseCore.sameValue(current, next)
  ) {
    return { ok: true, changed: false, text, before, after: before }
  }

  const doc = YAML.parseDocument(text)
  if (doc.errors && doc.errors.length > 0) {
    return fail(
      'config_unreadable',
      `Die Backzettel-Stammdaten lassen sich nicht lesen: ${doc.errors[0].message}`
    )
  }
  const itemNode = findItemNode(doc, edit.itemId)
  if (!itemNode) {
    return fail(
      'unknown_item',
      `Den Posten „${edit.itemId}“ gibt es in den Backzettel-Stammdaten nicht.`
    )
  }
  const plan = planBaseSplices(
    text,
    itemNode,
    edit.weekday,
    next,
    current,
    edit.item && edit.item.variants
  )
  if (!plan.ok) {
    return fail(
      plan.error,
      plan.message ||
        'Die Grundmenge lässt sich in dieser Datei nicht automatisch ändern. Bitte in hq von Hand eintragen.'
    )
  }
  const out = applySplices(text, plan.splices)

  // Gegenlesen: genau diese eine Änderung, sonst nichts.
  const expected = JSON.parse(JSON.stringify(before))
  const target = findRawItem(expected, edit.itemId)
  if (!isPlainObject(target.base)) target.base = {}
  const existingKey = Object.keys(target.base).find(
    (k) => String(k).trim() === String(edit.weekday)
  )
  if (next === undefined) delete target.base[existingKey]
  else
    target.base[
      existingKey === undefined ? String(edit.weekday) : existingKey
    ] = next
  const reread = loader.parseBackzettelYaml(out)
  if (!reread.ok || !deepEqual(reread.data, expected)) {
    return fail(
      'config_edit_failed',
      'Die Grundmenge ließ sich nicht sicher in die Datei schreiben; es wurde nichts geändert. Bitte in hq von Hand eintragen.'
    )
  }
  return {
    ok: true,
    changed: out !== text,
    text: out,
    before,
    after: reread.data,
  }
}

module.exports = {
  applyBaseEdit,
  renderValue,
}
