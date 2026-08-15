'use client'
import React from 'react'
import {
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Typography,
  Chip,
  Box,
  Alert,
  Button,
  IconButton,
} from '@mui/material'
import { Assignment, Add, Delete, Print } from '@mui/icons-material'
import { AdditionalProductionItem } from '../../types/prepTask'

interface AdditionalProductionViewProps {
  additionalProduction: AdditionalProductionItem[]
  onPrintBakersPlan: () => void
}

const AdditionalProductionView: React.FC<AdditionalProductionViewProps> = ({
  additionalProduction,
  onPrintBakersPlan,
}) => {
  const getUrgencyLabel = (urgency?: string) => {
    switch (urgency) {
      case 'high':
        return 'Hoch'
      case 'critical':
        return 'Kritisch'
      case 'medium':
        return 'Mittel'
      case 'low':
        return 'Niedrig'
      default:
        return 'Normal'
    }
  }

  const getUrgencyColor = (
    urgency?: string
  ): 'error' | 'warning' | 'default' => {
    switch (urgency) {
      case 'high':
      case 'critical':
        return 'error'
      case 'medium':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getReasonText = (reason?: string) => {
    switch (reason) {
      case 'empty_stock':
        return 'Bestand leer'
      case 'low_stock':
        return 'Bestand niedrig'
      case 'special_order':
        return 'Sonderbestellung'
      case 'weekend_prep':
        return 'Wochenendvorbereitung'
      default:
        return 'Sonstiges'
    }
  }

  return (
    <Card>
      <CardHeader
        title="Zusätzliche Nachtproduktion"
        avatar={<Assignment />}
        action={
          <Button variant="contained" startIcon={<Add />}>
            Hinzufügen
          </Button>
        }
      />
      <CardContent>
        {!additionalProduction || additionalProduction.length === 0 ? (
          <Alert severity="info">
            Noch keine zusätzlichen Produktionsaufträge. Klicken Sie auf
            "Hinzufügen" wenn Artikel nachproduziert werden müssen.
          </Alert>
        ) : (
          <List>
            {additionalProduction
              .filter((item) => item)
              .map((item, index) => (
                <ListItem
                  key={index}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor:
                      item.urgency === 'high' || item.urgency === 'critical'
                        ? 'error.light'
                        : 'background.paper',
                  }}
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Typography variant="subtitle1">
                          {item?.name || 'Unbekannt'}
                        </Typography>
                        <Chip
                          size="small"
                          label={getUrgencyLabel(item?.urgency)}
                          color={getUrgencyColor(item?.urgency)}
                        />
                      </Box>
                    }
                    secondary={`Grund: ${getReasonText(
                      item?.reason
                    )} | Angefordert von: ${
                      item?.requested_by || 'System'
                    } um ${item?.requested_at || 'Unbekannt'}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" color="error" size="small">
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
          </List>
        )}

        {additionalProduction.length > 0 && (
          <>
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                📋 Hinweise für die Nachtschicht:
              </Typography>
              <Typography variant="body2">
                • Diese Artikel sind zusätzlich zur normalen Produktion
                herzustellen • Priorisieren Sie Artikel mit hoher Dringlichkeit
                (rot markiert) • Lagern Sie fertige Artikel entsprechend der
                Standard-Lagerrichtlinien
              </Typography>
            </Alert>

            <Card
              variant="outlined"
              sx={{
                mt: 2,
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
              }}
            >
              <CardHeader
                title="🖨️ Zusammenfassung für Backplan"
                action={
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Print />}
                    onClick={onPrintBakersPlan}
                  >
                    Drucken
                  </Button>
                }
              />
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Zusätzliche Produktion benötigt:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {additionalProduction
                    .filter((item) => item)
                    .map((item, index) => (
                      <Chip
                        key={index}
                        label={item?.name || 'Unbekannt'}
                        color={getUrgencyColor(item?.urgency)}
                        size="small"
                        variant="filled"
                      />
                    ))}
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default AdditionalProductionView
