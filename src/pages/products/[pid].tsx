'use client'
import React from 'react'
import { Box, Chip, Container, Grid, Typography } from '@mui/material'

import Base from '../../layouts/BasePagesRouter'
import Hero from '../../components/Hero'
import { useRouter } from 'next/router'
import { PRODUCTS } from '../../mocks/products'
import { Product } from '../../components/products/types'
import { formatter } from '../../utils/formatPrice'
import Button from '../../components/button/Index'
import { CartContext } from '../../context/CartContext'

const Index = ({ params }: { params: { pid: number } }) => {
  const router = useRouter()
  const { pid } = router.query

  const { add } = React.useContext(CartContext)

  const products: Product[] = PRODUCTS.filter(
    (item) => Number(pid) === Number(item.id)
  )
  const currentProduct: Product = products[0]

  return (
    <Base>
      <Container maxWidth="sm">
        <Hero title={currentProduct?.name} />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Box sx={styles.image}>
              <img src={currentProduct?.image} />
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Typography>{currentProduct?.name} Beschreibung</Typography>
            <Box sx={styles.footer}>
              <Chip size="small" label={currentProduct?.category} />
              <Typography variant="button" fontSize="16px">
                {formatter.format(currentProduct?.price)}
              </Typography>
            </Box>
            {/* <Button sx={{ mt: 2 }} onClick={() => add(currentProduct?.id)}>
              Zum Warenkorb
            </Button> */}
          </Grid>
        </Grid>
      </Container>
    </Base>
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

export async function getStaticProps({ ...ctx }) {
  const { pid } = ctx.params

  console.log('products pid', pid)
  return {
    props: {
      pid,
    },
  }
}

export const dynamicParams = false

export async function getStaticPaths() {
  // const files = fs.readdirSync('projects')
  // const news: NewsType[] = NEWS.filter((item) => slug === item.slug)

  const paths = PRODUCTS.map((item) => ({
    params: {
      pid: item.id.toString(),
    },
  }))

  return {
    paths,
    fallback: false,
  }
}

export default Index
