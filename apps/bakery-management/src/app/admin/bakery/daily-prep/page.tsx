'use client'
import React, { useState } from 'react'
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
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material'
import { CheckCircleOutline, Inventory2Outlined } from '@mui/icons-material'

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

const STORAGE_PREFIX = 'bakery-daily-prep-'

const STOCK_LABELS: Record<
  string,
  { label: string; color: 'warning' | 'error' }
> = {
  low: { label: 'Niedrig', color: 'warning' },
  critical: { label: 'Kritisch', color: 'error' },
  empty: { label: 'Leer', color: 'error' },
}

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
    generatePrepList,
    toggleItemCompletion,
    toggleSectionCompletion,
    updateItemQuantity,
    updateBakingQuantity,
    handleAddToProduction,
  } = useDailyPrep()

  const [snackbar, setSnackbar] = useState<{
    message: string
    severity: 'success' | 'error'
  } | null>(null)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)

  const dateKey = selectedDate.toISOString().split('T')[0]

  // Event handlers
  const handleSave = () => {
    // Es gibt noch keinen Backend-Endpunkt zum Speichern der Checkliste;
    // der Stand wird lokal im Browser abgelegt.
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${dateKey}`,
        JSON.stringify({
          date: dateKey,
          savedAt: new Date().toISOString(),
          prepSections,
          bakingSchedule,
          additionalProduction,
        })
      )
      setSnackbar({
        message: `Vorbereitungsliste für ${selectedDate.toLocaleDateString(
          'de-DE'
        )} lokal gespeichert`,
        severity: 'success',
      })
    } catch (error) {
      console.error('Failed to save prep checklist:', error)
      setSnackbar({
        message: 'Speichern fehlgeschlagen',
        severity: 'error',
      })
    }
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

      {/* Low stock overview dialog */}
      <Dialog
        open={stockDialogOpen}
        onClose={() => setStockDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Artikel mit niedrigem Bestand</DialogTitle>
        <DialogContent dividers>
          {lowStockItems.length === 0 ? (
            <Typography color="text.secondary">
              Alle Bestände sind ausreichend.
            </Typography>
          ) : (
            <List dense disablePadding>
              {lowStockItems.map((item, index) => {
                const status = STOCK_LABELS[item.stock_status ?? ''] ?? {
                  label: item.stock_status,
                  color: 'warning' as const,
                }
                return (
                  <ListItem
                    key={`${item.name}-${index}`}
                    disableGutters
                    secondaryAction={
                      <Chip
                        size="small"
                        label={status.label}
                        color={status.color}
                      />
                    }
                  >
                    <ListItemText
                      primary={item.name}
                      secondary={
                        item.current_stock !== undefined
                          ? `Bestand: ${item.current_stock}${
                              item.min_stock_level !== undefined
                                ? ` / Minimum: ${item.min_stock_level}`
                                : ''
                            }`
                          : undefined
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockDialogOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar?.severity ?? 'success'}
          onClose={() => setSnackbar(null)}
        >
          {snackbar?.message}
        </Alert>
      </Snackbar>

      {/* Floating Action Button for Quick Stock Overview */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => setStockDialogOpen(true)}
        aria-label={`${lowStockItems.length} Artikel mit niedrigem Bestand anzeigen`}
        title={`${lowStockItems.length} Artikel mit niedrigem Bestand`}
      >
        <Badge badgeContent={lowStockItems.length} color="error">
          {lowStockItems.length > 0 ? (
            <Inventory2Outlined />
          ) : (
            <CheckCircleOutline />
          )}
        </Badge>
      </Fab>
    </Container>
  )
}

export default DailyPrepPage
