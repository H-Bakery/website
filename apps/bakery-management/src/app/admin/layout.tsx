'use client'
import React from 'react'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  ShoppingCart as OrdersIcon,
  Inventory as InventoryIcon,
  LocalShipping as DeliveryIcon,
  ListAlt as BakingListIcon,
  Category as ProductsIcon,
  Factory as ProductionIcon,
  Store as ShopIcon,
  Assessment as ReportsIcon,
  PhotoCamera as SocialMediaIcon,
  Settings as SettingsIcon,
  People as StaffIcon,
  Euro as CashIcon,
  Notifications as NotificationsIcon,
  Storefront as BakeryIcon,
  Handshake as PartnersIcon,
  Insights as AnalyticsIcon,
  Forum as ChatIcon,
  ExpandLess,
  ExpandMore,
  RemoveShoppingCart as UnsoldIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MANAGEMENT_NAVIGATION, isNavItemActive } from './navigation'

const drawerWidth = 280

interface AdminLayoutProps {
  children: React.ReactNode
}

const iconMap: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon />,
  orders: <OrdersIcon />,
  production: <ProductionIcon />,
  inventory: <InventoryIcon />,
  products: <ProductsIcon />,
  baking: <BakingListIcon />,
  delivery: <DeliveryIcon />,
  reports: <ReportsIcon />,
  socialmedia: <SocialMediaIcon />,
  shop: <ShopIcon />,
  settings: <SettingsIcon />,
  staff: <StaffIcon />,
  cash: <CashIcon />,
  notifications: <NotificationsIcon />,
  bakery: <BakeryIcon />,
  partners: <PartnersIcon />,
  unsold: <UnsoldIcon />,
  analytics: <AnalyticsIcon />,
  chat: <ChatIcon />,
}

/**
 * Labels für Pfade mit dynamischem Segment, die so nicht in
 * MANAGEMENT_NAVIGATION stehen. Der Pfad wird vorher normalisiert, numerische
 * Segmente werden zu `[id]`. `null` blendet das Segment aus - eine nackte ID
 * sagt im Pfad niemandem etwas.
 */
const DYNAMIC_BREADCRUMB_LABELS: Record<string, string | null> = {
  '/admin/partners/[id]': null,
  '/admin/partners/[id]/visit': null,
  '/admin/partners/[id]/visit/new': 'Besuch erfassen',
  '/admin/partners/[id]/templates': 'Standard-Bestückung',
  '/admin/partners/[id]/report': 'Report',
}

/** Human readable breadcrumb segments for the current path. */
function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  const flat = MANAGEMENT_NAVIGATION.flatMap((item) => [
    item,
    ...(item.submenu ?? []),
  ])
  return segments
    .map((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/')
      const match = flat.find((item) => item.href === href)
      if (match) return match.label
      const pattern = href.replace(/\/\d+(?=\/|$)/g, '/[id]')
      if (pattern in DYNAMIC_BREADCRUMB_LABELS) {
        return DYNAMIC_BREADCRUMB_LABELS[pattern]
      }
      return segment
    })
    .filter((label): label is string => label !== null)
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()
  const [openSubmenus, setOpenSubmenus] = React.useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      MANAGEMENT_NAVIGATION.filter((item) =>
        item.submenu?.some((sub) => isNavItemActive(pathname, sub.href))
      ).map((item) => [item.label, true])
    )
  )

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleSubmenuToggle = (label: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Bäckerei Management
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {MANAGEMENT_NAVIGATION.map((item) => {
          const icon = item.icon ? iconMap[item.icon] : <DashboardIcon />

          // Handle items with submenus
          if (item.submenu) {
            const isSubmenuOpen = openSubmenus[item.label] || false
            const hasActiveChild = item.submenu.some((subItem) =>
              isNavItemActive(pathname, subItem.href)
            )

            return (
              <React.Fragment key={item.label}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleSubmenuToggle(item.label)}
                    aria-expanded={isSubmenuOpen}
                    sx={{
                      backgroundColor: hasActiveChild
                        ? 'action.selected'
                        : 'transparent',
                    }}
                  >
                    <ListItemIcon>{icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={item.description}
                    />
                    {isSubmenuOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                </ListItem>
                <List
                  component="div"
                  disablePadding
                  sx={{ display: isSubmenuOpen ? 'block' : 'none' }}
                >
                  {item.submenu.map((subItem) => {
                    if (!subItem.href) return null
                    const isActive = isNavItemActive(pathname, subItem.href)
                    const subIcon = subItem.icon ? iconMap[subItem.icon] : null

                    return (
                      <ListItem key={subItem.href} disablePadding>
                        <ListItemButton
                          component={Link}
                          href={subItem.href}
                          selected={isActive}
                          sx={{
                            pl: 4,
                            '&.Mui-selected': {
                              backgroundColor: 'primary.main',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: 'primary.dark',
                              },
                              '& .MuiListItemIcon-root': {
                                color: 'white',
                              },
                            },
                          }}
                        >
                          {subIcon && <ListItemIcon>{subIcon}</ListItemIcon>}
                          <ListItemText
                            primary={subItem.label}
                            secondary={subItem.description}
                          />
                        </ListItemButton>
                      </ListItem>
                    )
                  })}
                </List>
              </React.Fragment>
            )
          }

          // Handle external links
          if (item.external) {
            return (
              <ListItem key={item.href} disablePadding>
                <ListItemButton
                  component="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    backgroundColor: 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                  />
                </ListItemButton>
              </ListItem>
            )
          }

          // Handle regular items
          if (!item.href) return null
          const isActive = isNavItemActive(pathname, item.href)
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Navigation öffnen"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Management System
          </Typography>
          {process.env.NODE_ENV !== 'production' && (
            <Typography variant="body2" color="inherit">
              Entwicklung
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          overflowX: 'hidden',
        }}
      >
        <Toolbar />

        {/* Simple Breadcrumb */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            aria-label="Pfad"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {getBreadcrumb(pathname).join(' › ')}
          </Typography>
        </Box>

        {children}
      </Box>
    </Box>
  )
}
