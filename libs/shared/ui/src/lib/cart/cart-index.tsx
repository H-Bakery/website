import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Modal from './cart-modal'
import CartButton from './cart-button'
import { Hero } from '../display'
import { CartContext } from '@bakery/shared/contexts'
import Card from './cart-card'
import Link from 'next/link'

// Price formatter for Euro currency
const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

const Cart = () => {
  const [open, setOpen] = React.useState(false)
  const cartContext = React.useContext(CartContext)
  const items = cartContext?.items || []
  const totalPrice = cartContext?.summary?.total || 0

  return (
    <Box>
      <CartButton onClick={() => setOpen(!open)} />
      <Modal setOpen={setOpen} open={open}>
        <Box>
          <Container maxWidth="sm">
            <Hero title="Warenkorb" />
            <Grid container spacing={2}>
              {items.map((item) => (
                <Card key={item.id} {...item} />
              ))}
            </Grid>
            <Typography variant="h2">
              Summe: {formatter.format(totalPrice)}
            </Typography>
            <Link href="/bestellen">Bestellen</Link>
          </Container>
        </Box>
      </Modal>
    </Box>
  )
}

export default Cart
