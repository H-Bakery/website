import React from 'react'
import { Box, Grid, Typography } from '@mui/material'
import { PRODUCTS } from '../../mocks/products'
import Brot from '../icons/products/Brot'
import Broetchen from '../icons/products/Broetchen'
import Teilchen from '../icons/products/Teilchen'
import Kuchen from '../icons/products/Kuchen'
import Torten from '../icons/products/Torten'
import Getranke from '../icons/products/Getranke'

interface Item {
	id: number
	name: string
	category: string
	image: string
	price: number
}

interface Props {
	setProducts: (items: Item[]) => void
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

  console.log(selected)

  return (
    <Box sx={styles.root}>
      <Grid container spacing={4}>
        {FILTERS.map((item) => (
          <Grid item xs={2}>
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
    bgcolor: 'background.paper',
    borderRadius: '8px',
    boxShadow: 1,
    p: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.66,
    transition: 'opacity ease-in-out 200ms',
    
    '&.active': {
      opacity: 1,
    }
  }
}

export default Filter