import React from 'react'
import { Box, Grid, Typography } from '@mui/material'
import Brot from '../icons/products/brot-icon'
import Broetchen from '../icons/products/broetchen-icon'
import Teilchen from '../icons/products/teilchen-icon'
import Kuchen from '../icons/products/kuchen-icon'
import Torten from '../icons/products/torten-icon'
import Getranke from '../icons/products/getranke-icon'
import { Product } from '@bakery/shared/types'
import GridViewIcon from '@mui/icons-material/GridView'

interface Props {
  setProducts: (items: Product[]) => void
  allProducts: Product[]
}

const FILTERS = [
  { label: 'Alle', icon: <GridViewIcon /> },
  { label: 'Brot', icon: <Brot /> },
  { label: 'Brötchen', icon: <Broetchen /> },
  { label: 'Teilchen', icon: <Teilchen /> },
  { label: 'Kuchen', icon: <Kuchen /> },
  { label: 'Torten', icon: <Torten /> },
  { label: 'Getränke', icon: <Getranke /> },
]

const Filter: React.FC<Props> = (props) => {
  const { setProducts, allProducts } = props
  const [selected, setSelected] = React.useState('Alle')

  // Define filter function with useCallback
  const filter = React.useCallback(
    (input: string) => {
      if (input === 'Alle') {
        setProducts(allProducts)
      } else {
        const newArray = allProducts.filter((product) =>
          product.category.includes(input)
        )
        setProducts(newArray)
      }
      setSelected(input)
    },
    [setProducts, allProducts]
  )

  React.useEffect(() => {
    if (allProducts.length > 0) {
      filter('Alle')
    }
  }, [allProducts, filter])

  return (
    <Box sx={styles.root}>
      <Grid container spacing={2}>
        {FILTERS.map((item) => (
          <Grid key={item.label} item xs={6} sm={3} md={2}>
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
    mb: 4,
  },
  item: {
    borderRadius: '8px',
    boxShadow: 1,
    p: { xs: 1.5, sm: 2 },
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
      },
    },

    '&.active': {
      bgcolor: 'primary.main',

      '& *': {
        color: 'background.paper',
        fontWeight: 'bold',
      },
    },
  },
}

export default Filter
