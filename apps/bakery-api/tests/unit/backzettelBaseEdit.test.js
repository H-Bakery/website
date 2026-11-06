/**
 * Z4: Grundmengen ändern - Prüfung der Anfrage (`backzettel-base.core.js`)
 * und die Textänderung in der YAML (`backzettel-config.editor.js`).
 *
 * Wichtigste Zusage: eine Änderung fasst genau einen Wert an (Kommentare,
 * Reihenfolge, Prettier-Schreibweise bleiben), eine Nicht-Änderung gar
 * nichts. Synthetische YAML aus `tests/fixtures`.
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

/** Geänderte Zeilen: [entfernt, hinzugefügt]. */
function lineDiff(a, b) {
  const count = (lines) =>
    lines.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map())
  const ma = count(a.split('\n'))
  const mb = count(b.split('\n'))
  const removed = []
  const added = []
  for (const [l, n] of ma)
    for (let i = mb.get(l) || 0; i < n; i += 1) removed.push(l)
  for (const [l, n] of mb)
    for (let i = ma.get(l) || 0; i < n; i += 1) added.push(l)
  return { removed, added }
}

describe('parseBaseEdit', () => {
  const parse = (body) => baseCore.parseBaseEdit(body, config)

  it('ganzer Tag: Zahl, null, „1,5"', () => {
    expect(parse({ itemId: 'kornbrot', weekday: 2, value: 5 })).toMatchObject({
      ok: true,
      edit: { itemId: 'kornbrot', weekday: 2, value: 5 },
    })
    expect(
      parse({ itemId: 'kornbrot', weekday: '6', value: null }).edit.value
    ).toBe(null)
    expect(
      parse({ itemId: 'kornbrot', weekday: 2, value: '1,5' }).edit.value
    ).toBe(1.5)
    expect(
      parse({ itemId: 'kornbrot', weekday: 2, value: '' }).edit.value
    ).toBe(null)
    expect(
      parse({ itemId: 'kornbrot', weekday: 2, value: 1.234 }).edit.value
    ).toBe(1.23)
  })

  it('je Sorte', () => {
    expect(
      parse({ itemId: 'zopf-gefuellt', weekday: 6, variants: { mohn: 2 } })
    ).toMatchObject({ ok: true, edit: { variants: { mohn: 2 } } })
  })

  it.each([
    [{}, 400, 'validation'],
    [{ itemId: 'gibtsnicht', weekday: 2, value: 1 }, 404, 'unknown_item'],
    [{ itemId: 'kornbrot', weekday: 1, value: 1 }, 400, 'invalid_weekday'],
    [{ itemId: 'kornbrot', weekday: 8, value: 1 }, 400, 'invalid_weekday'],
    [{ itemId: 'kornbrot', weekday: '06', value: 1 }, 400, 'invalid_weekday'],
    [{ itemId: 'kornbrot', weekday: 2 }, 400, 'validation'],
    [
      { itemId: 'kornbrot', weekday: 2, value: 1, variants: { a: 1 } },
      400,
      'validation',
    ],
    [{ itemId: 'kornbrot', weekday: 2, value: -1 }, 400, 'invalid_quantity'],
    [{ itemId: 'kornbrot', weekday: 2, value: 'abc' }, 400, 'invalid_quantity'],
    [{ itemId: 'kornbrot', weekday: 2, value: 99999 }, 400, 'invalid_quantity'],
    [{ itemId: 'kornbrot', weekday: 2, value: true }, 400, 'invalid_quantity'],
    [
      { itemId: 'kornbrot', weekday: 2, variants: { nuss: 1 } },
      400,
      'validation',
    ],
    [
      { itemId: 'zopf-gefuellt', weekday: 6, variants: { mohn: 2, apfel: 1 } },
      404,
      'unknown_variant',
    ],
    [{ itemId: 'zopf-gefuellt', weekday: 6, variants: {} }, 400, 'validation'],
  ])('%j → %i %s', (body, status, error) => {
    const res = parse(body)
    expect(res).toMatchObject({ ok: false, status, error })
    expect(res.message).toEqual(expect.any(String))
  })
})

describe('nextDayValue', () => {
  const zopf = config.items.find((i) => i.id === 'zopf-gefuellt')
  it('offener Tag (null) → übrige Sorten bleiben offen', () => {
    expect(
      baseCore.nextDayValue(null, { item: zopf, variants: { nuss: 3 } })
    ).toEqual({ nuss: 3, mohn: null })
  })
  it('Tag ohne Eintrag (= 0) → übrige Sorten fehlen (= 0)', () => {
    expect(
      baseCore.nextDayValue(undefined, { item: zopf, variants: { mohn: 2 } })
    ).toEqual({ mohn: 2 })
  })
  it('bestehende Sorten-Zuordnung wird ergänzt', () => {
    expect(
      baseCore.nextDayValue(
        { nuss: 4, mohn: null },
        { item: zopf, variants: { mohn: 1 } }
      )
    ).toEqual({ nuss: 4, mohn: 1 })
  })
})

describe('applyBaseEdit - Text', () => {
  it('ändert in einer Flow-Map genau den einen Wert (Kommentar bleibt)', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 3, value: 4.5 })
    expect(r).toMatchObject({ ok: true, changed: true })
    expect(lineDiff(CONFIG_YAML, r.text)).toEqual({
      removed: [
        '    base: { 2: 4, 3: 4, 4: 4, 5: 4, 6: null } # OFFEN: Samstag',
      ],
      added: [
        '    base: { 2: 4, 3: 4.5, 4: 4, 5: 4, 6: null } # OFFEN: Samstag',
      ],
    })
  })

  it('null → Zahl', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 6, value: 2 })
    expect(lineDiff(CONFIG_YAML, r.text).added).toEqual([
      '    base: { 2: 4, 3: 4, 4: 4, 5: 4, 6: 2 } # OFFEN: Samstag',
    ])
  })

  it('Zahl → null (noch nicht festgelegt)', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 2, value: null })
    expect(lineDiff(CONFIG_YAML, r.text).added).toEqual([
      '    base: { 2: null, 3: 4, 4: 4, 5: 4, 6: null } # OFFEN: Samstag',
    ])
  })

  it('fehlender Wochentag wird sortiert eingefügt (Flow)', () => {
    const r = edit({ itemId: 'kornbrot', weekday: 7, value: 1 })
    expect(lineDiff(CONFIG_YAML, r.text).added).toEqual([
      '    base: { 2: 4, 3: 4, 4: 4, 5: 4, 6: null, 7: 1 } # OFFEN: Samstag',
    ])
  })

  it('Block-Map: Wert mit Kommentar ändern', () => {
    const r = edit({ itemId: 'musterweck', weekday: 3, value: 25 })
    expect(lineDiff(CONFIG_YAML, r.text)).toEqual({
      removed: ['      3: 30 # Mittwoch schwächer'],
      added: ['      3: 25 # Mittwoch schwächer'],
    })
  })

  it('Block-Map: fehlender Wochentag an der richtigen Stelle', () => {
    const r = edit({ itemId: 'musterweck', weekday: 5, value: 45 })
    expect(r.text).toContain('      4: 40\n      5: 45\n      6: 60\n')
    expect(lineDiff(CONFIG_YAML, r.text)).toEqual({
      removed: [],
      added: ['      5: 45'],
    })
    const r7 = edit({ itemId: 'musterweck', weekday: 7, value: 80 })
    expect(r7.text).toContain(
      '      6: 60\n      7: 80\n\n  - id: mustersemmel'
    )
  })

  it('Posten ohne base bekommt eine Zeile, Kommentar davor bleibt', () => {
    const r = edit({ itemId: 'mustersemmel', weekday: 2, value: 12 })
    expect(r.text).toContain(
      '    plu: [904]\n    # noch keine Grundmengen\n    base: { 2: 12 }\n'
    )
    expect(lineDiff(CONFIG_YAML, r.text)).toEqual({
      removed: [],
      added: ['    base: { 2: 12 }'],
    })
  })

  it('Sorte in einer verschachtelten Flow-Map', () => {
    const r = edit({
      itemId: 'zopf-gefuellt',
      weekday: 6,
      variants: { mohn: 2 },
    })
    expect(lineDiff(CONFIG_YAML, r.text).added).toEqual([
      '    base: { 6: { nuss: 4, mohn: 2 } }',
    ])
  })

  it('Sorten an einem neuen Tag', () => {
    const r = edit({
      itemId: 'zopf-gefuellt',
      weekday: 7,
      variants: { nuss: 1, mohn: 1 },
    })
    expect(lineDiff(CONFIG_YAML, r.text).added).toEqual([
      '    base: { 6: { nuss: 4, mohn: null }, 7: { nuss: 1, mohn: 1 } }',
    ])
  })

  it('liefert das geparste Objekt vor und nach der Änderung', () => {
    const r = edit({ itemId: 'plunder', weekday: 6, value: 5 })
    const plunder = (o) => o.items.find((i) => i.id === 'plunder')
    expect(plunder(r.before).base['6']).toBe(0)
    expect(plunder(r.after).base['6']).toBe(5)
  })

  describe('Nicht-Änderung = Null-Diff', () => {
    it.each([
      [{ itemId: 'kornbrot', weekday: 2, value: 4 }],
      [{ itemId: 'kornbrot', weekday: 6, value: null }],
      [{ itemId: 'musterweck', weekday: 3, value: '30' }],
      [{ itemId: 'plunder', weekday: 6, value: 0 }],
      [{ itemId: 'zopf-gefuellt', weekday: 6, variants: { nuss: 4 } }],
      [
        {
          itemId: 'zopf-gefuellt',
          weekday: 6,
          variants: { nuss: 4, mohn: null },
        },
      ],
    ])('%j', (body) => {
      const r = edit(body)
      expect(r).toMatchObject({ ok: true, changed: false })
      expect(r.text).toBe(CONFIG_YAML)
    })

    it('jeder vorhandene Wert, noch einmal gespeichert', () => {
      for (const item of config.items) {
        for (const [wd, value] of Object.entries(item.base)) {
          const body =
            value !== null && typeof value === 'object'
              ? { itemId: item.id, weekday: Number(wd), variants: value }
              : { itemId: item.id, weekday: Number(wd), value }
          expect(edit(body).text).toBe(CONFIG_YAML)
        }
      }
    })
  })

  it('jeder Wert jedes Tages ändert genau eine Zeile', () => {
    for (const item of config.items) {
      for (const wd of config.days) {
        const body = item.variants.length
          ? {
              itemId: item.id,
              weekday: wd,
              variants: { [item.variants[0]]: 7 },
            }
          : { itemId: item.id, weekday: wd, value: 7 }
        const r = edit(body)
        expect(r.ok).toBe(true)
        if (!r.changed) continue
        const d = lineDiff(CONFIG_YAML, r.text)
        expect(d.added).toHaveLength(1)
        expect(d.removed.length).toBeLessThanOrEqual(1)
      }
    }
  })

  describe('weitere Schreibweisen', () => {
    const BLOCK = `items:
  - id: a
    variants: [nuss, mohn]
    base:
      6:
        nuss: 1
      7:
  - id: b
    base: { }
`
    const cfg = {
      version: 1,
      days: [2, 3, 4, 5, 6, 7],
      items: [
        { id: 'a', name: 'A', variants: ['nuss', 'mohn'] },
        { id: 'b', name: 'B', variants: [] },
      ],
    }
    const apply = (body) => {
      const p = baseCore.parseBaseEdit(body, cfg)
      return editor.applyBaseEdit(BLOCK, p.edit)
    }

    it('Sorte in einer Block-Map ergänzen', () => {
      expect(
        apply({ itemId: 'a', weekday: 6, variants: { mohn: 2 } }).text
      ).toContain('      6:\n        nuss: 1\n        mohn: 2\n      7:\n')
    })

    it('leerer Wert `7:` wird gesetzt', () => {
      expect(apply({ itemId: 'a', weekday: 7, value: 3 }).text).toContain(
        '      7: 3\n'
      )
    })

    it('Block-Sorten durch eine Gesamtzahl ersetzen', () => {
      expect(apply({ itemId: 'a', weekday: 6, value: null }).text).toContain(
        '    base:\n      6: null\n      7:\n'
      )
    })

    it('leere Flow-Map', () => {
      expect(apply({ itemId: 'b', weekday: 3, value: 1 }).text).toContain(
        '    base: { 3: 1 }\n'
      )
    })
  })

  it('Posten in Flow-Schreibweise ohne base: nicht automatisch', () => {
    const text = 'items:\n  - { id: x, name: X }\n'
    const r = editor.applyBaseEdit(text, {
      itemId: 'x',
      weekday: 2,
      item: { id: 'x', variants: [] },
      value: 1,
    })
    expect(r).toMatchObject({ ok: false, error: 'config_layout_unsupported' })
  })

  it('unlesbare YAML', () => {
    const r = editor.applyBaseEdit('items: [\n', {
      itemId: 'x',
      weekday: 2,
      item: { id: 'x', variants: [] },
      value: 1,
    })
    expect(r).toMatchObject({ ok: false, error: 'config_unreadable' })
  })
})

describe('newErrors / commitMessage', () => {
  it('nur neue Fehler zählen', () => {
    const a = { path: 'x', message: 'alt' }
    const b = { path: 'y', message: 'neu' }
    expect(baseCore.newErrors([a], [a, b])).toEqual([b])
    expect(baseCore.newErrors([a, b], [a])).toEqual([])
  })

  it('Commit-Nachricht mit Benutzer-ID, nie dem Login', () => {
    const msg = baseCore.commitMessage(
      { itemId: 'zopf-gefuellt', weekday: 6, item: { name: 'Zopf gefüllt' } },
      { id: 7, displayName: 'Test Bäcker', username: 'test.login' }
    )
    expect(msg).toBe(
      'config: Grundmenge Zopf gefüllt (zopf-gefuellt) Samstag geändert\n\nCo-authored-by: Test Bäcker <user-7@bakery.local>\n'
    )
    expect(msg).not.toContain('test.login')
  })
})
