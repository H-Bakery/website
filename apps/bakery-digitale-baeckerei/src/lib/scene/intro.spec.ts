import {
  START_RAUM_ID,
  findeBlickpunkt,
  findeRaum,
  type Intro,
  type Vec3,
} from '../../config/raeume'
import {
  AUSLAUF_S,
  ENDE_BLENDE_S,
  MIN_BILDER_JE_S,
  dauer,
  gerundet,
  introPose,
  pfadBereich,
  pfadLaenge,
  pfadPunkt,
  pfadzeit,
  waehleIntro,
  weicheZeit,
  zuLangsam,
} from './intro'
import { ansichtFuer } from './view'

const raum = findeRaum(START_RAUM_ID)
if (!raum) throw new Error('Raum fehlt')
const intros = raum.intros ?? []
const theke = findeBlickpunkt(raum, 'theke')
if (!theke) throw new Error('Theke fehlt')

const HOCH = 390 / 844
const QUER = 844 / 390
const DESKTOP = 1440 / 900

/** Abstand eines Punkts von der Strecke a-b. */
function abstandStrecke(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const f =
    l2 > 0
      ? Math.min(
          1,
          Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2)
        )
      : 0
  return Math.hypot(ap[0] - ab[0] * f, ap[1] - ab[1] * f, ap[2] - ab[2] * f)
}

function abstandPfad(p: Vec3, intro: Intro): number {
  let min = Infinity
  for (let i = 0; i < intro.punkte.length - 1; i += 1) {
    min = Math.min(
      min,
      abstandStrecke(p, intro.punkte[i].eye, intro.punkte[i + 1].eye)
    )
  }
  return min
}

const zeiten = (intro: Intro, schritt = 0.01): number[] => {
  const out: number[] = []
  for (let t = 0; t <= dauer(intro) + 1e-9; t += schritt) out.push(t)
  return out
}

describe('raeume.ts: Flüge zum Start', () => {
  it('kennt den kurzen Flug und den vom Kreisel, beide enden an der Theke', () => {
    expect(intros.map((i) => i.id)).toEqual(['kreisel', 'kurz'])
    for (const intro of intros) {
      expect(intro.ziel).toBe('theke')
      const letzter = intro.punkte[intro.punkte.length - 1]
      expect(letzter.eye).toEqual(theke.eye)
      expect(letzter.look).toEqual(theke.look)
    }
  })

  it('nur der Flug vom Kreisel braucht Gelände, das es noch nicht gibt', () => {
    expect(intros.find((i) => i.id === 'kreisel')?.braucht).toBe(
      'umgebung/kreisel'
    )
    expect(intros.find((i) => i.id === 'kurz')?.braucht).toBeUndefined()
  })

  it('die Stützpunkte laufen in der Zeit streng vorwärts', () => {
    for (const intro of intros) {
      for (let i = 1; i < intro.punkte.length; i += 1) {
        expect(intro.punkte[i].t).toBeGreaterThan(intro.punkte[i - 1].t)
      }
      const plan = intro.ablauf ?? []
      for (let i = 1; i < plan.length; i += 1) {
        expect(plan[i].film).toBeGreaterThan(plan[i - 1].film)
        expect(plan[i].pfad).toBeGreaterThan(plan[i - 1].pfad)
      }
    }
  })

  it('dauert kurz 7,5 s (vorn gekürzt) und vom Kreisel 12 s', () => {
    const kurz = intros.find((i) => i.id === 'kurz') as Intro
    const kreisel = intros.find((i) => i.id === 'kreisel') as Intro
    expect(dauer(kurz)).toBeCloseTo(7.5, 6)
    expect(pfadBereich(kurz)).toEqual({ von: 1.9, bis: 8.0 })
    expect(pfadLaenge(kurz)).toBeGreaterThan(20)
    expect(pfadLaenge(kurz)).toBeLessThan(26)
    expect(dauer(kreisel)).toBeCloseTo(12, 6)
    expect(pfadLaenge(kreisel)).toBeGreaterThan(80)
    expect(pfadLaenge(kreisel)).toBeLessThan(88)
  })
})

describe('weicheZeit', () => {
  it('beginnt bei 0, endet bei der Dauer und läuft nie rückwärts', () => {
    expect(weicheZeit(0, 8)).toBe(0)
    expect(weicheZeit(8, 8)).toBeCloseTo(8, 9)
    let vorher = -1
    for (let t = 0; t <= 8; t += 0.01) {
      const w = weicheZeit(t, 8)
      expect(w).toBeGreaterThanOrEqual(vorher)
      vorher = w
    }
  })

  it('läuft weich an und aus: am Rand langsamer als in der Mitte', () => {
    const tempo = (t: number) =>
      (weicheZeit(t + 0.01, 8) - weicheZeit(t, 8)) / 0.01
    expect(tempo(0)).toBeLessThan(0.1)
    expect(tempo(7.99)).toBeLessThan(0.1)
    expect(tempo(4)).toBeGreaterThan(1)
    expect(tempo(4)).toBeLessThan(1.15)
  })

  it('klemmt Zeiten außerhalb und verträgt Unsinn', () => {
    expect(weicheZeit(-3, 8)).toBe(0)
    expect(weicheZeit(99, 8)).toBeCloseTo(8, 9)
    expect(weicheZeit(Number.NaN, 8)).toBe(0)
    expect(weicheZeit(1, 0)).toBe(0)
    // Kürzer als An- und Auslauf zusammen: trotzdem stetig bis zum Ende.
    expect(weicheZeit(1, 1)).toBeCloseTo(1, 9)
    expect(weicheZeit(0.5, 1)).toBeGreaterThan(0)
  })
})

describe('pfadPunkt und gerundet', () => {
  const kurz = intros.find((i) => i.id === 'kurz') as Intro

  it('trifft die Stützpunkte genau und liegt dazwischen auf der Geraden', () => {
    for (const p of kurz.punkte) {
      expect(pfadPunkt(kurz.punkte, p.t).eye).toEqual(p.eye)
    }
    const mitte = pfadPunkt(kurz.punkte, 0.6)
    expect(mitte.eye[0]).toBeCloseTo((0.55 + 3.2) / 2, 9)
    expect(mitte.look[1]).toBeCloseTo((246.2 + 245.6) / 2, 9)
    expect(pfadPunkt(kurz.punkte, -1).eye).toEqual(kurz.punkte[0].eye)
    expect(pfadPunkt(kurz.punkte, 99).eye).toEqual(theke.eye)
  })

  it('rundet die Ecken, aber nicht die Enden', () => {
    const bereich = { von: 0, bis: 8 }
    const ecke = gerundet(kurz.punkte, 3.4, bereich)
    const scharf = pfadPunkt(kurz.punkte, 3.4)
    const d = Math.hypot(
      ecke.eye[0] - scharf.eye[0],
      ecke.eye[1] - scharf.eye[1],
      ecke.eye[2] - scharf.eye[2]
    )
    expect(d).toBeGreaterThan(0.05)
    expect(d).toBeLessThan(0.3)
    expect(gerundet(kurz.punkte, 0, bereich).eye).toEqual(kurz.punkte[0].eye)
    expect(gerundet(kurz.punkte, 8, bereich).eye).toEqual(theke.eye)
    // Mitten auf einem geraden Stück ändert das Mittel nichts.
    const gerade = gerundet(kurz.punkte, 2.3, bereich)
    const soll = pfadPunkt(kurz.punkte, 2.3)
    for (let k = 0; k < 3; k += 1) {
      expect(gerade.eye[k]).toBeCloseTo(soll.eye[k], 9)
      expect(gerade.look[k]).toBeCloseTo(soll.look[k], 9)
    }
  })
})

describe.each(intros.map((i) => [i.id, i] as const))(
  'introPose: Flug „%s“',
  (_id, intro) => {
    it('die Pfadzeit läuft monoton vom Anfang bis zum Ende des Abschnitts', () => {
      const { von, bis } = pfadBereich(intro)
      expect(pfadzeit(intro, 0)).toBeCloseTo(von, 9)
      expect(pfadzeit(intro, dauer(intro))).toBeCloseTo(bis, 9)
      let vorher = -Infinity
      for (const t of zeiten(intro)) {
        const p = pfadzeit(intro, t)
        expect(p).toBeGreaterThanOrEqual(vorher)
        vorher = p
      }
    })

    it.each([
      ['Hochformat', HOCH],
      ['Querformat', QUER],
      ['Desktop', DESKTOP],
    ])('%s: endet genau in der Ruhelage der Theke', (_name, aspect) => {
      const ende = ansichtFuer(theke, aspect)
      for (const t of [dauer(intro), dauer(intro) + 5]) {
        const pose = introPose(intro, t, ende)
        expect(pose.eye).toEqual(ende.eye)
        expect(pose.look).toEqual(ende.look)
        expect(pose.fov).toBe(ende.fov)
      }
    })

    it.each([
      ['Hochformat', HOCH],
      ['Querformat', QUER],
    ])('%s: keine NaN, kein Sprung, fester Öffnungswinkel', (_name, aspect) => {
      const ende = ansichtFuer(theke, aspect)
      let vorher = introPose(intro, 0, ende)
      for (const t of zeiten(intro)) {
        const pose = introPose(intro, t, ende)
        for (const v of [...pose.eye, ...pose.look, pose.fov]) {
          expect(Number.isFinite(v)).toBe(true)
        }
        expect(pose.fov).toBe(ende.fov)
        // 10 ms Film: höchstens ≈ 0,15 m Weg (auch der Kreisel: < 15 m/s).
        expect(
          Math.hypot(
            pose.eye[0] - vorher.eye[0],
            pose.eye[1] - vorher.eye[1],
            pose.eye[2] - vorher.eye[2]
          )
        ).toBeLessThan(0.15)
        vorher = pose
      }
      // … und auch das letzte Bild vor dem Ende liegt schon fast am Ziel.
      const fast = introPose(intro, dauer(intro) - 0.01, ende)
      expect(
        Math.hypot(
          fast.eye[0] - ende.eye[0],
          fast.eye[1] - ende.eye[1],
          fast.eye[2] - ende.eye[2]
        )
      ).toBeLessThan(0.01)
      expect(
        Math.hypot(
          fast.look[0] - ende.look[0],
          fast.look[1] - ende.look[1],
          fast.look[2] - ende.look[2]
        )
      ).toBeLessThan(0.01)
    })

    it('der Standort bleibt höchstens 0,3 m neben dem geprüften Weg', () => {
      for (const aspect of [HOCH, QUER, DESKTOP]) {
        const ende = ansichtFuer(theke, aspect)
        let max = 0
        for (const t of zeiten(intro)) {
          max = Math.max(max, abstandPfad(introPose(intro, t, ende).eye, intro))
        }
        expect(max).toBeLessThan(0.3)
      }
    })

    it('beginnt am Anfang des gezeigten Abschnitts, genau auf dem Weg', () => {
      const ende = ansichtFuer(theke, QUER)
      const start = pfadPunkt(intro.punkte, pfadBereich(intro).von)
      const pose = introPose(intro, 0, ende)
      for (let k = 0; k < 3; k += 1) {
        expect(pose.eye[k]).toBeCloseTo(start.eye[k], 9)
        expect(pose.look[k]).toBeCloseTo(start.look[k], 9)
      }
      expect(introPose(intro, -2, ende)).toEqual(pose)
      expect(introPose(intro, Number.NaN, ende)).toEqual(pose)
    })
  }
)

describe('introPose: Übergang ins Hochformat', () => {
  const kurz = intros.find((i) => i.id === 'kurz') as Intro

  it('folgt bis zur letzten Sekunde dem Weg und blendet dann zum Hochformat-Blick', () => {
    const hoch = ansichtFuer(theke, HOCH)
    const quer = ansichtFuer(theke, QUER)
    expect(hoch.look).not.toEqual(quer.look)
    const vorher = dauer(kurz) - ENDE_BLENDE_S - 0.2
    // Vor der Blende: derselbe Blick in beiden Formaten (nur der Winkel nicht).
    expect(introPose(kurz, vorher, hoch).look).toEqual(
      introPose(kurz, vorher, quer).look
    )
    // In der Blende nähert sich der Blick dem Hochformat-Ziel stetig.
    const abstand = (t: number) => {
      const p = introPose(kurz, t, hoch).look
      const q = introPose(kurz, t, quer).look
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
    const halb = abstand(dauer(kurz) - ENDE_BLENDE_S / 2)
    const ende = abstand(dauer(kurz))
    expect(halb).toBeGreaterThan(0)
    expect(ende).toBeGreaterThan(halb)
    expect(introPose(kurz, dauer(kurz), hoch).fov).toBe(64)
  })

  it('der Auslauf ist kürzer als die Blende - beide enden zusammen', () => {
    expect(AUSLAUF_S).toBeLessThanOrEqual(ENDE_BLENDE_S)
  })
})

describe('waehleIntro', () => {
  const heute = ['fassade/aussenwand', 'umgebung/strasse', 'theke/vitrine']

  it('nimmt am heutigen Modell den kurzen Flug', () => {
    expect(waehleIntro(intros, heute, 'theke')?.id).toBe('kurz')
  })

  it('nimmt den Flug vom Kreisel, sobald das Modell ihn hergibt', () => {
    expect(
      waehleIntro(intros, [...heute, 'umgebung/kreisel/insel'], 'theke')?.id
    ).toBe('kreisel')
    // Nur der Anfang des Namens zählt.
    expect(
      waehleIntro(intros, [...heute, 'fassade/umgebung/kreisel'], 'theke')?.id
    ).toBe('kurz')
  })

  it('bietet nichts an, wenn kein Flug an diesem Blickpunkt endet', () => {
    expect(waehleIntro(intros, heute, 'brotregal')).toBeNull()
    expect(waehleIntro(undefined, heute, 'theke')).toBeNull()
    expect(waehleIntro([], heute, 'theke')).toBeNull()
  })

  it('überspringt Flüge ohne Weg', () => {
    const leer: Intro = { id: 'leer', name: 'Leer', ziel: 'theke', punkte: [] }
    const punkt: Intro = {
      id: 'punkt',
      name: 'Punkt',
      ziel: 'theke',
      punkte: [
        { t: 0, eye: [0, 0, 0], look: [1, 0, 0] },
        { t: 0, eye: [1, 0, 0], look: [2, 0, 0] },
      ],
    }
    expect(waehleIntro([leer, punkt], heute, 'theke')).toBeNull()
  })
})

describe('zuLangsam', () => {
  it('urteilt erst nach der ersten Sekunde', () => {
    expect(zuLangsam(0, 0)).toBe(false)
    expect(zuLangsam(3, 999)).toBe(false)
    expect(zuLangsam(3, 1000)).toBe(true)
  })

  it(`schneidet unter ${MIN_BILDER_JE_S} Bildern je Sekunde`, () => {
    expect(zuLangsam(11, 1000)).toBe(true)
    expect(zuLangsam(12, 1000)).toBe(false)
    expect(zuLangsam(13, 1100)).toBe(true)
    expect(zuLangsam(60, 1010)).toBe(false)
    expect(zuLangsam(5, Number.NaN)).toBe(false)
  })
})
