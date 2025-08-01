'use client'
import React, { useState } from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Fade,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import EnhancedButton from '../button/EnhancedButton'
import { createWhatsAppLink, contactConfig } from '../../config/contact'

// Animation keyframes
const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`

// Popular quick order items
const quickOrderItems = [
  { id: 1, name: 'Bauernbrot', category: 'Brot', price: 3.50, emoji: '🍞', popular: true },
  { id: 2, name: 'Laugenbrezel', category: 'Gebäck', price: 1.20, emoji: '🥨', popular: true },
  { id: 3, name: 'Croissant', category: 'Gebäck', price: 1.80, emoji: '🥐', popular: false },
  { id: 4, name: 'Mehrkornbrötchen', category: 'Brötchen', price: 0.85, emoji: '🥖', popular: true },
  { id: 5, name: 'Apfelkuchen', category: 'Kuchen', price: 2.50, emoji: '🍰', popular: false },
  { id: 6, name: 'Schokobrötchen', category: 'Süßgebäck', price: 1.50, emoji: '🍫', popular: true },
]

interface QuickOrderItem {
  id: number
  name: string
  category: string
  price: number
  emoji: string
  popular: boolean
  quantity?: number
}

const QuickOrder: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [searchTerm, setSearchTerm] = useState('')
  const [orderItems, setOrderItems] = useState<{ [key: number]: number }>({})

  const filteredItems = quickOrderItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const updateQuantity = (itemId: number, delta: number) => {
    setOrderItems(prev => {
      const newQuantity = (prev[itemId] || 0) + delta
      if (newQuantity <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQuantity }
    })
  }

  const totalItems = Object.values(orderItems).reduce((sum, qty) => sum + qty, 0)
  const totalPrice = Object.entries(orderItems).reduce(
    (sum, [itemId, qty]) => {
      const item = quickOrderItems.find(i => i.id === parseInt(itemId))
      return sum + (item ? item.price * qty : 0)
    },
    0
  )

  const handleOrder = () => {
    const orderText = Object.entries(orderItems)
      .map(([itemId, qty]) => {
        const item = quickOrderItems.find(i => i.id === parseInt(itemId))
        return item ? `${qty}x ${item.name}` : ''
      })
      .filter(Boolean)
      .join(', ')

    const message = `Hallo! Ich möchte folgendes bestellen: ${orderText}. Gesamtpreis: €${totalPrice.toFixed(2)}`
    const whatsappUrl = createWhatsAppLink(message)
    
    // Try to open WhatsApp, with fallback handling
    try {
      window.open(whatsappUrl, '_blank')
    } catch (error) {
      // If WhatsApp fails, show fallback contact options
      alert(`Bitte kontaktieren Sie uns unter:\n\nTelefon: ${contactConfig.whatsapp.fallback.phone}\nE-Mail: ${contactConfig.whatsapp.fallback.email}\n\nIhre Bestellung:\n${message}`)
    }
  }

  return (
    <Box
      sx={{
        py: 8,
        backgroundColor: 'background.default',
        position: 'relative',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Schnellbestellung
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto', mb: 2 }}
          >
            Bestellen Sie Ihre Favoriten mit nur wenigen Klicks
          </Typography>
          
          {/* Features */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              icon={<AccessTimeIcon />}
              label="Abholung in 30 Min"
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<LocalFireDepartmentIcon />}
              label="Täglich frisch"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<WhatsAppIcon />}
              label="WhatsApp Bestellung"
              sx={{ 
                borderColor: '#25D366',
                color: '#25D366',
                '& .MuiChip-icon': { color: '#25D366' }
              }}
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Search */}
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Suchen Sie nach Ihren Lieblingsprodukten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '30px',
                backgroundColor: 'background.paper',
              },
            }}
          />
        </Box>

        {/* Quick Order Items */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {filteredItems.map((item, index) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <Fade in={true} timeout={500 + index * 100}>
                <Paper
                  elevation={orderItems[item.id] ? 3 : 1}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: orderItems[item.id] ? 'primary.main' : 'transparent',
                    transition: 'all 0.3s ease',
                    animation: `${slideUp} 0.5s ease-out ${index * 0.1}s both`,
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Emoji and Info */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h4" component="span">
                          {item.emoji}
                        </Typography>
                        <Box>
                          <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
                            {item.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {item.category}
                            </Typography>
                            {item.popular && (
                              <Chip
                                label="Beliebt"
                                size="small"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                        €{item.price.toFixed(2)}
                      </Typography>
                    </Box>

                    {/* Quantity Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={!orderItems[item.id]}
                        sx={{
                          backgroundColor: 'background.default',
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                      >
                        <RemoveIcon />
                      </IconButton>
                      
                      <Typography
                        variant="h6"
                        sx={{
                          minWidth: 30,
                          textAlign: 'center',
                          fontWeight: 'bold',
                        }}
                      >
                        {orderItems[item.id] || 0}
                      </Typography>
                      
                      <IconButton
                        size="small"
                        onClick={() => updateQuantity(item.id, 1)}
                        sx={{
                          backgroundColor: 'primary.light',
                          color: 'primary.main',
                          '&:hover': { 
                            backgroundColor: 'primary.main',
                            color: 'white',
                          },
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              </Fade>
            </Grid>
          ))}
        </Grid>

        {/* Order Summary */}
        {totalItems > 0 && (
          <Fade in={true}>
            <Paper
              elevation={4}
              sx={{
                position: 'sticky',
                bottom: isMobile ? 16 : 32,
                p: 3,
                borderRadius: 3,
                backgroundColor: 'background.paper',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                animation: `${bounce} 2s ease-in-out infinite`,
              }}
            >
              <Grid container alignItems="center" spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Badge badgeContent={totalItems} color="primary">
                      <ShoppingCartIcon sx={{ fontSize: 30 }} />
                    </Badge>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Ihre Bestellung
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {totalItems} {totalItems === 1 ? 'Artikel' : 'Artikel'} • €{totalPrice.toFixed(2)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
                    <EnhancedButton
                      variant="contained"
                      color="success"
                      startIcon={<WhatsAppIcon />}
                      onClick={handleOrder}
                      fullWidth={isMobile}
                      pulse
                      sx={{
                        backgroundColor: '#25D366',
                        '&:hover': {
                          backgroundColor: '#128C7E',
                        },
                      }}
                    >
                      Per WhatsApp bestellen
                    </EnhancedButton>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Fade>
        )}
      </Container>
    </Box>
  )
}

export default QuickOrder