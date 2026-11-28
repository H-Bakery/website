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
 * - `hervorgehoben`: der Slot, an dem gerade wirklich eine Hervorhebung
 *   hängt (aus dem Picker gelesen: Überzüge am Modell), sonst `null` - auch
 *   dann `null`, wenn ein Platz gewählt ist, aber nichts gezeichnet wird.
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
 * - `nahansicht`: der Dialog „In 3D ansehen“ mit `nahansicht-buehne`
 *   (`data-phase`: laden | bereit | fehler | kein-webgl | unterbrochen); sein
 *   Canvas trägt `role="img"` und „3D-Modell: <Name>“. Messhaken dazu:
 *   `window.__digitaleBaeckereiNahansicht` (nur solange sie offen ist).
 * - `intro-ueberspringen`: der Knopf „Überspringen“, solange der Flug zum
 *   Start läuft; das Canvas heißt dann „…, Flug von der Straße zur Theke“.
 *
 * - `raum-wechsel`: der Knopf in der Leiste, der in den anderen Raum führt
 *   („In die Testbackstube“ / „In den Laden“). Den zweiten, erfundenen Raum
 *   gibt es nur im Fixture-Build (`TESTBACKSTUBE`); `oeffneRaum()` öffnet ihn
 *   über seinen Link `?raum=<id>`.
 *
 * **Flug zum Start:** `oeffne()` stellt ihn mit `?intro=0` ab - sonst
 * dauerte jeder Test die 7,5 s des Flugs länger, und bis zur Ankunft gibt es
 * weder Leiste noch Antippen. Nur `intro.spec.ts` öffnet mit Flug
 * (`oeffne(page, { intro: true })`).
 */
import { expect, type Locator, type Page } from '@playwright/test'
// Blickpunkte und Fixtures gehören zur App (dort prüft sie jest); die Suite
// liest sie nur.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  START_RAUM_ID,
  findeRaum,
  type Raum,
} from '../../../bakery-digitale-baeckerei/src/config/raeume'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { TESTBACKSTUBE } from '../../../bakery-digitale-baeckerei/src/test/fixtures/testraeume'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ansichtFuer } from '../../../bakery-digitale-baeckerei/src/lib/scene/view'
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  EINGERICHTET,
  MIT_MODELL,
  OHNE_MODELL,
  STATIONEN,
  VARIANTE,
  WAISE,
  erwarteteEintraege,
  ladeFixture,
  zaehlePreisPrimitive,
} from '../../../bakery-digitale-baeckerei/src/test/fixtures/fixture-info'

export {
  EINGERICHTET,
  MIT_MODELL,
  OHNE_MODELL,
  STATIONEN,
  TESTBACKSTUBE,
  VARIANTE,
  WAISE,
  erwarteteEintraege,
  ladeFixture,
  zaehlePreisPrimitive,
}

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
    /** Flug zum Start: läuft er, welcher, wie endete der letzte. */
    intro: {
      laeuft: boolean
      id: string | null
      ende: 'ende' | 'uebersprungen' | 'langsam' | 'verborgen' | null
      bilder: number
      sekunden: number
    }
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
  /** Der Platz, den die App gewählt hat - auch wenn nichts gezeichnet wird. */
  gewaehlt: string | null
}

/**
 * Der Messhaken der Nahansicht (`src/lib/scene/createNahansicht.ts`): gibt es
 * nur mit `?debug` und nur, solange eine Nahansicht offen ist.
 */
export interface NahansichtHaken {
  ready: boolean
  frames: number
  /** Läuft die Runde vom Öffnen noch? */
  dreht: boolean
  info: () => {
    triangles: number
    pixelRatio: number
    size: [number, number]
    zustand: { yaw: number; pitch: number; zoom: number }
    zoomMin: number
  }
  pixelStats: () => {
    samples: number
    distinct: number
    backgroundShare: number
    breite: number
    hoehe: number
    mitteX: number
    mitteY: number
    /** Prüfsumme des Bildes: ändert sich, wenn sich das Bild ändert. */
    summe: string
  }
}

declare global {
  interface Window {
    __digitaleBaeckerei?: DebugHaken
    __digitaleBaeckereiNahansicht?: NahansichtHaken
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
 *
 * Ohne den Flug zum Start (`?intro=0`): Die App steht gleich an der Theke,
 * wie vor P3. `{ intro: true }` lässt ihn laufen - dann ist beim Zurückkommen
 * das Modell da, aber die Kamera fliegt noch.
 */
export async function oeffne(
  page: Page,
  optionen: { intro?: boolean } = {}
): Promise<Protokoll> {
  const protokoll = protokolliere(page)
  const antwort = await page.goto(
    optionen.intro ? `${PFAD}?debug` : `${PFAD}?debug&intro=0`
  )
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

/** Der Laden, wie ihn die App konfiguriert. */
export const LADEN = findeRaum(START_RAUM_ID) as Raum

/** Der Knopf in der Leiste, der in den anderen Raum führt. */
export const raumWechsel = (page: Page): Locator =>
  page.getByTestId('raum-wechsel')

/** Namen der Knoten des geladenen Modells, die so beginnen. */
export const knotenNamen = (page: Page, prefix: string): Promise<string[]> =>
  page.evaluate(
    (p) => window.__digitaleBaeckerei?.nodes(p).map((n) => n.name) ?? [],
    prefix
  )

/**
 * Wartet, bis der Raum `raum` steht: Szene bereit, sein Start-Blickpunkt am
 * Canvas, und im Modell liegen seine Stücke (`kennzeichen` = ein Knoten, den
 * nur dieser Raum hat) - nicht die des vorigen Raums.
 */
export async function imRaum(
  page: Page,
  raum: Raum,
  kennzeichen: string
): Promise<void> {
  await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
    timeout: 60_000,
  })
  const start = raum.blickpunkte.find((b) => b.id === raum.start)
  await expect(szene(page, start?.name ?? '')).toBeVisible()
  await expect
    .poll(async () => (await knotenNamen(page, kennzeichen)).length)
    .toBeGreaterThan(0)
  await ruhe(page)
}

/** Ein Knoten, den nur die Testbackstube hat - und einer nur im Laden. */
export const NUR_BACKSTUBE = 'ofen/korpus'
export const NUR_LADEN = 'theke/korpus'

/**
 * Öffnet die App über den Link in die Testbackstube (`?raum=<id>`), mit
 * Messhaken und ohne Flug.
 */
export async function oeffneRaum(page: Page, raum: Raum): Promise<Protokoll> {
  const protokoll = protokolliere(page)
  const antwort = await page.goto(`${PFAD}?debug&intro=0&raum=${raum.id}`)
  expect(antwort?.status()).toBe(200)
  await imRaum(page, raum, NUR_BACKSTUBE)
  return protokoll
}

/**
 * Lebende WebGL-Kontexte der Seite (Chromium, DevTools-Protokoll), nach einer
 * Speicherbereinigung - so zählt auch `nahansicht.spec.ts`.
 */
export async function webglKontexte(
  page: Page
): Promise<() => Promise<number>> {
  const cdp = await page.context().newCDPSession(page)
  return async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    const proto = await cdp.send('Runtime.evaluate', {
      expression: 'WebGL2RenderingContext.prototype',
      objectGroup: 'zaehlen',
    })
    const alle = await cdp.send('Runtime.queryObjects', {
      prototypeObjectId: proto.result.objectId ?? '',
      objectGroup: 'zaehlen',
    })
    const anzahl = await cdp.send('Runtime.callFunctionOn', {
      objectId: alle.objects.objectId,
      functionDeclaration: 'function () { return this.length }',
      returnByValue: true,
    })
    // Die eigene Liste wieder loslassen - sonst hält die Messung fest.
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'zaehlen' })
    return anzahl.result.value as number
  }
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

/**
 * Wartet, bis die Kamera am Standort des Blickpunkts `name` steht (für das
 * aktuelle Bildformat). `ruhe()` allein reicht nach einem Wechsel nicht: Auf
 * einem ausgelasteten Rechner beginnt die Fahrt manchmal erst nach der ersten
 * Messung, und „kein neues Bild“ hieße dann fälschlich „angekommen“.
 */
export async function angekommen(
  page: Page,
  name: string,
  raum: Raum = LADEN
): Promise<void> {
  const blickpunkt = raum.blickpunkte.find((b) => b.name === name)
  if (!blickpunkt) throw new Error(`Blickpunkt ${name} gibt es nicht`)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('kein Viewport')
  const soll = ansichtFuer(blickpunkt, viewport.width / viewport.height).eye
  await expect
    .poll(
      async () => {
        const eye = await page.evaluate(
          () => window.__digitaleBaeckerei?.info().eye ?? []
        )
        return Math.hypot(
          (eye[0] ?? NaN) - soll[0],
          (eye[1] ?? NaN) - soll[1],
          (eye[2] ?? NaN) - soll[2]
        )
      },
      { intervals: [100], timeout: 30_000 }
    )
    .toBeLessThan(0.001)
  await ruhe(page)
}

export async function wechsleZu(
  page: Page,
  name: string,
  raum: Raum = LADEN
): Promise<void> {
  await blickpunktKnopf(page, name).click()
  await expect(szene(page, name)).toBeVisible()
  // Die Fahrt dorthin (≈ 0,8 s, auf langsamen Rechnern länger) abwarten.
  await angekommen(page, name, raum)
}

export const produktSheet = (page: Page): Locator =>
  page.getByTestId('produkt-sheet')

export const allesHierListe = (page: Page): Locator =>
  page.getByTestId('alles-hier-liste')

/** Wie viele Bilder die Szene bisher gezeichnet hat (gerendert wird nur bei Bedarf). */
export const bilder = (page: Page): Promise<number> =>
  page.evaluate(() => window.__digitaleBaeckerei?.frames ?? -1)

/**
 * Wartet, bis die Szene nichts mehr zeichnet (Fahrt, Feder, Einblenden) -
 * statt einer festen Wartezeit, die auf einem langsamen Rechner mitten in der
 * Fahrt enden kann.
 */
export async function ruhe(page: Page): Promise<void> {
  let vorher = -1
  await expect
    .poll(
      async () => {
        const jetzt = await bilder(page)
        const still = jetzt === vorher
        vorher = jetzt
        return still
      },
      { intervals: [400], timeout: 30_000 }
    )
    .toBe(true)
}

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
