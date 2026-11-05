#!/usr/bin/env node
/**
 * sqlite-tool.js - SQLite-Helfer für die Box-Skripte, ohne sqlite3-CLI.
 *
 * Nutzt das native npm-Modul `sqlite3` aus dem Release (node_modules), das
 * auch die API benutzt. Damit geht ein Online-Backup auch dann, wenn auf der
 * Box kein `sqlite3`-Kommandozeilenprogramm installiert ist.
 *
 *   node sqlite-tool.js selftest [APP_DIR]       native Modul laden + :memory: testen
 *   node sqlite-tool.js backup SRC DEST [APP_DIR] konsistente Kopie (VACUUM INTO) + Prüfung
 *   node sqlite-tool.js check DB [APP_DIR]       integrity_check + Zeilen je Tabelle
 *
 * APP_DIR (Argument oder Umgebung) ist das Verzeichnis, dessen node_modules
 * `sqlite3` enthält; Vorgabe /opt/bakery/current.
 *
 * Exit-Codes: 0 ok, 1 Prüfung fehlgeschlagen, 2 Aufruf falsch, 3 Modul fehlt.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

function loadSqlite(appDir) {
  const candidates = [appDir, process.env.APP_DIR, '/opt/bakery/current']
  for (const dir of candidates) {
    if (!dir) continue
    try {
      return createRequire(path.join(dir, 'package.json'))('sqlite3')
    } catch (err) {
      if (err && err.code !== 'MODULE_NOT_FOUND') {
        // Modul gefunden, aber das native Binary passt nicht (falsche
        // Architektur/ABI) - genau das soll O1 erkennen.
        console.error(`sqlite3 in ${dir} lädt nicht: ${err.message}`)
        process.exit(3)
      }
    }
  }
  console.error(
    `npm-Modul sqlite3 nicht gefunden (gesucht in: ${candidates
      .filter(Boolean)
      .join(', ')})`
  )
  process.exit(3)
}

function open(sqlite3, file, mode) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, mode, (err) =>
      err ? reject(err) : resolve(db)
    )
  })
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  )
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve()))
  )
}

function close(db) {
  return new Promise((resolve) => db.close(() => resolve()))
}

async function integrity(sqlite3, file) {
  const db = await open(sqlite3, file, sqlite3.OPEN_READONLY)
  try {
    const rows = await all(db, 'PRAGMA integrity_check')
    const result = rows.map((r) => Object.values(r)[0]).join('; ')
    const tables = await all(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    const counts = []
    for (const { name } of tables) {
      const quoted = '"' + name.replace(/"/g, '""') + '"'
      const [{ n }] = await all(db, `SELECT COUNT(*) AS n FROM ${quoted}`)
      counts.push({ table: name, rows: n })
    }
    return { ok: result === 'ok', result, counts }
  } finally {
    await close(db)
  }
}

async function selftest(appDir) {
  const sqlite3 = loadSqlite(appDir)
  const db = await open(
    sqlite3,
    ':memory:',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
  )
  await run(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
  await run(db, 'INSERT INTO t (v) VALUES (?)', ['ok'])
  const [{ v, version }] = await all(
    db,
    'SELECT v, sqlite_version() AS version FROM t'
  )
  await close(db)
  if (v !== 'ok') throw new Error('Selbsttest lieferte falschen Wert')
  console.log(
    `sqlite3 ok (SQLite ${version}, node ${process.version}, ${process.platform}/${process.arch})`
  )
}

async function backup(src, dest, appDir) {
  const sqlite3 = loadSqlite(appDir)
  if (!fs.existsSync(src)) {
    console.error(`Datenbank fehlt: ${src}`)
    process.exit(2)
  }
  if (fs.existsSync(dest)) fs.unlinkSync(dest)
  const db = await open(sqlite3, src, sqlite3.OPEN_READONLY)
  try {
    db.configure('busyTimeout', 15000)
    // VACUUM INTO schreibt eine konsistente Kopie aus einer Lese-Transaktion -
    // funktioniert online, auch im WAL-Modus, während die API weiterschreibt.
    await run(db, 'VACUUM INTO ?', [dest])
  } finally {
    await close(db)
  }
  const check = await integrity(sqlite3, dest)
  if (!check.ok) {
    console.error(`integrity_check der Kopie: ${check.result}`)
    process.exit(1)
  }
  console.log(`Kopie ok: ${dest}`)
}

async function check(file, appDir) {
  const sqlite3 = loadSqlite(appDir)
  if (!fs.existsSync(file)) {
    console.error(`Datenbank fehlt: ${file}`)
    process.exit(2)
  }
  const res = await integrity(sqlite3, file)
  console.log(`integrity_check: ${res.result}`)
  for (const { table, rows } of res.counts) {
    console.log(`  ${table.padEnd(32)} ${rows}`)
  }
  if (!res.ok) process.exit(1)
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  switch (cmd) {
    case 'selftest':
      return selftest(args[0])
    case 'backup':
      if (args.length < 2) break
      return backup(args[0], args[1], args[2])
    case 'check':
      if (args.length < 1) break
      return check(args[0], args[1])
  }
  console.error(
    'Aufruf: sqlite-tool.js selftest [APP_DIR] | backup SRC DEST [APP_DIR] | check DB [APP_DIR]'
  )
  process.exit(2)
}

main().catch((err) => {
  console.error(err && err.message ? err.message : String(err))
  process.exit(1)
})
