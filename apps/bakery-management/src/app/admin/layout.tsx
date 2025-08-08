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
  useMediaQuery,
  useTheme,
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
} from '@mui/icons-material'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const drawerWidth = 280

interface AdminLayoutProps {
  children: React.ReactNode
}

// Temporarily define navigation items directly in the file
const MANAGEMENT_NAVIGATION = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: 'dashboard',
    description: 'Übersicht',
  },
  {
    label: 'Bestellungen',
    href: '/admin/orders',
    icon: 'orders',
    description: 'Bestellverwaltung',
  },
  {
    label: 'Produktion',
    href: '/admin/production',
    icon: 'production',
    description: 'Produktionsplanung',
  },
  {
    label: 'Lagerbestand',
    href: '/admin/inventory',
    icon: 'inventory',
    description: 'Lagerverwaltung',
  },
  {
    label: 'Produkte',
    href: '/admin/products',
    icon: 'products',
    description: 'Produktverwaltung',
  },
  {
    label: 'Backliste',
    href: '/admin/baking-list',
    icon: 'baking',
    description: 'Tägliche Backliste',
  },
  {
    label: 'Lieferung',
    href: '/admin/delivery',
    icon: 'delivery',
    description: 'Lieferverwaltung',
  },
  {
    label: 'Berichte',
    href: '/admin/reports',
    icon: 'reports',
    description: 'Tagesberichte',
  },
  {
    label: 'Social Media',
    href: '/admin/social-media',
    icon: 'socialmedia',
    description: 'Content Creator',
  },
  {
    label: 'Shop',
    href: 'http://localhost:4201',
    icon: 'shop',
    description: 'Zum Shop',
    external: true,
  },
]

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
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
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
          const isActive = pathname === item.href
          const icon = item.icon ? iconMap[item.icon] : <DashboardIcon />

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
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Management System
          </Typography>
          <Typography variant="body2" color="inherit">
            Development
          </Typography>
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />

        {/* Simple Breadcrumb */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {pathname.split('/').filter(Boolean).join(' › ')}
          </Typography>
        </Box>

        {children}
      </Box>
    </Box>
  )
}
