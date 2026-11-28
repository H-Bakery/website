/** @jest-environment-options {"url": "https://sprache.test"} */
import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { ApiError } from '@bakery/shared/data-access'
import RestClient, { DRAFT_STALE_MESSAGE } from './RestClient'
import * as api from '../../../lib/restApi'
import * as voice from '../../../lib/spracheApi'
import { useRecorder } from '../../../components/sprache/useRecorder'
import type { RestCountRow, RestDay, RestLine } from '../../../lib/restApi'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'
import { useMemoryStorage } from '../../../lib/testing/memoryStorage'

jest.mock('../../../lib/restApi', () => {
  const actual = jest.requireActual('../../../lib/restApi')
  return { ...actual, fetchRestDay: jest.fn(), saveRestDay: jest.fn() }
})
jest.mock('../../../lib/spracheApi', () => ({
  fetchVoiceStatus: jest.fn(async () => undefined),
  understandVoice: jest.fn(),
}))
jest.mock('../../../components/sprache/useRecorder', () => ({
  useRecorder: jest.fn(() => ({ phase: 'idle' })),
}))
const voiceApi = jest.mocked(voice)
const recorder = jest.mocked(useRecorder)
const mocked = api as jest.Mocked<typeof api>

function row(overrides: Partial<RestCountRow> = {}): RestCountRow {
  return {
    productId: 'test-weck',
    label: 'Weck',
    unit: 'Stück',
    factor: 1,
    integer: true,
    step: 1,
    qty: null,
    countedAt: null,
    countedBy: null,
    revision: 0,
    stale: false,
    ...overrides,
  }
}

function line(overrides: Partial<RestLine> = {}): RestLine {
  return {
    key: 'weck|',
    itemId: 'weck',
    variant: null,
    variantLabel: null,
    name: 'Weck',
    section: 'broetchen',
    sectionLabel: 'Brötchen',
    unit: 'Stück',
    planned: 52,
    baked: 52,
    cap: 12,
    onBackzettel: true,
    rows: [row()],
    counted: false,
    rest: null,
    restSoFar: null,
    ...overrides,
  }
}

function makeDay(overrides: Partial<RestDay> = {}): RestDay {
  return {
    date: '2026-12-01',
    weekday: 2,
    weekdayName: 'Dienstag',
    today: '2026-12-01',
    status: 'ok',
    backzettelStatus: 'confirmed',
    window: { from: '2026-11-24', to: '2026-12-01' },
    editable: true,
    editIssue: null,
    lines: [
      line(),
      line({
        key: 'kornbrot|',
        itemId: 'kornbrot',
        name: 'Kornbrot',
        section: 'brot',
        sectionLabel: 'Brot',
        unit: 'Liter',
        planned: 4,
        baked: 4,
        cap: 0,
        rows: [
          row({ productId: 'test-kornbrot', label: 'Kornbrot', factor: 0.5 }),
        ],
      }),
    ],
    summary: {
      lines: 2,
      countedLines: 0,
      rows: 2,
      countedRows: 0,
      lastCountedAt: null,
      lastCountedBy: null,
    },
    ...overrides,
  }
}

function renderAs(role: PilotRole, props: { initialDate?: string } = {}) {
  return render(
    <WithSession value={fakeSession({ role })}>
      <RestClient {...props} />
    </WithSession>
  )
}

describe('Rest am Abend - Zählung', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useMemoryStorage()
    mocked.fetchRestDay.mockResolvedValue(makeDay())
  })

  it('lists the confirmed Backzettel with baked and CAP, and counts progress', async () => {
    renderAs('verkauf')
    const weck = await screen.findByTestId('rest-line-weck|')
    expect(
      within(weck).getByText('gebacken 52 St. · davon CAP 12 St.')
    ).toBeTruthy()
    expect(screen.getByText('Backzettel freigegeben')).toBeTruthy()
    expect(screen.getByTestId('rest-progress').textContent).toBe(
      '0 von 2 gezählt'
    )
    // Kornbrot is counted in pieces, the line is in litres: row label shown.
    const korn = screen.getByTestId('rest-line-kornbrot|')
    expect(within(korn).getByText('gebacken 4 L')).toBeTruthy()
    expect(mocked.fetchRestDay).toHaveBeenCalledWith(undefined)
  })

  it('„Nichts übrig“, +/− and the number pad build one batch with expected values', async () => {
    mocked.saveRestDay.mockImplementation(async (date, items) =>
      makeDay({ changed: items.length })
    )
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(
      screen.getByRole('button', { name: 'Kornbrot: nichts übrig' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Weck: weniger' }))
    expect(screen.getByTestId('rest-progress').textContent).toBe(
      '2 von 2 gezählt'
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Weck: Menge eingeben' })
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '1' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '2' }))
    expect(
      within(dialog).getByRole('button', { name: 'Komma' })
    ).toHaveProperty('disabled', true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
    expect(screen.getByText('2 Änderungen')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(mocked.saveRestDay).toHaveBeenCalled())
    expect(mocked.saveRestDay).toHaveBeenCalledWith('2026-12-01', [
      { itemId: 'weck', productId: 'test-weck', qty: 12, expected: null },
      {
        itemId: 'kornbrot',
        productId: 'test-kornbrot',
        qty: 0,
        expected: null,
      },
    ])
    expect(await screen.findByText('2 Zählungen gespeichert.')).toBeTruthy()
  })

  it('keeps unsaved input across a reload of the page (per day)', async () => {
    const { unmount } = renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: nichts übrig' }))
    unmount()
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    expect(screen.getByText('1 Änderung')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(screen.queryByTestId('rest-save-bar')).toBeNull()
  })

  it('a reload after another tablet counted shows the conflict instead of overwriting silently', async () => {
    const { unmount } = renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    unmount()
    // Tablet B saved 40 meanwhile.
    mocked.fetchRestDay.mockResolvedValue(
      makeDay({
        lines: [
          line({
            rows: [
              row({
                qty: 40,
                revision: 1,
                countedBy: { id: 9, displayName: 'Test verkauf B' },
              }),
            ],
            counted: true,
            rest: 40,
          }),
        ],
      })
    )
    mocked.saveRestDay.mockImplementation(async (date, items) =>
      makeDay({ changed: items.length })
    )
    renderAs('verkauf')
    const alert = await screen.findByTestId('save-error')
    expect(within(alert).getByText('Inzwischen anders gezählt')).toBeTruthy()
    expect(within(alert).getByText(DRAFT_STALE_MESSAGE)).toBeTruthy()
    expect(within(alert).getByText('Weck: 40 (Test verkauf B)')).toBeTruthy()
    expect(mocked.saveRestDay).not.toHaveBeenCalled()
    // The input (3) is still there; saving now is a conscious overwrite of 40.
    expect(screen.getByText('1 Änderung')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Meine Zahlen speichern' })
    )
    await waitFor(() =>
      expect(mocked.saveRestDay).toHaveBeenCalledWith('2026-12-01', [
        { itemId: 'weck', productId: 'test-weck', qty: 3, expected: 40 },
      ])
    )
  })

  it('switching day and back keeps the base of the input', async () => {
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: nichts übrig' }))
    mocked.fetchRestDay.mockImplementation(async (date) =>
      date === '2026-11-30'
        ? makeDay({ date: '2026-11-30', lines: [] })
        : makeDay({
            lines: [
              line({
                rows: [row({ qty: 6, revision: 1 })],
                counted: true,
                rest: 6,
              }),
            ],
          })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tag davor' }))
    await waitFor(() =>
      expect(mocked.fetchRestDay).toHaveBeenCalledWith('2026-11-30')
    )
    await screen.findByText('Für diesen Tag steht nichts auf dem Backzettel.')
    fireEvent.click(screen.getByRole('button', { name: 'Tag danach' }))
    const alert = await screen.findByTestId('save-error')
    expect(within(alert).getByText('Weck: 6')).toBeTruthy()
  })

  it('a draft belongs to the person: the next PIN user does not inherit it', async () => {
    const { unmount } = renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: nichts übrig' }))
    expect(screen.getByText('1 Änderung')).toBeTruthy()
    unmount()
    render(
      <WithSession
        value={fakeSession({
          user: {
            id: 2,
            username: 'test.anna',
            displayName: 'Anna',
            role: 'verkauf',
          },
        })}
      >
        <RestClient />
      </WithSession>
    )
    await screen.findByTestId('rest-line-weck|')
    expect(screen.queryByTestId('rest-save-bar')).toBeNull()
    expect(screen.getByTestId('rest-progress').textContent).toBe(
      '0 von 2 gezählt'
    )
  })

  it('read-only roles see server values, never a stored draft', async () => {
    window.localStorage.setItem(
      'bakery-rest-draft:1:2026-12-01',
      JSON.stringify({ 'weck||test-weck': { qty: 9, base: null } })
    )
    renderAs('backstube')
    await screen.findByTestId('rest-line-weck|')
    expect(screen.getByTestId('rest-progress').textContent).toBe(
      '0 von 2 gezählt'
    )
    expect(screen.queryByTestId('rest-save-bar')).toBeNull()
  })

  it('shows who counted meanwhile on 409 and keeps the input', async () => {
    const error = new ApiError(
      'Weck wurde inzwischen von Test inhaber gezählt (6). Nichts wurde gespeichert.',
      409,
      'rest_changed'
    )
    error.details = {
      current: [
        {
          itemId: 'weck',
          variant: null,
          productId: 'test-weck',
          name: 'Weck',
          qty: 6,
          countedBy: { id: 1, displayName: 'Test inhaber' },
        },
      ],
    }
    mocked.saveRestDay.mockRejectedValueOnce(error)
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: nichts übrig' }))
    mocked.fetchRestDay.mockResolvedValue(
      makeDay({
        lines: [
          line({
            rows: [row({ qty: 6, revision: 1 })],
            counted: true,
            rest: 6,
          }),
        ],
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const alert = await screen.findByTestId('save-error')
    expect(within(alert).getByText('Inzwischen anders gezählt')).toBeTruthy()
    expect(within(alert).getByText('Weck: 6 (Test inhaber)')).toBeTruthy()
    await waitFor(() => expect(mocked.fetchRestDay).toHaveBeenCalledTimes(2))
    // Draft (0) still differs from the new server value (6): still to save.
    expect(screen.getByText('1 Änderung')).toBeTruthy()
  })

  it('says when more is left than was baked for the shop', async () => {
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        lines: [
          line({
            rows: [row({ qty: 41, revision: 1 })],
            counted: true,
            rest: 41,
            restExceedsShop: true,
          }),
        ],
      })
    )
    renderAs('verkauf')
    expect((await screen.findByTestId('rest-exceeds-weck|')).textContent).toBe(
      'Mehr übrig als für den Laden gebacken - bitte nachzählen.'
    )
  })

  it('Backstube only looks', async () => {
    renderAs('backstube')
    await screen.findByTestId('rest-line-weck|')
    expect(
      screen.getByText('Nur ansehen - gezählt wird vom Verkauf.')
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Weck: nichts übrig' })
    ).toHaveProperty('disabled', true)
    expect(screen.queryByRole('button', { name: 'Auswertung' })).toBeNull()
  })

  it('a failed day switch does not keep showing the previous day', async () => {
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    expect(screen.getByText(/01\.12\.2026/)).toBeTruthy()
    mocked.fetchRestDay.mockRejectedValueOnce(
      new ApiError('Keine Verbindung', 0)
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tag davor' }))
    await waitFor(() =>
      expect(mocked.fetchRestDay).toHaveBeenLastCalledWith('2026-11-30')
    )
    await screen.findByRole('button', { name: 'Erneut versuchen' })
    // Die Zählliste vom 01.12. stünde sonst unter ?date=2026-11-30 da.
    expect(screen.queryByTestId('rest-line-weck|')).toBeNull()
    expect(screen.queryByText(/01\.12\.2026/)).toBeNull()
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({ date: '2026-11-30', weekday: 1, weekdayName: 'Montag' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByTestId('rest-line-weck|')).toBeTruthy()
    expect(mocked.fetchRestDay).toHaveBeenLastCalledWith('2026-11-30')
  })

  it('a day outside the window or a Ruhetag cannot be counted', async () => {
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        editable: false,
        editIssue:
          'Zählungen lassen sich nur bis 7 Tage zurück erfassen oder korrigieren.',
      })
    )
    renderAs('inhaber', { initialDate: '2026-11-01' })
    expect(
      await screen.findByText(
        'Zählungen lassen sich nur bis 7 Tage zurück erfassen oder korrigieren.'
      )
    ).toBeTruthy()
    expect(mocked.fetchRestDay).toHaveBeenCalledWith('2026-11-01')
    expect(screen.getByRole('button', { name: 'Weck: mehr' })).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByRole('link', { name: 'Auswertung' })).toBeTruthy()
  })

  it('says when there is no Backzettel master data', async () => {
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        status: 'no-config',
        editable: false,
        editIssue: 'Die Backzettel-Stammdaten fehlen oder sind ungültig.',
        backzettelStatus: null,
        lines: [],
      })
    )
    renderAs('verkauf')
    expect(await screen.findByText('Keine Zählliste')).toBeTruthy()
  })

  describe('Abschluss-Verifikation next', () => {
    function conflict409() {
      const error = new ApiError(
        'Weck wurde inzwischen von Test inhaber gezählt (6). Nichts wurde gespeichert.',
        409,
        'rest_changed'
      )
      error.details = {
        current: [
          {
            itemId: 'weck',
            variant: null,
            productId: 'test-weck',
            name: 'Weck',
            qty: 6,
            countedBy: { id: 1, displayName: 'Test inhaber' },
          },
        ],
      }
      return error
    }

    it('409: the save bar and the line say what the other device saved, overwriting is explicit', async () => {
      mocked.saveRestDay.mockRejectedValueOnce(conflict409())
      renderAs('verkauf')
      await screen.findByTestId('rest-line-weck|')
      fireEvent.click(
        screen.getByRole('button', { name: 'Weck: nichts übrig' })
      )
      mocked.fetchRestDay.mockResolvedValue(
        makeDay({
          lines: [
            line({
              rows: [
                row({
                  qty: 6,
                  revision: 1,
                  countedBy: { id: 1, displayName: 'Test inhaber' },
                }),
              ],
              counted: true,
              rest: 6,
            }),
          ],
        })
      )
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
      const bar = await screen.findByTestId('rest-save-bar')
      expect(
        (await within(bar).findByTestId('rest-save-bar-message')).textContent
      ).toMatch(/Inzwischen anders gezählt \(1\)/)
      expect(screen.getByTestId('rest-conflict-weck|').textContent).toBe(
        'Inzwischen gespeichert: 6 von Test inhaber · deine Eingabe: 0'
      )
      // Kein zweites „Speichern“, das die Zahl der Kollegin ungesehen
      // überschreibt - der Knopf sagt, was er tut.
      expect(
        within(bar).queryByRole('button', { name: 'Speichern' })
      ).toBeNull()
      expect(
        within(bar).getByRole('button', { name: 'Meine Zahlen speichern' })
      ).toBeTruthy()
    })

    it('network and proxy errors are German, not „Failed to fetch“ / „HTTP 502“', async () => {
      mocked.saveRestDay.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      renderAs('verkauf')
      await screen.findByTestId('rest-line-weck|')
      fireEvent.click(
        screen.getByRole('button', { name: 'Weck: nichts übrig' })
      )
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
      expect(
        (await screen.findByTestId('rest-save-bar-message')).textContent
      ).toBe('Keine Verbindung zum Server – bitte WLAN prüfen.')
      expect(screen.queryByText('Failed to fetch')).toBeNull()
    })

    it('a load answered by Caddy with 502 says WLAN, not HTTP 502', async () => {
      mocked.fetchRestDay.mockRejectedValueOnce(
        new ApiError('HTTP 502: Bad Gateway', 502)
      )
      renderAs('verkauf')
      expect(
        await screen.findByText(
          'Keine Verbindung zum Server – bitte WLAN prüfen.'
        )
      ).toBeTruthy()
      expect(screen.queryByText(/HTTP 502/)).toBeNull()
    })

    it('names unsaved drafts of other days', async () => {
      window.localStorage.setItem(
        'bakery-rest-draft:1:2026-11-28',
        JSON.stringify({ 'weck||test-weck': { qty: 4, base: null } })
      )
      renderAs('verkauf')
      const hint = await screen.findByTestId('rest-other-drafts')
      fireEvent.click(
        within(hint).getByRole('button', { name: '28.11. öffnen' })
      )
      await waitFor(() =>
        expect(mocked.fetchRestDay).toHaveBeenCalledWith('2026-11-28')
      )
    })

    it('a draft on a day that can no longer be saved offers only „Verwerfen“', async () => {
      window.localStorage.setItem(
        'bakery-rest-draft:1:2026-12-01',
        JSON.stringify({ 'weck||test-weck': { qty: 4, base: null } })
      )
      mocked.fetchRestDay.mockResolvedValue(
        makeDay({
          editable: false,
          editIssue:
            'Zählungen lassen sich nur bis 7 Tage zurück erfassen oder korrigieren.',
        })
      )
      renderAs('verkauf')
      const bar = await screen.findByTestId('rest-save-bar')
      expect(
        within(bar).queryByRole('button', { name: 'Speichern' })
      ).toBeNull()
      expect(within(bar).getByTestId('rest-save-bar-message').textContent).toBe(
        'Zählungen lassen sich nur bis 7 Tage zurück erfassen oder korrigieren.'
      )
      fireEvent.click(within(bar).getByRole('button', { name: 'Verwerfen' }))
      expect(screen.queryByTestId('rest-save-bar')).toBeNull()
      expect(
        window.localStorage.getItem('bakery-rest-draft:1:2026-12-01')
      ).toBeNull()
    })
  })
})

describe('Rest am Abend - Tagestyp aus dem Kalender (Z14)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ein Schließtag sagt „geschlossen“ mit Grund und lässt sich nicht zählen', async () => {
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        status: 'geschlossen',
        editable: false,
        editIssue:
          'Dienstag 01.12.: geschlossen (Inventur) - an diesem Tag gibt es keinen Rest zu zählen.',
        backzettelStatus: null,
        lines: [],
        dayKind: {
          kind: 'geschlossen',
          label: 'Geschlossen',
          detail: 'Inventur',
          note: 'Inventur',
          holidayName: null,
          baseWeekday: null,
          openUntil: null,
        },
      })
    )
    renderAs('verkauf')
    expect(await screen.findByTestId('rest-closed-day')).toHaveProperty(
      'textContent',
      'Dienstag 01.12.: geschlossen (Inventur) - an diesem Tag gibt es keinen Rest zu zählen.'
    )
    expect(screen.queryByTestId('rest-day-kind')).toBeNull()
  })

  it('eine Sonderöffnung steht über der Zählliste, gezählt wird wie sonst', async () => {
    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        dayKind: {
          kind: 'sonderoeffnung',
          label: 'Sonderöffnung (wie Samstag)',
          detail: 'Testmarkt',
          note: 'Testmarkt',
          holidayName: null,
          baseWeekday: 6,
          openUntil: null,
        },
      })
    )
    renderAs('verkauf')
    expect(await screen.findByTestId('rest-day-kind')).toHaveProperty(
      'textContent',
      'Sonderöffnung (wie Samstag) · Testmarkt'
    )
    expect(screen.getByTestId('rest-line-weck|')).toBeTruthy()
    expect(screen.queryByTestId('rest-closed-day')).toBeNull()
  })
})

describe('Spracheingabe für Rest am Abend', () => {
  const status: voice.VoiceStatus = {
    enabled: true,
    screens: ['rest'],
    budget: {
      month: '2026-12',
      limitEuro: 10,
      spentEuro: 0,
      remainingEuro: 10,
      warning: false,
    },
  }
  const result: voice.VoiceResult = {
    transcript: 'Weck drei',
    unmatched: [],
    proposal: [
      {
        key: 'weck||test-weck',
        menge: 3,
        heard: 'Weck drei',
        unsicher: false,
        reason: null,
      },
    ],
    usage: { costEuro: 0.001, llmUsed: false },
  }
  const secureDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'isSecureContext'
  )
  const mediaDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices'
  )

  beforeEach(() => {
    jest.clearAllMocks()
    useMemoryStorage()
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn() },
    })
    mocked.fetchRestDay.mockResolvedValue(makeDay())
    voiceApi.fetchVoiceStatus.mockResolvedValue(status)
    voiceApi.understandVoice.mockResolvedValue(result)
    recorder.mockReturnValue({
      phase: 'idle',
      seconds: 0,
      level: 0,
      noSound: false,
      error: null,
      start: jest.fn(async (onClip) =>
        onClip(new Blob(['Test'], { type: 'audio/wav' }))
      ),
      stop: jest.fn(),
      cancel: jest.fn(),
    })
  })

  afterEach(() => {
    if (secureDescriptor)
      Object.defineProperty(window, 'isSecureContext', secureDescriptor)
    else Reflect.deleteProperty(window, 'isSecureContext')
    if (mediaDescriptor)
      Object.defineProperty(navigator, 'mediaDevices', mediaDescriptor)
    else Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it.each(['disabled', 'backstube', 'gesperrt', 'ohne HTTPS', 'ohne Mikrofon'])(
    'zeigt keinen Mikrofonknopf (%s)',
    async (condition) => {
      if (condition === 'disabled')
        voiceApi.fetchVoiceStatus.mockResolvedValue({
          ...status,
          enabled: false,
        })
      if (condition === 'gesperrt')
        mocked.fetchRestDay.mockResolvedValue(makeDay({ editable: false }))
      if (condition === 'ohne HTTPS')
        Object.defineProperty(window, 'isSecureContext', { value: false })
      if (condition === 'ohne Mikrofon')
        Object.defineProperty(navigator, 'mediaDevices', { value: undefined })
      renderAs(condition === 'backstube' ? 'backstube' : 'verkauf')
      await screen.findByTestId('rest-line-weck|')
      if (condition === 'ohne HTTPS') {
        expect(
          await screen.findByText('Spracheingabe braucht HTTPS – bitte tippen.')
        ).toBeTruthy()
      }
      if (condition === 'ohne Mikrofon') {
        expect(
          await screen.findByText(
            'Das Mikrofon ist auf diesem Gerät nicht verfügbar – bitte tippen.'
          )
        ).toBeTruthy()
      }
      expect(screen.queryByRole('button', { name: 'Sprechen' })).toBeNull()
      expect(voiceApi.understandVoice).not.toHaveBeenCalled()
      if (condition === 'backstube' || condition === 'gesperrt') {
        expect(voiceApi.fetchVoiceStatus).not.toHaveBeenCalled()
      }
    }
  )

  it('zeigt den leeren Monat und sperrt Aufnahmen', async () => {
    voiceApi.fetchVoiceStatus.mockResolvedValue({
      ...status,
      budget: { ...status.budget, remainingEuro: 0 },
    })
    renderAs('inhaber')
    expect(
      await screen.findByText(
        'Spracheingabe für diesen Monat aufgebraucht – bitte tippen.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sprechen' })).toHaveProperty(
      'disabled',
      true
    )
  })

  it('meldet eine fehlende Verbindung zur Box, wenn der Sprachstatus nicht abrufbar ist', async () => {
    voiceApi.fetchVoiceStatus.mockRejectedValueOnce(new TypeError('Test'))
    renderAs('verkauf')
    expect(
      await screen.findByText(
        'Keine Verbindung zur Bäckerei-Box – bitte WLAN prüfen oder tippen.'
      )
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sprechen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }))
    expect(
      await screen.findByRole('button', { name: 'Sprechen' })
    ).toBeEnabled()
  })

  it('lässt lokale Aufnahmen bei leerem Cloud-Budget zu', async () => {
    voiceApi.fetchVoiceStatus.mockResolvedValue({
      ...status,
      sttProvider: 'local',
      budget: { ...status.budget, remainingEuro: 0 },
    })
    renderAs('verkauf')
    expect(await speak()).toBeVisible()
  })

  async function speak() {
    fireEvent.click(await screen.findByRole('button', { name: 'Sprechen' }))
    expect(
      await screen.findByRole('dialog', { name: 'Freiwillige Spracheingabe' })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten' }))
    return screen.findByRole('dialog', { name: 'Sprachvorschlag prüfen' })
  }

  it('übernimmt nur in den Entwurf und stellt mit Rückgängig den vorherigen Entwurf wieder her', async () => {
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    const dialog = await speak()
    expect(within(dialog).getByText('Gehört: „Weck drei“')).toBeTruthy()
    expect(within(dialog).getByText('1 St. → 3 St.')).toBeTruthy()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    )
    expect(await screen.findByText('1 Zeile übernommen')).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: 'Weck: Menge eingeben' })
    ).toHaveTextContent('3')
    expect(mocked.saveRestDay).not.toHaveBeenCalled()
    expect(voiceApi.understandVoice).toHaveBeenCalledWith(
      '2026-12-01',
      expect.any(Blob),
      expect.any(AbortSignal)
    )

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }))
    expect(
      screen.getByRole('button', { name: 'Weck: Menge eingeben' })
    ).toHaveTextContent('1')
    mocked.saveRestDay.mockResolvedValue(makeDay({ changed: 1 }))
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(mocked.saveRestDay).toHaveBeenCalledWith('2026-12-01', [
      { itemId: 'weck', productId: 'test-weck', qty: 1, expected: null },
    ])
    await screen.findByText('1 Zählung gespeichert.')
  })

  it('behält die Herkunft beim Neuladen und sendet sie erst beim Speichern', async () => {
    const page = renderAs('verkauf')
    const dialog = await speak()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    )
    expect(mocked.saveRestDay).not.toHaveBeenCalled()
    page.unmount()
    renderAs('verkauf')
    mocked.saveRestDay.mockResolvedValue(makeDay({ changed: 1 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Speichern' }))
    expect(mocked.saveRestDay).toHaveBeenCalledWith(
      '2026-12-01',
      [{ itemId: 'weck', productId: 'test-weck', qty: 3, expected: null }],
      'sprache'
    )
    await screen.findByText('1 Zählung gespeichert.')
  })

  it('sperrt Rückgängig beim PUT und bewahrt den vorherigen Entwurf samt Grundlage nach 409', async () => {
    let rejectSave: (error: ApiError) => void = () => undefined
    mocked.saveRestDay.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject
        })
    )
    renderAs('verkauf')
    await screen.findByTestId('rest-line-weck|')
    fireEvent.click(screen.getByRole('button', { name: 'Weck: mehr' }))
    const dialog = await speak()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    )
    const undo = await screen.findByRole('button', { name: 'Rückgängig' })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(undo).toBeDisabled()

    mocked.fetchRestDay.mockResolvedValueOnce(
      makeDay({
        lines: [line({ rows: [row({ qty: 6, revision: 1 })] })],
      })
    )
    const error = new ApiError(
      'Weck wurde inzwischen anders gezählt.',
      409,
      'rest_changed'
    )
    error.details = {
      current: [
        { itemId: 'weck', variant: null, productId: 'test-weck', qty: 6 },
      ],
    }
    rejectSave(error)
    await waitFor(() => expect(undo).toBeEnabled())
    fireEvent.click(undo)
    expect(
      screen.getByRole('button', { name: 'Weck: Menge eingeben' })
    ).toHaveTextContent('1')
    expect(mocked.saveRestDay).toHaveBeenCalledTimes(1)

    // Ein Wiederholungs-PUT muss die vor dem Sprechen bekannte Grundlage
    // verwenden, damit die fremde 6 nicht still überschrieben wird.
    mocked.saveRestDay.mockRejectedValueOnce(error)
    fireEvent.click(
      screen.getByRole('button', { name: 'Meine Zahlen speichern' })
    )
    expect(mocked.saveRestDay).toHaveBeenLastCalledWith('2026-12-01', [
      { itemId: 'weck', productId: 'test-weck', qty: 1, expected: null },
    ])
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Meine Zahlen speichern' })
      ).toBeEnabled()
    )
  })

  it('lässt Rückgängig nach einem Netzwerkfehler verfügbar', async () => {
    mocked.saveRestDay.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderAs('verkauf')
    const dialog = await speak()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    )
    const undo = await screen.findByRole('button', { name: 'Rückgängig' })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => expect(undo).toBeEnabled())
    fireEvent.click(undo)
    expect(
      screen.queryByRole('button', { name: 'Speichern' })
    ).not.toBeInTheDocument()
  })

  it('zeigt bei einer gescheiterten Wiederholung den Fehler im Blatt und behält den Vorschlag', async () => {
    voiceApi.fetchVoiceStatus.mockResolvedValue({
      ...status,
      sttProvider: 'mistral',
    })
    voiceApi.understandVoice
      .mockResolvedValueOnce(result)
      .mockRejectedValueOnce(
        new ApiError(
          'Spracheingabe braucht Internet – bitte tippen.',
          503,
          'voice_unavailable'
        )
      )
    renderAs('verkauf')
    const dialog = await speak()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Nochmal sprechen' })
    )
    const warning = await within(dialog).findByText(
      'Spracheingabe braucht Internet – bitte tippen.'
    )
    expect(warning.closest('[aria-live="polite"]')).toBeTruthy()
    expect(within(dialog).getByText('Gehört: „Weck drei“')).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    ).toBeEnabled()
    const retry = within(dialog).getByRole('button', {
      name: 'Nochmal sprechen',
    })
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    expect(
      await within(dialog).findByText('Gehört: „Weck drei“ · „Weck drei“')
    ).toBeTruthy()
    expect(
      within(dialog).queryByText(
        'Spracheingabe braucht Internet – bitte tippen.'
      )
    ).toBeNull()
  })

  it('zeigt den lokalen Anbieterfehler und ermöglicht eine Wiederholung', async () => {
    const message =
      'Die Spracherkennung auf der Bäckerei-Box antwortet nicht – bitte tippen.'
    voiceApi.fetchVoiceStatus.mockResolvedValue({
      ...status,
      sttProvider: 'local',
    })
    voiceApi.understandVoice.mockRejectedValueOnce(
      new ApiError(message, 503, 'voice_unavailable')
    )
    renderAs('verkauf')
    fireEvent.click(await screen.findByRole('button', { name: 'Sprechen' }))
    const notice = await screen.findByRole('dialog', {
      name: 'Freiwillige Spracheingabe',
    })
    expect(notice).toHaveTextContent(
      'Die Aufnahme wird auf der Bäckerei-Box erkannt und verlässt sie dafür nicht.'
    )
    fireEvent.click(
      within(notice).getByRole('button', { name: 'Aufnahme starten' })
    )
    expect(await screen.findByText(message)).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'Sprechen' })
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Erneut sprechen' }))
    expect(
      await screen.findByRole('dialog', { name: 'Sprachvorschlag prüfen' })
    ).toBeVisible()
  })

  it('zeigt den API-Hinweis zum Parser-Teilvorschlag im Bestätigungsblatt', async () => {
    const hint =
      'Freie Sätze konnten nicht ausgewertet werden – bitte prüfen oder tippen.'
    voiceApi.understandVoice.mockResolvedValueOnce({ ...result, hint })
    renderAs('verkauf')
    const dialog = await speak()
    expect(
      within(dialog).getByText(hint).closest('[aria-live="polite"]')
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    ).toBeEnabled()
  })

  it('hängt weitere Aufnahmen an und verlangt bei Duplikaten eine Auswahl', async () => {
    renderAs('verkauf')
    const dialog = await speak()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Nochmal sprechen' })
    )
    expect(
      await screen.findByText('Gehört: „Weck drei“ · „Weck drei“')
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Übernehmen (0)' })
    ).toHaveProperty('disabled', true)
    fireEvent.click(
      within(dialog).getAllByRole('button', {
        name: 'Weck aus dem Vorschlag entfernen',
      })[0]
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Übernehmen (1)' })
    )
    expect(await screen.findByText('1 Zeile übernommen')).toBeTruthy()
    expect(mocked.saveRestDay).not.toHaveBeenCalled()
  })
})
