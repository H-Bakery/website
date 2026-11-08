/**
 * B7 variants hook: which Sorten a product has according to the Backzettel
 * master data (synthetic `tests/fixtures/backzettel.synthetic.js`).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as yaml from 'js-yaml'

import {
  createVariantsHook,
  defaultBackzettelConfigPath,
} from '../../src/services/preorder-variants'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-b7-variants-'))
  file = path.join(dir, 'backzettel.yaml')
})

afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('createVariantsHook', () => {
  it('reads the variants of the item a product belongs to', () => {
    fs.writeFileSync(file, yaml.dump(fixture.config()))
    const hook = createVariantsHook({ configPath: file })
    expect(hook('test-zopf-gefuellt')).toEqual({
      itemId: 'zopf-gefuellt',
      variants: ['nuss', 'mohn'],
    })
    expect(hook('test-kranz-gefuellt-viertel')?.variants).toEqual([
      'nuss',
      'mohn',
    ])
    expect(hook('test-weck')).toEqual({ itemId: 'weck', variants: [] })
    expect(hook('nicht-im-backzettel')).toBeNull()
  })

  it('lists every product with Sorten at once (P1 variant chips)', () => {
    fs.writeFileSync(file, yaml.dump(fixture.config()))
    const hook = createVariantsHook({ configPath: file })
    expect(hook.all()).toEqual({
      'test-zopf-gefuellt': ['nuss', 'mohn'],
      'test-kranz-gefuellt': ['nuss', 'mohn'],
      'test-kranz-gefuellt-viertel': ['nuss', 'mohn'],
    })
  })

  it('Z10: a size product names its size and takes no Sorte', () => {
    fs.writeFileSync(file, yaml.dump(fixture.configV2()))
    const hook = createVariantsHook({ configPath: file })
    expect(hook('test-korn-1000')).toEqual({
      itemId: 'test-korn',
      variants: [],
      size: 'g1000',
    })
    expect(hook('test-zopf-v2')).toEqual({
      itemId: 'test-zopf',
      variants: ['nuss', 'mohn'],
    })
    expect(hook.all()).toEqual({ 'test-zopf-v2': ['nuss', 'mohn'] })
  })

  it('lists nothing (null) without a file', () => {
    expect(createVariantsHook({ configPath: file }).all()).toBeNull()
  })

  it('answers null without a file (nothing to check)', () => {
    const hook = createVariantsHook({ configPath: file })
    expect(hook('test-zopf-gefuellt')).toBeNull()
  })

  it('answers null and warns once for an invalid file', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    fs.writeFileSync(file, 'version: 99\nitems: nope\n')
    const hook = createVariantsHook({ configPath: file, cacheMs: 0 })
    expect(hook('test-zopf-gefuellt')).toBeNull()
    expect(hook('test-zopf-gefuellt')).toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('re-reads after the cache time', () => {
    const hook = createVariantsHook({ configPath: file, cacheMs: 0 })
    expect(hook('test-zopf-gefuellt')).toBeNull()
    fs.writeFileSync(file, yaml.dump(fixture.config()))
    expect(hook('test-zopf-gefuellt')?.variants).toEqual(['nuss', 'mohn'])
  })

  it('finds the file like the Backzettel loader', () => {
    expect(
      defaultBackzettelConfigPath({ HQ_BACKZETTEL_CONFIG: '/x/b.yaml' })
    ).toBe(path.resolve('/x/b.yaml'))
    expect(defaultBackzettelConfigPath({ HQ_DIR: '/srv/hq' })).toBe(
      path.resolve('/srv/hq/config/backzettel.yaml')
    )
    expect(
      defaultBackzettelConfigPath({ HQ_PRODUCTS_DIR: '/srv/hq-read/products' })
    ).toBe(path.resolve('/srv/hq-read/config/backzettel.yaml'))
  })
})
