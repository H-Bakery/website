'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Box,
  Typography,
  Tab,
  Tabs,
  Button,
  Grid,
  Paper,
  Divider,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import EventIcon from '@mui/icons-material/Event'
import ChecklistIcon from '@mui/icons-material/Checklist'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'

import SaturdayProductionDashboard from '../../../../components/bakery/SaturdayProductionDashboard'
import ProductionChecklist from '../../../../components/bakery/ProductionChecklist'
import FillingPreparation from '../../../../components/bakery/FillingPreparation'
import { HefezopfCalculator } from '../../../../utils/productionCalculator'

// Mock initial order data - will work offline
const MOCK_ORDERS = {
  'Hefezopf Plain': 12,
  'Hefekranz Nuss': 6,
  'Hefekranz Schoko': 8,
  'Hefekranz Pudding': 3,
  'Hefekranz Marzipan': 2,
  'Mini Hefezopf': 15,
  'Hefeschnecken Nuss': 20,
  'Hefeschnecken Schoko': 18,
}

export default function SaturdayProductionPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [selectedTab, setSelectedTab] = useState(0)
  const [selectedDateIndex, setSelectedDateIndex] = useState(0)
  const [saturdays, setSaturdays] = useState<
    { date: Date; display: string; dateStr: string }[]
  >([])
  const [orders, setOrders] = useState(MOCK_ORDERS)
  const [productionPlan, setProductionPlan] = useState<any>(null)

  // Generate upcoming Saturdays
  useEffect(() => {
    const nextSaturdays = []
    const today = new Date()

    // Find next Saturday
    const currentDay = today.getDay() // 0 = Sunday, 6 = Saturday
    const daysToAdd = (6 - currentDay + 7) % 7 || 7 // If today is Saturday, get next Saturday

    const nextSaturday = new Date(today)
    nextSaturday.setDate(today.getDate() + daysToAdd)

    // Generate 8 Saturdays
    for (let i = 0; i < 8; i++) {
      const saturdayDate = new Date(nextSaturday)
      saturdayDate.setDate(nextSaturday.getDate() + i * 7)

      const displayDate = saturdayDate.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })

      const dateStr = saturdayDate.toISOString().split('T')[0]

      nextSaturdays.push({
        date: saturdayDate,
        display: displayDate,
        dateStr,
      })
    }

    setSaturdays(nextSaturdays)
  }, [])

  // Calculate production plan
  useEffect(() => {
    const calculator = new HefezopfCalculator()
    const plan = calculator.calculateProductionNeeds(orders)
    setProductionPlan(plan)
  }, [orders])

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue)
  }

  const handlePrevDate = () => {
    if (selectedDateIndex > 0) {
      setSelectedDateIndex(selectedDateIndex - 1)
    }
  }

  const handleNextDate = () => {
    if (selectedDateIndex < saturdays.length - 1) {
      setSelectedDateIndex(selectedDateIndex + 1)
    }
  }

  const handleOrderChange = (product: string, quantity: number) => {
    setOrders({
      ...orders,
      [product]: quantity,
    })
  }

  const currentSaturday = saturdays[selectedDateIndex]
  const currentDate = currentSaturday?.dateStr || ''
  const currentDateDisplay = currentSaturday?.display || ''

  return (
    <Container maxWidth="xl" sx={{ py: 2, px: { xs: 1, sm: 2 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          Samstag Spezialproduktion
        </Typography>
      </Box>

      {/* Date Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container alignItems="center" spacing={1}>
          <Grid item xs={2}>
            <IconButton
              onClick={handlePrevDate}
              disabled={selectedDateIndex === 0}
              aria-label="Vorheriger Samstag"
            >
              <ArrowBackIcon />
            </IconButton>
          </Grid>
          <Grid item xs={8}>
            <Box textAlign="center">
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <EventIcon fontSize="small" sx={{ mr: 0.5 }} />
                Produktionstag
              </Typography>
              <Typography variant="h6" fontWeight="bold" noWrap>
                {currentDateDisplay}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={2} sx={{ textAlign: 'right' }}>
            <IconButton
              onClick={handleNextDate}
              disabled={selectedDateIndex === saturdays.length - 1}
              aria-label="Nächster Samstag"
            >
              <ArrowForwardIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="Produktionsplan Tabs"
        >
          <Tab
            icon={isMobile ? <BakeryDiningIcon /> : undefined}
            label={isMobile ? undefined : 'Produktion'}
            iconPosition="top"
            aria-label="Produktionsplan"
          />
          <Tab
            icon={isMobile ? <RestaurantIcon /> : undefined}
            label={isMobile ? undefined : 'Füllungen'}
            iconPosition="top"
            aria-label="Füllungszubereitung"
          />
          <Tab
            icon={isMobile ? <ChecklistIcon /> : undefined}
            label={isMobile ? undefined : 'Checkliste'}
            iconPosition="top"
            aria-label="Checkliste"
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box>
        {selectedTab === 0 && (
          <SaturdayProductionDashboard
            orders={orders}
            onOrderChange={handleOrderChange}
            date={currentDate}
          />
        )}
        {selectedTab === 1 && productionPlan && (
          <FillingPreparation
            productionPlan={productionPlan}
            orders={orders}
            onOrderChange={handleOrderChange}
          />
        )}
        {selectedTab === 2 && (
          <ProductionChecklist orders={orders} date={currentDate} />
        )}
      </Box>
    </Container>
  )
}
