/**
 * @fileoverview Einrichtung des Verkaufsraums (DB12): Der Fixture-Build trägt
 * drei synthetische Regal-Modelle und eine synthetische Einrichtung
 * (`src/test/fixtures/einrichtung.yaml` der App) - ein Platz mit anderem
 * Produkt (gelegt), einer leer, einer mit einem Produkt ohne Regal-Modell.
 * Dazu der Einrichten-Modus: Im Fixture-Build gibt es das Werkzeug zum Testen
 * mit `?einrichten=1`; im öffentlichen Export steckt es nicht.
 */
import * as fs from 'fs'
import { expect, test, type Page } from '@playwright/test'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { aendereEinrichtung } from '../../bakery-digitale-baeckerei/scripts/einrichtung'
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  EINGERICHTET,
  EINRICHTUNG_PATH,
  MIT_REGAL,
} from '../../bakery-digitale-baeckerei/src/test/fixtures/fixture-info'
import {
  PFAD,
  allesHierListe,
  bilder,
  erwarteKeinePreise,
  erwarteteEintraege,
  ladeFixture,
  moebelVon,
  oeffne,
  ohneWebGL,
  produktSheet,
  protokolliere,
  ruhe,
  tippeAufPlatz,
  wechsleZu,
} from './support/app'

interface Eingerichtet {
  plaetze: number
  stuecke: number
  dreiecke: number
  leer: number
  ohneModell: number
}

/** Was die Szene eingerichtet hat (Messhaken). */
const eingerichtet = (page: Page): Promise<Eingerichtet | null> =>
  page.evaluate(
    () =>
      (
        window.__digitaleBaeckerei?.info() as unknown as {
          einrichtung: Eingerichtet | null
        }
      ).einrichtung
  )

/** Knoten eines Platzes: sichtbar? Welches Produkt trägt er jetzt? */
const platz = (page: Page, slot: string) =>
  page.evaluate((name) => {
    const [k] = window.__digitaleBaeckerei?.nodes(name) ?? []
    return k
      ? { sichtbar: k.visible, produkt: k.extras['product'] ?? null }
      : null
  }, `produkt/${slot}`)

test.describe('Einrichtung: Regal-Modelle auf den Plätzen', () => {
  test('die Szene legt die Regal-Modelle - auf alle Plätze ihrer Produkte, nicht nur die geänderten', async ({
    page,
  }) => {
    const protokoll = await oeffne(page)
    const e = await eingerichtet(page)
    // testbrot-500g (3 Plätze), musterbrezel (3), musterweck (1)
    expect(e?.plaetze).toBe(7)
    expect(e?.stuecke).toBeGreaterThanOrEqual(7)
    expect(e?.leer).toBe(1)
    expect(e?.ohneModell).toBe(1)
    // Das Paket der Regal-Modelle ist eine Anfrage - nicht eine je Produkt.
    const pakete = protokoll.anfragen.filter((url) =>
      url.includes('/produkte-3d/')
    )
    expect(pakete).toEqual([
      expect.stringMatching(/\/digitale-baeckerei\/produkte-3d\/_regal\.glb$/),
    ])
    expect(protokoll.konsole).toEqual([])
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
    expect(MIT_REGAL).toHaveLength(3)
  })

  test('ein gelegter Platz ist antippbar: Karte des eingerichteten Produkts, der Platz leuchtet', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await wechsleZu(page, 'Brotregal')
    const { slot, produkt } = EINGERICHTET.gelegt
    // Im Modell liegt dort ein anderes Produkt - der Platz trägt jetzt das eingerichtete.
    expect(await platz(page, slot)).toEqual({ sichtbar: true, produkt })

    await tippeAufPlatz(page, slot, hasTouch)

    const sheet = produktSheet(page)
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Testbrot', { exact: true })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => window.__digitaleBaeckerei?.hervorgehoben)
      )
      .toBe(slot)
    await erwarteKeinePreise(page)
  })

  test('Doppeltipp auf einen gelegten Platz zoomt heran, der nächste zurück', async ({
    page,
    hasTouch,
  }) => {
    await oeffne(page)
    await wechsleZu(page, 'Brotregal')
    const fov = () =>
      page.evaluate(() => window.__digitaleBaeckerei?.info().fov ?? 0)
    const start = await fov()
    const pos = await page.evaluate(
      (s) => window.__digitaleBaeckerei?.screenPos(s) ?? null,
      EINGERICHTET.gelegt.slot
    )
    expect(pos).not.toBeNull()
    const doppelt = async () => {
      const { x, y } = pos as { x: number; y: number }
      if (hasTouch) {
        await page.touchscreen.tap(x, y)
        await page.touchscreen.tap(x, y)
      } else {
        await page.mouse.dblclick(x, y)
      }
      await ruhe(page)
    }
    await doppelt()
    expect(await fov()).toBeLessThan(start - 5)
    await doppelt()
    expect(await fov()).toBeCloseTo(start, 1)
  })

  test('ein leerer Platz zeigt nichts und steht in keiner Liste', async ({
    page,
  }) => {
    await oeffne(page)
    const { slot } = EINGERICHTET.leer
    expect(await platz(page, slot)).toEqual({ sichtbar: false, produkt: null })
    expect(
      await page.evaluate(
        (s) => window.__digitaleBaeckerei?.screenPos(s) ?? null,
        slot
      )
    ).toBeNull()
    expect(
      erwarteteEintraege(moebelVon('theke')).some((e) => e.slot === slot)
    ).toBe(false)
  })

  test('ein Produkt ohne Regal-Modell steht in der Liste und lässt sich von dort öffnen - im Bild bleibt sein Platz leer', async ({
    page,
  }) => {
    await oeffne(page)
    const { slot, produkt } = EINGERICHTET.ohneModell
    // Der Knoten trägt das Produkt, zeigt aber weder die Ware des Modells
    // noch eine andere Form.
    expect(await platz(page, slot)).toEqual({ sichtbar: true, produkt })

    await page.getByRole('button', { name: 'Alles hier' }).click()
    const liste = allesHierListe(page)
    await expect(liste).toBeVisible()
    const erwartet = Array.from(
      new Set(erwarteteEintraege(moebelVon('theke')).map((e) => e.name))
    )
    for (const name of erwartet) {
      await expect(liste.getByText(name, { exact: true })).toBeVisible()
    }
    await liste.getByText('Testkekse', { exact: true }).click()
    await expect(produktSheet(page)).toContainText('Testkekse')
  })

  test('in Ruhe zeichnet die Szene nichts - auch mit gelegten Stücken', async ({
    page,
  }) => {
    await oeffne(page)
    await ruhe(page)
    const vorher = await bilder(page)
    await page.waitForTimeout(1500)
    expect(await bilder(page)).toBe(vorher)
  })

  test('ohne WebGL: Die Liste folgt der Einrichtung', async ({ page }) => {
    await ohneWebGL(page)
    protokolliere(page)
    await page.goto(`${PFAD}?debug&intro=0`)
    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible({ timeout: 60_000 })
    // Das eingerichtete Produkt steht am Brotregal; das Produkt, das im
    // Modell dort lag und sonst nirgends liegt, fehlt.
    await expect(
      ersatz.getByText('Testbrot', { exact: true }).first()
    ).toBeVisible()
    const nurImModell = erwarteteEintraege(['brotregal/', 'theke/']).some(
      (e) => e.produkt === EINGERICHTET.gelegt.imModell
    )
    expect(nurImModell).toBe(false)
    await expect(
      ersatz.getByText(
        ladeFixture().snapshot.produkte[EINGERICHTET.gelegt.imModell].name,
        { exact: true }
      )
    ).toHaveCount(0)
  })
})

test.describe('Einrichten-Modus (lokales Werkzeug, im Fixture-Build mit ?einrichten=1)', () => {
  const SLOT = 'theke/vitrine/ebene-3/platz-01'

  async function oeffneWerkzeug(page: Page) {
    const protokoll = protokolliere(page)
    await page.goto(`${PFAD}?debug&intro=0&einrichten=1`)
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 60_000,
    })
    await page.waitForFunction(() => window.__digitaleBaeckerei?.ready === true)
    await expect(page.getByTestId('einrichten-leiste')).toBeVisible()
    return protokoll
  }

  test('ohne den Parameter gibt es das Werkzeug nicht', async ({ page }) => {
    const protokoll = await oeffne(page)
    await expect(page.getByTestId('einrichten-leiste')).toHaveCount(0)
    expect(
      protokoll.anfragen.filter((url) => url.includes('/data/einrichtung.'))
    ).toEqual([])
  })

  test('Platz antippen, Produkt und Stückzahl setzen: Die Szene zeigt es sofort, und die Datei stimmt', async ({
    page,
    hasTouch,
  }) => {
    const protokoll = await oeffneWerkzeug(page)
    const vorher = await eingerichtet(page)
    await expect(page.getByTestId('einrichten-aenderungen')).toContainText(
      'Änderungen (0)'
    )
    // Der Hinweis beim Start passt zum Werkzeug: Ein Tipp öffnet hier keine Infos.
    await expect(
      page.getByText('Ziehen zum Umschauen · Platz antippen zum Einrichten')
    ).toBeVisible()
    await expect(page.getByText('Tippen für Infos')).toHaveCount(0)

    await tippeAufPlatz(page, SLOT, hasTouch)
    const blatt = page.getByTestId('einrichten-platz')
    await expect(blatt).toBeVisible()
    await expect(blatt).toContainText('Theke · Vitrine · Ebene 3 · Platz 1')
    await expect(page.getByTestId('einrichten-inhalt')).toHaveText(
      '3 × Testkekse'
    )
    // Die Produktkarte öffnet sich im Einrichten-Modus nicht.
    await expect(produktSheet(page)).toBeHidden()

    await page.getByTestId('einrichten-suche').fill('testbrot')
    await expect(
      page.getByTestId('einrichten-produkt-testbrot-500g')
    ).toContainText('mit Regal-Modell')
    await expect(
      page.getByTestId('einrichten-produkt-testbrot-1000g')
    ).toContainText('ohne Regal-Modell')
    // Die Suchfelder sind Touch-Ziele.
    const feld = await page.getByTestId('einrichten-suche').boundingBox()
    expect(feld?.height).toBeGreaterThanOrEqual(44 - 0.5)

    await page.getByTestId('einrichten-produkt-testbrot-500g').click()
    // Drei Kekse lagen dort - von den Broten passt nur eines: Die Stückzahl
    // wird angepasst, und das Werkzeug sagt es.
    await expect(page.getByTestId('einrichten-anzahl')).toHaveText('1')
    await expect(page.getByTestId('einrichten-angepasst')).toContainText(
      'Auf diesen Platz passen nur 1 Stück'
    )
    // Wer trotzdem mehr will, darf - und liest den Hinweis.
    await page.getByTestId('einrichten-mehr').click()
    await expect(page.getByTestId('einrichten-anzahl')).toHaveText('2')
    await expect(page.getByTestId('einrichten-hinweis')).toHaveText(
      'Hinweis: nur 1 von 2 passen.'
    )
    await expect(page.getByTestId('einrichten-inhalt')).toHaveText(
      '2 × Testbrot'
    )

    // Live in der Szene: ein gelegter Platz mehr, der Knoten trägt das Produkt.
    await expect
      .poll(async () => (await eingerichtet(page))?.plaetze)
      .toBe((vorher?.plaetze ?? 0) + 1)
    expect(await platz(page, SLOT)).toEqual({
      sichtbar: true,
      produkt: 'testbrot-500g',
    })

    await page.getByRole('button', { name: 'Platz schließen' }).click()
    await page.getByTestId('einrichten-aenderungen').click()
    const dialog = page.getByTestId('einrichten-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('einrichten-liste')).toContainText(
      'wie im Modell → 2 × Testbrot'
    )

    // Die vollständige Datei: die synthetische Einrichtung des Fixtures mit
    // genau dieser Änderung - Kommentare und alle anderen Zeilen wie zuvor.
    const quelle = fs.readFileSync(EINRICHTUNG_PATH, 'utf8')
    const erwartet = aendereEinrichtung(quelle, {
      laden: { [SLOT]: { produkt: 'testbrot-500g', anzahl: 2 } },
    })
    expect(erwartet).toContain('# anderes Produkt, mit Regal-Modell')
    await expect(dialog.getByTestId('einrichten-yaml')).toHaveValue(erwartet)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByTestId('einrichten-herunterladen').click(),
    ])
    expect(download.suggestedFilename()).toBe('einrichtung.yaml')
    expect(fs.readFileSync(await download.path(), 'utf8')).toBe(erwartet)

    // „Zurücknehmen“: wieder genau die Datei, mit der der Build entstand.
    await dialog.getByRole('button', { name: 'Zurücknehmen' }).click()
    await expect(dialog.getByTestId('einrichten-yaml')).toHaveValue(quelle)
    await expect
      .poll(async () => (await eingerichtet(page))?.plaetze)
      .toBe(vorher?.plaetze)

    expect(protokoll.konsole).toEqual([])
    expect(protokoll.ausnahmen).toEqual([])
    // Gespeichert wird nichts - der Entwurf lebt im Arbeitsspeicher.
    expect(
      await page.evaluate(() => [
        window.localStorage.length,
        window.sessionStorage.length,
        document.cookie,
      ])
    ).toEqual([0, 0, ''])
  })

  test('„Leer“ leert einen Platz in Szene und Liste, „Wie im Modell“ holt ihn zurück', async ({
    page,
  }) => {
    await oeffneWerkzeug(page)
    await page.getByRole('button', { name: 'Plätze' }).click()
    const feld = await page.getByTestId('einrichten-platzsuche').boundingBox()
    expect(feld?.height).toBeGreaterThanOrEqual(44 - 0.5)
    await page.getByTestId(`einrichten-waehle-${SLOT}`).click()
    await page.getByTestId('einrichten-leer').click()
    await expect(page.getByTestId('einrichten-inhalt')).toHaveText('leer')
    await expect
      .poll(async () => (await platz(page, SLOT))?.sichtbar)
      .toBe(false)

    await page.getByTestId('einrichten-modell').click()
    await expect(page.getByTestId('einrichten-inhalt')).toHaveText(
      '3 × Testkekse'
    )
    await expect
      .poll(async () => await platz(page, SLOT))
      .toEqual({ sichtbar: true, produkt: 'testkekse' })
    await expect(page.getByTestId('einrichten-aenderungen')).toContainText(
      'Änderungen (0)'
    )
  })
})

test.describe('Einrichtung: Daten, die auf sich warten lassen', () => {
  test('eine Daten-Anfrage, die hängt, hält die Szene nicht auf: Der Laden steht, wie er im Modell ist', async ({
    page,
  }) => {
    // Die Belegung antwortet nie.
    await page.route('**/data/belegung.json', () => undefined)
    await page.goto(`${PFAD}?debug&intro=0`)
    // Weit vor der Frist der Daten (8 s): Das Modell ist da und gezeichnet.
    await expect(page.locator('main[data-zustand="bereit"]')).toBeVisible({
      timeout: 7000,
    })
    await page.waitForFunction(() => window.__digitaleBaeckerei?.ready === true)
    expect(await eingerichtet(page)).toBeNull()
    // Nichts ist gelegt, nichts verborgen: die Ware des Modells.
    expect(await platz(page, EINGERICHTET.gelegt.slot)).toEqual({
      sichtbar: true,
      produkt: EINGERICHTET.gelegt.imModell,
    })
    expect(await platz(page, EINGERICHTET.leer.slot)).toMatchObject({
      sichtbar: true,
    })
    const stats = await page.evaluate(() =>
      window.__digitaleBaeckerei?.pixelStats()
    )
    expect(stats?.distinct).toBeGreaterThan(10)
  })

  test('kommen die Daten doch noch, wird die laufende Szene eingerichtet', async ({
    page,
  }) => {
    // Das Paket der Regal-Modelle kommt erst nach der Frist des ersten Bildes.
    await page.route('**/produkte-3d/_regal.glb', async (route) => {
      await new Promise((weiter) => setTimeout(weiter, 4000))
      await route.continue()
    })
    await page.goto(`${PFAD}?debug&intro=0`)
    await page.waitForFunction(() => window.__digitaleBaeckerei?.ready === true)
    // Erst wie im Modell …
    expect(await eingerichtet(page)).toBeNull()
    // … dann eingerichtet, ohne neu zu laden.
    await expect
      .poll(async () => (await eingerichtet(page))?.plaetze, {
        timeout: 15_000,
      })
      .toBe(7)
    expect(await platz(page, EINGERICHTET.gelegt.slot)).toEqual({
      sichtbar: true,
      produkt: EINGERICHTET.gelegt.produkt,
    })
    await ruhe(page)
  })
})
