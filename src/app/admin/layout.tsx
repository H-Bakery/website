'use client'
import React from 'react'
import { Box, Card, ThemeProvider as MuiThemeProvider } from '@mui/material'
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
          <Card
            elevation={mode === 'dark' ? 1 : 2}
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 2,
              bgcolor: mode === 'dark' ? 'background.paper' : 'white',
            }}
          >
            {children}
          </Card>
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
