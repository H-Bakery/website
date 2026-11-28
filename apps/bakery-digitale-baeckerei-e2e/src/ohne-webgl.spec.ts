/**
 * @fileoverview Ersatz ohne WebGL: dieselben Listen wie „Alles hier“, für alle
 * Blickpunkte, mit langem Text und Link auf die Website - auch der Weg für
 * Screenreader. Dazu, was neben jeder Ansicht steht: Impressum und
 * Datenschutz der Landingpage und die Link-Vorschau im HTML. (Dass die Seite
 * ohne WebGL nicht abstürzt, prüft schon `laden.spec.ts`.)
 */
import { expect, test } from '@playwright/test'
import {
  BLICKPUNKTE,
  OHNE_MODELL,
  PFAD,
  PREIS,
  WAISE,
  erwarteKeinePreise,
  erwarteteEintraege,
  ladeFixture,
  oeffne,
  ohneWebGL,
  protokolliere,
} from './support/app'

interface SnapshotProdukt {
  name: string
  kurztext: string
  text: string
  seite?: string
}

/** Die Produkte des synthetischen Snapshots (mit langem Text und Seite). */
const PRODUKTE = ladeFixture().snapshot.produkte as Record<
  string,
  SnapshotProdukt
>

/** Ein Produkt im Laden, dessen langer Text mehr sagt als der Kurztext. */
const MIT_LANGEM_TEXT = (() => {
  const ids = BLICKPUNKTE.flatMap((b) =>
    erwarteteEintraege([...b.moebel]).map((e) => e.produkt)
  )
  const id = ids.find((i) => {
    const lang = PRODUKTE[i].text.trim()
    return lang !== '' && lang !== PRODUKTE[i].kurztext.trim()
  })
  if (!id) throw new Error('Kein Produkt mit langem Text im Fixture')
  return PRODUKTE[id]
})()

/** Was im unsichtbaren Text eine Tab-Taste anhalten ließe. */
const FOKUSSIERBAR =
  'a[href], button, summary, input, select, textarea, [tabindex], [contenteditable="true"]'

test.describe('Ohne WebGL: Produktlisten statt 3D', () => {
  test('zeigt je Blickpunkt die Produkte aus dem Snapshot', async ({
    page,
  }) => {
    await ohneWebGL(page)
    const protokoll = protokolliere(page)
    await page.goto(PFAD)

    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)

    for (const blickpunkt of BLICKPUNKTE) {
      await expect(
        ersatz.getByRole('heading', { name: blickpunkt.name })
      ).toBeVisible()
      for (const eintrag of erwarteteEintraege([...blickpunkt.moebel])) {
        await expect(
          ersatz.getByText(eintrag.name, { exact: true }).first()
        ).toBeVisible()
      }
    }
    await expect(ersatz.getByText(WAISE.produkt)).toHaveCount(0)
    await expect(ersatz).not.toContainText(PREIS)
    await erwarteKeinePreise(page)
    expect(protokoll.ausnahmen).toEqual([])
    expect(protokoll.antworten).toEqual([])
  })

  test('zeigt den langen Text unter „Mehr lesen“ und verlinkt die Produktseite', async ({
    page,
  }) => {
    await ohneWebGL(page)
    await page.goto(PFAD)
    const ersatz = page.getByTestId('ohne-webgl')
    await expect(ersatz).toBeVisible()

    // „Testkekse“ hat im Snapshot eine Seite: Link in einem neuen Tab.
    const kekse = PRODUKTE[OHNE_MODELL.produkt]
    expect(kekse.seite).toBeTruthy()
    const zeile = ersatz
      .getByRole('listitem')
      .filter({ hasText: OHNE_MODELL.name })
      .first()
    const link = zeile.getByRole('link', { name: 'Mehr auf der Website' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', kekse.seite as string)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)

    // Der lange Text ist zu, bis man „Mehr lesen“ antippt.
    const mitText = ersatz
      .getByRole('listitem')
      .filter({ hasText: MIT_LANGEM_TEXT.name })
      .first()
    const lang = mitText.getByText(MIT_LANGEM_TEXT.text.trim())
    await expect(lang).toBeHidden()
    await mitText.getByText('Mehr lesen', { exact: true }).click()
    await expect(lang).toBeVisible()
    await expect(ersatz).not.toContainText(PREIS)
  })

  test('nennt unten Impressum und Datenschutz der Landingpage', async ({
    page,
  }) => {
    await ohneWebGL(page)
    await page.goto(PFAD)
    const fuss = page.getByTestId('ohne-webgl').locator('footer')
    await fuss.scrollIntoViewIfNeeded()
    await expect(fuss).toBeVisible()
    // Wurzelrelativ: die Seiten der Landingpage, nicht unter dem Unterpfad.
    await expect(
      fuss.getByRole('link', { name: 'Impressum', exact: true })
    ).toHaveAttribute('href', '/imprint')
    await expect(
      fuss.getByRole('link', { name: 'Datenschutz', exact: true })
    ).toHaveAttribute('href', '/datenschutz')
  })
})

test.describe('Neben der laufenden 3D-Ansicht', () => {
  test('die unsichtbare Liste für Screenreader hat keinen Tab-Halt, aber den langen Text', async ({
    page,
  }) => {
    await oeffne(page)
    const liste = page.getByTestId('ohne-webgl')
    await expect(liste).toHaveCount(1)
    await expect(liste).toContainText(OHNE_MODELL.name)
    expect(await liste.locator(FOKUSSIERBAR).count()).toBe(0)
    expect(await liste.locator('a').count()).toBe(0)
    expect(await liste.textContent()).toContain(MIT_LANGEM_TEXT.text.trim())
  })

  test('die Leiste zeigt bei 390×844 das Impressum neben „Quellen“', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await oeffne(page)
    const leiste = page.getByTestId('blickpunkt-leiste')
    const quellen = leiste.getByRole('button', { name: 'Quellen' })
    const impressum = leiste.getByRole('link', { name: 'Impressum' })
    await expect(quellen).toBeVisible()
    await expect(impressum).toBeVisible()
    await expect(impressum).toHaveAttribute('href', '/imprint')
    await expect(impressum).toHaveAttribute('target', '_blank')
    const box = await impressum.boundingBox()
    const rahmen = await leiste.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    // ganz in der Leiste, nicht abgeschnitten
    expect(box?.x).toBeGreaterThanOrEqual(rahmen?.x ?? 0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      (rahmen?.x ?? 0) + (rahmen?.width ?? 0)
    )
  })
})

test.describe('Link-Vorschau', () => {
  test('das HTML des Exports trägt Open Graph, kein noindex, canonical = og:url', async ({
    page,
  }) => {
    const antwort = await page.request.get(PFAD)
    expect(antwort.status()).toBe(200)
    const html = await antwort.text()
    const meta = (name: string): string | null => {
      const treffer = new RegExp(
        `<meta (?:property|name)="${name}" content="([^"]*)"`
      ).exec(html)
      return treffer ? treffer[1] : null
    }
    expect(meta('og:title')).toBe('Digitale Bäckerei – Bäckerei Heusser')
    expect(meta('og:description')).toBe(meta('description'))
    expect(meta('og:description')).toMatch(/\S/)
    expect(meta('og:url')).toMatch(/^https:\/\/[^/]+\/digitale-baeckerei\/$/)
    expect(meta('og:site_name')).toBe('Bäckerei Heusser')
    expect(meta('og:locale')).toBe('de_DE')
    expect(meta('og:type')).toBe('website')
    expect(meta('og:image')).toBeNull()
    // Seit der Abnahme (P2) im Suchindex, mit der Adresse unter der Landingpage.
    expect(meta('robots')).toBeNull()
    const canonical = /<link rel="canonical" href="([^"]*)"/.exec(html)
    expect(canonical?.[1]).toBe(meta('og:url'))
  })
})
