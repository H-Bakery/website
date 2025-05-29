'use client'
import React from 'react'
import {
  Box,
  Typography,
  ThemeProvider as MuiThemeProvider,
} from '@mui/material'
import BakeryLayout from '../../layouts/BakeryLayout'
import { ThemeProvider } from '../../context/ThemeContext'
import { useTheme } from '../../context/ThemeContext'
import { lightTheme, darkTheme } from '../../theme'

// Component that uses theme context to switch between light and dark themes
function ThemedAdminContent({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme()
  const currentTheme = mode === 'dark' ? darkTheme : lightTheme

  return (
    <MuiThemeProvider theme={currentTheme}>
      <BakeryLayout>
        <Box
          sx={{
            mb: 4,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ mb: 2, fontWeight: 'bold' }}
          >
            Administration
          </Typography>
          <Box sx={{ mt: 1 }}>{children}</Box>
        </Box>
      </BakeryLayout>
    </MuiThemeProvider>
  )
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <ThemeProvider>
      <ThemedAdminContent>{children}</ThemedAdminContent>
    </ThemeProvider>
  )
}
