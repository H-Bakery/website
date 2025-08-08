'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Alert,
  Fade,
} from '@mui/material'
import { CalendarToday, Assessment, History } from '@mui/icons-material'
import DailyUnsoldTracker from '../../../components/admin/unsoldProducts/DailyUnsoldTracker'
import DateNavigator from '../../../components/admin/unsoldProducts/DateNavigator'
import WeeklySummary from '../../../components/admin/unsoldProducts/WeeklySummary'
import UnsoldProductsHistory from '../../../components/admin/unsoldProducts/UnsoldProductsHistory'
import bakeryAPI from '../../../services/bakeryAPI'
import { useRouter } from 'next/navigation'

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
      id={`unsold-tabpanel-${index}`}
      aria-labelledby={`unsold-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in={value === index} timeout={300}>
          <Box>{children}</Box>
        </Fade>
      )}
    </div>
  )
}

interface UnsoldProduct {
  id: number
  productId: number
  quantity: number
  date: string
  createdAt: string
  updatedAt: string
  Product: {
    name: string
    category: string
  }
  User: {
    username: string
  }
}

interface UnsoldProductSummary {
  productId: number
  totalUnsold: number
  Product: {
    name: string
    category: string
  }
}

const UnsoldProductsManagement: React.FC = () => {
  const [tabValue, setTabValue] = useState(0)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [unsoldProducts, setUnsoldProducts] = useState<UnsoldProduct[]>([])
  const [summary, setSummary] = useState<UnsoldProductSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (tabValue === 2) {
      // Only load when History tab is active
      fetchUnsoldProducts()
      fetchUnsoldProductsSummary()
    }
  }, [tabValue])

  const fetchUnsoldProducts = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const data = await bakeryAPI.getUnsoldProducts()
      setUnsoldProducts(data)
    } catch (error) {
      console.error('Error fetching unsold products:', error)
      if (error instanceof Error && error.message.includes('Authentication')) {
        setErrorMessage(
          'Authentifizierung fehlgeschlagen. Bitte melden Sie sich erneut an.'
        )
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setErrorMessage('Fehler beim Laden der unverkauften Produkte')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchUnsoldProductsSummary = async () => {
    try {
      const data = await bakeryAPI.getUnsoldProductsSummary()
      setSummary(data)
    } catch (error) {
      console.error('Error fetching unsold products summary:', error)
    }
  }

  const handleDataRefresh = () => {
    setSuccessMessage('Daten erfolgreich aktualisiert')
    setTimeout(() => setSuccessMessage(null), 3000)

    // If we're on the history tab, refresh that data too
    if (tabValue === 2) {
      fetchUnsoldProducts()
      fetchUnsoldProductsSummary()
    }
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          Unverkaufte Produkte
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Tägliche Erfassung und Analyse der unverkauften Produkte
        </Typography>
      </Box>

      {/* Messages */}
      {successMessage && (
        <Fade in={!!successMessage}>
          <Alert
            severity="success"
            sx={{ mb: 3 }}
            onClose={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        </Fade>
      )}

      {errorMessage && (
        <Fade in={!!errorMessage}>
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() => setErrorMessage(null)}
          >
            {errorMessage}
          </Alert>
        </Fade>
      )}

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="unsold products tabs"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 64,
              fontSize: '1rem',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={<CalendarToday />}
            iconPosition="start"
            label="Tägliche Erfassung"
            id="unsold-tab-0"
            aria-controls="unsold-tabpanel-0"
          />
          <Tab
            icon={<Assessment />}
            iconPosition="start"
            label="Wochenanalyse"
            id="unsold-tab-1"
            aria-controls="unsold-tabpanel-1"
          />
          <Tab
            icon={<History />}
            iconPosition="start"
            label="Verlauf & Historie"
            id="unsold-tab-2"
            aria-controls="unsold-tabpanel-2"
          />
        </Tabs>

        {/* Daily Tracking Tab */}
        <TabPanel value={tabValue} index={0}>
          <DateNavigator
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
          <DailyUnsoldTracker
            selectedDate={selectedDate}
            onSave={handleDataRefresh}
          />
        </TabPanel>

        {/* Weekly Analysis Tab */}
        <TabPanel value={tabValue} index={1}>
          <DateNavigator
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
          <WeeklySummary selectedDate={selectedDate} />
        </TabPanel>

        {/* History Tab */}
        <TabPanel value={tabValue} index={2}>
          <UnsoldProductsHistory
            unsoldProducts={unsoldProducts}
            summary={summary}
            loading={loading}
            onRefresh={() => {
              fetchUnsoldProducts()
              fetchUnsoldProductsSummary()
            }}
          />
        </TabPanel>
      </Paper>
    </Container>
  )
}

export default UnsoldProductsManagement
