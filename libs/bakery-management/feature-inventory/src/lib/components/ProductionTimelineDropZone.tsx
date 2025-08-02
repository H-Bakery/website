'use client'

// Production Timeline Drop Zone Component
// Handles drop operations and visual feedback for the production timeline

import React, { useState, useCallback } from 'react'
import { Box, Typography, alpha } from '@mui/material'
import { AccessTime, Add } from '@mui/icons-material'
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns'
import { de } from 'date-fns/locale'

interface ProductionTimelineDropZoneProps {
  timeSlot: Date
  scheduleDate: string
  scheduleStartTime: Date
  scheduleEndTime: Date
  existingBatches: Array<{
    id: number
    plannedStartTime: string
    plannedEndTime: string
  }>
  onDrop: (batchId: number, newStartTime: Date) => void
  isDraggingOver?: boolean
  canDropHere?: boolean
}

export const ProductionTimelineDropZone: React.FC<
  ProductionTimelineDropZoneProps
> = ({
  timeSlot,
  scheduleDate,
  scheduleStartTime,
  scheduleEndTime,
  existingBatches,
  onDrop,
  isDraggingOver = false,
  canDropHere = true,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const [dropPreview, setDropPreview] = useState<{
    duration: number
    conflicts: boolean
  } | null>(null)

  // Check for conflicts with existing batches
  const checkConflicts = useCallback(
    (startTime: Date, duration: number) => {
      const endTime = addMinutes(startTime, duration)

      return existingBatches.some((batch) => {
        const batchStart = parseISO(batch.plannedStartTime)
        const batchEnd = parseISO(batch.plannedEndTime)

        // Check if there's any overlap
        return (
          (startTime >= batchStart && startTime < batchEnd) ||
          (endTime > batchStart && endTime <= batchEnd) ||
          (startTime <= batchStart && endTime >= batchEnd)
        )
      })
    },
    [existingBatches]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = canDropHere ? 'move' : 'none'

    if (canDropHere) {
      const duration = parseInt(e.dataTransfer.getData('duration') || '60')
      const hasConflicts = checkConflicts(timeSlot, duration)

      setDropPreview({ duration, conflicts: hasConflicts })
      setIsHovered(true)
    }
  }

  const handleDragLeave = () => {
    setIsHovered(false)
    setDropPreview(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    if (!canDropHere) {
      setIsHovered(false)
      setDropPreview(null)
      return
    }

    const batchId = parseInt(e.dataTransfer.getData('batchId'))
    const duration = parseInt(e.dataTransfer.getData('duration') || '60')

    // Check if the drop would cause conflicts
    if (!checkConflicts(timeSlot, duration)) {
      onDrop(batchId, timeSlot)
    } else {
      // Show error feedback
      console.warn('Cannot drop here due to conflicts')
    }

    setIsHovered(false)
    setDropPreview(null)
  }

  const getDropZoneColor = () => {
    if (!isHovered && !isDraggingOver) return 'transparent'
    if (dropPreview?.conflicts) return alpha('#f44336', 0.1) // Red for conflicts
    if (!canDropHere) return alpha('#9e9e9e', 0.1) // Grey for invalid
    return alpha('#4caf50', 0.1) // Green for valid
  }

  const getBorderColor = () => {
    if (!isHovered && !isDraggingOver) return 'transparent'
    if (dropPreview?.conflicts) return '#f44336'
    if (!canDropHere) return '#9e9e9e'
    return '#4caf50'
  }

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 60,
        bgcolor: getDropZoneColor(),
        border: '2px dashed',
        borderColor: getBorderColor(),
        borderRadius: 1,
        transition: 'all 0.2s ease',
        cursor: canDropHere ? 'pointer' : 'not-allowed',
        '&:hover': {
          bgcolor: canDropHere ? alpha('#4caf50', 0.05) : 'transparent',
        },
      }}
    >
      {/* Time Label */}
      <Box
        sx={{
          position: 'absolute',
          top: 4,
          left: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          {format(timeSlot, 'HH:mm')}
        </Typography>
      </Box>

      {/* Drop Preview */}
      {isHovered && dropPreview && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: dropPreview.conflicts ? 'error.main' : 'primary.main',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            boxShadow: 2,
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Typography variant="caption" fontWeight="bold">
            {dropPreview.conflicts
              ? 'Konflikt!'
              : `${dropPreview.duration} Min`}
          </Typography>
        </Box>
      )}

      {/* Empty State */}
      {!isDraggingOver && !isHovered && existingBatches.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        >
          <Add sx={{ fontSize: 30, color: 'text.secondary' }} />
        </Box>
      )}

      {/* Visual Guide Lines */}
      {isHovered && (
        <>
          {/* Start Time Indicator */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: dropPreview?.conflicts ? 'error.main' : 'primary.main',
            }}
          />

          {/* Duration Preview */}
          {dropPreview && !dropPreview.conflicts && (
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 40,
                width: `${(dropPreview.duration / 60) * 100}px`,
                bgcolor: alpha('#4caf50', 0.3),
                borderRadius: 1,
                border: '2px solid',
                borderColor: 'success.main',
                pointerEvents: 'none',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontWeight: 'bold',
                  color: 'success.dark',
                }}
              >
                {format(timeSlot, 'HH:mm')} -{' '}
                {format(addMinutes(timeSlot, dropPreview.duration), 'HH:mm')}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

export default ProductionTimelineDropZone
