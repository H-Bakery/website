import React from 'react'
import { useRouter } from 'next/navigation'
import { Box, Chip, Typography } from '@mui/material'

import { formatter } from '../../../utils/formatPrice'
import { CartContext } from '../../../context/CartContext'

interface Props {
  id: number
  name: string
  category: string
  image: string
  price: number
}

const ProductCard: React.FC<Props> = (props) => {
  const { id, name, category, image, price } = props

  const router = useRouter()

  return (
    <Box
      sx={styles.card}
      onClick={() => router.push(`products/${id}`)}
      className="product-card"
    >
      <Box sx={styles.image} className="image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={name} />
      </Box>
      <Typography sx={styles.name}>{name}</Typography>
      <Box sx={styles.footer}>
        <Chip size="small" label={category} />
        <Typography variant="button" fontSize="16px">
          {formatter.format(price)}
        </Typography>
      </Box>
    </Box>
  )
}

const styles = {
  card: {
    bgcolor: 'background.paper',
    borderRadius: '8px',
    boxShadow: 1,
    display: 'flex',
    flexDirection: 'column',
    p: 1,
    transition: 'all ease-in-out 200ms',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-4px)',
      bgcolor: 'grey.300',
      '& .image': {
        bgcolor: 'grey.50',
      },
    },
  },
  image: {
    bgcolor: 'grey.200',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mb: 1,
    minHeight: 140,
    transition: 'all ease-in-out 300ms',
    '& img': {
      maxWidth: '90%',
      maxHeight: 120,
    },
  },
  name: {
    fontWeight: 'bold',
    mb: 1,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}

export default ProductCard
