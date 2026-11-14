import { HOURS_INFO_ORDER, hoursInfo } from './dienstplanInfo'

// Intl setzt ein geschütztes Leerzeichen vor das €.
const plain = (text: string) => text.replace(/\u00a0/g, ' ')

describe('dienstplanInfo - Erklärtexte der Stunden', () => {
  it('jede Regel hat Titel und Text, du-Form', () => {
    for (const key of HOURS_INFO_ORDER) {
      const info = hoursInfo(key, { minijobLimitCents: 60300, year: '2026' })
      expect(info.title).not.toBe('')
      expect(info.paragraphs.length).toBeGreaterThan(0)
    }
    expect(hoursInfo('bisHeute').paragraphs.join(' ')).toContain('du')
  })

  it('Minijob-Grenze kommt aus der API, nie als feste Zahl im Text', () => {
    const text = (limit: number | null, year = '2026') =>
      plain(
        hoursInfo('minijob', { minijobLimitCents: limit, year }).paragraphs[0]
      )
    expect(text(60300)).toBe(
      'Ein Minijob darf im Monat höchstens 603,00 € verdienen (Stand 2026; die Grenze hängt am Mindestlohn).'
    )
    expect(text(63300, '2027')).toContain('633,00 € verdienen (Stand 2027')
    expect(text(null, '2031')).toBe(
      'Für 2031 ist noch keine Minijob-Grenze hinterlegt - dann prüft die App nicht.'
    )
  })
})
