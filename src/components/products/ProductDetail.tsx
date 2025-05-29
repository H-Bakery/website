'use client'

import React from 'react'
import { Box, Chip, Container, Grid, Typography } from '@mui/material'
import Hero from '../../components/Hero'
import { Product } from '../../components/products/types'
import { formatter } from '../../utils/formatPrice'
import Button from '../../components/button/Index'
import { CartContext } from '../../context/CartContext'
import Image from 'next/image'

interface ProductDetailProps {
  product: Product
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const { add } = React.useContext(CartContext)

  return (
    <Container maxWidth="sm">
      <Hero title={product?.name} />
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box sx={styles.image}>
            <Image src={product?.image} alt={product?.name} />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Typography>{product?.name} Beschreibung</Typography>
          <Box sx={styles.footer}>
            <Chip size="small" label={product?.category} />
            <Typography variant="button" fontSize="16px">
              {formatter.format(product?.price)}
            </Typography>
          </Box>
          {/* <Button sx={{ mt: 2 }} onClick={() => add(product?.id)}>
            Zum Warenkorb
          </Button> */}
        </Grid>
      </Grid>
    </Container>
  )
}

const styles = {
  image: {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    height: { xs: '45vw', sm: '260px' },
    width: '100%',
    borderRadius: '8px',
    boxShadow: 1,
    mb: 2,
    bgcolor: 'background.paper',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',

    '& img': {
      maxWidth: '80%',
    },
  },
  footer: {
    mt: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}
