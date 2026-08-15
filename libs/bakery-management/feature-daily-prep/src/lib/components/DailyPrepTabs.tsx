'use client'
import React from 'react'
import { Box, Tabs, Tab, Chip, Button } from '@mui/material'
import { Assignment, BakeryDining, Add, Print } from '@mui/icons-material'
import { AdditionalProductionItem } from '../types/prepTask'

interface DailyPrepTabsProps {
  tabValue: number
  additionalProduction: AdditionalProductionItem[]
  onTabChange: (newValue: number) => void
  onPrintBakersPlan: () => void
}

const DailyPrepTabs: React.FC<DailyPrepTabsProps> = ({
  tabValue,
  additionalProduction,
  onTabChange,
  onPrintBakersPlan,
}) => {
  const hasUrgentItems = additionalProduction.some(
    (item) => item.urgency === 'high' || item.urgency === 'critical'
  )

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
      }}
    >
      <Tabs value={tabValue} onChange={(_, newValue) => onTabChange(newValue)}>
        <Tab label="Vorbereitungsaufgaben" icon={<Assignment />} />
        <Tab label="Standard Backplan" icon={<BakeryDining />} />
        <Tab label="Zusätzliche Produktion" icon={<Add />} />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {additionalProduction.length > 0 && tabValue === 2 && (
          <Chip
            label={`${additionalProduction.length} Artikel`}
            color={hasUrgentItems ? 'error' : 'primary'}
            variant="filled"
          />
        )}
        {tabValue === 2 && (
          <Button
            variant="contained"
            size="small"
            startIcon={<Print />}
            onClick={onPrintBakersPlan}
            disabled={additionalProduction.length === 0}
          >
            Backplan drucken
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default DailyPrepTabs
