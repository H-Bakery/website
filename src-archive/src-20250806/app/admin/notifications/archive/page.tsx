'use client'
import React, { useState, useEffect, useCallback } from 'react'
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
  TextField,
  Card,
  CardContent,
  Grid,
  Checkbox,
  Fab,
  Pagination,
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
  FilterList as FilterIcon,
  Archive as ArchiveIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material'
import { formatDistanceToNow, format } from 'date-fns'
import { de } from 'date-fns/locale'
import bakeryAPI from '../../../../services/bakeryAPI'
import type {
  Notification,
  ArchiveResult,
  ArchiveStats,
} from '../../../../types/notification'

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
      id={`archive-tabpanel-${index}`}
      aria-labelledby={`archive-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const NotificationArchivePage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0)
  const [archivedNotifications, setArchivedNotifications] = useState<
    Notification[]
  >([])
  const [searchResults, setSearchResults] = useState<Notification[]>([])
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters and search
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  })

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const itemsPerPage = 20

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<
    number | null
  >(null)

  // Load archived notifications
  const loadArchivedNotifications = useCallback(
    async (resetPage = false) => {
      try {
        setLoading(true)
        const currentPage = resetPage ? 1 : page

        const options = {
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }

        const result: ArchiveResult = await bakeryAPI.getArchivedNotifications(
          options
        )

        if (resetPage) {
          setArchivedNotifications(result.notifications)
          setPage(1)
        } else {
          setArchivedNotifications(result.notifications)
        }

        setTotalPages(Math.ceil(result.total / itemsPerPage))
        setHasMore(result.hasMore)
      } catch (error) {
        console.error('Error loading archived notifications:', error)
        setErrorMessage('Fehler beim Laden der archivierten Benachrichtigungen')
      } finally {
        setLoading(false)
      }
    },
    [page, categoryFilter, priorityFilter, dateRange, itemsPerPage]
  )

  // Load archive statistics
  const loadArchiveStats = useCallback(async () => {
    try {
      const stats: ArchiveStats = await bakeryAPI.getArchiveStats()
      setArchiveStats(stats)
    } catch (error) {
      console.error('Error loading archive stats:', error)
    }
  }, [])

  // Search notifications
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      const options = {
        limit: 50,
        offset: 0,
        includeArchived,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      }

      const result: ArchiveResult = await bakeryAPI.searchNotifications(
        searchQuery,
        options
      )
      setSearchResults(result.notifications)
    } catch (error) {
      console.error('Error searching notifications:', error)
      setErrorMessage('Fehler bei der Suche')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, includeArchived, categoryFilter, priorityFilter, dateRange])

  // Restore notification
  const handleRestore = async (id: number) => {
    try {
      await bakeryAPI.restoreNotification(id)
      setSuccessMessage('Benachrichtigung wiederhergestellt')
      loadArchivedNotifications()
      loadArchiveStats()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Wiederherstellen')
    }
  }

  // Restore multiple notifications
  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return

    try {
      await bakeryAPI.restoreBulkNotifications(Array.from(selectedIds))
      setSuccessMessage(
        `${selectedIds.size} Benachrichtigungen wiederhergestellt`
      )
      setSelectedIds(new Set())
      loadArchivedNotifications()
      loadArchiveStats()
    } catch (error: any) {
      setErrorMessage(error.message || 'Fehler beim Wiederherstellen')
    }
  }

  // Permanent delete notification
  const handlePermanentDelete = async (id: number) => {
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
    loadArchivedNotifications(true)
    loadArchiveStats()
  }, [categoryFilter, priorityFilter, dateRange])

  useEffect(() => {
    loadArchivedNotifications()
  }, [page])

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
    setSelectedIds(new Set())
  }

  const handleSelectAll = () => {
    const currentNotifications =
      tabValue === 0 ? archivedNotifications : searchResults
    if (selectedIds.size === currentNotifications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(currentNotifications.map((n) => n.id)))
    }
  }

  const handleSelectNotification = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
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

  const getPriorityColor = (priority: Notification['priority']) => {
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
      case 'general':
        return 'Allgemein'
    }
  }

  const NotificationItem: React.FC<{
    notification: Notification
    showSelect?: boolean
  }> = ({ notification, showSelect = true }) => (
    <ListItem
      sx={{
        backgroundColor: 'action.hover',
        mb: 1,
        borderRadius: 1,
        opacity: notification.archived ? 0.7 : 1,
      }}
    >
      {showSelect && (
        <ListItemIcon>
          <Checkbox
            checked={selectedIds.has(notification.id)}
            onChange={() => handleSelectNotification(notification.id)}
          />
        </ListItemIcon>
      )}
      <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" component="span">
              {notification.title}
            </Typography>
            {notification.archived && (
              <Chip label="Archiviert" size="small" color="secondary" />
            )}
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
              {notification.archived && notification.archivedAt ? (
                <>
                  Archiviert{' '}
                  {formatDistanceToNow(new Date(notification.archivedAt), {
                    addSuffix: true,
                    locale: de,
                  })}
                  (
                  {format(
                    new Date(notification.archivedAt),
                    'dd.MM.yyyy HH:mm'
                  )}
                  )
                </>
              ) : (
                formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                  locale: de,
                })
              )}
            </Typography>
          </>
        }
      />
      <ListItemSecondaryAction>
        <Stack direction="row" spacing={1}>
          {notification.archived && (
            <IconButton
              edge="end"
              aria-label="wiederherstellen"
              onClick={() => handleRestore(notification.id)}
              color="primary"
            >
              <RestoreIcon />
            </IconButton>
          )}
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
  )

  if (loading && archivedNotifications.length === 0) {
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Suchen"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
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
                  <MenuItem value="general">Allgemein</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
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
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Von Datum"
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Bis Datum"
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
            >
              Suchen
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
                setCategoryFilter('all')
                setPriorityFilter('all')
                setDateRange({ start: '', end: '' })
              }}
            >
              Filter zurücksetzen
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label={`Archiv (${archiveStats?.total || 0})`} />
              <Tab label={`Suchergebnisse (${searchResults.length})`} />
            </Tabs>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={
                  selectedIds.size > 0 ? <DeselectIcon /> : <SelectAllIcon />
                }
                onClick={handleSelectAll}
              >
                {selectedIds.size > 0 ? 'Abwählen' : 'Alle auswählen'}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="contained"
                  startIcon={<RestoreIcon />}
                  onClick={handleBulkRestore}
                  disabled={tabValue !== 0} // Only allow bulk restore from archive tab
                >
                  {selectedIds.size} wiederherstellen
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : archivedNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <ArchiveIcon
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography color="text.secondary">
                Keine archivierten Benachrichtigungen gefunden
              </Typography>
            </Box>
          ) : (
            <>
              <List sx={{ p: 2 }}>
                {archivedNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </List>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {searchLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : searchResults.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <SearchIcon
                sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
              />
              <Typography color="text.secondary">
                {searchQuery
                  ? 'Keine Suchergebnisse gefunden'
                  : 'Geben Sie einen Suchbegriff ein'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 2 }}>
              {searchResults.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  showSelect={false}
                />
              ))}
            </List>
          )}
        </TabPanel>
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
