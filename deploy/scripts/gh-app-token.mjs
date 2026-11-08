#!/usr/bin/env node
// gh-app-token.mjs - holt ein GitHub-App-Installationstoken für genau ein
// Repository (Q3). Nur Node-Bordmittel (node:crypto, fetch), keine
// Abhängigkeiten - läuft aus /opt/bakery/bin, ohne Release und node_modules.
//
//   node gh-app-token.mjs OWNER/REPO
//
// Ablauf: App-JWT (RS256, 10 min) mit dem privaten Schlüssel signieren,
//   GET  /repos/OWNER/REPO/installation              -> Installations-ID
//   POST /app/installations/ID/access_tokens         -> Token (1 h gültig)
// mit `repositories: [REPO]` und - Vorgabe - nur Contents + Pull requests
// schreiben (least privilege: das Token taugt für kein anderes Repository
// der Installation und für keine anderen Rechte).
//
// Umgebung:
//   GH_APP_ID           App-ID (oder Client-ID) der GitHub-App, Aussteller des JWT
//   GH_APP_KEY          privater Schlüssel (.pem), Vorgabe /etc/bakery/github-app.pem
//   GH_APP_PERMISSIONS  Vorgabe "contents:write,pull_requests:write";
//                       "-" = alle Rechte der Installation
//   GITHUB_API_URL      Vorgabe https://api.github.com (Tests: lokaler Fake-Server)
//
// stdout: genau eine Zeile, das Token (hq-token.sh leitet sie in eine Datei).
// stderr: Meldungen - nie das Token, nie das JWT, nie der Schlüssel.
//
// Exit-Codes: 0 ok · 2 Konfiguration (App-ID, Schlüssel, Repo, App-ID passt
//   nicht zum Schlüssel) · 3 GitHub nicht erreichbar oder unerwartete Antwort
//   · 4 App für das Repository nicht installiert oder Rechte fehlen
import { createPrivateKey, createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const DEFAULT_KEY = '/etc/bakery/github-app.pem'
const DEFAULT_PERMISSIONS = 'contents:write,pull_requests:write'
const TIMEOUT_MS = 20_000

function log(message) {
  process.stderr.write(`[gh-app-token] ${message}\n`)
}

function fail(code, message) {
  log(`FEHLER: ${message}`)
  process.exit(code)
}

const b64url = (input) => Buffer.from(input).toString('base64url')

/** App-JWT: 60 s rückdatiert (Uhrabweichung), 9 min gültig (GitHub: höchstens 10). */
function appJwt(appId, key) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })
  )
  const data = `${header}.${payload}`
  const signature = createSign('RSA-SHA256').update(data).sign(key)
  return `${data}.${b64url(signature)}`
}

/** "contents:write,pull_requests:write" -> { contents: 'write', ... }; "-" -> null. */
function parsePermissions(raw) {
  const value = (raw ?? DEFAULT_PERMISSIONS).trim()
  if (value === '-' || value === '') return null
  const permissions = {}
  for (const part of value.split(',')) {
    const match = /^\s*([a-z_]+)\s*:\s*(read|write|admin)\s*$/.exec(part)
    if (!match) {
      fail(2, `GH_APP_PERMISSIONS: "${part}" ist nicht NAME:read|write|admin`)
    }
    permissions[match[1]] = match[2]
  }
  return permissions
}

/** GitHubs eigene Fehlermeldung (ohne Header, ohne Token), gekürzt. */
async function githubMessage(response) {
  try {
    const body = await response.json()
    return typeof body?.message === 'string' ? body.message.slice(0, 200) : ''
  } catch {
    return ''
  }
}

async function call(api, path, jwt, init = {}) {
  try {
    return await fetch(`${api}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bakery-box-hq-token',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch (error) {
    fail(
      3,
      `GitHub nicht erreichbar (${api}): ${
        error?.cause?.code ?? error?.name ?? 'Netzfehler'
      }`
    )
  }
}

async function main() {
  const target = process.argv[2] ?? ''
  const repoMatch = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(target)
  if (!repoMatch || process.argv.length > 3) {
    fail(2, 'Aufruf: gh-app-token.mjs OWNER/REPO')
  }
  const [, owner, repo] = repoMatch

  const appId = (process.env.GH_APP_ID ?? '').trim()
  if (!/^[A-Za-z0-9.]+$/.test(appId)) {
    fail(2, 'GH_APP_ID ist leer oder ungültig (App-ID der GitHub-App, ops.env)')
  }
  const keyPath = (process.env.GH_APP_KEY ?? '').trim() || DEFAULT_KEY
  let key
  try {
    key = createPrivateKey(readFileSync(keyPath))
  } catch (error) {
    fail(
      2,
      error?.code === 'ENOENT'
        ? `privater Schlüssel ${keyPath} fehlt (GH_APP_KEY)`
        : `privater Schlüssel ${keyPath} ist nicht lesbar oder kein PEM-Schlüssel`
    )
  }
  if (key.asymmetricKeyType !== 'rsa') {
    fail(
      2,
      `${keyPath} ist kein RSA-Schlüssel (GitHub-Apps signieren mit RS256)`
    )
  }
  const permissions = parsePermissions(process.env.GH_APP_PERMISSIONS)
  const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(
    /\/+$/,
    ''
  )
  if (!/^https?:\/\//.test(api)) fail(2, 'GITHUB_API_URL muss http(s) sein')

  const jwt = appJwt(appId, key)

  const installation = await call(
    api,
    `/repos/${owner}/${repo}/installation`,
    jwt
  )
  if (installation.status === 401) {
    fail(
      2,
      `GitHub lehnt das App-JWT ab (HTTP 401) - passen GH_APP_ID und Schlüssel zusammen? Uhrzeit der Box richtig? ${await githubMessage(
        installation
      )}`
    )
  }
  if (installation.status === 404) {
    fail(
      4,
      `die App ist für ${owner}/${repo} nicht installiert (HTTP 404) - auf GitHub unter Settings → GitHub Apps freigeben`
    )
  }
  if (!installation.ok) {
    fail(
      3,
      `Installation von ${owner}/${repo} nicht lesbar (HTTP ${
        installation.status
      }) ${await githubMessage(installation)}`
    )
  }
  const { id } = await installation.json().catch(() => ({}))
  if (!Number.isSafeInteger(id) || id <= 0) {
    fail(3, 'GitHub hat keine Installations-ID geschickt')
  }

  const minted = await call(
    api,
    `/app/installations/${id}/access_tokens`,
    jwt,
    {
      method: 'POST',
      body: JSON.stringify({
        repositories: [repo],
        ...(permissions ? { permissions } : {}),
      }),
    }
  )
  if (minted.status === 422 || minted.status === 403) {
    fail(
      4,
      `GitHub verweigert das Token (HTTP ${
        minted.status
      }) - hat die Installation die Rechte ${JSON.stringify(
        permissions ?? 'alle'
      )} für ${owner}/${repo}? ${await githubMessage(minted)}`
    )
  }
  if (!minted.ok) {
    fail(
      3,
      `Token für ${owner}/${repo} nicht erhalten (HTTP ${
        minted.status
      }) ${await githubMessage(minted)}`
    )
  }
  const body = await minted.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token : ''
  // Druckbares ASCII ohne Leerzeichen - eine zweite Zeile gelangte sonst in
  // die Token-Datei und von dort in git (password=...).
  if (!/^[\x21-\x7e]{1,4096}$/.test(token)) {
    fail(3, 'GitHub hat kein brauchbares Token geschickt')
  }
  process.stdout.write(`${token}\n`)
  log(
    `Token für ${owner}/${repo} (Installation ${id}) gültig bis ${
      typeof body.expires_at === 'string' ? body.expires_at : 'unbekannt'
    }`
  )
}

await main()
