import { notFound } from 'next/navigation'
import {
  Box,
  Container,
  Typography,
  Chip,
  Grid,
  Breadcrumbs,
  Link,
  Button,
  Card,
  CardContent,
  Divider,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket'
import VerifiedIcon from '@mui/icons-material/Verified'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import ScheduleIcon from '@mui/icons-material/Schedule'
import PhoneIcon from '@mui/icons-material/Phone'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import GrainIcon from '@mui/icons-material/Grain'
import Image from 'next/image'
import { loadProducts } from '../../../lib/products'
import { formatPrice } from '../../../utils/formatPrice'
import {
  getContactPageHours,
  getEarliestOpeningTime,
  getCompactHoursSummary,
} from '../../../utils/openingHours'
import { Metadata } from 'next'
import { SITE_URL } from '../../../config/legal'

interface ProductPageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamicParams = false

export async function generateStaticParams() {
  const products = loadProducts()
  return products.map((product) => ({
    id: product.id.toString(),
  }))
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const products = loadProducts()
  const { id } = await params
  const product = products.find((item) => item.id.toString() === id)

  if (!product) {
    return {
      title: 'Produkt nicht gefunden - Bäckerei Heusser',
    }
  }

  const baseUrl = SITE_URL
  // Social previews (og:image / twitter:image) don't support SVG – fall back
  // to the generic OG image for vector product illustrations.
  const productImage = product.image || product.imageUrl
  const socialImage =
    productImage && !productImage.toLowerCase().endsWith('.svg')
      ? productImage
      : `${SITE_URL}/og-image.jpg`

  return {
    title: `${product.name} - Bäckerei Heusser`,
    description:
      product.description ||
      `${product.name} aus unserer Bäckerei. Frisch gebacken und von höchster Qualität. Täglich frisch in unserer traditionellen Handwerksbäckerei hergestellt.`,
    keywords: `${product.name}, ${product.category}, Backwaren, Bäckerei, Homburg, Kirrberg, frisch, handgemacht`,
    alternates: {
      canonical: `${baseUrl}/products/${product.id}`,
    },
    openGraph: {
      title: `${product.name} - Bäckerei Heusser`,
      description:
        product.description ||
        `Frische ${product.name} aus unserer traditionellen Handwerksbäckerei`,
      url: `${baseUrl}/products/${product.id}`,
      siteName: 'Bäckerei Heusser',
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      locale: 'de_DE',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} - Bäckerei Heusser`,
      description:
        product.description ||
        `Frische ${product.name} aus unserer traditionellen Handwerksbäckerei`,
      images: [socialImage],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const products = loadProducts()
  const { id } = await params
  const product = products.find((item) => item.id.toString() === id)

  if (!product) {
    notFound()
  }

  const imageSrc =
    product.image ||
    product.imageUrl ||
    '/assets/images/products/erdbeertorte.jpg'

  // Get related products from same category
  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4)

  return (
    <>
      {/* Breadcrumb Section - Clean and Professional */}
      <Box
        sx={{
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              '& .MuiBreadcrumbs-separator': { color: 'grey.500' },
              '& .MuiLink-root': {
                color: 'grey.700',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.main' },
              },
            }}
          >
            <Link
              underline="none"
              href="/"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Startseite
            </Link>
            <Link
              underline="none"
              href="/products"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <ShoppingBasketIcon sx={{ mr: 0.5, fontSize: 16 }} />
              Sortiment
            </Link>
            <Typography color="primary" fontWeight="600">
              {product.name}
            </Typography>
          </Breadcrumbs>
        </Container>
      </Box>

      {/* Main Product Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Grid container spacing={{ xs: 3, md: 8 }}>
          {/* Product Image Section */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                position: 'relative',
                bgcolor: 'white',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'grey.200',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Quality Badge - Deterministic based on product ID */}
              {product.id % 3 === 0 && (
                <Chip
                  icon={<VerifiedIcon />}
                  label="Premium Qualität"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    zIndex: 1,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontWeight: '600',
                  }}
                />
              )}

              <Box
                sx={{
                  p: { xs: 3, md: 6 },
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: { xs: 250, md: 450 },
                  bgcolor: 'grey.50',
                }}
              >
                <Image
                  width={400}
                  height={400}
                  src={imageSrc}
                  alt={product.name}
                  priority
                  quality={95}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </Box>
            </Box>
          </Grid>

          {/* Product Information */}
          <Grid item xs={12} md={6}>
            <Box>
              {/* Product Category */}
              <Typography
                variant="overline"
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  fontSize: '0.875rem',
                }}
              >
                {product.category}
              </Typography>

              {/* Product Name */}
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  mb: 2,
                  fontSize: { xs: '2rem', md: '2.25rem' },
                }}
              >
                {product.name}
              </Typography>

              {/* Product Badges */}
              <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                {product.isVegan && (
                  <Chip
                    icon={<CheckCircleOutlineIcon />}
                    label="Vegan"
                    size="small"
                    sx={{
                      bgcolor: 'grey.50',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: 'grey.300',
                      '& .MuiChip-icon': { color: 'primary.main' },
                    }}
                  />
                )}
                {product.isGlutenFree && (
                  <Chip
                    icon={<GrainIcon />}
                    label="Glutenfrei"
                    size="small"
                    sx={{
                      bgcolor: 'grey.50',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: 'grey.300',
                      '& .MuiChip-icon': { color: 'primary.main' },
                    }}
                  />
                )}
              </Box>

              {/* Price Display */}
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 700,
                    color: 'primary.main',
                    fontSize: { xs: '2.25rem', md: '2.75rem' },
                    display: 'inline',
                  }}
                >
                  {formatPrice(product.price)}
                </Typography>
                {product.unit && (
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ display: 'inline', ml: 1.5 }}
                  >
                    / {product.unit}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ mb: 4 }} />

              {/* Description */}
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{
                  mb: 4,
                  fontSize: '1.05rem',
                  lineHeight: 1.75,
                }}
              >
                {product.description ||
                  `Genießen Sie ${product.name} - täglich frisch in unserer Bäckerei hergestellt. Mit ausgewählten Zutaten und traditioneller Handwerkskunst gebacken.`}
              </Typography>

              {/* Professional Feature Highlights */}
              <Box sx={{ mb: 5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'grey.700', mb: 2, fontWeight: 600 }}
                >
                  Produktvorteile
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <ScheduleIcon
                        sx={{
                          color: 'primary.main',
                          mr: 2,
                          fontSize: 20,
                          mt: 0.5,
                        }}
                      />
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight="600"
                          color="text.primary"
                        >
                          Täglich frisch
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Ab {getEarliestOpeningTime()} Uhr morgens gebacken
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <LocalShippingIcon
                        sx={{
                          color: 'primary.main',
                          mr: 2,
                          fontSize: 20,
                          mt: 0.5,
                        }}
                      />
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight="600"
                          color="text.primary"
                        >
                          Regionale Zutaten
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Aus lokalem Anbau
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <WorkspacePremiumIcon
                        sx={{
                          color: 'primary.main',
                          mr: 2,
                          fontSize: 20,
                          mt: 0.5,
                        }}
                      />
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight="600"
                          color="text.primary"
                        >
                          Handwerksqualität
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Traditionelle Herstellung
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        p: 2,
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <VerifiedIcon
                        sx={{
                          color: 'primary.main',
                          mr: 2,
                          fontSize: 20,
                          mt: 0.5,
                        }}
                      />
                      <Box>
                        <Typography
                          variant="body2"
                          fontWeight="600"
                          color="text.primary"
                        >
                          90 Jahre Erfahrung
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Seit 1933 in Familienbesitz
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PhoneIcon />}
                  href="tel:068412229"
                  sx={{
                    py: 1.5,
                    px: 4,
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderRadius: 1,
                    bgcolor: 'primary.main',
                    boxShadow: 'none',
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      boxShadow: '0 2px 8px rgba(208, 56, 186, 0.3)',
                    },
                  }}
                >
                  Telefonisch bestellen
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<ArrowBackIcon />}
                  href="/products"
                  sx={{
                    py: 1.5,
                    px: 3,
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderRadius: 1,
                    borderColor: 'grey.300',
                    color: 'text.primary',
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'grey.50',
                    },
                  }}
                >
                  Zurück zum Sortiment
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Professional Contact Information */}
      <Box
        sx={{
          bgcolor: 'white',
          py: 8,
          borderTop: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h5"
            fontWeight="600"
            sx={{ mb: 4, color: 'text.primary', textAlign: 'center' }}
          >
            Kontaktinformationen
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 3,
                  height: '100%',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                }}
              >
                <PhoneIcon
                  sx={{ fontSize: 32, mb: 2, color: 'primary.main' }}
                />
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Telefonische Bestellung
                </Typography>
                <Typography variant="h6" fontWeight="700" color="primary.main">
                  06841 2229
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {getCompactHoursSummary()}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 3,
                  height: '100%',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                }}
              >
                <LocationOnIcon
                  sx={{ fontSize: 32, mb: 2, color: 'primary.main' }}
                />
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Unsere Adresse
                </Typography>
                <Typography variant="body1" color="text.primary">
                  Eckstraße 3
                </Typography>
                <Typography variant="body1" color="text.primary">
                  66424 Homburg
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Kostenlose Parkplätze vorhanden
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  p: 3,
                  height: '100%',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                }}
              >
                <ScheduleIcon
                  sx={{ fontSize: 32, mb: 2, color: 'primary.main' }}
                />
                <Typography variant="subtitle1" fontWeight="600" gutterBottom>
                  Öffnungszeiten
                </Typography>
                {getContactPageHours().map((item, index) => (
                  <Box key={index}>
                    <Typography
                      variant="body1"
                      color="text.primary"
                      sx={{ mt: index > 0 ? 1 : 0 }}
                    >
                      {item.day}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.hours}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Related Products - Professional Grid */}
      {relatedProducts.length > 0 && (
        <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
          <Container maxWidth="lg">
            <Typography
              variant="h5"
              fontWeight="600"
              sx={{ mb: 4, color: 'text.primary' }}
            >
              Ähnliche Produkte
            </Typography>
            <Grid container spacing={3}>
              {relatedProducts.map((relatedProduct) => (
                <Grid item xs={6} md={3} key={relatedProduct.id}>
                  <Card
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'grey.200',
                      boxShadow: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box
                        sx={{
                          height: 120,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mb: 2,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Image
                          width={90}
                          height={90}
                          src={
                            relatedProduct.image ||
                            relatedProduct.imageUrl ||
                            '/assets/images/products/erdbeertorte.jpg'
                          }
                          alt={relatedProduct.name}
                          style={{ objectFit: 'contain' }}
                        />
                      </Box>
                      <Typography
                        variant="body1"
                        fontWeight="600"
                        sx={{
                          mb: 1,
                          // Zwei Zeilen statt nowrap: Die Gewichtsangabe steht
                          // am Ende des Namens ("Mischbrot 1000g") und fiel bei
                          // 150px Kartenbreite sonst der Ellipse zum Opfer.
                          lineHeight: 1.3,
                          // Höhe in Zeilen reservieren, nicht in em: global.css
                          // erzwingt unter 600px line-height 1.7 (!important),
                          // mit 2.6em stünden Preis und Button in einer Reihe
                          // sonst auf verschiedener Höhe.
                          minHeight: '2lh',
                          // Einzelne Wörter wie „Puddingstückchen" passen nicht
                          // in die Spalte - umbrechen statt abschneiden. Kein
                          // hyphens: auto - Chrome trennt „Pud-/dingstück-…"
                          // und braucht damit mehr Zeilen, nicht weniger.
                          overflowWrap: 'anywhere',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {relatedProduct.name}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight="700"
                        color="primary.main"
                        sx={{ mb: 2 }}
                      >
                        {formatPrice(relatedProduct.price)}
                      </Typography>
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        href={`/products/${relatedProduct.id}`}
                        sx={{
                          borderColor: 'grey.300',
                          color: 'text.primary',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                          },
                        }}
                      >
                        Produkt ansehen
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
      )}
    </>
  )
}
