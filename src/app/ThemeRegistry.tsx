// src/app/ThemeRegistry.tsx
'use client'
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import { Box } from '@mui/material'

import { lightTheme, darkTheme } from '../theme'
import CartProvider from '../context/CartContext'
import { Header } from '../components/header'
import Footer from '../components/footer/Index'
import { ThemeProvider as CustomThemeProvider, useTheme } from '../context/ThemeContext'

// Inner component that uses the theme context
function ThemedContent({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();
  const currentTheme = mode === 'dark' ? darkTheme : lightTheme;
  
  return (
    <MuiThemeProvider theme={currentTheme}>
      <CartProvider>
        <CssBaseline />
        <Box
          sx={{
            background: mode === 'light' 
              ? 'radial-gradient(143.25% 143.25% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #D8E1F4'
              : 'none', // No gradient in dark mode
            bgcolor: mode === 'dark' ? 'background.default' : 'transparent'
          }}
        >
          <Header />
          <Box sx={{ minHeight: 'calc(100vh - 332px)' }}>{children}</Box>
          <Footer />
        </Box>
      </CartProvider>
    </MuiThemeProvider>
  );
}

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <CustomThemeProvider>
        <ThemedContent>{children}</ThemedContent>
      </CustomThemeProvider>
    </AppRouterCacheProvider>
  )
}
