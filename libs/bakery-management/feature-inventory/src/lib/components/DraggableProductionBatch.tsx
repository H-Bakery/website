'use client'

// Draggable Production Batch Component
// Wrapper for production batch cards that enables drag-and-drop functionality

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  DragIndicator,
  MoreVert,
  Warning,
  CheckCircle,
  Schedule,
} from '@mui/icons-material'
import { ProductionBatch } from '../../types/production'

interface DraggableProductionBatchProps {
  batch: ProductionBatch
  index: number
  onMenuClick: (
    event: React.MouseEvent<HTMLElement>,
    batch: ProductionBatch
  ) => void
  onDragStart: (batch: ProductionBatch, index: number) => void
  onDragEnd: () => void
  isDragging?: boolean
  isValidDropTarget?: boolean
}

export const DraggableProductionBatch: React.FC<
  DraggableProductionBatchProps
> = ({
  batch,
  index,
  onMenuClick,
  onDragStart,
  onDragEnd,
  isDragging = false,
  isValidDropTarget = false,
}) => {
  const [isHovered, setIsHovered] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'in_progress':
        return 'primary'
      case 'failed':
        return 'error'
      case 'cancelled':
        return 'default'
      case 'waiting':
        return 'warning'
      default:
        return 'info'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle fontSize="small" />
      case 'in_progress':
        return <Schedule fontSize="small" />
      case 'failed':
        return <Warning fontSize="small" color="error" />
      case 'waiting':
        return <Schedule fontSize="small" color="warning" />
      default:
        return null
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Set drag data
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('batchId', batch.id.toString())
    e.dataTransfer.setData('batchIndex', index.toString())
    e.dataTransfer.setData(
      'duration',
      batch.estimatedDurationMinutes.toString()
    )
    e.dataTransfer.setData('batchData', JSON.stringify(batch))

    // Create custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
    dragImage.style.opacity = '0.8'
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-9999px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(
      dragImage,
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY
    )
    setTimeout(() => document.body.removeChild(dragImage), 0)

    onDragStart(batch, index)
  }

  const canDrag = batch.status === 'planned' || batch.status === 'ready'

  return (
    <Card
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        height: '100%',
        cursor: canDrag ? 'move' : 'default',
        opacity: isDragging ? 0.5 : 1,
        bgcolor:
          batch.status === 'in_progress'
            ? 'primary.light'
            : batch.status === 'completed'
            ? 'success.light'
            : batch.status === 'failed'
            ? 'error.light'
            : 'grey.100',
        border: isValidDropTarget ? '2px dashed' : '1px solid',
        borderColor: isValidDropTarget ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease',
        transform: isHovered && canDrag ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isHovered && canDrag ? 4 : 1,
        '&:hover': {
          bgcolor:
            batch.status === 'in_progress'
              ? 'primary.main'
              : batch.status === 'completed'
              ? 'success.main'
              : batch.status === 'failed'
              ? 'error.main'
              : 'grey.200',
        },
      }}
    >
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          {/* Drag Handle */}
          {canDrag && (
            <Box
              sx={{
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
                mr: 1,
                opacity: isHovered ? 1 : 0.3,
                transition: 'opacity 0.2s',
              }}
            >
              <DragIndicator fontSize="small" />
            </Box>
          )}

          {/* Batch Content */}
          <Box flex={1} minWidth={0}>
            <Box display="flex" alignItems="center" gap={0.5}>
              {getStatusIcon(batch.status)}
              <Typography variant="body2" fontWeight="bold" noWrap>
                {batch.name}
              </Typography>
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {batch.plannedQuantity} {batch.unit}
            </Typography>

            <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
              <Chip
                label={batch.status}
                size="small"
                color={getStatusColor(batch.status)}
                sx={{ fontSize: '0.7rem', height: 18 }}
              />
              <Chip
                label={batch.priority}
                size="small"
                color={getPriorityColor(batch.priority)}
                sx={{ fontSize: '0.7rem', height: 18 }}
              />
              {batch.isDelayed && (
                <Chip
                  icon={<Warning />}
                  label={`${batch.delayMinutes}min verzögert`}
                  size="small"
                  color="error"
                  sx={{ fontSize: '0.7rem', height: 18 }}
                />
              )}
            </Box>

            {/* Progress Bar */}
            {batch.progress !== undefined && batch.progress > 0 && (
              <Box mt={0.5}>
                <Box
                  sx={{
                    width: '100%',
                    height: 4,
                    bgcolor: 'action.selected',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${batch.progress}%`,
                      height: '100%',
                      bgcolor:
                        batch.status === 'failed'
                          ? 'error.main'
                          : 'primary.main',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {batch.progress}% abgeschlossen
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action Menu */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onMenuClick(e, batch)
            }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>

        {/* Additional Info on Hover */}
        {isHovered && (
          <Box mt={1} pt={1} borderTop="1px solid" borderColor="divider">
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Dauer: {batch.estimatedDurationMinutes} Minuten
            </Typography>
            {batch.assignedStaffIds?.length > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Personal: {batch.assignedStaffIds.length} Mitarbeiter
              </Typography>
            )}
            {batch.requiredEquipment?.length > 0 && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Geräte: {batch.requiredEquipment.join(', ')}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default DraggableProductionBatch
