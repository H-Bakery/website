import React from 'react'
import { Box, Container, Grid } from '@mui/material'
import Modal from './Modal'
import CartButton from './CartButton'
import Hero from '../Hero'
import { CartContext } from '../../context/CartContext'
import Card from './Card'

const Cart = () => {
  const [open, setOpen] = React.useState(false)
  const {items} = React.useContext(CartContext)

  return (
    <Box>
      <CartButton onClick={() => setOpen(!open)} />
      <Modal setOpen={setOpen} open={open}>
        <Box>
          <Container maxWidth='sm'>
            <Hero title='Warenkorb' />
            <Grid container spacing={2}>
              {items.map((item) => (
                <Card {...item} />
              ))}
            </Grid>
          </Container>
        </Box>
      </Modal>
    </Box>
  )
}

export default Cart