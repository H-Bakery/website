'use client'
import React from 'react'
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material'
import { useRouter } from 'next/navigation'
import PeopleIcon from '@mui/icons-material/People'
import SettingsIcon from '@mui/icons-material/Settings'
import DashboardIcon from '@mui/icons-material/Dashboard'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { useTheme } from '../../context/ThemeContext'

export default function AdminPage() {
  const router = useRouter()
  const { mode } = useTheme()

  // Quick access modules
  const adminModules = [
    {
      title: 'Mitarbeiterverwaltung',
      description: 'Verwalten Sie Personal, Schichtpläne und Berechtigungen',
      icon: <PeopleIcon fontSize="large" />,
      path: '/admin/staff',
    },
    {
      title: 'Systemeinstellungen',
      description: 'Konfigurieren Sie Systemeinstellungen und Darstellung',
      icon: <SettingsIcon fontSize="large" />,
      path: '/admin/settings',
    },
    {
      title: 'Dashboard',
      description: 'Übersicht über Kennzahlen und aktuelle Statistiken',
      icon: <DashboardIcon fontSize="large" />,
      path: '/dashboard/management',
    },
  ]

  // Recent notifications
  const notifications = [
    {
      id: 1,
      message: 'Lisa Wagner hat sich für den morgigen Tag krank gemeldet',
      time: '14:35 Uhr',
      date: 'Heute',
    },
    {
      id: 2,
      message: 'Neue Bestellung #4528 wurde aufgegeben',
      time: '09:15 Uhr',
      date: 'Heute',
    },
    {
      id: 3,
      message: 'Systemupdate erfolgreich abgeschlossen',
      time: '23:00 Uhr',
      date: 'Gestern',
    },
  ]

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 3 }}>
        Administrationsbereich
      </Typography>

      <Grid container spacing={3}>
        {/* Quick Access Cards */}
        {adminModules.map((module) => (
          <Grid item xs={12} md={4} key={module.title}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                bgcolor: mode === 'dark' ? 'background.paper' : 'white',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: mode === 'dark' ? '0 8px 16px rgba(0,0,0,0.4)' : '0 8px 16px rgba(0,0,0,0.1)',
                },
              }}
              elevation={mode === 'dark' ? 2 : 1}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    mb: 2,
                    color: 'primary.main',
                  }}
                >
                  {module.icon}
                </Box>
                <Typography variant="h6" component="h3" align="center" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center">
                  {module.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  fullWidth 
                  onClick={() => router.push(module.path)}
                  sx={{
                    textTransform: 'none',
                  }}
                >
                  Öffnen
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}

        {/* Notifications Card */}
        <Grid item xs={12}>
          <Card 
            sx={{ 
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
              mt: 2 
            }}
            elevation={mode === 'dark' ? 2 : 1}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <NotificationsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" component="h3">
                  Aktuelle Benachrichtigungen
                </Typography>
              </Box>
              <List>
                {notifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={notification.message}
                        secondary={
                          <React.Fragment>
                            <Typography
                              sx={{ display: 'inline' }}
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {notification.date} - {notification.time}
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    {index < notifications.length - 1 && (
                      <Divider variant="inset" component="li" />
                    )}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                sx={{ ml: 1, mb: 1 }}
              >
                Alle anzeigen
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}