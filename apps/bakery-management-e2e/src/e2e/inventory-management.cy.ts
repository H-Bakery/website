describe('Inventory Management E2E', () => {
  beforeEach(() => {
    // Login as admin
    cy.login('admin@bakery.com', 'password')

    // Navigate to inventory page
    cy.visit('/admin/inventory')

    // Mock API responses
    cy.intercept('GET', '/api/inventory*', {
      fixture: 'inventory-items.json',
    }).as('getInventory')
    cy.intercept('GET', '/api/products', { fixture: 'products.json' }).as(
      'getProducts'
    )
    cy.intercept('GET', '/api/inventory/categories', [
      'Rohstoffe',
      'Verpackung',
    ]).as('getCategories')
    cy.intercept('GET', '/api/inventory/suppliers', [
      'Supplier A',
      'Supplier B',
    ]).as('getSuppliers')
  })

  describe('Viewing Inventory', () => {
    it('should display inventory list', () => {
      cy.wait([
        '@getInventory',
        '@getProducts',
        '@getCategories',
        '@getSuppliers',
      ])

      // Verify data grid is displayed
      cy.get('[data-cy=inventory-datagrid]').should('be.visible')

      // Verify inventory items are shown
      cy.get('[data-cy=inventory-row]').should('have.length.at.least', 1)

      // Verify columns are displayed
      cy.contains('th', 'Produkt').should('be.visible')
      cy.contains('th', 'Bestand').should('be.visible')
      cy.contains('th', 'Mindestbestand').should('be.visible')
      cy.contains('th', 'Einheit').should('be.visible')
    })

    it('should highlight low stock items', () => {
      cy.wait('@getInventory')

      // Find row with low stock
      cy.get('[data-cy=inventory-row].inventory-row-low').should('exist')
      cy.get('[data-cy=inventory-row].inventory-row-critical').should('exist')
    })
  })

  describe('Filtering Inventory', () => {
    it('should filter by search term', () => {
      cy.wait('@getInventory')

      // Type in search field
      cy.get('[data-cy=search-field]').type('Mehl')

      // Verify filtered results
      cy.get('[data-cy=inventory-row]').should('have.length', 1)
      cy.contains('[data-cy=inventory-row]', 'Mehl').should('be.visible')
    })

    it('should filter by category', () => {
      cy.wait('@getInventory')

      // Select category
      cy.get('[data-cy=category-select]').click()
      cy.get('[data-cy=category-option-rohstoffe]').click()

      // Verify filtered results
      cy.get('[data-cy=inventory-row]').each(($row) => {
        cy.wrap($row).should('contain', 'Rohstoffe')
      })
    })

    it('should show only low stock items', () => {
      cy.wait('@getInventory')

      // Toggle low stock filter
      cy.get('[data-cy=low-stock-checkbox]').click()

      // Verify all shown items have low stock
      cy.get('[data-cy=inventory-row]').each(($row) => {
        cy.wrap($row)
          .should('have.class', 'inventory-row-low')
          .or('have.class', 'inventory-row-critical')
      })
    })
  })

  describe('Creating Inventory Item', () => {
    it('should create new inventory item', () => {
      cy.wait('@getInventory')

      // Mock create response
      cy.intercept('POST', '/api/inventory', {
        statusCode: 201,
        body: {
          id: 100,
          productId: 5,
          quantity: 100,
          minimumQuantity: 20,
        },
      }).as('createInventory')

      // Click add button
      cy.get('[data-cy=add-inventory-button]').click()

      // Fill form
      cy.get('[data-cy=product-select]').click()
      cy.get('[data-cy=product-option-5]').click()

      cy.get('[data-cy=quantity-field]').type('100')
      cy.get('[data-cy=minimum-quantity-field]').type('20')
      cy.get('[data-cy=unit-field]').type('kg')
      cy.get('[data-cy=location-field]').type('A1-B2')

      // Submit form
      cy.get('[data-cy=save-button]').click()

      // Verify API call and success
      cy.wait('@createInventory')
      cy.contains('Lagerbestand erfolgreich angelegt').should('be.visible')
    })

    it('should validate required fields', () => {
      cy.wait('@getInventory')

      // Open form
      cy.get('[data-cy=add-inventory-button]').click()

      // Try to submit empty form
      cy.get('[data-cy=save-button]').click()

      // Verify validation errors
      cy.contains('Produkt ist erforderlich').should('be.visible')
      cy.contains('Mindestbestand ist erforderlich').should('be.visible')
    })
  })

  describe('Editing Inventory Item', () => {
    it('should edit inventory item', () => {
      cy.wait('@getInventory')

      // Mock update response
      cy.intercept('PUT', '/api/inventory/1', {
        statusCode: 200,
        body: {
          id: 1,
          minimumQuantity: 30,
          reorderPoint: 40,
        },
      }).as('updateInventory')

      // Click edit button on first row
      cy.get('[data-cy=inventory-row]:first [data-cy=edit-button]').click()

      // Update fields
      cy.get('[data-cy=minimum-quantity-field]').clear().type('30')
      cy.get('[data-cy=reorder-point-field]').type('40')

      // Save changes
      cy.get('[data-cy=save-button]').click()

      // Verify success
      cy.wait('@updateInventory')
      cy.contains('Lagerbestand erfolgreich aktualisiert').should('be.visible')
    })
  })

  describe('Stock Adjustments', () => {
    it('should increase stock', () => {
      cy.wait('@getInventory')

      // Mock adjustment response
      cy.intercept('POST', '/api/inventory/1/adjust', {
        statusCode: 200,
        body: {
          id: 1,
          quantity: 150,
        },
      }).as('adjustStock')

      // Click adjust button
      cy.get(
        '[data-cy=inventory-row]:first [data-cy=adjust-stock-button]'
      ).click()

      // Fill adjustment form
      cy.get('[data-cy=adjustment-type-select]').click()
      cy.get('[data-cy=adjustment-type-increase]').click()

      cy.get('[data-cy=adjustment-quantity-field]').type('50')
      cy.get('[data-cy=adjustment-reason-field]').type(
        'Neue Lieferung erhalten'
      )

      // Verify preview
      cy.contains('Neuer Bestand: 150').should('be.visible')

      // Submit adjustment
      cy.get('[data-cy=adjust-button]').click()

      // Verify success
      cy.wait('@adjustStock')
      cy.contains('Bestand erfolgreich angepasst').should('be.visible')
    })

    it('should prevent negative stock', () => {
      cy.wait('@getInventory')

      // Click adjust button on item with quantity 100
      cy.get(
        '[data-cy=inventory-row]:first [data-cy=adjust-stock-button]'
      ).click()

      // Try to decrease by more than available
      cy.get('[data-cy=adjustment-type-select]').click()
      cy.get('[data-cy=adjustment-type-decrease]').click()

      cy.get('[data-cy=adjustment-quantity-field]').type('150')

      // Verify error message
      cy.contains('Bestand würde negativ werden').should('be.visible')

      // Verify submit button is disabled
      cy.get('[data-cy=adjust-button]').should('be.disabled')
    })
  })

  describe('Bulk Operations', () => {
    it('should export inventory data', () => {
      cy.wait('@getInventory')

      // Click export button
      cy.get('[data-cy=export-button]').click()

      // Verify download initiated
      cy.verifyDownload('inventory-export.csv')
    })

    it('should delete multiple items', () => {
      cy.wait('@getInventory')

      // Mock delete response
      cy.intercept('DELETE', '/api/inventory/*', {
        statusCode: 200,
      }).as('deleteInventory')

      // Select multiple items
      cy.get('[data-cy=select-all-checkbox]').click()

      // Click bulk delete button
      cy.get('[data-cy=bulk-delete-button]').click()

      // Confirm deletion
      cy.get('[data-cy=confirm-delete-button]').click()

      // Verify API calls
      cy.wait('@deleteInventory')
      cy.contains('Artikel erfolgreich gelöscht').should('be.visible')
    })
  })

  describe('Responsive Design', () => {
    it('should work on mobile devices', () => {
      // Set mobile viewport
      cy.viewport('iphone-x')

      cy.wait('@getInventory')

      // Verify mobile-optimized layout
      cy.get('[data-cy=inventory-datagrid]').should('be.visible')

      // Verify horizontal scroll for data grid
      cy.get('.MuiDataGrid-scrollArea--left').scrollTo('right')

      // Actions should be in menu on mobile
      cy.get(
        '[data-cy=inventory-row]:first [data-cy=actions-menu-button]'
      ).click()
      cy.contains('Bearbeiten').should('be.visible')
      cy.contains('Bestand anpassen').should('be.visible')
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        productId: i + 1,
        quantity: Math.floor(Math.random() * 1000),
        minimumQuantity: 50,
        product: { id: i + 1, name: `Product ${i + 1}` },
      }))

      cy.intercept('GET', '/api/inventory*', {
        body: {
          items: largeDataset.slice(0, 20),
          total: 1000,
          page: 1,
          limit: 20,
          totalPages: 50,
        },
      }).as('getLargeInventory')

      cy.wait('@getLargeInventory')

      // Verify pagination is shown
      cy.get('[data-cy=pagination]').should('be.visible')
      cy.contains('1 of 50').should('be.visible')

      // Navigate to next page
      cy.get('[data-cy=next-page-button]').click()

      // Verify page change
      cy.contains('2 of 50').should('be.visible')
    })
  })
})
