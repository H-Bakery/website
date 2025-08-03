import React from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Store as ShopIcon,
  Home as HomeIcon,
  Info as InfoIcon,
  Business as BusinessIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { NavigationItem, getNavigationForApp } from '@bakery/shared/utils'

export interface AppNavigationProps {
  /**
   * Current application type
   */
  app: 'landing' | 'shop' | 'management'

  /**
   * Application title
   */
  title?: string

  /**
   * Show mobile menu
   */
  showMobileMenu?: boolean

  /**
   * Custom navigation items (overrides default)
   */
  customNavigation?: NavigationItem[]

  /**
   * Additional content to render in toolbar
   */
  children?: React.ReactNode

  /**
   * Navigation variant
   */
  variant?: 'default' | 'minimal' | 'mobile-friendly'
}

/**
 * Shared application navigation component
 * Provides consistent navigation across all bakery applications
 */
export function AppNavigation({
  app,
  title,
  showMobileMenu = true,
  customNavigation,
  children,
  variant = 'default',
}: AppNavigationProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileMenuAnchor, setMobileMenuAnchor] =
    React.useState<null | HTMLElement>(null)

  const navigation = customNavigation || getNavigationForApp(app)

  // App specific configuration
  const appConfig = {
    landing: {
      title: 'Bäckerei Heusser',
      icon: <HomeIcon />,
      color: 'primary' as const,
    },
    shop: {
      title: 'Online Shop',
      icon: <ShopIcon />,
      color: 'secondary' as const,
    },
    management: {
      title: 'Verwaltung',
      icon: <BusinessIcon />,
      color: 'primary' as const,
    },
  }

  const config = appConfig[app]
  const displayTitle = title || config.title

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget)
  }

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null)
  }

  const renderNavigationItems = () => {
    if (variant === 'minimal') {
      return null
    }

    return navigation.map((item) => (
      <Button
        key={item.href}
        color="inherit"
        component={item.external ? 'a' : Link}
        href={item.href}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        sx={{
          mx: 1,
          textTransform: 'none',
          fontSize: '1rem',
        }}
      >
        {item.label}
      </Button>
    ))
  }

  const renderMobileMenu = () => {
    if (!showMobileMenu || variant === 'minimal') {
      return null
    }

    return (
      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {navigation.map((item) => (
          <MenuItem
            key={item.href}
            component={item.external ? 'a' : Link}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            onClick={handleMobileMenuClose}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    )
  }

  if (variant === 'mobile-friendly' && isMobile) {
    return (
      <AppBar position="static" color={config.color}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            {config.icon}
            <Typography variant="h6" component="div" sx={{ ml: 1 }}>
              {displayTitle}
            </Typography>
          </Box>

          {children}

          <IconButton color="inherit" onClick={handleMobileMenuOpen} edge="end">
            <MenuIcon />
          </IconButton>

          {renderMobileMenu()}
        </Toolbar>
      </AppBar>
    )
  }

  return (
    <AppBar position="static" color={config.color}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {config.icon}
          <Typography variant="h6" component="div" sx={{ ml: 1 }}>
            {displayTitle}
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Desktop Navigation */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {renderNavigationItems()}
          </Box>
        )}

        {/* Additional content */}
        {children}

        {/* Mobile Menu Button */}
        {isMobile && showMobileMenu && variant !== 'minimal' && (
          <IconButton color="inherit" onClick={handleMobileMenuOpen} edge="end">
            <MenuIcon />
          </IconButton>
        )}

        {renderMobileMenu()}
      </Toolbar>
    </AppBar>
  )
}

export default AppNavigation
