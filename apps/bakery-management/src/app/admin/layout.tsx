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
  ListAlt as BakingListIcon,
  Category as ProductsIcon,
  Factory as ProductionIcon,
  Store as ShopIcon,
  Assessment as ReportsIcon,
  PhotoCamera as SocialMediaIcon,
  Settings as SettingsIcon,
  Handshake as PartnersIcon,
  Insights as AnalyticsIcon,
  ExpandLess,
  ExpandMore,
  RemoveShoppingCart as UnsoldIcon,
  AccountBalance as FinanceIcon,
  Flag as TargetIcon,
  Login as LoginIcon,
  ManageAccounts as UsersIcon,
  Checklist as PickupIcon,
  HelpOutline as HelpIcon,
  Place as PickupPointIcon,
  QueryStats as RestSummaryIcon,
} from '@mui/icons-material'
import type { Theme } from '@mui/material/styles'
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
import { formatDateLong, isIsoDate } from '../../lib/backzettelFormat'
import { useFocusNotObscured } from '../../components/layout/focusNotObscured'
import { FOCUS_RING_COLOR } from '../../lib/muiTheme'

/** Ziel des Sprunglinks „Zum Inhalt springen“ (`<main>`). */
const MAIN_CONTENT_ID = 'inhalt'
const MOBILE_NAV_ID = 'navigation-mobil'

const drawerWidth = 280

/**
 * Navigationseinträge: ruhig statt leuchtend. Der gewählte Eintrag bekommt
 * `action.selected` als Fläche, einen Balken in `primary.main` und halbfette
 * Schrift - Text bleibt `text.primary` (Dunkelmodus-Regel: keine Schrift auf
 * `*.main`). `dense` + einzeilige Beschreibung: alle Einträge passen ohne
 * Scrollen in die Seitenleiste eines 900-px-Fensters; die volle
 * Beschreibung steht im Tooltip (`title`).
 */
const navItemSx = {
  mx: 1,
  my: 0.25,
  borderRadius: 1,
  minHeight: 44,
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: 'action.selected',
    boxShadow: (theme: Theme) => `inset 3px 0 0 ${theme.palette.primary.main}`,
  },
  '&.Mui-selected .MuiListItemIcon-root': { color: 'primary.main' },
  '&.Mui-selected .MuiListItemText-primary': { fontWeight: 600 },
} as const

const navTextProps = {
  primaryTypographyProps: { variant: 'body2' as const, fontWeight: 500 },
  secondaryTypographyProps: { variant: 'caption' as const, noWrap: true },
}

/**
 * Im Druck weg (Review r2): AppBar („Verwaltung · Pilotbetrieb · Name“),
 * Seitenleiste und ihr Platzhalter. Vorher kam das nur bei Seiten mit
 * eigener Druckansicht weg; der Kassentag druckte die blaue Leiste und die
 * leere Seitenleiste deckte die erste Karte halb zu.
 */
const PRINT_HIDDEN = { '@media print': { display: 'none' } } as const

/** Kennzeichen rechts in der AppBar: nie umbrechen, nie gequetscht. */
const statusLabelSx = { ml: 1, flexShrink: 0, whiteSpace: 'nowrap' } as const

interface AdminLayoutProps {
  children: React.ReactNode
}

const iconMap: Record<string, React.ReactElement> = {
  dashboard: <DashboardIcon />,
  orders: <OrdersIcon />,
  production: <ProductionIcon />,
  products: <ProductsIcon />,
  baking: <BakingListIcon />,
  reports: <ReportsIcon />,
  socialmedia: <SocialMediaIcon />,
  shop: <ShopIcon />,
  settings: <SettingsIcon />,
  partners: <PartnersIcon />,
  unsold: <UnsoldIcon />,
  analytics: <AnalyticsIcon />,
  finance: <FinanceIcon />,
  target: <TargetIcon />,
  login: <LoginIcon />,
  users: <UsersIcon />,
  pickup: <PickupIcon />,
  help: <HelpIcon />,
  pickuppoint: <PickupPointIcon />,
  restsummary: <RestSummaryIcon />,
}

/**
 * Labels für Pfade mit dynamischem Segment, die so nicht in
 * MANAGEMENT_NAVIGATION stehen. Der Pfad wird vorher normalisiert, numerische
 * Segmente werden zu `[id]`. `null` blendet das Segment aus - eine nackte ID
 * sagt im Pfad niemandem etwas.
 */
const DYNAMIC_BREADCRUMB_LABELS: Record<string, string | null> = {
  // Review r1: der Pfad endet überall mit der aktuellen Seite - der Name des
  // Partners / der Code der Vorbestellung steht als h1 darunter.
  '/admin/partners/[id]': 'Partner',
  '/admin/partners/[id]/visit': null,
  '/admin/partners/[id]/visit/new': 'Besuch erfassen',
  '/admin/partners/[id]/templates': 'Standard-Bestückung',
  '/admin/partners/[id]/report': 'Report',
  // Vorbestellungen an der Sammelstelle: die nackte ID sagt niemandem etwas,
  // die Referenz (MO-…) steht auf der Seite selbst.
  // `/admin/delivery` selbst ist keine Seite mehr (B12, Weiterleitung).
  '/admin/delivery': null,
  '/admin/delivery/preorders/[id]': 'Vorbestellung',
  '/admin/delivery/preorders/new': 'Neue Vorbestellung',
  '/admin/delivery/preorders/backliste': 'Backliste',
  '/admin/delivery/preorders/lieferstelle': 'Lieferstelle',
  '/admin/backzettel/grundmengen': 'Grundmengen',
  // Vorbestellungen (P1/P3): der Code steht auf der Seite selbst.
  '/admin/preorders/[id]': 'Vorbestellung',
  '/admin/preorders/neu': 'Neue Vorbestellung',
  '/admin/preorders/tag': 'Tagesübersicht',
  '/admin/products/new': 'Neues Produkt',
  // W4-verify r3: Unterseiten ohne eigenen Navigationseintrag
  '/admin/analytics/products': 'Produkte',
  '/admin/analytics/revenue': 'Umsatz',
  '/admin/nicht-verfuegbar': 'Nicht verfügbar',
  '/admin/sitzung-pruefen': 'Anmeldung prüfen',
}

/**
 * Human readable breadcrumb segments for the current path. Ohne
 * `includeRoot` fällt „Dashboard“ weg - für Rollen, die das Dashboard nicht
 * öffnen dürfen (Fahrer), wäre es ein toter Anfang.
 */
function getBreadcrumb(pathname: string, includeRoot = true): string[] {
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
      // W4-verify r2: Produkt-ID (Slug) und Backzettel-Datum nicht roh zeigen
      if (/^\/admin\/products\/[^/]+$/.test(href)) return 'Bearbeiten'
      // Tage (Backzettel, Kassenbericht …) als „Donnerstag, 05.11.2026“
      if (isIsoDate(segment)) return formatDateLong(segment)
      return segment
    })
    .filter((label): label is string => label !== null)
    .filter((_label, index) => includeRoot || index > 0)
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
  // Klebende Speichern-Leisten und die AppBar decken ein Feld beim Tabben
  // nicht mehr zu (Layout-Kit, Review r2).
  useFocusNotObscured()
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
  // Pfad: nicht auf dem Dashboard selbst (stünde „Dashboard“ über „Dashboard“)
  // und ohne „Dashboard“ für Rollen, die es nicht öffnen dürfen.
  const breadcrumb =
    pathname === '/admin'
      ? []
      : getBreadcrumb(
          pathname,
          role === null || isPathAllowedForRole('/admin', role, sessionKind)
        )
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
      <List sx={{ py: 1 }}>
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
                    dense
                    onClick={() => handleSubmenuToggle(item.label)}
                    aria-expanded={isSubmenuOpen}
                    sx={{
                      ...navItemSx,
                      backgroundColor: hasActiveChild
                        ? 'action.selected'
                        : 'transparent',
                    }}
                  >
                    <ListItemIcon>{icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={item.description}
                      {...navTextProps}
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
                          dense
                          component={Link}
                          href={subItem.href}
                          selected={isActive}
                          aria-current={isActive ? 'page' : undefined}
                          title={subItem.description}
                          sx={{ ...navItemSx, pl: 4 }}
                        >
                          {subIcon && <ListItemIcon>{subIcon}</ListItemIcon>}
                          <ListItemText
                            primary={subItem.label}
                            secondary={subItem.description}
                            {...navTextProps}
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
                  dense
                  component="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.description}
                  sx={navItemSx}
                >
                  <ListItemIcon>{icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                    {...navTextProps}
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
                dense
                component={Link}
                href={item.href}
                selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                title={item.description}
                sx={navItemSx}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  {...navTextProps}
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
      {/* Sprunglink (Review r2): sonst führt Tab am PC erst durch Abmelden
          und 15 Navigationseinträge, bevor die Seite kommt. Unsichtbar, bis
          er den Fokus hat. */}
      <Box
        component="a"
        href={`#${MAIN_CONTENT_ID}`}
        data-testid="skip-link"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: (theme: Theme) => theme.zIndex.tooltip + 1,
          px: 2,
          py: 1.5,
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 8,
          fontWeight: 600,
          transform: 'translateY(-200%)',
          // ohne Übergang (global.css blendet `transform` bei :focus über
          // 0,2 s): der Link stünde sonst kurz halb unter der AppBar
          transition: 'none',
          '&:focus': {
            transform: 'none',
            transition: 'none',
            // derselbe Ring wie an Knöpfen (lib/muiTheme.ts), nicht das
            // Magenta aus global.css
            outline: '2px solid',
            outlineColor: (theme: Theme) =>
              FOCUS_RING_COLOR[theme.palette.mode],
            outlineOffset: 2,
          },
          '&::after': { display: 'none' },
          '@media print': { display: 'none' },
        }}
      >
        Zum Inhalt springen
      </Box>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          ...PRINT_HIDDEN,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="Navigation öffnen"
            aria-expanded={mobileOpen}
            aria-controls={MOBILE_NAV_ID}
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
        aria-label="Hauptnavigation"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          ...PRINT_HIDDEN,
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          PaperProps={{ id: MOBILE_NAV_ID }}
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
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        sx={{
          // Ziel des Sprunglinks: kein Fokusrahmen um die ganze Seite
          '&:focus': { outline: 'none' },
          flexGrow: 1,
          // Der einzige Seitenrand (Gutter) der App: 16 px am Handy, 24 px ab
          // Tablet. Seiten (PageLayout) geben keinen eigenen dazu.
          p: { xs: 2, sm: 3 },
          minWidth: 0,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          // `clip`, nicht `hidden`: `overflow-x: hidden` macht <main> zum
          // Scroll-Container (overflow-y wird `auto`), ohne dass <main> selbst
          // scrollt - jedes `position: sticky` darunter (Speichern-Leisten,
          // Tabellenköpfe) klebte dann nie. `clip` schneidet nur ab.
          overflowX: 'clip',
          // Druck jeder Seite (Review r2): ohne AppBar und Seitenleiste
          // steht der Inhalt ab dem oberen Rand über die ganze Breite.
          // Seiten mit eigener Druckansicht setzen dasselbe noch einmal.
          '@media print': {
            p: 0,
            width: '100%',
            overflow: 'visible',
          },
        }}
      >
        <Toolbar sx={PRINT_HIDDEN} />

        {/* Pfad - leise über dem Seitentitel, im Druck ausgeblendet. Am
            Handy weg: dort stehen Rücklink und h1 schon untereinander, der
            Pfad schob den Inhalt nur weiter nach unten (Review r1). */}
        {breadcrumb.length > 0 && (
          <Box
            data-testid="breadcrumb"
            sx={{
              mb: 1,
              display: { xs: 'none', sm: 'block' },
              '@media print': { display: 'none' },
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              aria-label="Pfad"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {breadcrumb.join(' › ')}
            </Typography>
          </Box>
        )}

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
