'use client'
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  FilterList as FilterIcon,
  MarkEmailRead as MarkAllReadIcon,
  Archive as ArchiveIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { useNotifications } from '@bakery/shared/contexts'
import { Notification } from '@bakery/shared/types'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { bakeryAPI } from '@bakery/shared/data-access'
import Link from 'next/link'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const NotificationsPage: React.FC = () => {
  const {
    notifications,
    unreadCount,
    stats,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  const [tabValue, setTabValue] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteNotification(id)
    setSuccessMessage('Benachrichtigung gelöscht')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleArchive = async (id: string) => {
    try {
      await bakeryAPI.archiveNotification(id)
      setSuccessMessage('Benachrichtigung archiviert')
      setTimeout(() => setSuccessMessage(null), 3000)
      // Refresh notifications to remove archived one from list
      window.location.reload()
    } catch (error: any) {
      setSuccessMessage('Fehler beim Archivieren der Benachrichtigung')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setSuccessMessage('Alle Benachrichtigungen als gelesen markiert')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <InfoIcon color="info" />
      case 'success':
        return <SuccessIcon color="success" />
      case 'warning':
        return <WarningIcon color="warning" />
      case 'error':
        return <ErrorIcon color="error" />
    }
  }

  const getPriorityColor = (
    priority: Notification['priority']
  ): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'urgent':
        return 'error'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'default'
    }
  }

  const getCategoryLabel = (category: Notification['category']) => {
    switch (category) {
      case 'staff':
        return 'Personal'
      case 'order':
        return 'Bestellung'
      case 'system':
        return 'System'
      case 'inventory':
        return 'Lager'
      case 'customer':
        return 'Kunde'
      default:
        return category
    }
  }

  // Apply filters locally
  const filteredNotifications = notifications.filter((n: Notification) => {
    if (tabValue === 1 && n.read) return false
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false
    return true
  })

  const NotificationListItem: React.FC<{ notification: Notification }> = ({
    notification,
  }) => (
    <ListItem
      button
      onClick={() => handleMarkAsRead(notification)}
      sx={{
        backgroundColor: notification.read ? 'transparent' : 'action.hover',
        '&:hover': {
          backgroundColor: 'action.selected',
        },
        mb: 1,
        borderRadius: 1,
      }}
    >
      <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" component="span">
              {notification.title}
            </Typography>
            <Chip
              label={getCategoryLabel(notification.category)}
              size="small"
              variant="outlined"
            />
            {notification.priority !== 'low' && (
              <Chip
                label={notification.priority}
                size="small"
                color={getPriorityColor(notification.priority)}
              />
            )}
          </Stack>
        }
        secondary={
          <>
            <Typography
              component="span"
              variant="body2"
              color="text.primary"
              sx={{ display: 'block' }}
            >
              {notification.message}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
            >
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
                locale: de,
              })}
            </Typography>
          </>
        }
      />
      <ListItemSecondaryAction>
        <Stack direction="row" spacing={1}>
          <IconButton
            edge="end"
            aria-label="archivieren"
            onClick={(e) => {
              e.stopPropagation()
              handleArchive(notification.id)
            }}
            color="primary"
          >
            <ArchiveIcon />
          </IconButton>
          <IconButton
            edge="end"
            aria-label="löschen"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(notification.id)
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Stack>
      </ListItemSecondaryAction>
    </ListItem>
  )

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Benachrichtigungen
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Verwalten Sie alle Ihre Benachrichtigungen an einem Ort
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Link href="/admin/notifications/archive" passHref>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              sx={{ mt: 1 }}
            >
              Archiv anzeigen
            </Button>
          </Link>
          <Link href="/admin/notifications/archival" passHref>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              sx={{ mt: 1 }}
            >
              Archivierung verwalten
            </Button>
          </Link>
        </Stack>
      </Stack>

      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Gesamt
                </Typography>
                <Typography variant="h4">{stats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Ungelesen
                </Typography>
                <Typography variant="h4" color="primary">
                  {stats.unread}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Dringend
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.byPriority.urgent || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Hoch
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats.byPriority.high || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="Alle" />
              <Tab label={`Ungelesen (${unreadCount})`} />
            </Tabs>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Kategorie</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Kategorie"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="staff">Personal</MenuItem>
                  <MenuItem value="order">Bestellung</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="inventory">Lager</MenuItem>
                  <MenuItem value="customer">Kunde</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Priorität</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Priorität"
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="urgent">Dringend</MenuItem>
                  <MenuItem value="high">Hoch</MenuItem>
                  <MenuItem value="medium">Mittel</MenuItem>
                  <MenuItem value="low">Niedrig</MenuItem>
                </Select>
              </FormControl>
              {unreadCount > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<MarkAllReadIcon />}
                  onClick={handleMarkAllRead}
                >
                  Alle gelesen
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Keine Benachrichtigungen gefunden
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 2 }}>
              {filteredNotifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Keine ungelesenen Benachrichtigungen
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 2 }}>
              {filteredNotifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </List>
          )}
        </TabPanel>
      </Paper>
    </Box>
  )
}

export default NotificationsPage
