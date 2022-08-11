import React from 'react'
import { Box, BoxProps, Typography } from '@mui/material'
import ShoppingCartRoundedIcon from '@mui/icons-material/ShoppingCartRounded'
import { CartContext } from '../../context/CartContext'

const CartButton: React.FC<BoxProps> = (props) => {
  const { items } = React.useContext(CartContext)
  const count = items.length

  return (
    <Box sx={styles.root} {...props} >
      <Box sx={styles.wrapper}>
        <Box sx={styles.badge}>
          <Typography fontWeight='bold'>{count}</Typography>
        </Box>
        <ShoppingCartRoundedIcon />
      </Box>
    </Box>
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
    boxShadow: 1,
    
    '& svg': {
      color: 'common.white'
    }
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
  }
}

export default CartButton