/**
 * Z14: Grundmengen-Sonderspalten `base.vor_feiertag` / `base.samstag_ersatz`
 * über denselben Weg wie die Wochentage (`backzettel-base.core.js` +
 * `backzettel-config.editor.js`). Leer = nicht gesetzt (Schlüssel weg), nie
 * eine erfundene 0. Synthetische YAML aus `tests/fixtures`.
 */
const baseCore = require('../../src/services/backzettel-base.core')
const editor = require('../../src/services/backzettel-config.editor')
const configCore = require('../../src/services/backzettel-config.core')
const loader = require('../../src/services/backzettel-config.loader')
const { CONFIG_YAML } = require('../fixtures/backzettel-grundmengen.synthetic')

const config = configCore.normalizeConfig(
  loader.parseBackzettelYaml(CONFIG_YAML).data
)

function edit(body, text = CONFIG_YAML) {
  const cfg = configCore.normalizeConfig(loader.parseBackzettelYaml(text).data)
  const parsed = baseCore.parseBaseEdit(body, cfg)
  if (!parsed.ok) throw new Error(`${parsed.error}: ${parsed.message}`)
  return editor.applyBaseEdit(text, parsed.edit)
}

const parse = (body) => baseCore.parseBaseEdit(body, config)

describe('Z14: Sonderspalten vor_feiertag / samstag_ersatz', () => {
  it('parseBaseEdit nimmt die Spaltennamen, sonst nichts Neues', () => {
    expect(
      parse({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: '6' })
    ).toMatchObject({
      ok: true,
      edit: { weekday: 'vor_feiertag', value: 6 },
    })
    expect(
      parse({ itemId: 'kornbrot', weekday: 'feiertag', value: 1 })
    ).toMatchObject({ ok: false, error: 'invalid_weekday' })
    expect(
      parse({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: -1 })
    ).toMatchObject({ ok: false, error: 'invalid_quantity' })
  })

  it('setzen: Flow-Map bekommt das Paar hinten, Kommentar bleibt', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: 6 })
    expect(r.changed).toBe(true)
    expect(r.text).toContain(
      'base: { 2: 4, 3: 4, 4: 4, 5: 4, 6: null, vor_feiertag: 6 } # OFFEN: Samstag'
    )
    expect(r.after.items[0].base.vor_feiertag).toBe(6)
  })

  it('setzen in einer Block-Map', () => {
    const r = edit({
      itemId: 'musterweck',
      weekday: 'samstag_ersatz',
      value: 90,
    })
    expect(r.text).toContain('      6: 60\n      samstag_ersatz: 90\n')
  })

  it('Posten ohne base bekommt die Spalte', () => {
    const r = edit({
      itemId: 'mustersemmel',
      weekday: 'vor_feiertag',
      value: 30,
    })
    expect(r.after.items[2].base).toEqual({ vor_feiertag: 30 })
  })

  it('leeren = Spalte entfernen; zurück auf den Ausgangstext', () => {
    const set = edit({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: 6 })
    const back = edit(
      { itemId: 'kornbrot', weekday: 'vor_feiertag', value: '' },
      set.text
    )
    expect(back.changed).toBe(true)
    expect(back.text).toBe(CONFIG_YAML)

    const block = edit({
      itemId: 'musterweck',
      weekday: 'samstag_ersatz',
      value: 90,
    })
    expect(
      edit(
        { itemId: 'musterweck', weekday: 'samstag_ersatz', value: null },
        block.text
      ).text
    ).toBe(CONFIG_YAML)
  })

  it('leer ohne Spalte = keine Änderung (Null-Diff)', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: null })
    expect(r).toMatchObject({ ok: true, changed: false })
    expect(r.text).toBe(CONFIG_YAML)
  })

  it('gleicher Wert noch einmal = Null-Diff', () => {
    const set = edit({ itemId: 'plunder', weekday: 'vor_feiertag', value: 12 })
    const again = edit(
      { itemId: 'plunder', weekday: 'vor_feiertag', value: 12 },
      set.text
    )
    expect(again.changed).toBe(false)
    expect(again.text).toBe(set.text)
  })

  it('Sorten: neue Spalte lässt die übrigen Sorten offen, nie 0', () => {
    const r = edit({
      itemId: 'zopf-gefuellt',
      weekday: 'samstag_ersatz',
      variants: { nuss: 5 },
    })
    expect(r.after.items[4].base.samstag_ersatz).toEqual({
      nuss: 5,
      mohn: null,
    })
    const cleared = edit(
      {
        itemId: 'zopf-gefuellt',
        weekday: 'samstag_ersatz',
        variants: { nuss: '' },
      },
      r.text
    )
    expect(cleared.text).toBe(CONFIG_YAML)
  })

  it('normalisiert landet die Spalte in baseSpecial, nicht unter base', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 'vor_feiertag', value: 6 })
    const item = configCore.normalizeConfig(r.after).items[0]
    expect(item.baseSpecial).toEqual({ vor_feiertag: 6 })
    expect(Object.keys(item.base)).not.toContain('vor_feiertag')
  })

  it('Commit-Nachricht nennt die Spalte', () => {
    const p = parse({ itemId: 'kornbrot', weekday: 'samstag_ersatz', value: 1 })
    expect(baseCore.commitMessage(p.edit, { id: 7 })).toMatch(
      /^config: Grundmenge Kornbrot \(kornbrot\) Samstags-Satz geändert/
    )
  })
})
