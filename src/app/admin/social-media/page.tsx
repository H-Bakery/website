'use client'
import React from 'react'
import SocialMediaContentCreator from '../../../components/socialMedia/SocialMediaContentCreator'
import {
  Container,
  Typography,
  Box,
  Breadcrumbs,
  useTheme,
  Chip,
} from '@mui/material'
import Link from 'next/link'
import HomeIcon from '@mui/icons-material/Home'
import TextSnippetIcon from '@mui/icons-material/TextSnippet'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

export default function SocialMediaPage() {
  const theme = useTheme()

  return (
    <>
      <Box
        sx={{
          bgcolor: 'background.paper',
          mb: 4,
          py: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '4px',
            bgcolor: 'primary.main',
          },
        }}
      >
        <Container>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              href="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              <HomeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Admin
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              <PhotoCameraIcon
                fontSize="small"
                sx={{ mr: 0.5, color: theme.palette.primary.main }}
              />
              Social Media
            </Typography>
          </Breadcrumbs>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              mt: 2,
              fontWeight: 600,
              fontFamily: "'Averia Serif Libre', serif",
            }}
          >
            Social Media Content Creator
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
            <Chip
              icon={<TextSnippetIcon />}
              label="Text-fokussierte Designs"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ mr: 1 }}
            />
            <Chip
              icon={<PhotoCameraIcon fontSize="small" />}
              label="Mit Wappen-Logo"
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ mr: 1 }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary">
            Erstellen Sie professionelle, textbasierte Inhalte mit dem
            Firmen-Wappen für optimale Social Media Präsenz
          </Typography>
        </Container>
      </Box>
      <SocialMediaContentCreator />
    </>
  )
}