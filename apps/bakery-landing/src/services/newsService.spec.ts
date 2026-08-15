import { getAllNews, parsePublishedDate } from './newsService'

describe('newsService', () => {
  describe('parsePublishedDate', () => {
    it('parses German DD.MM.YYYY dates', () => {
      const d = parsePublishedDate('15.06.2022')
      expect(d.getFullYear()).toBe(2022)
      expect(d.getMonth()).toBe(5)
      expect(d.getDate()).toBe(15)
    })

    it('falls back to ISO parsing', () => {
      expect(parsePublishedDate('2024-01-02').getFullYear()).toBe(2024)
    })
  })

  describe('getAllNews', () => {
    it('returns the published posts sorted newest first', () => {
      const news = getAllNews()
      expect(news.map((n) => n.slug)).toEqual([
        'verkaufspartner-gesucht',
        'neue-abholstation',
        'aushilfe-gesucht',
      ])
      expect(news.map((n) => n.published)).toEqual([
        '25.07.2022',
        '24.07.2022',
        '15.06.2022',
      ])
      news.forEach((n) => {
        expect(n.image).toMatch(/^\/assets\/images\/news\/.+\.jpg$/)
      })
    })
  })
})
