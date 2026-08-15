'use client'
import React from 'react'
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
  Card,
  CardContent,
  Grid,
  Button,
  Tooltip,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LanguageIcon from '@mui/icons-material/Language'
import SecurityIcon from '@mui/icons-material/Security'
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto'
import { useTheme, ThemeMode } from '@bakery/shared/contexts'
import { NotificationPreferences } from '@bakery/management/feature-settings'

export default function SettingsPage() {
  const { mode, setMode, colorScheme } = useTheme()

  const handleModeChange = (next: ThemeMode) => setMode(next)

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Einstellungen
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                Darstellung
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <DarkModeIcon
                      color={colorScheme === 'dark' ? 'primary' : 'inherit'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id="setting-dark-mode"
                    primary="Dunkles Design"
                    secondary="Reduziert Augenmüdigkeit bei schlechten Lichtverhältnissen"
                  />
                  <Switch
                    edge="end"
                    checked={mode === 'dark'}
                    onChange={(e) =>
                      handleModeChange(e.target.checked ? 'dark' : 'light')
                    }
                    inputProps={{ 'aria-labelledby': 'setting-dark-mode' }}
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon>
                    <BrightnessAutoIcon />
                  </ListItemIcon>
                  <ListItemText
                    id="setting-system-mode"
                    primary="Systemeinstellung folgen"
                    secondary="Hell/Dunkel automatisch vom Betriebssystem übernehmen"
                  />
                  <Switch
                    edge="end"
                    checked={mode === 'system'}
                    onChange={(e) =>
                      handleModeChange(e.target.checked ? 'system' : 'light')
                    }
                    inputProps={{ 'aria-labelledby': 'setting-system-mode' }}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                Lokalisierung
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <LanguageIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sprache"
                    secondary="Die Verwaltung ist derzeit nur auf Deutsch verfügbar"
                  />
                  <Box sx={{ minWidth: 120 }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value="de"
                        disabled
                        inputProps={{ 'aria-label': 'Sprache' }}
                      >
                        <MenuItem value="de">Deutsch</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                Benachrichtigungen
              </Typography>
              <NotificationPreferences />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                E-Mail-Versand
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Die Konfiguration des E-Mail-Versands (SMTP) ist noch nicht an
                die API angebunden.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography
                variant="h6"
                component="h2"
                sx={{ mb: 2, fontWeight: 'bold' }}
              >
                Sicherheit
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Passwort ändern"
                    secondary="Verfügbar, sobald die Benutzeranmeldung aktiviert ist"
                  />
                  <Tooltip title="Benutzeranmeldung ist noch nicht aktiviert">
                    <span>
                      <Button variant="outlined" size="small" disabled>
                        Ändern
                      </Button>
                    </span>
                  </Tooltip>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
