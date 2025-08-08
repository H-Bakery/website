import React from 'react';
import {
  Box,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Chip,
  Stack,
  InputAdornment,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { InventoryFilters as IInventoryFilters } from '@bakery/shared/data-access';

interface InventoryFiltersProps {
  filters: IInventoryFilters;
  onFiltersChange: (filters: IInventoryFilters) => void;
  categories: string[];
  suppliers: string[];
  onClearFilters: () => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  filters,
  onFiltersChange,
  categories,
  suppliers,
  onClearFilters,
}) => {
  const handleChange = (field: keyof IInventoryFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '' && v !== false && v !== undefined).length;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon color="action" />
          <Typography variant="h6">Filter</Typography>
          {activeFiltersCount > 0 && (
            <Chip 
              label={activeFiltersCount} 
              size="small" 
              color="primary" 
            />
          )}
        </Box>
        {activeFiltersCount > 0 && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={onClearFilters}
          >
            Alle löschen
          </Button>
        )}
      </Box>

      <Stack spacing={2}>
        <TextField
          fullWidth
          placeholder="Suchen nach Produkt, Lagerort oder Lieferant..."
          value={filters.search || ''}
          onChange={(e) => handleChange('search', e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Kategorie</InputLabel>
            <Select
              value={filters.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
              label="Kategorie"
            >
              <MenuItem value="">
                <em>Alle</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Lieferant</InputLabel>
            <Select
              value={filters.supplier || ''}
              onChange={(e) => handleChange('supplier', e.target.value)}
              label="Lieferant"
            >
              <MenuItem value="">
                <em>Alle</em>
              </MenuItem>
              {suppliers.map((supplier) => (
                <MenuItem key={supplier} value={supplier}>
                  {supplier}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={filters.lowStock || false}
                onChange={(e) => handleChange('lowStock', e.target.checked)}
                color="warning"
              />
            }
            label="Nur niedrige Bestände"
          />
        </Box>

        {activeFiltersCount > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {filters.search && (
              <Chip
                label={`Suche: ${filters.search}`}
                onDelete={() => handleChange('search', '')}
                size="small"
              />
            )}
            {filters.category && (
              <Chip
                label={`Kategorie: ${filters.category}`}
                onDelete={() => handleChange('category', '')}
                size="small"
              />
            )}
            {filters.supplier && (
              <Chip
                label={`Lieferant: ${filters.supplier}`}
                onDelete={() => handleChange('supplier', '')}
                size="small"
              />
            )}
            {filters.lowStock && (
              <Chip
                label="Niedrige Bestände"
                onDelete={() => handleChange('lowStock', false)}
                size="small"
                color="warning"
              />
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
};