import { BRAND_FACTS, CUSTOMER_REVIEWS, REVIEW_SUMMARY } from './brand'

describe('Markenfakten', () => {
  it('nennt Gründungsjahr und Adresse, wie sie im Impressum stehen', () => {
    expect(BRAND_FACTS.foundedYear).toBe(1933)
    expect(BRAND_FACTS.street).toBe('Eckstraße 3')
    expect(BRAND_FACTS.city).toBe('Homburg')
  })
})

describe('Kundenrezensionen', () => {
  it('zeigt nicht nur die Bestnoten', () => {
    // Nur die Fünf-Sterne-Stimmen zu zeigen wäre eine Auswahl, die den
    // Gesamteindruck verzerrt — genau das untersagt § 5b Abs. 3 UWG.
    const best = CUSTOMER_REVIEWS.filter((review) => review.stars === 5)
    expect(best.length).toBeLessThan(CUSTOMER_REVIEWS.length)
  })

  it('gibt jede Rezension mit Name, Note und Wortlaut wieder', () => {
    for (const review of CUSTOMER_REVIEWS) {
      expect(review.name.trim()).not.toBe('')
      expect(review.text.trim().length).toBeGreaterThan(10)
      expect(review.stars).toBeGreaterThanOrEqual(1)
      expect(review.stars).toBeLessThanOrEqual(5)
    }
  })

  it('hält die Zusammenfassung in einem darstellbaren Rahmen', () => {
    expect(REVIEW_SUMMARY.average).toBeGreaterThan(0)
    expect(REVIEW_SUMMARY.average).toBeLessThanOrEqual(5)
    expect(REVIEW_SUMMARY.count).toBeGreaterThan(0)
    // Ohne Quelle und Stand ist eine Bewertungszahl nicht nachprüfbar.
    expect(REVIEW_SUMMARY.source).toBeTruthy()
    expect(REVIEW_SUMMARY.asOf).toMatch(/^\d{4}/)
  })
})
