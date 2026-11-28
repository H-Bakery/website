// Nur im Next-Build: Für den Browser zählen allein die Termine, an denen
// das übliche Abholraster nicht gilt. Interne Notizen bleiben in hq.
const path = require('node:path')
const { resolveHqProductsDir } = require('../../libs/shared/hq-products/src')
const {
  loadKalender,
} = require('../../apps/bakery-api/src/services/kalender.loader')
const { entryFor } = require('../../apps/bakery-api/src/services/kalender.core')

function loadPickupCalendar(
  file = process.env.HQ_KALENDER_FILE ||
    path.resolve(resolveHqProductsDir(), '..', 'config', 'kalender.yaml')
) {
  const { status, calendar } = loadKalender(file)
  if (status !== 'ok') {
    if (status !== 'missing') {
      console.warn('Abholkalender konnte nicht geladen werden.')
    }
    return null
  }

  const exceptions = {}
  for (const { from, to } of calendar.entries) {
    const cursor = new Date(from)
    for (
      let date = from;
      date <= to;
      date = cursor.toISOString().slice(0, 10)
    ) {
      const entry = entryFor(calendar, date)
      if (entry) {
        exceptions[date] =
          entry.type === 'geschlossen' || entry.type === 'teigtag'
            ? 'geschlossen'
            : 'sonderzeiten'
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return exceptions
}
module.exports = { loadPickupCalendar }
