import { bakeryAPI } from '@bakery/shared/data-access'

describe('bakeryAPI staff management', () => {
  describe('getStaff', () => {
    it('returns paginated staff list', async () => {
      const result = await bakeryAPI.getStaff()
      expect(result.users).toBeDefined()
      expect(result.pagination).toBeDefined()
      expect(result.pagination.currentPage).toBe(1)
      expect(result.pagination.itemsPerPage).toBe(10)
      expect(result.users.length).toBeGreaterThan(0)
    })

    it('filters by search term', async () => {
      const result = await bakeryAPI.getStaff({ search: 'Max' })
      expect(result.users.length).toBe(1)
      expect(result.users[0].firstName).toBe('Max')
    })

    it('filters by role', async () => {
      const result = await bakeryAPI.getStaff({ role: 'admin' })
      expect(result.users.every((u) => u.role === 'admin')).toBe(true)
    })

    it('filters by isActive', async () => {
      const result = await bakeryAPI.getStaff({ isActive: false })
      expect(result.users.every((u) => u.isActive === false)).toBe(true)
      expect(result.users.length).toBeGreaterThan(0)
    })

    it('paginates correctly', async () => {
      const result = await bakeryAPI.getStaff({ page: 1, limit: 2 })
      expect(result.users.length).toBeLessThanOrEqual(2)
      expect(result.pagination.itemsPerPage).toBe(2)
    })
  })

  describe('createStaff', () => {
    it('creates a new staff member', async () => {
      const newStaff = {
        username: 'testuser',
        email: 'test@baeckerei.de',
        firstName: 'Test',
        lastName: 'User',
        role: 'staff' as const,
      }
      const result = await bakeryAPI.createStaff(newStaff)
      expect(result.id).toBeDefined()
      expect(result.username).toBe('testuser')
      expect(result.email).toBe('test@baeckerei.de')
      expect(result.isActive).toBe(true)
      expect(result.lastLogin).toBeNull()
      expect(result.createdAt).toBeDefined()
    })
  })

  describe('updateStaff', () => {
    it('updates an existing staff member', async () => {
      const result = await bakeryAPI.updateStaff(1, {
        firstName: 'Maximilian',
      })
      expect(result.firstName).toBe('Maximilian')
      expect(result.id).toBe(1)
      expect(result.updatedAt).toBeDefined()
    })

    it('throws for non-existent staff member', async () => {
      await expect(
        bakeryAPI.updateStaff(9999, { firstName: 'Nobody' })
      ).rejects.toThrow('Mitarbeiter nicht gefunden')
    })
  })

  describe('deleteStaff', () => {
    it('soft-deletes a staff member', async () => {
      const result = await bakeryAPI.deleteStaff(2)
      expect(result.message).toBeDefined()

      const list = await bakeryAPI.getStaff({ isActive: false })
      const deactivated = list.users.find((u) => u.id === 2)
      expect(deactivated).toBeDefined()
      expect(deactivated?.isActive).toBe(false)
    })

    it('throws for non-existent staff member', async () => {
      await expect(bakeryAPI.deleteStaff(9999)).rejects.toThrow(
        'Mitarbeiter nicht gefunden'
      )
    })
  })
})
