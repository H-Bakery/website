import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { FailureForm } from './FailureForm'

describe('FailureForm', () => {
  it('nimmt „Nicht angetroffen" und „Ware mitgenommen" als Vorgabe', () => {
    const onSubmit = jest.fn()
    render(
      <FailureForm busy={false} onSubmit={onSubmit} onCancel={jest.fn()} />
    )

    expect(
      (
        screen.getByRole('radio', {
          name: 'Nicht angetroffen',
        }) as HTMLInputElement
      ).checked
    ).toBe(true)
    expect(
      (
        screen.getByRole('radio', {
          name: 'Ware mitgenommen',
        }) as HTMLInputElement
      ).checked
    ).toBe(true)
    expect(screen.queryByLabelText('Was genau?')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )
    expect(onSubmit).toHaveBeenCalledWith({
      failureReason: 'Nicht angetroffen',
      goodsDisposition: 'taken_back',
    })
  })

  it('gibt einen gewählten Grund und den Verbleib der Ware weiter', () => {
    const onSubmit = jest.fn()
    render(
      <FailureForm busy={false} onSubmit={onSubmit} onCancel={jest.fn()} />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Annahme verweigert' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Ware abgestellt' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )
    expect(onSubmit).toHaveBeenCalledWith({
      failureReason: 'Annahme verweigert',
      goodsDisposition: 'left_at_address',
    })
  })

  it('speichert bei „Sonstiges" den Freitext - und ohne Text „Sonstiges"', () => {
    const onSubmit = jest.fn()
    render(
      <FailureForm busy={false} onSubmit={onSubmit} onCancel={jest.fn()} />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Sonstiges' }))
    const field = screen.getByLabelText('Was genau?')
    fireEvent.change(field, { target: { value: '  Tor verschlossen ' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ failureReason: 'Tor verschlossen' })
    )

    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Als nicht angetroffen speichern' })
    )
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ failureReason: 'Sonstiges' })
    )
  })

  it('lässt sich abbrechen, ohne etwas zu speichern', () => {
    const onSubmit = jest.fn()
    const onCancel = jest.fn()
    render(<FailureForm busy={false} onSubmit={onSubmit} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
