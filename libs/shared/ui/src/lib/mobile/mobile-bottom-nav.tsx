'use client'
import React, { useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
  Box,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PhoneIcon from '@mui/icons-material/Phone'
import MenuIcon from '@mui/icons-material/Menu'
import { CartContext } from '@bakery/shared/contexts'

interface NavItem {
  label: string
  value: string
  icon: React.ReactNode
  path: string
}

const MobileBottomNav: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const cartContext = useContext(CartContext)
  const totalCount = cartContext?.summary?.totalCount || 0

  const navItems: NavItem[] = [
    {
      label: 'Start',
      value: 'home',
      icon: <HomeIcon />,
      path: '/',
    },
    {
      label: 'Sortiment',
      value: 'products',
      icon: <ShoppingBagIcon />,
      path: '/products',
    },
    {
      label: 'Warenkorb',
      value: 'cart',
      icon: (
        <Badge badgeContent={totalCount} color="error" max={99}>
          <ShoppingCartIcon />
        </Badge>
      ),
      path: '/cart',
    },
    {
      label: 'Bestellen',
      value: 'order',
      icon: <PhoneIcon />,
      path: '/bestellen',
    },
    {
      label: 'Mehr',
      value: 'more',
      icon: <MenuIcon />,
      path: '/about',
    },
  ]

  // Determine current value based on pathname
  const getCurrentValue = () => {
    const currentItem = navItems.find((item) => pathname === item.path)
    if (currentItem) return currentItem.value

    // Check for partial matches
    if (pathname.startsWith('/products')) return 'products'
    if (pathname.startsWith('/cart')) return 'cart'
    if (pathname.startsWith('/bestellen')) return 'order'
    return 'home'
  }

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    const item = navItems.find((nav) => nav.value === newValue)
    if (item) {
      router.push(item.path)
    }
  }

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) {
    return null
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200, // Above floating cart button (1100)
        display: { xs: 'block', md: 'none' },
        backgroundColor: 'background.paper', // Ensure solid background
      }}
    >
      <Paper
        elevation={8}
        sx={{
          borderRadius: 0,
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          value={getCurrentValue()}
          onChange={handleChange}
          showLabels
          sx={{
            height: 64,
            paddingBottom: 'env(safe-area-inset-bottom)',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 60,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.75rem',
              '&.Mui-selected': {
                fontSize: '0.75rem',
                fontWeight: 600,
              },
            },
            // Add subtle animation to selected item
            '& .Mui-selected': {
              '& .MuiSvgIcon-root': {
                transform: 'scale(1.1)',
                transition: 'transform 0.2s ease',
              },
            },
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              value={item.value}
              icon={item.icon}
              sx={{
                '&:active': {
                  backgroundColor: 'action.selected',
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}

export default MobileBottomNav
