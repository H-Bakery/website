/**
 * @fileoverview Bedienung der Szene: Umschauen in Grenzen, Zoom über den
 * Öffnungswinkel, Doppeltipp hin und zurück, die Karte bei laufender Szene,
 * Tippen ohne Geisterklick, Auswahl aus der Liste, Preisschilder - mit dem
 * synthetischen Fixture.
 *
 * Was die Suite dafür von der App erwartet, steht im Kopf von
 * `support/app.ts`.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  BLICKPUNKTE,
  WAISE,
  allesHierListe,
  bilder,
  erwarteteEintraege,
  ladeFixture,
  oeffne,
  produktSheet,
  ruhe,
  szene,
  tippeAufPlatz,
  wechsleZu,
  zaehlePreisPrimitive,
} from './support/app'

const KEKSE = 'theke/vitrine/ebene-3/platz-01'
/**
 * Neutrale Ware (eine Dose) an den Regalen: ohne Produkt, ohne Karte. Das
 * oberste Fach - die Mitte der unteren verdeckt von schräg oben das Fach darüber.
 */
const WARE = 'dosenregal/platz-04'
/** Liegt in der Vitrine hinter der Scheibe. */
const PLUNDER = {
  slot: 'theke/vitrine/ebene-1/platz-04',
  name: 'Musterplunder Apfel',
}

const info = (page: Page) =>
  page.evaluate(() => {
    const haken = window.__digitaleBaeckerei
    if (!haken) throw new Error('Messhaken fehlt')
    return haken.info()
  })

/** Oberstes Brot im Regal: an der Theke (Desktop) oben rechts im Bild. */
const BROT_OBEN = { slot: 'brotregal/ebene-3/platz-01', name: 'Testbrot' }

const hervorgehoben = (page: Page) =>
  page.evaluate(() => window.__digitaleBaeckerei?.hervorgehoben ?? null)

const position = (page: Page, slot: string) =>
  page.evaluate((s) => window.__digitaleBaeckerei?.screenPos(s) ?? null, slot)

/** Blickrichtung um die Hochachse in Grad. */
const yaw = async (page: Page) => {
  const { richtung } = await info(page)
  return (Math.atan2(richtung[0], richtung[2]) * 180) / Math.PI
}

declare global {
  interface Window {
    /** Klicks, die nicht dem Canvas galten (siehe `klicksMitschreiben`). */
    __fremdeKlicks?: string[]
  }
}

/**
 * Schreibt jeden Klick mit, der nicht auf dem Canvas landet - ein Fingertipp
 * ins Bild darf danach nichts anderes anklicken (Karte, Leiste, Pfeile).
 * Hört in der Capture-Phase am Dokument, also vor jedem Bedienelement.
 */
const klicksMitschreiben = (page: Page) =>
  page.evaluate(() => {
    window.__fremdeKlicks = []
    document.addEventListener(
      'click',
      (event) => {
        const ziel = event.target instanceof Element ? event.target : null
        if (ziel?.tagName === 'CANVAS') return
        const bereich = ziel
          ?.closest('[data-testid]')
          ?.getAttribute('data-testid')
        const element = ziel?.closest('button, a') ?? ziel
        window.__fremdeKlicks?.push(
          `${bereich ?? '-'}: ${
            (element?.textContent ?? '').trim() || element?.tagName
          }`
        )
      },
      true
    )
  })

const fremdeKlicks = (page: Page) =>
  page.evaluate(() => window.__fremdeKlicks ?? null)

/** Liegt an dieser Stelle oben das Canvas (kein Bedienelement darüber)? */
const canvasOben = (page: Page, pos: { x: number; y: number }) =>
  page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
    pos
  )

type Box = { x: number; y: number; width: number; height: number }

const liegtIn = (pos: { x: number; y: number }, box: Box | null) =>
  !!box &&
  pos.x >= box.x &&
  pos.x <= box.x + box.width &&
  pos.y >= box.y &&
  pos.y <= box.y + box.height

/** Alle Produkte mit Karte, die es im Laden gibt (über alle Blickpunkte). */
const PRODUKTE = Array.from(
  new Map(
    BLICKPUNKTE.flatMap((b) => erwarteteEintraege(b.moebel)).map((e) => [
      e.slot,
      e,
    ])
  ).values()
)

/**
 * Tippt an der Theke nacheinander auf Produkte, die frei im Bild liegen -
 * jedes Mal mit geschlossener Karte und am liebsten dort, wo die Karte gleich
 * aufgeht: Dort landete der Klick, den der Browser nach dem Tipp nachreicht.
 * Kein Tipp darf danach etwas in Karte oder Leiste anklicken - weder „Mehr
 * lesen“ noch „In 3D ansehen“, keinen Link, keinen Chip. Danach gelten
 * Pfeiltasten und `+` weiter der Szene, auch wenn der Fokus vorher in der
 * Karte stand.
 *
 * `unterDerKarte`: so viele Tipps müssen dort liegen, wo die Karte aufging -
 * sonst prüfte der Test nichts. Im Hochformat des Fixtures liegt kein Produkt
 * so tief (das Sheet geht unten über der Leiste auf).
 */
async function tippeOhneGeisterklick(
  page: Page,
  unterDerKarte: number
): Promise<void> {
  await oeffne(page)
  await ruhe(page)
  await klicksMitschreiben(page)
  const sheet = produktSheet(page)
  let karte: Box | null = null
  const getippt: string[] = []
  let darunter = 0

  for (let runde = 0; runde < 6; runde += 1) {
    if (await sheet.isVisible()) {
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
      await ruhe(page)
    }
    // Frei im Bild (das Canvas liegt oben), noch nicht getippt; zuerst die,
    // die dort liegen, wo die Karte zuletzt aufging.
    const frei: {
      eintrag: (typeof PRODUKTE)[number]
      pos: { x: number; y: number }
    }[] = []
    for (const eintrag of PRODUKTE) {
      if (getippt.includes(eintrag.slot)) continue
      const pos = await position(page, eintrag.slot)
      if (pos && (await canvasOben(page, pos))) frei.push({ eintrag, pos })
    }
    const wahl = frei.find((f) => liegtIn(f.pos, karte)) ?? frei[0]
    if (!wahl) break
    const { eintrag, pos } = wahl
    await page.touchscreen.tap(pos.x, pos.y)
    getippt.push(eintrag.slot)
    await expect(sheet.getByText(eintrag.name, { exact: true })).toBeVisible()
    karte = await sheet.boundingBox()
    if (liegtIn(pos, karte)) darunter += 1
    // Ein Geisterklick käme gleich nach dem Tipp; die Fahrt danach abwarten.
    await ruhe(page)
    expect(
      await fremdeKlicks(page),
      `nach dem Tipp auf ${eintrag.slot}`
    ).toEqual([])
    await expect(sheet).toHaveAttribute('data-aufgeklappt', 'false')
    await expect(page.getByTestId('nahansicht')).toHaveCount(0)
    expect(page.context().pages()).toHaveLength(1)
  }
  expect(getippt.length, 'mehrere Produkte angetippt').toBeGreaterThanOrEqual(3)
  expect(darunter, 'Tipps dort, wo die Karte aufging').toBeGreaterThanOrEqual(
    unterDerKarte
  )

  // Der Fokus steht in der Karte (z. B. mit der Tastatur auf „Schließen“) -
  // ein Tipp ins Bild holt ihn in die Szene zurück.
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Schließen' }).focus()
  let ziel: { x: number; y: number } | null = null
  for (const eintrag of PRODUKTE) {
    const pos = await position(page, eintrag.slot)
    if (pos && (await canvasOben(page, pos))) {
      ziel = pos
      break
    }
  }
  expect(ziel, 'ein Produkt neben der offenen Karte').not.toBeNull()
  if (!ziel) return
  await page.touchscreen.tap(ziel.x, ziel.y)
  await expect(sheet).toBeVisible()
  await expect(szene(page, 'Theke')).toBeFocused()
  // Ohne Fokusrahmen um das ganze Bild (wie früher über mousedown) ...
  await expect(szene(page, 'Theke')).toHaveCSS('outline-style', 'none')
  await ruhe(page)
  expect(await fremdeKlicks(page)).toEqual([])

  const vorher = (await info(page)).fov
  await page.keyboard.press('+')
  await expect.poll(async () => (await info(page)).fov).toBeLessThan(vorher - 2)
  // ... mit der Tastatur gehört er wieder dazu.
  await expect(szene(page, 'Theke')).toHaveCSS('outline-style', 'solid')
  await expect(sheet).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(szene(page, 'Regale')).toBeVisible()
}

/** Mitte der freien Bildfläche über der Leiste - dort liegt kein Bedienelement. */
const bildmitte = (page: Page) => {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
  return { x: width / 2, y: height * 0.3 }
}

test.describe('Umschauen und Zoom', () => {
  test('zeichnet in Ruhe nichts', async ({ page }) => {
    await oeffne(page)
    await ruhe(page)
    const vorher = await bilder(page)
    // Hier ist die Wartezeit die Prüfung: In 1,5 s ohne Bedienung darf kein
    // einziges Bild dazukommen.
    await page.waitForTimeout(1500)
    expect(await bilder(page)).toBe(vorher)
  })

  test('Ziehen dreht den Blick, über die Grenze hinaus federt er zurück', async ({
    page,
  }) => {
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const yaw0 = await yaw(page)
    const { x, y } = bildmitte(page)

    // Weit über die Grenze (± 20°) hinaus ziehen und loslassen.
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(x + i * 60, y)
    const gezogen = await yaw(page)
    await page.mouse.up()
    await ruhe(page)
    const danach = await info(page)
    const yaw1 = await yaw(page)

    // Gedreht, aber nur bis zur Grenze: 20° plus das, was das schmalere Bild
    // hergibt - nie die 100°+, die der Weg des Zeigers bedeutet hätte.
    expect(Math.abs(yaw1 - yaw0)).toBeGreaterThan(15)
    expect(Math.abs(yaw1 - yaw0)).toBeLessThan(26)
    // Während des Ziehens stand der Blick weiter draußen (Gummiband).
    expect(Math.abs(gezogen - yaw0)).toBeGreaterThan(Math.abs(yaw1 - yaw0))
    // Der Standort bleibt, der Öffnungswinkel auch.
    expect(danach.eye).toEqual(start.eye)
    expect(danach.fov).toBeCloseTo(start.fov, 5)
    // Ein Ziehen ist kein Tipp.
    await expect(produktSheet(page)).toBeHidden()
  })

  test('das Mausrad ändert nur den Öffnungswinkel, die Seite scrollt nicht', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Ein Mausrad gibt es am Desktop.')
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const { x, y } = bildmitte(page)

    await page.mouse.move(x, y)
    await page.mouse.wheel(0, -400)
    await ruhe(page)
    const nah = await info(page)
    expect(nah.fov).toBeLessThan(start.fov - 5)
    expect(nah.eye).toEqual(start.eye)

    // Ganz hinaus: nie weiter als die Startweite.
    await page.mouse.wheel(0, 5000)
    await ruhe(page)
    expect((await info(page)).fov).toBeCloseTo(start.fov, 5)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('Doppeltipp auf ein Produkt zoomt heran, der nächste zoomt zurück', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await ruhe(page)
    const start = await info(page)
    const doppelt = async (x: number, y: number) => {
      if (hasTouch) {
        await page.touchscreen.tap(x, y)
        await page.touchscreen.tap(x, y)
      } else {
        await page.mouse.dblclick(x, y)
      }
    }

    const kekse = await position(page, KEKSE)
    expect(kekse).not.toBeNull()
    await doppelt(kekse?.x ?? 0, kekse?.y ?? 0)
    // Erst auf den Zoom selbst warten: Beginnt er auf einem ausgelasteten
    // Rechner spät, hielte `ruhe()` die Zeit davor schon für das Ende.
    await expect
      .poll(async () => (await info(page)).fov)
      .toBeLessThan(start.fov * 0.6)
    await ruhe(page)
    const nah = await info(page)
    expect(nah.fov).toBeLessThan(start.fov * 0.6)
    expect(nah.eye).toEqual(start.eye)
    // Der erste Tipp des Doppeltipps hat die Karte geöffnet.
    await expect(produktSheet(page)).toBeVisible()

    // Zweiter Doppeltipp - auf eine leere Stelle - zoomt zurück zur Startweite.
    const { x, y } = bildmitte(page)
    await doppelt(x, 40 + y / 4)
    await ruhe(page)
    expect((await info(page)).fov).toBeCloseTo(start.fov, 5)
  })
})

test.describe('Karte bei laufender Szene', () => {
  test('ein Tipp ohne Produkt schließt die Karte und nimmt die Hervorhebung weg', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    await expect.poll(() => hervorgehoben(page)).toBe(KEKSE)

    // Ein Produkt, das der Snapshot nicht kennt, hat keine Karte - der Tipp
    // gilt als „daneben“.
    await tippeAufPlatz(page, WAISE.slot, hasTouch)
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
  })

  test('das gewählte Produkt bleibt neben der Karte zu sehen', async ({
    page,
    isMobile,
  }) => {
    // Am Desktop steht die Karte oben rechts - dort liegt an der Theke das
    // oberste Brot des Regals. Im Hochformat liegt im Fixture kein Produkt so
    // tief, dass das Sheet es verdeckt (Rechnung: bildausschnitt.spec.ts).
    test.skip(
      isMobile,
      'Im Fixture liegt im Hochformat nichts unter dem Sheet.'
    )
    await oeffne(page)
    await ruhe(page)
    const vorher = await position(page, BROT_OBEN.slot)
    await tippeAufPlatz(page, BROT_OBEN.slot, false)
    const sheet = produktSheet(page)
    await expect(sheet.getByText(BROT_OBEN.name, { exact: true })).toBeVisible()
    await ruhe(page)

    const karte = await sheet.boundingBox()
    const produkt = await position(page, BROT_OBEN.slot)
    expect(karte).not.toBeNull()
    expect(produkt, 'das Produkt ist noch im Bild').not.toBeNull()
    if (!karte || !produkt || !vorher) return
    // Ohne Schwenk läge es unter der Karte ...
    expect(vorher.x).toBeGreaterThan(karte.x)
    expect(vorher.y).toBeLessThan(karte.y + karte.height)
    // ... jetzt steht es links daneben.
    expect(produkt.x).toBeLessThan(karte.x)
  })

  test('Escape schließt die Karte, der Fokus kehrt zur Szene zurück', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Tastatur gibt es am Desktop.')
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, false)
    await expect(produktSheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
    await expect(szene(page, 'Theke')).toBeFocused()
  })

  test('ein Wechsel des Blickpunkts schließt die Karte', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    await expect.poll(() => hervorgehoben(page)).toBe(KEKSE)
    // Bei offener Karte: Im Hochformat liegt sie über den Chips, die Pfeile
    // am Rand bleiben frei. Am Desktop bleibt die Leiste frei.
    if (hasTouch) {
      await page
        .getByRole('button', { name: 'Nächster Blickpunkt: Brotregal' })
        .click()
    } else {
      await page
        .getByTestId('blickpunkt-leiste')
        .getByRole('button', { name: 'Brotregal', exact: true })
        .click()
    }
    await expect(szene(page, 'Brotregal')).toBeVisible()
    await expect(produktSheet(page)).toBeHidden()
    await expect.poll(() => hervorgehoben(page)).toBeNull()
  })

  test('nach einem Tipp bleibt der Fokus in der Szene: Pfeiltasten und +/- gehen weiter', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Tastatur gibt es am Desktop.')
    await oeffne(page)
    await ruhe(page)
    await tippeAufPlatz(page, KEKSE, false)
    await expect(produktSheet(page)).toBeVisible()
    await expect(szene(page, 'Theke')).toBeFocused()
    // Die Karte ist angesagt, ohne den Fokus zu holen.
    await expect(page.getByTestId('status')).toHaveText(
      'Infos zu Testkekse geöffnet.'
    )

    await ruhe(page)
    const vorher = (await info(page)).fov
    await page.keyboard.press('+')
    await ruhe(page)
    expect((await info(page)).fov).toBeLessThan(vorher - 2)
    await expect(produktSheet(page)).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(szene(page, 'Brotregal')).toBeVisible()
    await expect(produktSheet(page)).toBeHidden()
  })

  test('ein Tipp auf neutrale Ware leuchtet kurz auf, ohne Karte', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await wechsleZu(page, 'Regale')

    await tippeAufPlatz(page, WARE, hasTouch)
    // Das Aufleuchten hängt wirklich am Modell ...
    await expect.poll(() => hervorgehoben(page)).toBe(WARE)
    await expect(produktSheet(page)).toBeHidden()
    // ... und räumt sich selbst wieder ab; gewählt ist nichts.
    await expect.poll(() => hervorgehoben(page)).toBeNull()
    expect(
      await page.evaluate(() => window.__digitaleBaeckerei?.gewaehlt ?? null)
    ).toBeNull()
    await ruhe(page)
  })

  test('nach einer Größenänderung steht das gewählte Produkt wieder frei', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Das Fenster lässt sich am Desktop verändern.')
    await oeffne(page)
    await ruhe(page)
    await tippeAufPlatz(page, BROT_OBEN.slot, false)
    const sheet = produktSheet(page)
    await expect(sheet.getByText(BROT_OBEN.name, { exact: true })).toBeVisible()
    await ruhe(page)

    // Schmaler: Die Karte bleibt rechts oben, deckt jetzt aber mehr vom Bild.
    for (const groesse of [
      { width: 1000, height: 700 },
      { width: 1300, height: 600 },
    ]) {
      await page.setViewportSize(groesse)
      await ruhe(page)
      const karte = await sheet.boundingBox()
      const produkt = await position(page, BROT_OBEN.slot)
      expect(karte).not.toBeNull()
      expect(produkt, 'das Produkt ist noch im Bild').not.toBeNull()
      if (!karte || !produkt) return
      const unterDerKarte =
        produkt.x >= karte.x &&
        produkt.x <= karte.x + karte.width &&
        produkt.y >= karte.y &&
        produkt.y <= karte.y + karte.height
      expect(unterDerKarte, `${groesse.width}×${groesse.height}`).toBe(false)
    }
  })
})

test.describe('Tippen ohne Geisterklick', () => {
  test('Handy hochkant: ein Fingertipp öffnet die Karte und klickt nichts darin an', async ({
    page,
    hasTouch,
  }) => {
    test.skip(!hasTouch, 'Finger gibt es am Handy.')
    await tippeOhneGeisterklick(page, 0)
  })
})

test.describe('Tippen ohne Geisterklick, Handy quer (844×390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true })

  test('ein Fingertipp öffnet die Karte rechts oben und klickt nichts darin an', async ({
    page,
    isMobile,
  }) => {
    // Einmal genügt: im Projekt mit dem mobilen Chrome.
    test.skip(!isMobile, 'Quer mit Finger: im Projekt phone geprüft.')
    // Rechts oben, wo die Karte aufgeht, liegen an der Theke Brote.
    await tippeOhneGeisterklick(page, 2)
  })
})

test.describe('Auswahl aus der Liste', () => {
  test('schließt die Liste, hebt den Platz hervor und öffnet die Karte', async ({
    page,
  }) => {
    await oeffne(page)
    await page.getByRole('button', { name: 'Alles hier' }).click()
    await allesHierListe(page).getByText(PLUNDER.name, { exact: true }).click()

    await expect(allesHierListe(page)).toBeHidden()
    await expect(
      produktSheet(page).getByText(PLUNDER.name, { exact: true })
    ).toBeVisible()
    await expect.poll(() => hervorgehoben(page)).toBe(PLUNDER.slot)
    await ruhe(page)
    expect(
      await position(page, PLUNDER.slot),
      'der Platz steht im Bild'
    ).not.toBeNull()
  })
})

test.describe('Preisschilder (DB8)', () => {
  test('stecken nicht mehr im ausgelieferten Modell', async ({ page }) => {
    await oeffne(page)
    // Das Fixture hat vier Brote mit Preiskarte und Preisschrift; sync-model
    // nimmt sie vor dem Ausliefern heraus. Die App blendet nichts mehr aus.
    expect(
      zaehlePreisPrimitive(ladeFixture().glb),
      'das Fixture trägt die Preisschilder noch'
    ).toEqual({ primitive: 8, materialien: 2 })
    expect((await info(page)).preisschilder).toBe(0)

    const antwort = await page.request.get(
      new URL('model/twin.glb', page.url()).href
    )
    expect(antwort.ok()).toBe(true)
    expect(zaehlePreisPrimitive(await antwort.body())).toEqual({
      primitive: 0,
      materialien: 0,
    })
  })
})

test.describe('Außenraum', () => {
  test('ist an den Regalen ausgeblendet und an der Theke wieder da', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await oeffne(page)
    expect((await info(page)).aussenSichtbar).toBe(true)
    const leiste = page.getByTestId('blickpunkt-leiste')
    await leiste.getByRole('button', { name: 'Regale', exact: true }).click()
    await expect.poll(async () => (await info(page)).aussenSichtbar).toBe(false)
    await leiste.getByRole('button', { name: 'Theke', exact: true }).click()
    await expect.poll(async () => (await info(page)).aussenSichtbar).toBe(true)
  })
})

test.describe('Nichts auf dem Gerät', () => {
  test('legt nach Laden und Bedienen weder Cookies noch Speicher-Einträge an', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await tippeAufPlatz(page, KEKSE, hasTouch)
    await expect(produktSheet(page)).toBeVisible()
    await produktSheet(page).getByRole('button', { name: 'Schließen' }).click()
    await page.getByRole('button', { name: 'Alles hier' }).click()
    await expect(allesHierListe(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await page
      .getByTestId('blickpunkt-leiste')
      .getByRole('button', { name: 'Brotregal', exact: true })
      .click()
    await ruhe(page)

    expect(await page.context().cookies()).toEqual([])
    const speicher = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
    }))
    expect(speicher).toEqual({ local: [], session: [] })
  })

  test('folgt dem Farbschema des Systems allein per CSS', async ({ page }) => {
    const farbe = () =>
      page
        .getByTestId('blickpunkt-leiste')
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    await page.emulateMedia({ colorScheme: 'light' })
    await oeffne(page)
    const hell = await farbe()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(farbe).not.toBe(hell)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(farbe).toBe(hell)
    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual(
      []
    )
  })
})
