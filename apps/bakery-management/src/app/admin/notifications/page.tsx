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
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
  Card,
  CardContent,
  Grid,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MarkEmailRead as MarkAllReadIcon,
  Archive as ArchiveIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { useNotifications } from '@bakery/shared/contexts'
import type { NotificationContextType } from '@bakery/shared/contexts'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import Link from 'next/link'
import { notificationArchiveService } from '../../../services/notificationArchiveService'

/** Notification as provided by the context (dates may be serialised) */
type Notification = NotificationContextType['notifications'][number]

const PRIORITY_LABELS: Record<Notification['priority'], string> = {
  urgent: 'Dringend',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
}

const CATEGORY_LABELS: Record<string, string> = {
  staff: 'Personal',
  order: 'Bestellung',
  system: 'System',
  inventory: 'Lager',
  customer: 'Kunde',
  general: 'Allgemein',
}

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
    refresh,
  } = useNotifications()

  const [tabValue, setTabValue] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id)
      showSuccess('Benachrichtigung gelöscht')
    } catch {
      setErrorMessage('Fehler beim Löschen der Benachrichtigung')
    }
  }

  const handleArchive = async (notification: Notification) => {
    try {
      await notificationArchiveService.archive(notification)
      showSuccess('Benachrichtigung archiviert')
      await refresh()
    } catch {
      setErrorMessage('Fehler beim Archivieren der Benachrichtigung')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead()
      showSuccess('Alle Benachrichtigungen als gelesen markiert')
    } catch {
      setErrorMessage('Fehler beim Markieren der Benachrichtigungen')
    }
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
      default:
        return <InfoIcon color="info" />
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

  const getCategoryLabel = (category: Notification['category']) =>
    CATEGORY_LABELS[category] ?? category

  // Apply filters locally
  const filteredNotifications = notifications.filter((n: Notification) => {
    if (tabValue === 1 && n.read) return false
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false
    return true
  })

  const renderNotification = (notification: Notification) => (
    <ListItem
      key={notification.id}
      disablePadding
      sx={{
        mb: 1,
        borderRadius: 1,
        backgroundColor: notification.read ? 'transparent' : 'action.hover',
      }}
      secondaryAction={
        <Stack direction="row" spacing={0.5}>
          <IconButton
            edge="end"
            aria-label="Archivieren"
            title="Archivieren"
            onClick={() => handleArchive(notification)}
            color="primary"
          >
            <ArchiveIcon />
          </IconButton>
          <IconButton
            edge="end"
            aria-label="Löschen"
            title="Löschen"
            onClick={() => handleDelete(notification.id)}
          >
            <DeleteIcon />
          </IconButton>
        </Stack>
      }
    >
      <ListItemButton
        onClick={() => handleMarkAsRead(notification)}
        sx={{ borderRadius: 1, pr: 12 }}
        aria-label={
          notification.read
            ? notification.title
            : `${notification.title} (ungelesen) – als gelesen markieren`
        }
      >
        <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
        <ListItemText
          primaryTypographyProps={{ component: 'span' }}
          secondaryTypographyProps={{ component: 'span' }}
          primary={
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
              <Typography
                variant="subtitle1"
                component="span"
                fontWeight={notification.read ? 'normal' : 'bold'}
              >
                {notification.title}
              </Typography>
              <Chip
                label={getCategoryLabel(notification.category)}
                size="small"
                variant="outlined"
              />
              {notification.priority !== 'low' && (
                <Chip
                  label={PRIORITY_LABELS[notification.priority]}
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
      </ListItemButton>
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
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={1}
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
        <Button
          component={Link}
          href="/admin/notifications/archive"
          variant="outlined"
          startIcon={<HistoryIcon />}
          sx={{ mt: 1 }}
        >
          Archiv anzeigen
        </Button>
      </Stack>

      {errorMessage && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

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
              {filteredNotifications.map(renderNotification)}
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
              {filteredNotifications.map(renderNotification)}
            </List>
          )}
        </TabPanel>
      </Paper>
    </Box>
  )
}

export default NotificationsPage
