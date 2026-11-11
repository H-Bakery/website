/**
 * „Heute keine“ / Menge für heute bei offener Grundmenge und die kleine
 * Literzahl unter der Rundungsstufe - auf Planung, Tablet und Druck.
 * Erfundene Zeilen (`backzettelFixtures`), nichts aus hq.
 */
import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { CorrectionEditor, DAY_AMOUNT_REASON } from './CorrectionEditor'
import { BackzettelSectionView } from './BackzettelSectionView'
import { BreadTable } from './BreadTable'
import { DoughDayPrint, printLiters } from './DoughDayPrint'
import { MachineStrip } from './MachineStrip'
import { BackstubeLine } from '../backstube/BackstubeLine'
import type {
  BackzettelDay,
  BackzettelLine,
  DoughLiters,
} from '../../lib/backzettelApi'
import {
  baseOpenText,
  lineBreakdown,
  linesByKey,
  litersHint,
  litersText,
  minQtyText,
} from '../../lib/backzettelFormat'
import {
  SAT,
  TEST_CONFIG_V2,
  V2_TUE,
  saturdayV2Draft,
  v2Line,
} from '../../lib/backzettelFixtures'

const OPEN = v2Line({
  itemId: 'test-vital',
  name: 'Testvital',
  section: 'broetchen',
  bakeDate: V2_TUE,
  base: 0,
  baseUnset: true,
})
const NONE: BackzettelLine = {
  ...OPEN,
  noneToday: true,
  dayDecision: 'none',
  totalIsMinimum: false,
}
const AMOUNT: BackzettelLine = {
  ...OPEN,
  correction: 30,
  correctionReason: DAY_AMOUNT_REASON,
  total: 30,
  dayDecision: 'amount',
  totalIsMinimum: false,
}
const BELOW_STEP: DoughLiters = {
  exact: 0.24,
  rounded: null,
  reason: 'below_rounding_step',
  step: 1,
}

function renderEditor(line: BackzettelLine) {
  const onSave = jest.fn().mockResolvedValue(undefined)
  render(
    <CorrectionEditor
      line={line}
      label={line.name}
      onSave={onSave}
      onCancel={() => undefined}
      idPrefix="t"
    />
  )
  return onSave
}

describe('Anzeige-Regeln', () => {
  it('minQtyText: „keine“ für die Tagesentscheidung, offen bleibt offen, 0 bleibt 0', () => {
    expect(minQtyText(NONE)).toBe('keine')
    expect(minQtyText(OPEN)).toBe('offen')
    expect(minQtyText(AMOUNT)).toBe('30')
    // Vorbestelltes trotz „heute keine“: die Zahl, keine Mindestmenge
    expect(minQtyText({ ...NONE, total: 7 })).toBe('7')
    expect(minQtyText({ total: 0 })).toBe('0')
  })

  it('baseOpenText / lineBreakdown: die Grundmenge bleibt „offen“, die Entscheidung steht daneben', () => {
    expect(baseOpenText(OPEN)).toBe('Grundmenge offen')
    expect(baseOpenText(NONE)).toBe('Heute keine · Grundmenge offen')
    expect(baseOpenText(AMOUNT)).toBe('Für heute festgelegt · Grundmenge offen')
    expect(baseOpenText({ baseUnset: false })).toBeNull()
    expect(lineBreakdown(NONE)).toBe('Basis offen – heute keine')
    expect(lineBreakdown(AMOUNT)).toBe(
      'Basis offen – für heute festgelegt · Korr. +30 (Menge für heute)'
    )
    expect(lineBreakdown(OPEN)).toBe('Basis offen')
  })

  it('Liter unter der Rundungsstufe: die genauen Liter mit Grund, nie „0 L“', () => {
    expect(litersText(BELOW_STEP)).toBe('0,24 L (unter 1 L, nicht gerundet)')
    expect(litersHint(BELOW_STEP)).toBe(
      'Kleine Menge (unter 1 L, nicht gerundet) – angezeigt sind die genauen Liter'
    )
    expect(printLiters(BELOW_STEP)).toEqual({
      text: '0,24 L',
      hint: 'unter 1 L, nicht gerundet',
    })
    // unverändert: fehlende Rundung in den Stammdaten
    expect(
      litersText({ exact: 6.47, rounded: null, reason: 'rounding_unknown' })
    ).toBe('6,47 L (Rundung offen)')
  })
})

describe('CorrectionEditor bei offener Grundmenge', () => {
  it('fragt nach der Menge für heute, Grund vorbelegt, ohne ±', () => {
    renderEditor(OPEN)
    expect(screen.getByLabelText('Menge für heute')).toHaveValue('')
    expect(screen.getByLabelText('Grund')).toHaveValue('Menge für heute')
    expect(
      screen.getByText(
        'Grundmenge offen · 0 = heute keine · leer = wieder offen'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Vorzeichen/ })
    ).not.toBeInTheDocument()
    // noch nichts entschieden: nichts zurückzunehmen
    expect(
      screen.queryByRole('button', { name: 'Wieder offen' })
    ).not.toBeInTheDocument()
  })

  it('„Heute keine“ speichert die Tagesentscheidung - ohne Pflichtgrund', async () => {
    const onSave = renderEditor(OPEN)
    fireEvent.click(screen.getByRole('button', { name: 'Heute keine' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(0, null, { noneToday: true })
    )
  })

  it('ein eigener Grund geht mit', async () => {
    const onSave = renderEditor(OPEN)
    fireEvent.change(screen.getByLabelText('Grund'), {
      target: { value: 'Froster voll' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Heute keine' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(0, 'Froster voll', {
        noneToday: true,
      })
    )
  })

  it('eine eingetippte 0 ist „heute keine“, nicht „keine Korrektur“', async () => {
    const onSave = renderEditor(OPEN)
    fireEvent.change(screen.getByLabelText('Menge für heute'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(0, null, { noneToday: true })
    )
  })

  it('eine Menge geht als Korrektur mit dem vorbelegten Grund', async () => {
    const onSave = renderEditor(OPEN)
    fireEvent.change(screen.getByLabelText('Menge für heute'), {
      target: { value: '30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(30, 'Menge für heute')
    )
  })

  it('lehnt eine negative Menge ab, solange die Grundmenge offen ist', () => {
    const onSave = renderEditor(OPEN)
    fireEvent.change(screen.getByLabelText('Menge für heute'), {
      target: { value: '-5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Die Grundmenge ist offen - bitte die Menge für heute eintragen (0 = heute keine).'
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it('„Heute keine“ steht als 0 im Feld; „Wieder offen“ nimmt die Entscheidung zurück', async () => {
    const onSave = renderEditor(NONE)
    expect(screen.getByLabelText('Menge für heute')).toHaveValue('0')
    expect(screen.getByRole('button', { name: 'Heute keine' })).toBeDisabled()
    // Speichern ohne Änderung behält die Entscheidung
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(0, null, { noneToday: true })
    )
  })

  it('„Wieder offen“ löscht Menge und Entscheidung', async () => {
    const onSave = renderEditor(AMOUNT)
    expect(screen.getByLabelText('Menge für heute')).toHaveValue('30')
    fireEvent.click(screen.getByRole('button', { name: 'Wieder offen' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(0, null))
  })

  it('zeigt die deutsche Meldung des Servers in der Zeile', async () => {
    const onSave = jest
      .fn()
      .mockRejectedValue(
        new Error(
          '„Testvital“ hat für diesen Tag eine Grundmenge - „Heute keine“ gibt es nur, solange die Grundmenge offen ist.'
        )
      )
    render(
      <CorrectionEditor
        line={OPEN}
        label="Testvital"
        onSave={onSave}
        onCancel={() => undefined}
        idPrefix="t"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Heute keine' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'hat für diesen Tag eine Grundmenge'
    )
  })

  it('eine Zeile mit Grundmenge behält den Korrektur-Editor: kein „Heute keine“', () => {
    renderEditor(
      v2Line({
        itemId: 'test-weck',
        name: 'Testweck',
        section: 'broetchen',
        base: 60,
      })
    )
    expect(screen.getByLabelText('Korrektur')).toBeInTheDocument()
    expect(screen.getByLabelText('Grund')).toHaveValue('')
    expect(
      screen.queryByRole('button', { name: 'Heute keine' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Vorzeichen/ })
    ).toBeInTheDocument()
  })
})

describe('Planungsseite', () => {
  const view = (line: BackzettelLine) =>
    render(
      <BackzettelSectionView
        section={{ id: 'broetchen', label: 'Brötchen', lines: [line] }}
        config={TEST_CONFIG_V2}
        editable={false}
        editingKey={null}
        onEdit={() => undefined}
        onSaveCorrection={async () => undefined}
      />
    )

  it('„Heute keine“: Basis bleibt „offen“, Abzeichen an der Zeile, Gesamt „keine“', () => {
    view(NONE)
    const table = within(screen.getByTestId('table-broetchen'))
    expect(table.getByText('offen')).toBeInTheDocument()
    expect(table.getByTestId(`day-decision-${NONE.key}`)).toHaveTextContent(
      'Heute keine'
    )
    expect(table.getByText('heute keine')).toBeInTheDocument()
    expect(table.getByText('keine')).toBeInTheDocument()
    const card = within(screen.getByTestId(`line-card-${NONE.key}`))
    expect(card.getByTestId(`day-decision-${NONE.key}`)).toBeInTheDocument()
    expect(card.getByText('keine')).toBeInTheDocument()
  })

  it('Menge für heute: Abzeichen „Für heute festgelegt“, Basis bleibt „offen“', () => {
    view(AMOUNT)
    const table = within(screen.getByTestId('table-broetchen'))
    expect(table.getByText('offen')).toBeInTheDocument()
    expect(table.getByTestId(`day-decision-${AMOUNT.key}`)).toHaveTextContent(
      'Für heute festgelegt'
    )
    expect(table.getByText('+30')).toBeInTheDocument()
  })

  it('ohne Entscheidung kein Abzeichen', () => {
    view(OPEN)
    expect(
      screen.queryByTestId(`day-decision-${OPEN.key}`)
    ).not.toBeInTheDocument()
  })

  it('Brot: die Zelle einer Größe sagt „keine“ und nennt die Tagesentscheidung', () => {
    const day = saturdayV2Draft()
    const KASTEN = 'test-korn|kasten'
    const sections = day.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.key === KASTEN
          ? {
              ...l,
              noneToday: true,
              dayDecision: 'none' as const,
              totalIsMinimum: false,
            }
          : l
      ),
    }))
    const bread = {
      ...day.bread!,
      rows: day.bread!.rows.map((r) =>
        r.itemId === 'test-korn'
          ? {
              ...r,
              cells: {
                ...r.cells,
                kasten: {
                  ...r.cells['kasten']!,
                  totalIsMinimum: false,
                  dayDecision: 'none' as const,
                },
              },
            }
          : r
      ),
    }
    render(
      <BreadTable
        bread={bread}
        config={TEST_CONFIG_V2}
        sheetDate={SAT}
        lineByKey={linesByKey(sections)}
        editable={false}
        editingKey={null}
        onEdit={() => undefined}
        onSaveCorrection={async () => undefined}
      />
    )
    expect(screen.getByTestId(`bread-cell-${KASTEN}`)).toHaveTextContent(
      'keine'
    )
    expect(
      screen.getByTestId(`bread-cell-${KASTEN}-base-open`)
    ).toHaveTextContent('Heute keine · Grundmenge offen')
  })

  it('Maschinenleiste: ein kleiner Hefeteig zeigt kg und die genauen Liter', () => {
    const box = {
      ...saturdayV2Draft().machine![0],
      id: 'test-hefe',
      name: 'Testhefe',
      kg: 1.2,
      kgKnown: 1.2,
      liters: BELOW_STEP,
    }
    render(<MachineStrip machine={[box]} />)
    expect(screen.getByTestId('machine-liters-test-hefe')).toHaveTextContent(
      '0,24 L'
    )
    expect(screen.getByTestId('machine-kg-test-hefe')).toHaveTextContent(
      '1,2 kg'
    )
    expect(screen.getByTestId('machine-strip')).toHaveTextContent(
      'Kleine Menge (unter 1 L, nicht gerundet)'
    )
    expect(screen.getByTestId('machine-strip')).not.toHaveTextContent(/\b0 L/)
  })
})

describe('Tablet', () => {
  const tablet = (line: BackzettelLine) =>
    render(
      <BackstubeLine
        line={line}
        config={TEST_CONFIG_V2}
        draft={false}
        canTick={false}
        pending={false}
        onToggle={() => undefined}
      />
    )

  it('„Heute keine“ steht groß als „keine“ mit dem Abzeichen der Tagesentscheidung', () => {
    tablet(NONE)
    const row = screen.getByTestId(`bs-line-${NONE.key}`)
    expect(row).toHaveTextContent('keine')
    expect(screen.getByTestId(`bs-base-unset-${NONE.key}`)).toHaveTextContent(
      'Heute keine · Grundmenge offen'
    )
    expect(screen.getByTestId(`bs-base-unset-${NONE.key}`)).toHaveAttribute(
      'data-decision',
      'none'
    )
  })

  it('Menge für heute: die Zahl, dazu „Für heute festgelegt · Grundmenge offen“', () => {
    tablet(AMOUNT)
    expect(screen.getByTestId(`bs-line-${AMOUNT.key}`)).toHaveTextContent('30')
    expect(screen.getByTestId(`bs-base-unset-${AMOUNT.key}`)).toHaveTextContent(
      'Für heute festgelegt · Grundmenge offen'
    )
  })

  it('ohne Entscheidung bleibt „Grundmenge offen“', () => {
    tablet(OPEN)
    expect(screen.getByTestId(`bs-base-unset-${OPEN.key}`)).toHaveTextContent(
      /^Grundmenge offen$/
    )
  })
})

describe('Druck', () => {
  function printDay(extra: BackzettelLine): BackzettelDay {
    const day = saturdayV2Draft()
    return {
      ...day,
      sections: day.sections.map((s) =>
        s.id === 'broetchen' ? { ...s, lines: [...s.lines, extra] } : s
      ),
      warnings: [
        ...day.warnings,
        {
          code: 'day_decisions',
          message:
            'Tagesentscheidung für Dienstag (Grundmenge offen): Testvital – heute keine.',
        },
      ],
    }
  }

  it('„Heute keine“ steht als Zeile mit „keine“ und der Angabe zur Grundmenge, dazu unter den Hinweisen', () => {
    const { container } = render(
      <DoughDayPrint
        day={printDay(NONE)}
        config={TEST_CONFIG_V2}
        withExtras={false}
      />
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Testvital')
    expect(text).toContain('Heute keine · Grundmenge offen')
    expect(text).toContain(
      'Tagesentscheidung für Dienstag (Grundmenge offen): Testvital – heute keine.'
    )
    const qty = Array.from(container.querySelectorAll('.qty')).map(
      (q) => q.textContent
    )
    expect(qty).toContain('keine')
  })

  it('ein kleiner Hefeteig druckt die genauen Liter mit Grund', () => {
    const day = saturdayV2Draft()
    const first = day.machine![0]
    const { container } = render(
      <DoughDayPrint
        day={{
          ...day,
          machine: [{ ...first, liters: BELOW_STEP }, ...day.machine!.slice(1)],
        }}
        config={TEST_CONFIG_V2}
        withExtras={false}
      />
    )
    const text = container.textContent ?? ''
    expect(text).toContain('0,24 L')
    expect(text).toContain('unter 1 L, nicht gerundet')
  })
})
