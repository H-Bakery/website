import React from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { PRODUCTS } from '../../mocks/products'
import Brot from '../icons/products/Brot'
import Broetchen from '../icons/products/Broetchen'
import Teilchen from '../icons/products/Teilchen'
import Kuchen from '../icons/products/Kuchen'
import Torten from '../icons/products/Torten'
import Getranke from '../icons/products/Getranke'
import { Product } from './types'

interface Props {
	setProducts: (items: Product[]) => void
}

const FILTERS = [
  { label: 'Brot', icon: <Brot /> },
  { label: 'Brötchen',  icon: <Broetchen /> },
  { label: 'Teilchen',  icon: <Teilchen /> },
  { label: 'Kuchen',  icon: <Kuchen /> },
  { label: 'Torten',  icon: <Torten /> },
  { label: 'Getränke',  icon: <Getranke /> },
]

const Filter: React.FC<Props> = (props) => {
	const { setProducts } = props
  const [selected, setSelected] = React.useState('')

  React.useEffect(() => {
	  filter("Brot")
  }, [])
  
	const filter = (input: String) => {
    const newArray = 
      PRODUCTS.filter((product) =>
        product.category.includes(input)
      )
      .map((filteredName) => filteredName)

    setProducts(newArray)
    setSelected(input as string)
  }

  return (
    <Box sx={styles.root}>
      <Grid container spacing={4}>
        {FILTERS.map((item) => (
          <Grid key={item.label} item xs={4} sm={2} md={2}>
            <Box
              sx={styles.item}
              onClick={() => filter(item.label)}
              className={`${item.label === selected ? 'active' : ''}`}
            >
              {item.icon}
              <Typography mt={1}>{item.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

const styles = {
  root: {
    display: 'flex',
    justifyContent: 'space-between',
    mb: 4
  },
  item: {
    borderRadius: '8px',
    boxShadow: 1,
    p: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    bgcolor: 'background.default',
    transition: 'all ease-in-out 200ms',
    cursor: 'pointer',
    
    '& *': {
      transition: 'all ease-in-out 200ms',
      color: 'text.primary',
    },

    '&:hover': {
      bgcolor: 'grey.300',
      transform: 'translateY(-2px)',

      '& *': {
        fontWeight: 'bold',
      }
    },
    
    '&.active': {
      bgcolor: 'primary.main',
      
      '& *': {
        color: 'background.paper',
        fontWeight: 'bold',
      }
    },
  }
}

export default Filter