import React from 'react'
import { Box, Container, Grid, Typography } from '@mui/material'
import Modal from './Modal'
import CartButton from './CartButton'
import Hero from '../Hero'
import { CartContext } from '../../context/CartContext'
import Card from './Card'
import { formatter } from '../../utils/formatPrice'
import Link from 'next/link'

const Cart = () => {
  const [open, setOpen] = React.useState(false)
  const {items, totalPrice} = React.useContext(CartContext)

  return (
    <Box>
      <CartButton onClick={() => setOpen(!open)} />
      <Modal setOpen={setOpen} open={open}>
        <Box>
          <Container maxWidth='sm'>
            <Hero title='Warenkorb' />
            <Grid container spacing={2}>
              {items.map((item) => (
                <Card key={item.id} {...item} />
              ))}
            </Grid>
            <Typography variant='h2'>Summe: {formatter.format(totalPrice)}</Typography>
            <Link href='/bestellen'>Bestellen</Link>
          </Container>
        </Box>
      </Modal>
    </Box>
  )
}

export default Cart