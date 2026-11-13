import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Raum } from '../config/raeume'

// Die Hülle der Seite ohne Theme: Hier geht es nur um den <head>.
jest.mock('../components/ThemeRegistry', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

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

/** Das HTML der Hülle, gebaut mit diesen verfügbaren Räumen. */
function htmlMit(raeume: readonly Raum[] | null): string {
  let html = ''
  jest.isolateModules(() => {
    if (raeume) {
      jest.doMock('../lib/raeume/verfuegbar', () => ({
        VERFUEGBARE_RAEUME: raeume,
      }))
    } else {
      jest.dontMock('../lib/raeume/verfuegbar')
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RootLayout = require('./layout').default
    // <html> lässt sich in jsdom nicht in einen Container hängen: als Text.
    const fehler = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    html = renderToStaticMarkup(<RootLayout>Inhalt</RootLayout>)
    fehler.mockRestore()
  })
  return html
}

describe('RootLayout: das Modell vorab laden', () => {
  it('ein Raum (wie heute live): fester preload-Link auf das Modell des Ladens, kein Skript', () => {
    const html = htmlMit(null)
    expect(html).toContain(
      '<link rel="preload" as="fetch" crossorigin="anonymous" href="/model/twin.glb"/>'
    )
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/testbackstube/i)
  })

  it('mehrere Räume: ein Skript setzt den Link passend zu ?raum=<id> - kein fester Link', () => {
    const html = htmlMit([
      raum('laden', 'twin.glb'),
      raum('werkstatt', 'werkstatt.glb'),
    ])
    expect(html).not.toContain('<link rel="preload"')
    const skript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(skript).toContain(
      '{"laden":"/model/twin.glb","werkstatt":"/model/werkstatt.glb"}'
    )

    // Das Skript ausführen, wie es der Browser täte.
    const fuer = (search: string): string | null => {
      document.head.innerHTML = ''
      window.history.replaceState(null, '', `/${search}`)
      // eslint-disable-next-line no-new-func
      new Function(skript)()
      const link = document.head.querySelector('link')
      expect(link?.rel).toBe('preload')
      expect(link?.getAttribute('as')).toBe('fetch')
      expect(link?.crossOrigin).toBe('anonymous')
      return link?.getAttribute('href') ?? null
    }
    expect(fuer('')).toBe('/model/twin.glb')
    expect(fuer('?raum=werkstatt')).toBe('/model/werkstatt.glb')
    expect(fuer('?debug&raum=werkstatt')).toBe('/model/werkstatt.glb')
    // Unbekannter Raum (auch ein Name aus dem Prototyp): der Laden.
    expect(fuer('?raum=keller')).toBe('/model/twin.glb')
    expect(fuer('?raum=toString')).toBe('/model/twin.glb')
    window.history.replaceState(null, '', '/')
  })
})
