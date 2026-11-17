'use client'
import React, { useState, useEffect } from 'react'
import { Box, Container, Typography, Paper, Grid } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PhoneIcon from '@mui/icons-material/Phone'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import PlaceIcon from '@mui/icons-material/Place'
import {
  getOpenStatus,
  getCompactHoursSummary,
  type OpenStatus,
} from '../../utils/openingHours'
import { LEGAL } from '../../config/legal'

interface InfoCard {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
  href?: string
}

/**
 * Value, subtext and icon colour of the hours card per state. On a holiday
 * it stays neutral: holiday hours are not configured, so it neither claims
 * "geöffnet" nor "geschlossen".
 */
function hoursCardContent(status: OpenStatus): {
  value: string
  subtext?: string
  iconColor: string
} {
  switch (status.kind) {
    case 'open':
      return {
        value: 'Jetzt geöffnet',
        subtext: `Heute ${status.todayHours}`,
        iconColor: '#7A9B6B',
      }
    case 'opens-later':
      return {
        value: `Öffnet um ${status.opens} Uhr`,
        subtext: `Heute ${status.todayHours}`,
        iconColor: '#B48C3C',
      }
    case 'feiertag':
      return {
        value: 'Feiertag',
        // non-breaking space: a wrapped line never starts with the dash
        subtext: `${status.name}\u00a0– Öffnungszeiten bitte telefonisch erfragen`,
        iconColor: '#5A2E2A',
      }
    default:
      return {
        value: 'Geschlossen',
        subtext: status.next
          ? `Nächste Öffnung: ${status.next.day} ${status.next.time} Uhr`
          : undefined,
        iconColor: '#5A2E2A',
      }
  }
}

const QuickInfoBar: React.FC = () => {
  const [hoursCard, setHoursCard] = useState<InfoCard>({
    icon: <AccessTimeIcon sx={{ fontSize: 32, color: '#5A2E2A' }} />,
    label: 'Öffnungszeiten',
    value: 'Öffnungszeiten',
    subtext: getCompactHoursSummary(),
  })

  useEffect(() => {
    const { value, subtext, iconColor } = hoursCardContent(getOpenStatus())
    setHoursCard({
      icon: <AccessTimeIcon sx={{ fontSize: 32, color: iconColor }} />,
      label: 'Öffnungszeiten',
      value,
      subtext,
    })
  }, [])

  const cards: InfoCard[] = [
    hoursCard,
    {
      icon: <PhoneIcon sx={{ fontSize: 32, color: '#5A2E2A' }} />,
      label: 'Telefon',
      value: LEGAL.phone,
      subtext: 'Anrufen und bestellen',
      href: LEGAL.phoneHref,
    },
    {
      icon: <ShoppingBagIcon sx={{ fontSize: 32, color: '#d038ba' }} />,
      label: 'Bestellen',
      value: 'Telefonisch oder vor Ort',
      subtext: 'Gerne auch vorbestellen',
      href: LEGAL.phoneHref,
    },
    {
      icon: <PlaceIcon sx={{ fontSize: 32, color: '#5A2E2A' }} />,
      label: 'Adresse',
      value: 'Eckstraße 3, Homburg',
      subtext: 'Route planen',
      href: `https://www.google.com/maps/dir/?api=1&destination=49.301429,7.369494&travelmode=driving`,
    },
  ]

  return (
    <Box sx={{ py: { xs: 3, md: 5 }, backgroundColor: '#FFFFFF' }}>
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 2, md: 3 }}>
          {cards.map((card) => {
            const cardContent = (
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: '#E6D8C3',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  minHeight: { xs: 120, md: 140 },
                  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                  cursor: card.href ? 'pointer' : 'default',
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover': card.href
                    ? {
                        boxShadow: '0 4px 16px rgba(90, 46, 42, 0.12)',
                        transform: 'translateY(-2px)',
                      }
                    : {},
                }}
              >
                <Box sx={{ mb: 1.5 }}>{card.icon}</Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: { xs: '0.85rem', md: '0.9rem' },
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    mb: 0.5,
                  }}
                >
                  {card.label}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: '"Cinzel", serif',
                    fontWeight: 700,
                    fontSize: { xs: '1.05rem', md: '1.15rem' },
                    color: '#3B2B28',
                    mb: 0.5,
                  }}
                >
                  {card.value}
                </Typography>
                {card.subtext && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: { xs: '0.85rem', md: '0.9rem' },
                    }}
                  >
                    {card.subtext}
                  </Typography>
                )}
              </Paper>
            )

            return (
              <Grid item xs={6} md={3} key={card.label}>
                {card.href ? (
                  <Box
                    component="a"
                    href={card.href}
                    target={card.href.startsWith('http') ? '_blank' : undefined}
                    rel={
                      card.href.startsWith('http')
                        ? 'noopener noreferrer'
                        : undefined
                    }
                    sx={{
                      textDecoration: 'none',
                      display: 'block',
                      height: '100%',
                    }}
                  >
                    {cardContent}
                  </Box>
                ) : (
                  cardContent
                )}
              </Grid>
            )
          })}
        </Grid>
      </Container>
    </Box>
  )
}

export default QuickInfoBar
