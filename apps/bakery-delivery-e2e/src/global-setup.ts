/**
 * @fileoverview Legt den E2E-Fahrer einmal vor allen Tests an (nach dem Start
 * der Server).
 *
 * Ohne diesen Schritt legten zwei Test-Worker, die gleichzeitig `driverId()`
 * aufriefen, je einen „E2E-Fahrer“ an. Die Fahrer-Auswahl der App zeigte dann
 * zwei gleichnamige Fahrer, wählte den ersten, und die Tour des anderen stand
 * als „Keine Tour für …“ da.
 */

import { request as playwrightRequest } from '@playwright/test'

import { driverId, issueSession } from './login'

export default async function globalSetup(): Promise<void> {
  const login = await playwrightRequest.newContext()
  const { token } = await issueSession(login)
  await login.dispose()

  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  try {
    await driverId(api)
  } finally {
    await api.dispose()
  }
}
