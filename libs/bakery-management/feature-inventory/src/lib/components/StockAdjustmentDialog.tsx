import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Typography,
  Box,
  Alert,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as SetIcon,
  TrendingUp as IncreaseIcon,
  TrendingDown as DecreaseIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { InventoryItem, StockAdjustmentDto } from '@bakery/shared/data-access'

interface StockAdjustmentDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: StockAdjustmentDto) => void
  item: InventoryItem | null
  loading?: boolean
  error?: string | null
}

const adjustmentReasons = {
  increase: [
    'Lieferung erhalten',
    'Rückgabe von Kunde',
    'Produktion',
    'Inventurkorrektur',
    'Sonstiges',
  ],
  decrease: [
    'Verkauf',
    'Verderb/Ablauf',
    'Beschädigung',
    'Schwund',
    'Verwendung in Produktion',
    'Inventurkorrektur',
    'Sonstiges',
  ],
  set: ['Inventur', 'Korrektur', 'Systemabgleich', 'Sonstiges'],
}

export const StockAdjustmentDialog: React.FC<StockAdjustmentDialogProps> = ({
  open,
  onClose,
  onSubmit,
  item,
  loading = false,
  error = null,
}) => {
  const [adjustmentType, setAdjustmentType] = useState<
    'increase' | 'decrease' | 'set'
  >('increase')
  const [quantity, setQuantity] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [customReason, setCustomReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [validationError, setValidationError] = useState<string>('')

  useEffect(() => {
    if (open) {
      // Reset form when opening
      setAdjustmentType('increase')
      setQuantity('')
      setReason('')
      setCustomReason('')
      setNotes('')
      setValidationError('')
    }
  }, [open])

  const handleClose = () => {
    onClose()
  }

  const calculateNewQuantity = (): number => {
    if (!item || !quantity) return 0
    const qty = parseInt(quantity)

    switch (adjustmentType) {
      case 'increase':
        return item.quantity + qty
      case 'decrease':
        return item.quantity - qty
      case 'set':
        return qty
      default:
        return item.quantity
    }
  }

  const handleSubmit = () => {
    // Validation
    const qty = parseInt(quantity)
    if (!quantity || isNaN(qty) || qty < 0) {
      setValidationError('Bitte geben Sie eine gültige Menge ein')
      return
    }

    if (!reason && !customReason) {
      setValidationError('Bitte wählen Sie einen Grund aus')
      return
    }

    if (adjustmentType === 'decrease' && item && qty > item.quantity) {
      setValidationError('Die Menge übersteigt den aktuellen Bestand')
      return
    }

    const finalReason = reason === 'Sonstiges' ? customReason : reason

    onSubmit({
      adjustmentType,
      quantity: qty,
      reason: finalReason,
      notes,
    })
  }

  if (!item) return null

  const newQuantity = calculateNewQuantity()
  const isValidQuantity =
    !quantity ||
    adjustmentType !== 'decrease' ||
    parseInt(quantity) <= item.quantity

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Bestand anpassen: {item.product?.name}</DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {validationError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setValidationError('')}
          >
            {validationError}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Aktueller Bestand
            </Typography>
            <Typography variant="h4">
              {item.quantity} {item.unit || 'Stk'}
            </Typography>
          </Paper>
        </Box>

        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Art der Anpassung
          </Typography>
          <RadioGroup
            row
            value={adjustmentType}
            onChange={(e) => {
              setAdjustmentType(e.target.value as any)
              setReason('')
              setCustomReason('')
            }}
          >
            <FormControlLabel
              value="increase"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IncreaseIcon color="success" />
                  <span>Erhöhen</span>
                </Box>
              }
            />
            <FormControlLabel
              value="decrease"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DecreaseIcon color="error" />
                  <span>Reduzieren</span>
                </Box>
              }
            />
            <FormControlLabel
              value="set"
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SetIcon color="primary" />
                  <span>Festlegen</span>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        <Box sx={{ mb: 3 }}>
          <TextField
            label={adjustmentType === 'set' ? 'Neuer Bestand' : 'Menge'}
            type="number"
            fullWidth
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={!isValidQuantity}
            helperText={
              !isValidQuantity
                ? 'Menge übersteigt aktuellen Bestand'
                : adjustmentType === 'set'
                ? 'Der neue Bestandswert'
                : `Um wie viel soll der Bestand ${
                    adjustmentType === 'increase' ? 'erhöht' : 'reduziert'
                  } werden?`
            }
            InputProps={{
              startAdornment: adjustmentType !== 'set' && (
                <Box sx={{ mr: 1 }}>
                  {adjustmentType === 'increase' ? <AddIcon /> : <RemoveIcon />}
                </Box>
              ),
            }}
          />

          {quantity && isValidQuantity && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'primary.lighter' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Neuer Bestand nach Anpassung
              </Typography>
              <Typography variant="h5" color="primary">
                {newQuantity} {item.unit || 'Stk'}
              </Typography>
            </Paper>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Grund für die Anpassung
          </Typography>
          <FormControl fullWidth>
            <RadioGroup
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (e.target.value !== 'Sonstiges') {
                  setCustomReason('')
                }
              }}
            >
              {adjustmentReasons[adjustmentType].map((r) => (
                <FormControlLabel
                  key={r}
                  value={r}
                  control={<Radio />}
                  label={r}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {reason === 'Sonstiges' && (
            <TextField
              label="Grund angeben"
              fullWidth
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              sx={{ mt: 2 }}
              required
            />
          )}
        </Box>

        <TextField
          label="Zusätzliche Notizen (optional)"
          fullWidth
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {item.adjustments && item.adjustments.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" gutterBottom>
              Letzte Anpassungen
            </Typography>
            <List dense>
              {item.adjustments.slice(0, 3).map((adj) => (
                <ListItem key={adj.id} sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        {adj.adjustmentType === 'increase' && (
                          <IncreaseIcon color="success" fontSize="small" />
                        )}
                        {adj.adjustmentType === 'decrease' && (
                          <DecreaseIcon color="error" fontSize="small" />
                        )}
                        {adj.adjustmentType === 'set' && (
                          <SetIcon color="primary" fontSize="small" />
                        )}
                        <Typography variant="body2">
                          {adj.adjustmentType === 'increase' &&
                            `+${adj.quantity}`}
                          {adj.adjustmentType === 'decrease' &&
                            `-${adj.quantity}`}
                          {adj.adjustmentType === 'set' && `=${adj.quantity}`}{' '}
                          {item.unit || 'Stk'} - {adj.reason}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(adj.createdAt!), 'dd.MM.yyyy HH:mm', {
                          locale: de,
                        })}
                        {adj.user && ` von ${adj.user.name}`}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Abbrechen</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            loading ||
            !quantity ||
            !isValidQuantity ||
            (!reason && !customReason)
          }
        >
          {loading ? 'Speichern...' : 'Bestand anpassen'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
