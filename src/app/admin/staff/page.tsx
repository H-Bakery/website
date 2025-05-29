'use client'
import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import { useTheme } from '../../../context/ThemeContext'

// Mock data for staff members
const staffMembers = [
  {
    id: 1,
    name: 'Anna Schmidt',
    role: 'Bäckermeisterin',
    department: 'Produktion',
    email: 'anna.schmidt@example.com',
    status: 'Aktiv',
    avatar: null,
  },
  {
    id: 2,
    name: 'Thomas Müller',
    role: 'Verkäufer',
    department: 'Verkauf',
    email: 'thomas.mueller@example.com',
    status: 'Aktiv',
    avatar: null,
  },
  {
    id: 3,
    name: 'Lisa Wagner',
    role: 'Konditorin',
    department: 'Produktion',
    email: 'lisa.wagner@example.com',
    status: 'Urlaub',
    avatar: null,
  },
  {
    id: 4,
    name: 'Michael Weber',
    role: 'Filialleiter',
    department: 'Management',
    email: 'michael.weber@example.com',
    status: 'Aktiv',
    avatar: null,
  },
  {
    id: 5,
    name: 'Sarah Becker',
    role: 'Verkäuferin',
    department: 'Verkauf',
    email: 'sarah.becker@example.com',
    status: 'Krank',
    avatar: null,
  },
]

export default function StaffPage() {
  const { mode } = useTheme()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv':
        return 'success'
      case 'Urlaub':
        return 'info'
      case 'Krank':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          Mitarbeiterverwaltung
        </Typography>
        
        <Tooltip title="Neuen Mitarbeiter hinzufügen">
          <IconButton 
            color="primary"
            sx={{ 
              bgcolor: mode === 'dark' ? 'rgba(208, 56, 186, 0.1)' : 'rgba(208, 56, 186, 0.05)',
              '&:hover': {
                bgcolor: mode === 'dark' ? 'rgba(208, 56, 186, 0.2)' : 'rgba(208, 56, 186, 0.1)',
              }
            }}
          >
            <PersonAddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <TableContainer 
        component={Paper} 
        elevation={mode === 'dark' ? 2 : 1}
        sx={{
          bgcolor: mode === 'dark' ? 'background.paper' : 'white',
        }}
      >
        <Table sx={{ minWidth: 650 }} aria-label="Mitarbeitertabelle">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Abteilung</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staffMembers.map((staff) => (
              <TableRow
                key={staff.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar 
                      sx={{ mr: 2, bgcolor: 'primary.main' }}
                      alt={staff.name}
                      src={staff.avatar || undefined}
                    >
                      {staff.name.charAt(0)}
                    </Avatar>
                    {staff.name}
                  </Box>
                </TableCell>
                <TableCell>{staff.role}</TableCell>
                <TableCell>{staff.department}</TableCell>
                <TableCell>{staff.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={staff.status} 
                    color={getStatusColor(staff.status) as any}
                    size="small"
                    variant={mode === 'dark' ? 'outlined' : 'filled'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Bearbeiten">
                    <IconButton size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Löschen">
                    <IconButton size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}