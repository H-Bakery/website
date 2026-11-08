import React from 'react'
import { render, screen, within } from '@testing-library/react'
import BackzettelOverviewClient, {
  doughForText,
} from './BackzettelOverviewClient'
import * as api from '../../../lib/backzettelApi'
import {
  CONFIG_RESPONSE_V2,
  SAT,
  SUN,
  saturdayDraft,
  saturdayV2Draft,
  sundayV2Sheet,
} from '../../../lib/backzettelFixtures'

jest.mock('../../../lib/backzettelApi', () => {
  const actual = jest.requireActual('../../../lib/backzettelApi')
  return {
    ...actual,
    fetchBackzettelConfig: jest.fn(),
    fetchBackzettelDay: jest.fn(),
  }
})
const mocked = api as jest.Mocked<typeof api>

const TODAY = '2026-11-26'

describe('Backzettel-Übersicht - Teigtag-Zettel (Z10)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mocked.fetchBackzettelConfig.mockResolvedValue(CONFIG_RESPONSE_V2)
    mocked.fetchBackzettelDay.mockImplementation(async (date: string) => {
      if (date === SAT) return saturdayV2Draft()
      if (date === SUN) return sundayV2Sheet()
      return saturdayDraft({ date, deltas: [], warnings: [] })
    })
  })

  it('nennt je Teigtag die Backtage und verlinkt die Backliste', async () => {
    render(<BackzettelOverviewClient today={TODAY} />)
    expect(await screen.findByTestId(`dough-for-${SAT}`)).toHaveTextContent(
      'Teig für heute, Sonntag, Dienstag'
    )
    const sat = within(screen.getByTestId(`day-${SAT}`))
    expect(
      sat.getByRole('link', { name: 'Backliste Samstag, 28.11.2026' })
    ).toHaveAttribute('href', `/admin/backzettel/${SAT}/backen`)
    expect(screen.getByTestId(`dough-for-${SUN}`)).toHaveTextContent(
      'Kein Teig – nur backen'
    )
    // Tage von vor Z10: wie bisher, ohne Backliste
    const fri = within(screen.getByTestId('day-2026-11-27'))
    expect(
      fri.queryByRole('link', { name: /Backliste/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('dough-for-2026-11-27')).not.toBeInTheDocument()
  })

  it('doughForText ist nur für Teigtag-Zettel gesetzt', () => {
    expect(doughForText(saturdayDraft())).toBeNull()
    expect(doughForText(sundayV2Sheet())).toBe(
      'Kein Teig – nur backen (Backliste)'
    )
  })

  it('Sonntag mit Teig für heute (lead 0): nicht „Kein Teig“', () => {
    const sun = sundayV2Sheet()
    const day = {
      ...sun,
      machine: [
        {
          id: 'test-hefe',
          name: 'Testhefe',
          doughIds: ['test-hefe'],
          kg: 2,
          kgKnown: 2,
          complete: true,
          liters: { exact: 0.4, rounded: 0, reason: null },
          batches: null,
          batch_max_kg: null,
          addons: [],
          section: 'hefeteig',
        },
      ],
    } as typeof sun
    expect(doughForText(day)).toBe(
      'Teig für heute (Testhefe) – sonst nur backen (Backliste)'
    )
  })
})
