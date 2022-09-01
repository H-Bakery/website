import React from 'react'
import {
  Box,
  BoxProps,
  Button,
  Container,
  Grid,
  Typography,
} from '@mui/material'
import ProductCard from '../home/products/ProductCard'
import { Product } from '../products/types'
import { Fade } from 'react-slideshow-image'

interface Props extends BoxProps {
  header?: React.ReactNode
  items: Product[]
}

const Products: React.FC<Props> = (props) => {
  const { items, header, sx } = props

  return (
    <Box
      sx={{
        ...sx,
        '& .product-card': {
          p: 2,
          '& .MuiTypography-root': {
            fontSize: 24,
          },
          '& .MuiChip-root': {
            p: 1,
            height: 'auto',
            borderRadius: '50px',
          },
          '& .MuiChip-label': {
            fontSize: 20,
          },
        },
      }}
    >
      <Typography sx={{ mb: 1 }} variant="h4">
        {header}
      </Typography>
      <Fade arrows={false}>
        {items.map((item, index) => (
          <ProductCard {...item} key={item.id} />
        ))}
      </Fade>
    </Box>
  )
}

export default Products
