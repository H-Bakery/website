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
import type { RestCountRow, RestDay, RestLine } from '../../../lib/restApi'
import { fakeSession, WithSession } from '../../../lib/testing/fakeSession'
import type { PilotRole } from '../../../lib/roles'
import { useMemoryStorage } from '../../../lib/testing/memoryStorage'

jest.mock('../../../lib/restApi', () => {
  const actual = jest.requireActual('../../../lib/restApi')
  return { ...actual, fetchRestDay: jest.fn(), saveRestDay: jest.fn() }
})
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
    expect(within(korn).getByText('gebacken 4 l')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
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
})
