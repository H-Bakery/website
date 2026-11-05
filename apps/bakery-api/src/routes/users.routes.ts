/**
 * `/api/users` - user administration (B3), role `inhaber` only.
 *
 *   GET   /                 -> { success, data: AdminUser[] }
 *   POST  /                 { username, displayName, role, password, pin? } -> 201 { success, data }
 *   PATCH /:id              { displayName?, role?, active? } -> { success, data }
 *   POST  /:id/password     { password } -> { success, data }
 *   POST  /:id/pin          { pin: "1234" | null } -> { success, data }
 *
 * `AdminUser` = { id, username, displayName, role, active, createdAt,
 * updatedAt, hasPin } - never a hash. Users are deactivated
 * (`active: false`), never deleted. Every change is audited.
 *
 * Safety rails: at least one active `inhaber` must remain; nobody can
 * deactivate their own account. A new password ends the user's other
 * sessions; a new PIN ends their station sessions; deactivation ends all.
 */
import { Request, Router } from 'express'
import { Op, Transaction } from 'sequelize'

import { audit } from '../auth/audit'
import { AuthError } from '../auth/types'
import type { AuthService } from '../auth/auth.service'
import { asyncHandler, requireRole } from '../auth/middleware'
import { adminUser } from '../auth/users.service'
import { User, getSequelize } from '../models'
import type { UserRole } from '../models/User'
import { sendError } from '../utils/http-error'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const authCrypto = require('../services/auth-crypto.core')

const NOT_FOUND = 'Benutzer nicht gefunden.'
const LAST_INHABER =
  'Es muss mindestens ein aktives Konto mit der Rolle Inhaber bleiben.'

function bodyOf(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {}
}

async function loadUser(req: Request): Promise<User | null> {
  const id = Number(req.params['id'])
  if (!Number.isInteger(id) || id <= 0) return null
  return User.scope('withSecrets').findByPk(id)
}

async function otherActiveInhaber(
  userId: number,
  transaction: Transaction
): Promise<number> {
  return User.count({
    where: { role: 'inhaber', active: true, id: { [Op.ne]: userId } },
    transaction,
  })
}

export function createUsersRouter(service: AuthService): Router {
  const router = Router()
  router.use(requireRole('inhaber'))

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const users = await User.scope('withSecrets').findAll({
        order: [
          ['active', 'DESC'],
          ['displayName', 'ASC'],
          ['id', 'ASC'],
        ],
      })
      res.json({ success: true, data: users.map(adminUser) })
    })
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = bodyOf(req)
      const pin = body['pin']
      const errors = [
        authCrypto.validateUsername(body['username']),
        authCrypto.validateDisplayName(body['displayName']),
        authCrypto.validateRole(body['role']),
        authCrypto.validatePassword(body['password']),
        pin === undefined || pin === null ? null : authCrypto.validatePin(pin),
      ].filter(Boolean)
      if (errors.length > 0) {
        sendError(res, 400, 'validation', errors.join(' '))
        return
      }
      const username = authCrypto.normalizeUsername(body['username']) as string
      if (await User.findOne({ where: { username } })) {
        sendError(
          res,
          409,
          'username_taken',
          'Diesen Benutzernamen gibt es schon. Ein deaktiviertes Konto lässt sich wieder aktivieren.'
        )
        return
      }
      const passwordHash = await authCrypto.hashSecret(body['password'])
      const pinHash =
        typeof pin === 'string' ? await authCrypto.hashSecret(pin) : null
      const user = await getSequelize().transaction(async (transaction) => {
        const created = await User.create(
          {
            username,
            displayName: authCrypto.normalizeDisplayName(body['displayName']),
            role: body['role'] as UserRole,
            passwordHash,
            pinHash,
            active: true,
          },
          { transaction }
        )
        await audit(
          req,
          'create',
          'user',
          created.id,
          { username, role: created.role, pinSet: pinHash !== null },
          { transaction }
        )
        return created
      })
      res.status(201).json({ success: true, data: adminUser(user) })
    })
  )

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = await loadUser(req)
      if (!user) {
        sendError(res, 404, 'not_found', NOT_FOUND)
        return
      }
      const body = bodyOf(req)
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      const errors: string[] = []

      if (body['displayName'] !== undefined) {
        const error = authCrypto.validateDisplayName(body['displayName'])
        if (error) errors.push(error)
        else {
          const value = authCrypto.normalizeDisplayName(body['displayName'])
          if (value !== user.displayName) {
            changes['displayName'] = { from: user.displayName, to: value }
          }
        }
      }
      if (body['role'] !== undefined) {
        const error = authCrypto.validateRole(body['role'])
        if (error) errors.push(error)
        else if (body['role'] !== user.role) {
          changes['role'] = { from: user.role, to: body['role'] }
        }
      }
      if (body['active'] !== undefined) {
        if (typeof body['active'] !== 'boolean') {
          errors.push('„active“ muss true oder false sein.')
        } else if (body['active'] !== user.active) {
          changes['active'] = { from: user.active, to: body['active'] }
        }
      }
      if (
        body['displayName'] === undefined &&
        body['role'] === undefined &&
        body['active'] === undefined
      ) {
        errors.push(
          'Nichts zu ändern: erlaubt sind displayName, role und active.'
        )
      }
      if (errors.length > 0) {
        sendError(res, 400, 'validation', errors.join(' '))
        return
      }

      if (changes['active']?.to === false && user.id === req.user!.id) {
        sendError(
          res,
          400,
          'validation',
          'Das eigene Konto kann nicht deaktiviert werden.'
        )
        return
      }
      const losesInhaber =
        user.role === 'inhaber' &&
        user.active &&
        (changes['active']?.to === false ||
          (changes['role'] !== undefined && changes['role'].to !== 'inhaber'))
      if (Object.keys(changes).length > 0) {
        await getSequelize().transaction(async (transaction) => {
          // Inside the (serialised) transaction, so two parallel demotions
          // cannot both see the other inhaber as still active.
          if (
            losesInhaber &&
            (await otherActiveInhaber(user.id, transaction)) === 0
          ) {
            throw new AuthError(409, 'last_inhaber', LAST_INHABER)
          }
          if (changes['displayName']) {
            user.displayName = changes['displayName'].to as string
          }
          if (changes['role']) user.role = changes['role'].to as UserRole
          if (changes['active']) user.active = changes['active'].to as boolean
          await user.save({ transaction })
          if (changes['active']?.to === false) {
            await service.revokeUserSessions(user.id, 'deactivated', {
              transaction,
            })
          }
          await audit(
            req,
            'update',
            'user',
            user.id,
            { changes },
            { transaction }
          )
        })
      }
      res.json({ success: true, data: adminUser(user) })
    })
  )

  router.post(
    '/:id/password',
    asyncHandler(async (req, res) => {
      const user = await loadUser(req)
      if (!user) {
        sendError(res, 404, 'not_found', NOT_FOUND)
        return
      }
      const password = bodyOf(req)['password']
      const error = authCrypto.validatePassword(password)
      if (error) {
        sendError(res, 400, 'validation', error)
        return
      }
      const passwordHash = await authCrypto.hashSecret(password)
      await getSequelize().transaction(async (transaction) => {
        user.passwordHash = passwordHash
        await user.save({ transaction })
        // Other devices log in again; the admin's own session stays.
        await service.revokeUserSessions(user.id, 'password', {
          exceptSessionId: req.user!.sessionId,
          transaction,
        })
        await audit(req, 'set_password', 'user', user.id, null, {
          transaction,
        })
      })
      res.json({ success: true, data: adminUser(user) })
    })
  )

  router.post(
    '/:id/pin',
    asyncHandler(async (req, res) => {
      const user = await loadUser(req)
      if (!user) {
        sendError(res, 404, 'not_found', NOT_FOUND)
        return
      }
      const body = bodyOf(req)
      if (!('pin' in body)) {
        sendError(
          res,
          400,
          'validation',
          'Bitte eine PIN angeben (4 bis 6 Ziffern) oder null zum Entfernen.'
        )
        return
      }
      const pin = body['pin']
      if (pin !== null) {
        const error = authCrypto.validatePin(pin)
        if (error) {
          sendError(res, 400, 'validation', error)
          return
        }
      }
      const pinHash =
        pin === null ? null : await authCrypto.hashSecret(pin as string)
      await getSequelize().transaction(async (transaction) => {
        user.pinHash = pinHash
        await user.save({ transaction })
        await service.revokeUserSessions(user.id, 'pin', {
          kind: 'station',
          exceptSessionId: req.user!.sessionId,
          transaction,
        })
        await audit(
          req,
          pin === null ? 'clear_pin' : 'set_pin',
          'user',
          user.id,
          null,
          { transaction }
        )
      })
      res.json({ success: true, data: adminUser(user) })
    })
  )

  return router
}
