'use client'
import React, { useState, useContext } from 'react'
import {
  Box,
  Typography,
  IconButton,
  Fab,
  Fade,
  Zoom,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { keyframes } from '@mui/system'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import CloseIcon from '@mui/icons-material/Close'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useRouter, usePathname } from 'next/navigation'
import { CartContext } from '@bakery/shared/contexts'
import EnhancedButton from '../button/enhanced-button'

// Price formatter for Euro currency
const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

// Animation keyframes
// Removed bounce animation - was too distracting

const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
`

const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(208, 56, 186, 0.4);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(208, 56, 186, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(208, 56, 186, 0);
  }
`

const EnhancedCartButton: React.FC = () => {
  const cartContext = useContext(CartContext)
  const items = cartContext?.items || []
  const totalCount = cartContext?.summary?.totalCount || 0
  const totalPrice = cartContext?.summary?.total || 0
  const [showPreview, setShowPreview] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Trigger animation when items are added
  const prevCountRef = React.useRef(totalCount)
  React.useEffect(() => {
    // Only animate when count increases (item added)
    if (totalCount > prevCountRef.current) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      prevCountRef.current = totalCount
      return () => clearTimeout(timer)
    }
    prevCountRef.current = totalCount
    return undefined
  }, [totalCount])

  const handleCartClick = () => {
    if (isMobile) {
      router.push('/cart')
    } else {
      setShowPreview(!showPreview)
    }
  }

  const handleGoToCart = () => {
    router.push('/cart')
    setShowPreview(false)
  }

  const handleCheckout = () => {
    router.push('/bestellen')
    setShowPreview(false)
  }

  // Hide the floating button on mobile since cart is in bottom nav
  // Keep it visible on admin pages where there's no bottom nav
  if (totalCount === 0 || (isMobile && !pathname.startsWith('/admin'))) {
    return null
  }

  // Display first 3 items in preview
  const previewItems = items.slice(0, 3)
  const remainingCount = items.length - 3

  return (
    <>
      {/* Floating Cart Button */}
      <Zoom in={totalCount > 0}>
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: {
              xs: 'calc(80px + env(safe-area-inset-bottom))',
              sm: 32,
              md: 32,
            },
            right: { xs: 16, sm: 24, md: 32 },
            zIndex: 1100, // Below bottom nav (1200) but above content
            width: { xs: 56, md: 64 },
            height: { xs: 56, md: 64 },
            animation: isAnimating
              ? `${shake} 0.5s ease, ${pulse} 1.5s ease`
              : undefined, // Removed continuous bounce animation
            boxShadow: '0 4px 20px rgba(208, 56, 186, 0.4)',
            '&:hover': {
              transform: 'scale(1.1)',
              boxShadow: '0 6px 25px rgba(208, 56, 186, 0.5)',
            },
          }}
          onClick={handleCartClick}
          aria-label={`Warenkorb mit ${totalCount} Artikel${
            totalCount !== 1 ? 'n' : ''
          }`}
        >
          <Box sx={{ position: 'relative' }}>
            <ShoppingCartIcon sx={{ fontSize: { xs: 24, md: 28 } }} />
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                right: -12,
                backgroundColor: 'white',
                color: 'primary.dark', // Better contrast
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                boxShadow: 1,
              }}
            >
              {totalCount > 99 ? '99+' : totalCount}
            </Box>
          </Box>
        </Fab>
      </Zoom>

      {/* Cart Preview (Desktop Only) */}
      <Fade in={showPreview && !isMobile}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: { sm: 100, md: 110 },
            right: { sm: 24, md: 32 },
            width: 360,
            maxHeight: 480,
            zIndex: 1099,
            borderRadius: 2,
            overflow: 'hidden',
            display: showPreview && !isMobile ? 'block' : 'none',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              backgroundColor: 'primary.main',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Ihr Warenkorb ({totalCount})
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowPreview(false)}
              aria-label="Vorschau schließen"
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Items List */}
          <List sx={{ maxHeight: 280, overflow: 'auto', p: 0 }}>
            {previewItems.map((item, index) => (
              <React.Fragment key={item.id}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemAvatar>
                    <Avatar
                      src={item.image}
                      variant="rounded"
                      sx={{ width: 56, height: 56 }}
                    >
                      {item.name.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 'bold' }}
                      >
                        {item.name}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {item.quantity}x • {formatter.format(item.price)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 'bold', color: 'primary.dark' }}
                        >
                          {formatter.format(item.price * item.quantity)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < previewItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            {remainingCount > 0 && (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                    >
                      + {remainingCount} weitere Artikel
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>

          {/* Footer */}
          <Box sx={{ p: 2, backgroundColor: 'background.default' }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h6">Gesamt:</Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 'bold', color: 'primary.dark' }}
              >
                {formatter.format(totalPrice)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              <EnhancedButton
                variant="contained"
                fullWidth
                onClick={handleCheckout}
                endIcon={<ArrowForwardIcon />}
              >
                Zur Bestellung
              </EnhancedButton>
              <EnhancedButton
                variant="outlined"
                fullWidth
                onClick={handleGoToCart}
                size="small"
              >
                Warenkorb anzeigen
              </EnhancedButton>
            </Box>
          </Box>
        </Paper>
      </Fade>

      {/* Click outside to close preview */}
      {showPreview && !isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1098,
          }}
          onClick={() => setShowPreview(false)}
        />
      )}
    </>
  )
}

export default EnhancedCartButton
