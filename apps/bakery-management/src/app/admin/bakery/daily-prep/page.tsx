'use client'
import React from 'react'
import {
  Container,
  Box,
  LinearProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Fab,
  Badge,
} from '@mui/material'
import { CheckCircleOutline } from '@mui/icons-material'

// Components
import {
  DailyPrepHeader,
  ProgressOverview,
  DailyPrepTabs,
  PrepSectionsView,
  BakingScheduleView,
  AdditionalProductionView,
  PrintUtils,
} from '@bakery/management/feature-daily-prep'

// Hooks
import { useDailyPrep } from '@bakery/management/feature-daily-prep'

/**
 * Main Daily Prep Page Component
 *
 * This component manages the daily preparation tasks for the bakery.
 * It provides functionality for:
 * - Viewing and managing preparation tasks
 * - Editing quantities and tracking completion
 * - Managing baking schedules
 * - Handling additional production requests
 * - Printing production and baking plans
 */
const DailyPrepPage: React.FC = () => {
  const {
    // State
    selectedDate,
    tabValue,
    saveDialogOpen,
    isGenerating,
    isLoading,
    isFromSpecificFile,
    editMode,
    expandedSections,
    prepSections,
    bakingSchedule,
    additionalProduction,

    // Actions
    setSelectedDate,
    setTabValue,
    setSaveDialogOpen,
    setEditMode,
    toggleSectionExpanded,

    // Complex actions
    loadPrepTasks,
    generatePrepList,
    toggleItemCompletion,
    toggleSectionCompletion,
    updateItemQuantity,
    updateBakingQuantity,
    handleAddToProduction,

    // Computed values
    calculateProgress,
  } = useDailyPrep()

  // Event handlers
  const handleSave = () => {
    console.log('Saving prep checklist')
    setSaveDialogOpen(false)
  }

  const handlePrintProductionPlan = () => {
    PrintUtils.printProductionPlan(prepSections, selectedDate)
  }

  const handlePrintBakersPlan = () => {
    PrintUtils.printBakersPlan(
      bakingSchedule,
      additionalProduction,
      selectedDate
    )
  }

  const handleToggleEditMode = () => {
    setEditMode(!editMode)
  }

  // Calculate low stock items for FAB badge
  const lowStockItems = prepSections
    .flatMap((section) => section.items || [])
    .filter(
      (item) =>
        item &&
        (item.stock_status === 'low' ||
          item.stock_status === 'critical' ||
          item.stock_status === 'empty')
    )

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mt: 8,
          }}
        >
          <LinearProgress sx={{ width: '100%', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Lade Vorbereitungsaufgaben für{' '}
            {selectedDate.toLocaleDateString('de-DE')}...
          </Typography>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl">
      {/* Header Section */}
      <Box sx={{ mb: 3 }}>
        <DailyPrepHeader
          selectedDate={selectedDate}
          isFromSpecificFile={isFromSpecificFile}
          editMode={editMode}
          isGenerating={isGenerating}
          onToggleEditMode={handleToggleEditMode}
          onRefresh={generatePrepList}
          onPrintProductionPlan={handlePrintProductionPlan}
          onPrintBakersPlan={handlePrintBakersPlan}
          onSave={() => setSaveDialogOpen(true)}
        />

        {/* Progress Overview */}
        <ProgressOverview
          prepSections={prepSections}
          selectedDate={selectedDate}
          isGenerating={isGenerating}
          onDateChange={setSelectedDate}
          onRefresh={generatePrepList}
        />
      </Box>

      {/* Tab Navigation */}
      <DailyPrepTabs
        tabValue={tabValue}
        additionalProduction={additionalProduction}
        onTabChange={setTabValue}
        onPrintBakersPlan={handlePrintBakersPlan}
      />

      {/* Tab Content */}
      {tabValue === 0 && (
        <PrepSectionsView
          prepSections={prepSections}
          editMode={editMode}
          expandedSections={expandedSections}
          onToggleSectionCompletion={toggleSectionCompletion}
          onToggleItemCompletion={toggleItemCompletion}
          onToggleSectionExpanded={toggleSectionExpanded}
          onUpdateItemQuantity={updateItemQuantity}
          onAddToProduction={handleAddToProduction}
        />
      )}

      {tabValue === 1 && (
        <BakingScheduleView
          bakingSchedule={bakingSchedule}
          editMode={editMode}
          onUpdateBakingQuantity={updateBakingQuantity}
        />
      )}

      {tabValue === 2 && (
        <AdditionalProductionView
          additionalProduction={additionalProduction}
          onPrintBakersPlan={handlePrintBakersPlan}
        />
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Vorbereitungsliste speichern</DialogTitle>
        <DialogContent>
          <Typography>
            Möchten Sie die aktuelle Vorbereitungsliste für den{' '}
            {selectedDate.toLocaleDateString('de-DE')} speichern?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button for Quick Stock Overview */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => console.log('Quick action - stock overview')}
        title={`${lowStockItems.length} Artikel mit niedrigem Bestand`}
      >
        <Badge badgeContent={lowStockItems.length} color="error">
          <CheckCircleOutline />
        </Badge>
      </Fab>
    </Container>
  )
}

export default DailyPrepPage
