#!/usr/bin/env node
// Prüft hq/config/kalender.yaml (U9).
//
//   node apps/bakery-api/scripts/validate-kalender.js <kalender.yaml> [backzettel.yaml] [--json]
//
// backzettel.yaml: ohne Angabe `config/backzettel.yaml` neben dem Kalender.
// Ist sie lesbar und gültig, prüft der Validator auch `wie` gegen `days` und
// Teigtage gegen `dough_days`; sonst nur den Kalender (Warnung).
//
// Exit-Code 1 bei Fehlern, 0 sonst (auch wenn die Datei fehlt: ohne Kalender
// gilt der Wochenplan; ob das Fehlen ein Fehler ist, entscheidet das hq-CI).
// Das hq-CI übernimmt diese Datei samt kalender.loader.js und kalender.core.js.

const fs = require('fs')
const path = require('path')
const loader = require('../src/services/kalender.loader')
const configLoader = require('../src/services/backzettel-config.loader')

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'))
  const json = argv.includes('--json')
  const [yamlPath, configArg] = args
  if (!yamlPath) {
    process.stderr.write(
      'Aufruf: validate-kalender.js <kalender.yaml> [backzettel.yaml] [--json]\n'
    )
    return 2
  }
  const configPath = configArg
    ? path.resolve(configArg)
    : path.join(path.dirname(path.resolve(yamlPath)), 'backzettel.yaml')

  const warnings = []
  let config
  if (fs.existsSync(configPath)) {
    const loaded = configLoader.loadBackzettelConfig(configPath, {})
    if (loaded.ok) config = loaded.config
    else
      warnings.push({
        path: '',
        message: `${path.basename(
          configPath
        )} ist ungültig - wie/Teigtage werden nicht gegen den Wochenplan geprüft.`,
      })
  } else {
    warnings.push({
      path: '',
      message: `${configPath} fehlt - wie/Teigtage werden nicht gegen den Wochenplan geprüft.`,
    })
  }

  const result = loader.loadKalender(yamlPath, config ? { config } : undefined)
  warnings.push(...result.warnings)
  const errors = result.errors
  const entries = result.calendar ? result.calendar.entries.length : null

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: errors.length === 0,
          status: result.status,
          file: yamlPath,
          years: result.calendar ? result.calendar.years : null,
          entries,
          errors,
          warnings,
        },
        null,
        2
      ) + '\n'
    )
  } else {
    for (const w of warnings)
      process.stdout.write(`Warnung  ${w.path || '(Datei)'}: ${w.message}\n`)
    for (const e of errors)
      process.stdout.write(`FEHLER   ${e.path || '(Datei)'}: ${e.message}\n`)
    const summary =
      result.status === 'missing'
        ? `${yamlPath} fehlt - es gilt der Wochenplan.`
        : errors.length === 0
        ? `OK: ${yamlPath} ist gültig (Jahre ${result.calendar.years.join(
            ', '
          )}, ${entries} Einträge, ${warnings.length} Warnungen).`
        : `${errors.length} Fehler in ${yamlPath}.`
    process.stdout.write(summary + '\n')
  }
  return errors.length === 0 ? 0 : 1
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = { main }
