'use client'
import React, { useState, useEffect, useCallback } from 'react'
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
import { bakeryAPI } from '@bakery/shared/data-access'
import {
  CreateUserModal,
  EditUserModal,
  DeleteConfirmationModal,
} from '@bakery/management/feature-staff'

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

  const fetchStaffMembers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params: {
        page: number
        limit: number
        search?: string
        role?: string
        isActive?: boolean
      } = {
        page: page + 1,
        limit: rowsPerPage,
      }

      if (searchTerm) params.search = searchTerm
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active'

      const response = await bakeryAPI.getStaff(params)
      setStaffMembers(response.users)
      setTotalItems(response.pagination.totalItems)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Fehler beim Laden der Mitarbeiter'
      )
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, searchTerm, roleFilter, statusFilter])

  useEffect(() => {
    fetchStaffMembers()
  }, [fetchStaffMembers])

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const getRoleColor = (role: string): 'error' | 'primary' | 'default' => {
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mb: 3,
          alignItems: 'center',
        }}
      >
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
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <PersonAddIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Suche nach Name, E-Mail oder Benutzername..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(0)
            }}
            sx={{
              minWidth: { xs: 200, sm: 300 },
              flex: { xs: '1 1 100%', sm: '0 1 auto' },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 150 } }}>
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

          <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 150 } }}>
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

      <TableContainer component={Paper}>
        {loading && staffMembers.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table aria-label="Mitarbeitertabelle">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    E-Mail
                  </TableCell>
                  <TableCell>Rolle</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                    Letzte Anmeldung
                  </TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffMembers.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Keine Mitarbeiter gefunden
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {staffMembers.map((staff) => (
                  <TableRow
                    key={staff.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                          }}
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
                            {staff.firstName.charAt(0)}
                            {staff.lastName.charAt(0)}
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
                    <TableCell
                      sx={{ display: { xs: 'none', md: 'table-cell' } }}
                    >
                      {staff.email}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleLabel(staff.role)}
                        color={getRoleColor(staff.role)}
                        size="small"
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', sm: 'table-cell' } }}
                    >
                      <Chip
                        label={staff.isActive ? 'Aktiv' : 'Inaktiv'}
                        color={staff.isActive ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: 'none', lg: 'table-cell' } }}
                    >
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
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Löschen">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(staff)}
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
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} von ${count !== -1 ? count : `mehr als ${to}`}`
              }
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
