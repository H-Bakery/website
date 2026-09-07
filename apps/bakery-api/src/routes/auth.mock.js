/**
 * Minimale, aber echte JWT-Anmeldung für den Mock-Server (`simple-server.js`).
 *
 * Der Mock-Server hatte bislang keinerlei Auth. Die Finanzdaten aus `hq`
 * dürfen aber nur hinter einer Anmeldung mit Rollenprüfung ausgeliefert werden
 * (TASK-038, Datenschutz). Diese Datei liefert genau das Nötige:
 *
 *   POST /api/auth/login    { email | username, password }
 *                           → { success, data: { user, token, refreshToken, expiresIn } }
 *   GET  /api/auth/me       Bearer-Token → { success, data: user }
 *   POST /api/auth/refresh  { refreshToken } → { success, data: { token, expiresIn } }
 *   POST /api/auth/logout   → { success }
 *
 * Antwortformen und Token-Namen folgen dem, was `AuthProvider`
 * (`libs/shared/contexts/.../auth.context.tsx`) und `userService`
 * (`libs/shared/data-access/.../user.service.ts`) erwarten. Der `ApiClient`
 * setzt den `Authorization: Bearer <token>`-Header selbst.
 *
 * Benutzer kommen aus der Umgebung, nicht aus einer Datei:
 *   MOCK_ADMIN_USER / MOCK_ADMIN_PASSWORD   Rolle `admin` (Vorgabe admin/admin,
 *                                            beim Start als Warnung geloggt)
 *   MOCK_STAFF_USER / MOCK_STAFF_PASSWORD   Rolle `staff`, nur wenn beide gesetzt
 *   JWT_SECRET                              sonst pro Start zufällig - dann sind
 *                                            alte Tokens nach einem Neustart ungültig
 *
 * Fehlerantworten setzen `message` **und** `error`: der `ApiClient` wirft
 * `new Error(data.message)`, ein `error`-only-Body verschluckt den Text.
 */

'use strict'

const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60 // eine Schicht
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const DEFAULT_ADMIN_USER = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin'

/** Konstantzeit-Vergleich, damit ein Passwort nicht Zeichen für Zeichen erraten werden kann. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8')
  const bufB = Buffer.from(String(b), 'utf8')
  if (bufA.length !== bufB.length) {
    // Trotzdem vergleichen, damit die Laufzeit nicht die Länge verrät.
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

function sendError(res, status, error, message) {
  return res.status(status).json({ success: false, error, message })
}

/** `User`-Objekt in der Form von `@bakery/shared/types` - nie mit Passwort. */
function publicUser(account, now) {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    isActive: true,
    lastLogin: now,
    createdAt: account.createdAt,
    updatedAt: now,
  }
}

/**
 * Baut die Benutzerliste aus Umgebungsvariablen. Ein Benutzername ohne `@`
 * wird als lokale Adresse behandelt, damit `email` im `User`-Typ gefüllt ist.
 */
function usersFromEnv(env, log) {
  const startedAt = new Date().toISOString()
  const users = []

  const adminUser = env.MOCK_ADMIN_USER || DEFAULT_ADMIN_USER
  const adminPassword = env.MOCK_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD
  if (!env.MOCK_ADMIN_USER || !env.MOCK_ADMIN_PASSWORD) {
    log.warn(
      '[auth] MOCK_ADMIN_USER/MOCK_ADMIN_PASSWORD nicht gesetzt - ' +
        'Standardzugang admin/admin aktiv. Nur für die lokale Entwicklung.'
    )
  }
  users.push({
    id: 1,
    username: adminUser,
    email: adminUser.includes('@') ? adminUser : `${adminUser}@bakery.local`,
    password: adminPassword,
    firstName: 'Inhaber',
    lastName: 'Bäckerei',
    role: 'admin',
    createdAt: startedAt,
  })

  if (env.MOCK_STAFF_USER && env.MOCK_STAFF_PASSWORD) {
    const staffUser = env.MOCK_STAFF_USER
    users.push({
      id: 2,
      username: staffUser,
      email: staffUser.includes('@') ? staffUser : `${staffUser}@bakery.local`,
      password: env.MOCK_STAFF_PASSWORD,
      firstName: 'Mitarbeiter',
      lastName: 'Bäckerei',
      role: 'staff',
      createdAt: startedAt,
    })
  }

  return users
}

/**
 * Erzeugt Router und Middleware. `options` ist für Tests gedacht:
 *   users   feste Benutzerliste statt Umgebungsvariablen
 *   secret  festes JWT-Geheimnis
 *   env     Ersatz für `process.env`
 *   log     Ersatz für `console`
 */
function createAuth(options = {}) {
  const env = options.env || process.env
  const log = options.log || console
  const users = options.users || usersFromEnv(env, log)

  let secret = options.secret || env.JWT_SECRET
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex')
    log.warn(
      '[auth] JWT_SECRET nicht gesetzt - zufälliges Geheimnis für diesen ' +
        'Start. Nach einem Neustart ist jede Anmeldung ungültig.'
    )
  }

  function findUser(login) {
    const needle = String(login || '')
      .trim()
      .toLowerCase()
    if (!needle) return null
    return (
      users.find(
        (u) =>
          u.username.toLowerCase() === needle ||
          u.email.toLowerCase() === needle
      ) || null
    )
  }

  function findUserById(id) {
    return users.find((u) => u.id === Number(id)) || null
  }

  function signAccessToken(user) {
    return jwt.sign(
      { sub: String(user.id), role: user.role, type: 'access' },
      secret,
      {
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }
    )
  }

  function signRefreshToken(user) {
    return jwt.sign({ sub: String(user.id), type: 'refresh' }, secret, {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    })
  }

  /** Verifiziert ein Token des angegebenen Typs; `null` bei jedem Fehler. */
  function verifyToken(token, type) {
    if (!token) return null
    try {
      const payload = jwt.verify(token, secret)
      if (!payload || payload.type !== type) return null
      const user = findUserById(payload.sub)
      return user ? { payload, user } : null
    } catch {
      return null
    }
  }

  function bearerToken(req) {
    const header = req.headers.authorization || ''
    const match = /^Bearer\s+(.+)$/i.exec(header)
    return match ? match[1].trim() : null
  }

  /** Setzt `req.user` oder antwortet 401. */
  function requireAuth(req, res, next) {
    const verified = verifyToken(bearerToken(req), 'access')
    if (!verified) {
      return sendError(
        res,
        401,
        'unauthorized',
        'Anmeldung erforderlich. Bitte melden Sie sich an.'
      )
    }
    req.user = publicUser(verified.user, new Date().toISOString())
    next()
  }

  /** 401 ohne gültiges Token, 403 mit falscher Rolle. */
  function requireRole(...roles) {
    return (req, res, next) => {
      requireAuth(req, res, () => {
        if (!roles.includes(req.user.role)) {
          return sendError(
            res,
            403,
            'forbidden',
            'Keine Berechtigung für diesen Bereich.'
          )
        }
        next()
      })
    }
  }

  function install(app) {
    app.post('/api/auth/login', (req, res) => {
      const body = req.body || {}
      const login = body.email || body.username
      const password = body.password
      if (!login || typeof password !== 'string') {
        return sendError(
          res,
          400,
          'validation',
          'Benutzername und Passwort sind erforderlich.'
        )
      }
      const user = findUser(login)
      // Auch bei unbekanntem Benutzer vergleichen - gleiche Laufzeit.
      const ok = safeEqual(password, user ? user.password : '')
      if (!user || !ok) {
        return sendError(
          res,
          401,
          'invalid_credentials',
          'Benutzername oder Passwort ist falsch.'
        )
      }
      const now = new Date().toISOString()
      res.json({
        success: true,
        data: {
          user: publicUser(user, now),
          token: signAccessToken(user),
          refreshToken: signRefreshToken(user),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      })
    })

    app.get('/api/auth/me', requireAuth, (req, res) => {
      res.json({ success: true, data: req.user })
    })

    // Der AuthProvider liest den Refresh-Token aus `localStorage`, legt ihn dort
    // aber nie ab und schickt deshalb einen leeren String. Damit die laufende
    // Sitzung trotzdem verlängert werden kann, gilt ersatzweise ein noch
    // gültiges Access-Token im Bearer-Header - unauthentifiziert geht nichts.
    app.post('/api/auth/refresh', (req, res) => {
      const body = req.body || {}
      const verified =
        verifyToken(body.refreshToken, 'refresh') ||
        verifyToken(bearerToken(req), 'access')
      if (!verified) {
        return sendError(
          res,
          401,
          'unauthorized',
          'Sitzung abgelaufen. Bitte melden Sie sich erneut an.'
        )
      }
      res.json({
        success: true,
        data: {
          token: signAccessToken(verified.user),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      })
    })

    // Zustandslos: der Client verwirft sein Token, der Server merkt sich nichts.
    app.post('/api/auth/logout', (req, res) => {
      res.json({ success: true, message: 'Abgemeldet.' })
    })

    log.log(
      `[auth] JWT-Anmeldung aktiv (${users.length} Benutzer: ` +
        `${users.map((u) => `${u.username} (Rolle ${u.role})`).join(', ')})`
    )
    return app
  }

  return { install, requireAuth, requireRole, users, secret }
}

module.exports = {
  createAuth,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
}
