'use client'
import React, { useState } from 'react'
import { Box, Button, Container, Typography, Chip, Grid } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import type { ProductsByCategory as CategoryGroup } from '../../lib/products'

interface ProductsByCategoryProps {
  categories: CategoryGroup[]
  /** When true, show a limited teaser with CTA link to /products */
  teaser?: boolean
  /** Max total products to show in teaser mode (default: 8) */
  maxProducts?: number
}

const CATEGORY_ICONS: Record<string, string> = {
  brot: '\uD83C\uDF5E',
  baguette: '\uD83E\uDD56',
  broetchen: '\uD83E\uDD50',
  teilchen: '\uD83E\uDD50',
  snacks: '\uD83E\uDD68',
  kuchen: '\uD83C\uDF70',
  torten: '\uD83C\uDF82',
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(price)
}

const ProductsByCategory: React.FC<ProductsByCategoryProps> = ({
  categories,
  teaser = false,
  maxProducts = 8,
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // In teaser mode: pick up to maxProducts across categories (round-robin)
  const teaserCategories = React.useMemo(() => {
    if (!teaser) return categories
    const result: CategoryGroup[] = []
    let remaining = maxProducts
    for (const cat of categories) {
      if (remaining <= 0) break
      const take = Math.min(2, cat.products.length, remaining)
      if (take > 0) {
        result.push({ ...cat, products: cat.products.slice(0, take) })
        remaining -= take
      }
    }
    return result
  }, [teaser, categories, maxProducts])

  const displayCategories = teaser ? teaserCategories : categories

  const visibleCategories = activeCategory
    ? displayCategories.filter((c) => c.key === activeCategory)
    : displayCategories

  return (
    <Box
      component="section"
      sx={{ py: { xs: 5, md: 7 }, backgroundColor: '#FAFAF7' }}
      aria-label="Unser Sortiment"
    >
      <Container maxWidth="lg">
        {/* Section Heading */}
        <Typography
          variant="h3"
          component="h2"
          sx={{
            textAlign: 'center',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            color: '#3B2B28',
            mb: 1,
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.25rem' },
          }}
        >
          Unser Sortiment
        </Typography>
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            color: '#928168',
            mb: { xs: 3, md: 4 },
            fontSize: { xs: '1rem', md: '1.1rem' },
          }}
        >
          {teaser
            ? 'Eine kleine Auswahl aus unserem Angebot'
            : `${categories.reduce(
                (sum, c) => sum + c.products.length,
                0
              )} Produkte in ${categories.length} Kategorien`}
        </Typography>

        {/* Category Filter Chips — only on full view */}
        {!teaser && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 1,
              mb: { xs: 3, md: 4 },
            }}
          >
            <Chip
              label="Alle"
              variant={activeCategory === null ? 'filled' : 'outlined'}
              onClick={() => setActiveCategory(null)}
              sx={{
                fontWeight: 600,
                backgroundColor:
                  activeCategory === null ? '#5A2E2A' : 'transparent',
                color: activeCategory === null ? '#fff' : '#5A2E2A',
                borderColor: '#5A2E2A',
                '&:hover': {
                  backgroundColor:
                    activeCategory === null
                      ? '#3B2B28'
                      : 'rgba(90, 46, 42, 0.08)',
                },
              }}
            />
            {displayCategories.map((cat) => (
              <Chip
                key={cat.key}
                label={`${cat.label} (${cat.products.length})`}
                variant={activeCategory === cat.key ? 'filled' : 'outlined'}
                onClick={() => setActiveCategory(cat.key)}
                sx={{
                  fontWeight: 600,
                  backgroundColor:
                    activeCategory === cat.key ? '#5A2E2A' : 'transparent',
                  color: activeCategory === cat.key ? '#fff' : '#5A2E2A',
                  borderColor: '#5A2E2A',
                  '&:hover': {
                    backgroundColor:
                      activeCategory === cat.key
                        ? '#3B2B28'
                        : 'rgba(90, 46, 42, 0.08)',
                  },
                }}
              />
            ))}
          </Box>
        )}

        {/* Category Sections */}
        {visibleCategories.map((cat, idx) => (
          <Box
            key={cat.key}
            sx={{
              mb:
                teaser && idx === visibleCategories.length - 1
                  ? 0
                  : { xs: 4, md: 5 },
            }}
          >
            {/* Category Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 2.5,
                pb: 1,
                borderBottom: '2px solid #E6D8C3',
              }}
            >
              <Typography
                component="span"
                sx={{ fontSize: '1.5rem', lineHeight: 1 }}
                role="img"
                aria-hidden="true"
              >
                {CATEGORY_ICONS[cat.key]}
              </Typography>
              <Typography
                variant="h5"
                component="h3"
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontWeight: 700,
                  color: '#3B2B28',
                  fontSize: { xs: '1.25rem', md: '1.5rem' },
                }}
              >
                {cat.label}
              </Typography>
              <Typography variant="body2" sx={{ color: '#928168', ml: 'auto' }}>
                {cat.products.length}{' '}
                {cat.products.length === 1 ? 'Produkt' : 'Produkte'}
              </Typography>
            </Box>

            {/* Product Grid */}
            <Grid container spacing={2}>
              {cat.products.map((product) => (
                <Grid item xs={6} sm={4} md={3} lg={2.4} key={product.id}>
                  <Box
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 1px 6px rgba(90, 46, 42, 0.06)',
                      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(90, 46, 42, 0.12)',
                        transform: 'translateY(-2px)',
                      },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Product Image */}
                    {product.image && (
                      <Box
                        sx={{
                          aspectRatio: '1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#FFF3E6',
                          p: 2,
                        }}
                      >
                        <Box
                          component="img"
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          sx={{
                            maxWidth: '70%',
                            maxHeight: '70%',
                            objectFit: 'contain',
                          }}
                        />
                      </Box>
                    )}

                    {/* Product Info */}
                    <Box
                      sx={{
                        p: { xs: 1.5, md: 2 },
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: '#3B2B28',
                          fontSize: { xs: '0.85rem', md: '0.95rem' },
                          lineHeight: 1.3,
                          mb: 0.5,
                          flexGrow: 1,
                        }}
                      >
                        {product.name}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 700,
                          color: '#5A2E2A',
                          fontSize: { xs: '0.95rem', md: '1.05rem' },
                        }}
                      >
                        {formatPrice(product.price)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        {/* CTA Button — teaser mode only */}
        {teaser && (
          <Box sx={{ textAlign: 'center', mt: { xs: 3, md: 4 } }}>
            <Button
              href="/products"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                backgroundColor: '#5A2E2A',
                color: '#fff',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                borderRadius: '8px',
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                '&:hover': {
                  backgroundColor: '#3B2B28',
                },
              }}
            >
              Alle Produkte entdecken
            </Button>
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default ProductsByCategory
