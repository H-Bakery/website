/**
 * Routes mounted for the pilot (roadmap §4). Everything else under
 * `src/routes/` and `libs/api/*` is unmounted and is removed in B12.
 */

export { default as authRoutes } from './auth.routes'
export { createHealthRouter } from './health.routes'
export { default as partnerRoutes } from './partner.routes'
