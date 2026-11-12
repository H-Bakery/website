import type { Object3D } from 'three'
import { istAussenraum, setzeAussenraum } from './aussenraum'

interface Knoten {
  name: string
  userData: Record<string, unknown>
  visible: boolean
  children: Knoten[]
}

/** Wie nach dem GLTFLoader: `name` ohne Schrägstrich, das Original in `userData`. */
function knoten(name: string, children: Knoten[] = []): Knoten {
  return {
    name: name.replace(/\//g, ''),
    userData: { name },
    visible: true,
    children,
  }
}

function baum(): { root: Knoten; nach: Record<string, Knoten> } {
  const namen = [
    'verkaufsraum/boden',
    'theke/vitrine',
    'produkt/testregal/platz-01',
    'fassade/aussenwand',
    'fassade/dach',
    'umgebung/strasse',
    'umgebungslicht/leuchte',
  ]
  const nach: Record<string, Knoten> = {}
  for (const n of namen) nach[n] = knoten(n)
  const gruppe = knoten('gruppe', [knoten('umgebung/gelaende')])
  nach['umgebung/gelaende'] = gruppe.children[0]
  return {
    root: {
      name: 'root',
      userData: {},
      visible: true,
      children: [...namen.map((n) => nach[n]), gruppe],
    },
    nach,
  }
}

describe('istAussenraum', () => {
  it('erkennt fassade/* und umgebung/* am echten Namen', () => {
    expect(istAussenraum(knoten('fassade/dach'))).toBe(true)
    expect(istAussenraum(knoten('umgebung/strasse'))).toBe(true)
    expect(istAussenraum(knoten('theke/vitrine'))).toBe(false)
    expect(istAussenraum(knoten('umgebungslicht/leuchte'))).toBe(false)
  })

  it('fällt ohne userData.name auf den gekürzten Namen zurück', () => {
    expect(istAussenraum({ name: 'fassadedach' })).toBe(true)
    expect(istAussenraum({ name: 'thekevitrine', userData: {} })).toBe(false)
    expect(istAussenraum({})).toBe(false)
  })
})

describe('setzeAussenraum', () => {
  it('blendet nur den Außenraum aus und wieder ein', () => {
    const { root, nach } = baum()
    setzeAussenraum(root as unknown as Object3D, false)
    expect(nach['fassade/aussenwand'].visible).toBe(false)
    expect(nach['fassade/dach'].visible).toBe(false)
    expect(nach['umgebung/strasse'].visible).toBe(false)
    expect(nach['umgebung/gelaende'].visible).toBe(false)
    expect(nach['verkaufsraum/boden'].visible).toBe(true)
    expect(nach['theke/vitrine'].visible).toBe(true)
    expect(nach['umgebungslicht/leuchte'].visible).toBe(true)

    setzeAussenraum(root as unknown as Object3D, true)
    expect(Object.values(nach).every((k) => k.visible)).toBe(true)
  })

  it('lässt ausgeblendete Ware in Ruhe (Morgens-Filter)', () => {
    const { root, nach } = baum()
    nach['produkt/testregal/platz-01'].visible = false
    setzeAussenraum(root as unknown as Object3D, true)
    expect(nach['produkt/testregal/platz-01'].visible).toBe(false)
  })
})
