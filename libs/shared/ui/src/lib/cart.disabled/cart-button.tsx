import React from 'react'
import { Box, Typography, IconButton, IconButtonProps } from '@mui/material'
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded'
import { useRouter } from 'next/navigation'
import { CartContext } from '../../context/CartContext'

const CartButton: React.FC<IconButtonProps> = (props) => {
  const { totalCount } = React.useContext(CartContext)
  const router = useRouter()

  const handleClick = () => {
    router.push('/cart')
  }

  if (totalCount === 0) {
    return null // Don't show cart button when empty
  }

  return (
    <IconButton
      sx={styles.root}
      onClick={handleClick}
      aria-label={`Warenkorb mit ${totalCount} Artikel${
        totalCount !== 1 ? 'n' : ''
      }`}
      {...props}
    >
      <Box sx={styles.wrapper}>
        <Box sx={styles.badge}>
          <Typography fontWeight="bold" fontSize="0.75rem">
            {totalCount > 99 ? '99+' : totalCount}
          </Typography>
        </Box>
        <ShoppingCartRoundedIcon />
      </Box>
    </IconButton>
  )
}

const styles = {
  root: {
    position: 'fixed',
    zIndex: 100001,
    bottom: 40,
    right: 40,
    borderRadius: '50%',
    bgcolor: 'primary.main',
    height: 50,
    width: 50,
    boxShadow: 3,
    '&:hover': {
      bgcolor: 'primary.dark',
      boxShadow: 6,
    },
    '& svg': {
      color: 'common.white',
    },
  },
  wrapper: {
    position: 'relative',
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: '50%',
    bgcolor: 'common.white',
    height: 20,
    width: 20,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: 1,
  },
}

export default CartButton
