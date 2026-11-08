import React from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import ShiftTemplatesDialog from './ShiftTemplatesDialog'
import * as dienstplanApi from '../../../lib/dienstplanApi'

jest.mock('../../../lib/dienstplanApi', () => ({
  ...jest.requireActual('../../../lib/dienstplanApi'),
  fetchShiftTemplates: jest.fn(),
  createShiftTemplate: jest.fn(),
  updateShiftTemplate: jest.fn(),
  deleteShiftTemplate: jest.fn(),
}))
const api = dienstplanApi as jest.Mocked<typeof dienstplanApi>

const FRUEH: dienstplanApi.ShiftTemplate = {
  id: 1,
  name: 'Früh',
  startTime: '06:00',
  endTime: '12:00',
  breakMinutes: 0,
}
const SPAET: dienstplanApi.ShiftTemplate = {
  id: 2,
  name: 'Spät',
  startTime: '12:00',
  endTime: '18:30',
  breakMinutes: 30,
}

function renderDialog() {
  const onChange = jest.fn()
  const onClose = jest.fn()
  render(<ShiftTemplatesDialog onChange={onChange} onClose={onClose} />)
  return { onChange, onClose, d: within(screen.getByRole('dialog')) }
}

describe('Dienstplan - Schichtvorlagen', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    api.fetchShiftTemplates.mockReset().mockResolvedValue([SPAET, FRUEH])
    api.createShiftTemplate.mockReset()
    api.updateShiftTemplate.mockReset()
    api.deleteShiftTemplate.mockReset()
  })

  it('listet die Vorlagen nach Beginn mit Zeiten und Pause', async () => {
    const { d } = renderDialog()
    expect(await d.findByTestId('shift-template-1')).toHaveTextContent(
      'Früh06:00–12:00'
    )
    const rows = d
      .getAllByTestId(/^shift-template-\d+$/)
      .map((r) => r.dataset.testid)
    expect(rows).toEqual(['shift-template-1', 'shift-template-2'])
    expect(d.getByTestId('shift-template-2')).toHaveTextContent(
      '12:00–18:30 · Pause 30 min'
    )
  })

  it('legt eine Vorlage an; Ende vor Beginn gesperrt; Meldung der API im Dialog', async () => {
    api.createShiftTemplate.mockRejectedValueOnce(
      new Error('Die Pause ist länger als die Schicht.')
    )
    const { d, onChange } = renderDialog()
    await d.findByTestId('shift-template-1')
    const anlegen = d.getByRole('button', { name: 'Vorlage anlegen' })
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Name/), { target: { value: 'Kurz' } })
    fireEvent.change(d.getByLabelText(/^Beginn/), {
      target: { value: '14:00' },
    })
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '13:00' } })
    expect(d.getByText('Ende nach Beginn.')).toBeInTheDocument()
    expect(anlegen).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '15:00' } })
    fireEvent.change(d.getByLabelText(/^Pause/), { target: { value: '90' } })
    fireEvent.click(anlegen)
    expect(
      await d.findByText('Die Pause ist länger als die Schicht.')
    ).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()

    api.createShiftTemplate.mockResolvedValueOnce({
      id: 3,
      name: 'Kurz',
      startTime: '14:00',
      endTime: '15:00',
      breakMinutes: 15,
    })
    fireEvent.change(d.getByLabelText(/^Pause/), { target: { value: '15' } })
    fireEvent.click(anlegen)
    await waitFor(() =>
      expect(api.createShiftTemplate).toHaveBeenLastCalledWith({
        name: 'Kurz',
        startTime: '14:00',
        endTime: '15:00',
        breakMinutes: 15,
      })
    )
    expect(await d.findByTestId('shift-template-3')).toBeInTheDocument()
    expect(
      d.queryByText('Die Pause ist länger als die Schicht.')
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith([
      FRUEH,
      SPAET,
      expect.objectContaining({ id: 3 }),
    ])
    // Formular wieder leer für die nächste Vorlage.
    expect(d.getByLabelText(/^Name/)).toHaveValue('')
  })

  it('ändert eine Vorlage und schickt nur die Änderung', async () => {
    api.updateShiftTemplate.mockResolvedValue({ ...FRUEH, endTime: '11:30' })
    const { d, onChange } = renderDialog()
    fireEvent.click(await d.findByRole('button', { name: 'Früh bearbeiten' }))
    expect(d.getByText('„Früh“ bearbeiten')).toBeInTheDocument()
    expect(d.getByLabelText(/^Beginn/)).toHaveValue('06:00')
    const speichern = d.getByRole('button', { name: 'Vorlage speichern' })
    expect(speichern).toBeDisabled()
    fireEvent.change(d.getByLabelText(/^Ende/), { target: { value: '11:30' } })
    fireEvent.click(speichern)
    await waitFor(() =>
      expect(api.updateShiftTemplate).toHaveBeenCalledWith(1, {
        endTime: '11:30',
      })
    )
    expect(await d.findByText('06:00–11:30')).toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith([
      { ...FRUEH, endTime: '11:30' },
      SPAET,
    ])
    expect(d.getByText('Neue Vorlage')).toBeInTheDocument()
  })

  it('löscht eine Vorlage nach Rückfrage; Fehler der API bleibt sichtbar', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const { d, onChange } = renderDialog()
    fireEvent.click(await d.findByRole('button', { name: 'Spät löschen' }))
    expect(confirm).toHaveBeenCalledWith(
      'Vorlage „Spät“ löschen? Bestehende Schichten bleiben, wie sie sind.'
    )
    expect(api.deleteShiftTemplate).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    api.deleteShiftTemplate.mockRejectedValueOnce(
      new Error('Vorlage nicht gefunden.')
    )
    fireEvent.click(d.getByRole('button', { name: 'Spät löschen' }))
    expect(await d.findByText('Vorlage nicht gefunden.')).toBeInTheDocument()
    expect(d.getByTestId('shift-template-2')).toBeInTheDocument()

    api.deleteShiftTemplate.mockResolvedValueOnce(undefined)
    fireEvent.click(d.getByRole('button', { name: 'Spät löschen' }))
    await waitFor(() =>
      expect(d.queryByTestId('shift-template-2')).not.toBeInTheDocument()
    )
    expect(api.deleteShiftTemplate).toHaveBeenLastCalledWith(2)
    expect(onChange).toHaveBeenLastCalledWith([FRUEH])
  })

  it('Laden gescheitert: Meldung mit „Erneut versuchen“, nicht „keine Vorlagen“', async () => {
    api.fetchShiftTemplates.mockRejectedValueOnce(
      new Error('Nur mit persönlicher Anmeldung.')
    )
    const { d } = renderDialog()
    expect(
      await d.findByText('Nur mit persönlicher Anmeldung.')
    ).toBeInTheDocument()
    expect(d.queryByText('Noch keine Schichtvorlagen.')).not.toBeInTheDocument()
    expect(
      d.queryByRole('button', { name: 'Vorlage anlegen' })
    ).not.toBeInTheDocument()
    fireEvent.click(d.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await d.findByTestId('shift-template-1')).toBeInTheDocument()
  })
})
