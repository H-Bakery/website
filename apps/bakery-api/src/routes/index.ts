/**
 * Routes mounted for the pilot (roadmap §4). Everything else under
 * `src/routes/` and `libs/api/*` is unmounted and is removed in B12.
 */

export { createPublicAuthRouter, createSessionAuthRouter } from './auth.routes'
export { createBackzettelRouter } from './backzettel.routes'
export { createHealthRouter } from './health.routes'
export { createPartnerRouter } from './partner.routes'
export { createUsersRouter } from './users.routes'
