import React from 'react'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { Box, Paper, Typography, Chip, Skeleton } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import type { ProductAnalyticsPerformance } from '@bakery/shared/types'

export interface ProductRankingTableProps {
  products: ProductAnalyticsPerformance[]
  title?: string
  showRank?: boolean
  pageSize?: number
  height?: number
}

export function ProductRankingTable({
  products,
  title = 'Produktleistung',
  showRank = true,
  pageSize = 10,
  height = 400,
}: ProductRankingTableProps) {
  // Das DataGrid kann seine Höhe erst im Browser messen – auf dem Server
  // wird ein gleich großer Platzhalter gerendert (vermeidet Hydration-Warnungen).
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  const columns: GridColDef[] = [
    ...(showRank
      ? [
          {
            field: 'rank',
            headerName: 'Rang',
            width: 80,
            renderCell: (params: GridRenderCellParams) => {
              const rank =
                params.row.rank ||
                params.api.getRowIndexRelativeToVisibleRows(params.id) + 1
              return (
                <Chip
                  label={`#${rank}`}
                  color={
                    rank <= 3 ? 'success' : rank > 10 ? 'error' : 'default'
                  }
                  size="small"
                  icon={
                    rank <= 5 ? (
                      <TrendingUpIcon />
                    ) : rank > 15 ? (
                      <TrendingDownIcon />
                    ) : undefined
                  }
                />
              )
            },
          },
        ]
      : []),
    {
      field: 'productId',
      headerName: 'Produkt ID',
      width: 120,
    },
    {
      field: 'productName',
      headerName: 'Produktname',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'quantitySold',
      headerName: 'Verkaufte Menge',
      type: 'number',
      width: 140,
      headerAlign: 'right',
      align: 'right',
    },
    {
      field: 'revenue',
      headerName: 'Umsatz',
      type: 'number',
      width: 120,
      headerAlign: 'right',
      align: 'right',
      valueFormatter: (value) => formatCurrency(value),
    },
    {
      field: 'averagePrice',
      headerName: 'Ø Preis',
      type: 'number',
      width: 100,
      headerAlign: 'right',
      align: 'right',
      valueGetter: (_value, row) =>
        row.quantitySold ? row.revenue / row.quantitySold : 0,
      valueFormatter: (value) => formatCurrency(value),
    },
  ]

  const rows = products.map((product, index) => ({
    ...product,
    id: product.productId,
    rank: product.rank || index + 1,
  }))

  return (
    <Paper elevation={3} sx={{ p: 3, height: height + 100 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>

      <Box sx={{ height, width: '100%' }}>
        {!mounted ? (
          <Skeleton variant="rectangular" height={height} />
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            pageSizeOptions={[5, 10, 20, 25, 50]}
            checkboxSelection={false}
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { pageSize },
              },
              sorting: {
                sortModel: [{ field: 'revenue', sort: 'desc' }],
              },
            }}
            showToolbar
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
          />
        )}
      </Box>
    </Paper>
  )
}

export default ProductRankingTable
