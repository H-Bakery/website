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
          <img
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
