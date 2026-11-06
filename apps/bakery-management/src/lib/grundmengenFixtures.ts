/**
 * Erfundene Antworten der Grundmengen-Endpunkte für die Specs (Z4). Keine
 * Werte aus hq - Posten, Mengen und Kassennummern sind ausgedacht.
 */
import type {
  BackzettelConfigView,
  GrundmengenConfig,
  ReferenceResponse,
} from './grundmengenApi'

export function syntheticConfig(
  overrides: Partial<GrundmengenConfig> = {}
): GrundmengenConfig {
  return {
    days: [2, 3, 4, 5, 6, 7],
    sections: ['brot', 'broetchen', 'hefeteig'],
    items: [
      {
        id: 'testbrot',
        name: 'Testbrot',
        section: 'brot',
        unit: 'Liter',
        variants: [],
        plu: [901],
        base: { 2: 4, 3: 4.5, 6: null },
      },
      {
        id: 'testweck',
        name: 'Testweck',
        section: 'broetchen',
        unit: 'Stück',
        variants: [],
        plu: [903],
        base: { 2: 40, 3: 30, 6: 60 },
      },
      {
        id: 'testzopf',
        name: 'Testzopf gefüllt',
        section: 'hefeteig',
        unit: 'Stück',
        variants: ['nuss', 'mohn'],
        plu: [905],
        base: { 6: { nuss: 4, mohn: null } },
      },
    ],
    fillings: [
      { id: 'nuss', name: 'Nussfüllung' },
      { id: 'mohn', name: 'Mohnfüllung' },
    ],
    ...overrides,
  }
}

export function syntheticView(
  overrides: Partial<BackzettelConfigView> = {}
): BackzettelConfigView {
  const config = syntheticConfig()
  return {
    status: 'ok',
    config,
    errors: [],
    warnings: [],
    pendingApproval: false,
    writable: true,
    working: { status: 'ok', config, errors: [], warnings: [] },
    ...overrides,
  }
}

export function syntheticReference(): ReferenceResponse {
  const day = (weekday: number, weekdayName: string, weck: number | null) => ({
    weekday,
    weekdayName,
    weeks: 6,
    dates: weck === null ? [] : ['2026-11-28', '2026-11-21'],
    skippedDates: [],
    items: [
      {
        itemId: 'testbrot',
        plu: [901],
        median: weck === null ? null : 7,
        samples: weck === null ? [] : [6, 8],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
      {
        itemId: 'testweck',
        plu: [903],
        median: weck,
        samples: weck === null ? [] : [weck - 2, weck + 2],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
      {
        itemId: 'testzopf',
        plu: [905],
        median: weck === null ? null : 5,
        samples: weck === null ? [] : [4, 6],
        status: weck === null ? ('no_data' as const) : ('ok' as const),
      },
    ],
  })
  return {
    status: 'ok',
    available: true,
    today: '2026-12-02',
    weeks: 6,
    weekdays: [
      day(2, 'Dienstag', 38),
      day(3, 'Mittwoch', 27),
      day(4, 'Donnerstag', null),
      day(5, 'Freitag', null),
      day(6, 'Samstag', 58),
      day(7, 'Sonntag', null),
    ],
  }
}
