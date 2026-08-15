import React from 'react'
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import Hero from '../Hero'

interface LegalPageProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}

/** Gemeinsames Layout für Impressum & Datenschutzerklärung */
export function LegalPage({ title, icon, children }: LegalPageProps) {
  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Startseite
            </Link>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: 'text.primary',
              }}
            >
              {icon}
              {title}
            </Box>
          </Breadcrumbs>
        </Box>
      </Container>

      <Hero title={title} />

      <Container
        component="article"
        maxWidth="md"
        sx={{
          py: 6,
          '& a': { color: 'primary.main', wordBreak: 'break-word' },
        }}
      >
        {children}
      </Container>
    </>
  )
}

interface SectionProps {
  title: string
  children: React.ReactNode
  level?: 'h2' | 'h3'
}

export function LegalSection({ title, children, level = 'h2' }: SectionProps) {
  const isSub = level === 'h3'
  return (
    <Box component="section" sx={{ mt: isSub ? 3 : 5 }}>
      <Typography
        variant={isSub ? 'h6' : 'h5'}
        component={level}
        gutterBottom
        sx={{ fontWeight: 700 }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body1" paragraph>
      {children}
    </Typography>
  )
}
