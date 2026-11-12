import { DREHEN_JE_PX, startZustand, type Drehteller } from './drehteller'
import {
  TASTEN_SCHRITT_PX,
  TASTEN_ZOOM,
  createDrehtellerControls,
} from './drehtellerControls'

const ZOOM_MIN = 0.3

/** jsdom kennt kein PointerEvent: ein MouseEvent mit den nötigen Feldern. */
function zeiger(
  ziel: Element,
  typ: string,
  id: number,
  x: number,
  y: number,
  pointerType = 'touch'
) {
  const event = new MouseEvent(typ, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  })
  Object.assign(event, { pointerId: id, pointerType })
  ziel.dispatchEvent(event)
}

function setup() {
  const element = document.createElement('canvas')
  // jsdom hat keinen Zeigerfang.
  element.setPointerCapture = jest.fn()
  element.releasePointerCapture = jest.fn()
  document.body.appendChild(element)
  let zustand: Drehteller = startZustand()
  const onGeste = jest.fn()
  const setze = jest.fn((neu: Drehteller) => {
    zustand = neu
  })
  const controls = createDrehtellerControls({
    element,
    lies: () => ({ zustand, zoomMin: ZOOM_MIN }),
    setze,
    onGeste,
  })
  return { element, controls, setze, onGeste, lies: () => zustand }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createDrehtellerControls', () => {
  it('nimmt dem Browser Scrollen und Zoomen auf dem Bild', () => {
    expect(setup().element.style.touchAction).toBe('none')
  })

  it('Ziehen mit einem Finger dreht', () => {
    const { element, lies, onGeste } = setup()
    zeiger(element, 'pointerdown', 1, 100, 100)
    expect(onGeste).toHaveBeenCalled()
    zeiger(element, 'pointermove', 1, 130, 110)
    const start = startZustand()
    expect(lies().yaw).toBeCloseTo(start.yaw - 30 * DREHEN_JE_PX)
    expect(lies().pitch).toBeCloseTo(start.pitch + 10 * DREHEN_JE_PX)
    expect(lies().zoom).toBe(1)
    zeiger(element, 'pointerup', 1, 130, 110)
    // Ohne gedrückten Zeiger passiert nichts mehr.
    zeiger(element, 'pointermove', 1, 300, 300)
    expect(lies().yaw).toBeCloseTo(start.yaw - 30 * DREHEN_JE_PX)
  })

  it('zwei Finger auseinander holen das Produkt näher, zusammen schieben es weg', () => {
    const { element, lies } = setup()
    zeiger(element, 'pointerdown', 1, 100, 200)
    zeiger(element, 'pointerdown', 2, 200, 200)
    zeiger(element, 'pointermove', 2, 300, 200)
    expect(lies().zoom).toBeCloseTo(0.5)
    // Gedreht wird dabei nicht.
    expect(lies().yaw).toBe(startZustand().yaw)
    zeiger(element, 'pointermove', 2, 150, 200)
    expect(lies().zoom).toBeCloseTo(1.5)
    // Bis zur Grenze, nicht weiter.
    zeiger(element, 'pointermove', 2, 101, 200)
    expect(lies().zoom).toBe(1.5)
  })

  it('nach dem Loslassen eines Fingers dreht der andere ohne Sprung weiter', () => {
    const { element, lies } = setup()
    zeiger(element, 'pointerdown', 1, 100, 200)
    zeiger(element, 'pointerdown', 2, 200, 200)
    zeiger(element, 'pointerup', 2, 200, 200)
    const vorher = lies().yaw
    zeiger(element, 'pointermove', 1, 110, 200)
    expect(lies().yaw).toBeCloseTo(vorher - 10 * DREHEN_JE_PX)
  })

  it('das Mausrad zoomt und lässt die Seite stehen', () => {
    const { element, lies } = setup()
    const event = new WheelEvent('wheel', {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(lies().zoom).toBeLessThan(1)
    for (let i = 0; i < 50; i += 1) {
      element.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -500, cancelable: true })
      )
    }
    expect(lies().zoom).toBe(ZOOM_MIN)
  })

  it('Pfeiltasten drehen, Plus und Minus zoomen', () => {
    const { element, lies } = setup()
    const taste = (key: string) => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    }
    const start = startZustand()
    expect(taste('ArrowRight')).toBe(true)
    expect(lies().yaw).toBeCloseTo(start.yaw - TASTEN_SCHRITT_PX * DREHEN_JE_PX)
    taste('ArrowLeft')
    expect(lies().yaw).toBeCloseTo(start.yaw)
    taste('ArrowDown')
    expect(lies().pitch).toBeGreaterThan(start.pitch)
    taste('+')
    expect(lies().zoom).toBeCloseTo(TASTEN_ZOOM)
    taste('-')
    expect(lies().zoom).toBeCloseTo(1)
    // Andere Tasten (Tab, Escape) bleiben dem Dialog.
    expect(taste('Escape')).toBe(false)
    expect(taste('Tab')).toBe(false)
  })

  it('hört nach dispose auf nichts mehr', () => {
    const { element, controls, setze } = setup()
    controls.dispose()
    zeiger(element, 'pointerdown', 1, 100, 100)
    zeiger(element, 'pointermove', 1, 150, 100)
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))
    element.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
    expect(setze).not.toHaveBeenCalled()
  })
})
