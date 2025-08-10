'use client'
import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
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
  TextField,
  Card,
  CardContent,
  Grid,
  Checkbox,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material'
import {
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  Archive as ArchiveIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import { bakeryAPI } from '@bakery/shared/data-access'
import type { Notification } from '@bakery/shared/types'

// Extended types for archive functionality
interface ArchiveResult {
  notifications: Notification[]
  total: number
  hasMore: boolean
}

interface ArchiveStats {
  total: number
  read: number
  unread: number
  byPriority: Record<string, number>
  byCategory: Record<string, number>
}

const NotificationArchivePage: React.FC = () => {
  const [archivedNotifications, setArchivedNotifications] = useState<
    Notification[]
  >([])
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<
    string | null
  >(null)

  // Load archived notifications
  const loadArchivedNotifications = useCallback(async () => {
    try {
      setLoading(true)

      const options = {
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      }

      const result: ArchiveResult = await bakeryAPI.getArchivedNotifications(
        options
      )
      setArchivedNotifications(result.notifications)
    } catch (error) {
      console.error('Error loading archived notifications:', error)
      setErrorMessage('Fehler beim Laden der archivierten Benachrichtigungen')
      // Fallback to empty array
      setArchivedNotifications([])
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, priorityFilter])

  // Load archive statistics
  const loadArchiveStats = useCallback(async () => {
    try {
      const stats: ArchiveStats = await bakeryAPI.getArchiveStats()
      setArchiveStats(stats)
    } catch (error) {
      console.error('Error loading archive stats:', error)
      // Use default stats
      setArchiveStats({
        total: 0,
        read: 0,
        unread: 0,
        byPriority: {},
        byCategory: {},
      })
    }
  }, [])

  // Restore notification
  const handleRestore = async (id: string) => {
    try {
      await bakeryAPI.restoreNotification(id)
      setSuccessMessage('Benachrichtigung wiederhergestellt')
      loadArchivedNotifications()
      loadArchiveStats()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Wiederherstellen')
    }
  }

  // Permanent delete notification
  const handlePermanentDelete = async (id: string) => {
    try {
      await bakeryAPI.permanentDeleteNotification(id)
      setSuccessMessage('Benachrichtigung endgültig gelöscht')
      setDeleteConfirmOpen(false)
      setNotificationToDelete(null)
      loadArchivedNotifications()
      loadArchiveStats()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Löschen')
    }
  }

  // Initialize data
  useEffect(() => {
    loadArchivedNotifications()
    loadArchiveStats()
  }, [loadArchivedNotifications, loadArchiveStats])

  // Auto-dismiss messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

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

  // Filter notifications based on search
  const filteredNotifications = archivedNotifications.filter((n) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      n.title.toLowerCase().includes(query) ||
      n.message.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Benachrichtigungs-Archiv
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Verwalten und durchsuchen Sie archivierte Benachrichtigungen
      </Typography>

      {/* Messages */}
      {successMessage && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}
      {errorMessage && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setErrorMessage(null)}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Archive Statistics */}
      {archiveStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Archiviert
                </Typography>
                <Typography variant="h4">{archiveStats.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Gelesen
                </Typography>
                <Typography variant="h4" color="success.main">
                  {archiveStats.read}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Ungelesen
                </Typography>
                <Typography variant="h4" color="info.main">
                  {archiveStats.unread}
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
                  {archiveStats.byPriority.urgent || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ width: '100%' }}>
        {/* Search and Filters */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Suchen"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
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
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
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
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <ArchiveIcon
              sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
            />
            <Typography color="text.secondary">
              Keine archivierten Benachrichtigungen gefunden
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 2 }}>
            {filteredNotifications.map((notification) => (
              <ListItem
                key={notification.id}
                sx={{
                  backgroundColor: 'action.hover',
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
                      <Chip label="Archiviert" size="small" color="secondary" />
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
                      aria-label="wiederherstellen"
                      onClick={() => handleRestore(notification.id)}
                      color="primary"
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="endgültig löschen"
                      onClick={() => {
                        setNotificationToDelete(notification.id)
                        setDeleteConfirmOpen(true)
                      }}
                      color="error"
                    >
                      <DeleteForeverIcon />
                    </IconButton>
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Benachrichtigung endgültig löschen?</DialogTitle>
        <DialogContent>
          <Typography>
            Diese Aktion kann nicht rückgängig gemacht werden. Die
            Benachrichtigung wird dauerhaft gelöscht.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Abbrechen</Button>
          <Button
            onClick={() =>
              notificationToDelete &&
              handlePermanentDelete(notificationToDelete)
            }
            color="error"
            variant="contained"
          >
            Endgültig löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default NotificationArchivePage
