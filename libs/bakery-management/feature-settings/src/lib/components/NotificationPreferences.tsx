'use client'
import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Alert,
  Button,
  TextField,
  Collapse,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import EmailIcon from '@mui/icons-material/Email'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import CategoryIcon from '@mui/icons-material/Category'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import NightsStayIcon from '@mui/icons-material/NightsStay'
import { useNotifications } from '@bakery/shared/contexts'
import {
  NotificationPreferences as PrefsType,
  PriorityThreshold,
} from '../types/notificationPreferences'

export default function NotificationPreferences() {
  const { preferences, updatePreferences, resetPreferences } =
    useNotifications()
  const [localPrefs, setLocalPrefs] = useState<PrefsType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [expandCategories, setExpandCategories] = useState(false)

  useEffect(() => {
    if (preferences) {
      // Map from shared context preferences to local PrefsType
      const mappedPrefs: PrefsType = {
        emailEnabled: preferences.channels?.email?.enabled || false,
        browserEnabled: preferences.channels?.inApp?.enabled || false,
        soundEnabled: preferences.sound?.enabled || false,
        categoryPreferences: {
          staff:
            preferences.channels?.inApp?.categories?.includes('staff' as any) ||
            false,
          order:
            preferences.channels?.inApp?.categories?.includes('order' as any) ||
            false,
          system:
            preferences.channels?.inApp?.categories?.includes(
              'system' as any
            ) || false,
          inventory:
            preferences.channels?.inApp?.categories?.includes(
              'inventory' as any
            ) || false,
          general: true,
        },
        priorityThreshold: (preferences.channels?.inApp?.minPriority ||
          'medium') as PriorityThreshold,
        quietHours: {
          enabled: preferences.quietHours?.enabled || false,
          start: preferences.quietHours?.start || '22:00',
          end: preferences.quietHours?.end || '08:00',
        },
      }
      setLocalPrefs(mappedPrefs)
    }
  }, [preferences])

  const handleChange = (field: keyof PrefsType, value: any) => {
    if (!localPrefs) return
    setLocalPrefs({
      ...localPrefs,
      [field]: value,
    })
  }

  const handleCategoryChange = (category: string, enabled: boolean) => {
    if (!localPrefs) return
    setLocalPrefs({
      ...localPrefs,
      categoryPreferences: {
        ...localPrefs.categoryPreferences,
        [category]: enabled,
      },
    })
  }

  const handleQuietHoursChange = (field: string, value: any) => {
    if (!localPrefs) return
    setLocalPrefs({
      ...localPrefs,
      quietHours: {
        ...localPrefs.quietHours,
        [field]: value,
      },
    })
  }

  const handleSave = async () => {
    if (!localPrefs) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Map local preferences back to shared context format
      const categories = Object.entries(localPrefs.categoryPreferences)
        .filter(([_, enabled]) => enabled)
        .map(([category]) => category as any)

      await updatePreferences({
        channels: {
          email: {
            enabled: localPrefs.emailEnabled,
            categories: categories,
            minPriority: localPrefs.priorityThreshold,
          },
          inApp: {
            enabled: localPrefs.browserEnabled,
            categories: categories,
            minPriority: localPrefs.priorityThreshold,
          },
          sms: {
            enabled: false,
            categories: [],
            minPriority: 'high',
          },
          push: {
            enabled: false,
            categories: [],
            minPriority: 'high',
          },
        },
        sound: {
          enabled: localPrefs.soundEnabled,
          volume: 100,
        },
        quietHours: localPrefs.quietHours.enabled
          ? {
              enabled: true,
              start: localPrefs.quietHours.start,
              end: localPrefs.quietHours.end,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : undefined,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Fehler beim Speichern der Einstellungen')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    setError(null)

    try {
      await resetPreferences()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Fehler beim Zurücksetzen der Einstellungen')
    } finally {
      setLoading(false)
    }
  }

  if (!localPrefs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  const priorityColors: Record<
    PriorityThreshold,
    'default' | 'warning' | 'error' | 'success'
  > = {
    low: 'success',
    medium: 'default',
    high: 'warning',
    urgent: 'error',
  }

  const categoryLabels: Record<string, string> = {
    staff: 'Mitarbeiter',
    order: 'Bestellungen',
    system: 'System',
    inventory: 'Lager',
    general: 'Allgemein',
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Einstellungen erfolgreich gespeichert
        </Alert>
      )}

      <List disablePadding>
        {/* Browser Notifications */}
        <ListItem>
          <ListItemIcon>
            <NotificationsIcon />
          </ListItemIcon>
          <ListItemText
            primary="Browser-Benachrichtigungen"
            secondary="Push-Benachrichtigungen im Browser anzeigen"
          />
          <Switch
            edge="end"
            checked={localPrefs.browserEnabled}
            onChange={(e) => handleChange('browserEnabled', e.target.checked)}
          />
        </ListItem>

        <Divider variant="inset" component="li" />

        {/* Email Notifications */}
        <ListItem>
          <ListItemIcon>
            <EmailIcon />
          </ListItemIcon>
          <ListItemText
            primary="E-Mail-Benachrichtigungen"
            secondary="Wichtige Benachrichtigungen per E-Mail erhalten"
          />
          <Switch
            edge="end"
            checked={localPrefs.emailEnabled}
            onChange={(e) => handleChange('emailEnabled', e.target.checked)}
          />
        </ListItem>

        <Divider variant="inset" component="li" />

        {/* Sound */}
        <ListItem>
          <ListItemIcon>
            <VolumeUpIcon />
          </ListItemIcon>
          <ListItemText
            primary="Benachrichtigungston"
            secondary="Ton bei neuen Benachrichtigungen abspielen"
          />
          <Switch
            edge="end"
            checked={localPrefs.soundEnabled}
            onChange={(e) => handleChange('soundEnabled', e.target.checked)}
          />
        </ListItem>

        <Divider variant="inset" component="li" />

        {/* Priority Threshold */}
        <ListItem>
          <ListItemIcon>
            <PriorityHighIcon />
          </ListItemIcon>
          <ListItemText
            primary="Prioritätsschwelle"
            secondary="Nur Benachrichtigungen mit dieser oder höherer Priorität anzeigen"
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={localPrefs.priorityThreshold}
              onChange={(e) =>
                handleChange('priorityThreshold', e.target.value)
              }
            >
              <MenuItem value="low">
                <Chip label="Niedrig" size="small" color="success" />
              </MenuItem>
              <MenuItem value="medium">
                <Chip label="Mittel" size="small" />
              </MenuItem>
              <MenuItem value="high">
                <Chip label="Hoch" size="small" color="warning" />
              </MenuItem>
              <MenuItem value="urgent">
                <Chip label="Dringend" size="small" color="error" />
              </MenuItem>
            </Select>
          </FormControl>
        </ListItem>

        <Divider variant="inset" component="li" />

        {/* Categories */}
        <ListItem>
          <ListItemIcon>
            <CategoryIcon />
          </ListItemIcon>
          <ListItemText
            primary="Kategorien"
            secondaryTypographyProps={{ component: 'div' }}
            secondary={
              <Box>
                <Typography variant="caption" display="block">
                  Wählen Sie, welche Kategorien Sie erhalten möchten
                </Typography>
                <Button
                  size="small"
                  onClick={() => setExpandCategories(!expandCategories)}
                  sx={{ mt: 1 }}
                >
                  {expandCategories ? 'Ausblenden' : 'Anzeigen'}
                </Button>
              </Box>
            }
          />
        </ListItem>

        <Collapse in={expandCategories}>
          <Box sx={{ pl: 9, pr: 3, pb: 2 }}>
            <FormGroup>
              {Object.entries(localPrefs.categoryPreferences).map(
                ([category, enabled]) => (
                  <FormControlLabel
                    key={category}
                    control={
                      <Checkbox
                        checked={enabled}
                        onChange={(e) =>
                          handleCategoryChange(category, e.target.checked)
                        }
                        size="small"
                      />
                    }
                    label={categoryLabels[category] || category}
                  />
                )
              )}
            </FormGroup>
          </Box>
        </Collapse>

        <Divider variant="inset" component="li" />

        {/* Quiet Hours */}
        <ListItem>
          <ListItemIcon>
            <NightsStayIcon />
          </ListItemIcon>
          <ListItemText
            primary="Ruhezeiten"
            secondary="Keine Benachrichtigungen während dieser Zeiten"
          />
          <Switch
            edge="end"
            checked={localPrefs.quietHours.enabled}
            onChange={(e) =>
              handleQuietHoursChange('enabled', e.target.checked)
            }
          />
        </ListItem>

        {localPrefs.quietHours.enabled && (
          <Box sx={{ pl: 9, pr: 3, pb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Von"
                type="time"
                size="small"
                value={localPrefs.quietHours.start}
                onChange={(e) =>
                  handleQuietHoursChange('start', e.target.value)
                }
                InputLabelProps={{ shrink: true }}
              />
              <Typography>bis</Typography>
              <TextField
                label="Bis"
                type="time"
                size="small"
                value={localPrefs.quietHours.end}
                onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Box>
        )}
      </List>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button variant="outlined" onClick={handleReset} disabled={loading}>
          Zurücksetzen
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Speichern'}
        </Button>
      </Box>
    </Box>
  )
}
