/**
 * @fileoverview Holt die Sitzungen der Smoke-Suite einmal vor allen Tests
 * (nach dem Start der Server). Warum einmal: siehe `login.ts`.
 */

import { issueSessions, storeSessions } from './login'

export default async function globalSetup(): Promise<void> {
  storeSessions(await issueSessions())
}
