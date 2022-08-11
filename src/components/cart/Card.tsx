import React from 'react'
import { Box, Chip, Typography } from '@mui/material'

import { CartContext, CartItem } from '../../context/CartContext'
import { formatter } from '../../utils/formatPrice'
import Button from '../button/Index'

const Card: React.FC<CartItem> = (props) => {
  const { id, image, name, category, price, count } = props

  const { remove, changeCount } = React.useContext(CartContext)

  return (
    <Box sx={styles.root}>
      <Box sx={styles.image}>
        <img src={image} />
      </Box>
      <Box sx={styles.content}>
        <Box sx={styles.tags}>
          <Typography
            gutterBottom
            variant='h6'
            fontSize={20}
          >
            {name}
          </Typography>
          <Box sx={styles.counter}>
            <Button
              onClick={() => changeCount(id, -1)}
              color='inherit'
              size='small'
              sx={{ minWidth: 32 }}
            >
              -
            </Button>
            <Typography fontWeight='bold' mx={2}>
              {count}
            </Typography>
            <Button
              onClick={() => changeCount(id, 1)}
              color='inherit'
              size='small'
              sx={{ minWidth: 32 }}
            >
              +
            </Button>
          </Box>
        </Box>
        <Box sx={styles.tags}>
          <Chip label={category} />
          <Box onClick={() => remove(id)}>
            remove
          </Box>
          <Typography variant='h6' fontSize={20}>
            {formatter.format(price)}
          </Typography>
        </Box>
      </Box>

    </Box>
  )
}

const styles ={
  root: {
    boxShadow: 1,
    borderRadius: '8px',
    bgcolor: 'background.paper',
    p: 2,
    width: '100%',
    mb: 2,
    display: 'flex',
  },
  image: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 70,
    width: 70,
    bgcolor: 'grey.100',
    borderRadius: '8px',
    border: '1px solid',
    borderColor: 'grey.300',
    mr: 2,

    '& img': {
      maxWidth: '80%',
      maxHeight: '80%',
    }
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  counter: {
    display: 'flex',
    alignItems: 'center'
  },
  tags: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
}

export default Card