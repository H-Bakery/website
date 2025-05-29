// src/app/dashboard/page.tsx
'use client'
import React from 'react'
import BakeryLayout from '../../layouts/BakeryLayout'
import { Box, Typography, Grid, Paper, Container } from '@mui/material'
import { useRouter } from 'next/navigation'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import StorefrontIcon from '@mui/icons-material/Storefront'
import BarChartIcon from '@mui/icons-material/BarChart'

export default function DashboardPage() {
  const router = useRouter()

  const dashboardSections = [
    {
      title: 'Backstube',
      description:
        'Produktionsprozesse, Rezepte und Bestelllisten für die Herstellung',
      icon: <BakeryDiningIcon sx={{ fontSize: 48 }} />,
      color: '#8D6E63',
      onClick: () => router.push('/dashboard/production'),
    },
    {
      title: 'Verkaufsbereich',
      description: 'Verkaufszahlen, Bestellungen und Kundenservice',
      icon: <StorefrontIcon sx={{ fontSize: 48 }} />,
      color: '#66BB6A',
      onClick: () => router.push('/dashboard/sales'),
    },
    {
      title: 'Verwaltung',
      description: 'Finanzen, Personal und Unternehmenskennzahlen',
      icon: <BarChartIcon sx={{ fontSize: 48 }} />,
      color: '#42A5F5',
      onClick: () => router.push('/dashboard/management'),
    },
  ]

  return (
    <BakeryLayout>
      <Container maxWidth="xl">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Willkommen im Bäckerei-Management
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Wählen Sie einen Bereich aus, um die entsprechenden Tools und
            Berichte zu sehen.
          </Typography>

          <Grid container spacing={4} sx={{ mt: 2 }}>
            {dashboardSections.map((section) => (
              <Grid item xs={12} md={4} key={section.title}>
                <Paper
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 3,
                    },
                  }}
                  onClick={section.onClick}
                >
                  <Box
                    sx={{
                      mb: 2,
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: `${section.color}15`,
                      color: section.color,
                    }}
                  >
                    {section.icon}
                  </Box>
                  <Typography variant="h5" component="h2" gutterBottom>
                    {section.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {section.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </BakeryLayout>
  )
}
