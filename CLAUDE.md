# Bakery Website - Claude Code Project Instructions

## Project Overview

This is a full-stack bakery management system built with Next.js, Material UI, and TypeScript in an Nx monorepo architecture.

**Architecture:**

- Frontend: Next.js 15 with App Router, Material UI, TypeScript
- Backend: TypeScript with domain-driven design (Express + Sequelize)
- Testing: Jest + React Testing Library
- State Management: React Context (Theme, Cart, Authentication)
- API Integration: bakeryAPI service with mock data fallback

**Deployment Targets:**

- Landing Page → GitHub Pages (static export)
- Shop System → Vercel (SSR for performance)
- Management System → Vercel (CSR for interactivity)
- Backend API → Google Cloud Run (containerized)

## Quick Commands

### Development

```bash
npm run dev                 # Start development server
npm run build              # Build for production
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run lint               # Run ESLint
```

### Nx Commands

```bash
# Development (working services)
npm run dev:landing          # Landing page (port 3000) ✓
npm run serve:shop           # Shop app (port 4200) ✓
npm run serve:management     # Management app (port 4201) ✓
npm run serve:api:simple     # Simple API server with mock data (port 5000) ✓

# API (TypeScript build - has compilation errors, see TASK-001)
npm run serve:api            # Full TS API - currently broken due to migration issues

# Building
nx build bakery-shop       # Build shop app
nx next:build bakery-landing  # Build landing page with Nx dependencies
nx build-static-standalone bakery-landing  # Build landing page standalone (recommended)
nx affected:build          # Build only affected projects

# Static Export (Landing Page)
nx build-static-standalone bakery-landing  # Recommended: standalone static build
npm run build:landing:static               # Same as above
npm run build:landing:nx                   # Uses Nx dependencies (may fail)
nx build-static bakery-landing             # Full Nx build + export

# Testing & Quality
nx affected:test           # Test only affected projects
nx affected:lint           # Lint affected projects
nx format:write            # Format code
```

## Project Structure (Nx Monorepo)

```
website/
├── apps/                              # Applications (deployable units)
│   ├── bakery-landing/               # Public landing page (GitHub Pages) - port 3000
│   ├── bakery-shop/                  # Customer e-commerce (Vercel SSR)
│   ├── bakery-management/            # Internal management (Vercel CSR)
│   ├── bakery-delivery/              # Delivery tracking app
│   ├── bakery-api/                   # Backend API (Cloud Run) - port 5000
│   └── *-e2e/                        # E2E test apps for each application
├── libs/                             # Shared libraries
│   ├── api/                          # API domain libraries
│   ├── shared/                       # Cross-app shared code (types, utils, UI)
│   ├── bakery-management/            # Management-specific feature libs
│   ├── bakery-shop/                  # Shop-specific feature libs
│   ├── bakery-delivery-routing/      # Delivery routing logic
│   └── bakery-delivery-tracking/     # Delivery tracking logic
├── content/                          # Content files (news, markdown)
├── docs/                             # Documentation
│   ├── architecture.md               # System design
│   ├── development.md                # Dev workflow
│   └── testing-guide.md              # Testing strategies
└── monitoring/                       # Monitoring configuration
```

## Key Features

### Customer Experience

- Product browsing with category filtering
- Shopping cart with persistence
- Real-time inventory checking
- German localization throughout

### Admin Dashboard

- Order management with DataGrid
- Inventory tracking
- Production workflow management
- User authentication with JWT

## Testing Guidelines

- Write tests alongside implementation
- Maintain >80% coverage
- Use React Testing Library best practices
- Run `npm test` before committing

## Development Workflow

1. Check current status: `git status`
2. Run tests: `npm test`
3. Lint code: `npm run lint`
4. Build to verify: `npm run build`

## Service Status (as of 2026-03-01)

| Service       | Command                    | Port | Status                                       |
| ------------- | -------------------------- | ---- | -------------------------------------------- |
| Landing Page  | `npm run dev:landing`      | 3000 | Working                                      |
| Shop          | `npm run serve:shop`       | 4200 | Working                                      |
| Management    | `npm run serve:management` | 4201 | Working                                      |
| Delivery      | `npm run serve:delivery`   | 4300 | Working (braucht die API)                    |
| API (simple)  | `npm run serve:api:simple` | 5000 | Working (mock data)                          |
| API (full TS) | `npm run serve:api`        | 5000 | Broken (TS compilation errors, see TASK-001) |

The full TypeScript API (`bakery-api`) has systemic compilation errors from an incomplete JS→TS migration. Use `serve:api:simple` for a working API with mock endpoints.

## Verkaufspartner (Backschrank CAP-Markt)

Erfasst wird ein **Besuch** am Backschrank, nicht eine Lieferung. Jeder Besuch hält fest, was
noch dalag (`countedQty`) und was neu eingeräumt wurde (`deliveredQty`); Verkaufszahlen werden
daraus **berechnet** und nie eingegeben.

Drei Dinge, die man wissen muss, bevor man hier etwas ändert:

- **Alle Formeln stehen genau einmal**, in `apps/bakery-api/src/services/partner-stats.core.js` -
  dependency-freies CommonJS. Es benutzen sie die echte API (`partner-stats.service.ts`, nur ein
  typisierter Wrapper), der Mock-Server (`simple-server.js`) und die Tests. Keine zweite
  Implementierung anlegen; die beiden Server würden sonst auseinanderlaufen.
  Weil `@nx/js:tsc` ohne `allowJs` läuft, steht die Datei in `project.json` unter `assets` -
  sonst fehlt sie in `dist/` und `require('./partner-stats.core')` greift ins Leere.
- **Ein Geschäftstag ohne `pickup`-Besuch ist offen.** Verkauf und Umsatz sind dann vorläufig
  (`stats.isProvisional`, `openDates`). Ohne diese Kennzeichnung liest sich ein unvollständiger
  Tag im Report als 100 % Abverkauf. Detail-Seite und Report markieren das; nicht wegoptimieren.
- **`countedQty: null` heißt "nicht gezählt", `0` heißt "Schrank war leer".** Der Unterschied
  ändert die Verkaufszahlen. Die Erfassungsmaske hält ihn auseinander, ein Test sichert das ab.

Die Tagesformel aus der Aufgabe (`Σ Geliefert − Rest bei der Abholung`) stimmt nur, wenn der
letzte Besuch eine Abholung ohne Lieferung ist. Der Core rechnet stattdessen je Produkt einen
Bestands-Automaten (`sold += Bestand − gezählt; Bestand = gezählt + geliefert`) - das ergibt auf
abgeschlossenen Tagen dasselbe und bleibt auf offenen Tagen richtig.

Preise und Produktnamen werden **als Snapshot** auf `PartnerVisitItem` gespeichert, damit eine
spätere HQ-Preisänderung alte Abrechnungen nicht rückwirkend verändert.

Tests der Rechenlogik: `apps/bakery-api/tests/unit/partnerStats.test.js`. Achtung -
`apps/bakery-api/jest.config.js` hat `testMatch: ["**/tests/**/*.test.js"]`, führt also **nur**
plain-JS-Tests unter `tests/` aus. Die TypeScript-Specs unter `src/**/__tests__/` laufen nie mit.

## Liefertouren (Samstagsauslieferung)

Die Fahrer-App `bakery-delivery` (Port 4300) fährt die Samstagstour mit ein bis zwei Fahrern. Eine
**Tour** gehört einem Tag und einem Fahrer und besteht aus **Stopps** in gefahrener Reihenfolge; der
Fahrer hakt `done` / `failed` ab. Das ist etwas anderes als der Backschrank-**Besuch** oben: dort
wird der Restbestand gezählt und der Verkauf berechnet, hier wird nur zugestellt.

Details stehen in `apps/bakery-delivery/CLAUDE.md`. Vier Dinge, die man von außen wissen muss:

- **Alle Server-Formeln stehen genau einmal**, in `apps/bakery-api/src/services/delivery-tours.core.js`
  (dependency-freies CommonJS, gleiche Konvention wie `partner-stats.core.js`, gleiche `*.core.js`-Glob
  unter `assets`). Das Frontend hat in `@bakery/delivery/routing` eine zweite, TypeScript-Fassung
  derselben Geometrie — die CommonJS/ESM-Grenze lässt sich nicht ohne Build-Umbau überbrücken. Wer
  Haversine, Umwegfaktor oder Standzeit ändert, muss **beide** Dateien anfassen.
- **Adresssuche (Nominatim) und Routing (OSRM) sind optional.** Fällt ein Dienst aus, rechnet
  `delivery-geo.core.js` mit Schätzformeln weiter und setzt `isEstimate: true`; die Oberfläche
  schreibt „(geschätzt)" dahinter. Nicht wegoptimieren — sonst liest sich eine Luftlinien-Schätzung
  wie eine gemessene Strecke. Samstags früh muss die Liste auch ohne fremde Server da sein.
- **Die Endpunkte liegen in `simple-server.js`** unter `/api/deliveries/*`, der Store als JSON in
  `apps/bakery-api/data/delivery-store.json` (gitignored). Ein Server, der vor diesen Routen
  gestartet wurde, antwortet mit 404 — neu starten.
- **`Number(null)` ist `0`.** Ein Stopp ohne gefundene Adresse galt dadurch als Punkt (0, 0) und zog
  die ganze Tour in den Atlantik. Koordinaten deshalb immer mit `hasCoordinates()` prüfen, nie mit
  `Number.isFinite(Number(x))`.

Tests: `npx nx test delivery-routing` (25), `npx nx test delivery-tracking` (7) und
`apps/bakery-api/tests/unit/deliveryTours.test.js` (32) für die Rechenlogik des Servers.

## Important Notes

- Always check existing patterns before implementing new features
- Follow existing code conventions and component structure
- German localization throughout customer-facing apps

## Task Management (MissionControl)

Tasks managed via `mc` CLI. Files in `.mc/tasks/` as markdown with YAML frontmatter.

Quick reference:

```bash
mc status              # Dashboard
mc task board          # Kanban board
mc task next           # Next actionable task
mc new task "Title"    # Create task
mc task move TASK-NNN in-progress  # Change status
mc mcp                 # Start MCP server (stdio)
```

## Documentation References

For detailed information, see:

- Architecture: @docs/architecture.md
- Development Guide: @docs/development.md

## Static Landing Page Build & Deployment

### Building for Static Export

The landing page (`apps/bakery-landing/`) is configured for static export to GitHub Pages, Vercel, or any static hosting:

**Recommended Build Commands:**

```bash
# Clean stale cache first (required if dev server was running)
rm -rf apps/bakery-landing/.next

# Standalone build (always works, recommended)
NODE_ENV=production npx nx build-static-standalone bakery-landing

# Or via npm script
npm run build:landing:static
```

**Output Location:** `apps/bakery-landing/out/` (ready for deployment)

### Deployment Options

- **GitHub Pages**: Upload `out/` contents or use GitHub Actions workflow
- **Traditional Hosting**: Upload `out/` directory to web server

### Troubleshooting Static Builds

**Problem: Build fails with `<Html> should not be imported outside of pages/_document` or `Cannot find module for page`**

```bash
# Cause: Stale .next cache from dev server. Always clean before building.
rm -rf apps/bakery-landing/.next
NODE_ENV=production npx nx build-static-standalone bakery-landing
```

**Problem: Nx build fails with shared library TypeScript errors**

```bash
# Solution: Use standalone build that avoids problematic dependencies
npm run build:landing:static
```

**Problem: Module resolution errors for @bakery/\* imports**

```bash
# Solution: Ensure tsconfig extends the base configuration
# File: apps/bakery-landing/tsconfig.json should have:
# "extends": "../../tsconfig.base.json"
```

**Problem: Cannot resolve shared library modules**

```bash
# Solution: Build required shared libraries first
nx build shared-utils
nx build shared-types
# Then try the landing page build again
```
