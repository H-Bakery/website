import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  getHQProducts,
  loadProducts,
  renderedImageFor,
  resolveProductImage,
} from './products'

// Nur erfundene Produkte und Pfade - echte Daten liegen in hq, echte Bilder im
// Daten-Repo produkte-3d.
const SHA = 'b'.repeat(64)
const INDEX = {
  version: 1 as const,
  bilder: {
    'testbrot-500g': {
      modellSha256: SHA,
      varianten: [
        {
          file: 'bilder/testbrot-500g/haupt-800.webp',
          ansicht: 'haupt',
          breite: 800,
          hoehe: 800,
        },
        {
          file: 'bilder/testbrot-500g/haupt-400.webp',
          ansicht: 'haupt',
          breite: 400,
          hoehe: 400,
        },
      ],
    },
  },
}
const LEER = { version: 1 as const, bilder: {} }

const GERENDERT = {
  src: '/produkte-3d/bilder/testbrot-500g/haupt-800.webp',
  srcSet:
    '/produkte-3d/bilder/testbrot-500g/haupt-400.webp 400w, /produkte-3d/bilder/testbrot-500g/haupt-800.webp 800w',
  width: 800,
  height: 800,
}

describe('renderedImageFor', () => {
  it('baut src, srcSet und Maße aus den Varianten - größte als src', () => {
    expect(renderedImageFor(INDEX, 'testbrot-500g')).toEqual(GERENDERT)
  })

  it('ist undefined für ein Produkt ohne Bild', () => {
    expect(renderedImageFor(INDEX, 'testkuchen')).toBeUndefined()
    expect(renderedImageFor(LEER, 'testbrot-500g')).toBeUndefined()
  })
})

describe('resolveProductImage', () => {
  const brot = (image?: string) => ({
    id: 'testbrot-500g',
    category: 'brot',
    image,
  })

  it('ein echtes Foto aus hq gewinnt gegen das gerenderte Bild', () => {
    expect(
      resolveProductImage(brot('/assets/images/products/testbrot.jpg'), INDEX)
    ).toEqual({ image: '/assets/images/products/testbrot.jpg' })
  })

  it('das gerenderte Bild ersetzt die Vektor-Illustration aus hq', () => {
    expect(
      resolveProductImage(brot('/assets/images/products/brot-rund.svg'), INDEX)
    ).toEqual({ image: GERENDERT.src, renderedImage: GERENDERT })
  })

  it.each([undefined, '', 'images/'])(
    'das gerenderte Bild ersetzt das Kategorie-Bild (image: %p)',
    (image) => {
      expect(resolveProductImage(brot(image), INDEX)).toEqual({
        image: GERENDERT.src,
        renderedImage: GERENDERT,
      })
    }
  )

  it('ohne gerendertes Bild bleibt es beim Alten: Illustration aus hq, sonst Kategorie', () => {
    expect(
      resolveProductImage(brot('/assets/images/products/rolle.svg'), LEER)
    ).toEqual({ image: '/assets/images/products/rolle.svg' })
    expect(resolveProductImage(brot('images/'), LEER)).toEqual({
      image: '/assets/images/products/brot-rund.svg',
    })
    expect(
      resolveProductImage({ id: 'x', category: 'unbekannt' }, LEER)
    ).toEqual({ image: null })
  })

  it('setzt ohne gerendertes Bild kein Feld renderedImage', () => {
    expect(resolveProductImage(brot('images/'), LEER)).not.toHaveProperty(
      'renderedImage'
    )
  })
})

describe('getHQProducts / loadProducts mit Bilder-Index', () => {
  let tmp: string
  const env = { ...process.env }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-products-'))
    const products = path.join(tmp, 'products')
    fs.mkdirSync(products)
    const md = (id: string, n: number, name: string, image: string) =>
      `---\nid: ${id}\nnumeric_id: ${n}\nname: ${name}\ncategory: brot\nprice: 1.5\navailable: true\nseasonal: false\nimage: "${image}"\nshort_description: "Nur für Tests."\n---\n\n# ${name}\n`
    fs.writeFileSync(
      path.join(products, '1-testbrot-500g.md'),
      md(
        'testbrot-500g',
        1,
        'Testbrot 500g',
        '/assets/images/products/brot-rund.svg'
      )
    )
    fs.writeFileSync(
      path.join(products, '2-probebrot.md'),
      md('probebrot', 2, 'Probebrot', 'images/')
    )
    process.env.HQ_PRODUCTS_DIR = products
    process.env.LANDING_PRODUKTBILDER_INDEX = path.join(tmp, 'index.json')
  })
  afterEach(() => {
    process.env = { ...env }
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('ohne Index-Datei: genau die Felder und Bilder wie bisher', () => {
    const products = loadProducts()
    expect(products.map((p) => p.image)).toEqual([
      '/assets/images/products/brot-rund.svg',
      '/assets/images/products/brot-rund.svg',
    ])
    for (const p of products) expect(p).not.toHaveProperty('renderedImage')
    for (const p of getHQProducts()) {
      expect(p).not.toHaveProperty('renderedImage')
    }
  })

  it('mit Index: das Produkt mit Bild bekommt es, das andere bleibt', () => {
    fs.writeFileSync(
      process.env.LANDING_PRODUKTBILDER_INDEX as string,
      JSON.stringify(INDEX)
    )
    const [testbrot, probebrot] = loadProducts()
    expect(testbrot.image).toBe(GERENDERT.src)
    expect(testbrot.imageUrl).toBe(GERENDERT.src)
    expect(testbrot.renderedImage).toEqual(GERENDERT)
    expect(probebrot.image).toBe('/assets/images/products/brot-rund.svg')
    expect(probebrot).not.toHaveProperty('renderedImage')
  })

  it('ein kaputter Index bricht den Build, statt still ohne Bilder zu bauen', () => {
    fs.writeFileSync(
      process.env.LANDING_PRODUKTBILDER_INDEX as string,
      '{"version":9}'
    )
    expect(() => loadProducts()).toThrow(/version 1/)
  })
})
