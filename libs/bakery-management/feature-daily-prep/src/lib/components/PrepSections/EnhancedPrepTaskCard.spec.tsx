import React from 'react'
import { render, screen } from '@testing-library/react'
import EnhancedPrepTaskCard from './EnhancedPrepTaskCard'
import { PrepSection } from '../../types/prepTask'

const renderCard = (section: PrepSection) =>
  render(
    <EnhancedPrepTaskCard
      section={section}
      sectionIndex={0}
      isExpanded
      editMode={false}
      onToggleSectionCompletion={jest.fn()}
      onToggleItemCompletion={jest.fn()}
      onToggleSectionExpanded={jest.fn()}
      onUpdateItemQuantity={jest.fn()}
      onAddToProduction={jest.fn()}
    />
  )

describe('EnhancedPrepTaskCard - Blechangabe', () => {
  it('zeigt keinen Blech-Text für Positionen ohne Blechnummer', () => {
    renderCard({
      name: 'Teigwaren',
      completed: false,
      items: [{ name: 'Testbrötchen', quantity: 6, completed: false }],
    })

    expect(screen.getByText('Testbrötchen')).toBeInTheDocument()
    expect(screen.queryByText(/Blech/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/undefined|NaN/)
  })

  it('zeigt Blechnummer, Blechbereich und Stück pro Blech', () => {
    renderCard({
      name: 'Teigwaren',
      completed: false,
      items: [
        { name: 'Eins', quantity: 8, completed: false, tray_number: 1 },
        {
          name: 'Bereich',
          quantity: 15,
          completed: false,
          tray_numbers: [11, 12, 13],
        },
        {
          name: 'Bereich mit Stück',
          quantity: 36,
          completed: false,
          tray_numbers: [15, 16, 17],
          trays_of: 12,
        },
      ],
    })

    expect(screen.getByText('Blech 1')).toBeInTheDocument()
    expect(screen.getByText('Bleche 11, 12, 13')).toBeInTheDocument()
    expect(
      screen.getByText('3 Bleche à 12 (Bleche 15, 16, 17)')
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/undefined|NaN/)
  })
})
