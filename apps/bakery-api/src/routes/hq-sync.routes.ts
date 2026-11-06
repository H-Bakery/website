/**
 * `/api/hq-sync` - state of the hq write-back (B5b) and the snapshots (Z9).
 * Owner only (`inhaber`), mounted below the global session guard.
 *
 *   GET  /status   { success, data: EditsSyncStatus & { snapshots: SnapshotStatus } }
 *   POST /retry    runs both syncs now (instead of waiting up to 15 min), same answer
 *
 * `data` (B5b): `enabled`, `reason` (German, why it is off), `pendingCommits`
 * (local, not yet on GitHub), `unmergedCommits` (waiting for approval),
 * `lastPushAt`, `lastAttemptAt`, `lastError { code, message, detail, files?, at }`,
 * `prUrl`, `mergedSince`, `running`; `snapshots` (Z9) the same for
 * `data/production/**` (`pendingCommits`, `lastCommitAt`, `lastPushAt`, `lastError`).
 */
import { Router } from 'express'

import { asyncHandler, requireRole } from '../auth/middleware'
import type { HqEditsSync } from '../services/hq-edits-sync.service'
import type { HqSnapshotWriter } from '../services/hq-snapshots.service'

export interface HqSyncRouterOptions {
  edits: HqEditsSync
  snapshots: HqSnapshotWriter
}

export function createHqSyncRouter(options: HqSyncRouterOptions): Router {
  const router = Router()
  router.use(requireRole('inhaber'))

  const status = () => ({
    ...options.edits.status(),
    snapshots: options.snapshots.status(),
  })

  router.get('/status', (_req, res) => {
    res.json({ success: true, data: status() })
  })

  router.post(
    '/retry',
    asyncHandler(async (_req, res) => {
      await Promise.all([options.edits.sync(), options.snapshots.retry()])
      res.json({ success: true, data: status() })
    })
  )

  return router
}
