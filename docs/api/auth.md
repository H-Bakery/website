# Auth (B3): accounts, PIN stations, roles

Personal accounts plus PIN stations (roadmap D5, D12). Code in `apps/bakery-api/src/auth/`
(`auth.service.ts`, `middleware.ts`, `audit.ts`, `users.service.ts`), routes in
`src/routes/auth.routes.ts` and `users.routes.ts`, hashing and validation in
`src/services/auth-crypto.core.js` (dependency-free CommonJS). Endpoints and envelope = the former
mock's `auth.mock.js` (deleted in B12), plus PIN/stations; the `user` object deliberately deviates (see below the table).

| Endpoint                                                                                                 | Who                             | Body / answer                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                                                                                   | public, rate-limited            | `{ username \| email, password }` → `{ success, data: { user, token, refreshToken, expiresIn, sessionKind } }` |
| `POST /api/auth/refresh`                                                                                 | public                          | `{ refreshToken }` → same `data` shape, **new** `refreshToken`; 409 `refresh_superseded` (parallel refresh)    |
| `POST /api/auth/pin`                                                                                     | `X-Station-Token`, rate-limited | `{ userId, pin: "0420" }` → same `data` shape, `sessionKind: 'station'`                                        |
| `GET /api/auth/station/users`                                                                            | `X-Station-Token`               | `{ success, data: [{ id, displayName, role }] }` (active users with a PIN)                                     |
| `POST /api/auth/logout`                                                                                  | public                          | Bearer and/or `{ refreshToken }` → ends **that** session; always `{ success, message: 'Abgemeldet.' }`         |
| `GET /api/auth/me`                                                                                       | session                         | `{ success, data: user + sessionKind + stationId }`                                                            |
| `GET/POST /api/auth/stations`, `DELETE /api/auth/stations/:id`                                           | `inhaber`, personal session     | register `{ name }` → 201 `{ station, token }` (token shown once); revoke ends its sessions                    |
| `GET/POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/password`, `POST /api/users/:id/pin` | `inhaber`, personal session     | `AdminUser` = user + `hasPin`, never a hash                                                                    |

`user` = `{ id, username, displayName, role, active, isActive, createdAt, updatedAt, sessionKind }`.
Roles `inhaber | verkauf | backstube | fahrer`. **D3 deviation, deliberate:** the mock's `email`,
`firstName`, `lastName`, `lastLogin` do not exist (the pilot `users` table has no such columns and
the API does not invent them); `isActive` mirrors `active` for the shared `User` type. Errors via
`sendError`: 400 `validation` / `INVALID_TEXT`, 401 `invalid_credentials` („Benutzername oder
Passwort falsch.") / `invalid_pin` / `unauthorized`, 403 `forbidden` / `station_required` /
`personal_session_required`, 404 `not_found`, 409 `username_taken` / `last_inhaber` /
`refresh_superseded`, 429 `too_many_requests`.

A station `name` with control or bidi characters (NUL, BEL, RLO, …) is 400 `INVALID_TEXT`;
whitespace - tabs, line breaks, U+2028/U+2029, BOM - is collapsed to one space before the check.

## What to know before changing it

- **Sessions live in `auth_sessions`** (migration `20261106000000-auth-sessions-stations.js`, which
  also adds `stations` and `refresh_tokens.session_id`). The access JWT (HS256, 1 h, claims `sub`,
  `role`, `displayName`, `sessionKind`, `sid`, `type: 'access'`) is checked against its session
  **and** the user on every request, so logout, deactivation, a new password/PIN and a revoked
  station take effect at once. `req.user` (`id`, `username`, `displayName`, `role`,
  `sessionKind`, `sessionId`, `stationId`) comes from the database, not from the token claims.
- **Refresh tokens** (`rt_…`, 32 random bytes) are stored as SHA-256 only, rotated on every
  refresh (`revokedAt` + `replacedBy`). A rotated token presented again revokes the whole session
  (`revoke_reason = 'reuse'`, audited as `refresh_reuse`) - **except**:
  - within `REFRESH_REUSE_GRACE_MS` (10 s) of the rotation while the successor is unused: a
    parallel refresh (two tabs, a retry) → 409 `refresh_superseded`, session stays. A thief who
    wins such a race is caught on the client's next refresh.
  - **lost answer:** later, but within `REFRESH_LOST_RESPONSE_MS` (15 min) and while the successor
    has never been presented, the predecessor is rotated once more (the unused successor is
    revoked, audit `refresh_reissued`) - the client never got the successor (Wi-Fi drop
    mid-refresh) and would otherwise be logged out mid-shift. The replaced successor is revoked
    **without** `replacedBy`: whoever presents it later is reuse and ends the session, so a stale
    copy and the real device cannot take turns forever. Trade-off: a stolen predecessor replayed in
    that window is caught only on the real device's next refresh.
- **Lifetimes:** personal sessions slide to 14 days on each refresh (`REFRESH_TOKEN_TTL_SECONDS`);
  **station sessions end 12 h after the PIN** (`STATION_SESSION_TTL_SECONDS`) - neither refresh nor
  access token outlives that (`expiresIn` shrinks towards the end). Unlike the mock, a bare access
  token is **not** accepted at `/refresh`: the client must keep the refresh token.
- **Global guard is structural** (`app.ts`): public auth router → `app.use('/api', requireAuth)` →
  everything else. No path allow-list to get wrong; an unknown `/api` path without a session is a
  401, with a session a 404. `requireRole(...roles)` needs no service; `inhaber` passes every check.
- **Stations:** `X-Station-Token` (`st_…`, SHA-256 in `stations`). PIN login without a valid, not
  revoked station token is 403. PINs are 4-6 digits **as a string** (a number would lose leading
  zeros → 400). `userId` must be canonical (`parseUserId`: JSON integer > 0 or `"7"`); `"07"`,
  `" 7"`, `"7.0"`, `"0x7"` are 400 **before** the rate limiter - otherwise each spelling of one id
  had its own counter and a PIN could be brute-forced without limit.
- **Station sessions carry the user's full role but cannot administer** (`requirePersonalSession`
  on `/api/users` and `/api/auth/stations`, 403 `personal_session_required`): a 4-digit PIN on a
  shared tablet must not unlock user/station admin. Finance and Tagesziel use the same guard (see
  [hq-data.md](hq-data.md)), and so does the Dienstplan (`/api/dienstplan`, staff data, see
  [dienstplan.md](dienstplan.md)).
- **Logout is public**: Bearer access token, else `{ refreshToken }` (also a rotated or expired
  one) names the session; it is revoked and audited (`via: 'access' | 'refresh'`). Nothing valid
  → still 200, as in the mock. A tablet whose access token expired can still end its session.
- **Rate limit** (`loginRateLimit` in `auth/middleware.ts`, own in-memory limiter per
  `createApp()`; only `ipKeyGenerator` comes from express-rate-limit). **Failed** attempts per
  5 min → 429 with `Retry-After`: `LOGIN_RATE_LIMIT_MAX` 5 per IP + username (login) or IP + userId
  (PIN); `LOGIN_RATE_LIMIT_IP_MAX` 30 per IP across all accounts (password spraying); for the PIN
  also `PIN_RATE_LIMIT_USER_MAX` 10 per user across all IPs (side effect accepted: anyone at a
  station can lock a user's PIN login for 5 min; password login still works).
  - **Only failures count**: a request is settled when its handler answers (`res.end`, also on a
    dead socket) - status ≥ 400 except 429 is a failure, anything else costs nothing, so any
    number of parallel successful logins pass.
  - While requests are in flight they are reserved: a request that could push
    `failures + pending` over the limit **waits** for one of them to settle instead of being
    rejected or let through - so a burst of wrong guesses cannot get past the limit either (12
    parallel wrong guesses → exactly 5 × 401, 7 × 429). Nobody waits longer than
    `LOGIN_WAIT_MAX_MS` (5 s) → 429 with `Retry-After`.
  - **Aborted requests:** a waiter whose client hangs up leaves the queue and releases the slots
    the outer limiters gave it (no failure); a woken waiter whose client is gone is never handed on;
    an admitted attempt whose client hangs up still settles when the handler answers (an aborted
    wrong guess counts, an aborted correct login does not), or as a failure after
    `LOGIN_ABORT_GRACE_MS` (30 s) if the handler never answers. Without this, aborted waiters could
    wedge an IP + account until restart.
  - The window starts at the first failure; idle keys are swept above 10 000 entries. `req.ip`
    depends on `TRUST_PROXY` (default `loopback`, Caddy). Tests override via
    `createApp({ auth: { rateLimit: { max, ipMax, pinUserMax, windowMs } } })`.
- **Usernames are lower-case.** Login and the CLI normalise (`trim().toLowerCase()`) and look up
  with SQLite's case-sensitive `=`; the auth migration lower-cases legacy names unless the
  lower-case name is taken (then it warns and leaves the row for a manual fix).
- **scrypt** (`node:crypto`, N=2^14, r=8, p=1, 16-byte salt): `scrypt$N$r$p$salt$hash`
  (base64url). `verifySecret` runs one scrypt even for unknown users, users without PIN and the
  legacy marker `!legacy-user-disabled` (timing), and refuses parameters outside bounds.
- **`audit(req, action, entity, entityId, data, { transaction, userId })`** in `src/auth/audit.ts`
  writes `audit_log`; pass the write's transaction. Logged: `login`, `login_failed` (userId null,
  IP; the username and `entityId` only for an existing account - a typed unknown name is often the
  password and is stored as `unknownUser: true`, never the text; never the password), `logout`,
  `refresh_reuse`, `refresh_reissued`, user `create`/`update` (diff)/`set_password`/`set_pin`/
  `clear_pin`, station `register`/`revoke`, `cli_create`/`cli_reset`, `bootstrap_create`.
- **User admin rails:** users are deactivated (`active: false`), never deleted; nobody can
  deactivate themselves; the last active `inhaber` cannot be demoted or deactivated (409, checked
  inside the serialised transaction). A new password ends the user's other sessions (the admin's
  own stays); a new PIN ends their station sessions.
- **No default account.** Accounts come from the `create-user` CLI; in development optionally
  `BOOTSTRAP_ADMIN_USER`/`BOOTSTRAP_ADMIN_PASSWORD` (ignored in production). `admin`/`admin123`
  is gone (user seeder deleted, `libs/api/auth` deleted in B12).

## `create-user` CLI

```bash
npm run build:api
npm run api:create-user -- --username anna --display-name "Anna" --role verkauf
# = node dist/apps/bakery-api/bundle/cli.js create-user ...
```

Password from `CREATE_USER_PASSWORD`, else stdin (piped: first line; terminal: asked twice without
echo); optional PIN from `CREATE_USER_PIN`. Reads `.env` in the working directory, uses `DB_PATH`
with the server's rules (production: absolute, directory must exist) and runs pending migrations.
Idempotent: an existing user - also a deactivated one - gets the given name, role and password,
is reactivated and loses its open sessions. Input is validated before the database is opened.
Needs no `JWT_SECRET`.

## Tests

`tests/unit/authCrypto.test.js`, `tests/integration/{auth,stations,users,cli}.test.ts`,
`tests/integration/loginRateLimit.abort.test.ts` (real HTTP, clients that hang up); helpers in
`tests/helpers/auth.ts`. `scripts/boot-smoke.sh` creates its account with the bundled CLI.
