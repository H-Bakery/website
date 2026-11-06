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
  AccountBalance as FinanceIcon,
  Flag as TargetIcon,
  Login as LoginIcon,
  ManageAccounts as UsersIcon,
  Checklist as PickupIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MANAGEMENT_NAVIGATION,
  PILOT_UPCOMING_NAVIGATION,
  getNavigation,
  type NavItem,
  isNavItemActive,
  navHrefs,
} from './navigation'
import { isPilotMode, isPilotPathAllowed } from '../../lib/pilotMode'
import PilotUnavailable from '../../components/pilot/PilotUnavailable'
import { useOptionalSession } from '../../lib/session'
import {
  ROLE_LABELS,
  getNavigationForRole,
  isPathAllowedForRole,
  startPathForRole,
  STATION_NO_ACCESS_REASON,
} from '../../lib/roles'
import NoAccess from '../../components/auth/NoAccess'
import LogoutButton from '../../components/auth/LogoutButton'

const drawerWidth = 280

/** Kennzeichen rechts in der AppBar: nie umbrechen, nie gequetscht. */
const statusLabelSx = { ml: 1, flexShrink: 0, whiteSpace: 'nowrap' } as const

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
  finance: <FinanceIcon />,
  target: <TargetIcon />,
  login: <LoginIcon />,
  users: <UsersIcon />,
  pickup: <PickupIcon />,
  help: <HelpIcon />,
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
  // Vorbestellungen an der Sammelstelle: die nackte ID sagt niemandem etwas,
  // die Referenz (MO-…) steht auf der Seite selbst.
  '/admin/delivery/preorders/[id]': null,
  '/admin/delivery/preorders/new': 'Neue Vorbestellung',
  '/admin/delivery/preorders/backliste': 'Backliste',
  '/admin/delivery/preorders/lieferstelle': 'Lieferstelle',
  '/admin/backzettel/grundmengen': 'Grundmengen',
  // Vorbestellungen (P1/P3): der Code steht auf der Seite selbst.
  '/admin/preorders/[id]': null,
  '/admin/preorders/neu': 'Neue Vorbestellung',
  '/admin/preorders/tag': 'Tagesübersicht',
}

/** Human readable breadcrumb segments for the current path. */
function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean)
  const flat: NavItem[] = [
    ...MANAGEMENT_NAVIGATION.flatMap((item) => [item, ...(item.submenu ?? [])]),
    ...PILOT_UPCOMING_NAVIGATION,
  ]
  return segments
    .map((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/')
      const match = flat.find((item) => item.href === href)
      if (match) return match.label
      // Submenu parents ("Bäckerei") carry no href of their own, so match them by
      // the path their children share — otherwise the raw segment leaks through.
      const parent = MANAGEMENT_NAVIGATION.find((item) =>
        item.submenu?.some((sub) => sub.href?.startsWith(`${href}/`))
      )
      if (parent) return parent.label
      const pattern = href.replace(/\/\d+(?=\/|$)/g, '/[id]')
      if (pattern in DYNAMIC_BREADCRUMB_LABELS) {
        return DYNAMIC_BREADCRUMB_LABELS[pattern]
      }
      return segment
    })
    .filter((label): label is string => label !== null)
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  // Die Anmeldeseite steht ohne Seitenleiste und Navigation da.
  if (pathname === '/admin/login') {
    return (
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: { xs: 'flex-start', sm: 'center' },
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    )
  }
  return <AdminShell pathname={pathname}>{children}</AdminShell>
}

function AdminShell({
  children,
  pathname,
}: AdminLayoutProps & { pathname: string }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // Rolle (F1): Navigation und Seiten-Sperre nach ROLE_ACCESS
  // (src/lib/roles.ts). Ohne SessionProvider (Layout-Tests) gilt die volle
  // Navigation - in der App rendert der RouteGuard das Layout nur mit
  // gültiger Sitzung.
  const session = useOptionalSession()
  const user = session?.user ?? null
  const role = user?.role ?? null
  const sessionKind = session?.sessionKind ?? null
  // Pilotbetrieb (F2): gefilterte Navigation und Sperre der Demo-Seiten - die
  // erlaubten Routen stehen genau einmal in src/lib/pilotMode.ts.
  // Die Sperre hier ist Bedienführung im Browser. Durchgesetzt wird der
  // Zugriff serverseitig von src/proxy.ts (Pilot-Sperre + Sitzungs-Cookie mit
  // Rollenprüfung, F1) und von den Rollen-Guards der API.
  const pilot = isPilotMode()
  const navigation = React.useMemo(
    () =>
      role
        ? getNavigationForRole(role, pilot, sessionKind)
        : getNavigation(pilot),
    [pilot, role, sessionKind]
  )
  const allHrefs = React.useMemo(() => navHrefs(navigation), [navigation])
  const blocked = !isPilotPathAllowed(pathname, pilot)
  const forbidden =
    role !== null && !isPathAllowedForRole(pathname, role, sessionKind)
  const isStation = session?.sessionKind === 'station'
  const [openSubmenus, setOpenSubmenus] = React.useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      getNavigation(pilot)
        .filter((item) =>
          item.submenu?.some((sub) =>
            isNavItemActive(pathname, sub.href, allHrefs)
          )
        )
        .map((item) => [item.label, true])
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
          Bäckerei Heusser
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {navigation.map((item) => {
          const icon = item.icon ? iconMap[item.icon] : <DashboardIcon />

          // Handle items with submenus
          if (item.submenu) {
            const isSubmenuOpen = openSubmenus[item.label] || false
            const hasActiveChild = item.submenu.some((subItem) =>
              isNavItemActive(pathname, subItem.href, allHrefs)
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
                    const isActive = isNavItemActive(
                      pathname,
                      subItem.href,
                      allHrefs
                    )
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
                              color: 'primary.contrastText',
                              '&:hover': {
                                backgroundColor: 'primary.dark',
                              },
                              '& .MuiListItemIcon-root': {
                                color: 'primary.contrastText',
                              },
                              '& .MuiListItemText-secondary': {
                                color: 'inherit',
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
          const isActive = isNavItemActive(pathname, item.href, allHrefs)
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                    '& .MuiListItemText-secondary': {
                      color: 'inherit',
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
            // W4-Verifikation: 48 px statt 40 px - Touch-Ziel am Handy/Tablet.
            sx={{ mr: 2, display: { md: 'none' }, width: 48, height: 48 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Verwaltung
          </Typography>
          {/* Auf Handys (xs) ist das Kennzeichen ausgeblendet - dort brauchen
              Name und Abmelden den Platz (F1). Ab sm kürzt sich der Titel, das
              Kennzeichen bleibt ganz und mit Abstand stehen (F3). */}
          {pilot ? (
            <Typography
              variant="body2"
              color="inherit"
              sx={{ ...statusLabelSx, display: { xs: 'none', sm: 'block' } }}
            >
              Pilotbetrieb
            </Typography>
          ) : (
            process.env.NODE_ENV !== 'production' && (
              <Typography
                variant="body2"
                color="inherit"
                sx={{ ...statusLabelSx, display: { xs: 'none', sm: 'block' } }}
              >
                Entwicklung
              </Typography>
            )
          )}
          {user && (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2 }}
            >
              <Box
                sx={{
                  textAlign: 'right',
                  display: { xs: isStation ? 'block' : 'none', sm: 'block' },
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="body2"
                  color="inherit"
                  noWrap
                  data-testid="session-user"
                >
                  {user.displayName}
                </Typography>
                <Typography
                  variant="caption"
                  color="inherit"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {ROLE_LABELS[user.role]}
                  {isStation ? ' · Station' : ''}
                </Typography>
              </Box>
              {/* Auf einer Station groß und gefüllt: wer fertig ist, tippt
                  hier und das Tablet steht wieder bei den Namenskacheln. */}
              <LogoutButton
                color="inherit"
                variant={isStation ? 'outlined' : 'text'}
                size={isStation ? 'large' : 'medium'}
              />
            </Box>
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

        {blocked ? (
          <PilotUnavailable />
        ) : forbidden && role ? (
          <NoAccess
            roleLabel={ROLE_LABELS[role]}
            startPath={startPathForRole(role)}
            reason={
              sessionKind === 'station' && isPathAllowedForRole(pathname, role)
                ? STATION_NO_ACCESS_REASON
                : undefined
            }
          />
        ) : (
          children
        )}
      </Box>
    </Box>
  )
}
