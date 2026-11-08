import { notfallSections } from './BackzettelNotfallblatt'
import { TEST_CONFIG_V2 } from '../../lib/backzettelFixtures'

describe('Backzettel-Notfallblatt - Laibgrößen (Z10)', () => {
  it('je Laibgröße eine Zeile mit dem Namen der Größe', () => {
    const brot = notfallSections(TEST_CONFIG_V2).find((s) => s.id === 'brot')
    expect(brot?.rows).toEqual(
      expect.arrayContaining([
        'Testkorn – 500 g',
        'Testkorn – 1 kg',
        'Testkorn – Kasten',
        'Testholz – 500 g',
      ])
    )
    expect(brot?.rows.some((r) => r.includes('g500'))).toBe(false)
    const hefe = notfallSections(TEST_CONFIG_V2).find(
      (s) => s.id === 'hefeteig'
    )
    expect(hefe?.rows).toContain('Testzopf gefüllt – Testnussfüllung')
  })
})
