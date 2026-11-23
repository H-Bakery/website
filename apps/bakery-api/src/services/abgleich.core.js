// „Abgleich Produktion ↔ Kasse“: ein Kontrollwerkzeug für den Inhaber.
//
// Je Backtag und Backzettel-Posten (bei Brot je Laibgröße, wenn jede Größe
// eigene Kassennummern hat):
//
//   Ungeklärt = gebacken − CAP − verkauft (Kasse, über `plu`) − Rest (gezählt)
//
//   > 0 deutlich: Ware ist weg, ohne an der Kasse oder im Rest zu stehen
//       (ohne Bon verkauft, Bruch, Personalverzehr, verzählt).
//   < 0 deutlich: mehr verkauft als gebacken (Kassennummer falsch
//       zugeordnet, nachgebacken ohne Nachtrag, Ware vom Vortag).
//
// Ein Unterschied ist ein **Hinweis, kein Beweis** - und nie einer Person
// zugeordnet: hier steht nirgends, wer gezählt oder kassiert hat.
//
// Dependency-freies CommonJS wie `rest-am-abend.core.js`. Die Rechnung steht
// genau einmal hier; gebacken, CAP und Rest kommen aus den Bausteinen von
// „Rest am Abend“ (`backzettelLines`, `lineComplete`, `lineRest`,
// `countDayStatus`), verkauft aus der Z4-Referenz (`itemSoldInfo`,
// `sizeSoldInfo`, `soldOnDay`). Keine zweite Implementierung anlegen.
//
// Regeln (Stand: vorläufig, bis der Inhaber es anders will):
//
//   - **Gebacken** = freigegebener Backzettel des Backtags plus quittierte
//     Nachträge. Ist der Tag nicht freigegeben, gilt der geplante Wert, und
//     der Tag trägt die Grundlage „geplant“ - deutlich angezeigt.
//   - **CAP** (Verkaufspartner) verlässt den Laden und wird abgezogen.
//     **Vorbestellungen** werden im Laden an der Kasse bezahlt und deshalb
//     **nicht** abgezogen (vorläufig).
//   - **Grundmenge offen** (Entwurfszeile mit `totalIsMinimum`: Grundmenge
//     nicht festgelegt, am Tag nichts entschieden): „gebacken“ ist nur ein
//     Mindestwert, kein Plan. Die Zeile heißt „Grundmenge offen“, zeigt
//     gebacken als „≥ n“ und rechnet kein Ungeklärt und keine Ampel - eine
//     Lücke wie „kein Kassenbericht“, nie 0.
//   - **Rest fehlt** (Tag nicht oder nur teilweise gezählt): nie 0. Dann
//     steht nur „nicht verkauft oder nicht kassiert“ = gebacken − CAP −
//     verkauft; „Ungeklärt“ gibt es erst mit gezähltem Rest. Ist schon
//     dieser Wert negativ, kann kein Rest ihn retten - die Ampel zeigt das
//     auch ohne Zählung (`ampelBasis: 'ohne_rest'`).
//   - **Einheiten:** verglichen wird, wenn die Kasse in die Einheit des
//     Postens umgerechnet werden kann (`itemSoldInfo(...).converted`) oder
//     Posten und Kasse beide Stück zählen (Stück-Posten, jedes Produkt ein
//     Stück - `countsPieces`, vorläufig), sonst „nicht vergleichbar
//     (Einheit)“. Ohne Kassennummer: „keine
//     Kassennummer“, getrennt aufgeführt.
//   - **Sorten** (Nuss, Mohn …) haben an der Kasse keine eigene Nummer:
//     verglichen wird der Posten über alle Sorten, die Sorten stehen nur zur
//     Information daneben.
//   - **Lücken:** ein Tag ohne Kassenbericht ist eine Lücke („kein
//     Kassenbericht“), nie 0. Schließtage des Kalenders stehen als
//     „geschlossen“, Ruhetage werden übersprungen - wie bei Rest am Abend.
//   - **Ampel** je Zeile und je Posten über den Zeitraum:
//     |Ungeklärt| ≤ max(1 Stück, 5 % von gebacken − CAP) → ok,
//     ≤ 15 % → auffällig, sonst → prüfen. „1 Stück“ ist das kleinste Produkt
//     des Postens in seiner Einheit (ein 500-g-Laib = 0,5 L). Über den
//     Zeitraum gilt die schlechtere von zwei Ampeln: Ungeklärt über die Tage
//     mit Rest, und „mehr verkauft“ über die Tage ohne Rest (nur deren
//     negative Werte - ein Tag mit übriger Ware gleicht keinen Tag mit zu
//     viel Verkauf aus).
//   - **Zu viel produziert:** Restquote (Rest ÷ (gebacken − CAP), wie bei
//     Rest am Abend) über 10 %.

'use strict'

const rest = require('./rest-am-abend.core')
const refCore = require('./backzettel-reference.core')
const { computePreorderDeltas } = require('./backzettel.core')
const { toCorePreorderItems } = require('./backzettel-day.core')
const { csvCell } = require('./partner-stats.core')
const { SECTION_LABELS, WEEKDAY_NAMES } = require('./backzettel-config.core')

/** Längster Zeitraum (Tage). */
const MAX_RANGE_DAYS = 62
/** Standard: die letzten 7 Backtage vor heute. */
const DEFAULT_BAKE_DAYS = 7
/** So weit wird für die 7 Backtage höchstens zurückgeschaut. */
const DEFAULT_LOOKBACK_DAYS = 31

/** Ampel „ok“ bis zu diesem Anteil von gebacken − CAP (vorläufig). */
const OK_SHARE = 0.05
/** Ampel „auffällig“ bis zu diesem Anteil, darüber „prüfen“ (vorläufig). */
const NOTICE_SHARE = 0.15
/** Mindest-Spielraum in Stück (kleinstes Produkt des Postens, vorläufig). */
const MIN_TOLERANCE_PIECES = 1
/** Restquote darüber → Hinweis „zu viel produziert“ (vorläufig). */
const OVERPRODUCTION_RATE = 0.1

const AMPEL_RANK = { pruefen: 3, auffaellig: 2, ok: 1 }

const AMPEL_LABELS = {
  ok: 'ok',
  auffaellig: 'auffällig',
  pruefen: 'prüfen',
}

const STATUS_LABELS = {
  ok: 'vollständig',
  ohne_rest: 'Rest nicht gezählt',
  grundmenge_offen: 'Grundmenge offen – kein Plan',
  kein_bericht: 'kein Kassenbericht',
  einheit: 'nicht vergleichbar (Einheit)',
  keine_plu: 'keine Kassennummer',
}

const REST_STATUS_LABELS = {
  counted: 'gezählt',
  partial: 'teilweise gezählt',
  not_counted: 'nicht gezählt',
  not_on_backzettel: 'nicht auf dem Backzettel',
}

const BASIS_LABELS = {
  freigegeben: 'freigegeben',
  geplant: 'geplant – nicht freigegeben',
  gemischt: 'teils geplant',
}

const DAY_STATUS_LABELS = {
  ok: 'Backtag',
  no_backzettel: 'kein Backzettel',
  ruhetag: 'Ruhetag',
  geschlossen: 'geschlossen',
  future: 'noch nicht',
}

const EXPLANATION =
  'Ungeklärt = gebacken − CAP − verkauft (Kasse) − Rest (gezählt). Gebacken = freigegebener Backzettel plus quittierte Nachträge, sonst der geplante Wert („geplant“); ist die Grundmenge offen, gibt es keinen Plan und keinen Vergleich („Grundmenge offen“). CAP-Ware verlässt den Laden und wird abgezogen; Vorbestellungen zählen in der Stückansicht mit. Ohne gezählten Rest steht nur „nicht verkauft oder nicht kassiert“ = gebacken − CAP − verkauft. In der Summe je Posten zählen gebacken und CAP nur die vergleichbaren Tage (mit Kassenbericht und festgelegter Grundmenge), damit die Rechnung aufgeht. Unterschiede sind Hinweise, keine Beweise.'

const round2 = rest.round2

function fail(status, error, message) {
  return { ok: false, status, error, message }
}

function isBakeDay(config, date) {
  return !config || rest.countDayStatus(config, date).status === 'ok'
}

/**
 * `?from=&to=` lesen. Standard: die letzten 7 Backtage vor heute (heute ist
 * noch nicht abgeschlossen). Nur `to`: die 7 Backtage bis `to`.
 * @returns {{ok: true, from: string, to: string} | {ok: false, status, error, message}}
 */
function parseRange(query, today, config) {
  const q = query || {}
  if (Array.isArray(q.from) || Array.isArray(q.to)) {
    return fail(400, 'invalid_range', 'from und to bitte nur einmal angeben.')
  }
  const rawTo = q.to === undefined || q.to === '' ? null : String(q.to).trim()
  const rawFrom =
    q.from === undefined || q.from === '' ? null : String(q.from).trim()
  const to = rawTo === null ? rest.addDays(today, -1) : rawTo
  if (!rest.isCalendarDate(to) || (rawFrom && !rest.isCalendarDate(rawFrom))) {
    return fail(
      400,
      'invalid_date',
      'Ungültiges Datum; erwartet wird JJJJ-MM-TT.'
    )
  }
  let from = rawFrom
  if (from === null) {
    let found = 0
    from = to
    for (let i = 0; i < DEFAULT_LOOKBACK_DAYS; i += 1) {
      const d = rest.addDays(to, -i)
      from = d
      if (isBakeDay(config, d)) found += 1
      if (found >= DEFAULT_BAKE_DAYS) break
    }
  }
  if (from > to) {
    return fail(
      400,
      'invalid_range',
      'Der Anfang des Zeitraums liegt nach dem Ende.'
    )
  }
  if (rest.listDates(from, to).length > MAX_RANGE_DAYS) {
    return fail(
      400,
      'range_too_large',
      `Ein Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage lang sein.`
    )
  }
  return { ok: true, from, to }
}

/**
 * Ampel für einen Unterschied in der Einheit des Postens.
 * `tolerance` = 1 Stück in dieser Einheit.
 * @returns {'ok'|'auffaellig'|'pruefen'}
 */
function classify(diff, shopBaked, tolerance) {
  const base = Math.max(0, Number(shopBaked) || 0)
  const okLimit = Math.max(tolerance * MIN_TOLERANCE_PIECES, OK_SHARE * base)
  const noticeLimit = Math.max(okLimit, NOTICE_SHARE * base)
  const abs = Math.abs(diff)
  if (abs <= okLimit + 1e-9) return 'ok'
  if (abs <= noticeLimit + 1e-9) return 'auffaellig'
  return 'pruefen'
}

/** 1 Stück in der Einheit des Postens: das kleinste Produkt (Faktor). */
function pieceTolerance(info) {
  const factors = info
    ? [...info.factors.values()].filter((f) => typeof f === 'number' && f > 0)
    : []
  return factors.length > 0 ? Math.min(...factors) : 1
}

/**
 * Posten und Kasse zählen beide Stück: der Posten rechnet in Stück, und
 * jedes seiner Produkte ist ein Stück (Faktor 1). Dann braucht es keine
 * Umrechnung, auch wenn die Kassennummer keinem hq-Produkt zugeordnet ist
 * (vorläufig).
 */
function countsPieces(item) {
  if ((item.unit || 'Stück') !== 'Stück') return false
  const products = Array.isArray(item.products) ? item.products : []
  return products.every(
    (p) =>
      !p ||
      p.factor === undefined ||
      p.factor === null ||
      Number(p.factor) === 1
  )
}

/**
 * Wie ein Posten mit der Kasse verglichen wird: je Laibgröße, wenn jede
 * Größe eigene Kassennummern hat und sie zusammen alle Kassennummern des
 * Postens abdecken; sonst der ganze Posten.
 *
 * `soldBasis`: `umgerechnet` (jede Kassennummer ist ein Produkt des Postens
 * mit Faktor, `itemSoldInfo(...).converted`), `stueck` (Stück-Posten mit
 * Produkten zu je einem Stück - Kasse und Posten zählen dasselbe) oder
 * `null` (nicht vergleichbar).
 *
 * `ctx.directResolve`: Produkt-Auflöser nur über die Produkt-IDs der
 * Stammdaten (ohne `numeric_id` des Katalogs); `ctx.pluOwners`: Kassennummer
 * → IDs der Posten, die sie in `plu` führen.
 */
function comparison(item, resolve, ctx = {}) {
  let info = refCore.itemSoldInfo(item, resolve)
  let soldBasis = info.converted ? 'umgerechnet' : null
  // Kassennummern eines anderen Postens: ein Fehler in den Stammdaten - nie
  // still als Stück dieses Postens mitzählen. Fremd ist eine Kassennummer
  // nur, wenn ein anderer Posten sie selbst in `plu` führt oder sie die
  // Produkt-ID eines Produkts eines anderen Postens ist. Ein Treffer nur
  // über die `numeric_id` des Katalogs zählt nicht: Kassennummern und
  // `numeric_id` sind nicht derselbe Nummernkreis, sie treffen sich zufällig.
  const owners = ctx.pluOwners || new Map()
  const direct = ctx.directResolve || null
  const foreignPlu = info.plu.filter((key) => {
    const listed = owners.get(key) || []
    if (listed.some((id) => id !== item.id)) return true
    const hit = direct ? direct(key) : null
    return Boolean(hit && hit.item && hit.item.id !== item.id)
  })
  if (
    !info.converted &&
    info.plu.length > 0 &&
    foreignPlu.length === 0 &&
    countsPieces(item)
  ) {
    info = {
      ...info,
      factors: new Map(
        info.plu.map((key) => [key, info.factors.get(key) ?? 1])
      ),
      converted: true,
    }
    soldBasis = 'stueck'
  }
  if (rest.isSizeItem(item) && info.plu.length > 0) {
    const sizes = new Map(
      item.sizes.map((s) => [s.id, refCore.sizeSoldInfo(info, s)])
    )
    const covered = new Set(
      [...sizes.values()].flatMap((si) => (si ? si.plu : []))
    )
    if (
      [...sizes.values()].every(Boolean) &&
      info.plu.every((p) => covered.has(p))
    ) {
      return { info, soldBasis, foreignPlu, bySize: true, sizes }
    }
  }
  return { info, soldBasis, foreignPlu, bySize: false, sizes: null }
}

function sumBy(list, pick) {
  return round2(list.reduce((s, x) => s + (pick(x) || 0), 0))
}

/**
 * Eine Tageszeile (Posten oder Laibgröße an einem Backtag).
 * `lines`: die Backzettel-Zeilen (Sorten) mit gebacken, CAP und Zählung.
 */
function dayRow(date, confirmed, lines, info, soldMap) {
  const baked = sumBy(lines, (l) => l.baked)
  const cap = sumBy(lines, (l) => l.cap)
  const shopBaked = round2(baked - cap)
  const restStatus =
    lines.length === 0
      ? 'not_on_backzettel'
      : lines.every((l) => l.complete)
      ? 'counted'
      : lines.some((l) => l.anyCount)
      ? 'partial'
      : 'not_counted'
  const restValue =
    restStatus === 'counted' ? sumBy(lines, (l) => l.rest) : null
  // Grundmenge offen: gebacken ist nur ein Mindestwert - keine Rechnung.
  const qtyOpen = lines.some((l) => l.qtyOpen)
  const tolerance = pieceTolerance(info)
  const row = {
    date,
    weekdayName: WEEKDAY_NAMES[rest.isoWeekday(date)] || null,
    basis: confirmed ? 'freigegeben' : 'geplant',
    baked,
    bakedIsMinimum: qtyOpen,
    cap,
    shopBaked,
    report: !!soldMap,
    sold: null,
    soldPieces: null,
    open: null,
    rest: restValue,
    restStatus,
    unexplained: null,
    ampel: null,
    ampelBasis: null,
    status: 'ok',
    rate:
      restValue !== null && !qtyOpen ? rest.rate(restValue, shopBaked) : null,
    overproduction: false,
    restExceedsShop: qtyOpen
      ? false
      : rest.restExceedsShop(restValue, baked, cap),
    lines: lines.map((l) => ({
      variant: l.variant || null,
      label: l.label,
      baked: l.baked,
      cap: l.cap,
      rest: l.complete ? l.rest : null,
    })),
  }
  row.overproduction = row.rate !== null && row.rate > OVERPRODUCTION_RATE
  if (!info || info.plu.length === 0) {
    row.status = 'keine_plu'
    return row
  }
  // Vergleichbar oder nicht hängt nur am Posten, nicht am Bericht.
  if (!info.converted) {
    row.status = 'einheit'
    row.soldPieces = soldMap ? refCore.soldOnDay(info, soldMap) : null
    return row
  }
  if (qtyOpen) {
    row.status = 'grundmenge_offen'
    row.sold = soldMap ? refCore.soldOnDay(info, soldMap) : null
    return row
  }
  if (!soldMap) {
    row.status = 'kein_bericht'
    return row
  }
  const sold = refCore.soldOnDay(info, soldMap)
  row.sold = sold
  row.open = round2(shopBaked - sold)
  if (restValue !== null) {
    row.status = 'ok'
    row.unexplained = round2(row.open - restValue)
    row.ampel = classify(row.unexplained, shopBaked, tolerance)
    row.ampelBasis = 'mit_rest'
  } else {
    row.status = 'ohne_rest'
    // Schon ohne Rest mehr verkauft als gebacken: ein Rest macht es nur
    // schlimmer - das ist auch ohne Zählung ein Signal.
    if (row.open < 0) {
      row.ampel = classify(row.open, shopBaked, tolerance)
      row.ampelBasis = 'ohne_rest'
    }
  }
  return row
}

/** Ein Posten über den Zeitraum aus seinen Tageszeilen. */
function periodRow(g, config) {
  const rows = g.dayRows
  const comparable = rows.filter(
    (r) => r.status === 'ok' || r.status === 'ohne_rest'
  )
  const withRest = rows.filter((r) => r.status === 'ok')
  const withoutRest = rows.filter((r) => r.status === 'ohne_rest')
  // Vergleichbar oder nicht entscheidet der Posten (Kassennummern,
  // Umrechnung), nicht ob es im Zeitraum einen Kassenbericht gab.
  const status =
    !g.info || g.info.plu.length === 0
      ? 'keine_plu'
      : !g.info.converted
      ? 'einheit'
      : 'vergleichbar'
  const basisOf = (list) => {
    if (list.length === 0) return null
    const planned = list.filter((r) => r.basis === 'geplant').length
    return planned === 0
      ? 'freigegeben'
      : planned === list.length
      ? 'geplant'
      : 'gemischt'
  }
  const tolerance = pieceTolerance(g.info)
  // Gebacken und CAP über die vergleichbaren Tage (damit gebacken − CAP −
  // verkauft aufgeht); ohne vergleichbaren Tag über alle Tage.
  const basisRows = comparable.length > 0 ? comparable : rows
  const baked = sumBy(basisRows, (r) => r.baked)
  const cap = sumBy(basisRows, (r) => r.cap)
  const shopBaked = round2(baked - cap)
  const sold = sumBy(comparable, (r) => r.sold)
  const open = round2(shopBaked - sold)
  const restShop = sumBy(withRest, (r) => r.shopBaked)
  const restSold = sumBy(withRest, (r) => r.sold)
  const restSum = sumBy(withRest, (r) => r.rest)
  const unexplained =
    withRest.length > 0 ? sumBy(withRest, (r) => r.unexplained) : null
  // Ampel über den Zeitraum: die schlechtere aus Ungeklärt (Tage mit Rest)
  // und „mehr verkauft“ (Tage ohne Rest, nur die negativen - übrige Ware
  // eines Tages verrechnet sich nicht mit zu viel Verkauf an einem anderen).
  const candidates = []
  if (withRest.length > 0) {
    candidates.push({
      ampel: classify(unexplained, restShop, tolerance),
      basis: 'mit_rest',
      diff: unexplained,
    })
  }
  const short = withoutRest.filter((r) => r.open < 0)
  const shortOpen = short.length > 0 ? sumBy(short, (r) => r.open) : null
  if (short.length > 0) {
    candidates.push({
      ampel: classify(
        shortOpen,
        sumBy(short, (r) => r.shopBaked),
        tolerance
      ),
      basis: 'ohne_rest',
      diff: shortOpen,
    })
  }
  const worst = candidates.reduce(
    (w, c) => (!w || AMPEL_RANK[c.ampel] > AMPEL_RANK[w.ampel] ? c : w),
    null
  )
  const ampel = worst ? worst.ampel : null
  const ampelBasis = worst ? worst.basis : null
  const signalDays = {
    pruefen: rows.filter((r) => r.ampel === 'pruefen').length,
    auffaellig: rows.filter((r) => r.ampel === 'auffaellig').length,
  }
  const rate = withRest.length > 0 ? rest.rate(restSum, restShop) : null
  const variants = new Map()
  for (const r of rows) {
    for (const l of r.lines) {
      if (!l.variant) continue
      const v = variants.get(l.variant) || {
        variant: l.variant,
        label: l.label,
        baked: 0,
        cap: 0,
      }
      v.baked = round2(v.baked + (l.baked || 0))
      v.cap = round2(v.cap + (l.cap || 0))
      variants.set(l.variant, v)
    }
  }
  const item = g.item
  const section = item ? item.section : g.meta.section
  return {
    key: g.key,
    itemId: g.itemId,
    sizeId: g.sizeId,
    name: g.meta.name,
    sizeLabel: g.sizeId ? rest.variantLabel(config, g.sizeId, item) : null,
    section,
    sectionLabel: (section && SECTION_LABELS[section]) || section || null,
    unit: g.meta.unit,
    plu: g.info ? g.info.plu.map(Number) : [],
    converted: g.info ? g.info.converted : false,
    soldBasis: g.info && g.info.converted ? g.soldBasis : null,
    tolerance,
    status,
    basis: basisOf(comparable) || basisOf(rows),
    days: rows.length,
    plannedDays: comparable.filter((r) => r.basis === 'geplant').length,
    comparableDays: comparable.length,
    restDays: withRest.length,
    baked,
    // ohne vergleichbaren Tag, aber mit offener Grundmenge: nur „≥ n“
    bakedIsMinimum:
      comparable.length === 0 && rows.some((r) => r.bakedIsMinimum),
    cap,
    shopBaked,
    sold: comparable.length > 0 ? sold : null,
    open: comparable.length > 0 ? open : null,
    // Grundlage von Ungeklärt (wichtig, wenn nur an einem Teil der Tage
    // gezählt wurde): gebacken − CAP und verkauft über die Tage mit Rest.
    restShopBaked: restShop,
    restSold: withRest.length > 0 ? restSold : null,
    rest: withRest.length > 0 ? restSum : null,
    unexplained,
    ampel,
    ampelBasis,
    signal: worst ? worst.diff : null,
    // Mehr verkauft als gebacken an Tagen ohne gezählten Rest (nur deren
    // negative Werte) - die Zahl hinter „prüfen (ohne Rest)“.
    shortWithoutRest: shortOpen,
    shortDays: short.length,
    signalDays,
    direction:
      ampel && ampel !== 'ok'
        ? worst.diff > 0
          ? 'fehlt'
          : 'mehr_verkauft'
        : null,
    rate,
    overproduction: rate !== null && rate > OVERPRODUCTION_RATE,
    restExceedsDates: rows.filter((r) => r.restExceedsShop).map((r) => r.date),
    gaps: {
      noReport: rows
        .filter((r) => r.status !== 'keine_plu' && !r.report)
        .map((r) => r.date),
      baseOpen: rows
        .filter((r) => r.status === 'grundmenge_offen')
        .map((r) => r.date),
      restMissing: rows
        .filter(
          (r) => r.status === 'ohne_rest' && r.restStatus === 'not_counted'
        )
        .map((r) => r.date),
      // verkauft, aber an dem Tag nicht auf dem Backzettel: kein Rest zu
      // zählen - ein eigenes Signal, keine Zähllücke
      notOnBackzettel: rows
        .filter((r) => r.restStatus === 'not_on_backzettel')
        .map((r) => r.date),
      restPartial: rows
        .filter((r) => r.status === 'ohne_rest' && r.restStatus === 'partial')
        .map((r) => r.date),
    },
    // Für die Liste „ohne Kassennummer / nicht vergleichbar“: alle Tage.
    allBaked: sumBy(rows, (r) => r.baked),
    allBakedIsMinimum: rows.some((r) => r.bakedIsMinimum),
    allCap: sumBy(rows, (r) => r.cap),
    // nur über die Tage mit Kassenbericht (die anderen: gaps.noReport)
    soldPieces:
      status === 'einheit' && rows.some((r) => r.soldPieces !== null)
        ? sumBy(rows, (r) => r.soldPieces)
        : null,
    // Kassennummern, die zu einem anderen Posten gehören (Stammdatenfehler)
    foreignPlu: (g.foreignPlu || []).map(Number),
    variants: [...variants.values()],
    dayRows: rows,
  }
}

function signalMagnitude(p) {
  return Math.abs(p.signal || 0)
}

const NEXT_DAY_DEFAULTS = ['brot', 'kuchen']
const euro = (cents) => (cents === null ? null : cents / 100)
const cent = (amount) => Math.round(amount * 100)

function parseNextDaySections(query, config) {
  const sections = (config?.sections || []).filter(
    (id) => !rest.NOT_SOLD_SECTIONS.has(id)
  )
  if (query.folgetag === undefined) {
    return {
      ok: true,
      sections: sections.filter((id) => NEXT_DAY_DEFAULTS.includes(id)),
    }
  }
  const selected =
    typeof query.folgetag === 'string'
      ? query.folgetag === ''
        ? []
        : [...new Set(query.folgetag.split(','))]
      : null
  return selected && selected.every((id) => sections.includes(id))
    ? { ok: true, sections: selected }
    : fail(
        400,
        'invalid_next_day_sections',
        'Bitte gültige Abschnitte für den Folgetag wählen.'
      )
}

function externalPreorderQty(config, catalog, date, backzettel, snapshot) {
  const quantities = new Map()
  if (!snapshot?.length || !config) return quantities
  const current = toCorePreorderItems(snapshot, date)
  const mixedOrders = new Set(
    snapshot.filter((p) => p.mixedPayment).map((p) => p.preorderId)
  )
  const lineKey = (p) => `${p.itemId}|${p.variant || ''}`
  const orderKey = (p) => `${p.preorderId}#${lineKey(p)}`
  const add = (entry, qty) => {
    if (qty <= 0) return
    const key = lineKey(entry)
    const previous = quantities.get(key)
    quantities.set(
      key,
      previous === null || mixedOrders.has(entry.preorderId)
        ? null
        : round2((previous ?? 0) + qty)
    )
  }

  for (const source of backzettel.preorderSources || []) {
    const sum = (after) =>
      computePreorderDeltas({
        config,
        catalog,
        date: source.doughDate,
        plan: source.plan,
        after,
      }).filter((p) => (p.bakeDate || source.doughDate) === date)
    const orders = sum(current)
    if (source.status !== 'confirmed') {
      const keys = new Set(source.lineKeys)
      for (const p of orders) if (keys.has(lineKey(p))) add(p, p.after)
      continue
    }

    const included = new Map(
      sum(toCorePreorderItems(source.snapshot, source.doughDate)).map((p) => [
        orderKey(p),
        p.after,
      ])
    )
    if (backzettel.status === 'confirmed') {
      for (const delta of source.deltas || []) {
        if (!delta.acknowledgedAt) continue
        const key = orderKey(delta)
        included.set(key, (included.get(key) || 0) + delta.qty)
      }
    }
    for (const p of orders) {
      add(p, Math.min(p.after, Math.max(0, included.get(orderKey(p)) || 0)))
    }
  }
  return quantities
}

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
}

const SECTION_TERMS = {
  brot: /\bbrot(?:e|waren)?\b/,
  broetchen: /\bbrotchen\b/,
  laugen: /\blaugen(?:geback)?\b/,
  kaffeestueckchen: /\b(?:kaffeestuckchen|feingeback|plunder)\b/,
  kuchen: /\b(?:kuchen|torte[n]?)\b/,
  hefeteig: /\bhefe(?:teig|geback)\b/,
}
const TRADE_TERMS =
  /\b(?:getrank\w*|zeitung\w*|zeitschrift\w*|handelsware|zukauf)\b/
const COLLECTIVE_TERMS =
  /\b(?:sonstig\w*|divers\w*|sammel[ -]?(?:artikel|nummern?))\b/

function pluHundred(plu) {
  return /^\d{3,}$/.test(plu) ? Math.floor(Number(plu) / 100) : null
}

/** Eine Kassenposition zählt einmal, auch wenn mehrere Posten ihre PLU führen. */
function euroRegister(config, cmpFor, groupOf) {
  const targets = new Map()
  const items = new Map()
  const hundreds = new Map()
  const purchasedByName = new Map()
  const purchasedSections = new Set()
  for (const item of config?.items || []) {
    if (!rest.isCountable(item)) continue
    if (item.purchased) {
      purchasedByName.set(fold(item.name), item.section)
      purchasedSections.add(item.section)
    }
    const comparison = cmpFor(item)
    const variants = comparison.bySize ? [...comparison.sizes.keys()] : ['']
    for (const variant of variants) {
      const group = groupOf(item, item.id, variant)
      items.set(group.key, {
        name: item.name,
        sizeLabel: variant ? rest.variantLabel(config, variant, item) : null,
        section: item.section,
      })
      for (const plu of new Set(group.info?.plu || [])) {
        const list = targets.get(plu) || []
        list.push({
          key: group.key,
          section: item.section,
          purchased: item.purchased === true,
          conflict: group.foreignPlu.includes(plu),
        })
        targets.set(plu, list)
        const hundred = pluHundred(plu)
        if (hundred === null) continue
        const sections = hundreds.get(hundred) || new Set()
        sections.add(item.section)
        hundreds.set(hundred, sections)
      }
    }
  }
  return { targets, items, hundreds, purchasedByName, purchasedSections }
}

const addCents = (a, b) => (a === null || b === null ? null : a + b)

function euroSales(report, register, sections) {
  const perItem = new Map()
  const perSection = new Map()
  const byPlu = new Map()
  const blockedPlu = new Set()
  const unmatched = []
  const uncertainSections = new Set()
  let sammel = 0
  let trade = 0
  const totalsFor = (section) => {
    if (!perSection.has(section))
      perSection.set(section, {
        ist: 0,
        sammel: 0,
        trade: 0,
        hasOwnSales: false,
      })
    return perSection.get(section)
  }
  const sectionsFromText = (value) =>
    sections.filter((id) => SECTION_TERMS[id]?.test(value))
  for (const p of report?.products || []) {
    const plu = String(p.productId ?? '').trim()
    const targets = register.targets.get(plu) || []
    const name = fold(p.productName)
    const group = fold(p.groupName)
    const collective = COLLECTIVE_TERMS.test(name)
    const groupSections = sectionsFromText(group)
    const targetSections = new Set(targets.map((t) => t.section))
    const candidates = new Set([...targetSections, ...groupSections])
    if (collective && candidates.size === 0) {
      const fromName = sectionsFromText(name)
      for (const id of fromName.length
        ? fromName
        : register.hundreds.get(pluHundred(plu)) || []) {
        candidates.add(id)
      }
    }
    const candidate = candidates.size === 1 ? [...candidates][0] : null
    const amount =
      p.revenueMissing || !Number.isFinite(p.revenue) ? null : cent(p.revenue)
    const tradeMarker = TRADE_TERMS.test(`${group} ${name}`)
    const namedTradeSection = register.purchasedByName.get(name)
    const isTrade = targets.length
      ? targets.every((t) => t.purchased)
      : Boolean(
          namedTradeSection || (tradeMarker && groupSections.length === 0)
        )
    if (isTrade) {
      trade = addCents(trade, amount)
      const tradeSection =
        targetSections.size === 1 ? [...targetSections][0] : namedTradeSection
      if (tradeSection) {
        const totals = totalsFor(tradeSection)
        totals.trade = addCents(totals.trade, amount)
      }
      continue
    }
    const assigned = !collective && targets.length === 1 && !targets[0].conflict
    const ownGroup = targets.length
      ? (collective || targets.length > 1) &&
        targetSections.size === 1 &&
        targets.every((t) => !t.purchased)
      : candidate &&
        !tradeMarker &&
        (collective || !register.purchasedSections.has(candidate))
    const ownSection = assigned
      ? targets[0].section
      : ownGroup
      ? candidate
      : null
    if (assigned) {
      const key = targets[0].key
      perItem.set(
        key,
        addCents(perItem.has(key) ? perItem.get(key) : 0, amount)
      )
      byPlu.set(plu, {
        quantity: p.quantity,
        quantityMissing: p.quantityMissing,
        amount,
      })
    } else {
      blockedPlu.add(plu)
      unmatched.push({
        plu: plu || null,
        name: p.productName || null,
        section: ownSection,
        sammel: collective,
        istEur: euro(amount),
      })
    }
    if (collective) sammel = addCents(sammel, amount)
    if (ownSection) {
      const totals = totalsFor(ownSection)
      totals.ist = addCents(totals.ist, amount)
      totals.hasOwnSales = true
      if (collective) totals.sammel = addCents(totals.sammel, amount)
    } else if (amount !== 0) {
      for (const id of candidates.size ? candidates : sections)
        uncertainSections.add(id)
    }
  }
  return {
    perItem,
    perSection,
    byPlu,
    blockedPlu,
    unmatched,
    sammel,
    trade,
    uncertainSections,
    positionsMissing: report?.positionsMissing === true,
  }
}

function assignablePlu(register, sales, key) {
  const targets = register.targets.get(key)
  return (
    targets?.length === 1 && !targets[0].conflict && !sales.blockedPlu.has(key)
  )
}

/** Preis je Backzettel-Einheit, wenn die Produkte dieser Zeile gleich bewertet werden können. */
function euroUnitPrice(bucket, variant, catalog, sales, register) {
  const item = bucket.item
  if (!item) return null
  const size = rest.isSizeItem(item) && item.sizes.find((s) => s.id === variant)
  const products = (item.products || []).filter(
    (p) => !size || p.size === size.id
  )
  const plu = [
    ...new Set(size ? size.plu || [] : bucket.info?.plu || []),
  ].filter((key) => assignablePlu(register, sales, key))
  const reportPrice = (key) => {
    const sale = sales.byPlu.get(key)
    return !sales.positionsMissing &&
      sale &&
      !sale.quantityMissing &&
      sale.quantity > 0 &&
      sale.amount > 0
      ? sale.amount / sale.quantity
      : null
  }
  const prices = products.length
    ? products.map((p) => {
        const product = catalog.get(String(p.id))
        const price = product?.price
        const key =
          plu.find(
            (k) => k === String(p.id) || k === String(product?.numeric_id)
          ) ?? (products.length === 1 && plu.length === 1 ? plu[0] : null)
        const cents =
          Number.isFinite(price) && price > 0 ? cent(price) : reportPrice(key)
        return cents > 0 && p.factor > 0 ? cents / p.factor : null
      })
    : plu.map((key) => {
        const factor =
          bucket.info?.factors.get(key) ?? (countsPieces(item) ? 1 : null)
        const price = reportPrice(key)
        return price && factor > 0 ? price / factor : null
      })
  const first = prices[0]
  return first > 0 &&
    prices.every((price) => price !== null && Math.abs(price - first) < 1e-8)
    ? first
    : null
}

function euroDay(date, day, buckets, report, catalog, register, sectionIds) {
  const sales = euroSales(report, register, sectionIds)
  const { positionsMissing } = sales
  const cashComplete = report && !positionsMissing
  const sections = new Map()
  const sectionFor = (id) => {
    if (!sections.has(id)) {
      const cash = sales.perSection.get(id)
      sections.set(id, {
        section: id,
        sectionLabel: SECTION_LABELS[id] || id || 'Abschnitt offen',
        soll: day.basis ? 0 : null,
        ist: cashComplete ? (cash ? cash.ist : 0) : null,
        zuordnungOffen: sales.uncertainSections.has(id),
        sammelEur: cashComplete ? euro(cash ? cash.sammel : 0) : null,
        handelswareEur: cashComplete ? euro(cash ? cash.trade : 0) : null,
        preisOffen: [],
        grundmengeOffen: false,
        mischzahlungOffen: false,
        rest: 0,
        restCounted: true,
        hasLines: false,
        hasOwnCashLink: cash?.hasOwnSales || false,
        carry: 0,
      })
    }
    return sections.get(id)
  }
  const items = []
  for (const id of sales.perSection.keys()) sectionFor(id)
  for (const b of buckets.values()) {
    if (b.item?.purchased) continue
    const section = sectionFor(b.meta.section)
    let soll = 0
    let preisOffen = false
    for (const line of b.lines) {
      section.hasLines = true
      if (line.qtyOpen) section.grundmengeOffen = true
      if (line.externalQty === null) {
        section.mischzahlungOffen = true
        soll = null
        continue
      }
      const shop = round2(line.baked - line.cap - line.externalQty)
      const price =
        shop !== 0 || line.rest > 0
          ? euroUnitPrice(b, line.variant, catalog, sales, register)
          : null
      if (shop !== 0 && price === null && !line.qtyOpen) preisOffen = true
      if (line.qtyOpen || preisOffen) soll = null
      else if (soll !== null && shop !== 0) soll += Math.round(shop * price)
      if (!line.complete || (line.rest > 0 && price === null))
        section.restCounted = false
      else if (line.rest > 0) section.rest += Math.round(line.rest * price)
    }
    if (preisOffen) section.preisOffen.push(b.key)
    section.soll =
      section.soll === null || soll === null ? null : section.soll + soll
    const assignable = b.info?.plu.some((key) =>
      assignablePlu(register, sales, key)
    )
    if (assignable) section.hasOwnCashLink = true
    items.push({
      key: b.key,
      name: b.meta.name,
      sizeLabel: b.sizeId ? rest.variantLabel(null, b.sizeId, b.item) : null,
      section: b.meta.section,
      sollEur: euro(soll),
      istEur:
        cashComplete && assignable
          ? euro(sales.perItem.has(b.key) ? sales.perItem.get(b.key) : 0)
          : null,
      preisOffen,
    })
  }
  for (const section of sections.values()) {
    if (
      section.zuordnungOffen ||
      (section.hasLines && !section.hasOwnCashLink)
    ) {
      section.ist = null
    }
  }
  // Ein Storno- oder Rabattpaar kann Erlös mit Nettomenge null haben.
  const shown = new Set(items.map((item) => item.key))
  for (const [key, amount] of sales.perItem) {
    if (shown.has(key)) continue
    const target = register.items.get(key)
    items.push({
      key,
      ...target,
      sollEur: day.basis ? 0 : null,
      istEur: cashComplete ? euro(amount) : null,
      preisOffen: false,
    })
  }
  return {
    date,
    basis: day.basis,
    report: Boolean(report),
    positionsMissing,
    sections,
    items,
    nichtZuordenbar: sales.unmatched,
    sammel: cashComplete ? sales.sammel : null,
    handelswareEur: cashComplete ? euro(sales.trade) : null,
    kasse:
      report && Number.isFinite(report.revenue) ? cent(report.revenue) : null,
  }
}

/** Nur Überschuss des Folgetags, höchstens bis zur Lücke und zur bekannten Menge Rest. */
function includeNextDay(daily, sections) {
  for (const previous of daily.values()) {
    const next = daily.get(rest.addDays(previous.date, 1))
    if (!next) continue
    for (const id of sections) {
      const from = next.sections.get(id)
      const to = previous.sections.get(id)
      if (
        !from ||
        !to ||
        from.ist === null ||
        from.soll === null ||
        to.ist === null ||
        to.soll === null
      )
        continue
      const gap = Math.max(0, to.soll - to.ist)
      const surplus = Math.max(0, from.ist - from.soll)
      const moved = Math.min(gap, surplus, to.restCounted ? to.rest : gap)
      from.carry -= moved
      to.carry += moved
    }
  }
}

function euroResult(daily, from, to, euroSections, folgetag, order) {
  includeNextDay(daily, folgetag)
  const days = [...daily.values()].filter((d) => d.date >= from && d.date <= to)
  const cashDays = days.filter((d) => d.report)
  const sammelsumme = cashDays.reduce((total, d) => total + (d.sammel ?? 0), 0)
  const kassensumme = cashDays.reduce((total, d) => total + (d.kasse ?? 0), 0)
  const knownSammel =
    cashDays.length > 0 && cashDays.every((d) => d.sammel !== null)
  return {
    abschnitte: euroSections.map((id) => ({
      id,
      label: SECTION_LABELS[id] || id,
      folgetag: folgetag.includes(id),
    })),
    sammelEur: knownSammel ? euro(sammelsumme) : null,
    sammelAnteil:
      knownSammel && kassensumme > 0 && cashDays.every((d) => d.kasse !== null)
        ? sammelsumme / kassensumme
        : null,
    days: days.map(({ sections, sammel, kasse, ...day }) => ({
      ...day,
      sammelEur: euro(sammel),
      kasseEur: euro(kasse),
      abschnitte: [...sections.values()]
        .sort((a, b) => order(a.section) - order(b.section))
        .map(
          ({
            soll,
            ist,
            sammelEur,
            handelswareEur,
            preisOffen,
            grundmengeOffen,
            mischzahlungOffen,
            zuordnungOffen,
            section,
            sectionLabel,
            restCounted,
            hasLines,
            carry,
          }) => ({
            section,
            sectionLabel,
            sollEur: euro(soll),
            istEur: euro(ist),
            sammelEur,
            handelswareEur,
            preisOffen,
            grundmengeOffen,
            mischzahlungOffen,
            zuordnungOffen,
            restCounted: hasLines && restCounted,
            folgetagEur: euro(carry),
            differenzEur:
              soll === null || ist === null ? null : euro(ist + carry - soll),
          })
        ),
    })),
  }
}

/**
 * Der Abgleich eines Zeitraums.
 *
 * @param {object} a
 * @param {string} a.from
 * @param {string} a.to
 * @param {string} a.today
 * @param {object|null} a.config normalisiert
 * @param {Array} [a.catalog]
 * @param {Object<string, {backzettel: object|null, rows: Array, report: object|null}>} a.days
 *   je Datum: Backliste des Backtags (`getBakeLines`, freigegeben oder
 *   Entwurf), gespeicherte Rest-Zählungen, aggregierter Kassenbericht
 *   (`reports.core` `aggregateDay`) oder `null`.
 * @param {boolean} [a.reportsAvailable]
 */
function reconcile(a) {
  const config = a.config || null
  const items = rest.itemsById(config)
  const resolve = config ? refCore.soldResolver(config, a.catalog) : null
  // ohne Katalog: nur Produkt-IDs der Stammdaten, keine `numeric_id`
  const directResolve = config ? refCore.soldResolver(config, null) : null
  const pluOwners = new Map()
  for (const item of config ? config.items : []) {
    for (const raw of Array.isArray(item.plu) ? item.plu : []) {
      const key = String(raw).trim()
      if (!key) continue
      if (!pluOwners.has(key)) pluOwners.set(key, [])
      pluOwners.get(key).push(item.id)
    }
  }
  const cmpCtx = { directResolve, pluOwners }
  const cmpCache = new Map()
  const cmpFor = (item) => {
    if (!cmpCache.has(item.id)) {
      cmpCache.set(item.id, comparison(item, resolve, cmpCtx))
    }
    return cmpCache.get(item.id)
  }
  const groupOf = (item, itemId, variant) => {
    if (item) {
      const c = cmpFor(item)
      if (c.bySize) {
        return {
          key: `${itemId}|${variant || ''}`,
          sizeId: variant || null,
          info: (variant && c.sizes.get(variant)) || null,
          soldBasis: c.soldBasis,
          foreignPlu: c.foreignPlu,
        }
      }
      return {
        key: itemId,
        sizeId: null,
        info: c.info,
        soldBasis: c.soldBasis,
        foreignPlu: c.foreignPlu,
      }
    }
    return {
      key: itemId,
      sizeId: null,
      info: null,
      soldBasis: null,
      foreignPlu: [],
    }
  }
  const order = rest.sectionOrder(config)
  const catalog = new Map((a.catalog || []).map((p) => [String(p.id), p]))
  const euroSections = (config?.sections || []).filter(
    (id) => !rest.NOT_SOLD_SECTIONS.has(id)
  )
  const folgetag = a.folgetag ?? parseNextDaySections({}, config).sections
  const euroDays = new Map()
  const register = euroRegister(config, cmpFor, groupOf)
  const configIndex = new Map(
    (config ? config.items : []).map((item, i) => [item.id, i])
  )

  const groups = new Map()
  const days = []
  const counts = {
    days: 0,
    bakeDays: 0,
    confirmed: 0,
    planned: 0,
    noReport: 0,
    restCounted: 0,
    restPartial: 0,
    restNotCounted: 0,
    baseOpen: 0,
    noBackzettel: 0,
    ruhetag: 0,
    geschlossen: 0,
    future: 0,
  }

  const readFrom = folgetag.length ? rest.addDays(a.from, -1) : a.from
  const readTo = folgetag.length ? rest.addDays(a.to, 1) : a.to
  for (const date of rest.listDates(readFrom, readTo)) {
    const inRange = date >= a.from && date <= a.to
    if (inRange) counts.days += 1
    const weekday = rest.isoWeekday(date)
    const day = {
      date,
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday] || null,
      status: 'ok',
      basis: null,
      report: false,
      restStatus: null,
      signals: { pruefen: 0, auffaellig: 0 },
      baseOpen: 0,
    }
    if (inRange) days.push(day)
    if (date > a.today) {
      day.status = 'future'
      if (inRange) counts.future += 1
      continue
    }
    const countDay = config ? rest.countDayStatus(config, date) : null
    if (countDay && countDay.dayKind && countDay.dayKind.label) {
      day.dayKind = countDay.dayKind
    }
    if (countDay && countDay.status !== 'ok') {
      // Ruhetag oder Schließtag: nichts gebacken - keine Lücke, keine 0.
      day.status = countDay.status
      if (inRange) counts[countDay.status] += 1
      continue
    }
    const input = (a.days && a.days[date]) || {}
    const report =
      input.report && input.report.status === 'ok' ? input.report : null
    const addEuroDay = (buckets = new Map()) => {
      euroDays.set(
        date,
        euroDay(date, day, buckets, report, catalog, register, euroSections)
      )
    }
    if (!input.backzettel || !Array.isArray(input.backzettel.sections)) {
      day.status = 'no_backzettel'
      if (inRange) counts.noBackzettel += 1
      if (report || inRange) addEuroDay()
      continue
    }
    const confirmed = input.backzettel.status === 'confirmed'
    const rows = Array.isArray(input.rows) ? input.rows : []
    const bz = rest.backzettelLines(input.backzettel, config)
    const byLine = rest.rowsByLine(rows)
    const keys = new Set()
    for (const [key, l] of bz) {
      // offene Grundmenge auch bei Gesamt 0: kein Plan, keine 0
      if ((confirmed ? l.baked || 0 : l.planned) > 0 || l.qtyOpen) {
        keys.add(key)
      }
    }
    for (const key of byLine.keys()) keys.add(key)
    if (!confirmed && keys.size === 0) {
      // Entwurf ohne eine einzige Zeile: es gibt keinen Plan - kein
      // Backtag mit „verkauft, aber nicht gebacken“-Alarmen.
      day.status = 'no_backzettel'
      if (inRange) counts.noBackzettel += 1
      addEuroDay()
      continue
    }
    day.basis = confirmed ? 'freigegeben' : 'geplant'
    const soldMap = report ? refCore.soldByPlu(report) : null
    day.report = !!soldMap
    if (inRange) {
      counts.bakeDays += 1
      counts[confirmed ? 'confirmed' : 'planned'] += 1
      if (!soldMap) counts.noReport += 1
    }

    const external = externalPreorderQty(
      config,
      a.catalog,
      date,
      input.backzettel,
      input.externalPreorders
    )
    const buckets = new Map()
    const bucketFor = (item, itemId, variant, meta) => {
      const g = groupOf(item, itemId, variant)
      if (!buckets.has(g.key)) {
        buckets.set(g.key, { ...g, itemId, item, meta, lines: [] })
      }
      return buckets.get(g.key)
    }
    for (const key of keys) {
      const [itemId, variant = ''] = key.split('|')
      const item = items.get(itemId) || null
      if (item && !rest.isCountable(item)) continue
      const b = bz.get(key) || null
      const stored = byLine.get(key) || []
      const first = stored[0] || {}
      const meta = {
        name: item ? item.name : b ? b.name : first.itemName || itemId,
        section: item ? item.section : b ? b.section : null,
        unit: item
          ? item.unit || 'Stück'
          : b
          ? b.unit
          : first.itemUnit || 'Stück',
      }
      const expected = rest.expectedRowsForLine(
        item,
        a.catalog,
        stored,
        variant
      )
      bucketFor(item, itemId, variant, meta).lines.push({
        variant,
        label: variant ? rest.variantLabel(config, variant, item) : null,
        baked: b ? (confirmed ? b.baked || 0 : b.planned) : 0,
        cap: b ? b.cap : 0,
        externalQty: external.has(key) ? external.get(key) : 0,
        qtyOpen: b ? Boolean(b.qtyOpen) : false,
        anyCount: stored.length > 0,
        complete: rest.lineComplete(stored, expected),
        rest: rest.lineRest(
          stored.map((s) => ({ ...s, factor: Number(s.factor) || 0 }))
        ),
      })
    }
    // Verkauft, aber an diesem Tag nicht gebacken: auch das ist ein Signal
    // (Kassennummer falsch zugeordnet, Ware vom Vortag).
    if (soldMap && config) {
      for (const item of config.items) {
        if (!rest.isCountable(item)) continue
        const c = cmpFor(item)
        if (c.info.plu.length === 0) continue
        const meta = {
          name: item.name,
          section: item.section,
          unit: item.unit || 'Stück',
        }
        const targets = c.bySize
          ? [...c.sizes.entries()].map(([sizeId, info]) => ({
              variant: sizeId,
              info,
            }))
          : [{ variant: '', info: c.info }]
        for (const t of targets) {
          const g = groupOf(item, item.id, t.variant)
          if (buckets.has(g.key)) continue
          if (refCore.soldOnDay(t.info, soldMap) === 0) continue
          bucketFor(item, item.id, t.variant, meta)
        }
      }
    }

    addEuroDay(buckets)
    if (!inRange) continue

    let anyLine = false
    let allCounted = true
    let anyCounted = false
    for (const bucket of buckets.values()) {
      const row = dayRow(date, confirmed, bucket.lines, bucket.info, soldMap)
      if (bucket.lines.length > 0) {
        anyLine = true
        if (row.restStatus !== 'counted') allCounted = false
        if (row.restStatus === 'counted' || row.restStatus === 'partial') {
          anyCounted = true
        }
      }
      if (row.ampel === 'pruefen') day.signals.pruefen += 1
      if (row.ampel === 'auffaellig') day.signals.auffaellig += 1
      if (row.status === 'grundmenge_offen') day.baseOpen += 1
      if (!groups.has(bucket.key)) {
        groups.set(bucket.key, {
          key: bucket.key,
          itemId: bucket.itemId,
          sizeId: bucket.sizeId,
          item: bucket.item,
          info: bucket.info,
          soldBasis: bucket.soldBasis,
          foreignPlu: bucket.foreignPlu,
          meta: bucket.meta,
          dayRows: [],
        })
      }
      groups.get(bucket.key).dayRows.push(row)
    }
    day.restStatus = !anyLine
      ? null
      : allCounted
      ? 'counted'
      : anyCounted
      ? 'partial'
      : 'not_counted'
    if (day.restStatus === 'counted') counts.restCounted += 1
    else if (day.restStatus === 'partial') counts.restPartial += 1
    else if (day.restStatus === 'not_counted') counts.restNotCounted += 1
    if (day.baseOpen > 0) counts.baseOpen += 1
  }

  const all = [...groups.values()].map((g) => periodRow(g, config))
  const byConfig = (x, y) =>
    order(x.section) - order(y.section) ||
    (configIndex.has(x.itemId) ? configIndex.get(x.itemId) : 1e6) -
      (configIndex.has(y.itemId) ? configIndex.get(y.itemId) : 1e6) ||
    String(x.sizeId || '').localeCompare(String(y.sizeId || '')) ||
    x.name.localeCompare(y.name)
  const compared = all
    .filter((p) => p.status === 'vergleichbar')
    .sort(
      (x, y) =>
        (AMPEL_RANK[y.ampel] || 0) - (AMPEL_RANK[x.ampel] || 0) ||
        signalMagnitude(y) - signalMagnitude(x) ||
        byConfig(x, y)
    )
  const unmatched = all
    .filter((p) => p.status !== 'vergleichbar')
    .sort(
      (x, y) =>
        (x.status === y.status ? 0 : x.status === 'keine_plu' ? -1 : 1) ||
        byConfig(x, y)
    )
  const signals = { pruefen: 0, auffaellig: 0, ok: 0, ohneAmpel: 0 }
  for (const p of compared) {
    if (p.ampel) signals[p.ampel] += 1
    else signals.ohneAmpel += 1
  }
  return {
    from: a.from,
    to: a.to,
    today: a.today,
    configStatus: config ? 'ok' : 'no-config',
    reportsAvailable: a.reportsAvailable !== false,
    basis:
      counts.bakeDays === 0
        ? null
        : counts.confirmed === 0
        ? 'geplant'
        : counts.planned === 0
        ? 'freigegeben'
        : 'gemischt',
    explanation: EXPLANATION,
    thresholds: {
      okShare: OK_SHARE,
      noticeShare: NOTICE_SHARE,
      minTolerancePieces: MIN_TOLERANCE_PIECES,
      overproductionRate: OVERPRODUCTION_RATE,
    },
    counts,
    signals,
    items: compared,
    unmatched,
    days,
    euro: euroResult(euroDays, a.from, a.to, euroSections, folgetag, order),
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const qty = rest.qtyCell

function postenName(p) {
  return p.sizeLabel ? `${p.name} ${p.sizeLabel}` : p.name
}

/** Gebacken; bei offener Grundmenge nur als Mindestwert „≥ n“. */
function bakedCell(value, isMinimum) {
  if (value === null || value === undefined) return ''
  return isMinimum ? `≥ ${qty(value)}` : qty(value)
}

function ampelCell(ampel, ampelBasis) {
  if (!ampel) return ''
  return ampelBasis === 'ohne_rest'
    ? `${AMPEL_LABELS[ampel]} (ohne Rest)`
    : AMPEL_LABELS[ampel]
}

/** Der Abgleich als CSV (Semikolon, `csvCell` gegen Formel-Zellen). */
function abgleichCsv(s) {
  const lines = []
  const push = (cells) => lines.push(cells.map(csvCell).join(';'))
  push(['Abgleich Produktion - Kasse'])
  push(['Zeitraum', `${s.from} bis ${s.to}`])
  push(['Grundlage', s.basis ? BASIS_LABELS[s.basis] : 'kein Backtag'])
  push(['Hinweis', s.explanation])
  push([])
  push(['Je Posten'])
  push([
    'Bereich',
    'Posten',
    'Einheit',
    'Grundlage',
    'Tage im Zeitraum',
    'Gebacken (alle Tage)',
    'Tage vergleichbar',
    'Gebacken (vergleichbare Tage)',
    'davon CAP (vergleichbare Tage)',
    'Verkauft (Kasse)',
    'Nicht verkauft oder nicht kassiert',
    'Mehr verkauft (Tage ohne Rest)',
    'Tage mit Rest',
    'Gebacken − CAP (Tage mit Rest)',
    'Verkauft (Tage mit Rest)',
    'Rest',
    'Ungeklärt (Tage mit Rest)',
    'Ampel',
    'Restquote',
    'Zu viel produziert',
    'Ohne Kassenbericht',
    'Rest nicht gezählt',
    'Grundmenge offen',
    'Verkauft, nicht auf dem Backzettel',
  ])
  for (const p of s.items) {
    // ohne vergleichbaren Tag gibt es kein „gebacken der vergleichbaren
    // Tage“ - dann steht nur „Gebacken (alle Tage)“
    const cmp = p.comparableDays > 0
    push([
      p.sectionLabel || '',
      postenName(p),
      p.unit,
      p.basis ? BASIS_LABELS[p.basis] : '',
      p.days,
      bakedCell(p.allBaked, p.allBakedIsMinimum),
      p.comparableDays,
      cmp ? bakedCell(p.baked, p.bakedIsMinimum) : '',
      cmp ? qty(p.cap) : '',
      qty(p.sold),
      qty(p.open),
      qty(p.shortWithoutRest),
      p.restDays,
      p.restDays > 0 ? qty(p.restShopBaked) : '',
      qty(p.restSold),
      qty(p.rest),
      qty(p.unexplained),
      ampelCell(p.ampel, p.ampelBasis),
      rest.pct(p.rate),
      p.overproduction ? 'ja' : '',
      p.gaps.noReport.join(', '),
      [...p.gaps.restMissing, ...p.gaps.restPartial].sort().join(', '),
      p.gaps.baseOpen.join(', '),
      p.gaps.notOnBackzettel.join(', '),
    ])
  }
  push([])
  push(['Je Tag'])
  push([
    'Datum',
    'Wochentag',
    'Posten',
    'Einheit',
    'Grundlage',
    'Gebacken',
    'davon CAP',
    'Verkauft (Kasse)',
    'Nicht verkauft oder nicht kassiert',
    'Rest',
    'Ungeklärt',
    'Ampel',
    'Status',
  ])
  const dayLines = []
  for (const p of s.items) {
    for (const r of p.dayRows) dayLines.push({ p, r })
  }
  dayLines.sort(
    (x, y) =>
      x.r.date.localeCompare(y.r.date) ||
      s.items.indexOf(x.p) - s.items.indexOf(y.p)
  )
  for (const { p, r } of dayLines) {
    push([
      r.date,
      r.weekdayName || '',
      postenName(p),
      p.unit,
      BASIS_LABELS[r.basis],
      bakedCell(r.baked, r.bakedIsMinimum),
      qty(r.cap),
      qty(r.sold),
      qty(r.open),
      r.rest === null ? REST_STATUS_LABELS[r.restStatus] : qty(r.rest),
      qty(r.unexplained),
      ampelCell(r.ampel, r.ampelBasis),
      STATUS_LABELS[r.status],
    ])
  }
  push([])
  push(['Ohne Kassennummer / nicht vergleichbar'])
  push([
    'Bereich',
    'Posten',
    'Einheit',
    'Status',
    'Gebacken',
    'davon CAP',
    'Verkauft (Stück laut Kasse)',
    'Ohne Kassenbericht',
  ])
  for (const p of s.unmatched) {
    push([
      p.sectionLabel || '',
      postenName(p),
      p.unit,
      STATUS_LABELS[p.status],
      bakedCell(p.allBaked, p.allBakedIsMinimum),
      qty(p.allCap),
      p.soldPieces === null ? '' : qty(p.soldPieces),
      p.status === 'keine_plu' ? '' : p.gaps.noReport.join(', '),
    ])
  }
  push([])
  push(['Tage'])
  push(['Datum', 'Wochentag', 'Tag', 'Grundlage', 'Kassenbericht', 'Rest'])
  for (const d of s.days) {
    push([
      d.date,
      d.weekdayName || '',
      `${DAY_STATUS_LABELS[d.status] || d.status}${
        d.status === 'geschlossen' && d.dayKind && d.dayKind.note
          ? ` (${d.dayKind.note})`
          : ''
      }`,
      d.basis ? BASIS_LABELS[d.basis] : '',
      d.status === 'ok' ? (d.report ? 'ja' : 'kein Kassenbericht') : '',
      d.restStatus ? REST_STATUS_LABELS[d.restStatus] : '',
    ])
  }
  return lines.join('\r\n')
}

module.exports = {
  MAX_RANGE_DAYS,
  DEFAULT_BAKE_DAYS,
  OK_SHARE,
  NOTICE_SHARE,
  MIN_TOLERANCE_PIECES,
  OVERPRODUCTION_RATE,
  AMPEL_LABELS,
  STATUS_LABELS,
  REST_STATUS_LABELS,
  BASIS_LABELS,
  EXPLANATION,
  parseRange,
  parseNextDaySections,
  classify,
  pieceTolerance,
  comparison,
  reconcile,
  abgleichCsv,
  // für den Dienst
  listDates: rest.listDates,
  addDays: rest.addDays,
  berlinToday: rest.berlinToday,
}
