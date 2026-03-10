'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
} from '@mui/material'
import { Euro, TrendingUp, History } from '@mui/icons-material'
import {
  CashEntryForm,
  CashHistoryTable,
  MonthlySummary,
  EditCashEntryModal,
  DeleteCashEntryDialog,
} from '@bakery/management/feature-cash'
import { bakeryAPI } from '@bakery/shared/data-access'
import { CashEntry } from '@bakery/shared/types'
import { useRouter } from 'next/navigation'
import { cashCalculations, errorUtils } from '@bakery/shared/utils'

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
      id={`cash-tabpanel-${index}`}
      aria-labelledby={`cash-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const CashManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState(0)
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchCashHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCashHistory = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await bakeryAPI.getCashHistory()
      setCashEntries(data)
    } catch (error) {
      console.error('Error fetching cash history:', error)
      if (error instanceof Error && error.message.includes('Authentication')) {
        setErrorMessage(
          'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
        )
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setErrorMessage('Fehler beim Laden der Kassendaten')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCashEntrySubmit = async (amount: number) => {
    try {
      await bakeryAPI.addCashEntry(amount)

      setSuccessMessage('Kassenstand erfolgreich gespeichert')
      setErrorMessage(null)

      // Refresh the data from the backend to get the latest entries
      await fetchCashHistory()

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (error) {
      console.error('Error saving cash entry:', error)
      if (
        error instanceof Error &&
        (error.message.includes('Authentication') ||
          error.message.includes('user session is invalid'))
      ) {
        setErrorMessage(
          'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
        )
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setErrorMessage('Fehler beim Speichern des Kassenstands')
      }
      setSuccessMessage(null)
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleEdit = (entry: CashEntry) => {
    setSelectedEntry(entry)
    setEditModalOpen(true)
  }

  const handleDelete = (entry: CashEntry) => {
    setSelectedEntry(entry)
    setDeleteDialogOpen(true)
  }

  const handleUpdateEntry = async (
    id: number,
    amount: number,
    date: string
  ) => {
    try {
      await bakeryAPI.updateCashEntry(id, amount, date)

      setSuccessMessage('Kassenstand erfolgreich aktualisiert')
      setErrorMessage(null)

      // Refresh the data from the backend
      await fetchCashHistory()

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (error) {
      console.error('Error updating cash entry:', error)
      if (
        error instanceof Error &&
        (error.message.includes('Authentication') ||
          error.message.includes('user session is invalid'))
      ) {
        setErrorMessage(
          'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
        )
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else if (
        error instanceof Error &&
        error.message.includes('not found')
      ) {
        setErrorMessage('Der Kassenstand wurde nicht gefunden.')
        // Refresh data to sync with server
        await fetchCashHistory()
      } else {
        setErrorMessage('Fehler beim Aktualisieren des Kassenstands')
      }
      throw error // Re-throw to let the modal handle it
    }
  }

  const handleDeleteEntry = async (id: number) => {
    try {
      await bakeryAPI.deleteCashEntry(id)

      setSuccessMessage('Kassenstand erfolgreich gelöscht')
      setErrorMessage(null)

      // Refresh the data from the backend
      await fetchCashHistory()

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (error) {
      console.error('Error deleting cash entry:', error)
      if (
        error instanceof Error &&
        (error.message.includes('Authentication') ||
          error.message.includes('user session is invalid'))
      ) {
        setErrorMessage(
          'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
        )
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else if (
        error instanceof Error &&
        error.message.includes('not found')
      ) {
        setErrorMessage('Der Kassenstand wurde nicht gefunden.')
        // Refresh data to sync with server
        await fetchCashHistory()
      } else {
        setErrorMessage('Fehler beim Löschen des Kassenstands')
      }
      throw error // Re-throw to let the dialog handle it
    }
  }

  const handleCloseEditModal = () => {
    setEditModalOpen(false)
    setSelectedEntry(null)
  }

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setSelectedEntry(null)
  }

  const calculateTodaysTotal = () => {
    const todaysEntries = cashCalculations.filterToday(cashEntries)
    return cashCalculations.calculateTotal(todaysEntries)
  }

  const calculateMonthlyTotal = () => {
    const monthlyEntries = cashCalculations.filterCurrentMonth(cashEntries)
    return cashCalculations.calculateTotal(monthlyEntries)
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Kassenverwaltung
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Erfassung und Verwaltung der täglichen Kassenbestände
        </Typography>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Euro color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Heute</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                €{calculateTodaysTotal().toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Heutiger Kassenstand
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Dieser Monat</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                €{calculateMonthlyTotal().toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monatssumme
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <History color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Einträge</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {cashEntries.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gesamt erfasst
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="cash management tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              label="Kassenstand eingeben"
              id="cash-tab-0"
              aria-controls="cash-tabpanel-0"
            />
            <Tab
              label="Kassenverlauf"
              id="cash-tab-1"
              aria-controls="cash-tabpanel-1"
            />
            <Tab
              label="Monatsübersicht"
              id="cash-tab-2"
              aria-controls="cash-tabpanel-2"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CashEntryForm onSubmit={handleCashEntrySubmit} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CashHistoryTable
            cashEntries={cashEntries}
            loading={loading}
            onRefresh={fetchCashHistory}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <MonthlySummary cashEntries={cashEntries} />
        </TabPanel>
      </Paper>

      {/* Edit Modal */}
      <EditCashEntryModal
        open={editModalOpen}
        entry={selectedEntry}
        onClose={handleCloseEditModal}
        onUpdate={handleUpdateEntry}
      />

      {/* Delete Dialog */}
      <DeleteCashEntryDialog
        open={deleteDialogOpen}
        entry={selectedEntry}
        onClose={handleCloseDeleteDialog}
        onDelete={(id) => handleDeleteEntry(id)}
      />
    </Container>
  )
}

export default CashManagement
