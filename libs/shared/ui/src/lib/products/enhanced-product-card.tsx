import React, { useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Chip,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Button,
  CardActions,
  IconButton,
  Tooltip,
  Fade,
  Rating,
} from '@mui/material'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'
import Image from 'next/image'
import { keyframes } from '@mui/system'

import { formatter } from '../../../utils/formatPrice'
import { CartContext } from '../../../context/CartContext'
import { Product } from '../../../types/product'

// Animation keyframes
const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`

const slideIn = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`

interface EnhancedProductCardProps extends Product {
  isFreshToday?: boolean
  isNew?: boolean
  isOrganic?: boolean
  rating?: number
  reviewCount?: number
}

const EnhancedProductCard: React.FC<EnhancedProductCardProps> = (props) => {
  const {
    isFreshToday = Math.random() > 0.5, // Temporary random assignment
    isNew = Math.random() > 0.8,
    isOrganic = Math.random() > 0.7,
    rating = 4 + Math.random(),
    reviewCount = Math.floor(Math.random() * 50) + 10,
    ...product
  } = props

  const { addToCart } = useContext(CartContext)
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)

  const handleCardClick = () => {
    router.push(`/products/${product.id}`)
  }

  const handleAddToCart = (event: React.MouseEvent) => {
    event.stopPropagation()
    addToCart(product)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleToggleFavorite = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsFavorite(!isFavorite)
  }

  return (
    <Card
      elevation={isHovered ? 8 : 2}
      sx={styles.card}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badges */}
      <Box sx={styles.badgeContainer}>
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
      </Box>

      {/* Favorite Button */}
      <IconButton
        sx={styles.favoriteButton}
        onClick={handleToggleFavorite}
        size="small"
      >
        {isFavorite ? (
          <FavoriteIcon sx={{ color: 'primary.main' }} />
        ) : (
          <FavoriteBorderIcon />
        )}
      </IconButton>

      <CardActionArea onClick={handleCardClick} sx={styles.actionArea}>
        <CardMedia component="div" sx={styles.imageContainer}>
          <Box sx={styles.imageWrapper}>
            <Image
              width={280}
              height={200}
              src={product.image}
              alt={`Bild von ${product.name}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
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

          {/* Rating */}
          {rating && (
            <Box sx={styles.ratingContainer}>
              <Rating value={rating} precision={0.5} size="small" readOnly />
              <Typography variant="body2" color="text.secondary">
                ({reviewCount})
              </Typography>
            </Box>
          )}

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
              {formatter.format(product.price)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>

      <CardActions sx={styles.actions}>
        <Tooltip title={addedToCart ? 'Hinzugefügt!' : 'In den Warenkorb'}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddShoppingCartIcon />}
            onClick={handleAddToCart}
            fullWidth
            size="medium"
            sx={{
              ...styles.addToCartButton,
              ...(addedToCart && styles.addedToCartButton),
            }}
          >
            {addedToCart ? 'Hinzugefügt!' : 'In den Warenkorb'}
          </Button>
        </Tooltip>
      </CardActions>
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
      transform: 'translateY(-8px)',
      '& .MuiCardMedia-root img': {
        transform: 'scale(1.1)',
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
    backgroundColor: 'error.main',
    color: 'white',
    fontWeight: 'bold',
    animation: `${pulse} 2s ease-in-out infinite`,
    '& .MuiChip-icon': {
      color: 'white',
    },
  },
  newBadge: {
    backgroundColor: 'primary.main',
    color: 'white',
    fontWeight: 'bold',
    animation: `${slideIn} 0.5s ease-out`,
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
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 1)',
    },
  },
  actionArea: {
    flexGrow: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    overflow: 'hidden',
    backgroundColor: 'grey.100',
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
  ratingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    mb: 1,
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
    backgroundColor: 'primary.light',
    color: 'primary.dark',
    fontWeight: 'medium',
    fontSize: '0.75rem',
  },
  price: {
    fontWeight: 'bold',
    color: 'primary.main',
  },
  actions: {
    p: 2,
    pt: 0,
  },
  addToCartButton: {
    fontWeight: 'bold',
    py: 1,
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'scale(1.02)',
      boxShadow: '0 4px 20px rgba(208, 56, 186, 0.3)',
    },
  },
  addedToCartButton: {
    backgroundColor: 'success.main',
    '&:hover': {
      backgroundColor: 'success.dark',
    },
  },
}

export default EnhancedProductCard
