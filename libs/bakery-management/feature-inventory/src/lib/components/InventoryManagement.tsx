import React, { useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Fab,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  FileDownload as ExportIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { InventoryDataGrid } from './InventoryDataGrid'
import { InventoryForm } from './InventoryForm'
import { StockAdjustmentDialog } from './StockAdjustmentDialog'
import { InventoryFilters } from './InventoryFilters'
import {
  useInventory,
  useLowStockItems,
  useInventoryCategories,
  useInventorySuppliers,
  useCreateInventory,
  useUpdateInventory,
  useDeleteInventory,
  useAdjustStock,
} from '../hooks/useInventory'
import {
  InventoryItem,
  InventoryFilters as IInventoryFilters,
  CreateInventoryDto,
  UpdateInventoryDto,
  StockAdjustmentDto,
  productService,
  PaginationOptions,
} from '@bakery/shared/data-access'

export const InventoryManagement: React.FC = () => {
  // State
  const [filters, setFilters] = useState<IInventoryFilters>({})
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 25,
    sortBy: 'id',
    sortOrder: 'ASC',
  })
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(
    null
  )
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Queries
  const {
    data: inventoryData,
    isLoading,
    error,
  } = useInventory(filters, pagination)
  const { data: lowStockItems } = useLowStockItems()
  const { data: categories = [] } = useInventoryCategories()
  const { data: suppliers = [] } = useInventorySuppliers()
  const { data: products } = productService.useProducts()

  // Mutations
  const createMutation = useCreateInventory()
  const updateMutation = useUpdateInventory()
  const deleteMutation = useDeleteInventory()
  const adjustStockMutation = useAdjustStock()

  // Handlers
  const handleOpenCreateForm = () => {
    setFormMode('create')
    setSelectedItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item: InventoryItem) => {
    setFormMode('edit')
    setSelectedItem(item)
    setFormOpen(true)
  }

  const handleDelete = async (item: InventoryItem) => {
    if (
      confirm(
        `Möchten Sie den Lagerbestand für "${item.product?.name}" wirklich löschen?`
      )
    ) {
      try {
        await deleteMutation.mutateAsync(item.id)
        showSnackbar('Lagerbestand erfolgreich gelöscht', 'success')
      } catch (error) {
        showSnackbar('Fehler beim Löschen des Lagerbestands', 'error')
      }
    }
  }

  const handleAdjustStock = (item: InventoryItem) => {
    setAdjustmentItem(item)
    setAdjustmentDialogOpen(true)
  }

  const handleFormSubmit = async (
    data: CreateInventoryDto | UpdateInventoryDto
  ) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(data as CreateInventoryDto)
        showSnackbar('Lagerbestand erfolgreich erstellt', 'success')
      } else if (selectedItem) {
        await updateMutation.mutateAsync({
          id: selectedItem.id,
          data: data as UpdateInventoryDto,
        })
        showSnackbar('Lagerbestand erfolgreich aktualisiert', 'success')
      }
      setFormOpen(false)
    } catch (error) {
      showSnackbar('Fehler beim Speichern des Lagerbestands', 'error')
    }
  }

  const handleAdjustmentSubmit = async (data: StockAdjustmentDto) => {
    if (!adjustmentItem) return

    try {
      await adjustStockMutation.mutateAsync({ id: adjustmentItem.id, data })
      showSnackbar('Bestand erfolgreich angepasst', 'success')
      setAdjustmentDialogOpen(false)
    } catch (error) {
      showSnackbar('Fehler beim Anpassen des Bestands', 'error')
    }
  }

  const handleExport = () => {
    // TODO: Implement CSV export
    showSnackbar('Export-Funktion wird implementiert', 'success')
  }

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity })
  }

  const clearFilters = () => {
    setFilters({})
  }

  if (error) {
    return (
      <Alert severity="error">
        Fehler beim Laden der Inventardaten. Bitte versuchen Sie es später
        erneut.
      </Alert>
    )
  }

  return (
    <Box>
      {/* Inventory Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Kritische Bestände
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <WarningIcon color="error" />
              <Typography variant="h3" color="error.main">
                {lowStockItems?.filter(
                  (item) => item.quantity <= item.minimumQuantity
                ).length || 0}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Artikel unter Mindestbestand
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Niedrige Bestände
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <WarningIcon color="warning" />
              <Typography variant="h3" color="warning.main">
                {lowStockItems?.filter(
                  (item) =>
                    item.quantity > item.minimumQuantity &&
                    item.reorderPoint &&
                    item.quantity <= item.reorderPoint
                ).length || 0}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Artikel unter Bestellpunkt
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Gesamtartikel
            </Typography>
            <Typography variant="h3" color="primary.main">
              {inventoryData?.total || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Artikel im Lager
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <InventoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        suppliers={suppliers}
        onClearFilters={clearFilters}
      />

      {/* Inventory Table */}
      <Paper sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6">Lagerbestand</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExport}
            >
              Exportieren
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateForm}
            >
              Neuer Artikel
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <InventoryDataGrid
            items={inventoryData?.items || []}
            loading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdjustStock={handleAdjustStock}
          />
        )}
      </Paper>

      {/* Forms and Dialogs */}
      <InventoryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        item={selectedItem}
        mode={formMode}
        products={products?.map((p) => ({ id: p.id, name: p.name })) || []}
        categories={categories}
        suppliers={suppliers}
        loading={createMutation.isLoading || updateMutation.isLoading}
        error={createMutation.error?.message || updateMutation.error?.message}
      />

      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onClose={() => setAdjustmentDialogOpen(false)}
        onSubmit={handleAdjustmentSubmit}
        item={adjustmentItem}
        loading={adjustStockMutation.isLoading}
        error={adjustStockMutation.error?.message}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
