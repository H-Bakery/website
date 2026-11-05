/**
 * hq-catalogue.ts (B5): the shared, cached product catalogue that partners
 * (B6) and preorders (B7) use for name + price snapshots.
 */
import * as fs from 'fs'
import * as path from 'path'

import {
  CATALOGUE_TTL_MS,
  catalogueFor,
  defaultProductsDir,
  getCatalogue,
  getProduct,
  HqCatalogue,
  invalidateCatalogue,
} from '../../src/services/hq-catalogue'
import { makeProductsDir, removeTempDirs, tempDir } from '../helpers/hqProducts'

afterAll(() => removeTempDirs())

describe('getCatalogue / getProduct (HQ_PRODUCTS_DIR)', () => {
  const saved = process.env['HQ_PRODUCTS_DIR']
  afterEach(() => {
    process.env['HQ_PRODUCTS_DIR'] = saved
  })

  it('read the dir named by HQ_PRODUCTS_DIR at call time', () => {
    const dir = makeProductsDir()
    process.env['HQ_PRODUCTS_DIR'] = dir
    expect(defaultProductsDir()).toBe(dir)
    expect(getCatalogue().map((p) => p.id)).toEqual([
      'kornbrot-500g',
      'kornbrot-1000g',
      'musterweck',
      'mustersemmel',
      'musterbaguette-klein',
    ])
    expect(getProduct('musterweck')).toMatchObject({
      name: 'Musterweck',
      price: 0.45,
    })
    expect(getProduct(13)?.id).toBe('musterweck')
    expect(getProduct('13')?.id).toBe('musterweck')
    expect(getProduct('gibt-es-nicht')).toBeNull()
  })

  it('hands out frozen products', () => {
    process.env['HQ_PRODUCTS_DIR'] = makeProductsDir()
    const product = getProduct('musterweck')
    expect(Object.isFrozen(product)).toBe(true)
    // A caller cannot change the cache for everyone else.
    const list = getCatalogue()
    list.pop()
    expect(getCatalogue()).toHaveLength(5)
  })

  it('shares one cache per directory', () => {
    const dir = makeProductsDir()
    expect(catalogueFor(dir)).toBe(catalogueFor(dir + path.sep))
  })
})

/** Pins the directory mtime to whole seconds (a Date round trip loses sub-ms precision). */
const PINNED = 1_700_000_000
const pinMtime = (dir: string) => fs.utimesSync(dir, PINNED, PINNED)

describe('HqCatalogue caching', () => {
  it('serves an in-place edit only after the TTL (or invalidate)', () => {
    const dir = makeProductsDir(['13-musterweck.md'])
    let now = 1_000_000
    pinMtime(dir)
    const catalogue = new HqCatalogue(dir, { now: () => now })
    expect(catalogue.get('musterweck')?.price).toBe(0.45)

    const file = path.join(dir, '13-musterweck.md')
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf-8').replace('price: 0.45', 'price: 0.5')
    )
    // In-place write: the directory mtime stays as it was.
    pinMtime(dir)

    now += CATALOGUE_TTL_MS - 1
    expect(catalogue.get('musterweck')?.price).toBe(0.45)
    now += 1
    expect(catalogue.get('musterweck')?.price).toBe(0.5)

    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf-8').replace('price: 0.5', 'price: 0.6')
    )
    pinMtime(dir)
    expect(catalogue.get('musterweck')?.price).toBe(0.5)
    catalogue.invalidate()
    expect(catalogue.get('musterweck')?.price).toBe(0.6)
  })

  it('re-reads at once when the directory mtime changes (git checkout)', () => {
    const dir = makeProductsDir(['13-musterweck.md'])
    const catalogue = new HqCatalogue(dir, { now: () => 0 })
    expect(catalogue.list()).toHaveLength(1)
    const src = path.join(dir, '13-musterweck.md')
    fs.writeFileSync(
      path.join(dir, '99-zweiter-weck.md'),
      fs
        .readFileSync(src, 'utf-8')
        .replace('id: musterweck', 'id: zweiter-weck')
        .replace('numeric_id: 13', 'numeric_id: 99')
    )
    const later = new Date(Date.now() + 5000)
    fs.utimesSync(dir, later, later)
    expect(catalogue.list().map((p) => p.id)).toEqual([
      'musterweck',
      'zweiter-weck',
    ])
  })

  it('skips templates, files without id/name and broken YAML', () => {
    const dir = makeProductsDir(['13-musterweck.md'])
    fs.writeFileSync(
      path.join(dir, '_template.md'),
      '---\nid: t\nname: T\n---\n'
    )
    fs.writeFileSync(path.join(dir, '50-ohne-id.md'), '---\nname: Ohne\n---\n')
    fs.writeFileSync(path.join(dir, '51-kaputt.md'), '---\nid: [kaputt\n---\n')
    fs.writeFileSync(path.join(dir, 'notiz.txt'), 'kein Produkt')
    const catalogue = new HqCatalogue(dir)
    expect(catalogue.list().map((p) => p.id)).toEqual(['musterweck'])
    expect(catalogue.files().map((f) => f.file)).toEqual([
      '13-musterweck.md',
      '50-ohne-id.md',
    ])
  })

  it('a missing directory is an empty catalogue, logged once', () => {
    const dir = path.join(tempDir('hq-gone-'), 'products')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const catalogue = new HqCatalogue(dir, { ttlMs: 0 })
      expect(catalogue.available()).toBe(false)
      expect(catalogue.list()).toEqual([])
      expect(catalogue.get('x')).toBeNull()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain('HQ products directory not found')
    } finally {
      warn.mockRestore()
    }
  })

  it('invalidateCatalogue() drops every shared cache', () => {
    const dir = makeProductsDir(['13-musterweck.md'])
    pinMtime(dir)
    const shared = catalogueFor(dir)
    expect(shared.list()).toHaveLength(1)
    fs.rmSync(path.join(dir, '13-musterweck.md'))
    pinMtime(dir)
    expect(shared.list()).toHaveLength(1)
    invalidateCatalogue()
    expect(shared.list()).toHaveLength(0)
  })
})
