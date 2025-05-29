# Frontend Application Summary
This file contains essential information about the Next.js frontend application using App Router.
Generated on Do 29 Mai 2025 14:39:35 CEST

## Core Configuration
### Package.json
```json
{
  "name": "bakery-website",
  "version": "0.0.1",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@emailjs/browser": "^3.7.0",
    "@emotion/cache": "^11.11.0",
    "@emotion/react": "^11.10.4",
    "@emotion/server": "^11.10.0",
    "@emotion/styled": "^11.10.4",
    "@fullcalendar/core": "^6.1.15",
    "@fullcalendar/daygrid": "^6.1.15",
    "@fullcalendar/interaction": "^6.1.15",
    "@fullcalendar/react": "^6.1.15",
    "@fullcalendar/resource-timegrid": "^6.1.15",
    "@fullcalendar/timegrid": "^6.1.15",
    "@mui/icons-material": "^5.17.1",
    "@mui/lab": "^5.0.0-alpha.152",
    "@mui/material": "^5.10.3",
    "@mui/material-nextjs": "^5.15.11",
    "date-fns": "^4.1.0",
    "feed-reader": "^6.0.2",
    "leaflet": "^1.9.4",
    "next": "^15.2.4",
    "next-seo": "^5.5.0",
    "next-transpile-modules": "^10.0.1",
    "qrcode.react": "^3.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-leaflet": "^4.2.1",
    "react-markdown": "^10.1.0",
    "react-open-weather": "^1.3.0",
    "react-slideshow-image": "^4.0.4",
    "recharts": "^2.15.1",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^12.2.5",
    "@types/leaflet": "^1.9.17",
    "@types/node": "^18.7.14",
    "@types/react": "^18.3.20",
    "@types/react-dom": "^18.0.6",
    "@types/react-syntax-highlighter": "^15.5.5",
    "@typescript-eslint/eslint-plugin": "^5.36.1",
    "autoprefixer": "^10.4.8",
    "cross-env": "^7.0.3",
    "eslint": "^8.23.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-config-airbnb-typescript": "^17.0.0",
    "eslint-config-next": "^15.2.4",
    "eslint-config-prettier": "^8.5.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-jsx-a11y": "^6.6.1",
    "eslint-plugin-prettier": "^4.2.1",
    "eslint-plugin-react": "^7.31.1",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-unused-imports": "^2.0.0",
    "lint-staged": "^13.0.3",
    "prettier": "^2.7.1",
    "typescript": "^4.8.2"
  },
}
```

### Next.js Configuration
```javascript
// let basePath = process.env.production == undefined ? '' : '/website'
const basePath = process.env.BASE_PATH ?? '' // get `basePath` for your use-case

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: false,
  output: 'export',
  env: {
    basePath,
  },
  transpilePackages: [
    '@fullcalendar/core',
    '@fullcalendar/react',
    '@fullcalendar/daygrid',
    '@fullcalendar/timegrid',
    '@fullcalendar/interaction',
    '@fullcalendar/resource-timegrid',
  ],
}

module.exports = nextConfig
```

## Project Structure
```
./src
./src/app
./src/app/about
./src/app/bakery
./src/app/bakery/processes
./src/app/bakery/saturday-production
./src/app/bestellen
./src/app/dashboard
./src/app/dashboard/management
./src/app/dashboard/production
./src/app/dashboard/sales
./src/app/docs
./src/app/imprint
./src/app/infotv
./src/app/login
./src/app/news
./src/app/news/[slug]
./src/app/orders
./src/app/orders/baking-list
./src/app/products
./src/app/products/[pid]
./src/components
./src/components/bakery
./src/components/button
./src/components/cart
./src/components/dashboard
./src/components/footer
./src/components/header
./src/components/home
./src/components/home/hero
./src/components/home/map
./src/components/home/news
./src/components/home/products
./src/components/home/testimonial
./src/components/home/wochenanfebote
./src/components/icons
./src/components/icons/brand
./src/components/icons/products
./src/components/icons/socials
./src/components/info
./src/components/orders
./src/components/products
./src/context
./src/layouts
./src/mocks
./src/mocks/news
./src/mocks/products
./src/mocks/testimonials
./src/services
./src/types
./src/utils
```

## App Directory Structure
```
./src/app
./src/app/about
./src/app/bakery
./src/app/bakery/processes
./src/app/bakery/saturday-production
./src/app/bestellen
./src/app/dashboard
./src/app/dashboard/management
./src/app/dashboard/production
./src/app/dashboard/sales
./src/app/docs
./src/app/imprint
./src/app/infotv
./src/app/login
./src/app/news
./src/app/news/[slug]
./src/app/orders
./src/app/orders/baking-list
./src/app/products
./src/app/products/[pid]
```

## App Router Files
### Root Layout
```jsx
// src/app/layout.tsx
import { AppConfig } from '../utils/AppConfig'
import ThemeRegistry from './ThemeRegistry'

// This works because this file is now a Server Component
export const metadata = {
  title: AppConfig.title,
  description: AppConfig.description,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang={AppConfig.locale}>
      <head>
        <link
          rel="apple-touch-icon"
          href={`${process.env.basePath}/apple-touch-icon.png`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={`${process.env.basePath}/favicon-32x32.png`}
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={`${process.env.basePath}/favicon-16x16.png`}
        />
        <link rel="icon" href={`${process.env.basePath}/favicon.ico`} />
      </head>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  )
}
```

### Home Page
```jsx
'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Container,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DirectionsIcon from '@mui/icons-material/Directions'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import PhoneIcon from '@mui/icons-material/Phone'

import Hero from '../components/home/hero/Hero'
import Map from '../components/home/map'
import Wochenanfebote from '../components/home/wochenanfebote'
import Testimonial from '../components/home/testimonial'
import News from '../components/home/news'
import CallToAction from '../components/CallToAction'
import { featuredProducts } from '../mocks/products/featured'
import Button from '../components/button/Index'

export default function HomePage() {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Function to handle navigation to products page
  const navigateToProducts = () => router.push('/products')

  // Function to handle navigation to news page
  const navigateToNews = () => router.push('/news')

  return (
    <>
      <Hero />

      {/* Top CTA for new visitors */}
      <CallToAction
        position="top"
        title="Traditionelle Backkunst seit 1933"
        subtitle="WILLKOMMEN IN UNSERER BÄCKEREI"
        description="Entdecken Sie unsere handwerklich hergestellten Backwaren aus regionalen Zutaten. Frisch gebacken und mit Liebe zubereitet – besuchen Sie uns oder bestellen Sie bequem per Telefon oder WhatsApp."
        primaryAction={{
          label: 'Bestellung aufgeben',
          icon: <PhoneIcon />,
          href: '/bestellen',
          variant: 'contained',
        }}
        secondaryAction={{
          label: 'Wegbeschreibung',
          icon: <DirectionsIcon />,
          href: '#map-section', // Scroll to map section
          variant: 'outlined',
        }}
      />

      <Wochenanfebote />

      <Box id="map-section">
        <Map />
      </Box>

      <Testimonial />

      <News
        header={
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h3" component="h2" fontWeight="bold">
              Neuigkeiten
            </Typography>
            <Button onClick={navigateToNews}>Mehr</Button>
          </Box>
        }
      />

      {/* Bottom CTA for informed visitors */}
      <CallToAction
        position="bottom"
        title="Probieren Sie unsere frischen Backwaren"
        subtitle="HANDGEMACHT & KÖSTLICH"
        description="Unsere Türen stehen Ihnen offen und wir freuen uns auf Ihren Besuch!"
        primaryAction={{
          label: 'Jetzt bestellen',
          icon: <RestaurantIcon />,
          href: '/bestellen',
          variant: 'contained',
          color: 'primary',
        }}
        secondaryAction={{
          label: 'Mehr erfahren',
          variant: 'outlined',
          href: '/about',
        }}
        backgroundImage="/images/bakery-background.jpg" // Add a background image path if you have one
      />
    </>
  )
}
```

## Route Groups and Pages
./src/app/about/page.tsx
./src/app/bakery/processes/page.tsx
./src/app/bakery/saturday-production/page.tsx
./src/app/bestellen/page.tsx
./src/app/dashboard/management/page.tsx
./src/app/dashboard/page.tsx
./src/app/dashboard/production/page.tsx
./src/app/dashboard/sales/page.tsx
./src/app/docs/page.tsx
./src/app/imprint/page.tsx
./src/app/infotv/page.tsx
./src/app/login/page.tsx
./src/app/news/[slug]/page.tsx
./src/app/news/page.tsx
./src/app/orders/baking-list/page.tsx
./src/app/orders/page.tsx
./src/app/products/[pid]/page.tsx
./src/app/products/page.tsx

### Sample Route Pages

#### products/[pid]
```jsx
// @ts-nocheck
import React from 'react'
import { notFound } from 'next/navigation'
import Base from '../../../layouts/Base'
import { PRODUCTS } from '../../../mocks/products'
import {
  Box,
  Chip,
  Container,
  Grid,
  Typography,
  Paper,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material'
import { formatter } from '../../../utils/formatPrice'
import Button from '../../../components/button/Index'
import Hero from '../../../components/Hero'
import Image from 'next/image'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'

export default function ProductPage({ params }) {
  const { pid } = params

  const product = PRODUCTS.find((item) => Number(pid) === Number(item.id))

  if (!product) {
    notFound()
  }

  return (
    <Base>
      <Container>
        {/* Breadcrumb Navigation */}
        <Box sx={{ my: 2 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Home
            </Link>
            <Link
              underline="hover"
              color="inherit"
              href="/products"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <ShoppingBasketIcon sx={{ mr: 0.5 }} fontSize="small" />
              Produkte
            </Link>
            <Typography color="text.primary">{product.name}</Typography>
          </Breadcrumbs>
        </Box>

        {/* Product Detail */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
          }}
        >
          <Grid container spacing={3}>
            {/* Product Image */}
            <Grid item xs={12} md={6}>
              <Box
                sx={styles.imageContainer}
                component="figure"
                aria-label={`Bild von ${product.name}`}
              >
                <Image
                  width={200}
                  height={150}
                  src={product.image}
                  alt={product.name}
                  style={styles.productImage}
                />
              </Box>
            </Grid>

            {/* Product Information */}
            <Grid item xs={12} md={6}>
              <Box component="article">
                <Box sx={styles.categoryContainer}>
                  <Chip
                    size="small"
                    label={product.category}
                    color="primary"
                    variant="outlined"
                  />
                </Box>

                <Typography
                  variant="h4"
                  component="h1"
                  fontWeight="bold"
                  gutterBottom
                >
                  {product.name}
                </Typography>

                <Typography
                  variant="h5"
                  component="p"
                  color="primary.main"
                  fontWeight="bold"
                  sx={{ mb: 2 }}
                >
                  {formatter.format(product.price)}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Produktbeschreibung
                </Typography>

                <Typography variant="body1" paragraph>
                  {product.description ||
                    `${product.name} ist ein hochwertiges Backprodukt aus unserer Bäckerei.
                   Hergestellt aus sorgfältig ausgewählten Zutaten und mit handwerklichem
                   Können gebacken.`}
                </Typography>

                <Box sx={styles.productFeatures}>
                  <Typography variant="subtitle2">
                    • Frisch gebacken in unserer Bäckerei
                  </Typography>
                  <Typography variant="subtitle2">
                    • Aus regionalen Zutaten
                  </Typography>
                  <Typography variant="subtitle2">
                    • Ohne künstliche Zusatzstoffe
                  </Typography>
                </Box>

                {/* Add to Cart Button - Commented out but improved */}
                {/*
                <Button
                  sx={{ mt: 3 }}
                  size="large"
                  fullWidth
                  onClick={() => add(product.id)}
                  aria-label={`${product.name} zum Warenkorb hinzufügen`}
                >
                  Zum Warenkorb
                </Button>
                */}

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary">
                  Artikelnummer: {product.id}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Base>
  )
}

const styles = {
  imageContainer: {
    backgroundColor: 'background.paper',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
    padding: 4,
    height: '100%',
    minHeight: 300,
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
    margin: 0,
  },
  productImage: {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
  },
  categoryContainer: {
    marginBottom: 2,
  },
  productFeatures: {
    mt: 2,
    bgcolor: 'grey.50',
    p: 2,
    borderRadius: 1,
    borderLeft: '4px solid',
    borderColor: 'primary.main',
  },
}

export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    pid: product.id.toString(),
  }))
}
```

#### products
```jsx
'use client'
import React, { useState } from 'react'
import { Box, Container } from '@mui/material'

import { PRODUCTS } from '../../mocks/products'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'
import Filter from '../../components/products/Filter'
import Products from '../../components/home/products'

const Index = () => {
  const [products, setProducts] = useState(PRODUCTS)

  return (
    <Base>
      <Hero title="Sortiment" />
      <Box mb={6}>
        <Container>
          <Filter setProducts={setProducts} />
        </Container>
        <Products items={products} />
      </Box>
    </Base>
  )
}

export default Index
```

## Components
### Component Files
./src/components/CallToAction.tsx
./src/components/Hero.tsx
./src/components/Input.tsx
./src/components/MarkdownDisplay.tsx
./src/components/Socials.tsx
./src/components/bakery/FillingPreparation.tsx
./src/components/bakery/ProductionChecklist.tsx
./src/components/bakery/SaturdayProductionDashboard.tsx
./src/components/bakery/WorkflowCreationForm.tsx
./src/components/bakery/WorkflowDetail.tsx
./src/components/bakery/WorkflowSidebar.tsx
./src/components/bakery/WorkflowStepTable.tsx
./src/components/bakery/WorkflowTimeline.tsx
./src/components/button/Index.tsx
./src/components/cart/Card.tsx
./src/components/cart/CartButton.tsx
./src/components/cart/Modal.tsx
./src/components/cart/index.tsx
./src/components/dashboard/ChartComponent.tsx
./src/components/dashboard/DataTable.tsx
./src/components/dashboard/DateRangeSelector.tsx
./src/components/dashboard/MetricCard.tsx
./src/components/dashboard/ProductivityChart.tsx
./src/components/dashboard/StatsComparison.tsx
./src/components/footer/Contact.tsx
./src/components/footer/Index.tsx
./src/components/footer/Link.tsx
./src/components/footer/Menu.tsx
./src/components/footer/Openings.tsx
./src/components/footer/data.ts
./src/components/header/Hamburger.tsx
./src/components/header/Item.tsx
./src/components/header/MobileItem.tsx
./src/components/header/Modal.tsx
./src/components/header/index.tsx
./src/components/home/hero/Hero.tsx
./src/components/home/map/DynamicMap.tsx
./src/components/home/map/Info.tsx
./src/components/home/map/Marker.tsx
./src/components/home/map/OpenStreetMap.tsx
./src/components/home/map/index.tsx
./src/components/home/map/zeiten.ts
./src/components/home/news/Card.tsx
./src/components/home/news/index.tsx
./src/components/home/products/ProductCard.tsx
./src/components/home/products/index.tsx
./src/components/home/testimonial/Card.tsx
./src/components/home/testimonial/index.tsx
./src/components/home/wochenanfebote/Card.tsx
./src/components/home/wochenanfebote/index.tsx
./src/components/home/wochenanfebote/offers.ts
./src/components/icons/Message.tsx
./src/components/icons/Phone.tsx
./src/components/icons/User.tsx
./src/components/icons/brand/Baeckerei.tsx
./src/components/icons/brand/Divider.tsx
./src/components/icons/brand/H.tsx
./src/components/icons/brand/Heusser.tsx
./src/components/icons/brand/Wappen.tsx
./src/components/icons/products/Broetchen.tsx
./src/components/icons/products/Brot.tsx
./src/components/icons/products/Getranke.tsx
./src/components/icons/products/Kuchen.tsx
./src/components/icons/products/Teilchen.tsx
./src/components/icons/products/Torten.tsx
./src/components/icons/socials/Facebook.tsx
./src/components/icons/socials/Instagram.tsx
./src/components/icons/socials/Whatsapp.tsx
./src/components/info/Calendar.tsx
./src/components/info/News.tsx
./src/components/info/Products.tsx
./src/components/info/RSSFeed.tsx
./src/components/info/Slideshow.tsx
./src/components/info/Weather.tsx
./src/components/info/useDate.tsx
./src/components/orders/Form.tsx
./src/components/orders/OrderForm.tsx
./src/components/products/Filter.tsx
./src/components/products/ProductDetail.tsx
./src/components/products/types.ts

### Sample Components

#### Hero.tsx
```jsx
import { Box, Container, Typography } from '@mui/material'
import React from 'react'
import Divider from './icons/brand/Divider'

interface Props {
	title: string
}

const Hero: React.FC<Props> = (props) => {
	const { title } = props

  return (
    <Box sx={{
			pt: { xs: '120px', md: '160px'},
			pb: 3
		}}>
			<Container sx={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',

        '& svg': {
          maxWidth: '80vw',
        }
			}}>
				<Typography variant='h3' textAlign='center' sx={{
          fontSize: { xs: '8vw', md: '3rem' }
        }}>
          {title}
        </Typography>
				<Divider />
			</Container>
		</Box>
  )
}

export default Hero```

#### index.tsx
```jsx
import React from 'react'
import {
  Box,
  BoxProps,
  Container,
  Grid,
  Typography,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  TextField,
  Divider,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import ProductCard from './ProductCard'
import { Product } from '../../products/types'

interface Props extends BoxProps {
  header?: React.ReactNode
  items: Product[]
  showControls?: boolean
  title?: string
}

const Products: React.FC<Props> = (props) => {
  const { items, header, showControls = false, title, sx } = props
  const [page, setPage] = React.useState(1)
  const [sortBy, setSortBy] = React.useState('')
  const [searchTerm, setSearchTerm] = React.useState('')

  // Items per page
  const itemsPerPage = 8

  // Filter and sort products
  const filteredItems = React.useMemo(() => {
    let result = [...items]

    // Apply search filter if search term exists
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          item.category.toLowerCase().includes(lowerSearch)
      )
    }

    // Apply sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [items, searchTerm, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const displayedItems = filteredItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  )

  // Reset to page 1 when search or sort changes
  React.useEffect(() => {
    setPage(1)
  }, [searchTerm, sortBy])

  return (
    <Box
      sx={{
        py: 4,
        ...sx,
      }}
      component="section"
      aria-label="Produkt Liste"
    >
      <Container>
        {header ||
          (title && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h4"
                component="h2"
                fontWeight="bold"
                gutterBottom
              >
                {title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
          ))}

        {/* Search and Filter Controls */}
        {showControls && filteredItems.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              mb: 3,
              gap: 2,
            }}
          >
            <TextField
              label="Produkte suchen"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: { sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-select-label">Sortieren nach</InputLabel>
              <Select
                labelId="sort-select-label"
                value={sortBy}
                label="Sortieren nach"
                onChange={(e) => setSortBy(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon />
                  </InputAdornment>
                }
              >
                <MenuItem value="">
                  <em>Standard</em>
                </MenuItem>
                <MenuItem value="price-asc">Preis aufsteigend</MenuItem>
                <MenuItem value="price-desc">Preis absteigend</MenuItem>
                <MenuItem value="name">Name</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Product Grid */}
        {displayedItems.length > 0 ? (
          <Grid container spacing={3} aria-live="polite">
            {displayedItems.map((item) => (
              <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
                <ProductCard {...item} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Keine Produkte gefunden
            </Typography>
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 4,
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
              aria-label="Produkt-Seitennavigation"
            />
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default Products
```

#### ProductCard.tsx
```jsx
import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Chip,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
} from '@mui/material'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import Image from 'next/image'

import { formatter } from '../../../utils/formatPrice'

interface Props {
  id: number
  name: string
  category: string
  image: string
  price: number
  description?: string
}

const ProductCard: React.FC<Props> = (props) => {
  const { id, name, category, image, price, description } = props
  const router = useRouter()

  const handleCardClick = () => {
    router.push(`products/${id}`)
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  return (
    <Card
      elevation={2}
      sx={styles.card}
      onClick={handleCardClick}
      onKeyDown={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-label={`Produkt anzeigen: ${name}, Preis: ${formatter.format(
        price
      )}`}
    >
      <CardActionArea>
        <CardMedia component="div" sx={styles.imageContainer}>
          {/* Using alt text for better accessibility */}
          <Image
            width={200}
            height={150}
            src={image}
            alt={`Bild von ${name}`}
            style={{
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain' as const, // Use type assertion here
              transition: 'transform 0.3s ease',
            }}
          />
        </CardMedia>

        <CardContent sx={styles.content}>
          <Box sx={styles.nameContainer}>
            <Typography variant="h6" component="h3" sx={styles.name}>
              {name}
            </Typography>

            {/* Optional description with truncation */}
            {description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={styles.description}
              >
                {description}
              </Typography>
            )}
          </Box>

          <Box sx={styles.footer}>
            <Chip
              size="small"
              label={category}
              color="primary"
              variant="outlined"
              sx={styles.categoryChip}
            />
            <Typography
              variant="button"
              fontWeight="bold"
              fontSize="16px"
              aria-label={`Preis: ${formatter.format(price)}`}
            >
              {formatter.format(price)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover, &:focus': {
      transform: 'translateY(-8px)',
      boxShadow: 6,
    },
    outline: 'none',
  },
  imageContainer: {
    backgroundColor: 'grey.100',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    height: 160,
    position: 'relative',
    overflow: 'hidden',
  },
  // We're not using this anymore, applying styles directly to the img element
  // productImage: {
  //   maxWidth: '85%',
  //   maxHeight: '85%',
  //   objectFit: 'contain',
  //   transition: 'transform 0.3s ease',
  // },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  nameContainer: {
    marginBottom: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
    lineHeight: 1.2,
    marginBottom: 0.5,
    // Ensure long names don't break layout
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  description: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontSize: '0.875rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 1,
  },
  categoryChip: {
    maxWidth: '60%',
    '& .MuiChip-label': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
}

export default ProductCard
```

## Styling

## API Routes
No API routes found in src/app/api

## Utilities and Services
### src/utils Files
./src/utils/AppConfig.ts
./src/utils/createEmotionCache.ts
./src/utils/formatPrice.ts
./src/utils/productionCalculator.ts
./src/utils/workflowUtils.ts

#### Sample workflowUtils.ts
```javascript
import { Workflow } from '../types/workflow'
import { format } from 'date-fns'

export const calculateProgress = (workflow: Workflow): number => {
  const totalSteps = workflow.steps.length
  const completedSteps = workflow.steps.filter(
    (step) => step.status === 'completed'
  ).length
  const inProgressStep = workflow.steps.find(
    (step) => step.status === 'in-progress'
  )

  let progress = (completedSteps / totalSteps) * 100
  if (inProgressStep) {
    progress += (inProgressStep.progress / 100) * (1 / totalSteps) * 100
  }

  return Math.round(progress)
}

export const getTimeRemaining = (workflow: Workflow): string => {
  const now = new Date()
  const diff = workflow.estimatedEndTime.getTime() - now.getTime()

  if (diff <= 0) {
    return 'Fällig'
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export const getStatusColor = (
  status: string
): 'success' | 'primary' | 'warning' | 'info' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in-progress':
      return 'primary'
    case 'paused':
      return 'warning'
    case 'planned':
      return 'info'
    default:
      return 'default'
  }
}

// Parse workflow definition language from YAML
export const parseWorkflowDefinition = (yaml: string): any => {
  // In a real app, you would use a library like js-yaml
  // This is a simple placeholder
  return { parsed: true, yaml }
}

// Generate workflow execution plan from workflow definition
export const generateWorkflowPlan = (
  definition: any,
  startTime: Date = new Date()
): Workflow => {
  // This would generate a new workflow from a definition
  // Simplified placeholder implementation
  return {
    id: `wf-${Date.now()}`,
    name: definition.name || 'new_workflow',
    version: definition.version || '1.0',
    product: 'New Product',
    startTime,
    estimatedEndTime: new Date(startTime.getTime() + 3600000), // +1 hour placeholder
    status: 'planned',
    batchSize: 0,
    assignedTo: '',
    steps: [],
  }
}

export const formatDate = (
  date: Date | string | undefined,
  formatStr: string = 'dd MMM yyyy HH:mm'
): string => {
  if (!date) return 'n/a'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return format(dateObj, formatStr)
  } catch (error) {
    console.error('Error formatting date:', error)
    return String(date)
  }
}
```
### src/services Files
./src/services/bakeryAPI.ts
./src/services/types.ts
./src/services/workflowService.ts

#### Sample bakeryAPI.ts
```javascript
// src/services/bakeryAPI.ts
'use client'
import {
  Product,
  SalesData,
  ProductionData,
  FinancialData,
  StaffData,
  CustomerData,
  InventoryItem,
  TimeSeriesData,
  TimeRange,
  Order,
  BakingListResponse,
  SummaryData,
} from './types'

// Import real product data
import { PRODUCTS } from '../mocks/products'

const API_BASE_URL = 'http://localhost:5000'

// Generate mock data for development and testing
const generateMockData = () => {
  // Use real product data and enhance it with additional fields needed for dashboards
  const products: Product[] = PRODUCTS.map((product) => ({
    ...product,
    // Add cost field (simulate 30-40% margin)
    cost: Number((product.price * (0.6 + Math.random() * 0.1)).toFixed(2)),
    // Add stock field (random amount)
    stock: Math.floor(Math.random() * 50) + 5,
    // Make sure we have description field
    description:
      product.description || `Frische ${product.name} aus unserer Bäckerei.`,
  }))

  // Add sales data based on real products
  const generateSalesData = (): SalesData[] => {
    const sales: SalesData[] = []
    const today = new Date()

    // Generate 60 days of sales data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // Generate 1-15 sales per day (more sales on weekend days)
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const salesCount =
        Math.floor(Math.random() * (isWeekend ? 15 : 10)) + (isWeekend ? 5 : 1)

      for (let j = 0; j < salesCount; j++) {
        // Select random product from real products
        const product = products[Math.floor(Math.random() * products.length)]
        const quantity = Math.floor(Math.random() * 5) + 1

        sales.push({
          id: `sale-${dateStr}-${j}`,
          date: dateStr,
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          total: Number((product.price * quantity).toFixed(2)),
          payment_method: ['Bargeld', 'EC-Karte', 'Kreditkarte', 'PayPal'][
            Math.floor(Math.random() * 4)
          ],
        })
      }
    }

    return sales
  }

  // Add production data based on real products
  const generateProductionData = (): ProductionData[] => {
    const production: ProductionData[] = []
    const today = new Date()
    const staffNames = [
      'Max Müller',
      'Anna Schmidt',
      'Thomas Weber',
      'Lisa Becker',
    ]

    // Generate 60 days of production data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // For different days, focus on different product categories
      // This makes it more realistic (e.g., bread is baked daily, cakes more on weekends)
      const dayOfWeek = date.getDay()

      // Filter products by category depending on day of week
      const dailyProductPool = products.filter((product) => {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Weekends - focus on cakes, special products
          return ['Kuchen', 'Torte', 'Gebäck'].includes(product.category)
        } else if (dayOfWeek === 1 || dayOfWeek === 4) {
          // Monday & Thursday - bread day
          return ['Brot', 'Brötchen'].includes(product.category)
        } else {
          // Regular days - mix of everything
          return true
        }
      })

      // Generate production entries for 5-12 products per day
      const productsCount = Math.floor(Math.random() * 8) + 5
      const selectedProducts = [
        ...(dailyProductPool.length > 0 ? dailyProductPool : products),
      ]
        .sort(() => 0.5 - Math.random())
        .slice(
          0,
          Math.min(productsCount, dailyProductPool.length || products.length)
        )

      selectedProducts.forEach((product, index) => {
        // Calculate production quantity based on product category
        let baseQuantity = 15
        if (product.category === 'Brot') baseQuantity = 30
        if (product.category === 'Brötchen') baseQuantity = 60
        if (product.category === 'Kuchen' || product.category === 'Torte')
          baseQuantity = 8

        const quantityProduced =
          Math.floor(Math.random() * baseQuantity) + baseQuantity

        // Waste is typically 5-15% of production
        const wasteRate = Math.random() * 0.1 + 0.05
        const waste = Math.floor(quantityProduced * wasteRate)

        production.push({
          id: `prod-${dateStr}-${index}`,
          date: dateStr,
          product_id: product.id,
          product_name: product.name,
          quantity_produced: quantityProduced,
          waste: waste,
          staff_name: staffNames[Math.floor(Math.random() * staffNames.length)],
        })
      })
    }

    return production
  }

  // Add financial data
  const generateFinancialData = (): FinancialData[] => {
    const finances: FinancialData[] = []
    const today = new Date()
    const categories = [
      'Einnahmen: Verkauf',
      'Einnahmen: Sonstiges',
      'Ausgaben: Zutaten',
      'Ausgaben: Personal',
      'Ausgaben: Miete',
      'Ausgaben: Energie',
      'Ausgaben: Sonstiges',
    ]

    // Generate 60 days of financial data
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // Generate 2-5 financial entries per day
      const entriesCount = Math.floor(Math.random() * 4) + 2

      for (let j = 0; j < entriesCount; j++) {
        const category =
          categories[Math.floor(Math.random() * categories.length)]
        const isIncome = category.startsWith('Einnahmen')

        finances.push({
          id: `fin-${dateStr}-${j}`,
          date: dateStr,
          category: category,
          amount: isIncome
            ? Math.round((Math.random() * 500 + 50) * 100) / 100
            : (-1 * Math.round((Math.random() * 300 + 20) * 100)) / 100,
          description: isIncome ? 'Tagesumsatz' : 'Regelmäßige Ausgabe',
        })
      }
    }

    return finances
  }

  // Add inventory data specific to bakery ingredients
  const generateInventoryData = (): InventoryItem[] => {
    return [
      {
        id: 1,
        name: 'Mehl (Weizen)',
        quantity: 45,
        unit: 'kg',
        min_stock_level: 20,
        last_restocked: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 2,
        name: 'Mehl (Roggen)',
        quantity: 32,
        unit: 'kg',
        min_stock_level: 15,
        last_restocked: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 3,
        name: 'Zucker',
        quantity: 18,
        unit: 'kg',
        min_stock_level: 10,
        last_restocked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 4,
        name: 'Butter',
        quantity: 9,
        unit: 'kg',
        min_stock_level: 8,
        last_restocked: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 5,
        name: 'Eier',
        quantity: 120,
        unit: 'Stück',
        min_stock_level: 60,
        last_restocked: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 6,
        name: 'Milch',
        quantity: 15,
        unit: 'Liter',
        min_stock_level: 10,
        last_restocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 7,
        name: 'Hefe',
        quantity: 3,
        unit: 'kg',
        min_stock_level: 2,
        last_restocked: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 8,
        name: 'Schokolade',
        quantity: 5,
        unit: 'kg',
        min_stock_level: 3,
        last_restocked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 9,
        name: 'Sultaninen',
        quantity: 4,
        unit: 'kg',
        min_stock_level: 2,
        last_restocked: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 10,
        name: 'Nüsse',
        quantity: 7,
        unit: 'kg',
        min_stock_level: 5,
        last_restocked: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 11,
        name: 'Sauerteig',
        quantity: 2,
        unit: 'kg',
        min_stock_level: 1,
        last_restocked: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 12,
        name: 'Salz',
        quantity: 10,
        unit: 'kg',
        min_stock_level: 5,
        last_restocked: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    ]
  }

  // Add staff data
  const generateStaffData = (): StaffData[] => {
    return [
      {
        id: 1,
        name: 'Max Müller',
        role: 'Bäckermeister',
        productivity: 95,
        hours_worked: 168,
        salary: 4200,
      },
      {
        id: 2,
        name: 'Anna Schmidt',
        role: 'Bäckermeister',
        productivity: 92,
        hours_worked: 160,
        salary: 3900,
      },
      {
        id: 3,
        name: 'Thomas Weber',
        role: 'Bäcker',
        productivity: 87,
        hours_worked: 160,
        salary: 3400,
      },
      {
        id: 4,
        name: 'Lisa Becker',
        role: 'Konditorin',
        productivity: 93,
        hours_worked: 152,
        salary: 3600,
      },
      {
        id: 5,
        name: 'Julia Klein',
        role: 'Verkauf',
        productivity: 90,
        hours_worked: 140,
        salary: 2800,
      },
      {
        id: 6,
        name: 'David Wagner',
        role: 'Verkauf',
        productivity: 85,
        hours_worked: 142,
        salary: 2750,
      },
      {
        id: 7,
        name: 'Sophie Hoffmann',
        role: 'Geschäftsführung',
        productivity: 98,
        hours_worked: 170,
        salary: 5200,
      },
    ]
  }

  // Add customer data
  const generateCustomerData = (): CustomerData[] => {
    return [
      {
        id: 1,
        name: 'Cafe Sonnenblick',
        type: 'Business',
        total_spent: 1250.45,
        visits: 35,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 2,
        name: 'Hotel Bergblick',
        type: 'Business',
        total_spent: 3820.75,
        visits: 42,
        last_visit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 3,
        name: 'Johanna Meyer',
        type: 'Individual',
        total_spent: 342.5,
        visits: 28,
        last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 4,
        name: 'Peter Fischer',
        type: 'Individual',
        total_spent: 189.25,
        visits: 15,
        last_visit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 5,
        name: 'Restaurant Seehof',
        type: 'Business',
        total_spent: 2750.8,
        visits: 31,
        last_visit: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 6,
        name: 'Maria Schulz',
        type: 'Individual',
        total_spent: 415.3,
        visits: 32,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 7,
        name: 'Kindergarten Sonnenschein',
        type: 'Business',
        total_spent: 1875.2,
        visits: 25,
        last_visit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 8,
        name: 'Klaus Becker',
        type: 'Individual',
        total_spent: 275.9,
        visits: 21,
        last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 9,
        name: 'Seniorenheim Waldblick',
        type: 'Business',
        total_spent: 3250.45,
        visits: 48,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
      {
        id: 10,
        name: 'Sandra Müller',
        type: 'Individual',
        total_spent: 198.75,
        visits: 18,
        last_visit: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    ]
  }

  const salesData = generateSalesData()
  const productionData = generateProductionData()
  const financialData = generateFinancialData()
  const inventoryData = generateInventoryData()
  const staffData = generateStaffData()
  const customerData = generateCustomerData()

  return {
    products,
    salesData,
    productionData,
    financialData,
    inventoryData,
    staffData,
    customerData,
  }
}

// Initialize mock data
const mockData = generateMockData()

// Helper function to filter data by date range
const filterByDateRange = (data: any[], range: TimeRange): any[] => {
  const today = new Date()
  let startDate = new Date(today)

  switch (range) {
    case 'day':
      startDate = new Date(today)
      break
    case 'week':
      startDate.setDate(today.getDate() - 7)
      break
    case 'month':
      startDate.setMonth(today.getMonth() - 1)
      break
    case 'year':
      startDate.setFullYear(today.getFullYear() - 1)
      break
  }

  const startDateStr = startDate.toISOString().split('T')[0]

  return data.filter((item) => item.date >= startDateStr)
}

// Generate time series data
const generateTimeSeriesData = (
  type: 'sales' | 'customers' | 'production' | 'waste',
  range: TimeRange
): TimeSeriesData[] => {
  const result: TimeSeriesData[] = []
  const today = new Date()
  let days: number

  switch (range) {
    case 'day':
      days = 1
      break
    case 'week':
      days = 7
      break
    case 'month':
      days = 30
      break
    case 'year':
      days = 365
      break
  }

  // For a day, we use hours instead of days
  if (range === 'day') {
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0')
      result.push({
        date: `${today.toISOString().split('T')[0]} ${hour}:00`,
        value: Math.floor(Math.random() * 50) + (type === 'waste' ? 0 : 10),
      })
    }
  } else {
    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      result.push({
        date: dateStr,
        value: Math.floor(Math.random() * 100) + (type === 'waste' ? 0 : 50),
      })
    }
  }

  // Sort by date ascending
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

// Calculate summary metrics
const calculateSummary = (range: TimeRange): SummaryData => {
  // Filter data by time range
  const sales = filterByDateRange(mockData.salesData, range)
  const production = filterByDateRange(mockData.productionData, range)
  const finances = filterByDateRange(mockData.financialData, range)

  // Calculate totals
  const totalSales = sales.reduce((sum, item) => sum + item.total, 0)
  const totalItems = sales.reduce((sum, item) => sum + item.quantity, 0)
  const totalProduced = production.reduce(
    (sum, item) => sum + item.quantity_produced,
    0
  )
  const totalWaste = production.reduce((sum, item) => sum + item.waste, 0)

  const expenses = finances
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0)

  const revenue = finances
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0)

  // Calculate derived metrics
  const transactions = new Set(sales.map((item) => item.id.split('-')[1])).size
  const uniqueTransactions = new Set(
    sales.map((item) => item.id.split('-')[1] + '-' + item.id.split('-')[2])
  ).size
  const averageOrderValue = transactions > 0 ? totalSales / transactions : 0
  const wastageRate = totalProduced > 0 ? (totalWaste / totalProduced) * 100 : 0
  const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0

  return {
    totalSales,
    totalItems,
    totalProduced,
    totalWaste,
    transactions,
    uniqueTransactions,
    expenses,
    revenue,
    profit: revenue - expenses,
    averageOrderValue,
    wastageRate,
    profitMargin,
  }
}

// API Service
const bakeryAPI = {
  // Get products
  getProducts: async (): Promise<Product[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching products, using mock data:', error)
      // Fall back to mock data if API fails
      return mockData.products
    }
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`)
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching orders, using mock data:', error)
      // For now, until we have mock orders
      return []
    }
  },

  getOrder: async (orderId: string | number): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch order ${orderId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error)
      throw error
    }
  },

  createOrder: async (orderData: Partial<Order>): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to create order: ${errorData.details || response.statusText}`
        )
      }
      return await response.json()
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  },

  updateOrder: async (
    orderId: string | number,
    orderData: Partial<Order>
  ): Promise<Order> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `Failed to update order ${orderId}: ${
            errorData.details || response.statusText
          }`
        )
      }
      return await response.json()
    } catch (error) {
      console.error(`Error updating order ${orderId}:`, error)
      throw error
    }
  },

  deleteOrder: async (
    orderId: string | number
  ): Promise<{ message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to delete order ${orderId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error deleting order ${orderId}:`, error)
      throw error
    }
  },

  // Baking List
  getBakingList: async (date: Date): Promise<BakingListResponse> => {
    try {
      // Format date as YYYY-MM-DD
      const formattedDate =
        date instanceof Date
          ? date.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

      const response = await fetch(
        `${API_BASE_URL}/baking-list?date=${formattedDate}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch baking list: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching baking list:', error)
      throw error
    }
  },

  // Dashboard data methods
  getSummaryData: async (range: TimeRange): Promise<SummaryData> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/summary?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch summary data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching summary data, using mock data:', error)
      // Fall back to mock data
      return calculateSummary(range)
    }
  },

  getTimeSeriesData: async (
    type: 'sales' | 'customers' | 'production' | 'waste',
    range: TimeRange
  ): Promise<TimeSeriesData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/timeseries?type=${type}&range=${range}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} time series data`)
      }
      return await response.json()
    } catch (error) {
      console.error(
        `Error fetching ${type} time series data, using mock data:`,
        error
      )
      // Fall back to mock data
      return generateTimeSeriesData(type, range)
    }
  },

  getSalesData: async (range: TimeRange): Promise<SalesData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/sales?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch sales data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching sales data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.salesData, range)
    }
  },

  getProductionData: async (range: TimeRange): Promise<ProductionData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/production?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch production data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching production data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.productionData, range)
    }
  },

  getFinancialData: async (range: TimeRange): Promise<FinancialData[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/finances?range=${range}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch financial data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching financial data, using mock data:', error)
      // Fall back to mock data
      return filterByDateRange(mockData.financialData, range)
    }
  },

  getInventoryData: async (): Promise<InventoryItem[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/inventory`)
      if (!response.ok) {
        throw new Error('Failed to fetch inventory data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching inventory data, using mock data:', error)
      // Fall back to mock data
      return mockData.inventoryData
    }
  },

  getStaffData: async (): Promise<StaffData[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/staff`)
      if (!response.ok) {
        throw new Error('Failed to fetch staff data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching staff data, using mock data:', error)
      // Fall back to mock data
      return mockData.staffData
    }
  },

  getCustomerData: async (): Promise<CustomerData[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/customers`)
      if (!response.ok) {
        throw new Error('Failed to fetch customer data')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching customer data, using mock data:', error)
      // Fall back to mock data
      return mockData.customerData
    }
  },
  // Get available workflows, including our new hefeteig workflows
  getWorkflows: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows`)
      if (!response.ok) {
        throw new Error('Failed to fetch workflows')
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching workflows, using mock data:', error)
      // You'll need to create mock workflow data
      return [
        {
          id: 'croissant_production',
          name: 'Croissant Produktion',
          version: '1.2',
          status: 'active',
          steps: 7,
        },
        {
          id: 'sourdough_bread',
          name: 'Sauerteigbrot',
          version: '1.0',
          status: 'active',
          steps: 10,
        },
        {
          id: 'hefeteig_production',
          name: 'Hefeteig Produktion',
          version: '1.0',
          status: 'active',
          steps: 5,
        },
        {
          id: 'filling_production',
          name: 'Füllungen Produktion',
          version: '1.0',
          status: 'active',
          steps: 4,
        },
      ]
    }
  },

  // Get workflow details
  getWorkflowDetails: async (workflowId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow ${workflowId}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching workflow ${workflowId}:`, error)
      throw error
    }
  },

  // Get hefezopf orders - typically for Saturday production
  getHefezopfOrders: async (date: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/production/hefezopf-orders?date=${date}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch hefezopf orders for ${date}`)
      }
      return await response.json()
    } catch (error) {
      console.error(`Error fetching hefezopf orders:`, error)
      // Return mock data for testing
      return {
        'Hefezopf Plain': 15,
        'Hefekranz Nuss': 8,
        'Hefekranz Schoko': 12,
        'Hefekranz Pudding': 5,
        'Hefekranz Marzipan': 4,
        'Mini Hefezopf': 20,
        'Hefeschnecken Nuss': 30,
        'Hefeschnecken Schoko': 25,
      }
    }
  },

  // Save production plan
  saveProductionPlan: async (date: string, plan: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/production/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, plan }),
      })

      if (!response.ok) {
        throw new Error('Failed to save production plan')
      }

      return await response.json()
    } catch (error) {
      console.error('Error saving production plan:', error)
      // Mock successful response
      return { success: true, id: 'mock-plan-id' }
    }
  },
}

export default bakeryAPI
```

## Summary
This file provides a high-level overview of the frontend application structure using Next.js App Router.
For detailed implementation, please refer to the actual code files.
