/**
 * Plätze der Einrichtung (DB12): Aus der Ware, die im Modell eines Raums auf
 * einem Platz liegt (Knoten `produkt/<slot>`), den **Rahmen des Platzes**
 * ableiten - wo er steht, wohin „rechts“, „oben“ und „vorn“ zeigen, wie breit
 * und tief er ist. Auf diese Rahmen legt die App die leichten Regal-Modelle
 * (auslage.js). Reine Logik ohne Dateisystem und ohne three; getestet in
 * plaetze.spec.ts. CommonJS, nur Node-Bordmittel.
 *
 * Das Modell bringt keine Rahmen mit: Jeder Knoten liegt ungedreht im Rahmen
 * der Szene, die Plätze des Explorers (`catalogue/slots.json`) sind nicht
 * veröffentlicht. Abgeleitet wird darum aus der Geometrie - so, wie der
 * Explorer die Ware hingelegt hat (`build/bh_twin/auslage.py`,
 * `products/fill.py`; github.com/Open-Kirrberg/saar-lidar-explorer, MIT,
 * gleicher Urheber):
 *
 * - **Richtung:** Die Plätze eines Möbelteils (`brotregal/ebene-1`) liegen in
 *   einer Reihe. „Rechts“ ist die lange Seite des kleinsten Rechtecks um ihre
 *   Ware (Draufsicht). Ein Möbelteil mit nur einem Platz (ein Korb) oder ohne
 *   klare lange Seite nimmt die Richtung der Ebene darüber (`brotregal/koerbe`).
 * - **Neigung:** Brote stehen auf geneigten Stangenböden. Gesucht wird die
 *   Neigung, bei der die meisten Eckpunkte in der Standfläche liegen (die
 *   Ware steht mit flachem Boden auf).
 * - **Vorn** ist bei geneigten Flächen die tiefe Seite, sonst die Seite, an
 *   der die Ware liegt (der Explorer füllt von vorn). Die App prüft das noch
 *   einmal gegen den Standort des Blickpunkts.
 * - **Breite:** bis zur Mitte der Lücke zum Nachbarn; am Rand so breit wie
 *   die Plätze dazwischen. **Tiefe:** was die Ware der Reihe einnimmt.
 *   **Höhe:** bis zur nächsten Fläche darüber im selben Möbel.
 * - **Haken** (Brezelständer): je Platz ein eigener Rahmen aus der hängenden
 *   Brezel - „oben“ im Rahmen ist die Richtung des Arms.
 *
 * Die App kennt damit nur so viel Platz, wie die Ware des Modells einnimmt:
 * Liegt im Modell nur vorn eine Reihe, ist der Platz für die App so tief wie
 * diese Reihe.
 */

const { TRAEGER_MATERIALIEN } = require('./auslage')

/**
 * Wie die Ware auf einem Platz liegt - nach dem Namen des Möbelteils, wie im
 * Explorer (`fill.slot_mode`): am Brezelständer hängt sie, in den Körben
 * liegt sie gehäuft, sonst in Reihen.
 * @param {string} slot
 * @returns {'reihen' | 'korb' | 'haken'}
 */
function artVon(slot) {
  const teile = slot.split('/')
  if (teile.includes('brezelstaender')) return 'haken'
  if (teile.includes('koerbe')) return 'korb'
  return 'reihen'
}

/** Rand zwischen der Lücke zum Nachbarn und dem Platz (m). */
const RAND_M = 0.005
/** Plätze, deren Standflächen so nah beieinander liegen, bilden eine Reihe (m). */
const REIHE_TOLERANZ_M = 0.025
/** Eckpunkte so nah an der tiefsten Ebene zählen zur Standfläche (m). */
const STANDFLAECHE_M = 0.002
/** Kantenlänge der Kästchen, in denen die Standfläche gezählt wird (m). */
const KAESTCHEN_M = 0.015
/** Ab dieser Neigung entscheidet das Gefälle, wo vorn ist (Grad). */
const GEFAELLE_GRAD = 3
/** Luft zwischen der Ware und dem Boden darüber (m). */
const BODEN_DARUEBER_M = 0.03
/** Lichte Höhe ohne Fläche darüber (m). */
const HOEHE_OFFEN_M = 0.3
/** Halbe Lücke zwischen einem Tablett und dem Nachbarplatz (m). */
const TRAEGER_RAND_M = 0.01
/** So dick ist ein Tablett höchstens (m). */
const TRAEGER_DICKE_M = 0.012
/** Ein Raster gilt, wenn jede Grenze so nah an ihrer Lücke liegt (m). */
const RASTER_TOLERANZ_M = 0.012
/** Ohne Raster: Luft neben der Ware, mindestens und als Anteil ihrer Breite. */
const LUFT_MIN_M = 0.05
const LUFT_ANTEIL = 0.5
/** Ware, die so knapp in der Tiefe des Nachbarn liegt, übernimmt sie (m). */
const TIEFE_TOLERANZ_M = 0.015
/** Böden desselben Möbels, deren Richtung so wenig abweicht, teilen sie (Grad). */
const GESCHWISTER_GRAD = 8

/**
 * @typedef {[number, number, number]} V3
 * @typedef {{
 *   slot: string,
 *   punkte: ArrayLike<number>,
 *   traeger?: ArrayLike<number> | null,
 * }} PlatzWare  Eckpunkte (x, y, z hintereinander, Rahmen der Szene) der Ware und des Tabletts
 * @typedef {{
 *   o: V3, r: V3, n: V3, f: V3,
 *   b: number, t: number, h: number,
 *   art: 'reihen' | 'korb' | 'haken',
 *   neigung: number,
 *   traeger?: true,
 * }} Platz  Mitte der Standfläche, Achsen rechts/oben/vorn (Einheitsvektoren), Breite, Tiefe, lichte Höhe (m), Neigung (Grad)
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const runde = (v, stellen = 4) => {
  const f = 10 ** stellen
  const r = Math.round(v * f) / f
  return r === 0 ? 0 : r
}
const median = (werte) => {
  if (werte.length === 0) return 0
  const s = [...werte].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Konvexe Hülle von Punkten [x, z] (Andrew). */
function huelle(punkte) {
  const p = [...punkte].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const kreuz = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const unten = []
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten.at(-2), unten.at(-1), q) <= 0) {
      unten.pop()
    }
    unten.push(q)
  }
  const oben = []
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const q = p[i]
    while (oben.length >= 2 && kreuz(oben.at(-2), oben.at(-1), q) <= 0) {
      oben.pop()
    }
    oben.push(q)
  }
  unten.pop()
  oben.pop()
  return unten.concat(oben)
}

/**
 * Das kleinste Rechteck um Punkte [x, z]: Richtung der langen Seite
 * (Einheitsvektor), lange und kurze Seite. Eine Seite des Rechtecks liegt
 * immer auf einer Kante der Hülle.
 * @param {number[][]} punkte
 * @returns {{ lang: [number, number], laenge: number, breite: number } | null}
 */
function kleinstesRechteck(punkte) {
  const h = huelle(punkte)
  if (h.length < 2) return null
  let best = null
  for (let i = 0; i < h.length; i += 1) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    if (len < 1e-9) continue
    const ux = dx / len
    const uz = dz / len
    let u0 = Infinity
    let u1 = -Infinity
    let v0 = Infinity
    let v1 = -Infinity
    for (const q of h) {
      const u = q[0] * ux + q[1] * uz
      const v = -q[0] * uz + q[1] * ux
      if (u < u0) u0 = u
      if (u > u1) u1 = u
      if (v < v0) v0 = v
      if (v > v1) v1 = v
    }
    const su = u1 - u0
    const sv = v1 - v0
    const flaeche = su * sv
    if (best === null || flaeche < best.flaeche - 1e-12) {
      best =
        su >= sv
          ? { flaeche, lang: [ux, uz], laenge: su, breite: sv }
          : { flaeche, lang: [-uz, ux], laenge: sv, breite: su }
    }
  }
  if (!best) return null
  return { lang: best.lang, laenge: best.laenge, breite: best.breite }
}

/** Alle Eckpunkte einer Ware (mit Tablett) als Liste von V3. */
function allePunkte(ware) {
  const out = []
  for (const feld of [ware.punkte, ware.traeger]) {
    if (!feld) continue
    for (let i = 0; i + 2 < feld.length; i += 3) {
      out.push([feld[i], feld[i + 1], feld[i + 2]])
    }
  }
  return out
}

const elternVon = (pfad) => {
  const cut = pfad.lastIndexOf('/')
  return cut < 0 ? '' : pfad.slice(0, cut)
}

/** Ab diesem Seitenverhältnis gilt die lange Seite als eindeutig. */
const EINDEUTIG = 1.3

/**
 * Leitet die Rahmen aller Plätze eines Raums ab. Plätze ohne Eckpunkte
 * fehlen im Ergebnis.
 * @param {PlatzWare[]} waren
 * @returns {Record<string, Platz>}
 */
function leitePlaetzeAb(waren) {
  /** @type {Map<string, { slot: string, pts: V3[], traeger: V3[], inhalt: V3[] }>} */
  const jeSlot = new Map()
  for (const ware of waren) {
    const pts = allePunkte(ware)
    if (pts.length === 0 || jeSlot.has(ware.slot)) continue
    const traeger = allePunkte({ punkte: ware.traeger ?? [] })
    const inhalt = allePunkte({ punkte: ware.punkte })
    jeSlot.set(ware.slot, { slot: ware.slot, pts, traeger, inhalt })
  }
  /** @type {Record<string, Platz>} */
  const plaetze = {}

  // --- Haken: je Platz ein Rahmen aus dem hängenden Stück --------------------
  for (const { slot, pts } of jeSlot.values()) {
    if (artVon(slot) !== 'haken') continue
    const rect = kleinstesRechteck(pts.map((p) => [p[0], p[2]]))
    if (!rect) continue
    // Das Stück hängt flach: lange Seite = seine Breite, kurze = der Arm.
    const r = /** @type {V3} */ ([rect.lang[0], 0, rect.lang[1]])
    const arm = /** @type {V3} */ ([-rect.lang[1], 0, rect.lang[0]])
    const unten = /** @type {V3} */ ([0, -1, 0])
    let r0 = Infinity
    let r1 = -Infinity
    let a0 = Infinity
    let a1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const p of pts) {
      const u = dot(p, r)
      const a = dot(p, arm)
      if (u < r0) r0 = u
      if (u > r1) r1 = u
      if (a < a0) a0 = a
      if (a > a1) a1 = a
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
    const mu = (r0 + r1) / 2
    const ma = (a0 + a1) / 2
    plaetze[slot] = {
      // Oberkante des hängenden Stücks, mittig: dort hängt das neue ein.
      o: [
        runde(r[0] * mu + arm[0] * ma),
        runde(y1),
        runde(r[2] * mu + arm[2] * ma),
      ],
      r: [runde(r[0], 5), 0, runde(r[2], 5)],
      n: [runde(arm[0], 5), 0, runde(arm[2], 5)],
      f: unten,
      b: runde(r1 - r0),
      t: runde(y1 - y0),
      h: runde(a1 - a0),
      art: 'haken',
      neigung: 0,
    }
  }

  // --- Reihen und Körbe -------------------------------------------------------
  const liegend = [...jeSlot.values()].filter((s) => artVon(s.slot) !== 'haken')
  /** Möbelteile: Plätze mit demselben Pfad bis auf den letzten Abschnitt. */
  const teile = new Map()
  /** Plätze je Pfad-Anfang (`brotregal`, `brotregal/ebene-1` …). */
  const unter = new Map()
  for (const s of liegend) {
    const teil = elternVon(s.slot)
    if (!teile.has(teil)) teile.set(teil, [])
    teile.get(teil).push(s)
    for (let pfad = teil; ; pfad = elternVon(pfad)) {
      if (!unter.has(pfad)) unter.set(pfad, [])
      unter.get(pfad).push(s)
      if (pfad === '') break
    }
  }

  /** Das kleinste Rechteck um alle Plätze unter einem Pfad; `klar`: mit eindeutiger langer Seite. */
  const rechteckVon = new Map()
  const rechteck = (pfad) => {
    if (rechteckVon.has(pfad)) return rechteckVon.get(pfad)
    const slots = unter.get(pfad) ?? []
    const rect = kleinstesRechteck(
      slots.flatMap((s) => s.pts.map((p) => [p[0], p[2]]))
    )
    const out = rect
      ? {
          ...rect,
          klar:
            slots.length >= 2 &&
            rect.laenge >= EINDEUTIG * Math.max(rect.breite, 1e-6),
        }
      : null
    rechteckVon.set(pfad, out)
    return out
  }
  /** Winkel einer Richtung in der Draufsicht, 0…180° (eine Seite hat kein Vorzeichen). */
  const winkel = (lang) => {
    const w = (Math.atan2(lang[1], lang[0]) * 180) / Math.PI
    return ((w % 180) + 180) % 180
  }
  const abstand = (a, b) => {
    const d = Math.abs(a - b) % 180
    return Math.min(d, 180 - d)
  }
  const richtungVon = new Map()
  /**
   * Richtung „rechts“ (Draufsicht) eines Möbelteils. Ohne klare lange Seite:
   * die der Ebene darüber. Mit klarer: Weicht sie nur wenig von den
   * Geschwistern ab (die Böden einer Vitrine), gilt deren Mitte - ein
   * einzelner Boden mit versetzter Ware verzieht sein Rechteck leicht.
   */
  const richtung = (pfad) => {
    if (richtungVon.has(pfad)) return richtungVon.get(pfad)
    const rect = rechteck(pfad)
    let out
    if (!rect) out = [1, 0]
    else if (!rect.klar && pfad !== '') out = richtung(elternVon(pfad))
    else {
      out = rect.lang
      const eltern = elternVon(pfad)
      if (pfad !== '' && eltern !== '') {
        const eigen = winkel(rect.lang)
        const geschwister = [...teile.keys()]
          .filter((p) => elternVon(p) === eltern)
          .map((p) => rechteck(p))
          .filter((r) => r && r.klar)
          .map((r) => ({ lang: r.lang, w: winkel(r.lang) }))
          .filter((r) => abstand(r.w, eigen) < GESCHWISTER_GRAD)
        if (geschwister.length >= 3) {
          // Mitte der Abweichungen vom eigenen Winkel (alle liegen nah beieinander).
          const diff = geschwister
            .map((g) => {
              let d = g.w - eigen
              if (d > 90) d -= 180
              if (d < -90) d += 180
              return d
            })
            .sort((a, b) => a - b)
          const ziel = ((eigen + median(diff)) * Math.PI) / 180
          out = [Math.cos(ziel), Math.sin(ziel)]
        }
      }
    }
    richtungVon.set(pfad, out)
    return out
  }

  /** @type {{ slot: string, moebel: string, platz: Platz, hoch: number }[]} */
  const fertig = []
  for (const [pfad, slots] of teile) {
    const lang = richtung(pfad)
    let r = /** @type {V3} */ ([lang[0], 0, lang[1]])
    let f0 = /** @type {V3} */ ([-lang[1], 0, lang[0]])

    // Neigung: Bei welcher liegen die meisten Eckpunkte in der Standfläche?
    // Gezählt werden nicht Eckpunkte (dicht belegte Ware überstimmte sonst
    // alles), sondern die Kästchen der Standfläche, die sie belegen.
    const punkteIn = (grad) => {
      const t = (grad * Math.PI) / 180
      const n = [f0[0] * Math.sin(t), Math.cos(t), f0[2] * Math.sin(t)]
      const ft = [f0[0] * Math.cos(t), -Math.sin(t), f0[2] * Math.cos(t)]
      let treffer = 0
      for (const s of slots) {
        let tief = Infinity
        const h = s.pts.map((p) => dot(p, n))
        for (const v of h) if (v < tief) tief = v
        const felder = new Set()
        s.pts.forEach((p, i) => {
          if (h[i] - tief >= STANDFLAECHE_M) return
          felder.add(
            `${Math.round(dot(p, r) / KAESTCHEN_M)}:${Math.round(
              dot(p, ft) / KAESTCHEN_M
            )}`
          )
        })
        treffer += felder.size
      }
      return treffer
    }
    let neigung = 0
    let best = punkteIn(0)
    const suche = (von, bis, schritt) => {
      for (let g = von; g <= bis + 1e-9; g += schritt) {
        const wert = punkteIn(g)
        if (
          wert > best ||
          (wert === best && Math.abs(g) < Math.abs(neigung) - 1e-9)
        ) {
          best = wert
          neigung = g
        }
      }
    }
    suche(-40, 40, 1)
    const grob = neigung
    suche(grob - 1, grob + 1, 0.1)

    // Wo ist vorn? Geneigt: die tiefe Seite.
    let vornKlar = false
    if (Math.abs(neigung) >= GEFAELLE_GRAD) {
      vornKlar = true
      if (neigung < 0) {
        f0 = [-f0[0], 0, -f0[2]]
        r = [-r[0], 0, -r[2]]
        neigung = -neigung
      }
    } else if (Math.abs(neigung) < 0.5) {
      neigung = 0
    }
    const t = (neigung * Math.PI) / 180
    const n = /** @type {V3} */ ([
      f0[0] * Math.sin(t),
      Math.cos(t),
      f0[2] * Math.sin(t),
    ])
    let f = /** @type {V3} */ ([
      f0[0] * Math.cos(t),
      -Math.sin(t),
      f0[2] * Math.cos(t),
    ])

    // Ausdehnung der Ware je Platz im Rahmen des Möbelteils.
    const masse = slots.map((s) => {
      const m = {
        s,
        u0: Infinity,
        u1: -Infinity,
        f0: Infinity,
        f1: -Infinity,
        n0: Infinity,
        n1: -Infinity,
        stand: 0,
        traeger: false,
        /** Mitte der Ware selbst (ohne Tablett) in der Tiefe. */
        mitteF: 0,
      }
      for (const p of s.pts) {
        const u = dot(p, r)
        const v = dot(p, f)
        const w = dot(p, n)
        if (u < m.u0) m.u0 = u
        if (u > m.u1) m.u1 = u
        if (v < m.f0) m.f0 = v
        if (v > m.f1) m.f1 = v
        if (w < m.n0) m.n0 = w
        if (w > m.n1) m.n1 = w
      }
      // Ein Tablett ist flach und liegt ganz unten: Die Ware steht darauf.
      // (Schwarze Deckel von Gläsern und Flaschen sind kein Tablett.)
      m.stand = m.n0
      if (s.traeger.length > 0) {
        let t0 = Infinity
        let t1 = -Infinity
        for (const p of s.traeger) {
          const w = dot(p, n)
          if (w < t0) t0 = w
          if (w > t1) t1 = w
        }
        if (t1 - t0 <= TRAEGER_DICKE_M && t0 - m.n0 < STANDFLAECHE_M) {
          m.traeger = true
          m.stand = t1
        }
      }
      const ware = m.traeger && s.inhalt.length > 0 ? s.inhalt : s.pts
      let c0 = Infinity
      let c1 = -Infinity
      for (const p of ware) {
        const v = dot(p, f)
        if (v < c0) c0 = v
        if (v > c1) c1 = v
      }
      m.mitteF = (c0 + c1) / 2
      return m
    })

    // Flach: vorn ist, wo die Ware liegt (der Explorer füllt von vorn).
    if (!vornKlar) {
      const g0 = Math.min(...masse.map((m) => m.f0))
      const g1 = Math.max(...masse.map((m) => m.f1))
      const mitte = (g0 + g1) / 2
      const hang =
        masse.reduce((sum, m) => sum + (m.mitteF - mitte), 0) / masse.length
      if (hang < -0.005) {
        // Nur die Achsen in der Fläche drehen sich - „oben“ bleibt.
        r = [-r[0], 0, -r[2]]
        f = [-f[0], -f[1], -f[2]]
        neigung = -neigung
        for (const m of masse) {
          ;[m.u0, m.u1] = [-m.u1, -m.u0]
          ;[m.f0, m.f1] = [-m.f1, -m.f0]
        }
      }
    }

    // Reihen: Plätze auf derselben Standfläche.
    masse.sort((a, b) => a.n0 - b.n0)
    const reihen = []
    for (const m of masse) {
      const letzte = reihen.at(-1)
      if (letzte && m.n0 - letzte[0].n0 < REIHE_TOLERANZ_M) letzte.push(m)
      else reihen.push([m])
    }
    for (const reihe of reihen) {
      reihe.sort((a, b) => a.u0 + a.u1 - (b.u0 + b.u1))
      const kanten = breiten(reihe)
      const tiefen = tiefenVon(reihe)
      reihe.forEach((m, i) => {
        const [links, rechts] = kanten[i]
        const [hinten, vorn] = tiefen[i]
        const mu = (links + rechts) / 2
        const mf = (vorn + hinten) / 2
        const o = [0, 1, 2].map((k) => r[k] * mu + f[k] * mf + n[k] * m.stand)
        /** @type {Platz} */
        const platz = {
          o: /** @type {V3} */ (o.map((v) => runde(v))),
          r: /** @type {V3} */ (r.map((v) => runde(v, 5))),
          n: /** @type {V3} */ (n.map((v) => runde(v, 5))),
          f: /** @type {V3} */ (f.map((v) => runde(v, 5))),
          b: runde(Math.max(rechts - links, 0.01)),
          t: runde(Math.max(vorn - hinten, 0.01)),
          h: 0,
          art: artVon(m.s.slot),
          neigung: runde(neigung, 1),
        }
        if (m.traeger) platz.traeger = true
        fertig.push({
          slot: m.s.slot,
          moebel: m.s.slot.split('/')[0],
          hoch: m.n1 - m.stand,
          platz,
        })
      })
    }
  }

  // Lichte Höhe: bis zur nächsten Standfläche darüber im selben Möbel.
  for (const a of fertig) {
    let frei = Infinity
    for (const b of fertig) {
      if (b === a || b.moebel !== a.moebel) continue
      const dy = b.platz.o[1] - a.platz.o[1]
      if (dy < 0.05) continue
      frei = Math.min(frei, dy * a.platz.n[1] - BODEN_DARUEBER_M)
    }
    a.platz.h = runde(
      Math.max(Number.isFinite(frei) ? frei : HOEHE_OFFEN_M, a.hoch)
    )
    plaetze[a.slot] = a.platz
  }
  return plaetze
}

/**
 * Linke und rechte Kante jedes Platzes einer Reihe (sortiert von links nach
 * rechts), schon ohne den Rand zur Lücke.
 *
 * Die Grenze zwischen zwei Nachbarn liegt irgendwo in der Lücke zwischen
 * ihrer Ware. Passt ein gleichmäßiges Raster in alle Lücken (Brotregal:
 * vierzehn gleich breite Plätze), gilt das Raster - auch für die Plätze am
 * Rand. Sonst (Vitrine: verschieden breite Felder) liegt die Grenze in der
 * Mitte der Lücke, aber höchstens `luft` neben der Ware: Auf einer fast
 * leeren Fläche wächst ein Platz nicht bis zum fernen Nachbarn.
 * @param {{ u0: number, u1: number, traeger?: boolean }[]} reihe
 * @returns {[number, number][]}
 */
function breiten(reihe) {
  const anzahl = reihe.length
  if (anzahl === 1) {
    return [[reihe[0].u0, reihe[0].u1]]
  }
  const luecken = []
  for (let i = 0; i + 1 < anzahl; i += 1) {
    luecken.push([reihe[i].u1, reihe[i + 1].u0])
  }
  // Ein Tablett füllt seinen Platz: Die Grenze liegt dann direkt daneben.
  const mitten = luecken.map(([a, b], i) => {
    const links = reihe[i].traeger === true
    const rechts = reihe[i + 1].traeger === true
    if (links === rechts || b - a < 2 * TRAEGER_RAND_M) return (a + b) / 2
    return links ? a + TRAEGER_RAND_M : b - TRAEGER_RAND_M
  })

  // Raster: Ausgleichsgerade durch die Mitten der Lücken.
  if (anzahl >= 4) {
    const k = mitten.length
    const mk = (k - 1) / 2
    const mm = mitten.reduce((a, b) => a + b, 0) / k
    let zaehler = 0
    let nenner = 0
    mitten.forEach((m, i) => {
      zaehler += (i - mk) * (m - mm)
      nenner += (i - mk) * (i - mk)
    })
    const schritt = zaehler / nenner
    const start = mm - schritt * mk
    const raster = (i) => start + schritt * i
    const passt =
      schritt > 0 &&
      luecken.every(([a, b], i) => {
        const g = raster(i)
        return (
          g >= Math.min(a, b) - RASTER_TOLERANZ_M &&
          g <= Math.max(a, b) + RASTER_TOLERANZ_M
        )
      }) &&
      reihe[0].u0 >= raster(-1) - RASTER_TOLERANZ_M &&
      reihe[anzahl - 1].u1 <= raster(anzahl - 1) + RASTER_TOLERANZ_M
    if (passt) {
      return reihe.map((_, i) => [raster(i - 1) + RAND_M, raster(i) - RAND_M])
    }
  }

  const luft = (m) => Math.max(LUFT_MIN_M, LUFT_ANTEIL * (m.u1 - m.u0))
  const innen = []
  for (let i = 1; i + 1 < anzahl; i += 1) innen.push(mitten[i] - mitten[i - 1])
  const typisch = median(innen)
  return reihe.map((m, i) => {
    const max = luft(m)
    let links
    let rechts
    if (i > 0) links = Math.max(mitten[i - 1] + RAND_M, m.u0 - max)
    if (i < anzahl - 1) rechts = Math.min(mitten[i] - RAND_M, m.u1 + max)
    // Am Rand: so viel Luft wie zur anderen Seite, höchstens so breit wie
    // die Plätze dazwischen - und nie schmaler als die Ware.
    if (links === undefined) {
      const gespiegelt = m.u0 - (rechts - m.u1)
      const wieInnen = typisch > 0 ? rechts - typisch : gespiegelt
      links = Math.min(m.u0, Math.max(gespiegelt, wieInnen, m.u0 - max))
    }
    if (rechts === undefined) {
      const gespiegelt = m.u1 + (m.u0 - links)
      const wieInnen = typisch > 0 ? links + typisch : gespiegelt
      rechts = Math.max(m.u1, Math.min(gespiegelt, wieInnen, m.u1 + max))
    }
    return [Math.min(links, m.u0), Math.max(rechts, m.u1)]
  })
}

/**
 * Hintere und vordere Kante jedes Platzes einer Reihe. Jeder Platz ist so
 * tief wie seine eigene Ware; liegt die ganz innerhalb der Tiefe eines
 * Nachbarn (ein einzelnes Brot neben einer vollen Reihe), gilt dessen Tiefe.
 * Ein Boden mit Versatz (Vitrine) bleibt so je Feld richtig.
 * @param {{ f0: number, f1: number }[]} reihe
 * @returns {[number, number][]}
 */
function tiefenVon(reihe) {
  const out = reihe.map((m) => [m.f0, m.f1])
  const innerhalb = (a, b) =>
    a[0] >= b[0] - TIEFE_TOLERANZ_M && a[1] <= b[1] + TIEFE_TOLERANZ_M
  for (let runde_ = 0; runde_ < reihe.length; runde_ += 1) {
    let geaendert = false
    for (let i = 0; i < out.length; i += 1) {
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= out.length) continue
        const groesser = out[j][1] - out[j][0] > out[i][1] - out[i][0] + 1e-9
        if (groesser && innerhalb(out[i], out[j])) {
          out[i] = [out[j][0], out[j][1]]
          geaendert = true
        }
      }
    }
    if (!geaendert) break
  }
  return out
}

/**
 * Trennt die Geometrie eines Knotens (glb-geometrie.js) in Ware und Teile aus
 * dem Material eines Tabletts. Ob es wirklich ein Tablett ist, entscheidet
 * `leitePlaetzeAb` (flach und ganz unten).
 * @param {string} slot
 * @param {{ material: string, punkte: Float64Array }[]} teile
 * @returns {PlatzWare}
 */
function wareVon(slot, teile) {
  const sammle = (liste) => {
    const laenge = liste.reduce((n, t) => n + t.punkte.length, 0)
    const out = new Float64Array(laenge)
    let at = 0
    for (const t of liste) {
      out.set(t.punkte, at)
      at += t.punkte.length
    }
    return out
  }
  const istTraeger = (t) => TRAEGER_MATERIALIEN.includes(t.material)
  return {
    slot,
    punkte: sammle(teile.filter((t) => !istTraeger(t))),
    traeger: sammle(teile.filter(istTraeger)),
  }
}

module.exports = {
  TRAEGER_MATERIALIEN,
  artVon,
  breiten,
  kleinstesRechteck,
  leitePlaetzeAb,
  tiefenVon,
  wareVon,
}
