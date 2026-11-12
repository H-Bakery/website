import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  findMonorepoRoot,
  parseHqProduct,
  readHqProducts,
  resolveHqProductsDir,
} from './index'

// Nur erfundene Produkte - echte Daten liegen in hq.
const TESTBROT = `---
id: testbrot-500g
numeric_id: 2
name: Testbrot 500g
category: brot
price: 1.5
weight: 500g
available: true
seasonal: false
image: ""
short_description: "Ein Brot nur für Tests."
---

# Testbrot 500g

Erster Absatz.

## Zwischenüberschrift

Zweiter Absatz.
`

describe('parseHqProduct', () => {
  it('liest das Frontmatter und den Text ohne die erste Überschrift', () => {
    expect(parseHqProduct(TESTBROT, '2-testbrot-500g.md')).toEqual({
      file: '2-testbrot-500g.md',
      id: 'testbrot-500g',
      numeric_id: 2,
      name: 'Testbrot 500g',
      category: 'brot',
      price: 1.5,
      available: true,
      seasonal: false,
      image: '',
      weight: '500g',
      short_description: 'Ein Brot nur für Tests.',
      body: 'Erster Absatz.\n\n## Zwischenüberschrift\n\nZweiter Absatz.',
    })
  })

  it('erfindet nichts: fehlende Felder bleiben undefined, der Text leer', () => {
    const product = parseHqProduct(
      '---\nid: testkeks\nname: Testkeks\ncategory: teilchen\n---\n'
    )
    expect(product).toMatchObject({ id: 'testkeks', body: '', file: '' })
    expect(product?.price).toBeUndefined()
    expect(product?.numeric_id).toBeUndefined()
    expect(product?.available).toBeUndefined()
    expect(product?.weight).toBeUndefined()
    expect(product?.short_description).toBeUndefined()
  })

  it('lässt einen Text stehen, der nur aus der Überschrift besteht (Verhalten der Landingpage)', () => {
    expect(
      parseHqProduct('---\nid: testkeks\nname: Testkeks\n---\n\n# Testkeks\n')
        ?.body
    ).toBe('# Testkeks')
  })

  it('gibt null zurück, wenn id oder name fehlen', () => {
    expect(parseHqProduct('---\nname: Ohne ID\n---\n')).toBeNull()
    expect(parseHqProduct('---\nid: ohne-name\n---\n')).toBeNull()
    expect(parseHqProduct('kein Frontmatter')).toBeNull()
  })

  it('wirft bei kaputtem YAML', () => {
    expect(() => parseHqProduct('---\nid: [offen\n---\n')).toThrow()
  })
})

describe('readHqProducts', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-products-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('meldet ein fehlendes Verzeichnis, statt etwas zu erfinden', () => {
    const missing = path.join(dir, 'gibt-es-nicht')
    expect(readHqProducts({ dir: missing })).toEqual({
      dir: missing,
      found: false,
      products: [],
    })
  })

  it('liest *.md, überspringt Vorlage, Fremdes und kaputte Dateien', () => {
    fs.writeFileSync(path.join(dir, '2-testbrot-500g.md'), TESTBROT)
    fs.writeFileSync(
      path.join(dir, '_template.md'),
      '---\nid: vorlage\nname: Vorlage\n---\n'
    )
    fs.writeFileSync(path.join(dir, 'notiz.txt'), 'kein Produkt')
    fs.writeFileSync(path.join(dir, '9-kaputt.md'), '---\nid: [offen\n---\n')
    fs.writeFileSync(path.join(dir, '8-ohne-name.md'), '---\nid: x\n---\n')

    const result = readHqProducts({ dir })
    expect(result.found).toBe(true)
    expect(result.products.map((p) => p.id)).toEqual(['testbrot-500g'])
    expect(result.products[0].file).toBe('2-testbrot-500g.md')
  })

  it('nimmt HQ_PRODUCTS_DIR aus der übergebenen Umgebung', () => {
    fs.writeFileSync(path.join(dir, '2-testbrot-500g.md'), TESTBROT)
    const result = readHqProducts({ env: { HQ_PRODUCTS_DIR: dir } })
    expect(result.dir).toBe(dir)
    expect(result.products).toHaveLength(1)
  })
})

describe('resolveHqProductsDir / findMonorepoRoot', () => {
  it('HQ_PRODUCTS_DIR gewinnt', () => {
    expect(
      resolveHqProductsDir({ env: { HQ_PRODUCTS_DIR: '/irgendwo/produkte' } })
    ).toBe('/irgendwo/produkte')
  })

  it('sonst <monorepo>/../hq/products, gesucht ab cwd aufwärts über nx.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-root-'))
    try {
      const app = path.join(root, 'website', 'apps', 'beispiel')
      fs.mkdirSync(app, { recursive: true })
      fs.writeFileSync(path.join(root, 'website', 'nx.json'), '{}')
      expect(findMonorepoRoot(app)).toBe(path.join(root, 'website'))
      expect(resolveHqProductsDir({ env: {}, cwd: app })).toBe(
        path.join(root, 'hq', 'products')
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
