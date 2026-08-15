import React from 'react'
import { Box, Container, Breadcrumbs, Link } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import NewspaperIcon from '@mui/icons-material/Newspaper'
import News from '../../components/home/news'
import Hero from '../../components/Hero'
import { getAllNews } from '../../services/newsService'
import { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/news' },
  title: 'Neuigkeiten - Bäckerei Heusser',
  description:
    'Aktuelle Neuigkeiten und Angebote aus der Bäckerei Heusser. Erfahren Sie mehr über unsere neuesten Produkte und Aktionen.',
  keywords: 'Neuigkeiten, Angebote, Aktionen, News, Bäckerei',
}

export default function NewsPage() {
  const news = getAllNews()

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Breadcrumb Navigation */}
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
              <NewspaperIcon sx={{ mr: 0.5 }} fontSize="small" />
              Neuigkeiten
            </Box>
          </Breadcrumbs>
        </Box>
      </Container>

      <Hero title="Neuigkeiten" />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box mb={6}>
          <News news={news} />
        </Box>
      </Container>
    </>
  )
}
