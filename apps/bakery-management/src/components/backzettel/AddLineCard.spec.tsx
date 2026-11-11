import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { AddLineCard } from './AddLineCard'
import { TEST_CONFIG_V2, V2_TUE, v2Line } from '../../lib/backzettelFixtures'
import type { BackzettelSection } from '../../lib/backzettelApi'

const kuchen = v2Line({
  itemId: 'test-ruehr',
  name: 'Testrührkuchen',
  section: 'kuchen',
})
const chargen = v2Line({
  itemId: 'test-spezial',
  name: 'Testspezial',
  section: 'brot',
  unit: 'Charge',
})
const dienstag = v2Line({
  itemId: 'test-doppel',
  name: 'Testdoppel',
  section: 'broetchen',
  bakeDate: V2_TUE,
})
const ADDABLE: BackzettelSection[] = [
  { id: 'brot', label: 'Brot', lines: [chargen] },
  { id: 'broetchen', label: 'Brötchen', lines: [dienstag] },
  { id: 'kuchen', label: 'Kuchen', lines: [kuchen] },
]

function renderCard(
  onSave = jest.fn().mockResolvedValue(undefined),
  addable: BackzettelSection[] | undefined = ADDABLE
) {
  render(
    <AddLineCard addable={addable} config={TEST_CONFIG_V2} onSave={onSave} />
  )
  return onSave
}

describe('AddLineCard – Posten ohne Menge aufnehmen', () => {
  it('zeigt nichts, wenn es nichts aufzunehmen gibt', () => {
    renderCard(undefined, [])
    expect(screen.queryByTestId('add-line')).not.toBeInTheDocument()
  })

  it('nennt die Zahl und öffnet die Auswahl je Abschnitt', () => {
    renderCard()
    expect(screen.getByTestId('add-line')).toHaveTextContent(
      '3 Posten haben heute keine Menge und stehen deshalb nicht auf dem Zettel.'
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Weiteren Posten aufnehmen' })
    )
    const select = screen.getByLabelText('Posten aufnehmen')
    const groups = Array.from(select.querySelectorAll('optgroup')).map((g) =>
      g.getAttribute('label')
    )
    expect(groups).toEqual(['Brot', 'Brötchen', 'Kuchen'])
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual([
      'Bitte wählen …',
      'Testspezial (Charge)',
      'Testdoppel · für Di 01.12.',
      'Testrührkuchen',
    ])
  })

  it('speichert Menge und Grund als Korrektur der gewählten Zeile', async () => {
    const onSave = renderCard()
    fireEvent.click(
      screen.getByRole('button', { name: 'Weiteren Posten aufnehmen' })
    )
    fireEvent.change(screen.getByLabelText('Posten aufnehmen'), {
      target: { value: kuchen.key },
    })
    const editor = within(
      screen.getByTestId(`add-correction-editor-${kuchen.key}`)
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '2' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    // ohne Grund geht nichts raus
    expect(await editor.findByRole('alert')).toHaveTextContent(
      'Für eine Korrektur ist ein Grund nötig.'
    )
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Testbestellung' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(kuchen, 2, 'Testbestellung')
    )
    // danach wieder zugeklappt
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Weiteren Posten aufnehmen' })
      ).toBeInTheDocument()
    )
  })

  it('ein Fehler beim Speichern bleibt im Editor stehen', async () => {
    const onSave = renderCard(
      jest.fn().mockRejectedValue(new Error('Testfehler vom Server'))
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Weiteren Posten aufnehmen' })
    )
    fireEvent.change(screen.getByLabelText('Posten aufnehmen'), {
      target: { value: chargen.key },
    })
    const editor = within(
      screen.getByTestId(`add-correction-editor-${chargen.key}`)
    )
    fireEvent.change(editor.getByLabelText('Korrektur'), {
      target: { value: '0,5' },
    })
    fireEvent.change(editor.getByLabelText('Grund'), {
      target: { value: 'Test' },
    })
    fireEvent.click(editor.getByRole('button', { name: 'Speichern' }))
    expect(await editor.findByRole('alert')).toHaveTextContent(
      'Testfehler vom Server'
    )
    expect(onSave).toHaveBeenCalledWith(chargen, 0.5, 'Test')
  })

  it('Abbrechen schließt ohne Speichern', () => {
    const onSave = renderCard()
    fireEvent.click(
      screen.getByRole('button', { name: 'Weiteren Posten aufnehmen' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByLabelText('Posten aufnehmen')).not.toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
