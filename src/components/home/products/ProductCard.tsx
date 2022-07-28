import React from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { formatter } from '../../../utils/formatPrice'

interface Props {
  id: number
  name: string
  category: string
  image: string
  price: number
}

const ProductCard: React.FC<Props> = (props) => {
  const {id, name, category, image, price } = props

  return (
    <Box key={id} sx={styles.card}>
      <Box sx={styles.image}>
        <img src={image} alt={name} />
      </Box>
      <Typography sx={styles.name}>
        {name}
      </Typography>
      <Box sx={styles.footer}>
        <Chip size='small' label={category} />
        <Typography variant='button' fontSize='16px'>
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
      p: 1
  },
  image: {
    bgcolor: 'grey.200',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mb: 1,
    minHeight: 140,
    '& img': {
      maxHeight: 120
    }
  },
  name: {
    fontWeight: 'bold',
    mb: 1
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
}

export default ProductCard