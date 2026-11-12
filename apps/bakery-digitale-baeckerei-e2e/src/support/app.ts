/**
 * Gemeinsames Werkzeug der Suite: Seite öffnen, Messhaken lesen, Plätze im
 * 3D-Bild antippen, Selektoren der Bedienelemente.
 *
 * ## Was die Suite von der App erwartet
 *
 * **Messhaken** `window.__digitaleBaeckerei` (nur mit `?debug`, siehe
 * `src/lib/scene/createViewer.ts`): `ready`, `frames`, `info()`,
 * `pixelStats()`, `nodes(prefix)` und
 *
 * - `screenPos(slot)`: `{ x, y }` in CSS-Pixeln des Viewports (wie
 *   `clientX`/`clientY`) für die Mitte des sichtbaren Knotens `produkt/<slot>`,
 *   oder `null`, wenn es den Platz nicht gibt, er ausgeblendet ist oder
 *   außerhalb des Bildes liegt. Die Suite tippt genau dorthin.
 * - `hervorgehoben`: der Slot, den `Picker.highlight()` gerade hervorhebt,
 *   sonst `null`.
 *
 * **Bedienelemente** (deutsch beschriftet, dazu vier `data-testid`):
 *
 * - `blickpunkt-leiste`: darin je Blickpunkt ein Knopf (oder Tab) mit dem
 *   Namen „Theke“, „Brotregal“, „Regale“.
 * - Das Canvas trägt `role="img"` und nennt den Blickpunkt im Namen
 *   („3D-Ansicht der Bäckerei, Blickpunkt Theke“ - so seit P0).
 * - `produkt-sheet`: das Bottom-Sheet eines Produkts; nicht sichtbar, solange
 *   kein Produkt gewählt ist.
 * - Knopf „Alles hier“ öffnet `alles-hier-liste`.
 * - `ohne-webgl`: der Ersatz ohne 3D mit den Listen aller Blickpunkte.
 */
import { expect, type Locator, type Page } from '@playwright/test'
// Blickpunkte und Fixtures gehören zur App (dort prüft sie jest); die Suite
// liest sie nur.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  START_RAUM_ID,
  findeRaum,
} from '../../../bakery-digitale-baeckerei/src/config/raeume'
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  VARIANTE,
  WAISE,
  erwarteteEintraege,
} from '../../../bakery-digitale-baeckerei/src/test/fixtures/fixture-info'

export { VARIANTE, WAISE, erwarteteEintraege }

/** Unter diesem Pfad liegt der Export - wie später auf der Pages-Seite. */
export const PFAD = '/digitale-baeckerei/'

/** Nichts auf der Seite darf nach einem Preis aussehen (DB8). */
export const PREIS = /€|EUR|\bEuro\b/

/**
 * Die Blickpunkte des Ladens mit ihren Slot-Präfixen - direkt aus
 * `src/config/raeume.ts` der App, damit die Suite aus dem Fixture ausrechnet,
 * was die Listen zeigen müssen, ohne die Zuordnung ein zweites Mal zu führen.
 */
export const BLICKPUNKTE = (findeRaum(START_RAUM_ID)?.blickpunkte ?? []).map(
  ({ id, name, moebel }) => ({ id, name, moebel: [...moebel] })
)

/** Die Slot-Präfixe eines Blickpunkts (`theke` → `theke/`, `gitterregal/`). */
export function moebelVon(id: string): string[] {
  const blickpunkt = BLICKPUNKTE.find((b) => b.id === id)
  if (!blickpunkt) throw new Error(`Blickpunkt ${id} gibt es nicht`)
  return blickpunkt.moebel
}

export interface DebugKnoten {
  name: string
  visible: boolean
  min: number[]
  max: number[]
  extras: Record<string, unknown>
}

/** Der Teil des Messhakens, den die Suite benutzt. */
export interface DebugHaken {
  ready: boolean
  frames: number
  info: () => {
    fill: { shown: number; hidden: number; doubled: string[] } | null
    fov: number
    blickpunkt: string
    eye: number[]
    richtung: number[]
    preisschilder: number
    aussenSichtbar: boolean
  }
  pixelStats: () => {
    samples: number
    distinct: number
    backgroundShare: number
  }
  nodes: (prefix?: string) => DebugKnoten[]
  /** Siehe Kopf der Datei. */
  screenPos: (slot: string) => { x: number; y: number } | null
  /** Siehe Kopf der Datei. */
  hervorgehoben: string | null
}

declare global {
  interface Window {
    __digitaleBaeckerei?: DebugHaken
  }
}

/** Was beim Laden schiefging: Konsolenfehler, Ausnahmen, Antworten ab 400. */
export interface Protokoll {
  konsole: string[]
  ausnahmen: string[]
  antworten: string[]
  /** Alle angefragten URLs (ohne data:). */
  anfragen: string[]
}

export function protokolliere(page: Page): Protokoll {
  const protokoll: Protokoll = {
    konsole: [],
    ausnahmen: [],
    antworten: [],
    anfragen: [],
  }
  page.on('console', (message) => {
    if (message.type() === 'error') protokoll.konsole.push(message.text())
  })
  page.on('pageerror', (error) => protokoll.ausnahmen.push(error.message))
  /** Anfragen, die schon mit einem guten Status beantwortet sind. */
  const beantwortet = new Set<unknown>()
  page.on('response', (response) => {
    if (response.status() >= 400) {
      protokoll.antworten.push(`${response.status()} ${response.url()}`)
    } else {
      beantwortet.add(response.request())
    }
  })
  page.on('requestfailed', (request) => {
    const grund = request.failure()?.errorText ?? '?'
    // Die App liest das Modell als Stream (Fortschrittsanzeige). Chromium
    // meldet so eine Anfrage über das DevTools-Protokoll öfter als
    // „net::ERR_ABORTED“, obwohl sie mit 200 beantwortet und vollständig
    // gelesen wurde. Das ist kein Ladefehler: Ob das Modell wirklich steht,
    // prüft `oeffne()`. Abbrüche vor der Antwort zählen weiter.
    if (grund === 'net::ERR_ABORTED' && beantwortet.has(request)) return
    protokoll.antworten.push(`fehlgeschlagen ${request.url()} (${grund})`)
  })
  page.on('request', (request) => {
    if (!request.url().startsWith('data:'))
      protokoll.anfragen.push(request.url())
  })
  return protokoll
}

/**
 * Öffnet die App mit Messhaken und wartet, bis der Laden steht. Prüft dabei,
 * dass wirklich das synthetische Fixture geladen ist - nie das echte Modell.
 */
export async function oeffne(page: Page): Promise<Protokoll> {
  const protokoll = protokolliere(page)
  const antwort = await page.goto(`${PFAD}?debug`)
  expect(antwort?.status()).toBe(200)
  await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
    timeout: 60_000,
  })
  await page.waitForFunction(() => window.__digitaleBaeckerei?.ready === true)
  const waise = await page.evaluate(
    (name) =>
      window.__digitaleBaeckerei?.nodes(name).map((n) => n.extras['product']) ??
      [],
    `produkt/${WAISE.slot}`
  )
  expect(
    waise,
    'Die Suite läuft nur auf dem synthetischen Fixture (DIGITALE_BAECKEREI_FIXTURE=1).'
  ).toEqual([WAISE.produkt])
  return protokoll
}

/**
 * Alles, was ein Mensch oder ein Screenreader zu lesen bekommt: Textknoten
 * (ohne Skripte und Styles) und beschreibende Attribute.
 */
export async function lesbareTexte(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_TEXT
    )
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement
      if (parent && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue
      const text = (node.textContent ?? '').trim()
      if (text) out.push(text)
    }
    const attribute = ['aria-label', 'title', 'alt', 'placeholder', 'content']
    for (const element of Array.from(document.querySelectorAll('*'))) {
      for (const name of attribute) {
        const value = element.getAttribute(name)
        if (value) out.push(value)
      }
    }
    out.push(document.title)
    return out
  })
}

export async function erwarteKeinePreise(page: Page): Promise<void> {
  const texte = await lesbareTexte(page)
  expect(texte.filter((text) => PREIS.test(text))).toEqual([])
}

/** Das Canvas der Szene, solange es den Blickpunkt `name` zeigt. */
export function szene(page: Page, name: string): Locator {
  return page.getByRole('img', { name: `Blickpunkt ${name}` })
}

export function blickpunktKnopf(page: Page, name: string): Locator {
  const leiste = page.getByTestId('blickpunkt-leiste')
  return leiste
    .getByRole('button', { name, exact: true })
    .or(leiste.getByRole('tab', { name, exact: true }))
}

export async function wechsleZu(page: Page, name: string): Promise<void> {
  await blickpunktKnopf(page, name).click()
  await expect(szene(page, name)).toBeVisible()
}

export const produktSheet = (page: Page): Locator =>
  page.getByTestId('produkt-sheet')

export const allesHierListe = (page: Page): Locator =>
  page.getByTestId('alles-hier-liste')

/** Wie viele Bilder die Szene bisher gezeichnet hat (gerendert wird nur bei Bedarf). */
export const bilder = (page: Page): Promise<number> =>
  page.evaluate(() => window.__digitaleBaeckerei?.frames ?? -1)

/**
 * Tippt im 3D-Bild auf einen Platz: holt seine Bildschirmposition vom
 * Messhaken und tippt dort wie ein Finger (Handy) oder klickt (Desktop).
 */
export async function tippeAufPlatz(
  page: Page,
  slot: string,
  hasTouch: boolean
): Promise<void> {
  const pos = await page.evaluate((s) => {
    const haken = window.__digitaleBaeckerei
    if (!haken?.screenPos) return 'kein screenPos'
    return haken.screenPos(s)
  }, slot)
  expect(
    pos,
    'window.__digitaleBaeckerei.screenPos(slot) fehlt (Messhaken, P1)'
  ).not.toBe('kein screenPos')
  expect(
    pos,
    `Platz ${slot} ist an diesem Blickpunkt nicht im Bild`
  ).not.toBeNull()
  const { x, y } = pos as { x: number; y: number }
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(x, `Platz ${slot}: x außerhalb des Bildes`).toBeGreaterThanOrEqual(0)
  expect(x).toBeLessThanOrEqual(viewport?.width ?? 0)
  expect(y, `Platz ${slot}: y außerhalb des Bildes`).toBeGreaterThanOrEqual(0)
  expect(y).toBeLessThanOrEqual(viewport?.height ?? 0)
  if (hasTouch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

/**
 * Nimmt dem Browser WebGL weg (vor dem Laden der Seite aufrufen): jeder
 * Versuch, einen WebGL-Kontext zu holen, liefert `null` - wie auf einem Gerät
 * ohne 3D.
 */
export async function ohneWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null
      return (original as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest
      )
    } as typeof original
  })
}
