'use strict'

const fs = require('node:fs')
const path = require('node:path')
const transactions = require('./finance-transactions.core')

/** Verzeichnis der Finanzdaten, relativ zu `apps/bakery-api/`. */
function defaultFinanceDir() {
  return path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'hq',
    'data',
    'finance'
  )
}

function createFinanceTransactionSource(options = {}) {
  const financeDir =
    options.financeDir || process.env.HQ_FINANCE_DIR || defaultFinanceDir()
  const log = options.log || console
  const transactionsDir = path.join(financeDir, 'transactions')

  /** Monate mit Datei in `transactions/`, aufsteigend - wirft nie. */
  function transactionMonths() {
    try {
      return transactions.monthsFromFileNames(fs.readdirSync(transactionsDir))
    } catch {
      return []
    }
  }

  /** Rohzeilen eines Monats oder `null` (fehlt/ungültig) - wirft nie. */
  function readMonth(month) {
    if (!transactions.isValidMonth(month)) return null
    const file = path.join(transactionsDir, `${month}.json`)
    let text
    try {
      text = fs.readFileSync(file, 'utf-8')
    } catch {
      return null
    }
    const parsed = transactions.parseMonthFile(text)
    if (parsed.status !== 'ok' || parsed.month !== month) {
      log.warn(
        `[finance] Buchungen ${month} verworfen: ${
          parsed.reason || 'Monat passt nicht zum Dateinamen'
        }`
      )
      return null
    }
    return parsed.transactions
  }

  return { financeDir, log, transactionMonths, readMonth }
}

module.exports = { createFinanceTransactionSource, defaultFinanceDir }
