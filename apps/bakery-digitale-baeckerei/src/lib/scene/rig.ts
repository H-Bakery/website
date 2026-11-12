/**
 * Kamera-Rig, der rechnende Teil: fester Standort, Umschauen in Grenzen mit
 * weichem Zurückfedern, Zoom über den Öffnungswinkel, Gleiten zwischen
 * Blickpunkten. Reine Rechnung ohne DOM und ohne three (rig.spec.ts); Zeiger,
 * Tasten und die Kamera selbst hängen in rigControls.ts daran.
 *
 * Winkel intern in Bogenmaß, Öffnungswinkel (fov) in Grad wie in three.
 * Blickrichtung: `yaw` um die Hochachse (0 = +z, wachsend nach links),
 * `pitch` nach oben.
 */
import type { Blickpunkt, Vec3 } from '../../config/raeume'
import { capHorizontalFov, horizontalFov, istHochformat } from './view'

const GRAD = Math.PI / 180

/** Dauer des Gleitens zwischen zwei Blickpunkten (Plan: ≈ 0,8 s). */
export const WECHSEL_MS = 800
/** Dauer des Heranzoomens beim Doppeltipp. */
export const ZOOM_MS = 350
/** Doppeltipp zoomt auf diesen Anteil des weitesten Öffnungswinkels. */
export const ZOOM_ANTEIL = 0.5
/** Mindestens so viel Grad unter der Startweite, damit ein Bild als gezoomt gilt. */
export const ZOOM_EPS = 0.5

/** Was einem Schwenk bis zu seinem Ziel fehlt (rad), weil die Grenze ihn kürzt. */
export interface Schwenkrest {
  yaw: number
  pitch: number
}
/** So weit lässt sich über die Grenze hinausziehen (Gummiband), höchstens. */
export const GUMMI_WEICH = 6 * GRAD
/** Zeitkonstante des Zurückfederns. */
export const FEDER_TAU_MS = 90
/** Ab hier gilt das Zurückfedern als angekommen. */
export const FEDER_EPS = 0.02 * GRAD

/** Tipp oder Ziehen: Bewegung und Dauer. */
export const TIPP_MAX_PX = 8
export const TIPP_MAX_MS = 500
export const DOPPELTIPP_MS = 320
export const DOPPELTIPP_PX = 32
/** Wischen mit zwei Fingern: Mindestweg und wie stark sich der Abstand ändern darf. */
export const WISCH_MIN_PX = 56
export const WISCH_MAX_SPREIZUNG = 0.2

/** Blickrichtung und Öffnungswinkel an einem Standort. */
export interface Pose {
  eye: Vec3
  yaw: number
  pitch: number
  /** Senkrechter Öffnungswinkel in Grad. */
  fov: number
}

/** Was an einem Blickpunkt bei einem Seitenverhältnis gilt. */
export interface Rahmen {
  eye: Vec3
  /** Mitte der Grenzen des Umschauens (meist zugleich die Ruhelage). */
  yaw0: number
  pitch0: number
  /** Ruhelage (Startbild) als Abweichung von dieser Mitte, in den Grenzen. */
  startYaw: number
  startPitch: number
  /** Start-Öffnungswinkel in Grad. */
  fov: number
  fovMin: number
  fovMax: number
  /** Umschauen bei weitestem Winkel: ± so viel um die Ruhelage. */
  yawMax: number
  pitchMax: number
  hochformat: boolean
}

/** Winkel nach (−π, π]. */
export function wickeln(winkel: number): number {
  const w = winkel % (2 * Math.PI)
  if (w > Math.PI) return w - 2 * Math.PI
  if (w <= -Math.PI) return w + 2 * Math.PI
  return w
}

export function klemmen(wert: number, min: number, max: number): number {
  return Math.min(Math.max(wert, min), max)
}

/** Blickrichtung vom Standort zu einem Punkt. */
export function richtung(
  eye: Vec3,
  look: Vec3
): { yaw: number; pitch: number } {
  const dx = look[0] - eye[0]
  const dy = look[1] - eye[1]
  const dz = look[2] - eye[2]
  const waagerecht = Math.hypot(dx, dz)
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, waagerecht) }
}

/** Punkt in `abstand` Metern in Blickrichtung - das Ziel für `camera.lookAt`. */
export function blickziel(
  eye: Vec3,
  yaw: number,
  pitch: number,
  abstand = 1
): Vec3 {
  const c = Math.cos(pitch) * abstand
  return [
    eye[0] + Math.sin(yaw) * c,
    eye[1] + Math.sin(pitch) * abstand,
    eye[2] + Math.cos(yaw) * c,
  ]
}

/**
 * Standort, Ruhelage und Grenzen eines Blickpunkts für ein Seitenverhältnis.
 * Hochformat (aspect < 1) nimmt die eigenen Werte, falls vorhanden; der
 * waagerechte Winkel bleibt begrenzt (view.ts, `capHorizontalFov`).
 */
export function rahmenFuer(blickpunkt: Blickpunkt, aspect: number): Rahmen {
  const hochformat = istHochformat(aspect)
  const p = hochformat ? blickpunkt.portrait : undefined
  const eye = p ? p.eye : blickpunkt.eye
  const look = p ? p.look : blickpunkt.look
  const start = p ? p.fov : blickpunkt.fov
  const weit = p ? p.fovMax ?? p.fov : blickpunkt.fovMax
  const eng = p ? p.fovMin ?? blickpunkt.fovMin : blickpunkt.fovMin
  const fovMax = capHorizontalFov(Math.max(weit, eng), aspect)
  const fovMin = Math.min(eng, fovMax)
  const ruhe = richtung(eye, look)
  const { yaw, pitch } = p?.grenzenUm ? richtung(eye, p.grenzenUm) : ruhe
  const yawMax = Math.abs(p?.yawDeg ?? blickpunkt.yawDeg) * GRAD
  const pitchMax = Math.abs(p?.pitchDeg ?? blickpunkt.pitchDeg) * GRAD
  return {
    eye,
    yaw0: yaw,
    pitch0: pitch,
    startYaw: klemmen(wickeln(ruhe.yaw - yaw), -yawMax, yawMax),
    startPitch: klemmen(ruhe.pitch - pitch, -pitchMax, pitchMax),
    fov: klemmen(start, fovMin, fovMax),
    fovMin,
    fovMax,
    yawMax,
    pitchMax,
    hochformat,
  }
}

/**
 * Grenzen des Umschauens beim Öffnungswinkel `fov`. Herangezoomt darf man um
 * so viel weiter schwenken, wie das Bild schmaler geworden ist: So bleibt
 * alles erreichbar, was im weitesten Winkel zu sehen ist, und man sieht nie
 * mehr als dort - also auch nie durch eine Wand.
 */
export function grenzen(
  rahmen: Rahmen,
  fov: number,
  aspect: number
): { yaw: number; pitch: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const f = klemmen(fov, rahmen.fovMin, rahmen.fovMax)
  const waagerecht =
    ((horizontalFov(rahmen.fovMax, a) - horizontalFov(f, a)) / 2) * GRAD
  const senkrecht = ((rahmen.fovMax - f) / 2) * GRAD
  return {
    yaw: rahmen.yawMax + Math.max(0, waagerecht),
    pitch: rahmen.pitchMax + Math.max(0, senkrecht),
  }
}

/**
 * Gummiband: Innerhalb ± `grenze` unverändert, darüber immer zäher - der
 * angezeigte Wert nähert sich `grenze + weich`, erreicht es aber nie.
 */
export function gummiband(wert: number, grenze: number, weich: number): number {
  const betrag = Math.abs(wert)
  if (betrag <= grenze) return wert
  if (weich <= 0) return Math.sign(wert) * grenze
  const ueber = betrag - grenze
  return Math.sign(wert) * (grenze + (weich * ueber) / (ueber + weich))
}

/** Umkehrung von `gummiband`: der gezogene Wert zu einem angezeigten. */
export function gummibandInvers(
  angezeigt: number,
  grenze: number,
  weich: number
): number {
  const betrag = Math.abs(angezeigt)
  if (betrag <= grenze || weich <= 0) return angezeigt
  const u = Math.min(betrag - grenze, weich * 0.999)
  return Math.sign(angezeigt) * (grenze + (u * weich) / (weich - u))
}

/**
 * Ein Zeitschritt Zurückfedern: Ein Wert jenseits der Grenze läuft weich auf
 * die Grenze zu und rastet dort ein. Werte innerhalb bleiben, wie sie sind.
 */
export function federSchritt(
  wert: number,
  grenze: number,
  dtMs: number,
  tauMs: number = FEDER_TAU_MS
): number {
  const betrag = Math.abs(wert)
  if (betrag <= grenze) return wert
  const rest = (betrag - grenze) * Math.exp(-Math.max(0, dtMs) / tauMs)
  return Math.sign(wert) * (rest < FEDER_EPS ? grenze : grenze + rest)
}

/** Weiches Anfahren und Abbremsen, 0…1 → 0…1. */
export function easeInOutCubic(t: number): number {
  const x = klemmen(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Pose zwischen zwei Posen, `e` = 0…1; die Drehung nimmt den kurzen Weg. */
export function mischePose(von: Pose, nach: Pose, e: number): Pose {
  const m = (a: number, b: number) => a + (b - a) * e
  return {
    eye: [
      m(von.eye[0], nach.eye[0]),
      m(von.eye[1], nach.eye[1]),
      m(von.eye[2], nach.eye[2]),
    ],
    yaw: von.yaw + wickeln(nach.yaw - von.yaw) * e,
    pitch: m(von.pitch, nach.pitch),
    fov: m(von.fov, nach.fov),
  }
}

/** War das ein Tipp? Kaum bewegt, kurz, ein Finger. */
export function istTipp(g: {
  wegPx: number
  dauerMs: number
  mehrfinger?: boolean
}): boolean {
  return !g.mehrfinger && g.wegPx <= TIPP_MAX_PX && g.dauerMs <= TIPP_MAX_MS
}

/** Folgt dieser Tipp dem vorigen schnell und nah genug für einen Doppeltipp? */
export function istDoppeltipp(
  vorher: { x: number; y: number; zeit: number } | null,
  jetzt: { x: number; y: number; zeit: number }
): boolean {
  if (!vorher) return false
  const dt = jetzt.zeit - vorher.zeit
  return (
    dt >= 0 &&
    dt <= DOPPELTIPP_MS &&
    Math.hypot(jetzt.x - vorher.x, jetzt.y - vorher.y) <= DOPPELTIPP_PX
  )
}

/**
 * Zwei Finger: War das ein waagerechtes Wischen (Blickpunkt wechseln) statt
 * eines Pinch? `dx`/`dy` = Weg des Mittelpunkts der Finger. Wischen nach
 * links blättert weiter (+1), nach rechts zurück (−1).
 */
export function zweiFingerWisch(g: {
  dx: number
  dy: number
  abstandStart: number
  abstandEnde: number
}): -1 | 1 | null {
  if (g.abstandStart <= 0) return null
  const spreizung = Math.abs(g.abstandEnde / g.abstandStart - 1)
  if (spreizung > WISCH_MAX_SPREIZUNG) return null
  if (Math.abs(g.dx) < WISCH_MIN_PX) return null
  if (Math.abs(g.dx) < 2 * Math.abs(g.dy)) return null
  return g.dx < 0 ? 1 : -1
}

interface Fahrt {
  art: 'wechsel' | 'zoom'
  von: Pose
  nach: Pose
  ms: number
  dauer: number
}

/** Der Zustand des Rigs, ohne DOM: Eingaben hinein, Pose heraus. */
export interface RigKern {
  /** Zum Blickpunkt: gleiten (≈ 0,8 s) oder schneiden. Der erste wird immer geschnitten. */
  setBlickpunkt(blickpunkt: Blickpunkt, opts?: { animate?: boolean }): void
  /** Neues Seitenverhältnis: wählt Hoch-/Querformat-Werte, hält die Grenzen. */
  resize(aspect: number): void
  /** Ziehen: Die Blickrichtung um so viel drehen (Bogenmaß). */
  ziehen(dYaw: number, dPitch: number): void
  /** Finger weg: jenseits der Grenze federt der Blick zurück. */
  loslassen(): void
  /** Öffnungswinkel mal `faktor` (< 1 = heran). */
  zoomen(faktor: number): void
  /** Öffnungswinkel direkt setzen (Pinch), in den Grenzen. */
  setzeFov(fov: number): void
  /** Heranzoomen und zum Punkt drehen, in den Grenzen. */
  zoomTo(world: Vec3): void
  /** Näher als in der Startweite (auch: gerade auf dem Weg dorthin)? */
  istGezoomt(): boolean
  /** Zurück zur Startweite; die Blickrichtung bleibt, soweit die Grenzen es zulassen. */
  zoomZurueck(): void
  /**
   * Den Blick weich um so viel drehen (Bogenmaß, wie `ziehen`), in den
   * Grenzen - z. B. damit ein gewähltes Produkt nicht unter der Karte liegt.
   * Liefert, wie viel (rad) die Grenze vom Schwenk abgeschnitten hat (0 =
   * ganz ausgeführt), oder `null`, wenn er gerade ruht (Wechsel, kein
   * Blickpunkt, unbrauchbare Werte).
   */
  schwenken(dYaw: number, dPitch: number): Schwenkrest | null
  /** Zeit läuft: Gleiten und Zurückfedern. `true`, solange sich noch etwas bewegt. */
  schritt(dtMs: number): boolean
  bewegt(): boolean
  /** Gleitet gerade zu einem anderen Blickpunkt (Eingaben ruhen so lange). */
  wechselt(): boolean
  /** Die aktuelle Pose, oder `null` vor dem ersten Blickpunkt. */
  pose(): Pose | null
  rahmen(): Rahmen | null
  /** Der Blickpunkt, an dem das Rig seit dem letzten Aufruf angekommen ist. */
  nimmAnkunft(): Blickpunkt | null
}

export function createRigKern(o: { reducedMotion: boolean }): RigKern {
  const weich = o.reducedMotion ? 0 : GUMMI_WEICH
  let blickpunkt: Blickpunkt | null = null
  let aspect = 1
  let rahmen: Rahmen | null = null
  /** Abweichung von der Ruhelage; beim Ziehen der rohe (ungebremste) Wert. */
  let abYaw = 0
  let abPitch = 0
  let fov = 60
  let zieht = false
  let fahrt: Fahrt | null = null
  let ankunft: Blickpunkt | null = null

  const ruhepose = (r: Rahmen): Pose => ({
    eye: r.eye,
    yaw: r.yaw0 + r.startYaw,
    pitch: r.pitch0 + r.startPitch,
    fov: r.fov,
  })

  /** Ab diesem Öffnungswinkel gilt das Bild als herangezoomt (Doppeltipp). */
  const zoomSchwelle = (r: Rahmen): number => {
    const ziel = klemmen(r.fovMax * ZOOM_ANTEIL, r.fovMin, r.fovMax)
    return Math.min((r.fov + ziel) / 2, r.fov - ZOOM_EPS)
  }

  const aktuellePose = (): Pose | null => {
    if (!rahmen) return null
    if (fahrt) {
      return mischePose(
        fahrt.von,
        fahrt.nach,
        easeInOutCubic(fahrt.ms / fahrt.dauer)
      )
    }
    const g = grenzen(rahmen, fov, aspect)
    // Beim Ziehen bremst das Gummiband; losgelassen federt der Wert selbst.
    return {
      eye: rahmen.eye,
      yaw: rahmen.yaw0 + (zieht ? gummiband(abYaw, g.yaw, weich) : abYaw),
      pitch:
        rahmen.pitch0 + (zieht ? gummiband(abPitch, g.pitch, weich) : abPitch),
      fov,
    }
  }

  /** Eine Zoom-Fahrt abbrechen und dort weitermachen, wo sie gerade ist. */
  const uebernimmFahrt = () => {
    if (!rahmen || !fahrt || fahrt.art !== 'zoom') return
    const p = aktuellePose()
    fahrt = null
    if (!p) return
    abYaw = wickeln(p.yaw - rahmen.yaw0)
    abPitch = p.pitch - rahmen.pitch0
    fov = p.fov
  }

  /** Ziel einer laufenden Zoom-Fahrt neu in die Grenzen legen (`fov` = Ziel). */
  const zielDerFahrtAnpassen = () => {
    if (!rahmen || !fahrt || fahrt.art !== 'zoom') return
    const g = grenzen(rahmen, fov, aspect)
    abYaw = klemmen(abYaw, -g.yaw, g.yaw)
    abPitch = klemmen(abPitch, -g.pitch, g.pitch)
    fahrt.nach = {
      eye: rahmen.eye,
      yaw: rahmen.yaw0 + abYaw,
      pitch: rahmen.pitch0 + abPitch,
      fov,
    }
  }

  const ohneBewegungKlemmen = () => {
    if (!rahmen || !o.reducedMotion || zieht) return
    const g = grenzen(rahmen, fov, aspect)
    abYaw = klemmen(abYaw, -g.yaw, g.yaw)
    abPitch = klemmen(abPitch, -g.pitch, g.pitch)
  }

  const ausserhalb = (): boolean => {
    if (!rahmen) return false
    const g = grenzen(rahmen, fov, aspect)
    return Math.abs(abYaw) > g.yaw || Math.abs(abPitch) > g.pitch
  }

  /**
   * Am Standort weich zu einer Blickrichtung und einem Öffnungswinkel fahren
   * (beides in die Grenzen geklemmt); ohne Bewegung: schneiden.
   */
  const fahreZu = (zielYaw: number, zielPitch: number, zielFov: number) => {
    if (!rahmen || fahrt?.art === 'wechsel') return
    if (zieht) {
      const g0 = grenzen(rahmen, fov, aspect)
      abYaw = gummiband(abYaw, g0.yaw, weich)
      abPitch = gummiband(abPitch, g0.pitch, weich)
      zieht = false
    }
    const von = aktuellePose()
    if (!von) return
    const f = klemmen(zielFov, rahmen.fovMin, rahmen.fovMax)
    const g = grenzen(rahmen, f, aspect)
    abYaw = klemmen(zielYaw, -g.yaw, g.yaw)
    abPitch = klemmen(zielPitch, -g.pitch, g.pitch)
    fov = f
    if (o.reducedMotion) {
      fahrt = null
      return
    }
    fahrt = {
      art: 'zoom',
      von,
      nach: {
        eye: rahmen.eye,
        yaw: rahmen.yaw0 + abYaw,
        pitch: rahmen.pitch0 + abPitch,
        fov: f,
      },
      ms: 0,
      dauer: ZOOM_MS,
    }
  }

  const kern: RigKern = {
    setBlickpunkt(neu, opts) {
      const ziel = rahmenFuer(neu, aspect)
      const von = aktuellePose()
      blickpunkt = neu
      rahmen = ziel
      abYaw = ziel.startYaw
      abPitch = ziel.startPitch
      fov = ziel.fov
      zieht = false
      if (!von || o.reducedMotion || opts?.animate === false) {
        fahrt = null
        ankunft = neu
        return
      }
      fahrt = {
        art: 'wechsel',
        von,
        nach: ruhepose(ziel),
        ms: 0,
        dauer: WECHSEL_MS,
      }
    },

    resize(neu) {
      aspect = neu
      if (!blickpunkt || !rahmen) return
      const alt = rahmen
      rahmen = rahmenFuer(blickpunkt, aspect)
      if (fahrt?.art === 'wechsel') {
        fahrt.nach = ruhepose(rahmen)
        fov = rahmen.fov
        return
      }
      const andererStand =
        alt.hochformat !== rahmen.hochformat ||
        alt.eye.some((v, i) => v !== (rahmen as Rahmen).eye[i]) ||
        alt.yaw0 !== rahmen.yaw0 ||
        alt.pitch0 !== rahmen.pitch0 ||
        alt.startYaw !== rahmen.startYaw ||
        alt.startPitch !== rahmen.startPitch
      if (andererStand) {
        // Hoch ↔ quer hat eigene Werte: in dessen Ruhelage schneiden.
        fahrt = null
        abYaw = rahmen.startYaw
        abPitch = rahmen.startPitch
        fov = rahmen.fov
        zieht = false
        return
      }
      // Wer ganz weit oder in der Startweite war, bleibt es auch im neuen Format.
      // (Während einer Zoom-Fahrt ist `fov` schon deren Ziel.)
      if (Math.abs(fov - alt.fov) < 1e-6) fov = rahmen.fov
      else if (Math.abs(fov - alt.fovMax) < 1e-6) fov = rahmen.fovMax
      else fov = klemmen(fov, rahmen.fovMin, rahmen.fovMax)
      if (fahrt) {
        // Eine Zoom- oder Schwenk-Fahrt läuft weiter - nur ihr Ziel muss in
        // die Grenzen des neuen Formats passen. Sonst bliebe sie mittendrin
        // stehen (halb gezoomt, halb gedreht).
        zielDerFahrtAnpassen()
        return
      }
      ohneBewegungKlemmen()
    },

    ziehen(dYaw, dPitch) {
      if (!rahmen || fahrt?.art === 'wechsel') return
      uebernimmFahrt()
      const g = grenzen(rahmen, fov, aspect)
      if (!zieht) {
        // Mitten im Zurückfedern gegriffen: ohne Sprung weiterziehen.
        abYaw = gummibandInvers(abYaw, g.yaw, weich)
        abPitch = gummibandInvers(abPitch, g.pitch, weich)
        zieht = true
      }
      abYaw += dYaw
      abPitch += dPitch
      if (o.reducedMotion) {
        abYaw = klemmen(abYaw, -g.yaw, g.yaw)
        abPitch = klemmen(abPitch, -g.pitch, g.pitch)
      }
    },

    loslassen() {
      if (!rahmen || !zieht) return
      const g = grenzen(rahmen, fov, aspect)
      abYaw = gummiband(abYaw, g.yaw, weich)
      abPitch = gummiband(abPitch, g.pitch, weich)
      zieht = false
    },

    zoomen(faktor) {
      if (!Number.isFinite(faktor) || faktor <= 0) return
      kern.setzeFov((fahrt?.art === 'zoom' ? fahrt.nach.fov : fov) * faktor)
    },

    setzeFov(neu) {
      if (!rahmen || fahrt?.art === 'wechsel' || !Number.isFinite(neu)) return
      const von = fahrt ? aktuellePose() : null
      fov = klemmen(neu, rahmen.fovMin, rahmen.fovMax)
      if (fahrt) {
        // Mitten in einer Zoom- oder Schwenk-Fahrt: Die Drehung läuft zu
        // ihrem Ziel weiter, nur der Öffnungswinkel bekommt ein neues. Die
        // Fahrt setzt dafür ohne Sprung an der Pose von eben neu an.
        const rest = Math.max(fahrt.dauer - fahrt.ms, ZOOM_MS / 4)
        fahrt.von = von ?? fahrt.von
        fahrt.ms = 0
        fahrt.dauer = rest
        zielDerFahrtAnpassen()
        return
      }
      ohneBewegungKlemmen()
    },

    zoomTo(world) {
      if (!rahmen || fahrt?.art === 'wechsel') return
      const dx = world[0] - rahmen.eye[0]
      const dy = world[1] - rahmen.eye[1]
      const dz = world[2] - rahmen.eye[2]
      if (![dx, dy, dz].every(Number.isFinite)) return
      if (Math.hypot(dx, dy, dz) < 1e-6) return
      kern.loslassen()
      const von = aktuellePose()
      if (!von) return
      const zielFov = klemmen(
        Math.min(von.fov, rahmen.fovMax * ZOOM_ANTEIL),
        rahmen.fovMin,
        rahmen.fovMax
      )
      const r = richtung(rahmen.eye, world)
      const g = grenzen(rahmen, zielFov, aspect)
      abYaw = klemmen(wickeln(r.yaw - rahmen.yaw0), -g.yaw, g.yaw)
      abPitch = klemmen(r.pitch - rahmen.pitch0, -g.pitch, g.pitch)
      fov = zielFov
      if (o.reducedMotion) {
        fahrt = null
        return
      }
      fahrt = {
        art: 'zoom',
        von,
        nach: {
          eye: rahmen.eye,
          yaw: rahmen.yaw0 + abYaw,
          pitch: rahmen.pitch0 + abPitch,
          fov: zielFov,
        },
        ms: 0,
        dauer: ZOOM_MS,
      }
    },

    istGezoomt() {
      if (!rahmen) return false
      const ziel = fahrt?.art === 'zoom' ? fahrt.nach.fov : fov
      // Nicht schon nach einem Hauch Pinch: Erst etwa auf halbem Weg zur
      // Doppeltipp-Weite zoomt der nächste Doppeltipp zurück statt heran.
      return ziel <= zoomSchwelle(rahmen)
    },

    zoomZurueck() {
      if (!rahmen || fahrt?.art === 'wechsel') return
      const ziel = fahrt?.art === 'zoom' ? fahrt.nach.fov : fov
      if (ziel >= rahmen.fov) return
      fahreZu(abYaw, abPitch, rahmen.fov)
    },

    schwenken(dYaw, dPitch) {
      if (!rahmen || !Number.isFinite(dYaw) || !Number.isFinite(dPitch)) {
        return null
      }
      if (fahrt?.art === 'wechsel') return null
      // Ziel einer laufenden Fahrt als Ausgangspunkt, sonst der Stand jetzt.
      const g = grenzen(rahmen, fov, aspect)
      const yaw = zieht ? gummiband(abYaw, g.yaw, weich) : abYaw
      const pitch = zieht ? gummiband(abPitch, g.pitch, weich) : abPitch
      const zielYaw = yaw + dYaw
      const zielPitch = pitch + dPitch
      fahreZu(zielYaw, zielPitch, fov)
      // Was die Grenze abgeschnitten hat.
      return { yaw: zielYaw - abYaw, pitch: zielPitch - abPitch }
    },

    schritt(dtMs) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0
      if (fahrt) {
        fahrt.ms += dt
        if (fahrt.ms >= fahrt.dauer) {
          if (fahrt.art === 'wechsel') ankunft = blickpunkt
          fahrt = null
        }
        return kern.bewegt()
      }
      if (rahmen && !zieht) {
        const g = grenzen(rahmen, fov, aspect)
        abYaw = federSchritt(abYaw, g.yaw, dt)
        abPitch = federSchritt(abPitch, g.pitch, dt)
      }
      return kern.bewegt()
    },

    bewegt() {
      return fahrt !== null || (!zieht && ausserhalb())
    },

    wechselt() {
      return fahrt?.art === 'wechsel'
    },

    pose: aktuellePose,

    rahmen() {
      return rahmen
    },

    nimmAnkunft() {
      const a = ankunft
      ankunft = null
      return a
    },
  }
  return kern
}
