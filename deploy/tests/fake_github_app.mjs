#!/usr/bin/env node
// fake_github_app.mjs - Attrappe der GitHub-API für deploy/tests/run-tests.sh
// (Q3): prüft das App-JWT von gh-app-token.mjs (RS256 gegen den öffentlichen
// Testschlüssel) und gibt ein synthetisches Installationstoken aus. Nur
// 127.0.0.1, kein Netz.
//
//   node fake_github_app.mjs PORT LOGFILE PUBKEY MODEFILE
//
// MODEFILE wird bei jeder Anfrage gelesen: ok (Vorgabe) | not-installed |
// forbidden | bad-token | error. Ins LOGFILE kommt je Anfrage eine Zeile mit
// Methode, Pfad, JWT-Befund, Headern und Body - nie das ausgegebene Token.
import { createPublicKey, verify } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const [port, logFile, pubFile, modeFile] = process.argv.slice(2)
const publicKey = createPublicKey(readFileSync(pubFile))
const FAKE_TOKEN = 'ghs_syntheticFakeToken0815'
const INSTALLATION_ID = 4242

function mode() {
  try {
    return readFileSync(modeFile, 'utf8').trim() || 'ok'
  } catch {
    return 'ok'
  }
}

const log = (line) => appendFileSync(logFile, `${line}\n`)
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString())

/** Prüft "Bearer <JWT>" wie GitHub: RS256, Signatur, iat/exp. */
function checkJwt(header) {
  const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(header ?? '')
  if (!match) return { ok: false, why: 'kein Bearer-JWT' }
  const [, h, p, s] = match
  let head
  let claims
  try {
    head = decode(h)
    claims = decode(p)
  } catch {
    return { ok: false, why: 'kein JSON' }
  }
  if (head.alg !== 'RS256' || head.typ !== 'JWT') {
    return { ok: false, why: `header=${JSON.stringify(head)}` }
  }
  const signed = verify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`),
    publicKey,
    Buffer.from(s, 'base64url')
  )
  if (!signed) return { ok: false, why: 'signatur' }
  const now = Math.floor(Date.now() / 1000)
  if (claims.exp - claims.iat > 600 || claims.exp <= now) {
    return { ok: false, why: 'exp' }
  }
  return {
    ok: true,
    info: `iss=${claims.iss} span=${claims.exp - claims.iat} backdated=${
      now - claims.iat
    }`,
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    const jwt = checkJwt(req.headers.authorization)
    log(
      [
        req.method,
        req.url,
        jwt.ok ? `jwt=ok ${jwt.info}` : `jwt=FEHLER(${jwt.why})`,
        `accept=${req.headers.accept}`,
        `api=${req.headers['x-github-api-version']}`,
        `ua=${req.headers['user-agent']}`,
        `type=${req.headers['content-type'] ?? '-'}`,
        `body=${body || '-'}`,
      ].join(' ')
    )
    if (!jwt.ok) {
      return send(res, 401, {
        message: 'A JSON web token could not be decoded',
      })
    }
    const current = mode()
    if (current === 'error') return send(res, 502, { message: 'Bad Gateway' })

    if (
      req.method === 'GET' &&
      /^\/repos\/[^/]+\/[^/]+\/installation$/.test(req.url)
    ) {
      if (current === 'not-installed') {
        return send(res, 404, { message: 'Not Found' })
      }
      return send(res, 200, { id: INSTALLATION_ID })
    }
    if (
      req.method === 'POST' &&
      req.url === `/app/installations/${INSTALLATION_ID}/access_tokens`
    ) {
      if (current === 'forbidden') {
        return send(res, 422, {
          message:
            'The permissions requested are not granted to this installation.',
        })
      }
      if (current === 'bad-token') {
        return send(res, 201, { token: 'ghs_eins\nusername=zwei' })
      }
      return send(res, 201, {
        token: FAKE_TOKEN,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
    }
    send(res, 404, { message: 'Not Found' })
  })
}).listen(Number(port), '127.0.0.1')
