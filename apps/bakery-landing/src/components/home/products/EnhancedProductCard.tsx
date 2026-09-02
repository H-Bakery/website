'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import {
  Box,
  Chip,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Fade,
} from '@mui/material'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'
import Image from 'next/image'

import { formatPrice } from '../../../utils/formatPrice'
import { Product } from '../../../types/product'

// Animation keyframes removed - using simple CSS transitions instead

interface EnhancedProductCardProps extends Product {
  isFreshToday?: boolean
  isNew?: boolean
  isOrganic?: boolean
}

const EnhancedProductCard: React.FC<EnhancedProductCardProps> = (props) => {
  const {
    isFreshToday = props.id % 2 === 0,
    isNew = props.id % 10 === 1,
    isOrganic = props.isVegan || false,
    ...product
  } = props

  const imageSrc =
    product.imageUrl ||
    product.image ||
    '/assets/images/products/erdbeertorte.jpg'

  const [isHovered, setIsHovered] = useState(false)

  return (
    <Card
      elevation={isHovered ? 8 : 2}
      sx={styles.card}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badges - Commented out as requested */}
      {/* <Box sx={styles.badgeContainer}>
        {isFreshToday && (
          <Chip
            icon={<LocalFireDepartmentIcon />}
            label="Heute frisch"
            size="small"
            sx={styles.freshBadge}
          />
        )}
        {isNew && (
          <Chip
            icon={<NewReleasesIcon />}
            label="Neu"
            size="small"
            sx={styles.newBadge}
          />
        )}
        {isOrganic && (
          <Chip
            icon={<LocalFloristIcon />}
            label="Bio"
            size="small"
            sx={styles.organicBadge}
          />
        )}
      </Box> */}

      <CardActionArea
        component={Link}
        href={`/products/${product.id}`}
        sx={styles.actionArea}
      >
        <CardMedia component="div" sx={styles.imageContainer}>
          <Box sx={styles.imageWrapper}>
            <Image
              width={280}
              height={200}
              src={imageSrc}
              alt={`Bild von ${product.name}`}
              loading="lazy"
              quality={75}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              style={{
                width: '100%',
                height: '100%',
                objectFit: imageSrc.endsWith('.svg') ? 'contain' : 'cover',
              }}
            />
          </Box>

          {/* Quick View Overlay */}
          <Fade in={isHovered}>
            <Box sx={styles.quickViewOverlay}>
              <Typography variant="body2" sx={styles.quickViewText}>
                Schnellansicht
              </Typography>
            </Box>
          </Fade>
        </CardMedia>

        <CardContent sx={styles.content}>
          {/* Product Name */}
          <Typography variant="h6" component="h3" sx={styles.name}>
            {product.name}
          </Typography>

          {/* Description */}
          {product.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={styles.description}
            >
              {product.description}
            </Typography>
          )}

          {/* Footer */}
          <Box sx={styles.footer}>
            <Chip
              size="small"
              label={product.category}
              sx={styles.categoryChip}
            />
            <Typography variant="h6" component="p" sx={styles.price}>
              {formatPrice(product.price)}
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
    position: 'relative',
    overflow: 'visible',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-6px)',
      boxShadow: '0 12px 28px rgba(107, 68, 35, 0.15)', // Warm brown shadow
      '& .MuiCardMedia-root img': {
        transform: 'scale(1.05)',
      },
    },
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 0.5,
  },
  freshBadge: {
    backgroundColor: 'secondary.main', // Dusty rose
    color: 'primary.dark',
    fontWeight: 'bold',
    '& .MuiChip-icon': {
      color: 'primary.dark',
    },
  },
  newBadge: {
    backgroundColor: 'primary.main', // Warm brown
    color: 'white',
    fontWeight: 'bold',
    '& .MuiChip-icon': {
      color: 'white',
    },
  },
  organicBadge: {
    backgroundColor: 'success.main',
    color: 'white',
    fontWeight: 'bold',
    '& .MuiChip-icon': {
      color: 'white',
    },
  },
  actionArea: {
    flexGrow: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    overflow: 'hidden',
    backgroundColor: 'grey.50', // Warm cream background
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    '& img': {
      transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  quickViewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  quickViewText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    p: 2.5,
  },
  name: {
    fontWeight: 700,
    fontSize: '1.15rem',
    lineHeight: 1.3,
    mb: 1,
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
    mb: 1.5,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  categoryChip: {
    backgroundColor: 'grey.100', // Soft beige background
    color: 'primary.main', // Warm brown text
    fontWeight: 'medium',
    fontSize: '0.75rem',
  },
  price: {
    fontWeight: 'bold',
    color: 'primary.main', // Warm brown price
  },
}

export default EnhancedProductCard
