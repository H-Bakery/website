const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')

// In-memory mock staff data
let staffMembers = [
  {
    id: 1,
    username: 'mmueller',
    email: 'max.mueller@baeckerei.de',
    firstName: 'Max',
    lastName: 'Müller',
    role: 'admin',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    username: 'aschmidt',
    email: 'anna.schmidt@baeckerei.de',
    firstName: 'Anna',
    lastName: 'Schmidt',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-02-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    username: 'tweber',
    email: 'thomas.weber@baeckerei.de',
    firstName: 'Thomas',
    lastName: 'Weber',
    role: 'staff',
    isActive: true,
    lastLogin: null,
    createdAt: '2024-03-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    username: 'lbecker',
    email: 'lisa.becker@baeckerei.de',
    firstName: 'Lisa',
    lastName: 'Becker',
    role: 'staff',
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    username: 'jklein',
    email: 'julia.klein@baeckerei.de',
    firstName: 'Julia',
    lastName: 'Klein',
    role: 'user',
    isActive: false,
    lastLogin: null,
    createdAt: '2024-05-20T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
]

// GET /api/staff - List staff with pagination and filtering
router.get('/', authenticate, (req, res) => {
  const { page = 1, limit = 10, search, role, isActive } = req.query
  let filtered = [...staffMembers]

  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(
      (u) =>
        u.firstName.toLowerCase().includes(s) ||
        u.lastName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.username.toLowerCase().includes(s)
    )
  }

  if (role) filtered = filtered.filter((u) => u.role === role)
  if (isActive !== undefined)
    filtered = filtered.filter((u) => u.isActive === (isActive === 'true'))

  const p = parseInt(page)
  const l = parseInt(limit)
  const start = (p - 1) * l

  res.json({
    users: filtered.slice(start, start + l),
    pagination: {
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / l),
      currentPage: p,
      itemsPerPage: l,
    },
  })
})

// GET /api/staff/:id
router.get('/:id', authenticate, (req, res) => {
  const member = staffMembers.find((s) => s.id === parseInt(req.params.id))
  if (!member) return res.status(404).json({ error: 'Staff member not found' })
  res.json(member)
})

// POST /api/staff
router.post('/', authenticate, (req, res) => {
  const { username, email, firstName, lastName, role } = req.body
  const newMember = {
    id: Math.max(...staffMembers.map((s) => s.id)) + 1,
    username,
    email,
    firstName,
    lastName,
    role: role || 'staff',
    isActive: true,
    lastLogin: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  staffMembers.push(newMember)
  res.status(201).json(newMember)
})

// PUT /api/staff/:id
router.put('/:id', authenticate, (req, res) => {
  const index = staffMembers.findIndex((s) => s.id === parseInt(req.params.id))
  if (index === -1)
    return res.status(404).json({ error: 'Staff member not found' })

  staffMembers[index] = {
    ...staffMembers[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  }
  res.json(staffMembers[index])
})

// DELETE /api/staff/:id (soft delete - deactivate)
router.delete('/:id', authenticate, (req, res) => {
  const index = staffMembers.findIndex((s) => s.id === parseInt(req.params.id))
  if (index === -1)
    return res.status(404).json({ error: 'Staff member not found' })

  staffMembers[index].isActive = false
  staffMembers[index].updatedAt = new Date().toISOString()
  res.json({ message: 'Staff member deactivated successfully' })
})

module.exports = router
