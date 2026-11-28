import { hatWebGL2 } from './ladeViewer'

// jsdom kann kein WebGL (test-setup.ts: getContext liefert null). Hier
// spielt ein Platzhalter den Kontext - three wird nie geladen.
const getContext = HTMLCanvasElement.prototype.getContext
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext
})

function mitKontext(kontext: unknown) {
  const angefragt: string[] = []
  HTMLCanvasElement.prototype.getContext = function (typ: string) {
    angefragt.push(typ)
    return kontext
  } as unknown as typeof getContext
  return angefragt
}

describe('hatWebGL2', () => {
  it('mit WebGL 2: ja - und der Kontext der Probe wird gleich freigegeben', () => {
    const loseContext = jest.fn()
    const getExtension = jest.fn(() => ({ loseContext }))
    const angefragt = mitKontext({ getExtension })
    expect(hatWebGL2()).toBe(true)
    expect(angefragt).toEqual(['webgl2'])
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('ohne die Erweiterung zum Freigeben: trotzdem ja', () => {
    mitKontext({ getExtension: () => null })
    expect(hatWebGL2()).toBe(true)
  })

  it('ohne WebGL 2 (nur WebGL 1 oder gar keins): nein', () => {
    const angefragt = mitKontext(null)
    expect(hatWebGL2()).toBe(false)
    // Nach WebGL 1 wird gar nicht erst gefragt: three braucht 2.
    expect(angefragt).toEqual(['webgl2'])
  })

  it('wirft der Browser bei der Probe: nein, statt abzustürzen', () => {
    HTMLCanvasElement.prototype.getContext = (() => {
      throw new Error('kaputt')
    }) as unknown as typeof getContext
    expect(hatWebGL2()).toBe(false)
  })

  it('so wie jsdom (getContext liefert null): nein', () => {
    expect(hatWebGL2()).toBe(false)
  })
})
