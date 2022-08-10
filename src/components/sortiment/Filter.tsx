import React from 'react'
import { Box } from '@mui/material'
import { PRODUCTS } from '../../mocks/products'

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

const Filter: React.FC<Props> = (props) => {
	const { setProducts } = props

	const filter = (input: String) => {
    const newArray = 
      PRODUCTS.filter((product) =>
        product.category.includes(input)
      )
      .map((filteredName) => filteredName)

    setProducts(newArray)
  }

  return (
    <Box>
			<button onClick={() => filter("Brot")}>Brote</button>
			<button onClick={() => filter("Kaffeestückchen")}>
				Kaffeestückchen
			</button>
			<button onClick={() => filter("Snacks")}>Snacks</button>
			<button onClick={() => filter("Kuchen")}>Kuchen</button>
			<button onClick={() => filter("Torten")}>Torten</button>
    </Box>
  )
}

export default Filter