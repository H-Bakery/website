import {
  START_BLICKPUNKT_ID,
  START_RAUM_ID,
  findeBlickpunkt,
  findeBlickpunktFuerSlot,
  findeRaum,
  raeume,
  type Raum,
  type Vec3,
} from './raeume'

/** Verkaufsraum im Zonen-Rahmen (Hüllquader von Boden und Wänden im Modell). */
const LADEN = {
  min: [0.22, 244.25, -6.38],
  max: [6.84, 246.3, 1.86],
} as const
const BODEN = 244.25

/** Die Möbel des Ladens, auf denen im Modell Plätze (`produkt/<slot>`) liegen. */
const MOEBEL_MIT_PLAETZEN = [
  'theke/vitrine/ebene-1/platz-01',
  'theke/brezelstaender/platz-01',
  'brotregal/ebene-1/platz-01',
  'brotregal/koerbe/korb-1/platz-01',
  'dosenregal/platz-01',
  'getraenkekuehlschrank/platz-01',
  'gitterregal/platz-01',
  'wuerfelregal/platz-01',
]

function imLaden(p: Vec3): boolean {
  return p.every((v, i) => v > LADEN.min[i] && v < LADEN.max[i])
}

function laden(): Raum {
  const raum = findeRaum('laden')
  if (!raum) throw new Error('Raum „laden“ fehlt')
  return raum
}

describe('raeume (Konfiguration)', () => {
  it('hat den Start-Blickpunkt', () => {
    const raum = findeRaum(START_RAUM_ID)
    if (!raum) throw new Error('Start-Raum fehlt')
    expect(findeBlickpunkt(raum, START_BLICKPUNKT_ID)).toBeDefined()
    expect(raum.blickpunkte[0].id).toBe(START_BLICKPUNKT_ID)
  })

  it('der Laden hat die drei Blickpunkte aus DB3, in dieser Reihenfolge', () => {
    expect(laden().blickpunkte.map((b) => b.id)).toEqual([
      'theke',
      'brotregal',
      'regale',
    ])
    expect(laden().blickpunkte.map((b) => b.name)).toEqual([
      'Theke',
      'Brotregal',
      'Regale',
    ])
  })

  it('hat eindeutige IDs', () => {
    expect(new Set(raeume.map((r) => r.id)).size).toBe(raeume.length)
    for (const raum of raeume) {
      expect(raum.modell).toMatch(/^[\w-]+\.glb$/)
      const ids = raum.blickpunkte.map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  describe.each(raeume.flatMap((r) => r.blickpunkte).map((b) => [b.id, b]))(
    'Blickpunkt %s',
    (_id, b) => {
      it('hat stimmige Öffnungswinkel: fovMin < fov ≤ fovMax', () => {
        expect(b.fovMin).toBeGreaterThan(5)
        expect(b.fovMin).toBeLessThan(b.fov)
        expect(b.fov).toBeLessThanOrEqual(b.fovMax)
        expect(b.fovMax).toBeLessThan(120)
      })

      it('lässt nur leichtes Umschauen zu (DB4)', () => {
        expect(b.yawDeg).toBeGreaterThan(0)
        expect(b.yawDeg).toBeLessThanOrEqual(30)
        expect(b.pitchDeg).toBeGreaterThan(0)
        expect(b.pitchDeg).toBeLessThanOrEqual(15)
      })

      it('schaut irgendwohin', () => {
        expect(b.eye).not.toEqual(b.look)
      })

      it('hat eigene Werte fürs Hochformat', () => {
        const p = b.portrait
        if (!p) throw new Error('Hochformat-Werte fehlen')
        expect(p.eye).not.toEqual(p.look)
        const min = p.fovMin ?? b.fovMin
        const max = p.fovMax ?? p.fov
        expect(min).toBeLessThan(p.fov)
        expect(p.fov).toBeLessThanOrEqual(max)
        expect(max).toBeLessThan(120)
      })

      it('nennt seine Möbel als Anfang der Platz-ID', () => {
        expect(b.moebel.length).toBeGreaterThan(0)
        for (const prefix of b.moebel) expect(prefix).toMatch(/^[a-z-]+\/$/)
      })
    }
  )

  describe('im Laden', () => {
    it.each(laden().blickpunkte.map((b) => [b.id, b]))(
      '%s steht im Raum, auf Augenhöhe - quer und hoch',
      (_id, b) => {
        for (const eye of [b.eye, b.portrait?.eye ?? b.eye]) {
          expect(imLaden(eye)).toBe(true)
          expect(eye[1] - BODEN).toBeGreaterThanOrEqual(1.3)
          expect(eye[1] - BODEN).toBeLessThanOrEqual(1.8)
        }
        for (const look of [b.look, b.portrait?.look ?? b.look]) {
          expect(imLaden(look)).toBe(true)
        }
      }
    )

    it('die Möbel der Blickpunkte überschneiden sich nicht', () => {
      const alle = laden().blickpunkte.flatMap((b) => b.moebel)
      expect(new Set(alle).size).toBe(alle.length)
      for (const a of alle) {
        for (const b of alle) {
          if (a !== b) expect(a.startsWith(b)).toBe(false)
        }
      }
    })

    it.each(MOEBEL_MIT_PLAETZEN)(
      'der Platz %s gehört zu genau einem Blickpunkt',
      (slot) => {
        const treffer = laden().blickpunkte.filter((b) =>
          b.moebel.some((prefix) => slot.startsWith(prefix))
        )
        expect(treffer).toHaveLength(1)
        expect(findeBlickpunktFuerSlot(laden(), slot)).toBe(treffer[0])
      }
    )

    it('ordnet die Möbel wie beschrieben zu', () => {
      const zu = (slot: string) => findeBlickpunktFuerSlot(laden(), slot)?.id
      expect(zu('theke/vitrine/ebene-2/platz-03')).toBe('theke')
      expect(zu('gitterregal/platz-05')).toBe('theke')
      expect(zu('brotregal/ebene-4/platz-14')).toBe('brotregal')
      expect(zu('wuerfelregal/platz-08')).toBe('brotregal')
      expect(zu('dosenregal/platz-13')).toBe('regale')
      expect(zu('getraenkekuehlschrank/platz-05')).toBe('regale')
      expect(zu('testregal/platz-01')).toBeUndefined()
    })

    it('blendet den Außenraum nur dort aus, wo man ihn nicht sieht', () => {
      const aus = laden()
        .blickpunkte.filter((b) => b.aussenSichtbar === false)
        .map((b) => b.id)
      expect(aus).toEqual(['regale'])
    })
  })
})
