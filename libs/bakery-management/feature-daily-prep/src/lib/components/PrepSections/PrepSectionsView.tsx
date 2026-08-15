'use client'
import React from 'react'
import { Box } from '@mui/material'
import { PrepSection, AdditionalProductionItem } from '../../types/prepTask'
import EnhancedPrepTaskCard from './EnhancedPrepTaskCard'

interface PrepSectionsViewProps {
  prepSections: PrepSection[]
  editMode: boolean
  expandedSections: Record<number, boolean>
  onToggleSectionCompletion: (sectionIndex: number) => void
  onToggleItemCompletion: (sectionIndex: number, itemIndex: number) => void
  onToggleSectionExpanded: (sectionIndex: number) => void
  onUpdateItemQuantity: (
    sectionIndex: number,
    itemIndex: number,
    newQuantity: number
  ) => void
  onAddToProduction: (
    itemName: string,
    reason: AdditionalProductionItem['reason']
  ) => void
}

const PrepSectionsView: React.FC<PrepSectionsViewProps> = ({
  prepSections,
  editMode,
  expandedSections,
  onToggleSectionCompletion,
  onToggleItemCompletion,
  onToggleSectionExpanded,
  onUpdateItemQuantity,
  onAddToProduction,
}) => {
  return (
    <Box>
      {prepSections.map((section, sectionIndex) => {
        const isExpanded = expandedSections[sectionIndex] ?? true

        return (
          <EnhancedPrepTaskCard
            key={sectionIndex}
            section={section}
            sectionIndex={sectionIndex}
            isExpanded={isExpanded}
            editMode={editMode}
            onToggleSectionCompletion={onToggleSectionCompletion}
            onToggleItemCompletion={onToggleItemCompletion}
            onToggleSectionExpanded={onToggleSectionExpanded}
            onUpdateItemQuantity={onUpdateItemQuantity}
            onAddToProduction={onAddToProduction}
          />
        )
      })}
    </Box>
  )
}

export default PrepSectionsView
