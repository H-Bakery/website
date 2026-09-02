import React, { useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Box,
  Alert,
  Autocomplete,
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  InventoryItem,
} from '@bakery/shared/data-access'

interface InventoryFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateInventoryDto | UpdateInventoryDto) => void
  item?: InventoryItem | null
  mode: 'create' | 'edit'
  products?: Array<{ id: number; name: string }>
  categories?: string[]
  suppliers?: string[]
  loading?: boolean
  error?: string | null
}

const units = ['Stück', 'kg', 'g', 'l', 'ml', 'Packung', 'Karton', 'Palette']

const NUMERIC_FIELDS = new Set([
  'productId',
  'quantity',
  'minimumQuantity',
  'maximumQuantity',
  'reorderPoint',
])

export const InventoryForm: React.FC<InventoryFormProps> = ({
  open,
  onClose,
  onSubmit,
  item,
  mode,
  products = [],
  categories = [],
  suppliers = [],
  loading = false,
  error = null,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateInventoryDto | UpdateInventoryDto>({
    defaultValues: {
      productId: item?.productId || undefined,
      quantity: mode === 'create' ? 0 : undefined,
      minimumQuantity: item?.minimumQuantity || 0,
      maximumQuantity: item?.maximumQuantity || undefined,
      reorderPoint: item?.reorderPoint || undefined,
      location: item?.location || '',
      unit: item?.unit || 'Stück',
      category: item?.category || '',
      supplier: item?.supplier || '',
      supplierContact: item?.supplierContact || '',
      notes: item?.notes || '',
    },
  })

  useEffect(() => {
    if (open && item) {
      reset({
        productId: item.productId,
        minimumQuantity: item.minimumQuantity,
        maximumQuantity: item.maximumQuantity || undefined,
        reorderPoint: item.reorderPoint || undefined,
        location: item.location || '',
        unit: item.unit || 'Stück',
        category: item.category || '',
        supplier: item.supplier || '',
        supplierContact: item.supplierContact || '',
        notes: item.notes || '',
      })
    }
  }, [open, item, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onFormSubmit = (data: CreateInventoryDto | UpdateInventoryDto) => {
    // Remove undefined values. Zahlenfelder kommen aus den TextFields als
    // Strings zurück (react-hook-form konvertiert bei Controller nicht selbst).
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') {
        acc[key as keyof typeof data] = NUMERIC_FIELDS.has(key)
          ? Number(value)
          : value
      }
      return acc
    }, {} as any)

    onSubmit(cleanData)
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle>
          {mode === 'create'
            ? 'Neuen Lagerbestand anlegen'
            : 'Lagerbestand bearbeiten'}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {mode === 'create' && (
              <Grid item xs={12}>
                <Controller
                  name="productId"
                  control={control}
                  rules={{ required: 'Produkt ist erforderlich' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.productId}>
                      <InputLabel id="inventory-form-product-label">
                        Produkt
                      </InputLabel>
                      <Select
                        {...field}
                        labelId="inventory-form-product-label"
                        label="Produkt"
                      >
                        {products.map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.productId && (
                        <Typography variant="caption" color="error">
                          {errors.productId.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            )}

            {mode === 'edit' && item && (
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Produkt
                  </Typography>
                  <Typography variant="body1">{item.product?.name}</Typography>
                </Box>
              </Grid>
            )}

            {mode === 'create' && (
              <Grid item xs={12} sm={6}>
                <Controller
                  name="quantity"
                  control={control}
                  rules={{
                    required: 'Anfangsbestand ist erforderlich',
                    min: {
                      value: 0,
                      message: 'Bestand muss mindestens 0 sein',
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Anfangsbestand"
                      type="number"
                      fullWidth
                      error={!!errors.quantity}
                      helperText={errors.quantity?.message}
                    />
                  )}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={mode === 'create' ? 6 : 4}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel id="inventory-form-unit-label">
                      Einheit
                    </InputLabel>
                    <Select
                      {...field}
                      labelId="inventory-form-unit-label"
                      label="Einheit"
                    >
                      {units.map((unit) => (
                        <MenuItem key={unit} value={unit}>
                          {unit}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="minimumQuantity"
                control={control}
                rules={{
                  required: 'Mindestbestand ist erforderlich',
                  min: {
                    value: 0,
                    message: 'Mindestbestand muss mindestens 0 sein',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Mindestbestand"
                    type="number"
                    fullWidth
                    error={!!errors.minimumQuantity}
                    helperText={errors.minimumQuantity?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="reorderPoint"
                control={control}
                rules={{
                  min: {
                    value: 0,
                    message: 'Bestellpunkt muss mindestens 0 sein',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Bestellpunkt"
                    type="number"
                    fullWidth
                    error={!!errors.reorderPoint}
                    helperText={
                      errors.reorderPoint?.message ||
                      'Bestand, bei dem nachbestellt werden soll'
                    }
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <Controller
                name="maximumQuantity"
                control={control}
                rules={{
                  min: {
                    value: 0,
                    message: 'Maximalbestand muss mindestens 0 sein',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Maximalbestand"
                    type="number"
                    fullWidth
                    error={!!errors.maximumQuantity}
                    helperText={errors.maximumQuantity?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={categories}
                    freeSolo
                    renderInput={(params) => (
                      <TextField {...params} label="Kategorie" />
                    )}
                    onChange={(_, value) => field.onChange(value)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Lagerort" fullWidth />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="supplier"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    options={suppliers}
                    freeSolo
                    renderInput={(params) => (
                      <TextField {...params} label="Lieferant" />
                    )}
                    onChange={(_, value) => field.onChange(value)}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="supplierContact"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Lieferanten-Kontakt"
                    fullWidth
                    placeholder="E-Mail oder Telefon"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notizen"
                    fullWidth
                    multiline
                    rows={3}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>Abbrechen</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !isDirty}
          >
            {loading ? 'Speichern...' : 'Speichern'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
