// src/components/admin/products/ProductFilters.tsx
'use client'

import React from 'react'
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  SelectChangeEvent,
} from '@mui/material'

interface ProductFiltersProps {
  categories: string[]
  filterValues: {
    name: string
    category: string
    status: string
  }
  onFilterChange: (
    filterName: keyof ProductFiltersProps['filterValues'],
    value: string
  ) => void
}

export default function ProductFilters({
  categories,
  filterValues,
  onFilterChange,
}: ProductFiltersProps) {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange(
      event.target.name as keyof ProductFiltersProps['filterValues'],
      event.target.value
    )
  }

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    onFilterChange(
      event.target.name as keyof ProductFiltersProps['filterValues'],
      event.target.value
    )
  }

  return (
    <Box sx={{ mb: 3, p: 2, border: '1px solid #ddd', borderRadius: '4px' }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Search by Name"
            name="name"
            value={filterValues.name}
            onChange={handleInputChange}
            variant="outlined"
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="category-filter-label">Category</InputLabel>
            <Select
              labelId="category-filter-label"
              label="Category"
              name="category"
              value={filterValues.category}
              onChange={handleSelectChange}
            >
              <MenuItem value="">
                <em>All Categories</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              name="status"
              value={filterValues.status}
              onChange={handleSelectChange}
            >
              <MenuItem value="">
                <em>All Statuses</em>
              </MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  )
}
