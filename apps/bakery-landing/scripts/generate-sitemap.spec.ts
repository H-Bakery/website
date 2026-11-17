/**
 * Die Sitemap gegen einen erfundenen hq-Katalog in einem Temp-Ordner - nie
 * gegen echte Produkte und ohne public/sitemap.xml der App anzufassen.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const BASE = 'https://xn--bckerei-heusser-0kb.de'

type SitemapModule = {
  buildUrls: () => Array<{ loc: string }>
  generateSitemapXml: () => string
}

let tmp: string
const env = { ...process.env }

function md(id: string, n: number, available?: boolean) {
  const feld = available === undefined ? '' : `available: ${available}\n`
  return `---\nid: ${id}\nnumeric_id: ${n}\nname: ${id}\ncategory: brot\nprice: 1.5\n${feld}---\n`
}

/** Das Modul frisch laden, ohne dass es Dateien schreibt. */
function loadModule(): {
  sitemap: SitemapModule
  writeFileSync: jest.SpyInstance
} {
  const writeFileSync = jest.spyOn(fs, 'writeFileSync')
  let sitemap: SitemapModule | undefined
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sitemap = require('./generate-sitemap')
  })
  return { sitemap: sitemap as SitemapModule, writeFileSync }
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-sitemap-'))
  process.env.HQ_PRODUCTS_DIR = tmp
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  process.env = { ...env }
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('generate-sitemap', () => {
  it('lässt nicht angebotene Produkte weg und nimmt die angebotenen auf', () => {
    fs.writeFileSync(path.join(tmp, '1-testbrot.md'), md('testbrot', 1, true))
    fs.writeFileSync(
      path.join(tmp, '2-probebrot-alt.md'),
      md('probebrot-alt', 2, false)
    )
    fs.writeFileSync(path.join(tmp, '3-musterbrot.md'), md('musterbrot', 3))

    const { sitemap } = loadModule()
    const locs = sitemap.buildUrls().map((u) => u.loc)

    expect(locs).toContain(`${BASE}/products/1`)
    expect(locs).toContain(`${BASE}/products/3`)
    expect(locs).not.toContain(`${BASE}/products/2`)
    expect(sitemap.generateSitemapXml()).not.toContain(`${BASE}/products/2<`)
  })

  it('nimmt keine Beispielprodukte, wenn in hq gerade nichts angeboten wird', () => {
    fs.writeFileSync(
      path.join(tmp, '2-probebrot-alt.md'),
      md('probebrot-alt', 2, false)
    )

    const { sitemap } = loadModule()
    const produkte = sitemap
      .buildUrls()
      .map((u) => u.loc)
      .filter((loc) => loc.startsWith(`${BASE}/products/`))

    expect(produkte).toEqual([])
  })

  it('schreibt beim Einbinden keine Datei - nur als Skript', () => {
    fs.writeFileSync(path.join(tmp, '1-testbrot.md'), md('testbrot', 1, true))

    const { writeFileSync } = loadModule()

    expect(writeFileSync).not.toHaveBeenCalled()
  })
})
