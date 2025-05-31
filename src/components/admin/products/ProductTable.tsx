// src/components/admin/products/ProductTable.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Product } from '../../../types/product';
import { formatter } from '../../../utils/formatPrice'; // Assuming this utility exists

interface ProductTableProps {
  products: Product[];
  onDelete: (productId: number) => void;
  // Add more props later for sorting, pagination, etc.
}

const headCells = [
  { id: 'id', label: 'ID' },
  { id: 'name', label: 'Name' },
  { id: 'category', label: 'Category' },
  { id: 'price', label: 'Price' },
  { id: 'stock', label: 'Stock' },
  { id: 'dailyTarget', label: 'Daily Target' },
  { id: 'status', label: 'Status' },
  { id: 'actions', label: 'Actions' },
];

export default function ProductTable({ products, onDelete }: ProductTableProps) {
  if (!products || products.length === 0) {
    return <Typography sx={{ mt: 2, textAlign: 'center' }}>No products to display.</Typography>;
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table sx={{ minWidth: 650 }} aria-label="simple product table">
        <TableHead>
          <TableRow>
            {headCells.map((headCell) => (
              <TableCell key={headCell.id} sx={{ fontWeight: 'bold' }}>
                {headCell.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {product.id}
              </TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.category}</TableCell>
              <TableCell>{formatter.format(product.price)}</TableCell>
              <TableCell>{product.stock}</TableCell>
              <TableCell>{product.dailyTarget}</TableCell>
              <TableCell>
                <Chip
                  label={product.isActive ? 'Active' : 'Inactive'}
                  color={product.isActive ? 'success' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Tooltip title="View Product">
                  <IconButton
                    component={Link}
                    href={`/admin/products/${product.id}`}
                    size="small"
                    sx={{ mr: 0.5 }}
                  >
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit Product">
                  <IconButton
                    component={Link}
                    href={`/admin/products/${product.id}`} // Edit will also go to detail view for now
                    size="small"
                    sx={{ mr: 0.5 }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Product">
                  <IconButton
                    onClick={() => onDelete(product.id)}
                    size="small"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
