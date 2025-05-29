'use client'
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Button,
  useMediaQuery,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import NotificationsIcon from '@mui/icons-material/Notifications'
import LanguageIcon from '@mui/icons-material/Language'
import SecurityIcon from '@mui/icons-material/Security'
import PaletteIcon from '@mui/icons-material/Palette'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { useTheme } from '../../../context/ThemeContext'

export default function SettingsPage() {
  const { mode, toggleTheme, setMode } = useTheme()
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('md'))
  const [notifications, setNotifications] = useState(true)
  const [language, setLanguage] = useState('de')
  const [timeFormat, setTimeFormat] = useState('24')

  const handleLanguageChange = (event: any) => {
    setLanguage(event.target.value)
  }

  const handleTimeFormatChange = (event: any) => {
    setTimeFormat(event.target.value)
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 3 }}>
        Systemeinstellungen
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card 
            elevation={mode === 'dark' ? 2 : 1}
            sx={{ 
              height: '100%', 
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                Darstellung
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <DarkModeIcon color={mode === 'dark' ? 'primary' : 'inherit'} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Dunkles Design" 
                    secondary="Reduziert Augenmüdigkeit bei schlechten Lichtverhältnissen" 
                  />
                  <Switch
                    edge="end"
                    checked={mode === 'dark'}
                    onChange={toggleTheme}
                    inputProps={{
                      'aria-labelledby': 'switch-dark-mode',
                    }}
                  />
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon>
                    <PaletteIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Farbschemata" 
                    secondary="Wählen Sie das Farbschema für Ihre Oberfläche" 
                  />
                  <Box sx={{ minWidth: 120 }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value="default"
                        disabled
                      >
                        <MenuItem value="default">Standard</MenuItem>
                        <MenuItem value="bakery">Bäckerei</MenuItem>
                        <MenuItem value="pastry">Konditorei</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            elevation={mode === 'dark' ? 2 : 1}
            sx={{ 
              height: '100%', 
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                Benachrichtigungen
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Benachrichtigungen aktivieren" 
                    secondary="Benachrichtigungen über neue Bestellungen und Updates" 
                  />
                  <Switch
                    edge="end"
                    checked={notifications}
                    onChange={() => setNotifications(!notifications)}
                    inputProps={{
                      'aria-labelledby': 'switch-notifications',
                    }}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            elevation={mode === 'dark' ? 2 : 1}
            sx={{ 
              height: '100%', 
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                Lokalisierung
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <LanguageIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Sprache" 
                    secondary="Wählen Sie Ihre bevorzugte Sprache"
                  />
                  <Box sx={{ minWidth: 120 }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={language}
                        onChange={handleLanguageChange}
                      >
                        <MenuItem value="de">Deutsch</MenuItem>
                        <MenuItem value="en">English</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </ListItem>
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemIcon>
                    <AccessTimeIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Zeitformat" 
                    secondary="Wählen Sie Ihr bevorzugtes Zeitformat"
                  />
                  <Box sx={{ minWidth: 120 }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={timeFormat}
                        onChange={handleTimeFormatChange}
                      >
                        <MenuItem value="24">24-Stunden (14:30)</MenuItem>
                        <MenuItem value="12">12-Stunden (2:30 PM)</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card 
            elevation={mode === 'dark' ? 2 : 1}
            sx={{ 
              height: '100%', 
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                Sicherheit
              </Typography>
              <List disablePadding>
                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Passwort ändern" 
                    secondary="Ändern Sie Ihr Passwort regelmäßig für mehr Sicherheit" 
                  />
                  <Button 
                    variant="outlined" 
                    size="small"
                  >
                    Ändern
                  </Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="outlined" sx={{ mr: 2 }}>
              Abbrechen
            </Button>
            <Button variant="contained" color="primary">
              Einstellungen speichern
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}