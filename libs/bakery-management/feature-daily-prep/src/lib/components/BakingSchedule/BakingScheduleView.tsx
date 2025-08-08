'use client'
import React from 'react'
import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Chip,
  TextField,
  Box,
  Alert,
} from '@mui/material'
import { LocalDining, BakeryDining } from '@mui/icons-material'
import { BakingItem } from '../../../../types/prepTask'

interface BakingScheduleViewProps {
  bakingSchedule: {
    cakes: BakingItem[]
    bread: BakingItem[]
  }
  editMode: boolean
  onUpdateBakingQuantity: (type: 'cakes' | 'bread', itemIndex: number, newQuantity: number) => void
}

const BakingScheduleView: React.FC<BakingScheduleViewProps> = ({
  bakingSchedule,
  editMode,
  onUpdateBakingQuantity,
}) => {
  return (
    <Box>
      {editMode && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            Bearbeitungsmodus aktiv
          </Typography>
          <Typography variant="body2">
            Sie können die Mengen direkt bearbeiten. Klicken Sie auf
            "Bearbeitung beenden" um die Änderungen zu speichern.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <BakingCategoryCard
            title="Kuchen & Torten"
            icon={<LocalDining color="primary" />}
            items={bakingSchedule.cakes}
            editMode={editMode}
            onUpdateQuantity={(itemIndex, newQuantity) =>
              onUpdateBakingQuantity('cakes', itemIndex, newQuantity)
            }
            quantityUnit="Stück"
            maxQuantity={20}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <BakingCategoryCard
            title="Brot"
            icon={<BakeryDining color="primary" />}
            items={bakingSchedule.bread}
            editMode={editMode}
            onUpdateQuantity={(itemIndex, newQuantity) =>
              onUpdateBakingQuantity('bread', itemIndex, newQuantity)
            }
            quantityUnit=""
            maxQuantity={20}
            isDecimal={true}
          />
        </Grid>
      </Grid>
    </Box>
  )
}

interface BakingCategoryCardProps {
  title: string
  icon: React.ReactNode
  items: BakingItem[]
  editMode: boolean
  onUpdateQuantity: (itemIndex: number, newQuantity: number) => void
  quantityUnit: string
  maxQuantity: number
  isDecimal?: boolean
}

const BakingCategoryCard: React.FC<BakingCategoryCardProps> = ({
  title,
  icon,
  items,
  editMode,
  onUpdateQuantity,
  quantityUnit,
  maxQuantity,
  isDecimal = false,
}) => {
  const handleQuantityChange = (index: number, value: string) => {
    const newQuantity = isDecimal ? parseFloat(value) || 0 : parseInt(value) || 0
    onUpdateQuantity(index, newQuantity)
  }

  return (
    <Card sx={{ boxShadow: 3 }}>
      <CardHeader
        title={title}
        avatar={icon}
        titleTypographyProps={{
          variant: 'h6',
          color: 'primary.main',
        }}
        sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}
      />
      <CardContent>
        <List>
          {items.map((item, index) => (
            <ListItem
              key={index}
              sx={{
                borderRadius: 1,
                mb: 1,
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body1" fontWeight={600}>
                    {item.name}
                  </Typography>
                }
                secondary={item.note}
              />
              <ListItemSecondaryAction>
                {editMode ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <TextField
                      size="small"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      sx={{ width: 80 }}
                      type="number"
                      inputProps={{ 
                        min: 0, 
                        max: maxQuantity,
                        step: isDecimal ? "0.1" : "1"
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {item.unit || quantityUnit}
                    </Typography>
                  </Box>
                ) : (
                  <Chip
                    label={`${item.quantity} ${item.unit || quantityUnit}`}
                    color="primary"
                    variant="filled"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  )
}

export default BakingScheduleView