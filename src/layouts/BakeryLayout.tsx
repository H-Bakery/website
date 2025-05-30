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
  Badge,
  Tooltip,
  Button,
  alpha,
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
import MenuBookIcon from '@mui/icons-material/MenuBook'
import CloseIcon from '@mui/icons-material/Close'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import NotificationsIcon from '@mui/icons-material/Notifications'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import SecurityIcon from '@mui/icons-material/Security'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ImageIcon from '@mui/icons-material/Image' // Added import
import Image from 'next/image'
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
const DRAWER_WIDTH = 280

const BakeryLayout: React.FC<BakeryLayoutProps> = ({ children }) => {
  const muiTheme = useMuiTheme()
  const { mode } = useTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))
  const router = useRouter()
  const pathname = usePathname() // Use usePathname instead of window.location.pathname
  const isAdminRoute = pathname?.startsWith('/admin')
  const effectiveMode = isAdminRoute ? mode : 'light'
  const [drawerOpen, setDrawerOpen] = useState(!isMobile)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(true) // This should be from your auth system
  const [pageTitle, setPageTitle] = useState('Bäckerei-Management') // Default title

  // Set page title based on current path
  useEffect(() => {
    if (pathname) {
      if (pathname.includes('/admin/production/processes'))
        setPageTitle('Backstube: Produktionsprozesse')
      else if (pathname.includes('/admin/production/orders'))
        setPageTitle('Backstube: Bestelllisten')
      else if (pathname.includes('/admin/orders'))
        setPageTitle('Verkaufsbereich: Bestellungen')
      else if (pathname.includes('/admin/dashboard/sales'))
        setPageTitle('Verkaufsbereich: Statistik')
      else if (pathname.includes('/admin/dashboard/production'))
        setPageTitle('Backstube: Statistik')
      else if (pathname.includes('/admin/dashboard/management'))
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
          name: 'Start',
          icon: <DashboardIcon />,
          path: '/admin',
          roles: ['Management', 'Production', 'Sales'],
        },
        {
          name: 'Dashboard',
          icon: <DashboardIcon />,
          path: '/admin/dashboard',
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
          path: '/admin/bakery/processes',
          roles: ['Management', 'Production'],
        },
        {
          name: 'Rezepte',
          icon: <MenuBookIcon />,
          path: '/admin/bakery/recipes',
          roles: ['Management', 'Production'],
        },
        {
          name: 'Bestelllisten',
          icon: <AssignmentIcon />,
          path: '/admin/orders',
          roles: ['Management', 'Production'],
        },
        {
          name: 'Samstag Spezialproduktion',
          icon: <BakeryDiningIcon />,
          path: '/admin/bakery/saturday-production',
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
          path: '/admin/orders',
          roles: ['Management', 'Sales'],
        },
        {
          name: 'Produkte',
          icon: <InventoryIcon />,
          path: '/admin/products',
          roles: ['Management', 'Sales'],
        },
        {
          name: 'Verkaufsstatistik',
          icon: <BarChartIcon />,
          path: '/admin/dashboard/sales',
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
        {
          name: 'Social Media',
          icon: <ImageIcon />,
          path: '/admin/social-media',
          roles: ['Management', 'Sales'], // Assuming Sales might also use this
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
        color={effectiveMode === 'dark' ? 'inherit' : 'primary'}
        sx={{
          zIndex: muiTheme.zIndex.drawer + 1,
          backgroundColor:
            effectiveMode === 'dark'
              ? alpha(muiTheme.palette.background.paper, 0.9)
              : muiTheme.palette.primary.main,
          backdropFilter: 'blur(8px)',
          color: effectiveMode === 'dark' ? 'text.primary' : '#fff',
          boxShadow:
            effectiveMode === 'dark'
              ? '0 1px 8px rgba(0,0,0,0.15)'
              : '0 3px 10px rgba(0,0,0,0.2)',
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="toggle menu"
              onClick={() => setDrawerOpen(!drawerOpen)}
              edge="start"
              sx={{ mr: 1 }}
            >
              {drawerOpen && isMobile ? <CloseIcon /> : <MenuIcon />}
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mr: 1,
                  bgcolor:
                    effectiveMode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  justifyContent: 'center',
                }}
              >
                <Image
                  src="/admin/admin-logo.svg"
                  width={24}
                  height={24}
                  alt="Admin Logo"
                  style={{
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              </Box>
              <Box>
                <Typography
                  variant="h6"
                  component="span"
                  sx={{ fontWeight: 'bold', letterSpacing: '0.5px' }}
                >
                  Admin
                </Typography>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    opacity: 0.85,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    letterSpacing: '0.5px',
                    mt: -0.5,
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  Bäckerei-Verwaltung
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              textAlign: 'center',
              px: 2,
              display: { xs: 'none', md: 'block' },
            }}
          >
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                opacity: 0.95,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pageTitle}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Help Button */}
            <Tooltip title="Hilfe">
              <IconButton color="inherit" size="small" sx={{ ml: 1 }}>
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>

            {/* Notifications */}
            <Tooltip title="Benachrichtigungen">
              <IconButton color="inherit" size="small" sx={{ ml: 1 }}>
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Theme Toggle Button - only in admin */}
            {isAdminRoute && (
              <Box sx={{ ml: 1 }}>
                <ThemeToggler />
              </Box>
            )}

            {/* User Menu */}
            <Chip
              avatar={
                CURRENT_USER.avatar ? (
                  <Avatar
                    src={CURRENT_USER.avatar}
                    sx={{
                      bgcolor: 'primary.light',
                      color: '#fff',
                      boxShadow:
                        effectiveMode === 'dark'
                          ? '0 0 0 2px rgba(255,255,255,0.1)'
                          : 'none',
                    }}
                  />
                ) : (
                  <Avatar
                    sx={{
                      bgcolor: 'primary.light',
                      color: '#fff',
                      boxShadow:
                        effectiveMode === 'dark'
                          ? '0 0 0 2px rgba(255,255,255,0.1)'
                          : 'none',
                    }}
                  >
                    {CURRENT_USER.name.charAt(0)}
                  </Avatar>
                )
              }
              label={
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ fontWeight: 500 }}
                  >
                    {CURRENT_USER.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ display: 'block', opacity: 0.85 }}
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
                pr: { xs: 0.5, sm: 1.5 },
                py: 0.75,
                ml: 1.5,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: 'transparent',
                border: '1px solid',
                borderColor:
                  effectiveMode === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,255,255,0.3)',
                '&:hover': {
                  bgcolor:
                    effectiveMode === 'dark'
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.15)',
                },
                '& .MuiChip-label': {
                  px: 1,
                  color: effectiveMode === 'dark' ? 'text.primary' : '#fff',
                },
              }}
            />
          </Box>
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
            elevation={6}
            PaperProps={{
              sx: {
                minWidth: 200,
                borderRadius: 2,
                boxShadow:
                  effectiveMode === 'dark'
                    ? '0 4px 20px rgba(0,0,0,0.4)'
                    : '0 4px 20px rgba(0,0,0,0.15)',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {CURRENT_USER.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {CURRENT_USER.role === 'Management'
                  ? 'Geschäftsführung'
                  : CURRENT_USER.role === 'Production'
                  ? 'Bäckermeister'
                  : 'Verkauf'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                handleMenuClose()
                router.push('/admin/profile')
              }}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Mein Profil</ListItemText>
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose()
                router.push('/admin/security')
              }}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <SecurityIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Sicherheitseinstellungen</ListItemText>
            </MenuItem>
            <Divider />
            <Box
              sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'center' }}
            >
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<LogoutIcon />}
                onClick={() => {
                  handleMenuClose()
                  // Implement logout functionality (client-side only)
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('token')
                  }
                  setIsAuthenticated(false)
                }}
                sx={{ borderRadius: 2 }}
              >
                Abmelden
              </Button>
            </Box>
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
            borderRight:
              effectiveMode === 'dark'
                ? '1px solid rgba(255, 255, 255, 0.05)'
                : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow:
              effectiveMode === 'dark' ? 'none' : '2px 0 8px rgba(0,0,0,0.02)',
            bgcolor: effectiveMode === 'dark' ? 'background.paper' : 'white',
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
                sx={{
                  px: 3,
                  py: 1,
                  display: 'block',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  fontSize: '0.7rem',
                }}
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
                      borderRadius: '8px',
                      mx: 1,
                      my: 0.3,
                      color:
                        pathname === item.path
                          ? effectiveMode === 'dark'
                            ? '#fff'
                            : '#fff'
                          : 'text.primary',
                      bgcolor:
                        pathname === item.path
                          ? effectiveMode === 'dark'
                            ? 'primary.dark'
                            : 'primary.main'
                          : 'transparent',
                      '&:hover': {
                        bgcolor:
                          pathname === item.path
                            ? effectiveMode === 'dark'
                              ? 'primary.dark'
                              : 'primary.main'
                            : effectiveMode === 'dark'
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                      },
                      transition: 'all 0.2s',
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: pathname === item.path ? '#fff' : 'inherit',
                        minWidth: '42px',
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
          width: {
            sm: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)`,
          },
          mt: '64px', // Height of the AppBar
          p: { xs: 2, sm: 3 },
          transition: muiTheme.transitions.create(['width', 'margin'], {
            easing: muiTheme.transitions.easing.sharp,
            duration: muiTheme.transitions.duration.leavingScreen,
          }),
          bgcolor:
            effectiveMode === 'dark' ? 'background.default' : 'transparent',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default BakeryLayout
