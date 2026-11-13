import lock from '../../../model.lock.json'
import { parseLock } from '../../../scripts/model-lock'
import { START_RAUM_ID, raeume, type Raum } from '../../config/raeume'
import { VERFUEGBARE_RAEUME, gesperrteRaeume, modellBytes } from './verfuegbar'

const raum = (id: string, modell: string): Raum => ({
  id,
  name: id,
  wechsel: `Nach ${id}`,
  modell,
  fuellung: 'morgens',
  produkte: false,
  start: 'a',
  blickpunkte: [],
})
const LADEN = raum('laden', 'twin.glb')
const WERKSTATT = raum('werkstatt', 'werkstatt.glb')
const LOCK = {
  raeume: {
    laden: { datei: 'twin.glb', bytes: 300, ausgeliefert: { bytes: 200 } },
  },
}

describe('gesperrteRaeume', () => {
  it('ein Raum ohne Modell im Lock wird nicht gezeigt', () => {
    expect(gesperrteRaeume([LADEN, WERKSTATT], LOCK)).toEqual([LADEN])
  })

  it('mit Lock-Eintrag erscheint er - in der Reihenfolge der Konfiguration', () => {
    const beide = {
      raeume: {
        werkstatt: { datei: 'werkstatt.glb', bytes: 10 },
        ...LOCK.raeume,
      },
    }
    expect(gesperrteRaeume([LADEN, WERKSTATT], beide)).toEqual([
      LADEN,
      WERKSTATT,
    ])
  })

  it('nennt das Lock eine andere Datei als die Konfiguration, zählt der Raum nicht', () => {
    expect(
      gesperrteRaeume([raum('laden', 'anders.glb'), WERKSTATT], LOCK)
    ).toEqual([])
  })

  it('ein Name aus dem Prototyp ist kein Lock-Eintrag', () => {
    expect(gesperrteRaeume([raum('toString', 'x.glb')], LOCK)).toEqual([])
  })
})

describe('modellBytes', () => {
  it('die Größe der ausgelieferten Datei, sonst die der Quelle', () => {
    expect(modellBytes(LADEN, LOCK)).toBe(200)
    expect(
      modellBytes(WERKSTATT, {
        raeume: { werkstatt: { datei: 'werkstatt.glb', bytes: 10 } },
      })
    ).toBe(10)
  })

  it('unbekannt für einen Raum ohne Lock-Eintrag', () => {
    expect(modellBytes(WERKSTATT, LOCK)).toBeUndefined()
  })
})

describe('dieser Build (ohne Fixture-Schalter)', () => {
  it('zeigt genau die Räume aus dem Lock - heute nur den Verkaufsraum', () => {
    expect(process.env.NEXT_PUBLIC_DIGITALE_BAECKEREI_FIXTURE).toBeUndefined()
    expect(VERFUEGBARE_RAEUME.map((r) => r.id)).toEqual(['laden'])
    expect(VERFUEGBARE_RAEUME.map((r) => r.id)).toContain(START_RAUM_ID)
  })

  it('kein synthetischer Test-Raum ohne den Schalter', () => {
    expect(JSON.stringify(VERFUEGBARE_RAEUME)).not.toMatch(/testbackstube/i)
  })

  it('Lock und Konfiguration passen zusammen: jeder Raum des Locks ist konfiguriert, mit derselben Datei', () => {
    const gesperrt = parseLock(lock).raeume
    for (const [id, eintrag] of Object.entries(gesperrt)) {
      const konfiguriert = raeume.find((r) => r.id === id)
      expect(konfiguriert).toBeDefined()
      expect(konfiguriert?.modell).toBe(eintrag.datei)
    }
    expect(Object.keys(gesperrt)).toContain(START_RAUM_ID)
  })

  it('die erwartete Größe des Ladens ist die der bereinigten Datei', () => {
    expect(modellBytes(VERFUEGBARE_RAEUME[0])).toBe(
      parseLock(lock).raeume.laden.ausgeliefert?.bytes
    )
  })
})
