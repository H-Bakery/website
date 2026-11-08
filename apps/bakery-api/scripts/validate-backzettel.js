#!/usr/bin/env node
// Prueft hq/config/backzettel.yaml gegen das Schema (Z1).
//
//   node apps/bakery-api/scripts/validate-backzettel.js <backzettel.yaml> [productsDir] [--json]
//
// productsDir: das hq-Produktverzeichnis; ohne Angabe `products/` in der hq-Wurzel
// (hq-Layout: config/backzettel.yaml neben products/). Fehlt es, werden
// Produkt-IDs nicht geprueft (Warnung). Rezeptpfade in `fillings[].recipe`
// werden relativ zur hq-Wurzel (das Verzeichnis ueber `config/`) aufgeloest.
//
// Offene Stammdaten (ausdrueckliches `null`, Z10) stehen als „Offen (n)“ da -
// weder Fehler noch Warnung. Eine Fuellung ohne `recipe` ist eine Warnung
// (Fuellung ohne Rezept), eine fehlende oder unlesbare Rezeptdatei ein Fehler.
//
// Exit-Code 1 bei Fehlern, 0 sonst (Warnungen brechen nicht ab). Das hq-CI
// (H2) uebernimmt diese Datei samt Loader und den zwei Cores in src/services
// (backzettel-config.loader.js, backzettel-config.core.js, backzettel-recipes.core.js).

const fs = require('fs')
const path = require('path')
const loader = require('../src/services/backzettel-config.loader')

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'))
  const json = argv.includes('--json')
  const [yamlPath, productsArg] = args
  if (!yamlPath) {
    process.stderr.write(
      'Aufruf: validate-backzettel.js <backzettel.yaml> [productsDir] [--json]\n'
    )
    return 2
  }
  const hqRoot = path.resolve(path.dirname(yamlPath), '..')
  const productsDir = productsArg
    ? path.resolve(productsArg)
    : path.join(hqRoot, 'products')

  const warnings = []
  let products
  if (fs.existsSync(productsDir) && fs.statSync(productsDir).isDirectory()) {
    products = loader.readProductCatalog(productsDir)
  } else {
    warnings.push({
      path: '',
      message: `Produktverzeichnis ${productsDir} fehlt; Produkt-IDs werden nicht geprüft.`,
    })
  }

  const result = loader.loadBackzettelConfig(yamlPath, { products })
  const errors = [...result.errors]
  warnings.push(...result.warnings)
  const open = result.open || []

  if (result.ok) {
    const { missing } = loader.loadFillingRecipes(result.config, hqRoot)
    for (const m of missing) {
      const i = result.config.fillings.findIndex((f) => f.id === m.id)
      const entry = { path: `fillings[${i}].recipe`, message: m.message }
      if (m.noRecipe) warnings.push(entry)
      else errors.push(entry)
    }
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: errors.length === 0,
          file: yamlPath,
          products: products ? products.length : null,
          errors,
          warnings,
          open,
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
    if (open.length > 0) {
      process.stdout.write(`Offen (${open.length}):\n`)
      for (const o of open)
        process.stdout.write(`Offen    ${o.path}: ${o.message}\n`)
    }
    const summary =
      errors.length === 0
        ? `OK: ${yamlPath} ist gültig (${result.config.items.length} Posten${
            products ? `, ${products.length} Produkte geprüft` : ''
          }, ${warnings.length} Warnungen, ${open.length} offen).`
        : `${errors.length} Fehler in ${yamlPath}${
            open.length > 0 ? ` (${open.length} offen)` : ''
          }.`
    process.stdout.write(summary + '\n')
  }
  return errors.length === 0 ? 0 : 1
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2))
}

module.exports = { main }
