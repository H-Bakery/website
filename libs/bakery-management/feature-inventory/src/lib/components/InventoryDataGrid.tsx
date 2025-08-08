import React, { useState, useMemo } from 'react';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbar,
  GridRowSelectionModel,
  GridActionsCellItem,
} from '@mui/x-data-grid';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as AdjustIcon,
  Warning as WarningIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { InventoryItem } from '@bakery/shared/data-access';

interface InventoryDataGridProps {
  items: InventoryItem[];
  loading: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onAdjustStock: (item: InventoryItem) => void;
  onSelectionChange?: (ids: number[]) => void;
  onExport?: () => void;
}

export const InventoryDataGrid: React.FC<InventoryDataGridProps> = ({
  items,
  loading,
  onEdit,
  onDelete,
  onAdjustStock,
  onSelectionChange,
  onExport,
}) => {
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([]);
  const [pageSize, setPageSize] = useState(25);

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= item.minimumQuantity) {
      return 'critical';
    }
    if (item.reorderPoint && item.quantity <= item.reorderPoint) {
      return 'low';
    }
    return 'normal';
  };

  const getRowClassName = (params: any) => {
    const status = getStockStatus(params.row);
    if (status === 'critical') return 'inventory-row-critical';
    if (status === 'low') return 'inventory-row-low';
    return '';
  };

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'product.name',
      headerName: 'Produkt',
      flex: 1,
      minWidth: 200,
      valueGetter: (params) => params.row.product?.name || 'N/A',
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {params.row.product?.name}
          </Typography>
          {params.row.product?.category && (
            <Typography variant="caption" color="text.secondary">
              {params.row.product.category}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'quantity',
      headerName: 'Bestand',
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => {
        const status = getStockStatus(params.row);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {status !== 'normal' && (
              <Tooltip title={status === 'critical' ? 'Kritischer Bestand' : 'Niedriger Bestand'}>
                <WarningIcon 
                  color={status === 'critical' ? 'error' : 'warning'} 
                  fontSize="small" 
                />
              </Tooltip>
            )}
            <Typography variant="body2" fontWeight={status !== 'normal' ? 600 : 400}>
              {params.value} {params.row.unit || 'Stk'}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'minimumQuantity',
      headerName: 'Min. Bestand',
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {params.value} {params.row.unit || 'Stk'}
        </Typography>
      ),
    },
    {
      field: 'reorderPoint',
      headerName: 'Bestellpunkt',
      width: 120,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
          {params.value || '-'} {params.value && (params.row.unit || 'Stk')}
        </Typography>
      ),
    },
    {
      field: 'category',
      headerName: 'Kategorie',
      width: 150,
      renderCell: (params: GridRenderCellParams) => 
        params.value ? (
          <Chip label={params.value} size="small" variant="outlined" />
        ) : null,
    },
    {
      field: 'location',
      headerName: 'Lagerort',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.secondary'}>
          {params.value || 'Nicht angegeben'}
        </Typography>
      ),
    },
    {
      field: 'supplier',
      headerName: 'Lieferant',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          {params.value && (
            <>
              <Typography variant="body2">{params.value}</Typography>
              {params.row.supplierContact && (
                <Typography variant="caption" color="text.secondary">
                  {params.row.supplierContact}
                </Typography>
              )}
            </>
          )}
        </Box>
      ),
    },
    {
      field: 'lastRestocked',
      headerName: 'Letzte Lieferung',
      width: 140,
      renderCell: (params: GridRenderCellParams) => 
        params.value ? (
          <Typography variant="body2">
            {format(new Date(params.value), 'dd.MM.yyyy', { locale: de })}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">-</Typography>
        ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Aktionen',
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<Tooltip title="Bestand anpassen"><AdjustIcon /></Tooltip>}
          label="Adjust"
          onClick={() => onAdjustStock(params.row)}
          color="primary"
        />,
        <GridActionsCellItem
          icon={<Tooltip title="Bearbeiten"><EditIcon /></Tooltip>}
          label="Edit"
          onClick={() => onEdit(params.row)}
        />,
        <GridActionsCellItem
          icon={<Tooltip title="Löschen"><DeleteIcon /></Tooltip>}
          label="Delete"
          onClick={() => onDelete(params.row)}
          color="error"
        />,
      ],
    },
  ], [onEdit, onDelete, onAdjustStock]);

  const handleSelectionChange = (newSelection: GridRowSelectionModel) => {
    setSelectionModel(newSelection);
    if (onSelectionChange) {
      onSelectionChange(newSelection as number[]);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {onExport && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={onExport}
          >
            Exportieren
          </Button>
        </Box>
      )}
      <DataGrid
        rows={items}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={handleSelectionChange}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        rowsPerPageOptions={[10, 25, 50, 100]}
        getRowClassName={getRowClassName}
        autoHeight
        components={{
          Toolbar: GridToolbar,
        }}
        componentsProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500 },
          },
        }}
        sx={{
          '& .inventory-row-critical': {
            backgroundColor: 'error.lighter',
            '&:hover': {
              backgroundColor: 'error.light',
            },
          },
          '& .inventory-row-low': {
            backgroundColor: 'warning.lighter',
            '&:hover': {
              backgroundColor: 'warning.light',
            },
          },
          '& .MuiDataGrid-toolbarContainer': {
            padding: 2,
            borderBottom: 1,
            borderColor: 'divider',
          },
        }}
      />
    </Box>
  );
};