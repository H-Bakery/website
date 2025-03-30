import React from 'react'
import {
  Box,
  BoxProps,
  Container,
  Grid,
  Typography,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  TextField,
  Divider,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import SortIcon from '@mui/icons-material/Sort'
import ProductCard from './ProductCard'
import { Product } from '../../products/types'

interface Props extends BoxProps {
  header?: React.ReactNode
  items: Product[]
  showControls?: boolean
  title?: string
}

const Products: React.FC<Props> = (props) => {
  const { items, header, showControls = false, title, sx } = props
  const [page, setPage] = React.useState(1)
  const [sortBy, setSortBy] = React.useState('')
  const [searchTerm, setSearchTerm] = React.useState('')

  // Items per page
  const itemsPerPage = 8

  // Filter and sort products
  const filteredItems = React.useMemo(() => {
    let result = [...items]

    // Apply search filter if search term exists
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          item.category.toLowerCase().includes(lowerSearch)
      )
    }

    // Apply sorting
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  }, [items, searchTerm, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const displayedItems = filteredItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  )

  // Reset to page 1 when search or sort changes
  React.useEffect(() => {
    setPage(1)
  }, [searchTerm, sortBy])

  return (
    <Box
      sx={{
        py: 4,
        ...sx,
      }}
      component="section"
      aria-label="Produkt Liste"
    >
      <Container>
        {header ||
          (title && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="h4"
                component="h2"
                fontWeight="bold"
                gutterBottom
              >
                {title}
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Box>
          ))}

        {/* Search and Filter Controls */}
        {showControls && filteredItems.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
              mb: 3,
              gap: 2,
            }}
          >
            <TextField
              label="Produkte suchen"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: { sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-select-label">Sortieren nach</InputLabel>
              <Select
                labelId="sort-select-label"
                value={sortBy}
                label="Sortieren nach"
                onChange={(e) => setSortBy(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon />
                  </InputAdornment>
                }
              >
                <MenuItem value="">
                  <em>Standard</em>
                </MenuItem>
                <MenuItem value="price-asc">Preis aufsteigend</MenuItem>
                <MenuItem value="price-desc">Preis absteigend</MenuItem>
                <MenuItem value="name">Name</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Product Grid */}
        {displayedItems.length > 0 ? (
          <Grid container spacing={3} aria-live="polite">
            {displayedItems.map((item) => (
              <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
                <ProductCard {...item} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Keine Produkte gefunden
            </Typography>
          </Box>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 4,
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, newPage) => setPage(newPage)}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
              aria-label="Produkt-Seitennavigation"
            />
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default Products
