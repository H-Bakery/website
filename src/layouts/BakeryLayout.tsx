// src/layouts/BakeryLayout.tsx
'use client'
import React, { useEffect, useState } from 'react'
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Avatar,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  useMediaQuery,
} from '@mui/material'
import { useTheme as useMuiTheme } from '@mui/material/styles'
import { useTheme } from '../context/ThemeContext'
import { useRouter, usePathname } from 'next/navigation'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InventoryIcon from '@mui/icons-material/Inventory'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PeopleIcon from '@mui/icons-material/People'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import BarChartIcon from '@mui/icons-material/BarChart'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import StorefrontIcon from '@mui/icons-material/Storefront'
import CloseIcon from '@mui/icons-material/Close'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import '../app/print.css'
import ThemeToggler from '../components/theme/ThemeToggler'

// Define types for user role
type UserRole = 'Management' | 'Production' | 'Sales'

// Define type for current user
interface CurrentUser {
  name: string
  role: UserRole
  avatar: string | null
}

// Define type for navigation item
interface NavigationItem {
  name: string
  icon: React.ReactNode
  path: string
  roles: UserRole[]
}

// Define type for navigation section
interface NavigationSection {
  section: string
  items: NavigationItem[]
}

// Define Props interface
interface BakeryLayoutProps {
  children: React.ReactNode
}

// Mock user role - should come from auth system
const CURRENT_USER: CurrentUser = {
  name: 'Max Müller',
  role: 'Production', // Could be: Management, Production, Sales
  avatar: null, // Could be a URL to avatar image
}

// Width of the drawer when open
const DRAWER_WIDTH = 260

const BakeryLayout: React.FC<BakeryLayoutProps> = ({ children }) => {
  const muiTheme = useMuiTheme()
  const { mode } = useTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const router = useRouter()
  const pathname = usePathname() // Use usePathname instead of window.location.pathname
  const [drawerOpen, setDrawerOpen] = useState(!isMobile)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(true) // This should be from your auth system
  const [pageTitle, setPageTitle] = useState('Bäckerei-Management') // Default title

  // Set page title based on current path
  useEffect(() => {
    if (pathname) {
      if (pathname.includes('/bakery/processes'))
        setPageTitle('Backstube: Produktionsprozesse')
      else if (pathname.includes('/orders/baking-list'))
        setPageTitle('Backstube: Bestelllisten')
      else if (pathname.includes('/orders'))
        setPageTitle('Verkaufsbereich: Bestellungen')
      else if (pathname.includes('/dashboard/sales'))
        setPageTitle('Verkaufsbereich: Statistik')
      else if (pathname.includes('/dashboard/production'))
        setPageTitle('Backstube: Statistik')
      else if (pathname.includes('/dashboard/management'))
        setPageTitle('Verwaltung: Kennzahlen')
      else setPageTitle('Bäckerei-Management')
    }
  }, [pathname])

  // Check authentication - redirect to login if not authenticated
  useEffect(() => {
    // For demo purposes, we're just using a constant
    // In a real app, you'd check with your auth provider
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  // Navigation items grouped by section
  const navigationItems: NavigationSection[] = [
    {
      section: 'Hauptnavigation',
      items: [
        {
          name: 'Dashboard',
          icon: <DashboardIcon />,
          path: '/dashboard',
          roles: ['Management', 'Production', 'Sales'],
        },
      ],
    },
    {
      section: 'Backstube',
      items: [
        {
          name: 'Produktionsprozesse',
          icon: <BakeryDiningIcon />,
          path: '/bakery/processes',
          roles: ['Management', 'Production'],
        },
        {
          name: 'Bestelllisten',
          icon: <AssignmentIcon />,
          path: '/orders',
          roles: ['Management', 'Production'],
        },
        {
          name: 'Samstag Spezialproduktion',
          icon: <BakeryDiningIcon />,
          path: '/bakery/saturday-production',
          roles: ['Management', 'Production'],
        },
      ],
    },
    {
      section: 'Verkaufsbereich',
      items: [
        {
          name: 'Bestellungen',
          icon: <ShoppingBasketIcon />,
          path: '/orders',
          roles: ['Management', 'Sales'],
        },
        {
          name: 'Produkte',
          icon: <InventoryIcon />,
          path: '/products',
          roles: ['Management', 'Sales'],
        },
        {
          name: 'Verkaufsstatistik',
          icon: <BarChartIcon />,
          path: '/dashboard/sales',
          roles: ['Management', 'Sales'],
        },
      ],
    },
    {
      section: 'Verwaltung',
      items: [
        {
          name: 'Mitarbeiter',
          icon: <PeopleIcon />,
          path: '/admin/staff',
          roles: ['Management'],
        },
        {
          name: 'Einstellungen',
          icon: <SettingsIcon />,
          path: '/admin/settings',
          roles: ['Management'],
        },
      ],
    },
  ]

  // Filter navigation based on user role
  const filteredNavigation = navigationItems
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.roles.includes(CURRENT_USER.role)
      ),
    }))
    .filter((section) => section.items.length > 0)

  // Check if user can access this page based on current route
  // In a real app, you'd implement this more robustly
  const checkAccess = (): boolean => {
    return true
  }

  // For client-side only localStorage operations
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Client-side check for localStorage and auth
    const checkLocalStorage = () => {
      // Example localStorage check - adjust according to your auth system
      const token = localStorage.getItem('token')
      if (!token && !authChecked) {
        setIsAuthenticated(false)
      }
      setAuthChecked(true)
    }

    checkLocalStorage()
  }, [authChecked])

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  if (!checkAccess()) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Keine Zugangsberechtigung
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: muiTheme.zIndex.drawer + 1,
          backgroundColor: mode === 'dark' ? 'background.paper' : 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle menu"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            {drawerOpen && isMobile ? <CloseIcon /> : <MenuIcon />}
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="h6"
                component="span"
                sx={{
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {pageTitle}
              </Typography>
            </Box>
          </Typography>
          
          {/* Theme Toggle Button */}
          <Box sx={{ mr: 2 }}>
            <ThemeToggler />
          </Box>

          {/* User Menu */}
          <Chip
            avatar={
              CURRENT_USER.avatar ? (
                <Avatar src={CURRENT_USER.avatar} />
              ) : (
                <Avatar>{CURRENT_USER.name.charAt(0)}</Avatar>
              )
            }
            label={
              <Box>
                <Typography variant="body2" component="span">
                  {CURRENT_USER.name}
                </Typography>
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ display: 'block', opacity: 0.7 }}
                >
                  {(() => {
                    switch (CURRENT_USER.role) {
                      case 'Management':
                        return 'Geschäftsführung'
                      case 'Production':
                        return 'Bäckermeister'
                      case 'Sales':
                        return 'Verkauf'
                      default:
                        return CURRENT_USER.role
                    }
                  })()}
                </Typography>
              </Box>
            }
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              setAnchorEl(e.currentTarget)
            }
            sx={{
              height: 'auto',
              pl: 0.5,
              pr: 1.5,
              py: 0.75,
              borderRadius: 2,
              cursor: 'pointer',
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem
              onClick={() => {
                handleMenuClose()
                router.push('/profile')
              }}
            >
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Mein Profil</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                handleMenuClose()
                // Implement logout functionality (client-side only)
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('token')
                }
                setIsAuthenticated(false)
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Abmelden</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar / Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: 'none',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', pt: 2 }}>
          {filteredNavigation.map((section, index) => (
            <React.Fragment key={section.section}>
              {index > 0 && <Divider sx={{ my: 2 }} />}

              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 3, py: 1, display: 'block' }}
              >
                {section.section}
              </Typography>

              <List>
                {section.items.map((item) => (
                  <ListItem
                    button
                    key={item.name}
                    onClick={() => {
                      router.push(item.path)
                      if (isMobile) setDrawerOpen(false)
                    }}
                    sx={{
                      borderRadius: '0 24px 24px 0',
                      mr: 1,
                      color:
                        pathname === item.path
                          ? 'primary.main'
                          : 'text.primary',
                      bgcolor:
                        pathname === item.path
                          ? 'rgba(0, 0, 0, 0.04)'
                          : 'transparent',
                      '&:hover': {
                        bgcolor:
                          pathname === item.path
                            ? 'rgba(0, 0, 0, 0.08)'
                            : 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color:
                          pathname === item.path ? 'primary.main' : 'inherit',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.name} />
                  </ListItem>
                ))}
              </List>
            </React.Fragment>
          ))}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)` },
          mt: '64px', // Height of the AppBar
          transition: muiTheme.transitions.create(['width', 'margin'], {
            easing: muiTheme.transitions.easing.sharp,
            duration: muiTheme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default BakeryLayout
