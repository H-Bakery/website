'use client'
import React from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Chip,
  useTheme,
  alpha,
} from '@mui/material'
import { keyframes } from '@mui/system'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'
import FilterVintageIcon from '@mui/icons-material/FilterVintage'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import EnhancedButton from '../button/EnhancedButton'

// Animation keyframes
const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`

// Get current season
const getCurrentSeason = () => {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

interface SeasonalProduct {
  id: number
  name: string
  description: string
  price: number
  image: string
  season: string
  isNew?: boolean
  special?: string
}

const seasonalProducts: SeasonalProduct[] = [
  // Winter
  {
    id: 1,
    name: 'Lebkuchen',
    description: 'Traditionelle Weihnachtsleckerei mit Gewürzen',
    price: 3.5,
    image: '/assets/images/products/lebkuchen.jpg',
    season: 'winter',
    isNew: false,
    special: 'Weihnachten',
  },
  {
    id: 2,
    name: 'Stollen',
    description: 'Saftiger Christstollen mit Rosinen und Marzipan',
    price: 12.9,
    image: '/assets/images/products/stollen.jpg',
    season: 'winter',
    isNew: true,
  },
  // Spring
  {
    id: 3,
    name: 'Osterzopf',
    description: 'Fluffiger Hefezopf perfekt für den Osterbrunch',
    price: 8.5,
    image: '/assets/images/products/osterzopf.jpg',
    season: 'spring',
    special: 'Ostern',
  },
  {
    id: 4,
    name: 'Rhabarberkuchen',
    description: 'Frischer Kuchen mit regionalem Rhabarber',
    price: 3.2,
    image: '/assets/images/products/rhabarber.jpg',
    season: 'spring',
    isNew: true,
  },
  // Summer
  {
    id: 5,
    name: 'Erdbeertorte',
    description: 'Leichte Torte mit frischen Erdbeeren',
    price: 24.9,
    image: '/assets/images/products/erdbeertorte.jpg',
    season: 'summer',
    special: 'Sommer-Hit',
  },
  {
    id: 6,
    name: 'Zitronen-Cupcakes',
    description: 'Erfrischende Cupcakes mit Zitronencreme',
    price: 2.9,
    image: '/assets/images/products/zitronencupcake.jpg',
    season: 'summer',
  },
  // Autumn
  {
    id: 7,
    name: 'Zwetschgenkuchen',
    description: 'Klassischer Pflaumenkuchen vom Blech',
    price: 3.5,
    image: '/assets/images/products/zwetschgen.jpg',
    season: 'autumn',
  },
  {
    id: 8,
    name: 'Kürbisbrot',
    description: 'Herzhaftes Brot mit Kürbis und Kernen',
    price: 4.2,
    image: '/assets/images/products/kuerbisbrot.jpg',
    season: 'autumn',
    isNew: true,
    special: 'Herbst-Neuheit',
  },
]

const seasonConfig = {
  winter: {
    icon: <AcUnitIcon />,
    color: '#1976d2',
    title: 'Winter-Spezialitäten',
    subtitle: 'Wärmende Leckereien für kalte Tage',
  },
  spring: {
    icon: <LocalFloristIcon />,
    color: '#4caf50',
    title: 'Frühlingsfrische',
    subtitle: 'Leichte Genüsse zum Start ins Jahr',
  },
  summer: {
    icon: <WbSunnyIcon />,
    color: '#ff9800',
    title: 'Sommer-Highlights',
    subtitle: 'Erfrischende Kreationen für heiße Tage',
  },
  autumn: {
    icon: <FilterVintageIcon />,
    color: '#d84315',
    title: 'Herbstliche Köstlichkeiten',
    subtitle: 'Traditionelle Backwaren zur Erntezeit',
  },
}

const SeasonalHighlights: React.FC = () => {
  const theme = useTheme()
  const currentSeason = getCurrentSeason()
  const config = seasonConfig[currentSeason as keyof typeof seasonConfig]
  const currentProducts = seasonalProducts.filter(
    (p) => p.season === currentSeason
  )
  const [imageErrors, setImageErrors] = React.useState<{
    [key: number]: boolean
  }>({})

  const handleImageError = (productId: number) => {
    setImageErrors((prev) => ({ ...prev, [productId]: true }))
  }

  return (
    <Box
      sx={{
        py: 8,
        position: 'relative',
        backgroundColor: alpha(config.color, 0.05),
        overflow: 'hidden',
      }}
    >
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          fontSize: 200,
          color: alpha(config.color, 0.1),
          transform: 'rotate(-15deg)',
        }}
      >
        {config.icon}
      </Box>

      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              color: config.color,
            }}
          >
            {config.icon}
            <Typography
              variant="overline"
              sx={{
                fontWeight: 'bold',
                letterSpacing: 2,
                fontSize: '0.9rem',
              }}
            >
              Saisonal
            </Typography>
          </Box>

          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            {config.title}
          </Typography>

          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            {config.subtitle}
          </Typography>
        </Box>

        {/* Products Grid */}
        <Grid container spacing={4} sx={{ mb: 4 }}>
          {currentProducts.map((product, index) => (
            <Grid item xs={12} sm={6} md={3} key={product.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  transition: 'all 0.3s ease',
                  animation: `${float} 3s ease-in-out ${index * 0.5}s infinite`,
                  '&:hover': {
                    transform: 'translateY(-8px) scale(1.02)',
                    boxShadow: 6,
                  },
                }}
              >
                {/* Badges */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 1,
                    display: 'flex',
                    gap: 0.5,
                    flexDirection: 'column',
                  }}
                >
                  {product.isNew && (
                    <Chip
                      icon={<NewReleasesIcon />}
                      label="Neu"
                      size="small"
                      sx={{
                        backgroundColor: 'primary.main',
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                  {product.special && (
                    <Chip
                      label={product.special}
                      size="small"
                      sx={{
                        backgroundColor: alpha(config.color, 0.9),
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                </Box>

                {/* Image */}
                <CardMedia
                  component="div"
                  sx={{
                    height: 200,
                    backgroundColor: alpha(config.color, 0.1),
                    position: 'relative',
                    overflow: 'hidden',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `linear-gradient(180deg, transparent 60%, ${alpha(
                        theme.palette.background.paper,
                        0.8
                      )} 100%)`,
                    },
                  }}
                >
                  {/* Try to load actual image */}
                  {!imageErrors[product.id] && (
                    <Box
                      component="img"
                      src={product.image}
                      alt={product.name}
                      onError={() => handleImageError(product.id)}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                      }}
                    />
                  )}

                  {/* Fallback placeholder */}
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: imageErrors[product.id] ? 'flex' : 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '4rem',
                      color: config.color,
                      background: `radial-gradient(circle at center, ${alpha(
                        config.color,
                        0.1
                      )} 0%, ${alpha(config.color, 0.05)} 100%)`,
                    }}
                  >
                    {config.icon}
                  </Box>
                </CardMedia>

                {/* Content */}
                <CardContent sx={{ flexGrow: 1, pb: 2 }}>
                  <Typography
                    variant="h6"
                    component="h3"
                    gutterBottom
                    sx={{ fontWeight: 'bold' }}
                  >
                    {product.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {product.description}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: 'primary.main',
                      fontWeight: 'bold',
                    }}
                  >
                    €{product.price.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* CTA Section */}
        <Box
          sx={{
            textAlign: 'center',
            p: 4,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'medium' }}>
            Entdecken Sie alle unsere saisonalen Produkte
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Frisch zubereitet mit den besten Zutaten der Saison
          </Typography>
          <EnhancedButton
            variant="contained"
            size="large"
            href="/products"
            sx={{
              background: `linear-gradient(45deg, ${config.color} 30%, ${alpha(
                config.color,
                0.7
              )} 90%)`,
              color: 'white',
              '&:hover': {
                background: `linear-gradient(45deg, ${
                  config.color
                } 10%, ${alpha(config.color, 0.8)} 80%)`,
              },
            }}
          >
            Alle Produkte ansehen
          </EnhancedButton>
        </Box>
      </Container>
    </Box>
  )
}

export default SeasonalHighlights
