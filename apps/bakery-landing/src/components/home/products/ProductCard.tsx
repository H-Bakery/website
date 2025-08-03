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
  Button,
  CardActions,
} from '@mui/material'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import Image from 'next/image'

import { formatCurrency } from '@bakery/shared/utils'
// import { CartContext } from '../../../context/CartContext' // Not needed for static export
import { Product } from '@bakery/shared/types'

interface Props extends Product {}

const ProductCard: React.FC<Props> = (props) => {
  // Static export - no cart functionality needed
  const addToCartHandler = () => {
    console.log('Navigate to shop for full cart functionality')
  }
  const router = useRouter()

  const handleCardClick = () => {
    router.push(`products/${props.id}`)
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  const handleAddToCart = (event: React.MouseEvent) => {
    event.stopPropagation()
    addToCartHandler()
  }

  return (
    <Card elevation={2} sx={styles.card}>
      <CardActionArea
        onClick={handleCardClick}
        onKeyDown={handleKeyPress}
        tabIndex={0}
        aria-label={`Produkt anzeigen: ${props.name}, Preis: ${formatCurrency(
          props.price
        )}`}
      >
        <CardMedia component="div" sx={styles.imageContainer}>
          <Image
            width={200}
            height={150}
            src={props.imageUrl || '/placeholder-product.jpg'}
            alt={`Bild von ${props.name}`}
            style={{
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain' as const,
              transition: 'transform 0.3s ease',
            }}
          />
        </CardMedia>

        <CardContent sx={styles.content}>
          <Box sx={styles.nameContainer}>
            <Typography variant="h6" component="h3" sx={styles.name}>
              {props.name}
            </Typography>

            {props.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={styles.description}
              >
                {props.description}
              </Typography>
            )}
          </Box>

          <Box sx={styles.footer}>
            <Chip
              size="small"
              label={props.category}
              color="primary"
              variant="outlined"
              sx={styles.categoryChip}
            />
            <Typography
              variant="button"
              fontWeight="bold"
              fontSize="16px"
              aria-label={`Preis: ${formatCurrency(props.price)}`}
            >
              {formatCurrency(props.price)}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>

      <CardActions sx={styles.actions}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddShoppingCartIcon />}
          onClick={handleAddToCart}
          fullWidth
          size="small"
        >
          In den Warenkorb
        </Button>
      </CardActions>
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
  actions: {
    padding: 2,
    paddingTop: 0,
  },
}

export default ProductCard
