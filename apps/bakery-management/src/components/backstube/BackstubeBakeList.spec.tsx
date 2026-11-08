import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  BackstubeBakeList,
  bakeDeltaTickKey,
  bakeLineTickKey,
} from './BackstubeBakeList'
import { BACKSTUBE_COLORS } from './backstubeColors'
import type { BakeList } from '../../lib/backzettelApi'
import {
  TEST_CONFIG_V2,
  V2_TUE,
  tuesdayBakeList,
} from '../../lib/backzettelFixtures'

const DOPPEL = `test-doppel|@${V2_TUE}`
const KORN = 'test-korn|g500'
const noop = () => undefined

function withLine(
  key: string,
  fields: Record<string, unknown>,
  base: BakeList = tuesdayBakeList()
): BakeList {
  return {
    ...base,
    sections: base.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.key === key ? { ...l, ...fields } : l)),
    })),
  }
}

function renderList(
  list: BakeList,
  props: Partial<React.ComponentProps<typeof BackstubeBakeList>> = {},
  mode: 'light' | 'dark' = 'light'
) {
  return render(
    <ThemeProvider theme={createTheme({ palette: { mode } })}>
      <BackstubeBakeList
        list={list}
        config={TEST_CONFIG_V2}
        canAck
        ackingKey={null}
        onAck={noop}
        canTick
        onToggleLine={noop}
        onToggleDeltas={noop}
        {...props}
      />
    </ThemeProvider>
  )
}

describe('BackstubeBakeList - gebacken-Haken (Z10 O5)', () => {
  it('ein großer Haken je Zeile eines freigegebenen Zettels, keiner für den Entwurf', () => {
    const onToggleLine = jest.fn()
    renderList(tuesdayBakeList(), { onToggleLine })
    const tick = screen.getByTestId(`bs-bake-tick-${DOPPEL}`)
    expect(tick).toHaveAttribute('role', 'checkbox')
    expect(tick).toHaveAttribute('aria-checked', 'false')
    expect(tick).toHaveAccessibleName('Testdoppel als gebacken abhaken')
    // Großes Ziel wie auf dem Zettel.
    expect(getComputedStyle(tick).width).toBe('72px')
    expect(getComputedStyle(tick).height).toBe('72px')
    // Brot aus dem Dienstags-Entwurf: kein Haken.
    expect(screen.getByTestId(`bs-bake-${KORN}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`bs-bake-tick-${KORN}`)).toBeNull()
    fireEvent.click(tick)
    expect(onToggleLine).toHaveBeenCalledWith(
      expect.objectContaining({ id: 205, key: DOPPEL })
    )
  })

  it('gebacken: Haken gesetzt, Zeit und Name, Zeile grün - „erledigt“ bleibt davon getrennt', () => {
    const list = withLine(DOPPEL, {
      bakedAt: '2026-12-01T04:10:00.000Z',
      bakedBy: { id: 2, displayName: 'Test Backstube' },
      doneAt: null,
      // ohne offenen Nachtrag (der färbt die Zeile gelb)
      delta: null,
    })
    renderList(list)
    const row = screen.getByTestId(`bs-bake-${DOPPEL}`)
    expect(row).toHaveAttribute('data-baked', 'true')
    expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId(`bs-bake-baked-${DOPPEL}`)).toHaveTextContent(
      /^gebacken .* · Test Backstube$/
    )
    expect(row).toHaveStyle({
      backgroundColor: BACKSTUBE_COLORS.light.doneRow,
    })
  })

  it('dunkler Modus: Haken-Farben aus der Tablet-Palette, nie „white“', () => {
    const list = withLine(DOPPEL, { bakedAt: '2026-12-01T04:10:00.000Z' })
    renderList(list, {}, 'dark')
    const tick = screen.getByTestId(`bs-bake-tick-${DOPPEL}`)
    expect(tick).toHaveStyle({
      backgroundColor: BACKSTUBE_COLORS.dark.doneBg,
      color: BACKSTUBE_COLORS.dark.doneFg,
    })
  })

  it('ein Entwurf zeigt keinen gebacken-Haken, auch wenn die Zeile einen hatte', () => {
    const list = withLine(KORN, {
      id: 300,
      bakedAt: '2026-12-01T04:10:00.000Z',
    })
    renderList(list)
    expect(screen.getByTestId(`bs-bake-${KORN}`)).toHaveAttribute(
      'data-baked',
      'false'
    )
    expect(screen.queryByTestId(`bs-bake-baked-${KORN}`)).toBeNull()
  })

  it('ohne Rolle (canTick false) kein Haken; während des Speicherns gesperrt', () => {
    const { unmount } = renderList(tuesdayBakeList(), { canTick: false })
    expect(screen.queryByTestId(`bs-bake-tick-${DOPPEL}`)).toBeNull()
    expect(screen.queryByTestId(`bs-bake-dtick-${DOPPEL}`)).toBeNull()
    unmount()
    renderList(tuesdayBakeList(), {
      pendingKeys: new Set([bakeLineTickKey({ id: 205 })]),
    })
    expect(screen.getByTestId(`bs-bake-tick-${DOPPEL}`)).toBeDisabled()
  })

  it('erneut freigegeben mit mehr Stück: „bereits … gebacken - noch …“', () => {
    const list = withLine(DOPPEL, {
      total: 47,
      bakedAt: null,
      previouslyBaked: { qty: 44, at: null, by: null },
    })
    renderList(list)
    expect(
      screen.getByTestId(`bs-bake-previously-${DOPPEL}`)
    ).toHaveTextContent('bereits 44 gebacken - noch +3')
  })

  it('Nachträge: eigene Zeile mit eigenem Haken, nicht in der Zahl oben', () => {
    const onToggleDeltas = jest.fn()
    renderList(tuesdayBakeList(), { onToggleDeltas })
    const section = within(screen.getByTestId('bs-bake-deltas'))
    expect(
      section.getByText('Nachträge (nicht in den Zahlen oben)')
    ).toBeInTheDocument()
    expect(
      section.getByTestId(`bs-bake-dgroup-figure-${DOPPEL}`)
    ).toHaveTextContent('+3')
    expect(section.getByTestId(`bs-bake-dgroup-${DOPPEL}`)).toHaveTextContent(
      'Teig vom Sa 28.11.'
    )
    const tick = section.getByTestId(`bs-bake-dtick-${DOPPEL}`)
    expect(tick).toHaveAccessibleName(
      'Nachtrag Testdoppel als gebacken abhaken'
    )
    fireEvent.click(tick)
    expect(onToggleDeltas).toHaveBeenCalledWith(
      expect.objectContaining({ key: DOPPEL, toggleIds: [31], toggleTo: true })
    )
    // Die Zeile selbst bleibt 44.
    expect(screen.getByTestId(`bs-bake-total-${DOPPEL}`)).toHaveTextContent(
      '44'
    )
  })

  it('Nachtrag gebacken: Haken gesetzt; ein neuer offener zeigt nur seinen Teil', () => {
    const base = tuesdayBakeList()
    const baked = {
      ...base.deltas[0],
      acknowledgedAt: '2026-12-01T04:00:00.000Z',
      bakedAt: '2026-12-01T04:00:00.000Z',
      bakedBy: { id: 2, displayName: 'Test Backstube' },
    }
    const { unmount } = renderList({ ...base, deltas: [baked] })
    expect(screen.getByTestId(`bs-bake-dtick-${DOPPEL}`)).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId(`bs-bake-dgroup-${DOPPEL}`)).toHaveTextContent(
      'gebacken'
    )
    unmount()
    const later = {
      ...base.deltas[0],
      id: 32,
      qty: 2,
      createdAt: '2026-12-01T03:00:00.000Z',
    }
    renderList({ ...base, deltas: [baked, later] })
    expect(
      screen.getByTestId(`bs-bake-dgroup-figure-${DOPPEL}`)
    ).toHaveTextContent('+2')
    expect(screen.getByTestId(`bs-bake-dgroup-${DOPPEL}`)).toHaveTextContent(
      '+3 schon gebacken'
    )
    expect(screen.getByTestId(`bs-bake-dtick-${DOPPEL}`)).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('gebackener Nachtrag, danach abbestellt: Haken bleibt, lässt sich zurücknehmen', () => {
    const base = tuesdayBakeList()
    const onToggleDeltas = jest.fn()
    const baked = {
      ...base.deltas[0],
      qty: 8,
      acknowledgedAt: '2026-12-01T04:00:00.000Z',
      bakedAt: '2026-12-01T04:00:00.000Z',
      bakedBy: { id: 2, displayName: 'Test Backstube' },
    }
    const cancelled = {
      ...base.deltas[0],
      id: 32,
      qty: -3,
      kind: 'cancelled' as const,
      createdAt: '2026-12-01T04:30:00.000Z',
    }
    renderList({ ...base, deltas: [baked, cancelled] }, { onToggleDeltas })
    const group = screen.getByTestId(`bs-bake-dgroup-${DOPPEL}`)
    expect(group).toHaveAttribute('data-baked', 'true')
    expect(group).toHaveTextContent('+8 schon gebacken')
    expect(group).toHaveTextContent('nichts zusätzlich zu backen')
    const tick = screen.getByTestId(`bs-bake-dtick-${DOPPEL}`)
    expect(tick).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(tick)
    expect(onToggleDeltas).toHaveBeenCalledWith(
      expect.objectContaining({ toggleIds: [31], toggleTo: false })
    )
  })

  it('Abbestellung (nichts zu backen): Nachtrag steht da, ohne Haken', () => {
    const base = tuesdayBakeList()
    renderList({
      ...base,
      deltas: [{ ...base.deltas[0], qty: -3, kind: 'cancelled' }],
      sections: withLine(DOPPEL, {
        delta: { qty: -3, open: 1, count: 1, bake: -3 },
      }).sections,
    })
    expect(screen.getByTestId(`bs-bake-dgroup-${DOPPEL}`)).toHaveTextContent(
      'nichts zusätzlich zu backen'
    )
    expect(screen.queryByTestId(`bs-bake-dtick-${DOPPEL}`)).toBeNull()
    expect(bakeDeltaTickKey({ key: DOPPEL })).toBe(`deltas:${DOPPEL}`)
  })
})
