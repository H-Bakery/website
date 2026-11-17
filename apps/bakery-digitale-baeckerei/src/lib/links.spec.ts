import fs from 'fs'
import path from 'path'
import {
  APP_URL,
  DATENSCHUTZ_PFAD,
  IMPRESSUM_PFAD,
  LANDING_URL,
  STARTSEITE_PFAD,
} from './links'
// Die Links „Mehr auf der Website“ baut der Snapshot mit derselben Adresse.
import { LANDING_URL as SNAPSHOT_LANDING_URL } from '../../scripts/product-snapshot'

/** Seiten der Landingpage (App Router): ein Ordner je Pfad. */
const LANDING_APP = path.resolve(__dirname, '../../../bakery-landing/src/app')

describe('Links auf die Landingpage', () => {
  it('nennt dieselbe Adresse wie der Snapshot, ohne Schrägstrich am Ende', () => {
    expect(LANDING_URL).toBe(SNAPSHOT_LANDING_URL)
    expect(LANDING_URL).toMatch(/^https:\/\/[^/]+$/)
    expect(APP_URL).toBe(`${LANDING_URL}/digitale-baeckerei/`)
  })

  it('sind wurzelrelativ - für ein einfaches <a>, nicht unter dem Unterpfad', () => {
    for (const pfad of [STARTSEITE_PFAD, IMPRESSUM_PFAD, DATENSCHUTZ_PFAD]) {
      expect(pfad.startsWith('/')).toBe(true)
      expect(pfad).not.toContain('digitale-baeckerei')
    }
  })

  it('zeigen auf Seiten, die die Landingpage wirklich baut', () => {
    for (const pfad of [IMPRESSUM_PFAD, DATENSCHUTZ_PFAD]) {
      expect(
        fs.existsSync(path.join(LANDING_APP, pfad.slice(1), 'page.tsx'))
      ).toBe(true)
    }
    expect(fs.existsSync(path.join(LANDING_APP, 'page.tsx'))).toBe(true)
  })
})
