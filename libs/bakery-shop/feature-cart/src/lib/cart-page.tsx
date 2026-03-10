'use client'
import React, { useContext } from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  IconButton,
  TextField,
  Divider,
  Alert,
  Card,
  CardContent,
  CardMedia,
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

import { CartContext } from '@bakery/shared/contexts'
import { formatter } from '@bakery/shared/utils'
import { Header, Footer } from '@bakery/shared/ui'
import { Hero } from '@bakery/shared/ui'

const CartPage: React.FC = () => {
  const {
    items,
    totalPrice,
    totalCount,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useContext(CartContext)
  const router = useRouter()

  const handleQuantityChange = (id: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(id)
    } else {
      updateQuantity(id, newQuantity)
    }
  }

  const handleProceedToCheckout = () => {
    // For now, redirect to the bestellen page
    router.push('/bestellen')
  }

  const handleContinueShopping = () => {
    router.push('/products')
  }

  if (items.length === 0) {
    return (
      <div>
        <Hero title="Warenkorb" />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <ShoppingCartIcon
              sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
            />
            <Typography variant="h5" gutterBottom>
              Ihr Warenkorb ist leer
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Fügen Sie Produkte aus unserem Sortiment hinzu, um mit der
              Bestellung zu beginnen.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleContinueShopping}
              startIcon={<ArrowBackIcon />}
            >
              Zum Sortiment
            </Button>
          </Paper>
        </Container>
      </div>
    )
  }

  return (
    <div>
      <Hero title="Warenkorb" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={{ xs: 2, md: 4 }}>
          {/* Cart Items */}
          <Grid item xs={12} md={8}>
            <Paper elevation={1} sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1,
                  mb: 3,
                }}
              >
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                >
                  Ihre Bestellung ({totalCount}{' '}
                  {totalCount === 1 ? 'Artikel' : 'Artikel'})
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={clearCart}
                  startIcon={<DeleteIcon />}
                >
                  Warenkorb leeren
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map((item) => (
                  <Card
                    key={item.id}
                    elevation={0}
                    sx={{ border: 1, borderColor: 'divider' }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        {/* Product Image */}
                        <Grid item xs={3} sm={2}>
                          <CardMedia
                            component="div"
                            sx={{
                              height: 80,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                            }}
                          >
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={60}
                              height={60}
                              style={{ objectFit: 'contain' }}
                            />
                          </CardMedia>
                        </Grid>

                        {/* Product Info */}
                        <Grid item xs={9} sm={4}>
                          <Typography
                            variant="h6"
                            sx={{ fontSize: '1rem', fontWeight: 'bold' }}
                          >
                            {item.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.category}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {formatter.format(item.price)} pro Stück
                          </Typography>
                        </Grid>

                        {/* Quantity Controls */}
                        <Grid item xs={12} sm={3}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                            >
                              <RemoveIcon />
                            </IconButton>

                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1
                                handleQuantityChange(item.id, newQty)
                              }}
                              inputProps={{
                                min: 1,
                                style: { textAlign: 'center' },
                              }}
                              sx={{ width: 60 }}
                            />

                            <IconButton
                              size="small"
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity + 1)
                              }
                            >
                              <AddIcon />
                            </IconButton>
                          </Box>
                        </Grid>

                        {/* Subtotal and Remove */}
                        <Grid item xs={12} sm={3}>
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                            }}
                          >
                            <Typography variant="h6" fontWeight="bold">
                              {formatter.format(item.price * item.quantity)}
                            </Typography>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => removeFromCart(item.id)}
                              sx={{ mt: 1 }}
                            >
                              Entfernen
                            </Button>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Order Summary */}
          <Grid item xs={12} md={4}>
            <Paper
              elevation={2}
              sx={{
                p: { xs: 2, md: 3 },
                position: 'sticky',
                top: { xs: 80, md: 20 },
              }}
            >
              <Typography variant="h5" component="h3" gutterBottom>
                Bestellübersicht
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography>Artikel ({totalCount})</Typography>
                  <Typography>{formatter.format(totalPrice)}</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    Gesamtsumme
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatter.format(totalPrice)}
                  </Typography>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 3 }}>
                Die finale Bestellung erfolgt über Telefon oder WhatsApp.
              </Alert>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                onClick={handleProceedToCheckout}
                sx={{ mb: 2 }}
              >
                Jetzt bestellen
              </Button>

              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={handleContinueShopping}
                startIcon={<ArrowBackIcon />}
              >
                Weiter einkaufen
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </div>
  )
}

export default CartPage
