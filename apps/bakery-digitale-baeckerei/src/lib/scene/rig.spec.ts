import type { Blickpunkt, Vec3 } from '../../config/raeume'
import { raeume } from '../../config/raeume'
import {
  DOPPELTIPP_MS,
  FEDER_EPS,
  GUMMI_WEICH,
  TIPP_MAX_MS,
  TIPP_MAX_PX,
  WECHSEL_MS,
  WISCH_MIN_PX,
  ZOOM_ANTEIL,
  ZOOM_MS,
  blickziel,
  createRigKern,
  easeInOutCubic,
  federSchritt,
  grenzen,
  gummiband,
  gummibandInvers,
  istDoppeltipp,
  istTipp,
  mischePose,
  rahmenFuer,
  richtung,
  wickeln,
  zweiFingerWisch,
  type Pose,
  type RigKern,
} from './rig'
import { MAX_HORIZONTAL_FOV, horizontalFov } from './view'

const GRAD = Math.PI / 180
const QUER = 1440 / 900
const HOCH = 390 / 844
const BREIT = 844 / 390

/** Schaut von (0, 2, 0) nach +z; Hochformat steht woanders und schaut nach +x. */
const regal: Blickpunkt = {
  id: 'testregal',
  name: 'Testregal',
  eye: [0, 2, 0],
  look: [0, 2, 4],
  fov: 60,
  yawDeg: 20,
  pitchDeg: 12,
  fovMin: 24,
  fovMax: 60,
  portrait: { eye: [1, 2, 1], look: [5, 2, 1], fov: 70 },
  moebel: ['testregal/'],
}

const theke: Blickpunkt = {
  id: 'testtheke',
  name: 'Testtheke',
  eye: [4, 2.2, -3],
  look: [4, 1.2, -7],
  fov: 50,
  yawDeg: 15,
  pitchDeg: 10,
  fovMin: 20,
  fovMax: 64,
  moebel: ['testtheke/'],
}

function pose(kern: RigKern): Pose {
  const p = kern.pose()
  if (!p) throw new Error('keine Pose')
  return p
}

/** Lässt die Zeit laufen, bis nichts mehr geht (höchstens 5 s). */
function auslaufen(kern: RigKern, dt = 16): number {
  let ms = 0
  while (kern.schritt(dt) && ms < 5000) ms += dt
  return ms
}

function kernAm(bp: Blickpunkt, aspect = QUER, reducedMotion = false) {
  const kern = createRigKern({ reducedMotion })
  kern.resize(aspect)
  kern.setBlickpunkt(bp)
  return kern
}

describe('Winkel', () => {
  it('richtung und blickziel sind Umkehrungen', () => {
    const eye: Vec3 = [1, 2, 3]
    const look: Vec3 = [-2, 1.2, 5]
    const { yaw, pitch } = richtung(eye, look)
    const abstand = Math.hypot(-3, -0.8, 2)
    const ziel = blickziel(eye, yaw, pitch, abstand)
    ziel.forEach((v, i) => expect(v).toBeCloseTo(look[i], 9))
  })

  it('yaw 0 schaut nach +z und wächst nach links (+x)', () => {
    expect(richtung([0, 0, 0], [0, 0, 1]).yaw).toBeCloseTo(0, 9)
    expect(richtung([0, 0, 0], [1, 0, 0]).yaw).toBeCloseTo(Math.PI / 2, 9)
    expect(richtung([0, 0, 0], [0, 1, 1]).pitch).toBeCloseTo(Math.PI / 4, 9)
  })

  it('wickeln bleibt in (−π, π]', () => {
    expect(wickeln(3 * Math.PI)).toBeCloseTo(Math.PI, 9)
    expect(wickeln(-Math.PI)).toBeCloseTo(Math.PI, 9)
    expect(wickeln(350 * GRAD)).toBeCloseTo(-10 * GRAD, 9)
    expect(wickeln(0.3)).toBeCloseTo(0.3, 9)
  })
})

describe('rahmenFuer (Hoch-/Querformat)', () => {
  it('Querformat: Werte des Blickpunkts', () => {
    const r = rahmenFuer(regal, QUER)
    expect(r.hochformat).toBe(false)
    expect(r.eye).toEqual([0, 2, 0])
    expect(r.yaw0).toBeCloseTo(0, 9)
    expect(r.pitch0).toBeCloseTo(0, 9)
    expect(r.fov).toBe(60)
    expect(r.fovMin).toBe(24)
    expect(r.fovMax).toBe(60)
    expect(r.yawMax).toBeCloseTo(20 * GRAD, 9)
    expect(r.pitchMax).toBeCloseTo(12 * GRAD, 9)
  })

  it('Hochformat (aspect < 1): die eigenen Werte, weitester Winkel = deren fov', () => {
    const r = rahmenFuer(regal, HOCH)
    expect(r.hochformat).toBe(true)
    expect(r.eye).toEqual([1, 2, 1])
    expect(r.yaw0).toBeCloseTo(Math.PI / 2, 9)
    expect(r.fov).toBe(70)
    expect(r.fovMax).toBe(70)
    expect(r.fovMin).toBe(24)
  })

  it('Hochformat mit eigenen Zoom-Grenzen', () => {
    const eigen: Blickpunkt = {
      ...regal,
      portrait: {
        eye: [1, 2, 1],
        look: [5, 2, 1],
        fov: 70,
        fovMin: 30,
        fovMax: 80,
      },
    }
    const r = rahmenFuer(eigen, HOCH)
    expect([r.fovMin, r.fov, r.fovMax]).toEqual([30, 70, 80])
  })

  it('Hochformat ohne eigene Werte: wie quer', () => {
    const r = rahmenFuer(theke, HOCH)
    expect(r.hochformat).toBe(true)
    expect(r.eye).toEqual(theke.eye)
    expect(r.fov).toBe(50)
    expect(r.fovMax).toBe(64)
  })

  it('genau quadratisch zählt als Querformat', () => {
    expect(rahmenFuer(regal, 1).hochformat).toBe(false)
  })

  it('sehr breites Bild: der waagerechte Winkel bleibt begrenzt', () => {
    const r = rahmenFuer(theke, BREIT)
    expect(r.fovMax).toBeLessThan(64)
    expect(horizontalFov(r.fovMax, BREIT)).toBeCloseTo(MAX_HORIZONTAL_FOV, 6)
    expect(r.fov).toBeLessThanOrEqual(r.fovMax)
    expect(r.fovMin).toBe(20)
  })

  it('der Start-Winkel liegt immer in den Grenzen', () => {
    const schief: Blickpunkt = { ...theke, fov: 90 }
    expect(rahmenFuer(schief, QUER).fov).toBe(64)
    expect(rahmenFuer({ ...theke, fov: 5 }, QUER).fov).toBe(20)
  })
})

describe('grenzen', () => {
  const r = rahmenFuer(regal, QUER)

  it('im weitesten Winkel: genau die Grenzen des Blickpunkts', () => {
    const g = grenzen(r, 60, QUER)
    expect(g.yaw).toBeCloseTo(20 * GRAD, 9)
    expect(g.pitch).toBeCloseTo(12 * GRAD, 9)
  })

  it('herangezoomt: so viel weiter, wie das Bild schmaler wurde', () => {
    const g = grenzen(r, 30, QUER)
    expect(g.pitch).toBeCloseTo((12 + 15) * GRAD, 9)
    const rand = (fov: number, yaw: number) =>
      yaw / GRAD + horizontalFov(fov, QUER) / 2
    // Der Bildrand reicht herangezoomt genau so weit wie im weitesten Winkel.
    expect(rand(30, g.yaw)).toBeCloseTo(rand(60, 20 * GRAD), 6)
  })

  it('kommt mit unbrauchbarem Seitenverhältnis zurecht', () => {
    expect(grenzen(r, 60, Number.NaN).yaw).toBeCloseTo(20 * GRAD, 9)
  })
})

describe('gummiband', () => {
  const G = 20 * GRAD

  it('lässt Werte innerhalb der Grenze unverändert', () => {
    expect(gummiband(0.1, G, GUMMI_WEICH)).toBe(0.1)
    expect(gummiband(-G, G, GUMMI_WEICH)).toBe(-G)
  })

  it('wird jenseits der Grenze zäher und bleibt unter Grenze + weich', () => {
    const a = gummiband(G + 2 * GRAD, G, GUMMI_WEICH)
    const b = gummiband(G + 20 * GRAD, G, GUMMI_WEICH)
    const c = gummiband(G + 2000 * GRAD, G, GUMMI_WEICH)
    expect(a).toBeGreaterThan(G)
    expect(a).toBeLessThan(G + 2 * GRAD)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
    expect(c).toBeLessThan(G + GUMMI_WEICH)
  })

  it('ist stetig an der Grenze und ungerade', () => {
    expect(gummiband(G + 1e-9, G, GUMMI_WEICH)).toBeCloseTo(G, 8)
    expect(gummiband(-(G + 0.1), G, GUMMI_WEICH)).toBeCloseTo(
      -gummiband(G + 0.1, G, GUMMI_WEICH),
      12
    )
  })

  it('ohne Weichheit: harter Anschlag', () => {
    expect(gummiband(G + 1, G, 0)).toBe(G)
    expect(gummiband(-(G + 1), G, 0)).toBe(-G)
  })

  it('gummibandInvers kehrt es um', () => {
    for (const roh of [0.1, G, G + 0.03, -(G + 0.2)]) {
      const angezeigt = gummiband(roh, G, GUMMI_WEICH)
      expect(gummibandInvers(angezeigt, G, GUMMI_WEICH)).toBeCloseTo(roh, 9)
    }
  })
})

describe('federSchritt (Zurückfedern)', () => {
  const G = 20 * GRAD

  it('läuft monoton auf die Grenze zu und rastet dort ein', () => {
    let wert = G + 5 * GRAD
    let vorher = wert
    let schritte = 0
    while (wert !== G && schritte < 1000) {
      wert = federSchritt(wert, G, 16)
      expect(wert).toBeLessThan(vorher)
      expect(wert).toBeGreaterThanOrEqual(G)
      vorher = wert
      schritte += 1
    }
    expect(wert).toBe(G)
    // Weich, aber zügig: unter einer Sekunde.
    expect(schritte * 16).toBeLessThan(1000)
    expect(schritte).toBeGreaterThan(5)
  })

  it('gilt auch auf der negativen Seite', () => {
    let wert = -(G + 3 * GRAD)
    for (let i = 0; i < 200; i += 1) wert = federSchritt(wert, G, 16)
    expect(wert).toBe(-G)
  })

  it('lässt Werte innerhalb der Grenze stehen', () => {
    expect(federSchritt(0.2, G, 16)).toBe(0.2)
    expect(federSchritt(-G, G, 16)).toBe(-G)
  })

  it('ohne Zeit bewegt sich nichts', () => {
    const wert = G + 5 * GRAD
    expect(federSchritt(wert, G, 0)).toBeCloseTo(wert, 12)
  })

  it('rastet ein, sobald der Rest unter der Schwelle liegt', () => {
    expect(federSchritt(G + FEDER_EPS / 2, G, 1)).toBe(G)
  })
})

describe('Gleiten', () => {
  it('easeInOutCubic: 0 → 0, 1 → 1, Mitte 0,5, monoton, außerhalb geklemmt', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9)
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
    let vorher = 0
    for (let t = 0.05; t <= 1; t += 0.05) {
      const e = easeInOutCubic(t)
      expect(e).toBeGreaterThan(vorher)
      vorher = e
    }
  })

  it('mischePose: Endpunkte genau, Drehung auf dem kurzen Weg', () => {
    const von: Pose = { eye: [0, 0, 0], yaw: 170 * GRAD, pitch: 0, fov: 60 }
    const nach: Pose = { eye: [2, 4, 6], yaw: -170 * GRAD, pitch: 0.2, fov: 40 }
    expect(mischePose(von, nach, 0)).toEqual(von)
    const ende = mischePose(von, nach, 1)
    expect(ende.eye).toEqual([2, 4, 6])
    expect(wickeln(ende.yaw - nach.yaw)).toBeCloseTo(0, 9)
    expect(ende.fov).toBe(40)
    // 170° → −170° sind 20° über 180° hinweg, nicht 340° zurück.
    expect(mischePose(von, nach, 0.5).yaw).toBeCloseTo(180 * GRAD, 9)
  })
})

describe('RigKern: Blickpunkt setzen und wechseln', () => {
  it('hat vor dem ersten Blickpunkt keine Pose', () => {
    const kern = createRigKern({ reducedMotion: false })
    expect(kern.pose()).toBeNull()
    expect(kern.bewegt()).toBe(false)
    kern.ziehen(1, 1)
    kern.zoomen(0.5)
    kern.zoomTo([1, 2, 3])
    expect(kern.schritt(16)).toBe(false)
    expect(kern.pose()).toBeNull()
  })

  it('der erste Blickpunkt wird geschnitten und meldet die Ankunft', () => {
    const kern = kernAm(regal)
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern)).toEqual({ eye: [0, 2, 0], yaw: 0, pitch: 0, fov: 60 })
    expect(kern.nimmAnkunft()).toBe(regal)
    expect(kern.nimmAnkunft()).toBeNull()
  })

  it('ein Wechsel gleitet ≈ 0,8 s und endet genau in der Ruhelage des Ziels', () => {
    const kern = kernAm(regal)
    kern.nimmAnkunft()
    kern.setBlickpunkt(theke)
    expect(kern.bewegt()).toBe(true)
    expect(kern.wechselt()).toBe(true)
    // Start: noch die alte Pose.
    expect(pose(kern).eye).toEqual([0, 2, 0])

    kern.schritt(WECHSEL_MS / 2)
    const mitte = pose(kern)
    expect(mitte.eye[0]).toBeCloseTo(2, 6)
    expect(mitte.eye[2]).toBeCloseTo(-1.5, 6)
    expect(mitte.fov).toBeCloseTo(55, 6)
    expect(kern.nimmAnkunft()).toBeNull()

    const ms = auslaufen(kern)
    expect(WECHSEL_MS / 2 + ms).toBeGreaterThanOrEqual(WECHSEL_MS - 16)
    expect(WECHSEL_MS / 2 + ms).toBeLessThanOrEqual(WECHSEL_MS + 16)
    const ziel = rahmenFuer(theke, QUER)
    expect(pose(kern)).toEqual({
      eye: theke.eye,
      yaw: ziel.yaw0,
      pitch: ziel.pitch0,
      fov: 50,
    })
    expect(kern.bewegt()).toBe(false)
    expect(kern.wechselt()).toBe(false)
    expect(kern.nimmAnkunft()).toBe(theke)
  })

  it('der Standort bewegt sich beim Gleiten stetig (kein Sprung)', () => {
    const kern = kernAm(regal)
    kern.setBlickpunkt(theke)
    let vorher = pose(kern)
    while (kern.schritt(16)) {
      const p = pose(kern)
      const weg = Math.hypot(
        p.eye[0] - vorher.eye[0],
        p.eye[1] - vorher.eye[1],
        p.eye[2] - vorher.eye[2]
      )
      // 5,4 m in 0,8 s: je Bild höchstens ein paar Dezimeter.
      expect(weg).toBeLessThan(0.4)
      expect(Math.abs(wickeln(p.yaw - vorher.yaw))).toBeLessThan(15 * GRAD)
      vorher = p
    }
  })

  it('`animate: false` schneidet', () => {
    const kern = kernAm(regal)
    kern.nimmAnkunft()
    kern.setBlickpunkt(theke, { animate: false })
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).eye).toEqual(theke.eye)
    expect(kern.nimmAnkunft()).toBe(theke)
  })

  it('prefers-reduced-motion: geschnitten statt geglitten', () => {
    const kern = kernAm(regal, QUER, true)
    kern.nimmAnkunft()
    kern.setBlickpunkt(theke)
    expect(kern.bewegt()).toBe(false)
    expect(kern.schritt(16)).toBe(false)
    expect(pose(kern).eye).toEqual(theke.eye)
    expect(pose(kern).fov).toBe(50)
    expect(kern.nimmAnkunft()).toBe(theke)
  })

  it('während des Gleitens ruhen Ziehen, Zoom und Doppeltipp', () => {
    const kern = kernAm(regal)
    kern.setBlickpunkt(theke)
    kern.schritt(100)
    kern.ziehen(0.3, 0.3)
    kern.zoomen(0.5)
    kern.zoomTo([4, 1, -8])
    auslaufen(kern)
    const ziel = rahmenFuer(theke, QUER)
    expect(pose(kern).yaw).toBeCloseTo(ziel.yaw0, 9)
    expect(pose(kern).fov).toBe(50)
  })

  it('ein Wechsel mitten im Umschauen startet an der aktuellen Blickrichtung', () => {
    const kern = kernAm(regal)
    kern.ziehen(10 * GRAD, 0)
    kern.loslassen()
    kern.setBlickpunkt(theke)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(rahmenFuer(theke, QUER).yaw0, 9)
  })
})

describe('RigKern: Umschauen in Grenzen', () => {
  it('der Standort bleibt beim Ziehen und Zoomen fest', () => {
    const kern = kernAm(regal)
    kern.ziehen(0.2, -0.1)
    kern.zoomen(0.6)
    kern.loslassen()
    auslaufen(kern)
    expect(pose(kern).eye).toEqual([0, 2, 0])
  })

  it('innerhalb der Grenzen folgt der Blick genau', () => {
    const kern = kernAm(regal)
    kern.ziehen(10 * GRAD, -5 * GRAD)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
    expect(pose(kern).pitch).toBeCloseTo(-5 * GRAD, 9)
    kern.loslassen()
    expect(kern.bewegt()).toBe(false)
  })

  it('über die Grenze gezogen: weicher Widerstand, kein harter Anschlag', () => {
    const kern = kernAm(regal)
    kern.ziehen(25 * GRAD, 0)
    const etwas = pose(kern).yaw
    expect(etwas).toBeGreaterThan(20 * GRAD)
    expect(etwas).toBeLessThan(25 * GRAD)
    kern.ziehen(300 * GRAD, 0)
    const viel = pose(kern).yaw
    expect(viel).toBeGreaterThan(etwas)
    expect(viel).toBeLessThan(20 * GRAD + GUMMI_WEICH)
    // Solange der Finger drauf ist, federt nichts zurück.
    expect(kern.schritt(500)).toBe(false)
    expect(pose(kern).yaw).toBe(viel)
  })

  it('losgelassen federt der Blick weich auf die Grenze zurück', () => {
    const kern = kernAm(regal)
    kern.ziehen(40 * GRAD, -40 * GRAD)
    const gezogen = pose(kern)
    kern.loslassen()
    // Kein Sprung beim Loslassen.
    expect(pose(kern).yaw).toBeCloseTo(gezogen.yaw, 12)
    expect(kern.bewegt()).toBe(true)

    kern.schritt(16)
    const nach16 = pose(kern)
    expect(nach16.yaw).toBeLessThan(gezogen.yaw)
    expect(nach16.yaw).toBeGreaterThan(20 * GRAD)
    expect(nach16.pitch).toBeGreaterThan(gezogen.pitch)
    expect(nach16.pitch).toBeLessThan(-12 * GRAD)

    const ms = auslaufen(kern)
    expect(ms).toBeLessThan(1000)
    expect(pose(kern).yaw).toBeCloseTo(20 * GRAD, 12)
    expect(pose(kern).pitch).toBeCloseTo(-12 * GRAD, 12)
    expect(kern.bewegt()).toBe(false)
  })

  it('mitten im Zurückfedern gegriffen: ohne Sprung weiter', () => {
    const kern = kernAm(regal)
    kern.ziehen(40 * GRAD, 0)
    kern.loslassen()
    kern.schritt(16)
    const vorher = pose(kern).yaw
    kern.ziehen(0, 0)
    expect(pose(kern).yaw).toBeCloseTo(vorher, 9)
  })

  it('prefers-reduced-motion: harter Anschlag, nichts federt', () => {
    const kern = kernAm(regal, QUER, true)
    kern.ziehen(40 * GRAD, 40 * GRAD)
    expect(pose(kern).yaw).toBeCloseTo(20 * GRAD, 12)
    expect(pose(kern).pitch).toBeCloseTo(12 * GRAD, 12)
    kern.loslassen()
    expect(kern.bewegt()).toBe(false)
  })

  it.each(raeume.flatMap((r) => r.blickpunkte).map((b) => [b.id, b]))(
    'echter Blickpunkt %s: nach jedem Ziehen und Loslassen in den Grenzen',
    (_id, bp) => {
      for (const aspect of [QUER, HOCH, BREIT]) {
        const kern = kernAm(bp, aspect)
        const r = rahmenFuer(bp, aspect)
        for (const [dy, dp] of [
          [3, 3],
          [-3, 3],
          [3, -3],
          [-3, -3],
        ]) {
          kern.ziehen(dy, dp)
          kern.loslassen()
          auslaufen(kern)
          const p = pose(kern)
          expect(Math.abs(wickeln(p.yaw - r.yaw0))).toBeCloseTo(r.yawMax, 9)
          expect(Math.abs(p.pitch - r.pitch0)).toBeCloseTo(r.pitchMax, 9)
          const hoch = aspect < 1 ? bp.portrait : undefined
          expect(Math.abs(wickeln(p.yaw - r.yaw0)) / GRAD).toBeCloseTo(
            hoch?.yawDeg ?? bp.yawDeg,
            6
          )
        }
      }
    }
  )
})

describe('RigKern: Zoom über den Öffnungswinkel', () => {
  it('zoomen bleibt zwischen fovMin und fovMax', () => {
    const kern = kernAm(regal)
    kern.zoomen(0.5)
    expect(pose(kern).fov).toBe(30)
    kern.zoomen(0.1)
    expect(pose(kern).fov).toBe(24)
    kern.zoomen(100)
    expect(pose(kern).fov).toBe(60)
    kern.zoomen(Number.NaN)
    kern.zoomen(0)
    kern.zoomen(-2)
    expect(pose(kern).fov).toBe(60)
  })

  it('setzeFov klemmt (Pinch)', () => {
    const kern = kernAm(regal)
    kern.setzeFov(10)
    expect(pose(kern).fov).toBe(24)
    kern.setzeFov(200)
    expect(pose(kern).fov).toBe(60)
    kern.setzeFov(Number.NaN)
    expect(pose(kern).fov).toBe(60)
  })

  it('Hochformat: die Grenzen der eigenen Werte', () => {
    const kern = kernAm(regal, HOCH)
    expect(pose(kern).fov).toBe(70)
    kern.zoomen(100)
    expect(pose(kern).fov).toBe(70)
    kern.zoomen(0.01)
    expect(pose(kern).fov).toBe(24)
  })

  it('sehr breites Bild: nie weiter als die waagerechte Grenze', () => {
    const kern = kernAm(theke, BREIT)
    kern.zoomen(100)
    expect(horizontalFov(pose(kern).fov, BREIT)).toBeLessThanOrEqual(
      MAX_HORIZONTAL_FOV + 1e-6
    )
  })

  it('herangezoomt weiter schwenken, beim Herauszoomen federt der Blick zurück', () => {
    const kern = kernAm(regal)
    kern.setzeFov(30)
    const weit = grenzen(rahmenFuer(regal, QUER), 30, QUER).yaw
    expect(weit).toBeGreaterThan(20 * GRAD)
    kern.ziehen(weit, 0)
    kern.loslassen()
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).yaw).toBeCloseTo(weit, 9)

    kern.setzeFov(60)
    expect(kern.bewegt()).toBe(true)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(20 * GRAD, 12)
  })
})

describe('RigKern: zoomTo (Doppeltipp)', () => {
  it('zoomt heran und dreht zum Punkt', () => {
    const kern = kernAm(regal)
    // 10° links, 5° tiefer, 4 m weit.
    const punkt = blickziel([0, 2, 0], 10 * GRAD, -5 * GRAD, 4)
    kern.zoomTo(punkt)
    expect(kern.bewegt()).toBe(true)
    expect(kern.wechselt()).toBe(false)
    const ms = auslaufen(kern)
    expect(ms).toBeLessThanOrEqual(ZOOM_MS + 16)
    const p = pose(kern)
    expect(p.fov).toBe(60 * ZOOM_ANTEIL)
    expect(p.yaw).toBeCloseTo(10 * GRAD, 9)
    expect(p.pitch).toBeCloseTo(-5 * GRAD, 9)
    expect(p.eye).toEqual([0, 2, 0])
  })

  it('ein Punkt außerhalb der Grenzen: bis zur Grenze, nicht weiter', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 120 * GRAD, 60 * GRAD, 3))
    auslaufen(kern)
    const g = grenzen(rahmenFuer(regal, QUER), 60 * ZOOM_ANTEIL, QUER)
    expect(pose(kern).yaw).toBeCloseTo(g.yaw, 9)
    expect(pose(kern).pitch).toBeCloseTo(g.pitch, 9)
    expect(kern.bewegt()).toBe(false)
  })

  it('zoomt nie wieder heraus und nie unter fovMin', () => {
    const kern = kernAm(regal)
    kern.setzeFov(26)
    kern.zoomTo([0, 2, 4])
    auslaufen(kern)
    expect(pose(kern).fov).toBe(26)

    const eng: Blickpunkt = { ...regal, fovMin: 40 }
    const kern2 = kernAm(eng)
    kern2.zoomTo([0, 2, 4])
    auslaufen(kern2)
    expect(pose(kern2).fov).toBe(40)
  })

  it('prefers-reduced-motion: sofort am Ziel', () => {
    const kern = kernAm(regal, QUER, true)
    kern.zoomTo(blickziel([0, 2, 0], 10 * GRAD, 0, 4))
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).fov).toBe(30)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
  })

  it('Ziehen bricht die Zoom-Fahrt ab und macht dort weiter', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 10 * GRAD, 0, 4))
    kern.schritt(ZOOM_MS / 2)
    const mitte = pose(kern)
    kern.ziehen(0, 0)
    expect(pose(kern).yaw).toBeCloseTo(mitte.yaw, 9)
    expect(pose(kern).fov).toBeCloseTo(mitte.fov, 9)
    kern.loslassen()
    expect(kern.bewegt()).toBe(false)
  })

  it('ignoriert den eigenen Standort und unbrauchbare Punkte', () => {
    const kern = kernAm(regal)
    kern.zoomTo([0, 2, 0])
    kern.zoomTo([Number.NaN, 2, 0])
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).fov).toBe(60)
  })
})

describe('RigKern: zurückzoomen und schwenken', () => {
  it('istGezoomt: erst unter der Startweite, auch schon auf dem Weg dorthin', () => {
    const kern = kernAm(regal)
    expect(createRigKern({ reducedMotion: false }).istGezoomt()).toBe(false)
    expect(kern.istGezoomt()).toBe(false)
    kern.zoomTo([0, 2, 4])
    expect(kern.istGezoomt()).toBe(true)
    auslaufen(kern)
    expect(kern.istGezoomt()).toBe(true)
    kern.setzeFov(59.8)
    expect(kern.istGezoomt()).toBe(false)
  })

  it('zoomZurueck fährt zur Startweite und holt den Blick in deren Grenzen', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 120 * GRAD, 60 * GRAD, 3))
    auslaufen(kern)
    const weit = grenzen(rahmenFuer(regal, QUER), 60, QUER)
    expect(pose(kern).yaw).toBeGreaterThan(weit.yaw)

    kern.zoomZurueck()
    expect(kern.bewegt()).toBe(true)
    expect(kern.istGezoomt()).toBe(false)
    const ms = auslaufen(kern)
    expect(ms).toBeLessThanOrEqual(ZOOM_MS + 16)
    const p = pose(kern)
    expect(p.fov).toBe(60)
    expect(p.yaw).toBeCloseTo(weit.yaw, 9)
    expect(p.pitch).toBeCloseTo(weit.pitch, 9)
    expect(p.eye).toEqual([0, 2, 0])
    expect(kern.bewegt()).toBe(false)
  })

  it('zoomZurueck im Hochformat endet in dessen Startweite', () => {
    const kern = kernAm(regal, HOCH)
    kern.setzeFov(30)
    kern.zoomZurueck()
    auslaufen(kern)
    expect(pose(kern).fov).toBe(rahmenFuer(regal, HOCH).fov)
  })

  it('schwenken dreht weich, lässt Standort und Öffnungswinkel und hält die Grenzen', () => {
    const kern = kernAm(regal)
    kern.schwenken(8 * GRAD, -4 * GRAD)
    expect(kern.bewegt()).toBe(true)
    expect(pose(kern).yaw).toBeCloseTo(0, 9)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(8 * GRAD, 9)
    expect(pose(kern).pitch).toBeCloseTo(-4 * GRAD, 9)
    expect(pose(kern).fov).toBe(60)
    expect(pose(kern).eye).toEqual([0, 2, 0])

    kern.schwenken(90 * GRAD, -90 * GRAD)
    auslaufen(kern)
    const g = grenzen(rahmenFuer(regal, QUER), 60, QUER)
    expect(pose(kern).yaw).toBeCloseTo(g.yaw, 9)
    expect(pose(kern).pitch).toBeCloseTo(-g.pitch, 9)
    expect(kern.bewegt()).toBe(false)
  })

  it('schwenken während einer Zoom-Fahrt setzt an deren Ziel an', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 5 * GRAD, 0, 4))
    kern.schritt(ZOOM_MS / 2)
    kern.schwenken(3 * GRAD, 0)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(8 * GRAD, 9)
    expect(pose(kern).fov).toBe(30)
  })

  it('prefers-reduced-motion: beides schneidet', () => {
    const kern = kernAm(regal, QUER, true)
    kern.setzeFov(30)
    kern.schwenken(5 * GRAD, 0)
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).yaw).toBeCloseTo(5 * GRAD, 9)
    kern.zoomZurueck()
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).fov).toBe(60)
  })

  it('ruht während eines Blickpunkt-Wechsels und bei unbrauchbaren Werten', () => {
    const kern = kernAm(regal)
    kern.schwenken(Number.NaN, 0)
    expect(kern.bewegt()).toBe(false)
    kern.setBlickpunkt(theke)
    kern.schwenken(0.2, 0)
    kern.zoomZurueck()
    expect(kern.wechselt()).toBe(true)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(rahmenFuer(theke, QUER).yaw0, 9)
  })
})

describe('Grenzen um einen anderen Punkt als die Ruhelage (Hochformat)', () => {
  /** Startbild 10° links der Mitte der Grenzen; ± 40° statt ± 20°. */
  const schief: Blickpunkt = {
    ...regal,
    portrait: {
      eye: [0, 2, 0],
      look: blickziel([0, 2, 0], 10 * GRAD, 0, 4),
      grenzenUm: [0, 2, 4],
      fov: 70,
      yawDeg: 40,
      pitchDeg: 8,
    },
  }

  it('rahmenFuer: Mitte, Startabweichung und eigene Grenzen des Hochformats', () => {
    const r = rahmenFuer(schief, HOCH)
    expect(r.yaw0).toBeCloseTo(0, 9)
    expect(r.startYaw).toBeCloseTo(10 * GRAD, 9)
    expect(r.startPitch).toBeCloseTo(0, 9)
    expect(r.yawMax).toBeCloseTo(40 * GRAD, 9)
    expect(r.pitchMax).toBeCloseTo(8 * GRAD, 9)
    // Querformat: unverändert die Werte des Blickpunkts.
    const q = rahmenFuer(schief, QUER)
    expect(q.startYaw).toBe(0)
    expect(q.yawMax).toBeCloseTo(20 * GRAD, 9)
    expect(q.pitchMax).toBeCloseTo(12 * GRAD, 9)
  })

  it('ohne grenzenUm ist die Ruhelage die Mitte', () => {
    const r = rahmenFuer(regal, HOCH)
    expect(r.startYaw).toBe(0)
    expect(r.startPitch).toBe(0)
  })

  it('eine Ruhelage außerhalb der Grenzen wird an die Grenze geholt', () => {
    const weit: Blickpunkt = {
      ...regal,
      portrait: {
        eye: [0, 2, 0],
        look: blickziel([0, 2, 0], 50 * GRAD, 0, 4),
        grenzenUm: [0, 2, 4],
        fov: 70,
      },
    }
    expect(rahmenFuer(weit, HOCH).startYaw).toBeCloseTo(20 * GRAD, 9)
  })

  it('startet im Startbild und lässt zu einer Seite weiter schwenken als zur anderen', () => {
    const kern = kernAm(schief, HOCH)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)

    // nach links (yaw wächst): 30° bis zur Grenze
    kern.ziehen(90 * GRAD, 0)
    kern.loslassen()
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(40 * GRAD, 9)
    // nach rechts: 50° ab dem Startbild
    kern.ziehen(-180 * GRAD, 0)
    kern.loslassen()
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(-40 * GRAD, 9)
  })

  it('ein Wechsel endet im Startbild, nicht in der Mitte der Grenzen', () => {
    const kern = kernAm(theke, HOCH)
    kern.setBlickpunkt(schief)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
    expect(kern.bewegt()).toBe(false)
  })

  it('hoch ↔ quer schneidet in das Startbild des jeweiligen Formats', () => {
    const kern = kernAm(schief, QUER)
    kern.resize(HOCH)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
    kern.resize(QUER)
    expect(pose(kern).yaw).toBeCloseTo(0, 9)
  })

  it('der Laden: Theke im Hochformat startet wie bisher und reicht rechts weiter', () => {
    const t = raeume[0].blickpunkte.find((b) => b.id === 'theke') as Blickpunkt
    const r = rahmenFuer(t, HOCH)
    const start = richtung(t.portrait?.eye as Vec3, t.portrait?.look as Vec3)
    expect(r.yaw0 + r.startYaw).toBeCloseTo(start.yaw, 9)
    // links (zum Schaufenster) bleibt es bei rund 20°, rechts sind es rund 60°
    const links = (r.yawMax - r.startYaw) / GRAD
    const rechts = (r.yawMax + r.startYaw) / GRAD
    expect(links).toBeGreaterThan(18)
    expect(links).toBeLessThan(24)
    expect(rechts).toBeGreaterThan(55)
    expect(rechts).toBeLessThan(62)
  })
})

describe('RigKern: Fahrt bleibt bei Größenänderung, Mausrad und Pinch', () => {
  it('eine Größenänderung im selben Format lässt die Zoom-Fahrt weiterlaufen', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 10 * GRAD, -5 * GRAD, 4))
    kern.schritt(60)
    kern.resize(1400 / 900)
    expect(kern.bewegt()).toBe(true)
    auslaufen(kern)
    const p = pose(kern)
    expect(p.fov).toBe(30)
    expect(p.yaw).toBeCloseTo(10 * GRAD, 9)
    expect(p.pitch).toBeCloseTo(-5 * GRAD, 9)
    expect(kern.istGezoomt()).toBe(true)
  })

  it('das Ziel der Fahrt rückt dabei in die Grenzen des neuen Bildes', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 120 * GRAD, 0, 3))
    kern.schritt(60)
    // schmaleres Querformat: herangezoomt weniger Spiel zur Seite
    kern.resize(1.2)
    auslaufen(kern)
    const g = grenzen(rahmenFuer(regal, 1.2), 30, 1.2)
    expect(pose(kern).yaw).toBeCloseTo(g.yaw, 9)
    expect(kern.bewegt()).toBe(false)
  })

  it('hoch ↔ quer während der Fahrt schneidet in die Ruhelage', () => {
    const kern = kernAm(regal)
    kern.zoomTo([0, 2, 4])
    kern.schritt(60)
    kern.resize(HOCH)
    expect(kern.bewegt()).toBe(false)
    expect(pose(kern).fov).toBe(70)
    expect(pose(kern).eye).toEqual([1, 2, 1])
  })

  it('setzeFov während einer Zoom-Fahrt: die Drehung läuft zu ihrem Ziel weiter', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 10 * GRAD, 0, 4))
    kern.schritt(ZOOM_MS / 2)
    const mitte = pose(kern)
    kern.zoomen(1)
    // kein Sprung: Bild und Winkel stehen, wo sie eben standen
    expect(pose(kern).yaw).toBeCloseTo(mitte.yaw, 9)
    expect(pose(kern).fov).toBeCloseTo(mitte.fov, 9)
    expect(kern.bewegt()).toBe(true)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
    expect(pose(kern).fov).toBe(30)
  })

  it('ein Pinch während der Fahrt gibt nur dem Öffnungswinkel ein neues Ziel', () => {
    const kern = kernAm(regal)
    kern.zoomTo(blickziel([0, 2, 0], 10 * GRAD, 0, 4))
    kern.schritt(ZOOM_MS / 2)
    kern.setzeFov(45)
    auslaufen(kern)
    expect(pose(kern).fov).toBe(45)
    expect(pose(kern).yaw).toBeCloseTo(10 * GRAD, 9)
  })
})

describe('RigKern: wann gilt das Bild als herangezoomt', () => {
  it('ein Hauch Zoom zählt nicht - der Doppeltipp zoomt dann heran, nicht zurück', () => {
    const kern = kernAm(regal)
    kern.zoomen(0.97)
    expect(pose(kern).fov).toBeCloseTo(58.2, 6)
    expect(kern.istGezoomt()).toBe(false)
    kern.zoomTo([0, 2, 4])
    auslaufen(kern)
    expect(pose(kern).fov).toBe(30)
  })

  it('die Schwelle liegt auf halbem Weg zur Doppeltipp-Weite', () => {
    const kern = kernAm(regal)
    // Start 60°, Doppeltipp 30° → Schwelle 45°
    kern.setzeFov(46)
    expect(kern.istGezoomt()).toBe(false)
    kern.setzeFov(45)
    expect(kern.istGezoomt()).toBe(true)
  })

  it('lässt sich kaum zoomen, zählt jeder Zoom knapp unter der Startweite', () => {
    const eng: Blickpunkt = { ...regal, fovMin: 59 }
    const kern = kernAm(eng)
    kern.setzeFov(59)
    expect(kern.istGezoomt()).toBe(true)
  })

  it('zoomZurueck in der Startweite tut nichts, aus jedem Zoom fährt es zurück', () => {
    const kern = kernAm(regal)
    kern.zoomZurueck()
    expect(kern.bewegt()).toBe(false)
    kern.setzeFov(58)
    kern.zoomZurueck()
    expect(kern.bewegt()).toBe(true)
    auslaufen(kern)
    expect(pose(kern).fov).toBe(60)
  })
})

describe('RigKern: schwenken meldet, was die Grenze abgeschnitten hat', () => {
  it('innerhalb der Grenzen: nichts', () => {
    const kern = kernAm(regal)
    const rest = kern.schwenken(8 * GRAD, -4 * GRAD)
    expect(rest?.yaw).toBeCloseTo(0, 12)
    expect(rest?.pitch).toBeCloseTo(0, 12)
  })

  it('über die Grenze hinaus: den Rest', () => {
    const kern = kernAm(regal)
    const rest = kern.schwenken(60 * GRAD, 0)
    expect(rest?.yaw).toBeCloseTo(40 * GRAD, 9)
    expect(rest?.pitch).toBeCloseTo(0, 12)
    auslaufen(kern)
    expect(pose(kern).yaw).toBeCloseTo(20 * GRAD, 9)
    expect(kern.schwenken(0, -40 * GRAD)?.pitch).toBeCloseTo(-28 * GRAD, 9)
  })

  it('während eines Wechsels und bei unbrauchbaren Werten: nicht ausgeführt', () => {
    const kern = kernAm(regal)
    expect(kern.schwenken(Number.NaN, 0)).toBeNull()
    expect(createRigKern({ reducedMotion: false }).schwenken(0.1, 0)).toBeNull()
    kern.setBlickpunkt(theke)
    expect(kern.schwenken(0.01, 0)).toBeNull()
  })
})

describe('RigKern: resize', () => {
  it('wechselt bei aspect < 1 auf die Hochformat-Werte und zurück', () => {
    const kern = kernAm(regal, QUER)
    kern.ziehen(5 * GRAD, 0)
    kern.loslassen()
    kern.resize(HOCH)
    expect(pose(kern)).toEqual({
      eye: [1, 2, 1],
      yaw: Math.PI / 2,
      pitch: 0,
      fov: 70,
    })
    expect(kern.bewegt()).toBe(false)
    kern.resize(QUER)
    expect(pose(kern)).toEqual({ eye: [0, 2, 0], yaw: 0, pitch: 0, fov: 60 })
  })

  it('gleiches Format: Blick bleibt, der Winkel folgt der waagerechten Grenze', () => {
    const kern = kernAm(theke, QUER)
    kern.zoomen(100)
    expect(pose(kern).fov).toBe(64)
    kern.ziehen(5 * GRAD, 0)
    kern.loslassen()
    const yaw = pose(kern).yaw
    kern.resize(BREIT)
    expect(pose(kern).yaw).toBeCloseTo(yaw, 9)
    expect(horizontalFov(pose(kern).fov, BREIT)).toBeCloseTo(
      MAX_HORIZONTAL_FOV,
      6
    )
    kern.resize(QUER)
    expect(pose(kern).fov).toBe(64)
  })

  it('gleiches Format: ein herangezoomter Winkel bleibt', () => {
    const kern = kernAm(regal, QUER)
    kern.setzeFov(30)
    kern.resize(1.2)
    expect(pose(kern).fov).toBe(30)
  })

  it('beim Gleiten: das Ziel folgt dem neuen Format', () => {
    const kern = kernAm(theke, QUER)
    kern.setBlickpunkt(regal)
    kern.schritt(200)
    kern.resize(HOCH)
    auslaufen(kern)
    expect(pose(kern)).toEqual({
      eye: [1, 2, 1],
      yaw: Math.PI / 2,
      pitch: 0,
      fov: 70,
    })
  })

  it('vor dem ersten Blickpunkt merkt es sich nur das Format', () => {
    const kern = createRigKern({ reducedMotion: false })
    kern.resize(HOCH)
    kern.setBlickpunkt(regal)
    expect(pose(kern).eye).toEqual([1, 2, 1])
  })
})

describe('Tipp oder Ziehen', () => {
  it('Tipp: kaum bewegt und kurz', () => {
    expect(istTipp({ wegPx: 0, dauerMs: 80 })).toBe(true)
    expect(istTipp({ wegPx: TIPP_MAX_PX, dauerMs: TIPP_MAX_MS })).toBe(true)
  })

  it('kein Tipp: zu weit bewegt (Ziehen)', () => {
    expect(istTipp({ wegPx: TIPP_MAX_PX + 1, dauerMs: 80 })).toBe(false)
  })

  it('kein Tipp: zu lange gehalten', () => {
    expect(istTipp({ wegPx: 2, dauerMs: TIPP_MAX_MS + 1 })).toBe(false)
  })

  it('kein Tipp: zwei Finger waren im Spiel', () => {
    expect(istTipp({ wegPx: 0, dauerMs: 80, mehrfinger: true })).toBe(false)
  })

  it('Doppeltipp: schnell und nah am vorigen', () => {
    const erster = { x: 100, y: 200, zeit: 1000 }
    expect(istDoppeltipp(null, erster)).toBe(false)
    expect(istDoppeltipp(erster, { x: 110, y: 205, zeit: 1200 })).toBe(true)
    expect(
      istDoppeltipp(erster, { x: 100, y: 200, zeit: 1000 + DOPPELTIPP_MS + 1 })
    ).toBe(false)
    expect(istDoppeltipp(erster, { x: 180, y: 200, zeit: 1100 })).toBe(false)
    expect(istDoppeltipp(erster, { x: 100, y: 200, zeit: 900 })).toBe(false)
  })
})

describe('zweiFingerWisch', () => {
  const basis = { dy: 4, abstandStart: 120, abstandEnde: 124 }

  it('nach links wischen blättert weiter, nach rechts zurück', () => {
    expect(zweiFingerWisch({ ...basis, dx: -WISCH_MIN_PX - 10 })).toBe(1)
    expect(zweiFingerWisch({ ...basis, dx: WISCH_MIN_PX + 10 })).toBe(-1)
  })

  it('zu kurz ist kein Wischen', () => {
    expect(zweiFingerWisch({ ...basis, dx: WISCH_MIN_PX - 1 })).toBeNull()
  })

  it('senkrecht oder schräg ist kein Wechsel', () => {
    expect(zweiFingerWisch({ ...basis, dx: 80, dy: 60 })).toBeNull()
    expect(zweiFingerWisch({ ...basis, dx: 0, dy: 200 })).toBeNull()
  })

  it('ein Pinch ist kein Wischen', () => {
    expect(
      zweiFingerWisch({ dx: 90, dy: 0, abstandStart: 100, abstandEnde: 160 })
    ).toBeNull()
    expect(
      zweiFingerWisch({ dx: 90, dy: 0, abstandStart: 100, abstandEnde: 60 })
    ).toBeNull()
    expect(
      zweiFingerWisch({ dx: 90, dy: 0, abstandStart: 0, abstandEnde: 60 })
    ).toBeNull()
  })
})
