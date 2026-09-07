/**
 * Server-seitiger Loader für `hq/data/finance/finance-summary.json`.
 *
 * Muster wie `lib/products.ts`: `HQ_FINANCE_DIR` überschreibt, sonst
 * `<website>/../hq/data/finance`. Fehlt Verzeichnis oder Datei (etwa in CI),
 * wird das protokolliert und `{ status: 'no-data' }` zurückgegeben - anders
 * als bei den Produkten gibt es bewusst **keinen** Rückfall auf
 * Beispieldaten: lieber "keine Daten" als erfundene Zahlen.
 *
 * Schema-Prüfung und Bereinigung kommen aus `finance.core.js` im API-Projekt.
 * Der Loader liefert deshalb **nur die bereinigte** Fassung: Kontonummern,
 * Klarnamen und Einzelbuchungen sind hier schon nicht mehr enthalten, egal
 * was ein Aufrufer damit vorhat.
 *
 * Nur im Server-Kontext benutzen (liest das Dateisystem). Die Finanzseite
 * selbst holt ihre Daten über die rollengeschützten API-Endpunkte
 * (`lib/financeApi.ts`), weil der Next-Server der Management-App keine
 * Anmeldung prüft.
 */

import fs from 'fs'
import path from 'path'
import type { FinanceResult, FinanceSummary } from './financeTypes'

// Die einzige Implementierung von Schema-Prüfung und Sanitizer. Sie ist
// dependency-freies CommonJS im API-Projekt; eine zweite Fassung hier wäre
// genau die Kopie, die auseinanderlaufen kann. Der Querverweis ist für Nx und
// die Modulgrenzen-Regel ausgeblendet, damit `bakery-management` nicht als
// Abhängiger von `bakery-api` gilt (sonst würde `nx build` erst die API bauen).
interface FinanceCore {
  parseSummary: (
    text: string
  ) =>
    | { status: 'ok'; summary: FinanceSummary }
    | { status: 'no-data'; reason: string }
}

// Beide Marker müssen direkt über der Zeile stehen - deshalb einer davor, einer dahinter.
// nx-ignore-next-line
const financeCore: FinanceCore = require('../../../bakery-api/src/services/finance.core') // eslint-disable-line @typescript-eslint/no-var-requires, @nx/enforce-module-boundaries

export const FINANCE_SUMMARY_FILENAME = 'finance-summary.json'

function findMonorepoRoot(): string {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

/** `HQ_FINANCE_DIR` oder `<website>/../hq/data/finance`. */
export function getHQFinanceDir(): string {
  if (process.env.HQ_FINANCE_DIR) return process.env.HQ_FINANCE_DIR
  const root = findMonorepoRoot()
  return path.join(root, '..', 'hq', 'data', 'finance')
}

/**
 * Liest und bereinigt die Zusammenfassung. Wirft nie; jeder Fehlerfall wird
 * mit `console.warn` protokolliert und als `no-data` zurückgegeben.
 */
export function getFinanceSummary(): FinanceResult<FinanceSummary> {
  const dir = getHQFinanceDir()
  const file = path.join(dir, FINANCE_SUMMARY_FILENAME)

  if (!fs.existsSync(dir)) {
    console.warn(`HQ finance directory not found: ${dir}`)
    return {
      status: 'no-data',
      reason: 'Finanzdaten nicht gefunden (hq/data/finance fehlt).',
    }
  }
  if (!fs.existsSync(file)) {
    console.warn(`HQ finance summary not found: ${file}`)
    return {
      status: 'no-data',
      reason: 'Finanzdaten nicht gefunden (finance-summary.json fehlt).',
    }
  }

  let text: string
  try {
    text = fs.readFileSync(file, 'utf-8')
  } catch (err) {
    console.warn(`HQ finance summary not readable: ${file}`, err)
    return { status: 'no-data', reason: 'Finanzdaten nicht lesbar.' }
  }

  const parsed = financeCore.parseSummary(text)
  if (parsed.status !== 'ok') {
    console.warn(`HQ finance summary rejected: ${parsed.reason}`)
    return { status: 'no-data', reason: parsed.reason }
  }
  return { status: 'ok', data: parsed.summary }
}
