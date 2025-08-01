'use client'
import React, { useState, useEffect } from 'react'
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
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  TablePagination,
  CircularProgress,
  Alert,
  Badge,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useTheme } from '../../../context/ThemeContext'
import { useAuth } from '../../../context/AuthContext'
import bakeryAPI from '../../../services/bakeryAPI'
import CreateUserModal from '../../../components/admin/staff/CreateUserModal'
import EditUserModal from '../../../components/admin/staff/EditUserModal'
import DeleteConfirmationModal from '../../../components/admin/staff/DeleteConfirmationModal'

interface StaffMember {
  id: number
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export default function StaffPage() {
  const { mode } = useTheme()
  const { user: currentUser } = useAuth()
  
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null)

  const fetchStaffMembers = async () => {
    setLoading(true)
    setError('')
    
    try {
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
      }
      
      if (searchTerm) params.search = searchTerm
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active'
      
      const response = await bakeryAPI.getStaff(params)
      setStaffMembers(response.users)
      setTotalItems(response.pagination.totalItems)
    } catch (error: any) {
      setError(error.message || 'Fehler beim Laden der Mitarbeiter')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaffMembers()
  }, [page, rowsPerPage, searchTerm, roleFilter, statusFilter])

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleEdit = (user: StaffMember) => {
    setSelectedUser(user)
    setEditModalOpen(true)
  }

  const handleDelete = (user: StaffMember) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
  }

  const handleUserCreated = () => {
    setCreateModalOpen(false)
    fetchStaffMembers()
  }

  const handleUserUpdated = () => {
    setEditModalOpen(false)
    setSelectedUser(null)
    fetchStaffMembers()
  }

  const handleUserDeleted = () => {
    setDeleteModalOpen(false)
    setSelectedUser(null)
    fetchStaffMembers()
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator'
      case 'staff':
        return 'Mitarbeiter'
      case 'user':
        return 'Benutzer'
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error'
      case 'staff':
        return 'primary'
      case 'user':
        return 'default'
      default:
        return 'default'
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" component="h2">
            Mitarbeiterverwaltung
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {totalItems} Mitarbeiter insgesamt
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Aktualisieren">
            <IconButton onClick={fetchStaffMembers} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Neuen Mitarbeiter hinzufügen">
            <IconButton 
              color="primary"
              onClick={() => setCreateModalOpen(true)}
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
      </Box>

      {/* Filters */}
      <Paper 
        elevation={mode === 'dark' ? 2 : 1}
        sx={{ p: 2, mb: 2, bgcolor: mode === 'dark' ? 'background.paper' : 'white' }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Suche nach Name, E-Mail oder Benutzername..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(0)
            }}
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(0)
              }}
              displayEmpty
            >
              <MenuItem value="all">Alle Rollen</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="staff">Mitarbeiter</MenuItem>
              <MenuItem value="user">Benutzer</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(0)
              }}
              displayEmpty
            >
              <MenuItem value="all">Alle Status</MenuItem>
              <MenuItem value="active">Aktiv</MenuItem>
              <MenuItem value="inactive">Inaktiv</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer 
        component={Paper} 
        elevation={mode === 'dark' ? 2 : 1}
        sx={{
          bgcolor: mode === 'dark' ? 'background.paper' : 'white',
        }}
      >
        {loading && staffMembers.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 650 }} aria-label="Mitarbeitertabelle">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>E-Mail</TableCell>
                  <TableCell>Rolle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Letzte Anmeldung</TableCell>
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
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            staff.isActive ? (
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: 'success.main',
                                  border: '2px solid',
                                  borderColor: 'background.paper',
                                }}
                              />
                            ) : null
                          }
                        >
                          <Avatar 
                            sx={{ mr: 2, bgcolor: 'primary.main' }}
                            alt={`${staff.firstName} ${staff.lastName}`}
                          >
                            {staff.firstName.charAt(0)}{staff.lastName.charAt(0)}
                          </Avatar>
                        </Badge>
                        <Box>
                          <Typography variant="body1">
                            {staff.firstName} {staff.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{staff.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getRoleLabel(staff.role)} 
                        color={getRoleColor(staff.role) as any}
                        size="small"
                        variant={mode === 'dark' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={staff.isActive ? 'Aktiv' : 'Inaktiv'} 
                        color={staff.isActive ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {staff.lastLogin ? (
                        new Date(staff.lastLogin).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Noch nie
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Bearbeiten">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(staff)}
                          disabled={currentUser?.id === staff.id && staff.role === 'admin'}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDelete(staff)}
                          disabled={currentUser?.id === staff.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalItems}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Zeilen pro Seite:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} von ${count !== -1 ? count : `mehr als ${to}`}`}
            />
          </>
        )}
      </TableContainer>

      {/* Modals */}
      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onUserCreated={handleUserCreated}
      />
      
      <EditUserModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setSelectedUser(null)
        }}
        onUserUpdated={handleUserUpdated}
        user={selectedUser}
      />
      
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedUser(null)
        }}
        onUserDeleted={handleUserDeleted}
        user={selectedUser}
      />
    </Box>
  )
}