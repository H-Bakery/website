/**
 * Einrichtung des Verkaufsraums (DB12): der eine Leser und Schreiber für
 * `<hq>/config/digitale-baeckerei/einrichtung.yaml` - was auf welchem Platz
 * liegt. Reine Logik ohne Dateisystem; getestet in einrichtung.spec.ts.
 * CommonJS; einzige Abhängigkeit: `yaml` (es liefert die Stelle jedes Eintrags
 * im Text - geändert wird im Text, damit alle anderen Zeilen bleiben, wie sie
 * sind; siehe `aendereEinrichtung`). `sync-model` liest damit beim Bauen, der
 * Einrichten-Modus der App schreibt damit die Datei zum Herunterladen.
 *
 * ```yaml
 * raeume:
 *   laden:
 *     brotregal/ebene-1/platz-01:    # Platz: Name des Knotens im Modell ohne „produkt/“
 *       produkt: testbrot-500g      # hq-ID ohne Nummer
 *       anzahl: 2
 *     theke/vitrine/ebene-1/platz-02: leer
 * ```
 *
 * - Ein Platz, der nicht in der Datei steht, bleibt wie im Modell.
 * - `leer`: Der Platz zeigt nichts und steht in keiner Liste.
 * - Ohne Datei gilt überall das Modell.
 * - Keine Preise, keine Texte - nur IDs und Stückzahlen.
 * - Ein unbekannter Raum, Platz oder ein unbekanntes Produkt bricht den Build
 *   ab (`wendeAn`); die Meldung nennt Raum, Platz und ID.
 */
const YAML = require('yaml')

const DATEI = 'einrichtung.yaml'
const LEER = 'leer'
const MAX_ANZAHL = 500
/** hq-Produkt-ID ohne Nummer. */
const PRODUKT_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Platz wie im Modell: Abschnitte aus Kleinbuchstaben, Ziffern, `-`, `_`, `.`. */
const PLATZ_ID = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/
const RAUM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Kopf einer neu angelegten Datei. */
const KOPF = [
  ' Einrichtung der Digitalen Bäckerei: was auf welchem Platz liegt.',
  ' Plätze, die hier nicht stehen, bleiben wie im 3D-Modell.',
  ' Geschrieben vom Einrichten-Modus der App (nx run bakery-digitale-baeckerei:einrichten).',
].join('\n')

/**
 * @typedef {{ produkt: string, anzahl: number } | 'leer'} Eintrag
 * @typedef {{ raeume: Record<string, Record<string, Eintrag>> }} Einrichtung
 * @typedef {{ slot: string, produkt: string, anzahl?: number, quelle?: 'einrichtung' }} BelegungEintrag
 */

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Ohne Datei: überall das Modell. @returns {Einrichtung} */
function leereEinrichtung() {
  return { raeume: {} }
}

/**
 * Prüft einen Eintrag und gibt ihn bereinigt zurück.
 * @param {unknown} raw
 * @param {string} wo
 * @returns {Eintrag}
 */
function pruefeEintrag(raw, wo) {
  if (raw === LEER) return LEER
  if (!isRecord(raw)) {
    throw new Error(
      `${wo}: erwartet „leer“ oder ein Produkt mit Anzahl (produkt: …, anzahl: …)`
    )
  }
  const fremd = Object.keys(raw).filter(
    (k) => k !== 'produkt' && k !== 'anzahl'
  )
  if (fremd.length > 0) {
    throw new Error(`${wo}: unbekanntes Feld "${fremd[0]}"`)
  }
  if (typeof raw.produkt !== 'string' || !PRODUKT_ID.test(raw.produkt)) {
    throw new Error(
      `${wo}: produkt fehlt oder ist keine Produkt-ID (z. B. "testbrot-500g")`
    )
  }
  const { anzahl } = raw
  if (
    typeof anzahl !== 'number' ||
    !Number.isInteger(anzahl) ||
    anzahl < 1 ||
    anzahl > MAX_ANZAHL
  ) {
    throw new Error(
      `${wo}: anzahl muss eine ganze Zahl von 1 bis ${MAX_ANZAHL} sein`
    )
  }
  return { produkt: raw.produkt, anzahl }
}

/**
 * Prüft die Form einer Einrichtung (schon als Objekt).
 * @param {unknown} raw
 * @param {string} [wo]
 * @returns {Einrichtung}
 */
function pruefeEinrichtung(raw, wo = DATEI) {
  if (raw === null || raw === undefined) return leereEinrichtung()
  if (!isRecord(raw)) throw new Error(`${wo}: kein Objekt`)
  const fremd = Object.keys(raw).filter((k) => k !== 'raeume')
  if (fremd.length > 0) {
    throw new Error(`${wo}: unbekanntes Feld "${fremd[0]}" (erwartet: raeume)`)
  }
  const raeume = raw.raeume ?? {}
  if (!isRecord(raeume)) throw new Error(`${wo}: raeume muss ein Objekt sein`)
  /** @type {Einrichtung} */
  const out = leereEinrichtung()
  for (const [raum, plaetze] of Object.entries(raeume)) {
    if (!RAUM_ID.test(raum)) {
      throw new Error(`${wo}: "${raum}" ist keine Raum-ID`)
    }
    if (plaetze === null || plaetze === undefined) {
      out.raeume[raum] = {}
      continue
    }
    if (!isRecord(plaetze)) {
      throw new Error(`${wo}: raeume.${raum} muss ein Objekt sein`)
    }
    /** @type {Record<string, Eintrag>} */
    const eintraege = {}
    for (const [slot, eintrag] of Object.entries(plaetze)) {
      if (!PLATZ_ID.test(slot)) {
        throw new Error(`${wo}: Raum ${raum}: "${slot}" ist kein Platz`)
      }
      eintraege[slot] = pruefeEintrag(eintrag, `${wo}: Raum ${raum}, ${slot}`)
    }
    out.raeume[raum] = eintraege
  }
  return out
}

/**
 * Was steht in der Datei doppelt - ein Raum, ein Platz oder ein Feld? Für die
 * Meldung des Lesers; `null`, wenn sich nichts findet.
 * @param {string} text
 * @returns {string | null}
 */
function wasDoppeltSteht(text) {
  const doc = YAML.parseDocument(text, { uniqueKeys: false })
  /** Der erste Schlüssel, der in einer Map zweimal steht. */
  const doppelt = (map) => {
    const gesehen = new Set()
    for (const paar of map.items) {
      const name = String(YAML.isScalar(paar.key) ? paar.key.value : paar.key)
      if (gesehen.has(name)) return name
      gesehen.add(name)
    }
    return null
  }
  const oben = doc.contents
  if (!YAML.isMap(oben)) return null
  let name = doppelt(oben)
  if (name !== null) return `das Feld "${name}" steht doppelt`
  const raeume = oben.get('raeume', true)
  if (!YAML.isMap(raeume)) return null
  name = doppelt(raeume)
  if (name !== null) return `der Raum "${name}" steht doppelt`
  for (const raum of raeume.items) {
    if (!YAML.isMap(raum.value)) continue
    const raumName = String(YAML.isScalar(raum.key) ? raum.key.value : raum.key)
    name = doppelt(raum.value)
    if (name !== null) {
      return `der Platz "${name}" steht doppelt (Raum ${raumName})`
    }
    for (const platz of raum.value.items) {
      if (!YAML.isMap(platz.value)) continue
      name = doppelt(platz.value)
      if (name !== null) {
        const slot = String(
          YAML.isScalar(platz.key) ? platz.key.value : platz.key
        )
        return `das Feld "${name}" steht doppelt (Raum ${raumName}, ${slot})`
      }
    }
  }
  return null
}

/**
 * Liest den Text einer `einrichtung.yaml`. Wirft mit einer deutschen Meldung.
 * @param {string} text
 * @param {string} [wo]
 * @returns {Einrichtung}
 */
function leseEinrichtung(text, wo = DATEI) {
  const doc = YAML.parseDocument(text, { uniqueKeys: true })
  if (doc.errors.length > 0) {
    const fehler = doc.errors[0]
    const zeile = fehler.linePos?.[0]?.line
    const doppelt =
      fehler.code === 'DUPLICATE_KEY' ? wasDoppeltSteht(text) : null
    throw new Error(
      `${wo}: kein gültiges YAML${zeile ? ` (Zeile ${zeile})` : ''}${
        doppelt ? ` - ${doppelt}` : ''
      }`
    )
  }
  return pruefeEinrichtung(doc.toJS(), wo)
}

/**
 * Legt die Einrichtung eines Raums über die Belegung aus seinem Modell.
 * `bekannt`: alle Plätze, die das Modell hat (auch die mit neutraler Ware);
 * `produkte`: alle Produkt-IDs, die es in hq gibt. Wirft bei einem
 * unbekannten Platz oder Produkt.
 *
 * - Plätze des Modells behalten ihre Reihenfolge; ihre Einträge werden
 *   ersetzt (`quelle: 'einrichtung'`) oder fallen weg (`leer`).
 * - Plätze, die im Modell kein Produkt tragen (neutrale Ware), kommen
 *   dahinter, nach Name sortiert.
 * @param {{ slots: BelegungEintrag[] }} modell
 * @param {Record<string, Eintrag> | undefined} einrichtung
 * @param {{ raum: string, bekannt: Iterable<string>, produkte: Iterable<string> }} o
 * @returns {{ slots: BelegungEintrag[], leer: string[], geaendert: number }}
 */
function wendeAn(modell, einrichtung, o) {
  const eintraege = einrichtung ?? {}
  const bekannt = new Set(o.bekannt)
  for (const s of modell.slots) bekannt.add(s.slot)
  const produkte = new Set(o.produkte)
  const fehler = []
  for (const [slot, eintrag] of Object.entries(eintraege)) {
    if (!bekannt.has(slot)) {
      fehler.push(`den Platz "${slot}" gibt es im Modell nicht`)
    } else if (eintrag !== LEER && !produkte.has(eintrag.produkt)) {
      fehler.push(
        `das Produkt "${eintrag.produkt}" auf Platz "${slot}" gibt es in hq nicht (oder es ist nicht verfügbar)`
      )
    }
  }
  if (fehler.length > 0) {
    throw new Error(
      `${DATEI}: Raum ${o.raum}: ${fehler.join('; ')}. Nichts geschrieben.`
    )
  }
  const hat = (slot) => Object.prototype.hasOwnProperty.call(eintraege, slot)
  /** @type {BelegungEintrag[]} */
  const slots = []
  const leer = []
  const imModell = new Set()
  for (const s of modell.slots) {
    imModell.add(s.slot)
    if (!hat(s.slot)) {
      slots.push(s)
      continue
    }
    const e = eintraege[s.slot]
    if (e === LEER) leer.push(s.slot)
    else {
      slots.push({
        slot: s.slot,
        produkt: e.produkt,
        anzahl: e.anzahl,
        quelle: 'einrichtung',
      })
    }
  }
  for (const slot of Object.keys(eintraege).sort()) {
    if (imModell.has(slot)) continue
    const e = eintraege[slot]
    if (e === LEER) leer.push(slot)
    else {
      slots.push({
        slot,
        produkt: e.produkt,
        anzahl: e.anzahl,
        quelle: 'einrichtung',
      })
    }
  }
  return { slots, leer: leer.sort(), geaendert: Object.keys(eintraege).length }
}

/** Derselbe Eintrag? */
function gleicherEintrag(a, b) {
  if (a === undefined || b === undefined) return a === b
  if (a === LEER || b === LEER) return a === b
  return a.produkt === b.produkt && a.anzahl === b.anzahl
}

/** Dieselbe Einrichtung? Ein Raum ohne Plätze zählt wie ein fehlender. */
function gleicheEinrichtung(a, b) {
  const raeume = new Set([...Object.keys(a.raeume), ...Object.keys(b.raeume)])
  for (const raum of raeume) {
    const x = a.raeume[raum] ?? {}
    const y = b.raeume[raum] ?? {}
    const slots = new Set([...Object.keys(x), ...Object.keys(y)])
    for (const slot of slots) {
      const hatX = Object.prototype.hasOwnProperty.call(x, slot)
      const hatY = Object.prototype.hasOwnProperty.call(y, slot)
      if (
        !gleicherEintrag(hatX ? x[slot] : undefined, hatY ? y[slot] : undefined)
      ) {
        return false
      }
    }
  }
  return true
}

/**
 * Ändert die Datei **im Text**: Nur die Zeichen der betroffenen Einträge
 * werden ersetzt, eingefügt oder entfernt; jede andere Zeile bleibt Byte für
 * Byte (Kommentare, Abstände, Leerzeilen, Zeilenenden). `null`, wenn die
 * Datei dafür zu ungewöhnlich gebaut ist (Fluss-Schreibweise `{…}`, ein neuer
 * oder leer werdender Raum, uneinheitlicher Einzug) - dann schreibt der
 * Aufrufer sie über das YAML-Dokument neu.
 * @param {string} text
 * @param {[string, string, Eintrag | null][]} wirksam
 * @returns {string | null}
 */
function aendereImText(text, wirksam) {
  const doc = YAML.parseDocument(text, { uniqueKeys: true })
  if (doc.errors.length > 0) return null
  const oben = doc.contents
  if (!YAML.isMap(oben) || oben.flow) return null
  const raeume = oben.get('raeume', true)
  if (!YAML.isMap(raeume) || raeume.flow) return null

  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const zeilenAnfang = (o) => text.lastIndexOf('\n', o - 1) + 1
  const zeilenEnde = (o) => {
    const e = text.indexOf('\n', o)
    return e < 0 ? text.length : e + 1
  }
  /** Ein schlichter Skalar mit bekannter Stelle im Text. */
  const schlicht = (n) =>
    YAML.isScalar(n) && Array.isArray(n.range) && !n.anchor && !n.tag
  /** Ende des Inhalts eines Werts (ohne Kommentar dahinter). */
  const inhaltEnde = (wert) => {
    if (YAML.isMap(wert)) {
      const letztes = wert.items.at(-1)
      return letztes ? inhaltEnde(letztes.value) : null
    }
    return schlicht(wert) ? wert.range[1] : null
  }

  /** @type {{ von: number, bis: number, text: string, name: string }[]} */
  const schnitte = []
  const jeRaum = new Map()
  for (const [raum, slot, neu] of wirksam) {
    if (!jeRaum.has(raum)) jeRaum.set(raum, [])
    jeRaum.get(raum).push([slot, neu])
  }
  for (const [raum, aenderungen] of jeRaum) {
    const raumPaar = raeume.items.find((p) => String(p.key?.value) === raum)
    const map = raumPaar?.value
    if (!YAML.isMap(map) || map.flow || map.items.length === 0) return null
    if (!map.items.every((p) => schlicht(p.key))) return null
    const spalte = (paar) => paar.key.range[0] - zeilenAnfang(paar.key.range[0])
    const einzug = spalte(map.items[0])
    if (!map.items.every((p) => spalte(p) === einzug)) return null
    const innen = ' '.repeat(einzug + 2)

    /** Anfang eines Eintrags samt der Kommentarzeilen direkt über ihm. */
    const blockAnfang = (paar) => {
      let a = zeilenAnfang(paar.key.range[0])
      while (a > 0) {
        const davor = zeilenAnfang(a - 1)
        const zeile = text.slice(davor, a).replace(/\r?\n$/, '')
        const leer = zeile.length - zeile.trimStart().length
        if (!zeile.trimStart().startsWith('#') || leer !== einzug) break
        a = davor
      }
      return a
    }
    const blockEnde = (paar) => {
      const ende = inhaltEnde(paar.value)
      return ende === null ? null : zeilenEnde(ende)
    }
    const eintragText = (slot, e) =>
      e === LEER
        ? `${' '.repeat(einzug)}${slot}: ${LEER}${eol}`
        : `${' '.repeat(einzug)}${slot}:${eol}${innen}produkt: ${
            e.produkt
          }${eol}${innen}anzahl: ${e.anzahl}${eol}`

    const namen = map.items.map((p) => String(p.key.value))
    const sortiert = namen.every((n, i) => i === 0 || namen[i - 1] < n)
    let bleiben = map.items.length
    for (const [slot, neu] of aenderungen) {
      const paar = map.items.find((p) => String(p.key.value) === slot)
      if (!paar) {
        if (neu === null) continue
        bleiben += 1
        // Neu: nach Name einsortiert, wenn die Datei sortiert ist - sonst ans Ende.
        const danach = sortiert
          ? map.items.find((p) => String(p.key.value) > slot)
          : undefined
        const letztes = map.items.at(-1)
        const von = danach ? blockAnfang(danach) : blockEnde(letztes)
        if (von === null) return null
        const ohneZeilenende = von > 0 && text[von - 1] !== '\n'
        schnitte.push({
          von,
          bis: von,
          text: (ohneZeilenende ? eol : '') + eintragText(slot, neu),
          name: slot,
        })
        continue
      }
      const ende = inhaltEnde(paar.value)
      if (ende === null) return null
      if (neu === null) {
        bleiben -= 1
        schnitte.push({
          von: blockAnfang(paar),
          bis: zeilenEnde(ende),
          text: '',
          name: slot,
        })
      } else if (neu === LEER) {
        // Produkt → leer: Der Block des Eintrags wird zu einem Wort.
        schnitte.push({
          von: paar.key.range[1],
          bis: ende,
          text: `: ${LEER}`,
          name: slot,
        })
      } else if (YAML.isMap(paar.value)) {
        // Nur die geänderten Werte - Kommentare im und am Eintrag bleiben.
        if (paar.value.flow) return null
        for (const feld of ['produkt', 'anzahl']) {
          const wert = paar.value.get(feld, true)
          if (!schlicht(wert)) return null
          if (wert.value !== neu[feld]) {
            schnitte.push({
              von: wert.range[0],
              bis: wert.range[1],
              text: String(neu[feld]),
              name: slot,
            })
          }
        }
      } else {
        // leer → Produkt: Aus dem Wort wird ein Block.
        schnitte.push({
          von: paar.key.range[1],
          bis: ende,
          text: `:${eol}${innen}produkt: ${neu.produkt}${eol}${innen}anzahl: ${neu.anzahl}`,
          name: slot,
        })
      }
    }
    // Ein Raum, der leer würde, verschwindet ganz - das macht der andere Weg.
    if (bleiben === 0) return null
  }

  // Von hinten nach vorn; an derselben Stelle erst entfernen, dann einfügen
  // (spätere Namen zuerst, damit die früheren davor landen).
  schnitte.sort(
    (a, b) =>
      b.von - a.von ||
      b.bis - b.von - (a.bis - a.von) ||
      (a.name < b.name ? 1 : a.name > b.name ? -1 : 0)
  )
  let out = text
  let grenze = Infinity
  for (const s of schnitte) {
    if (s.bis > grenze) return null
    out = out.slice(0, s.von) + s.text + out.slice(s.bis)
    grenze = s.von
  }
  return out
}

/**
 * Ändert den Text einer `einrichtung.yaml` und gibt den neuen Text zurück.
 * `aenderungen`: je Raum und Platz ein Eintrag - oder `null`: Der Platz
 * verschwindet aus der Datei (wieder wie im Modell).
 *
 * Was garantiert ist:
 * - **Ohne wirksame Änderung kommt der Text Zeichen für Zeichen zurück** -
 *   auch wenn eine „Änderung“ nur wiederholt, was schon dasteht.
 * - **Mit Änderung bleibt jede andere Zeile Byte für Byte** (Kommentare,
 *   Abstände, Leerzeilen, Zeilenenden `\n` oder `\r\n`): Geändert wird im
 *   Text, nicht über ein neu geschriebenes Dokument (`aendereImText`).
 *   - Produkt oder Stückzahl eines Eintrags: nur diese Werte; Kommentare im
 *     und am Eintrag bleiben. Ändern und zurückändern ergibt wieder genau den
 *     Ausgangstext.
 *   - `leer` ↔ Produkt: Der Eintrag wird neu geschrieben; ein Kommentar am
 *     Zeilenende bleibt, Kommentare zwischen `produkt` und `anzahl` gehen
 *     verloren (es gibt die Zeilen nicht mehr).
 *   - Entfernen: der Eintrag samt der Kommentarzeilen direkt über ihm (sie
 *     gehören zu ihm). Es bleibt keine leere Zeile zurück.
 *   - Neu: nach Name einsortiert, wenn die Plätze des Raums sortiert sind,
 *     sonst ans Ende; im Einzug und mit dem Zeilenende der Datei.
 * - **Nur wenn die Datei dafür zu ungewöhnlich gebaut ist** - leer, ein neuer
 *   Raum, ein Raum verliert seinen letzten Platz, Fluss-Schreibweise `{…}`,
 *   uneinheitlicher Einzug - wird sie über das YAML-Dokument neu geschrieben:
 *   Inhalt, Reihenfolge und Kommentare bleiben, Abstände und Zeilenenden
 *   werden vereinheitlicht. Eine leere Datei bekommt einen Kopf.
 * @param {string} text
 * @param {Record<string, Record<string, Eintrag | null>>} aenderungen
 * @returns {string}
 */
function aendereEinrichtung(text, aenderungen) {
  const alt = leseEinrichtung(text)
  /** @type {[string, string, Eintrag | null][]} */
  const wirksam = []
  /** @type {Einrichtung} */
  const soll = { raeume: {} }
  for (const [raum, plaetze] of Object.entries(alt.raeume)) {
    soll.raeume[raum] = { ...plaetze }
  }
  for (const [raum, plaetze] of Object.entries(aenderungen)) {
    if (!RAUM_ID.test(raum)) throw new Error(`"${raum}" ist keine Raum-ID`)
    for (const [slot, neu] of Object.entries(plaetze)) {
      if (!PLATZ_ID.test(slot)) throw new Error(`"${slot}" ist kein Platz`)
      const geprueft =
        neu === null ? null : pruefeEintrag(neu, `Raum ${raum}, ${slot}`)
      const vorher = alt.raeume[raum]?.[slot]
      if (gleicherEintrag(vorher, geprueft ?? undefined)) continue
      wirksam.push([raum, slot, geprueft])
      soll.raeume[raum] = soll.raeume[raum] ?? {}
      if (geprueft === null) delete soll.raeume[raum][slot]
      else soll.raeume[raum][slot] = geprueft
    }
  }
  if (wirksam.length === 0) return text

  // Erst im Text - und nur, wenn das Ergebnis nachweislich das Gewollte sagt.
  const imText = aendereImText(text, wirksam)
  if (imText !== null) {
    try {
      if (gleicheEinrichtung(leseEinrichtung(imText), soll)) return imText
    } catch {
      /* dann über das Dokument */
    }
  }

  const neuAngelegt = text.trim() === ''
  const doc = neuAngelegt
    ? new YAML.Document({ raeume: {} })
    : YAML.parseDocument(text)
  if (neuAngelegt) doc.commentBefore = KOPF
  if (!YAML.isMap(doc.contents)) doc.contents = doc.createNode({ raeume: {} })
  if (!YAML.isMap(doc.get('raeume'))) doc.set('raeume', doc.createNode({}))
  const raeume = /** @type {import('yaml').YAMLMap} */ (doc.get('raeume'))
  // Immer Block-Schreibweise, auch wenn die Datei `raeume: {}` enthielt.
  raeume.flow = false

  for (const [raum, slot, neu] of wirksam) {
    let plaetze = raeume.get(raum)
    if (!YAML.isMap(plaetze)) {
      if (neu === null) continue
      plaetze = doc.createNode({})
      raeume.set(raum, plaetze)
    }
    const map = /** @type {import('yaml').YAMLMap} */ (plaetze)
    map.flow = false
    if (neu === null) {
      map.delete(slot)
      continue
    }
    const vorhanden = map.get(slot, true)
    if (neu !== LEER && YAML.isMap(vorhanden)) {
      // Werte setzen statt den Eintrag zu ersetzen: Seine Kommentare bleiben.
      vorhanden.flow = false
      vorhanden.set('produkt', neu.produkt)
      vorhanden.set('anzahl', neu.anzahl)
      continue
    }
    const wert = doc.createNode(neu)
    if (vorhanden !== undefined) {
      // Kommentare am alten Wert wandern an den neuen.
      if (YAML.isNode(vorhanden) && YAML.isNode(wert)) {
        wert.comment = vorhanden.comment
        wert.commentBefore = vorhanden.commentBefore
      }
      map.set(slot, wert)
      continue
    }
    // Neu: nach Name einsortiert, wenn die Datei schon sortiert ist - sonst ans Ende.
    const namen = map.items.map((paar) => String(paar.key))
    const sortiert = namen.every((n, i) => i === 0 || namen[i - 1] < n)
    const at = sortiert ? namen.findIndex((n) => n > slot) : -1
    const paar = doc.createPair(slot, wert)
    if (at < 0) map.items.push(paar)
    else map.items.splice(at, 0, paar)
  }
  // Räume ohne Plätze bleiben nicht als leere Hülle stehen.
  for (const paar of [...raeume.items]) {
    if (YAML.isMap(paar.value) && paar.value.items.length === 0) {
      raeume.delete(paar.key)
    }
  }
  if (raeume.items.length === 0) raeume.flow = true
  return doc.toString({ lineWidth: 0 })
}

/**
 * Die Datei für einen Stand, der nur aus der Belegung bekannt ist (die
 * Einträge mit `quelle: 'einrichtung'` und die leeren Plätze): neu angelegt,
 * mit Kopf, Räume und Plätze nach Name.
 * @param {Einrichtung} einrichtung
 * @returns {string}
 */
function schreibeEinrichtung(einrichtung) {
  /** @type {Record<string, Record<string, Eintrag | null>>} */
  const alles = {}
  for (const raum of Object.keys(einrichtung.raeume).sort()) {
    alles[raum] = {}
    for (const slot of Object.keys(einrichtung.raeume[raum]).sort()) {
      alles[raum][slot] = einrichtung.raeume[raum][slot]
    }
  }
  return aendereEinrichtung('', alles)
}

module.exports = {
  DATEI,
  LEER,
  MAX_ANZAHL,
  aendereEinrichtung,
  aendereImText,
  leereEinrichtung,
  leseEinrichtung,
  pruefeEinrichtung,
  schreibeEinrichtung,
  wendeAn,
}
