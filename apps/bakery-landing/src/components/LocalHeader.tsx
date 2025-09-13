'use client'

import React from 'react'
import { Box, Typography, useMediaQuery, useTheme, Button } from '@mui/material'
import Link from 'next/link'

interface MenuItem {
  label: string
  path: string
  cta?: boolean
}

const items: MenuItem[] = [
  { label: 'Sortiment', path: '/products' },
  { label: 'Neuigkeiten', path: '/news' },
  { label: 'Über uns', path: '/about' },
  { label: 'Kontakt', path: '/contact' },
]

export const LocalHeader = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Box
      sx={{
        position: 'fixed',
        zIndex: 10001,
        top: 16,
        left: 16,
        height: 'auto',
        minHeight: 70,
        width: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
        boxShadow: 1,
        borderRadius: '8px',
        p: 2,
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Box sx={{ cursor: 'pointer' }}>
          <Typography
            variant="h5"
            component="div"
            sx={{
              fontWeight: 'bold',
              color: theme.palette.primary.main,
              fontFamily: 'Playfair Display',
            }}
          >
            Bäckerei Heusser
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              fontSize: '0.75rem',
            }}
          >
            Seit 1933
          </Typography>
        </Box>
      </Link>

      {!isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.path}
              style={{ textDecoration: 'none' }}
            >
              <Typography
                sx={{
                  color: 'text.primary',
                  fontWeight: 500,
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                {item.label}
              </Typography>
            </Link>
          ))}
        </Box>
      )}

      {isMobile && (
        <Box>
          <Typography variant="body2" color="text.secondary">
            Menu
          </Typography>
        </Box>
      )}
    </Box>
  )
}
